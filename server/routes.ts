import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { storage, type IStorage } from './storage'; // Import IStorage type
import multer from 'multer';
import Papa from 'papaparse'; // Import papaparse
import path from 'path';
import fsSync from 'fs'; // Use fsSync for synchronous operations like mkdirSync
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  selectionFormSchema,
  insertResultSchema,
  insertCompetitionSchema,
  holeInOneFormSchema,
  type Competition,
  type Selection,
  User,
  Golfer,
  type InsertSelection, // Added import for InsertSelection
  type HoleInOne, // Import HoleInOne type
  type UserPoints,
  type SelectionRank, // Import SelectionRank type
  type Result, // Import Result type
  type WildcardGolfer, // Import WildcardGolfer type
  passwordResetTokens,
} from '@shared/schema';
import { generateToken, verifyToken, comparePassword, hashPassword } from './db'; // Import hashPassword
import { ZodError, z } from 'zod'; // Import z
import { pgClient, pool } from './db';
import { updateResultsAndAllocatePoints, type ProcessStatus } from '../scripts/update_results_and_allocate_points'; // Import ProcessStatus type
import { spawn } from 'child_process';
import crypto from 'crypto'; // Import crypto for password generation
import Fuse from 'fuse.js'; // Import Fuse.js for fuzzy matching
import { remove as removeDiacritics } from 'diacritics'; // Import diacritics removal function
// path is already imported above
import { fileURLToPath } from 'url'; // Import fileURLToPath for ES Modules
import axios from 'axios'; // Import axios
import * as cheerio from 'cheerio'; // Correct cheerio import for ES Modules
import fs from 'fs/promises'; // Import fs promises for async file writing
import { db, getCompetitionSelectionCounts, getTotalUsersCount, getUsersWithoutSelections } from './db'; // Import db and new functions
import { users, selections, appMetadata } from '@shared/schema'; // Import schema tables, ADD appMetadata
import { eq, ne, and, or, inArray, notInArray, gt, isNull } from 'drizzle-orm'; // Import Drizzle operators, added notInArray
import { sendPasswordResetLinkEmail, sendTemporaryPasswordEmail } from './mail';

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extended user interface including JWT properties
interface ExtendedUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  database_id?: number;
  isAdmin?: boolean;
}

const FORGOT_PASSWORD_MESSAGE = "If an account exists for that email, a reset link has been sent.";

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: ExtendedUser;
    }
  }
}

// Middleware to validate JWT
const validateJWT = async (req: Request, res: Response, next: NextFunction) => {
  // Removed debug logging

  const path = req.path.replace(/^\/api/, '');
  const method = req.method;
  const route = `${path} ${method}`;
  console.log(`Validating auth for: ${route}`);

  // List of explicitly public routes (paths starting after /api/)
  const publicRoutes = [
    '/auth/login POST',
    '/auth/forgot-password POST',
    '/auth/reset-password POST',
    '/competitions GET',
    '/competitions/all GET',
    '/competitions/active GET',
    '/competitions/upcoming GET',
    '/golfers GET',
    '/leaderboard GET',
    '/test-leaderboard GET',
    '/dashboard/stats GET',
    // Add patterns for dynamic public routes
    '/leaderboard/:competitionId GET',
    '/competitions/:id GET',
    '/results/:competitionId GET',
    '/competitions/:competitionId/hole-in-ones GET'
  ];

  // Check if the current route matches any public route pattern
  const isPublic = publicRoutes.some(publicRoute => {
    const [publicPath, publicMethod] = publicRoute.split(' ');
    if (publicMethod !== method) return false;
    // Simple wildcard matching for dynamic parts
    const publicPathRegex = new RegExp(`^${publicPath.replace(/:\w+/g, '\\d+')}$`);
    return publicPathRegex.test(path);
  });


  if (isPublic) {
      console.log('Public route detected, skipping auth');
      return next();
  }

  // If not public, proceed with JWT validation
  try {
    // Extract token
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('Found token in Authorization header');
    } else if (req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
      console.log('Found token in cookies');
    } else {
      console.log('No token found for protected route:', route);
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const decodedToken = verifyToken(token) as any;
    if (!decodedToken) {
      console.log('Invalid token received for route:', route);
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log(`Valid token for user: ${decodedToken.email}`);

    // Check if user exists in database
    const user = await storage.getUserByEmail(decodedToken.email);
    if (!user) {
      console.log('User from token not found in DB:', decodedToken.email);
      return res.status(401).json({ error: 'User not found' });
    }

    console.log(`User found in database: ${user.username}`);

    // Set user context in request
    req.user = {
      id: decodedToken.id,
      email: decodedToken.email,
      database_id: user.id,
      isAdmin: user.isAdmin
    };

    // Check admin routes specifically
    if (req.path.startsWith('/api/admin') && !user.isAdmin) {
      console.log('Non-admin user attempting to access admin route:', route);
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// --- Avatar Upload Configuration (Moved outside registerRoutes) ---
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use process.cwd() to get the project root and join from there
    const uploadPath = path.join(process.cwd(), 'public/uploads/avatars');
    // Ensure the directory exists using the synchronous import
    fsSync.mkdirSync(uploadPath, { recursive: true }); 
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Adjust filename based on context (user vs admin route)
    // Use req.params.id for admin route, fallback to req.user for self-upload
    const userId = req.params.id || (req.user as ExtendedUser)?.database_id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `user-${userId}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type, only images are allowed!'));
  }
};

const upload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Multer configuration for CSV upload (using memory storage)
const csvUpload = multer({
  storage: multer.memoryStorage(), // Store file in memory
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for CSV
  fileFilter: (req, file, cb) => {
    // Accept only CSV files
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type, only CSV files are allowed!'));
    }
  }
});
// --- End Avatar Upload Configuration ---

// Helper function to normalize names for fuzzy matching (copied from update_results script)
const normalizeName = (name: string | null | undefined): string => {
  if (!name) return '';
  return removeDiacritics(name) // Remove accents (Åberg -> Aberg)
    .toLowerCase() // Convert to lowercase
    .replace(/[.'"]/g, '') // Remove periods, apostrophes, quotes (Ca. -> Ca)
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim(); // Trim leading/trailing spaces
};

// Base shape from selectionFormSchema in shared/schema.ts (before .refine)
const baseSelectionFormShape = z.object({
  competitionId: z.number(),
  golfer1Id: z.number().refine(val => val > 0, "Please select a golfer"),
  golfer2Id: z.number().refine(val => val > 0, "Please select a golfer"),
  golfer3Id: z.number().refine(val => val > 0, "Please select a golfer"),
  useCaptainsChip: z.boolean().default(false),
  captainGolferId: z.number().optional().nullable(), // Match shared/schema definition
});

// Define a new schema specifically for admin creation by extending the base shape
const adminCreateSelectionSchema = baseSelectionFormShape.extend({
  userId: z.number().positive("User ID must be a positive number"),
});
// Note: We don't need the .refine for golfer uniqueness here as it's part of the base shape logic implicitly,
// but if specific admin refinements were needed, they could be added here.

// Register API routes
export async function registerRoutes(app: Express): Promise<Server> {

  // --- PUBLIC ROUTES ---


  app.get('/api/test-leaderboard', async (req: Request, res: Response) => {
    try {
      res.json([
        { rank: 1, userId: 1, username: "golfer1", email: "golfer1@example.com", points: 40, selections: [{ playerName: "Tiger Woods", position: 1 },{ playerName: "Rory McIlroy", position: 5 },{ playerName: "Jordan Spieth", position: 10 }] },
        { rank: 2, userId: 2, username: "golfer2", email: "golfer2@example.com", points: 30, selections: [{ playerName: "Scottie Scheffler", position: 2 },{ playerName: "Justin Thomas", position: 7 },{ playerName: "Brooks Koepka", position: 15 }] }
      ]);
    } catch (error) { console.error('Error in test leaderboard:', error); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);
      const normalizedIdentifier = identifier.trim(); // Trim whitespace

      // Determine if identifier is email or username
      const isEmail = normalizedIdentifier.includes('@'); 
      let user: User | undefined;

      if (isEmail) {
        console.log(`Attempting login with email: ${normalizedIdentifier}`);
        user = await storage.getUserByEmail(normalizedIdentifier.toLowerCase()); // Ensure email is lowercase
      } else {
        console.log(`Attempting login with username: ${normalizedIdentifier}`);
        user = await storage.getUserByUsername(normalizedIdentifier); // Username might be case-sensitive depending on DB collation
      }

      if (!user) { 
        console.log(`User not found for identifier: ${normalizedIdentifier}`);
        return res.status(401).json({ error: 'Invalid credentials' }); 
      }
      if (!user.password) { 
        console.log(`Password not set for user: ${user.username}`);
        return res.status(401).json({ error: 'Password not set' }); 
      }
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) { return res.status(401).json({ error: 'Invalid credentials' }); }

      // Update lastLoginAt timestamp
      const now = new Date();
      await storage.updateUser(user.id, { lastLoginAt: now.toISOString() }); // Convert Date to ISO string
      console.log(`Updated lastLoginAt for user ${user.username} (ID: ${user.id})`);

      const token = generateToken(user.id, user.email, user.isAdmin);
      res.cookie('authToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
      // Include lastLoginAt in the response user object if needed by the frontend immediately after login
      res.json({ user: { id: user.id.toString(), email: user.email, username: user.username, avatarUrl: user.avatarUrl, isAdmin: user.isAdmin, lastLoginAt: now.toISOString() }, token });
    } catch (error) { if (error instanceof ZodError) { return res.status(400).json({ error: error.errors }); } console.error('Login error:', error); res.status(500).json({ error: 'Login failed' }); }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    res.clearCookie('authToken'); res.json({ success: true });
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();
      const user = await storage.getUserByEmail(normalizedEmail);

      if (!user) {
        return res.json({ success: true, message: FORGOT_PASSWORD_MESSAGE });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${baseUrl}/?reset=${encodeURIComponent(resetToken)}`;

      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      await sendPasswordResetLinkEmail(user.email, user.username, resetUrl);

      res.json({ success: true, message: FORGOT_PASSWORD_MESSAGE });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || 'Invalid email address' });
      }

      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process forgot password request' });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      const tokenHash = hashResetToken(token);

      const [resetRecord] = await db
        .select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ));

      if (!resetRecord) {
        return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
      }

      const hashedPassword = await hashPassword(password);
      await storage.updateUserPassword(resetRecord.userId, hashedPassword);
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetRecord.id));

      res.json({ success: true, message: 'Password updated successfully. You can now sign in.' });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || 'Invalid reset request' });
      }

      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  app.get('/api/competitions', async (req: Request, res: Response) => {
    try { const competitions = await storage.getCompetitions(); res.json(competitions); } catch (error) { console.error('Get competitions error:', error); res.status(500).json({ error: 'Failed to fetch competitions' }); }
  });
  app.get('/api/competitions/all', async (req: Request, res: Response) => {
    try { const competitions = await storage.getCompetitions(); res.json(competitions); } catch (error) { console.error('Get all competitions error:', error); res.status(500).json({ error: 'Failed to fetch competitions' }); }
  });
  app.get('/api/competitions/active', async (req: Request, res: Response) => {
    try { const activeCompetitions = await storage.getActiveCompetitions(); res.json(activeCompetitions); } catch (error) { console.error('Get active competitions error:', error); res.status(500).json({ error: 'Failed to fetch active competitions' }); }
  });
  app.get('/api/competitions/upcoming', async (req: Request, res: Response) => { // Removed validateJWT
    try {
      let userId: number | undefined = undefined;
      // Attempt to get userId if user is authenticated (e.g., token was sent)
      // This requires validateJWT to have run if a token is present, or a manual token check here.
      // For simplicity, we'll check req.user which would be populated by a global or earlier middleware if token was valid.
      // If making it truly public but with optional auth features, ensure validateJWT doesn't block unauthenticated users for this route.
      // A more robust way for truly public with optional auth:
      // 1. Make validateJWT middleware more granular or have it not reject but mark req.user as null/undefined.
      // 2. Or, manually try to verify token here if present.
      // For now, assuming if req.user exists, it's valid.
      const authHeader = req.headers.authorization;
      let token = '';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
      }

      if (token) {
        try {
          const decodedToken = verifyToken(token) as any;
          if (decodedToken && decodedToken.email) {
            const user = await storage.getUserByEmail(decodedToken.email);
            if (user && typeof user.id === 'number') {
              userId = user.id;
            }
          }
        } catch (e) {
          // Token validation failed, proceed as unauthenticated
          console.log('Token present but validation failed for upcoming competitions, proceeding as unauthenticated.');
        }
      }
      
      const upcomingCompetitions = await storage.getUpcomingCompetitions(userId);
      res.json(upcomingCompetitions);
    } catch (error) {
      console.error('Get upcoming competitions error:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming competitions' });
    }
  });

  // Updated /api/competitions/:id route
  app.get('/api/competitions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const competitionId = parseInt(id);
      if (isNaN(competitionId)) {
        return res.status(400).json({ error: 'Invalid competition ID' });
      }

      const competition = await storage.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }

      let allSelectionsData = null;
      const now = new Date();
      const deadline = new Date(competition.selectionDeadline);

      // Check if deadline has passed
      if (now > deadline) {
        console.log(`Deadline passed for competition ${competitionId}. Fetching all selections and ranks.`);
        const selections = await storage.getAllSelections(competitionId);

        // Fetch user, golfer details, and ranks for each selection
        const usersMap = new Map<number, User>();
        const golfersMap = new Map<number, Golfer>();
        const ranksMap = new Map<string, SelectionRank | undefined>(); // Key: "userId-golferId"

        // Pre-fetch all necessary ranks to minimize DB calls
        const allUserGolferPairs = selections.flatMap(sel => [
          { userId: sel.userId, golferId: sel.golfer1Id },
          { userId: sel.userId, golferId: sel.golfer2Id },
          { userId: sel.userId, golferId: sel.golfer3Id },
        ]);

        // Fetch ranks in batches or individually (adjust based on performance needs)
        for (const pair of allUserGolferPairs) {
          const rankKey = `${pair.userId}-${pair.golferId}`;
          if (!ranksMap.has(rankKey)) {
            const rank = await storage.getSelectionRank(pair.userId, competitionId, pair.golferId);
            ranksMap.set(rankKey, rank);
          }
        }
        console.log(`Fetched ${ranksMap.size} unique selection ranks.`);

        allSelectionsData = await Promise.all(selections.map(async (sel) => {
          let user = usersMap.get(sel.userId);
          if (!user) { user = await storage.getUser(sel.userId); if (user) usersMap.set(sel.userId, user); }
          let golfer1 = golfersMap.get(sel.golfer1Id);
          if (!golfer1) { golfer1 = await storage.getGolferById(sel.golfer1Id); if (golfer1) golfersMap.set(sel.golfer1Id, golfer1); }
          let golfer2 = golfersMap.get(sel.golfer2Id);
          if (!golfer2) { golfer2 = await storage.getGolferById(sel.golfer2Id); if (golfer2) golfersMap.set(sel.golfer2Id, golfer2); }
          let golfer3 = golfersMap.get(sel.golfer3Id);
          if (!golfer3) { golfer3 = await storage.getGolferById(sel.golfer3Id); if (golfer3) golfersMap.set(sel.golfer3Id, golfer3); }

          // Get ranks from the pre-fetched map
          const rank1 = ranksMap.get(`${sel.userId}-${sel.golfer1Id}`)?.rankAtDeadline;
          const rank2 = ranksMap.get(`${sel.userId}-${sel.golfer2Id}`)?.rankAtDeadline;
           const rank3 = ranksMap.get(`${sel.userId}-${sel.golfer3Id}`)?.rankAtDeadline;

           // Get waiver details for this user
           const waiverOriginalGolferId = user?.waiverChipOriginalGolferId;
           const waiverReplacementGolferId = user?.waiverChipReplacementGolferId; // Get replacement ID
           const waiverUsedInThisComp = user?.hasUsedWaiverChip && user?.waiverChipUsedCompetitionId === competitionId;

           // Fetch original golfer details if waiver was used here
           let originalGolferDetails: { name: string; rank: number | null } | null = null;
           if (waiverUsedInThisComp && waiverOriginalGolferId) {
             const originalGolfer = await storage.getGolferById(waiverOriginalGolferId);
             if (originalGolfer) {
               // Fetch rank for original golfer at deadline
               const originalRankData = await storage.getSelectionRank(sel.userId, competitionId, waiverOriginalGolferId);
               originalGolferDetails = {
                 name: originalGolfer.name || 'Unknown Original Golfer',
                 rank: originalRankData?.rankAtDeadline ?? null // Use rank at deadline
               };
             }
           }

           return {
             userId: sel.userId,
             username: user?.username || 'Unknown User',
            golfer1Id: sel.golfer1Id,
            golfer2Id: sel.golfer2Id,
            golfer3Id: sel.golfer3Id,
            golfer1Name: golfer1?.name || 'N/A',
            golfer2Name: golfer2?.name || 'N/A',
            golfer3Name: golfer3?.name || 'N/A',
            golfer1Rank: rank1, // Add rank
             golfer2Rank: rank2, // Add rank
             golfer3Rank: rank3, // Add rank
             useCaptainsChip: sel.useCaptainsChip,
             captainGolferId: sel.captainGolferId,
             // Include waiver details if used in this competition
             waiverChipOriginalGolferId: waiverUsedInThisComp ? waiverOriginalGolferId : null,
             waiverChipReplacementGolferId: waiverUsedInThisComp ? waiverReplacementGolferId : null, // Add replacement ID
             waiverChipOriginalGolferDetails: originalGolferDetails // Add original golfer details object
           };
         }));
        console.log(`Fetched ${allSelectionsData.length} selections with details and ranks.`);
      } else {
         console.log(`Deadline not passed for competition ${competitionId}. Not fetching all selections.`);
      }

      // Return competition details and all selections if deadline passed
      res.json({
        ...competition,
        allSelections: allSelectionsData // Will be null if deadline hasn't passed
      });

    } catch (error) {
      console.error('Get competition error:', error);
      res.status(500).json({ error: 'Failed to fetch competition details' });
    }
  });

  // New endpoint to get chip usage for a competition
  app.get('/api/competitions/:competitionId/chips', validateJWT, async (req: Request, res: Response) => {
    try {
      const competitionId = parseInt(req.params.competitionId);
      if (isNaN(competitionId)) {
        return res.status(400).json({ error: 'Invalid competition ID' });
      }

      // Check if deadline has passed (optional, but good practice - matches frontend logic)
      const competition = await storage.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      const deadlinePassed = new Date() > new Date(competition.selectionDeadline);
      if (!deadlinePassed) {
        // Or return empty array if preferred
        return res.status(400).json({ error: 'Chip usage data is only available after the selection deadline.' }); 
      }

      const selections = await storage.getAllSelections(competitionId);
      if (!selections || selections.length === 0) {
        return res.json({ chips: [] }); // No selections, so no chip usage
      }

      const chipUsageDetails = await Promise.all(selections.map(async (sel) => {
        const user = await storage.getUser(sel.userId);
        if (!user) return null; // Skip if user not found

        let captainGolferName: string | null = null;
        let captainGolferRank: number | null = null;
        let waiverChipOriginalGolferName: string | null = null;
        let waiverChipOriginalGolferRank: number | null = null;
        let waiverChipReplacementGolferName: string | null = null;
        let waiverChipReplacementGolferRank: number | null = null;

        // Captain Chip Details
        if (sel.useCaptainsChip && sel.captainGolferId) {
          const captainGolfer = await storage.getGolferById(sel.captainGolferId);
          const captainRankData = await storage.getSelectionRank(sel.userId, competitionId, sel.captainGolferId);
          captainGolferName = captainGolfer?.name ?? 'Unknown Captain';
          captainGolferRank = captainRankData?.rankAtDeadline ?? null;
        }

        // Waiver Chip Details - Check if waiver was used *in this competition*
        const useWaiverChip = user.hasUsedWaiverChip && user.waiverChipUsedCompetitionId === competitionId;
        if (useWaiverChip && user.waiverChipOriginalGolferId && user.waiverChipReplacementGolferId) {
          // Original Golfer
          const originalGolfer = await storage.getGolferById(user.waiverChipOriginalGolferId);
          const originalRankData = await storage.getSelectionRank(sel.userId, competitionId, user.waiverChipOriginalGolferId);
          waiverChipOriginalGolferName = originalGolfer?.name ?? 'Unknown Original';
          waiverChipOriginalGolferRank = originalRankData?.rankAtDeadline ?? null;

          // Replacement Golfer
          const replacementGolfer = await storage.getGolferById(user.waiverChipReplacementGolferId);
          // Fetch rank for replacement golfer - use the rank stored in the selection if available (waiverRank)
          // or fetch from selection_ranks as a fallback (though waiverRank should be preferred)
          const replacementRankData = await storage.getSelectionRank(sel.userId, competitionId, user.waiverChipReplacementGolferId);
          waiverChipReplacementGolferName = replacementGolfer?.name ?? 'Unknown Replacement';
          // Prioritize waiverRank from the selection table if it exists, otherwise use rankAtDeadline
          waiverChipReplacementGolferRank = sel.waiverRank ?? replacementRankData?.rankAtDeadline ?? null; 
        }

        return {
          userId: user.id,
          username: user.username,
          useCaptainsChip: sel.useCaptainsChip,
          captainGolferId: sel.captainGolferId,
          captainGolferName,
          captainGolferRank,
          useWaiverChip, // Derived based on user record and competition ID
          waiverChipOriginalGolferId: useWaiverChip ? user.waiverChipOriginalGolferId : null,
          waiverChipOriginalGolferName,
          waiverChipOriginalGolferRank,
          waiverChipReplacementGolferId: useWaiverChip ? user.waiverChipReplacementGolferId : null,
          waiverChipReplacementGolferName,
          waiverChipReplacementGolferRank,
        };
      }));

      // Filter out any null results (e.g., if a user was deleted)
      const validChipUsage = chipUsageDetails.filter(details => details !== null);

      res.json({ chips: validChipUsage });

    } catch (error) {
      console.error(`Error fetching chip usage for competition ${req.params.competitionId}:`, error);
      res.status(500).json({ error: 'Failed to fetch chip usage data' });
    }
  });


  // New endpoint for CSV User & Selection Import
  app.post('/api/admin/import-users-selections', validateJWT, csvUpload.single('csvFile'), async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded.' });
      }

      console.log(`[API /api/admin/import-users-selections] Received file: ${req.file.originalname}, Size: ${req.file.size} bytes`);

      const csvContent = req.file.buffer.toString('utf-8');

      // Use PapaParse to parse the CSV
      const parseResult = Papa.parse(csvContent, {
        header: true, // Use the first row as headers
        skipEmptyLines: true,
        transformHeader: header => header.trim(), // Trim header whitespace
        transform: value => value.trim(), // Trim value whitespace
      });

      if (parseResult.errors.length > 0) {
        console.error('[API /api/admin/import-users-selections] CSV parsing errors:', parseResult.errors);
        return res.status(400).json({ error: 'Failed to parse CSV file.', details: parseResult.errors });
      }

      const rows = parseResult.data as any[]; // Type assertion, handle potential type issues
      console.log(`[API /api/admin/import-users-selections] Parsed ${rows.length} rows from CSV.`);

      // --- Use known Competition IDs ---
      const playersCompId = 6; // Use provided ID for The Players Championship
      const mastersCompId = 1;  // Use provided ID for The Masters
      console.log(`[API /api/admin/import-users-selections] Using hardcoded Competition IDs - Players: ${playersCompId}, Masters: ${mastersCompId}`);

      // Optional: Verify these competitions exist (good practice, but skipping for now based on user info)
      // const playersComp = await storage.getCompetitionById(playersCompId);
      // const mastersComp = await storage.getCompetitionById(mastersCompId);
      // if (!playersComp || !mastersComp) {
      //   return res.status(500).json({ error: `Could not find required competitions with IDs ${playersCompId} or ${mastersCompId} in the database.` });
      // }

      const allGolfers = await storage.getGolfers(); // Fetches { id, name, shortName, ... }

      // --- Prepare for Matching (similar to update_results script) ---
      // 1. Exact Match Maps (using original lowercase/trimmed names)
      const golferFullNameMap = new Map<string, number>();
      const golferShortNameMap = new Map<string, number>();
      allGolfers.forEach(g => {
          if (g.name) {
              golferFullNameMap.set(g.name.toLowerCase().trim(), g.id);
          }
          if (g.shortName) {
              golferShortNameMap.set(g.shortName.toLowerCase().trim(), g.id);
          }
      });
      console.log(`[API /api/admin/import-users-selections] Created exact match maps for ${golferFullNameMap.size} full names and ${golferShortNameMap.size} short names.`);

      // 2. Fuzzy Match List (using normalized names)
      const normalizedDbGolfers = allGolfers.map(g => ({
        id: g.id,
        normalizedName: normalizeName(g.name),
        normalizedShortName: normalizeName(g.shortName),
        originalName: g.name, // Keep original for logging
        originalShortName: g.shortName // Keep original for logging
      })).filter(g => g.normalizedName || g.normalizedShortName); // Ensure there's something to match against

      const fuseOptions = {
        includeScore: true,
        threshold: 0.3, // Stricter threshold (lower is stricter)
        keys: ['normalizedName', 'normalizedShortName'] // Fields to search in
      };
      const fuse = new Fuse(normalizedDbGolfers, fuseOptions);
      console.log(`[API /api/admin/import-users-selections] Initialized Fuse.js with ${normalizedDbGolfers.length} normalized golfer entries.`);

      // 3. Manual Overrides Map (based on normalized input name)
      const overrides: { [key: string]: number } = {
          "cam young": 627, // Force match for Cam Young -> Cameron Young (ID 627)
          "sw kim": 538, // Force match for S.W. Kim -> Si Woo Kim (ID 538)
          // Add other specific overrides here if needed
      };
      // --- End Matching Preparation ---

      // --- Helper Function for Golfer Matching ---
      const findGolferId = (golferNameRaw: string | null | undefined): { id: number | undefined; error?: string } => {
        if (!golferNameRaw) {
          return { id: undefined, error: 'Missing golfer name in CSV row.' };
        }

        const golferNameExact = golferNameRaw.toLowerCase().trim();
        const golferNameNormalized = normalizeName(golferNameRaw);
        let dbGolferId: number | undefined = undefined;
        let matchMethod: 'exact-short' | 'exact-full' | 'fuzzy' | 'override' | 'none' = 'none';

        // 1. Try Exact Match (Short Name First)
        dbGolferId = golferShortNameMap.get(golferNameExact);
        if (dbGolferId) {
            matchMethod = 'exact-short';
        } else {
            // 2. Try Exact Match (Full Name) - Match CSV name against DB full name
            dbGolferId = golferFullNameMap.get(golferNameExact);
            if (dbGolferId) {
                matchMethod = 'exact-full';
            }
        }

        // 3. Apply Manual Overrides if no exact match found
        if (!dbGolferId && golferNameNormalized) {
            const overrideId = overrides[golferNameNormalized];
            if (overrideId) {
                dbGolferId = overrideId;
                matchMethod = 'override';
                console.log(`[CSV Import Match] Manual override applied for "${golferNameRaw}" (Normalized: "${golferNameNormalized}") -> ID: ${dbGolferId}`);
            }
        }

        // 4. Try Fuzzy Match if no exact match or override found
        if (!dbGolferId && golferNameNormalized) {
            const fuseResult = fuse.search(golferNameNormalized);
            if (fuseResult.length > 0 && fuseResult[0].score != null && fuseResult[0].score <= fuseOptions.threshold) {
                const bestMatch = fuseResult[0];
                const bestScore = bestMatch.score;
                const isAmbiguous = fuseResult.length > 1 && fuseResult[1].score != null && fuseResult[1].score <= fuseOptions.threshold && (fuseResult[1].score - bestScore! < 0.01);

                if (!isAmbiguous) {
                    dbGolferId = bestMatch.item.id;
                    matchMethod = 'fuzzy';
                    console.log(`[CSV Import Match] Fuzzy match accepted for "${golferNameRaw}" -> "${bestMatch.item.originalName || bestMatch.item.originalShortName}" (ID: ${dbGolferId}, Score: ${bestScore!.toFixed(3)})`);
                } else {
                    const secondScoreStr = fuseResult[1]?.score?.toFixed(3) ?? 'N/A';
                    console.warn(`[CSV Import Match] Ambiguous fuzzy match for "${golferNameRaw}" (Normalized: "${golferNameNormalized}"). Best: ${bestScore!.toFixed(3)}, Second: ${secondScoreStr}. Skipping.`);
                    return { id: undefined, error: `Ambiguous fuzzy match for "${golferNameRaw}". Top matches: ${fuseResult.slice(0,2).map(r => `${r.item.originalName || r.item.originalShortName} (${r.score?.toFixed(3)})`).join(', ')}` };
                }
            } else if (fuseResult.length > 0 && fuseResult[0].score != null) {
                 console.warn(`[CSV Import Match] Poor fuzzy match for "${golferNameRaw}" (Normalized: "${golferNameNormalized}"). Best score: ${fuseResult[0].score.toFixed(3)}. Skipping.`);
                 // Keep dbGolferId as undefined
            }
        }

        if (!dbGolferId) {
          console.warn(`[CSV Import Match] No DB match found for CSV golfer: "${golferNameRaw}" (Normalized: "${golferNameNormalized}") using exact, override, or fuzzy.`);
          return { id: undefined, error: `No database match found for golfer "${golferNameRaw}".` };
        }

        return { id: dbGolferId }; // Return found ID
      };
      // --- End Helper Function ---


      let usersProcessed = 0;
      let selectionsCreated = 0;
      let selectionsUpdated = 0;
      const errors: string[] = [];

      // Process rows sequentially to avoid race conditions with user creation/selection updates
      for (const row of rows) {
        const email = row.email?.toLowerCase();
        const firstName = row.firstName;
        const lastName = row.lastName;
        const username = row.username; // Extract username

        if (!email || !firstName || !lastName || !username) { // Add username check
          errors.push(`Skipping row: Missing email, firstName, lastName, or username. Row data: ${JSON.stringify(row)}`);
          continue;
        }

        // Golfer names from the row (assuming headers match the template)
        const playersGolferNames = [row.playersChampGolfer1ShortName, row.playersChampGolfer2ShortName, row.playersChampGolfer3ShortName];
        const mastersGolferNames = [row.mastersGolfer1ShortName, row.mastersGolfer2ShortName, row.mastersGolfer3ShortName];

        // Basic check if names are present
        if (playersGolferNames.some(name => !name) || mastersGolferNames.some(name => !name)) {
           errors.push(`Skipping row for ${email}: Missing golfer name(s). Row data: ${JSON.stringify(row)}`);
           continue;
        }

        try {
          // 1. Find or Create User
          let user = await storage.getUserByEmail(email);
          if (!user) {
            // Simple password generation for imported users (admin should reset later)
            const tempPassword = crypto.randomBytes(8).toString('hex');
            user = await storage.createUser({
              email,
              username: username, // Use username from CSV
              fullName: `${firstName} ${lastName}`,
              password: tempPassword, // Storage handles hashing
              isAdmin: false,
            });
            console.log(`[API /api/admin/import-users-selections] Created new user: ${email} (ID: ${user.id})`);
          } else {
             console.log(`[API /api/admin/import-users-selections] Found existing user: ${email} (ID: ${user.id})`);
          }
          const userId = user.id;
          usersProcessed++;

          // 2. Process Selections for The Players Championship using the new matching logic
          const playersResults = playersGolferNames.map(name => findGolferId(name));
          const playersGolferIds = playersResults.map(r => r.id);
          const playersErrors = playersResults.map(r => r.error).filter(e => e); // Collect errors

          if (playersErrors.length > 0) {
            errors.push(`Skipping Players Championship for ${email}: ${playersErrors.join('; ')}`);
          } else if (playersGolferIds.some(id => id === undefined)) {
             // This case should theoretically be caught by playersErrors, but as a fallback:
             errors.push(`Skipping Players Championship for ${email}: Could not resolve one or more golfer IDs from names: ${playersGolferNames.join(', ')}`);
          } else {
            // All IDs found, proceed with selection
            const selectionData = {
              userId,
              competitionId: playersCompId,
              golfer1Id: playersGolferIds[0]!, // Non-null assertion safe due to checks above
              golfer2Id: playersGolferIds[1]!,
              golfer3Id: playersGolferIds[2]!,
              useCaptainsChip: false, // Default for import
              captainGolferId: null, // Default for import
            };
            const existingSelection = await storage.getUserSelections(userId, playersCompId);
            if (existingSelection) {
              await storage.updateSelection(existingSelection.id, selectionData);
              selectionsUpdated++;
              console.log(`[API /api/admin/import-users-selections] Updated Players selection for user ${userId}`);
            } else {
              await storage.createSelection(selectionData);
              selectionsCreated++;
              console.log(`[API /api/admin/import-users-selections] Created Players selection for user ${userId}`);
            }
          }

          // 3. Process Selections for The Masters using the new matching logic
          const mastersResults = mastersGolferNames.map(name => findGolferId(name));
          const mastersGolferIds = mastersResults.map(r => r.id);
          const mastersErrors = mastersResults.map(r => r.error).filter(e => e); // Collect errors

          if (mastersErrors.length > 0) {
            errors.push(`Skipping Masters for ${email}: ${mastersErrors.join('; ')}`);
          } else if (mastersGolferIds.some(id => id === undefined)) {
             errors.push(`Skipping Masters for ${email}: Could not resolve one or more golfer IDs from names: ${mastersGolferNames.join(', ')}`);
          } else {
            // All IDs found, proceed with selection
            const selectionData = {
              userId,
              competitionId: mastersCompId,
              golfer1Id: mastersGolferIds[0]!, // Non-null assertion safe due to checks above
              golfer2Id: mastersGolferIds[1]!,
              golfer3Id: mastersGolferIds[2]!,
              useCaptainsChip: false, // Default for import
              captainGolferId: null, // Default for import
            };
            const existingSelection = await storage.getUserSelections(userId, mastersCompId);
            if (existingSelection) {
              await storage.updateSelection(existingSelection.id, selectionData);
              selectionsUpdated++;
               console.log(`[API /api/admin/import-users-selections] Updated Masters selection for user ${userId}`);
            } else {
              await storage.createSelection(selectionData);
              selectionsCreated++;
               console.log(`[API /api/admin/import-users-selections] Created Masters selection for user ${userId}`);
            }
          }

        } catch (rowError: any) {
          errors.push(`Error processing row for ${email}: ${rowError.message}`);
          console.error(`[API /api/admin/import-users-selections] Error processing row for ${email}:`, rowError);
        }
      } // End row loop

      console.log(`[API /api/admin/import-users-selections] Import finished. Processed: ${usersProcessed}, Created: ${selectionsCreated}, Updated: ${selectionsUpdated}, Errors: ${errors.length}`);

      res.json({
        success: errors.length === 0,
        message: `Import finished. Processed ${usersProcessed} users. Selections Created: ${selectionsCreated}, Updated: ${selectionsUpdated}.`,
        errors: errors,
      });

    } catch (error: any) {
      console.error('[API /api/admin/import-users-selections] General error during import:', error);
      // Handle specific multer errors if needed
      if (error instanceof multer.MulterError) {
         return res.status(400).json({ error: `File upload error: ${error.message}` });
      } else if (error.message.includes('Invalid file type')) {
         return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to process CSV import.', details: error.message });
    }
  });


  // Returns all golfers. Filtering (e.g., for waiver chip) should happen client-side where needed.
  // This endpoint uses validateJWT to ensure only authenticated users can access it,
  // but it doesn't apply user-specific filtering anymore.
  app.get('/api/golfers', validateJWT, async (req: Request, res: Response) => {
    try {
      const allGolfers = await storage.getGolfers();
      console.log("Returning full golfer list.");
      res.json({ golfers: allGolfers }); // Wrap in { golfers: ... }
    } catch (error) {
      console.error('Get golfers error:', error);
      res.status(500).json({ error: 'Failed to fetch golfers' });
    }
  });
  app.get('/api/results/:competitionId', async (req: Request, res: Response) => {
    try { 
      const { competitionId } = req.params; 
      const results = await storage.getResults(parseInt(competitionId)); 
      const resultsWithGolfers = await Promise.all(results.map(async (result) => { 
        const golfer = await storage.getGolferById(result.golferId); 
        // Include firstName and lastName in the golfer object
        return { 
          ...result, 
          golfer: golfer ? { 
            id: golfer.id, 
            name: golfer.name, 
            firstName: golfer.firstName, // Add firstName
            lastName: golfer.lastName   // Add lastName
          } : undefined 
        }; 
      })); 
      res.json(resultsWithGolfers); 
    } catch (error) { 
      console.error('Get results error:', error); 
      res.status(500).json({ error: 'Failed to fetch results' }); 
    }
  });
  app.get('/api/leaderboard/:competitionId?', async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.competitionId ? parseInt(req.params.competitionId) : undefined;
      // Fetch the object containing standings and lastUpdated
      const leaderboardData = await storage.getLeaderboard(competitionId); 
      
      // Process standings if it's a specific competition (add selection details)
      if (typeof competitionId === 'number' && !isNaN(competitionId)) {
         const tokenUser = req.user as ExtendedUser | undefined;
         const currentUserId = tokenUser?.database_id; // Renamed for clarity
        // Use leaderboardData.standings here
        const enhancedStandings = await Promise.all(leaderboardData.standings.map(async (entry: any) => { // Add type 'any' to entry for now
          // Fetch full user record to get waiver details along with chip status
          const user = await storage.getUser(entry.userId);
          const hasUsedCaptainsChip = user?.hasUsedCaptainsChip ?? false;
          const hasUsedWaiverChip = user?.hasUsedWaiverChip ?? false;
          const waiverReplacementGolferId = user?.waiverChipReplacementGolferId; // Get replacement ID

          let selectionRecord: Selection | undefined = undefined;
          // Fetch selections for the specific user in the leaderboard entry
          selectionRecord = await storage.getUserSelections(entry.userId, competitionId);

          // If no selection record, still return the entry with user-level chip status
          if (!selectionRecord) {
            return { ...entry, selections: [], hasUsedCaptainsChip, hasUsedWaiverChip, captainGolferId: null, waiverReplacementGolferId: null };
          }

          // Fetch golfer details if selection exists
          const golfer1 = await storage.getGolferById(selectionRecord.golfer1Id);
          const golfer2 = await storage.getGolferById(selectionRecord.golfer2Id);
          const golfer3 = await storage.getGolferById(selectionRecord.golfer3Id);
          const results = await storage.getResults(competitionId);
          const holeInOnes: HoleInOne[] = await storage.getHoleInOnes(competitionId); // Fetch HIOs - corrected method and added type
          const holeInOneGolferIds = new Set(holeInOnes.map((hio: HoleInOne) => hio.golferId)); // Create a set for quick lookup - added type to hio

          // Fetch ranks for all golfers in this selection
          const golferIdsInSelection = [selectionRecord.golfer1Id, selectionRecord.golfer2Id, selectionRecord.golfer3Id];
          const ranks = await Promise.all(
            golferIdsInSelection.map(gid => storage.getSelectionRank(entry.userId, competitionId, gid))
          );
          const rankMap = new Map<number, number | null>();
          ranks.forEach((rankData, index) => {
            if (rankData) {
              rankMap.set(golferIdsInSelection[index], rankData.rankAtDeadline);
            }
          });


          // Create selections array with isCaptain, isWaiver, and rank flags
          const createSelectionEntry = (golfer: Golfer | undefined, golferId: number) => {
            const result = results.find(r => r.golferId === golferId);
            const isCaptain = selectionRecord?.captainGolferId === golferId;
            // Check if this golfer is the one chosen via waiver chip for this user in this competition
            const isThisGolferAWaiverReplacement = hasUsedWaiverChip &&
                                                 waiverReplacementGolferId === golferId &&
                                                 selectionRecord?.competitionId === user?.waiverChipUsedCompetitionId;
            
            const rankAtDeadlineForThisGolfer = rankMap.get(golferId) ?? null; // This is the rank when selection was made/deadline

            let displayRank: number | null;
            let selectionWaiverRankForThisGolfer: number | null = null;

            if (isThisGolferAWaiverReplacement) {
              // This golfer IS a waiver replacement.
              // Their wildcard status is determined by their rank when they were acquired (rankAtDeadlineForThisGolfer).
              selectionWaiverRankForThisGolfer = rankAtDeadlineForThisGolfer;
              // The general 'rank' field can be their current OWGR rank from the golfers table, if available and different.
              // Frontend will prioritize selectionWaiverRank for wildcard checks on waivers.
              displayRank = typeof golfer?.rank === 'number' ? golfer.rank : rankAtDeadlineForThisGolfer; // Fallback to deadline rank if current not available
            } else {
              // This golfer is an original selection.
              // Their wildcard status is determined by their rank at time of selection/deadline.
              displayRank = rankAtDeadlineForThisGolfer;
              // selectionWaiverRank is not applicable for original selections.
            }

            const scoredHoleInOne = holeInOneGolferIds.has(golferId);
            const hioBonusPoints = scoredHoleInOne ? 20 : undefined;

            return {
              playerId: golferId,
              playerName: golfer?.name || 'Unknown',
              rank: displayRank,
              selectionWaiverRank: selectionWaiverRankForThisGolfer,
              position: result?.position,
              points: result?.points ?? null,
              isCaptain: isCaptain,
              isWaiver: isThisGolferAWaiverReplacement,
              holeInOne: scoredHoleInOne,
              holeInOnePoints: hioBonusPoints
            };
          };

          const selectionsWithFlags = [
            createSelectionEntry(golfer1, selectionRecord.golfer1Id),
            createSelectionEntry(golfer2, selectionRecord.golfer2Id),
            createSelectionEntry(golfer3, selectionRecord.golfer3Id)
          ];

          // Return the entry with enhanced selections and necessary IDs
          return {
            ...entry,
            selections: selectionsWithFlags,
            hasUsedCaptainsChip, // Keep user-level status if needed elsewhere
            hasUsedWaiverChip,   // Keep user-level status if needed elsewhere
            captainGolferId: selectionRecord.captainGolferId, // Pass down captain ID
            waiverReplacementGolferId: waiverReplacementGolferId // Pass down waiver replacement ID
          };
        }));
        // Return the full object with enhanced standings and lastUpdated
        res.json({ standings: enhancedStandings, lastUpdated: leaderboardData.lastUpdated, currentUserId: currentUserId }); // Use renamed variable
      } else {
        // For overall leaderboard, fetch user-level chip status only
        const enhancedOverallStandings = await Promise.all(leaderboardData.standings.map(async (entry: any) => {
          const hasUsedCaptainsChip = await storage.hasUsedCaptainsChip(entry.userId);
          const hasUsedWaiverChip = await storage.hasUsedWaiverChip(entry.userId);
          return { ...entry, hasUsedCaptainsChip, hasUsedWaiverChip };
        }));
        // Return the object with enhanced overall standings
        res.json({ ...leaderboardData, standings: enhancedOverallStandings });
      }
    } catch (error) { console.error('Leaderboard error:', error); res.status(500).json({ error: 'Failed to fetch leaderboard' }); }
  });
  app.get('/api/competitions/:competitionId/hole-in-ones', async (req: Request, res: Response) => {
    try { const competitionId = parseInt(req.params.competitionId); const holeInOnes = await storage.getHoleInOnes(competitionId); const golferMap = new Map(); const golfers = await storage.getGolfers(); golfers.forEach(golfer => golferMap.set(golfer.id, golfer)); const holeInOnesWithGolferDetails = holeInOnes.map(hio => ({ ...hio, golfer: golferMap.get(hio.golferId) })); res.json(holeInOnesWithGolferDetails); } catch (error) { console.error('Error fetching hole-in-ones:', error); res.status(500).json({ error: 'Failed to fetch hole-in-ones' }); }
  });
  app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization; let token = ''; if (authHeader && authHeader.startsWith('Bearer ')) { token = authHeader.substring(7); } else if (req.cookies && req.cookies.authToken) { token = req.cookies.authToken; }
      const defaultStats = { activeCompetitions: 0, nextDeadline: "", totalPoints: 0, currentRank: 'N/A' };
      if (!token) { return res.json(defaultStats); }
      const decodedToken = verifyToken(token) as any; if (!decodedToken) { return res.json(defaultStats); }
      const user = await storage.getUserByEmail(decodedToken.email); if (!user) { return res.json(defaultStats); }
      const userId = user.id; const activeCompetitions = await storage.getActiveCompetitions(); const upcomingCompetitions = await storage.getUpcomingCompetitions(userId); let nextDeadline = ""; if (upcomingCompetitions.length > 0) { upcomingCompetitions.sort((a, b) => new Date(a.selectionDeadline).getTime() - new Date(b.selectionDeadline).getTime()); nextDeadline = upcomingCompetitions[0].selectionDeadline; }
      // Corrected query to rank only users (admins and non-admins) who have made selections
      const leaderboardQuery = `
        WITH UsersWithSelections AS (
          SELECT DISTINCT "userId"
          FROM selections
        ),
        RankedUsers AS (
          SELECT
            up."userId",
            SUM(up.points) as total_points,
            ROW_NUMBER() OVER (ORDER BY SUM(up.points) DESC, up."userId" ASC) as rank
          FROM user_points up
          JOIN UsersWithSelections uws ON up."userId" = uws."userId" -- Only rank users with selections
          GROUP BY up."userId"
        )
        SELECT total_points, rank
        FROM RankedUsers
        WHERE "userId" = $1;
      `;
      const leaderboardResult = await pgClient.query(leaderboardQuery, [userId]); const totalPoints = leaderboardResult.rows.length > 0 ? parseInt(leaderboardResult.rows[0].total_points) || 0 : 0; const currentRank = leaderboardResult.rows.length > 0 ? leaderboardResult.rows[0].rank : 'N/A';
      res.json({ activeCompetitions: activeCompetitions.length, nextDeadline, totalPoints, currentRank });
    } catch (error) { console.error('Dashboard stats error:', error); res.status(500).json({ error: 'Failed to fetch dashboard stats' }); }
  });


  // --- PROTECTED ROUTES --- (Apply validateJWT middleware individually)

  // New endpoint for scraping image URL
  app.post('/api/scrape-image', validateJWT, async (req: Request, res: Response) => {
    const { leaderboardUrl } = req.body;

    if (!leaderboardUrl || typeof leaderboardUrl !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid leaderboardUrl' });
    }

    console.log(`[API /api/scrape-image] Attempting to scrape: ${leaderboardUrl}`);

    try {
      // Fetch HTML content from the URL
      const { data: htmlContent } = await axios.get(leaderboardUrl, {
        headers: {
          // Add headers to mimic a browser request if necessary
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      // Load HTML into cheerio
      const $ = cheerio.load(htmlContent);

      // Find the image source using the specified selector
      const imageSrc = $('.css-gmuwbf img').attr('src'); // Target img within the class

      if (imageSrc) {
        console.log(`[API /api/scrape-image] Found image src: ${imageSrc}`);
        // Optionally resolve relative URLs
        const absoluteImageUrl = new URL(imageSrc, leaderboardUrl).toString();
        console.log(`[API /api/scrape-image] Resolved absolute URL: ${absoluteImageUrl}`);
        res.json({ imageUrl: absoluteImageUrl });
      } else {
        console.warn(`[API /api/scrape-image] Image tag or src not found within .css-gmuwbf for URL: ${leaderboardUrl}`);
        res.status(404).json({ error: 'Image not found on the page with the specified selector (.css-gmuwbf img)' });
      }
    } catch (error: any) {
      console.error(`[API /api/scrape-image] Error scraping ${leaderboardUrl}:`, error.message);
      if (axios.isAxiosError(error)) {
        res.status(error.response?.status || 500).json({ error: `Failed to fetch leaderboard page: ${error.message}` });
      } else {
        res.status(500).json({ error: `Error processing leaderboard page: ${error.message}` });
      }
    }
  });

  // User routes (continued)

  // GET User Profile Data (Added)
  app.get('/api/users/:id', validateJWT, async (req: Request, res: Response) => {
    console.log(`[Route GET /api/users/:id] Request received for ID: ${req.params.id}`);
    try {
      const requestedUserIdStr = req.params.id;
      const tokenUser = req.user as ExtendedUser;

      // Determine the actual user ID to fetch (handle 'me')
      let userIdToFetch: number;
      if (requestedUserIdStr === 'me') {
        if (!tokenUser?.database_id) {
          return res.status(401).json({ error: 'User context not found for "me"' });
        }
        userIdToFetch = tokenUser.database_id;
        console.log(`[Route GET /api/users/:id] Resolved 'me' to user ID: ${userIdToFetch}`);
      } else {
        userIdToFetch = parseInt(requestedUserIdStr);
        if (isNaN(userIdToFetch)) {
          return res.status(400).json({ error: 'Invalid user ID parameter' });
        }
      }

      // Authorization check: Allow admins or the user themselves
      if (tokenUser.database_id !== userIdToFetch && !tokenUser.isAdmin) {
        console.log(`[Route GET /api/users/:id] Authorization failed. Token user ${tokenUser.database_id} (admin: ${tokenUser.isAdmin}) trying to access user ${userIdToFetch}`);
        return res.status(403).json({ error: 'Unauthorized to access this user profile' });
      }

      // Fetch basic user data
      console.log(`[Route GET /api/users/:id] Fetching user data for ID: ${userIdToFetch}`);
      const user = await storage.getUser(userIdToFetch);
      if (!user) {
        console.log(`[Route GET /api/users/:id] User not found for ID: ${userIdToFetch}`);
        return res.status(404).json({ error: 'User not found' });
      }

      // Fetch user statistics
      console.log(`[Route GET /api/users/:id] Fetching stats for user ID: ${userIdToFetch}`);
      const stats = await storage.getUserStats(userIdToFetch); 
      console.log(`[Route GET /api/users/:id] Stats fetched for user ID ${userIdToFetch}:`, stats);

      // Combine user data and stats, excluding password
      const { password, ...userDataWithoutPassword } = user;
      const responseData = {
        ...userDataWithoutPassword,
        // Ensure stats are included, provide defaults if stats are null/undefined
        stats: stats || { competitionsPlayed: 0, totalPoints: 0, bestRank: 'N/A' } 
      };

      console.log(`[Route GET /api/users/:id] Sending response for user ID: ${userIdToFetch}`);
      res.json(responseData); // Send combined data

    } catch (error) {
      console.error(`[Route GET /api/users/:id] Error fetching user profile for ID ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

  app.get('/api/users/:id/has-used-captains-chip', validateJWT, async (req: Request, res: Response) => {
    try { const tokenUser = req.user as ExtendedUser; let userIdToCheck: number; if (req.params.id === 'me') { userIdToCheck = tokenUser.database_id!; } else { userIdToCheck = parseInt(req.params.id); if (isNaN(userIdToCheck)) { return res.status(400).json({ error: 'Invalid user ID' }); } } if (tokenUser.database_id !== userIdToCheck && !tokenUser.isAdmin) { return res.status(403).json({ error: 'Unauthorized to access this resource' }); } const hasUsed = await storage.hasUsedCaptainsChip(userIdToCheck); res.json({ hasUsedCaptainsChip: hasUsed }); } catch (error) { console.error('Error checking captain\'s chip usage:', error); res.status(500).json({ error: 'Failed to check captain\'s chip usage' }); }
  });
  app.get('/api/users/:id/has-used-waiver-chip', validateJWT, async (req: Request, res: Response) => {
    try { const tokenUser = req.user as ExtendedUser; const requestedUserId = parseInt(req.params.id); if (tokenUser.database_id !== requestedUserId && !tokenUser.isAdmin) { return res.status(403).json({ error: 'Unauthorized to access this resource' }); } const hasUsed = await storage.hasUsedWaiverChip(requestedUserId); res.json({ hasUsedWaiverChip: hasUsed }); } catch (error) { console.error('Error checking waiver chip usage:', error); res.status(500).json({ error: 'Failed to check waiver chip usage' }); }
  });
  app.patch('/api/users/:id', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const userId = parseInt(id); const tokenUser = req.user as ExtendedUser; if (tokenUser.database_id !== userId && !tokenUser.isAdmin) { return res.status(403).json({ error: 'Not authorized to update this user' }); } const user = await storage.getUser(userId); if (!user) { return res.status(404).json({ error: 'User not found' }); } const updatedUser = await storage.updateUser(userId, req.body); const { password, ...userData } = updatedUser; res.json(userData); } catch (error) { console.error('Update user error:', error); res.status(500).json({ error: 'Failed to update user' }); }
  });

  app.post('/api/users/:id/change-password', validateJWT, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const tokenUser = req.user as ExtendedUser;

      if (tokenUser.database_id !== userId && !tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Not authorized to change this password' });
      }

      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const user = await storage.getUser(userId);

      if (!user || !user.password) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(userId, hashedPassword);
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || 'Invalid password change request' });
      }

      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  // User Avatar Upload (Self)
  app.post('/api/users/avatar', validateJWT, upload.single('avatar'), async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      const userId = tokenUser.database_id!;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`; // Relative URL path

      // Update user record in the database
      const updatedUser = await storage.updateUser(userId, { avatarUrl });

      const { password, ...userData } = updatedUser;
      res.json({ message: 'Avatar uploaded successfully', user: userData });

    } catch (error: any) {
      console.error('Avatar upload error:', error);
      // Handle multer errors specifically
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
      } else if (error.message === 'Invalid file type, only images are allowed!') {
         return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  });


  // Selection routes
  app.get('/api/selections/my-all', validateJWT, async (req: Request, res: Response) => {
    console.log(`[Route /api/selections/my-all] Request received.`); // Added log
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser || !tokenUser.database_id) {
        console.error('[Route /api/selections/my-all] Error: User or database_id not found in request context.');
        return res.status(401).json({ error: 'User context not found' });
      }
      const userId = tokenUser.database_id;
      console.log(`[Route /api/selections/my-all] Fetching selections for user ID: ${userId}`); // Added log
      const userSelections = await storage.getUserSelectionsForAllCompetitions(userId);
      console.log(`[Route /api/selections/my-all] Selections retrieved from storage. Count: ${userSelections?.length ?? 0}`); // Added log
      res.json(userSelections);
      console.log(`[Route /api/selections/my-all] Response sent successfully.`); // Added log
    } catch (error) {
      console.error('[Route /api/selections/my-all] Error caught:', error); // Updated log prefix
      res.status(500).json({ error: 'Failed to fetch user selections' });
    }
  });

  // Get ALL detailed selections for a SPECIFIC user (used for Leaderboard expansion)
  // Protected route, requires authentication
  app.get('/api/users/:userId/selections/all', validateJWT, async (req: Request, res: Response) => {
    console.log(`[Route /api/users/:userId/selections/all] Request received for user ID: ${req.params.userId}`);
    try {
      const userIdToFetch = parseInt(req.params.userId);
      if (isNaN(userIdToFetch)) {
        return res.status(400).json({ error: 'Invalid user ID parameter' });
      }

      // Optional: Add authorization check if only admins or the user themselves should see this?
      // For now, assuming any logged-in user can view history via leaderboard expansion.
      // const tokenUser = req.user as ExtendedUser;
      // if (!tokenUser.isAdmin && tokenUser.database_id !== userIdToFetch) {
      //   return res.status(403).json({ error: 'Unauthorized to view this user\'s history' });
      // }

      const userSelections = await storage.getUserSelectionsForAllCompetitions(userIdToFetch);
      console.log(`[Route /api/users/:userId/selections/all] Selections retrieved for user ${userIdToFetch}. Count: ${userSelections?.length ?? 0}`);
      res.json(userSelections);
      console.log(`[Route /api/users/:userId/selections/all] Response sent successfully for user ${userIdToFetch}.`);
    } catch (error) {
      console.error(`[Route /api/users/:userId/selections/all] Error caught for user ${req.params.userId}:`, error);
      res.status(500).json({ error: 'Failed to fetch user selection history' });
    }
  });

  // Get specific selection details for the LOGGED-IN user for a specific competition (used for Dashboard/Competition page)
  app.get('/api/selections/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try {
      const competitionId = parseInt(req.params.competitionId);
      const tokenUser = req.user as ExtendedUser;
      const userId = tokenUser.database_id!;

      if (isNaN(competitionId)) {
        return res.status(400).json({ error: 'Invalid competition ID' });
      }

      // 1. Fetch the base selection record, including waiverRank
      const selectionRecord = await storage.getUserSelections(userId, competitionId); // This function needs to return waiverRank if available

      if (!selectionRecord) {
        return res.json(null); // No selection found for this user/competition
      }

      // Check for a query parameter to return raw data for the form
      if (req.query.format === 'raw') {
        return res.json(selectionRecord); // Return the raw selection object
      }

      // If format is not 'raw', proceed to build the detailed response for display purposes
      // Fetch user details separately to get waiver chip info
      const user = await storage.getUser(userId);
      const userWaiverCompId = user?.waiverChipUsedCompetitionId;
      const userWaiverReplacementId = user?.waiverChipReplacementGolferId;
      const userHasUsedWaiver = user?.hasUsedWaiverChip ?? false;

      // 2. Fetch details for each golfer, results, and ranks at deadline
      const golferIds = [selectionRecord.golfer1Id, selectionRecord.golfer2Id, selectionRecord.golfer3Id];
      // Destructure Promise.all results with correct variable names
      const [golfer1, golfer2, golfer3, results, selectionRanksData] = await Promise.all([
        storage.getGolferById(selectionRecord.golfer1Id), // Fetch golfer 1
        storage.getGolferById(selectionRecord.golfer2Id), // Fetch golfer 2
        storage.getGolferById(selectionRecord.golfer3Id), // Fetch golfer 3
        storage.getResults(competitionId),
        // Fetch ranks at deadline for all golfers in this selection
        Promise.all(golferIds.map(gid => storage.getSelectionRank(userId, competitionId, gid)))
      ]);

      const golferMap = new Map<number, Golfer | undefined>();
      if (golfer1) golferMap.set(golfer1.id, golfer1);
      if (golfer2) golferMap.set(golfer2.id, golfer2);
      if (golfer3) golferMap.set(golfer3.id, golfer3);

      // Create resultMap, ensuring results is an array
      const resultMap = new Map<number, Result>();
      if (Array.isArray(results)) {
        results.forEach((r: Result) => resultMap.set(r.golferId, r));
      }

      // Create a map for ranks at deadline using the correct variable
      const rankMap = new Map<number, number | null>();
      if (Array.isArray(selectionRanksData)) {
        selectionRanksData.forEach(rankData => {
          // Check if rankData is truthy and has the expected properties
          if (rankData && typeof rankData.golferId === 'number') {
            rankMap.set(rankData.golferId, rankData.rankAtDeadline ?? null); // Use nullish coalescing for rank
          }
        });
      
        // USER ROUTES FOR SELECTIONS
        app.post('/api/selections', validateJWT, async (req: Request, res: Response) => {
          try {
            const userId = req.user!.database_id!; // User must be authenticated
            const rawData = req.body;
      
            // Validate input using the shared schema
            const validationResult = selectionFormSchema.safeParse(rawData);
            if (!validationResult.success) {
              return res.status(400).json({ error: 'Invalid selection data', details: validationResult.error.flatten() });
            }
            const selectionData = validationResult.data;
      
            // Check competition deadline
            const competition = await storage.getCompetitionById(selectionData.competitionId);
            if (!competition) {
              return res.status(404).json({ error: 'Competition not found' });
            }
            if (new Date() > new Date(competition.selectionDeadline)) {
              return res.status(400).json({ error: 'Selection deadline has passed. Cannot create selection.' });
            }
      
            // Check if user already has a selection for this competition
            // Assuming storage.getUserSelections returns a single Selection | null | undefined for a specific user/competition
            const existingSelectionForPost = await storage.getUserSelections(userId, selectionData.competitionId);
      
            if (existingSelectionForPost) {
              return res.status(409).json({ error: 'You have already made a selection for this competition. Please edit your existing selection.' });
            }
            
            // Captain's Chip logic for POST
            let needsUserChipStatusUpdateOnCreate = false;
            if (selectionData.useCaptainsChip) {
              const userProfile = await storage.getUser(userId);
              if (!userProfile) {
                return res.status(404).json({ error: 'User profile not found.' });
              }
              if (userProfile.hasUsedCaptainsChip) {
                return res.status(400).json({ error: "Captain's chip has already been used." });
              }
              needsUserChipStatusUpdateOnCreate = true;
            }
      
            // Align payload with InsertSelection which omits id, createdAt, updatedAt
            // userId is added as it's not part of selectionFormSchema but required for DB
            const payload: InsertSelection & { userId: number } = {
              userId,
              competitionId: selectionData.competitionId,
              golfer1Id: selectionData.golfer1Id,
              golfer2Id: selectionData.golfer2Id,
              golfer3Id: selectionData.golfer3Id,
              useCaptainsChip: selectionData.useCaptainsChip,
              captainGolferId: selectionData.useCaptainsChip ? selectionData.captainGolferId : null,
              // waiverRank is optional in InsertSelection, defaults if not provided
            };
      
            const newSelection = await storage.createSelection(payload);
      
            // If captain's chip was used, update user's chip status
            if (needsUserChipStatusUpdateOnCreate) {
              await storage.updateUser(userId, {
                hasUsedCaptainsChip: true
              });
            }
      
            res.status(201).json(newSelection);
          } catch (error) {
            console.error('Error creating selection:', error);
            if (error instanceof ZodError) {
              return res.status(400).json({ error: 'Validation error during creation', details: error.errors });
            }
            res.status(500).json({ error: 'Failed to create selection' });
          }
        });
      
        app.patch('/api/selections/:competitionId', validateJWT, async (req: Request, res: Response) => {
          try {
            const userId = req.user!.database_id!;
            const competitionIdParam = parseInt(req.params.competitionId, 10);
            
            if (isNaN(competitionIdParam)) {
              return res.status(400).json({ error: 'Invalid competition ID in URL' });
            }
      
            const rawData = req.body;
            const validationResult = selectionFormSchema.safeParse(rawData);
            if (!validationResult.success) {
              return res.status(400).json({ error: 'Invalid selection data for update', details: validationResult.error.flatten() });
            }
            const selectionData = validationResult.data;
      
            if (selectionData.competitionId !== competitionIdParam) {
              return res.status(400).json({ error: 'Competition ID in body does not match URL parameter.' });
            }
      
            const competition = await storage.getCompetitionById(competitionIdParam);
            if (!competition) {
              return res.status(404).json({ error: 'Competition not found' });
            }
            if (new Date() > new Date(competition.selectionDeadline)) {
              return res.status(400).json({ error: 'Selection deadline has passed, cannot update selection.' });
            }
      
            // Assuming storage.getUserSelections returns a single Selection | null | undefined
            const existingSelection = await storage.getUserSelections(userId, competitionIdParam);
      
            if (!existingSelection) {
              return res.status(404).json({ error: 'No existing selection found to update for this competition.' });
            }
      
            const userProfile = await storage.getUser(userId);
            if (!userProfile) {
              return res.status(404).json({ error: 'User profile not found.' });
            }
      
            let needsUserChipStatusUpdate = false;
            let userChipStatusPayload: { hasUsedCaptainsChip: boolean } | undefined = undefined;
      
            if (selectionData.useCaptainsChip) { // User wants to use/keep chip
              if (!existingSelection.useCaptainsChip) { // Chip was not used before, now user wants to use it
                if (userProfile.hasUsedCaptainsChip) { // Check if chip already used globally
                  return res.status(400).json({ error: "Captain's chip has already been used." });
                }
                // Chip is available, mark for update
                userChipStatusPayload = { hasUsedCaptainsChip: true };
                needsUserChipStatusUpdate = true;
              }
              // If chip was already used on this selection (existingSelection.useCaptainsChip was true)
              // and selectionData.useCaptainsChip is still true, user's global chip status doesn't change here.
            } else { // User does NOT want to use chip (selectionData.useCaptainsChip is false)
              if (existingSelection.useCaptainsChip) { // Chip was used before, now user wants to remove it from this selection
                // This makes the chip available again globally.
                userChipStatusPayload = { hasUsedCaptainsChip: false };
                needsUserChipStatusUpdate = true;
              }
              // If not used before and still not used, no change to user chip status.
            }
            
            // Fields for storage.updateSelection. It likely takes selectionId and the partial data.
            // updatedAt is handled by the DB trigger or Drizzle's defaultNow on update.
            // The Selection interface has updatedAt: string.
            const updatePayload: Partial<Omit<Selection, 'id' | 'userId' | 'competitionId' | 'createdAt'>> & { updatedAt: string } = {
              golfer1Id: selectionData.golfer1Id,
              golfer2Id: selectionData.golfer2Id,
              golfer3Id: selectionData.golfer3Id,
              useCaptainsChip: selectionData.useCaptainsChip,
              captainGolferId: selectionData.useCaptainsChip ? selectionData.captainGolferId : null,
              updatedAt: new Date().toISOString(),
              // waiverRank is optional, not changing it here unless explicitly part of selectionData
            };
            
            // Assuming storage.updateSelection takes the ID of the selection to update
            const updatedSelection = await storage.updateSelection(existingSelection.id, updatePayload);
      
            if (needsUserChipStatusUpdate && userChipStatusPayload) {
              await storage.updateUser(userId, userChipStatusPayload);
            }
            
            res.status(200).json(updatedSelection);
          } catch (error) {
            console.error('Error updating selection:', error);
            if (error instanceof ZodError) {
              return res.status(400).json({ error: 'Validation error during update', details: error.errors });
            }
            res.status(500).json({ error: 'Failed to update selection' });
          }
        });
      
      }


      // 3. Construct the enriched selection array
      const enrichedSelections = golferIds.map(golferId => {
        const golfer = golferMap.get(golferId);
        const result = resultMap.get(golferId);
        // Get the rank at deadline from the map
        const rankAtDeadline = rankMap.get(golferId) ?? null; // Use null if not found
        const isCaptain = golferId === selectionRecord.captainGolferId;
        // Correct isWildcard logic: Check if user used waiver chip for this comp and this golfer was the replacement
        const isWildcard = userHasUsedWaiver && userWaiverCompId === competitionId && userWaiverReplacementId === golferId;

        return {
          // Use golferId as the key for the frontend list rendering if needed,
          // but the object itself represents one part of the user's selection.
          // The 'id' field here might be confusing, let's stick to the structure expected by the frontend.
          golfer: {
            id: golferId,
            name: golfer?.name ?? 'Unknown Golfer', // Use ?? for nullish coalescing
            avatar: golfer?.avatarUrl, // Use correct property name
            rank: rankAtDeadline, // Use rankAtDeadline here!
            waiverRank: selectionRecord.waiverRank, // Pass waiverRank through
          },
          position: result?.position ?? 'N/A', // Use ??
          points: result?.points ?? 0, // Use ??, default to 0
          isCaptain: isCaptain,
          isWildcard: isWildcard, // Use corrected wildcard status
        };
      });

      res.json(enrichedSelections); // Return the enriched array

    } catch (error) {
      console.error('Get user selection details error:', error); // Updated error message context
      res.status(500).json({ error: 'Failed to fetch selection details' });
    }
  });
  app.post('/api/selections', validateJWT, async (req: Request, res: Response) => {
    try { const tokenUser = req.user as ExtendedUser; const userId = tokenUser.database_id!; const selectionData = selectionFormSchema.parse(req.body); const competition = await storage.getCompetitionById(selectionData.competitionId); if (!competition) { return res.status(404).json({ error: 'Competition not found' }); } const deadlineDate = new Date(competition.selectionDeadline); const currentDate = new Date(); if (currentDate > deadlineDate) { return res.status(400).json({ error: 'Selection deadline has passed' }); } const existingSelection = await storage.getUserSelections(userId, selectionData.competitionId); if (existingSelection) { return res.status(400).json({ error: 'You already have selections for this competition' }); } if (selectionData.useCaptainsChip) { const hasUsedCaptainsChip = await storage.hasUsedCaptainsChip(userId); if (hasUsedCaptainsChip) { return res.status(400).json({ error: 'You have already used your captain\'s chip in another competition' }); } } const newSelection = await storage.createSelection({ ...selectionData, userId }); res.status(201).json(newSelection); } catch (error) { if (error instanceof ZodError) { return res.status(400).json({ error: error.errors }); } console.error('Create selection error:', error); res.status(500).json({ error: 'Failed to create selection' }); }
  });
  app.patch('/api/selections/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try { const { competitionId } = req.params; const tokenUser = req.user as ExtendedUser; const userId = tokenUser.database_id!; const selectionData = selectionFormSchema.parse(req.body); const competition = await storage.getCompetitionById(parseInt(competitionId)); if (!competition) { return res.status(404).json({ error: 'Competition not found' }); } const deadlineDate = new Date(competition.selectionDeadline); const currentDate = new Date(); if (currentDate > deadlineDate) { return res.status(400).json({ error: 'Selection deadline has passed' }); } const existingSelection = await storage.getUserSelections(userId, parseInt(competitionId)); if (!existingSelection) { return res.status(404).json({ error: 'No existing selection found' }); } if (selectionData.useCaptainsChip && !existingSelection.useCaptainsChip) { const hasUsedCaptainsChip = await storage.hasUsedCaptainsChip(userId); if (hasUsedCaptainsChip) { return res.status(400).json({ error: 'You have already used your captain\'s chip in another competition' }); } } const updatedSelection = await storage.updateSelection(existingSelection.id, { golfer1Id: selectionData.golfer1Id, golfer2Id: selectionData.golfer2Id, golfer3Id: selectionData.golfer3Id, useCaptainsChip: selectionData.useCaptainsChip }); res.json(updatedSelection); } catch (error) { if (error instanceof ZodError) { return res.status(400).json({ error: error.errors }); } console.error('Update selection error:', error); res.status(500).json({ error: 'Failed to update selection' }); }
  });

  // --- ADMIN ROUTES --- (All require validateJWT)

  app.post('/api/competitions', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      // Zod schema already validates externalLeaderboardUrl
      const competitionData = insertCompetitionSchema.parse(req.body);
      // Storage function now handles the URL
      const newCompetition = await storage.createCompetition(competitionData);
      res.status(201).json(newCompetition);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Create competition error:', error);
      res.status(500).json({ error: 'Failed to create competition' });
    }
  });
  app.post('/api/golfers', validateJWT, async (req: Request, res: Response) => {
    try { const tokenUser = req.user as ExtendedUser; if (!tokenUser.isAdmin) { return res.status(403).json({ error: 'Admin access required' }); } const newGolfer = await storage.createGolfer(req.body); res.status(201).json(newGolfer); } catch (error) { console.error('Create golfer error:', error); res.status(500).json({ error: 'Failed to create golfer' }); }
  });
  app.post('/api/results', validateJWT, async (req: Request, res: Response) => {
    try { const tokenUser = req.user as ExtendedUser; if (!tokenUser.isAdmin) { return res.status(403).json({ error: 'Admin access required' }); } const resultData = insertResultSchema.parse(req.body); const newResult = await storage.createResult(resultData); res.status(201).json(newResult); } catch (error) { if (error instanceof ZodError) { return res.status(400).json({ error: error.errors }); } console.error('Create result error:', error); res.status(500).json({ error: 'Failed to create result' }); }
  });
  app.get('/api/admin/competitions', validateJWT, async (req: Request, res: Response) => {
    try {
      const competitions = await storage.getCompetitions();
      const selectionCounts = await getCompetitionSelectionCounts();
      const totalUsersCount = await getTotalUsersCount();

      const competitionsWithCounts = competitions.map(comp => {
        const countEntry = selectionCounts.find(sc => sc.competitionId === comp.id);
        return {
          ...comp,
          selectionsCount: countEntry ? countEntry.count : 0,
          totalUsersCount: totalUsersCount,
        };
      });

      res.json(competitionsWithCounts);
    } catch (error) {
      console.error('Get admin competitions error:', error);
      res.status(500).json({ error: 'Failed to fetch competitions' });
    }
  });

  // New endpoint to get users without selections for a competition
  app.get('/api/admin/competitions/:competitionId/users-without-selections', validateJWT, async (req: Request, res: Response) => {
    try {
      const competitionId = parseInt(req.params.competitionId);
      if (isNaN(competitionId)) {
        return res.status(400).json({ error: 'Invalid competition ID' });
      }

      const usersWithoutSelections = await getUsersWithoutSelections(competitionId);
      res.json(usersWithoutSelections);
    } catch (error) {
      console.error('Get users without selections error:', error);
      res.status(500).json({ error: 'Failed to fetch users without selections' });
    }
  });
  app.patch('/api/admin/competitions/:id', validateJWT, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const competitionId = parseInt(id);
      // We don't need to re-validate with Zod here for PATCH,
      // but storage.updateCompetition now handles the URL field correctly.
      // Ensure req.body might contain externalLeaderboardUrl (as null or string)
      const updatedCompetition = await storage.updateCompetition(competitionId, req.body);
      res.json(updatedCompetition);
    } catch (error) {
      console.error('Admin update competition error:', error);
      res.status(500).json({ error: 'Failed to update competition' });
    }
  });
  app.delete('/api/admin/competitions/:id', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { id } = req.params;
      const competitionId = parseInt(id);
      if (isNaN(competitionId)) {
        return res.status(400).json({ error: 'Invalid competition ID' });
      }
      // Check if competition exists
      const competition = await storage.getCompetitionById(competitionId);
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      // Delete the competition (cascading deletes handled in storage)
      await storage.deleteCompetition(competitionId);
      res.json({ success: true, message: 'Competition deleted successfully' });
    } catch (error) {
      console.error('Admin delete competition error:', error);
      res.status(500).json({ error: 'Failed to delete competition' });
    }
  });
  // Modified GET /api/admin/users to include waiver chip details
  app.get('/api/admin/users', validateJWT, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();

      // Enhance user data with waiver chip details if used
      const enhancedUsers = await Promise.all(users.map(async (user) => {
        const { password, ...userData } = user; // Remove password

        let waiverDetails: any = {};
        if (userData.hasUsedWaiverChip && userData.waiverChipUsedCompetitionId && userData.waiverChipOriginalGolferId && userData.waiverChipReplacementGolferId) {
          const competition = await storage.getCompetitionById(userData.waiverChipUsedCompetitionId);
          const originalGolfer = await storage.getGolferById(userData.waiverChipOriginalGolferId);
          const replacementGolfer = await storage.getGolferById(userData.waiverChipReplacementGolferId);
          waiverDetails = {
            waiverCompetitionName: competition?.name || 'N/A',
            waiverOriginalGolferName: originalGolfer?.name || 'N/A',
            waiverReplacementGolferName: replacementGolfer?.name || 'N/A',
          };
        }

        return { ...userData, ...waiverDetails };
      }));

      res.json(enhancedUsers);
    } catch (error) {
      console.error('Admin get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Admin create new user
  app.post('/api/admin/users', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Validate input (isAdmin removed from destructuring)
      const { email, username, fullName, password } = req.body;
      if (!email || !username || !fullName || !password) {
        return res.status(400).json({ error: 'Email, username, full name, and password are required' });
      }
      if (typeof password !== 'string' || password.length < 6) {
         return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // Create user (storage.createUser handles password hashing)
      const newUser = await storage.createUser({
        email,
        username,
        fullName,
        password, // Pass plain text password to storage function
        isAdmin: false // Always create as non-admin
      });

      const { password: _, ...userData } = newUser; // Exclude password from response
      res.status(201).json(userData);

    } catch (error) {
      console.error('Admin create user error:', error);
      // Handle potential unique constraint errors (e.g., username already exists if you add that constraint)
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
         return res.status(409).json({ error: 'Username or Email already in use.' }); // Adjust based on actual constraints
      }
      res.status(500).json({ error: 'Failed to create user' });
    }
  });


  // Admin update user details (username, email, fullName, hasPaid, isAdmin)
  app.patch('/api/admin/users/:id', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const userIdToUpdate = parseInt(req.params.id);
      if (isNaN(userIdToUpdate)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Validate incoming data (allow only specific fields)
      const { username, email, fullName, isAdmin } = req.body; // Extract isAdmin
      const updateData: Partial<User> = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email; // Add validation if needed
      if (fullName !== undefined) updateData.fullName = fullName;
    if (isAdmin !== undefined && typeof isAdmin === 'boolean') {
      updateData.isAdmin = isAdmin;
    }
    // Add check for hasPaid
    const { hasPaid } = req.body;
    if (hasPaid !== undefined && typeof hasPaid === 'boolean') {
      updateData.hasPaid = hasPaid;
    }

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update' });
      }

      // Use storage function to update (ensure password isn't changed here)
      const updatedUser = await storage.updateUser(userIdToUpdate, updateData); // Assuming updateUser prevents password change if not provided
      const { password, ...userData } = updatedUser; // Exclude password from response
      res.json(userData);

    } catch (error) {
      console.error(`Admin update user error for ID ${req.params.id}:`, error);
      // Handle potential unique constraint errors (e.g., email already exists)
      if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint')) {
         return res.status(409).json({ error: 'Email address already in use.' });
      }
      res.status(500).json({ error: 'Failed to update user details' });
    }
  });

  // Admin reset user password
  app.post('/api/admin/users/:id/reset-password', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const userIdToReset = parseInt(req.params.id);
      if (isNaN(userIdToReset)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Check if user exists
      const userExists = await storage.getUser(userIdToReset);
      if (!userExists) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate a new random password (e.g., 10 characters)
      const newPassword = crypto.randomBytes(10).toString('hex').slice(0, 10);
      const hashedPassword = await hashPassword(newPassword);

      // Update the password in storage
      await storage.updateUserPassword(userIdToReset, hashedPassword);

      try {
        await sendTemporaryPasswordEmail(userExists.email, userExists.username, newPassword);
      } catch (mailError) {
        console.error(`Password reset email failed for user ID ${userIdToReset}:`, mailError);
        return res.status(500).json({
          error: 'Password was reset but the email could not be sent. Run the reset again to issue a new temporary password.',
        });
      }

      console.log(`Admin reset password email sent for user ID ${userIdToReset}.`);

      res.json({
        success: true,
        message: `Password reset successfully for ${userExists.username}. Temporary password emailed to ${userExists.email}.`,
      });

    } catch (error) {
      console.error(`Admin reset password error for user ID ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Admin: Get all selections for a specific user
  app.get('/api/admin/users/:id/selections', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // We need a new storage method for this detailed view
      const selectionsDetails = await storage.getUserSelectionsDetails(userId); 
      res.json(selectionsDetails);

    } catch (error) {
      console.error(`Error fetching selections details for user ID ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to fetch user selections details' });
    }
  });

  // Admin upload avatar for a specific user
  app.post('/api/admin/users/:id/avatar', validateJWT, upload.single('avatar'), async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const userIdToUpdate = parseInt(req.params.id);
      if (isNaN(userIdToUpdate)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Check if user exists before proceeding (optional but good practice)
      const userExists = await storage.getUser(userIdToUpdate);
      if (!userExists) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`; // Relative URL path

      // Update user record in the database
      const updatedUser = await storage.updateUser(userIdToUpdate, { avatarUrl });

      const { password, ...userData } = updatedUser; // Exclude password from response
      res.json({ message: 'Avatar uploaded successfully by admin', user: userData });

    } catch (error: any) {
      console.error(`Admin avatar upload error for user ID ${req.params.id}:`, error);
      // Handle multer errors specifically
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
      } else if (error.message === 'Invalid file type, only images are allowed!') {
         return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to upload avatar by admin' });
    }
  });


  // New endpoint for detailed user list for admin management
  app.get('/api/admin/users/details', validateJWT, async (req: Request, res: Response) => {
    try {
      // Ensure user is admin (already checked by validateJWT for /api/admin routes)
      const users = await storage.getAllUsers();

      // Enhance user data - lastLoginAt and selectionCount are handled by formatUserForResponse
      const enhancedUsers = users.map(user => {
        // The formatUserForResponse function now handles adding selectionCount
        // and formatting lastLoginAt, so we just return the formatted user.
        // Note: getAllUsers in storage.ts was already updated to provide the count.
        return user; // User object already contains selectionCount from the storage layer query
      });

      res.json(enhancedUsers);
    } catch (error) {
      console.error('Admin get detailed users error:', error);
      res.status(500).json({ error: 'Failed to fetch detailed user list' });
    }
  });

  app.get('/api/admin/point-system', validateJWT, async (req: Request, res: Response) => {
    try { const pointSystem = await storage.getPointSystem(); res.json(pointSystem); } catch (error) { console.error('Admin get point system error:', error); res.status(500).json({ error: 'Failed to fetch point system' }); }
  });
  app.patch('/api/admin/point-system/:position', validateJWT, async (req: Request, res: Response) => {
    try { const { position } = req.params; const { points } = req.body; if (typeof points !== 'number') { return res.status(400).json({ error: 'Points must be a number' }); } const updatedPointSystem = await storage.updatePointSystem(parseInt(position), points); res.json(updatedPointSystem); } catch (error) { console.error('Admin update point system error:', error); res.status(500).json({ error: 'Failed to update point system' }); }
  });
  app.get('/api/admin/tournament-results/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try { 
      const { competitionId } = req.params; 
      const results = await storage.getResults(parseInt(competitionId)); 
      const resultsWithGolfers = await Promise.all(results.map(async (result) => { 
        const golfer = await storage.getGolferById(result.golferId); 
        // Include firstName and lastName in the golfer object for consistency
        return { 
          ...result, 
          golfer: golfer ? { 
            id: golfer.id, 
            name: golfer.name, 
            firstName: golfer.firstName, // Add firstName
            lastName: golfer.lastName   // Add lastName
          } : undefined 
        }; 
      })); 
      res.json(resultsWithGolfers); 
    } catch (error) { 
      console.error('Admin get tournament results error:', error); 
      res.status(500).json({ error: 'Failed to fetch tournament results' }); 
    }
  });
  app.post('/api/admin/tournament-results', validateJWT, async (req: Request, res: Response) => {
    try { const resultData = insertResultSchema.parse(req.body); const existingResults = await storage.getResults(resultData.competitionId); const existingResult = existingResults.find(r => r.golferId === resultData.golferId); if (existingResult) { return res.status(400).json({ error: 'Result already exists for this golfer in this competition' }); } const newResult = await storage.createResult(resultData); const golfer = await storage.getGolferById(resultData.golferId); res.status(201).json({ ...newResult, golfer: golfer ? { id: golfer.id, name: golfer.name } : undefined }); } catch (error) { if (error instanceof ZodError) { return res.status(400).json({ error: error.errors }); } console.error('Admin create tournament result error:', error); res.status(500).json({ error: 'Failed to create tournament result' }); }
  });
  app.patch('/api/admin/tournament-results/:id', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const resultId = parseInt(id); const existingResult = await storage.getResultById(resultId); if (!existingResult) { return res.status(404).json({ error: 'Result not found' }); } const updatedResult = await storage.updateResult(resultId, req.body); const golfer = await storage.getGolferById(updatedResult.golferId); res.json({ ...updatedResult, golfer: golfer ? { id: golfer.id, name: golfer.name } : undefined }); } catch (error) { console.error('Admin update tournament result error:', error); res.status(500).json({ error: 'Failed to update tournament result' }); }
  });
  app.delete('/api/admin/tournament-results/:id', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const resultId = parseInt(id); await storage.deleteResult(resultId); res.json({ success: true }); } catch (error) { console.error('Admin delete tournament result error:', error); res.status(500).json({ error: 'Failed to delete tournament result' }); }
  });
  app.post('/api/admin/complete-tournament/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const competition = await storage.getCompetitionById(parseInt(competitionId));
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      try {
        // Use statically imported function
        // Pass pool and competitionId
        await updateResultsAndAllocatePoints(pool, parseInt(competitionId)); // Pass pool directly
      } catch (error) {
        console.error('Error running points allocation:', error);
        return res.status(500).json({ error: 'Failed to allocate points' });
      }
      const updatedCompetition = await storage.updateCompetition(parseInt(competitionId), { isComplete: true, isActive: false });
      res.json({ success: true, competition: updatedCompetition });
    } catch (error) {
      console.error('Admin complete tournament error:', error);
      res.status(500).json({ error: 'Failed to complete tournament' });
    }
  });
  app.get('/api/admin/competitions/:id/selections', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const competitionId = parseInt(id); const selectionRows = await storage.getAllSelections(competitionId); const selectionsWithDetails = await Promise.all(selectionRows.map(async (selection) => { const user = await storage.getUser(selection.userId); const golfer1 = await storage.getGolferById(selection.golfer1Id); const golfer2 = await storage.getGolferById(selection.golfer2Id); const golfer3 = await storage.getGolferById(selection.golfer3Id); return { ...selection, user: user ? { id: user.id, username: user.username, email: user.email } : undefined, golfer1: golfer1 ? { id: golfer1.id, name: golfer1.name } : undefined, golfer2: golfer2 ? { id: golfer2.id, name: golfer2.name } : undefined, golfer3: golfer3 ? { id: golfer3.id, name: golfer3.name } : undefined }; })); res.json(selectionsWithDetails); } catch (error) { console.error('Admin get competition selections error:', error); res.status(500).json({ error: 'Failed to fetch competition selections' }); }
  });
  // Add new route for fetching specific user selection by admin
  app.get('/api/admin/user-selection/:userId/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try {
      const { userId, competitionId } = req.params;
      console.log(`[Admin Route] Fetching selection for User: ${userId}, Competition: ${competitionId}`);
      const selection = await storage.getUserSelections(parseInt(userId), parseInt(competitionId));
      console.log(`[Admin Route] Found selection:`, selection);
      if (!selection) {
        console.log(`[Admin Route] Selection not found, returning 404`);
        return res.status(404).json({ error: 'Selection not found for this user and competition' });
      }
      res.json(selection);
    } catch (error) {
      console.error('[Admin Route] Get user selection error:', error);
      res.status(500).json({ error: 'Failed to fetch user selection' });
    }
  });

  // Admin: Create a new selection for a user (e.g., if they missed the deadline)
  app.post('/api/admin/selections', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Validate the incoming data using the admin-specific schema
      const selectionData = adminCreateSelectionSchema.parse(req.body); // Use the new schema

      // Check if a selection already exists for this user and competition
      const existingSelection = await storage.getUserSelections(selectionData.userId, selectionData.competitionId);
      if (existingSelection) {
        return res.status(409).json({ error: 'A selection already exists for this user in this competition. Use the edit function instead.' });
      }

      // Create the new selection using the storage method
      // Note: The schema expects userId, competitionId, golfer1Id, golfer2Id, golfer3Id.
      // useCaptainsChip and captainGolferId are optional and default to false/null if not provided.
      // Admin creation likely won't involve chips initially.
      const newSelection = await storage.createSelection({
        userId: selectionData.userId,
        competitionId: selectionData.competitionId,
        golfer1Id: selectionData.golfer1Id,
        golfer2Id: selectionData.golfer2Id,
        golfer3Id: selectionData.golfer3Id,
        // Explicitly set chips to false/null for admin creation unless schema allows otherwise
        useCaptainsChip: false, 
        captainGolferId: null,
          });
          
          // Use userId from the validated input data to avoid potential type issues with the returned object
          const userIdForLookup = selectionData.userId; 

          // Fetch details for the response (optional, but good practice)
          const user = await storage.getUser(userIdForLookup); // Use userId from validated data
          const golfer1 = await storage.getGolferById(newSelection.golfer1Id);
          const golfer2 = await storage.getGolferById(newSelection.golfer2Id);
      const golfer3 = await storage.getGolferById(newSelection.golfer3Id);

      // Ensure the response includes the userId, using the one from validated data
      res.status(201).json({
        ...newSelection, 
        userId: userIdForLookup, // Explicitly include the userId in the response object
        user: user ? { id: user.id, username: user.username, email: user.email } : undefined,
        golfer1: golfer1 ? { id: golfer1.id, name: golfer1.name } : undefined,
        golfer2: golfer2 ? { id: golfer2.id, name: golfer2.name } : undefined,
        golfer3: golfer3 ? { id: golfer3.id, name: golfer3.name } : undefined
      });

    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid selection data', details: error.errors });
      }
      console.error('Admin create selection error:', error);
      res.status(500).json({ error: 'Failed to create selection' });
    }
  });

  // Admin: Update an existing selection
  app.patch('/api/admin/selections/:id', validateJWT, async (req: Request, res: Response) => { 
    try {
      const { id } = req.params;
      const selectionId = parseInt(id);
      let { isWaiverChipTransaction, ...selectionUpdateData } = req.body; // Extract waiver flag, changed const to let

      const existingSelection = await storage.getSelectionById(selectionId);
      if (!existingSelection) {
        return res.status(404).json({ error: 'Selection not found' });
      }

      const targetUserId = existingSelection.userId;
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User associated with selection not found' });
      }

      // --- Waiver Chip Logic ---
      if (isWaiverChipTransaction === true) {
        console.log(`Admin attempting waiver chip transaction for user ${targetUserId}, selection ${selectionId}`);
        if (targetUser.hasUsedWaiverChip) {
          return res.status(400).json({ error: 'This user has already used their waiver chip.' });
        }

        // Determine original and replacement golfer IDs from the update data
        // This assumes the frontend sends the *new* golfer IDs in the update
        // We need to know which golfer slot is being changed to identify the original.
        // This requires the frontend to send which slot (1, 2, or 3) and the new golferId.
        // Let's assume the frontend sends `updatedGolferSlot` (1, 2, or 3) and `newGolferId`.
        const { updatedGolferSlot, newGolferId, ...restOfUpdateData } = selectionUpdateData;

        if (!updatedGolferSlot || !newGolferId) {
           return res.status(400).json({ error: 'Missing updatedGolferSlot or newGolferId for waiver transaction.' });
        }

        let originalGolferId: number | null = null;
        if (updatedGolferSlot === 1) originalGolferId = existingSelection.golfer1Id;
        else if (updatedGolferSlot === 2) originalGolferId = existingSelection.golfer2Id;
        else if (updatedGolferSlot === 3) originalGolferId = existingSelection.golfer3Id;

        if (!originalGolferId) {
           return res.status(400).json({ error: 'Could not determine original golfer for waiver transaction.' });
        }

        // Update user's waiver status
        await storage.updateUser(targetUserId, {
          hasUsedWaiverChip: true,
          waiverChipUsedCompetitionId: existingSelection.competitionId,
          waiverChipOriginalGolferId: originalGolferId,
          waiverChipReplacementGolferId: newGolferId,
        });
        console.log(`User ${targetUserId} waiver chip marked as used. Original: ${originalGolferId}, Replacement: ${newGolferId}`);

        // Prepare selection update data without the extra waiver fields
         // Fetch the rank of the replacement golfer
         const replacementGolfer = await storage.getGolferById(newGolferId);
         if (!replacementGolfer) {
           return res.status(404).json({ error: 'Replacement golfer not found.' });
         }
         const waiverRank = replacementGolfer.rank;
         console.log(`Replacement golfer ${newGolferId} rank is ${waiverRank}. Adding to selection update.`);

         // Add waiverRank to the data being sent to storage.updateSelection
         selectionUpdateData = { ...restOfUpdateData, waiverRank: waiverRank };

       } else {
         // If not a waiver transaction, ensure waiverRank is not accidentally set
         delete selectionUpdateData.waiverRank;
       }
       // --- End Waiver Chip Logic ---


      // --- Captain Chip Logic (existing) ---
      if (selectionUpdateData.useCaptainsChip !== undefined && selectionUpdateData.useCaptainsChip !== existingSelection.useCaptainsChip) {
        if (selectionUpdateData.useCaptainsChip) {
          const hasUsedCaptainsChip = await storage.hasUsedCaptainsChip(existingSelection.userId);
          if (hasUsedCaptainsChip) {
            // Check if the chip was used in *another* competition for this user
            const userSelections = await storage.getUserSelectionsForAllCompetitions(existingSelection.userId);
            const chipUsedElsewhere = userSelections?.some(s => s.useCaptainsChip && s.competitionId !== existingSelection.competitionId);
            if (chipUsedElsewhere) {
               return res.status(400).json({ error: 'This user has already used their captain\'s chip in another competition' });
            }
          }
        }
      }
      // --- End Captain Chip Logic ---

      // Perform the actual selection update
      const updatedSelection = await storage.updateSelection(selectionId, selectionUpdateData);

      // Fetch details for response
      const user = await storage.getUser(updatedSelection.userId);
      const golfer1 = await storage.getGolferById(updatedSelection.golfer1Id);
      const golfer2 = await storage.getGolferById(updatedSelection.golfer2Id);
      const golfer3 = await storage.getGolferById(updatedSelection.golfer3Id);

      res.json({
        ...updatedSelection,
        user: user ? { id: user.id, username: user.username, email: user.email } : undefined,
        golfer1: golfer1 ? { id: golfer1.id, name: golfer1.name } : undefined,
        golfer2: golfer2 ? { id: golfer2.id, name: golfer2.name } : undefined,
        golfer3: golfer3 ? { id: golfer3.id, name: golfer3.name } : undefined
      });

    } catch (error) {
      console.error('Admin update selection error:', error);
      res.status(500).json({ error: 'Failed to update selection' });
    }
  });
  app.delete('/api/admin/selections/:id', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const selectionId = parseInt(id); await storage.deleteSelection(selectionId); res.json({ success: true }); } catch (error) { console.error('Admin delete selection error:', error); res.status(500).json({ error: 'Failed to delete selection' }); }
  });
  app.post('/api/admin/update-results', validateJWT, async (req: Request, res: Response) => {
    try {
      // Extract competitionId and forceUpdate flag from request body
      const { competitionId, forceUpdate = false } = req.body; // Default forceUpdate to false

      // Validate competitionId
      if (typeof competitionId !== 'number') {
        return res.status(400).json({ error: 'Invalid or missing competitionId' });
      }

      // Call the updated script function, passing the forceUpdate flag
      // Wrap the call in a try/catch to capture any errors from the script itself
      let result: ProcessStatus | void;
      try {
        result = await updateResultsAndAllocatePoints(pool, competitionId, forceUpdate);
      } catch (scriptError: any) {
        console.error(`[API Route] Error executing updateResultsAndAllocatePoints script for competition ${competitionId}:`, scriptError);
        return res.status(500).json({ error: `Internal server error during script execution: ${scriptError?.message || scriptError}` });
      }

      // Handle the result based on its status
      if (result) { // Check if result is defined (it should be for single competition processing)
        switch (result.status) {
          case 'success':
            // Update the timestamp only on success
            await storage.updateCompetition(competitionId, { lastResultsUpdateAt: new Date().toISOString() });
            console.log(`Updated lastResultsUpdateAt for competition ${competitionId}`);
            return res.json({ success: true, message: `Update successful for competition ${competitionId}` });

          case 'mismatch':
            // Return 409 Conflict with details for the client confirmation dialog
            console.warn(`Name mismatch detected for competition ${competitionId}. Sending 409 to client.`);
            return res.status(409).json({
              status: 'confirmation_required', // Custom status for client handling
              message: 'Competition name mismatch detected.',
              dbName: result.dbName,
              fetchedName: result.fetchedName,
              cleanedFetchedName: result.cleanedFetchedName,
            });

          case 'error':
            // Return 500 Internal Server Error with the specific error message from the script
            console.error(`Script error during update for competition ${competitionId}: ${result.message}`);
            return res.status(500).json({ error: `Failed to update results: ${result.message}` });
        }
      } else {
         // This case should ideally not be reached if competitionId is always provided,
         // but handle it defensively. Assume success for the API call itself.
         console.warn(`updateResultsAndAllocatePoints returned void unexpectedly for competition ${competitionId}.`);
         return res.json({ success: true, message: `Update process initiated for competition ${competitionId}, but final status was void.` });
      }

    } catch (error: any) { // Catch errors in the route handler itself
      console.error(`API route /api/admin/update-results error for competition ${req.body?.competitionId}:`, error);
      res.status(500).json({ error: `API Error: ${error?.message || 'Failed to process update request'}` });
    }
  });
  app.get('/api/admin/wildcard-golfers/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try { const { competitionId } = req.params; const compId = parseInt(competitionId); const wildcardGolfers = await storage.getWildcardGolfers(compId); res.json(wildcardGolfers); } catch (error) { console.error('Get wildcard golfers error:', error); res.status(500).json({ error: 'Failed to get wildcard golfers' }); }
  });
  app.post('/api/admin/wildcard-golfers', validateJWT, async (req: Request, res: Response) => {
    try { const { competitionId, golferId, isWildcard } = req.body; if (!competitionId || !golferId) { return res.status(400).json({ error: 'Competition ID and Golfer ID are required' }); } const existingWildcard = await storage.getWildcardGolfer(competitionId, golferId); let wildcardGolfer; if (existingWildcard) { wildcardGolfer = await storage.updateWildcardGolfer(existingWildcard.id, { isWildcard: isWildcard !== undefined ? isWildcard : true }); } else { wildcardGolfer = await storage.createWildcardGolfer({ competitionId, golferId, isWildcard: isWildcard !== undefined ? isWildcard : true }); } res.status(201).json(wildcardGolfer); } catch (error) { console.error('Create/update wildcard golfer error:', error); res.status(500).json({ error: 'Failed to create/update wildcard golfer' }); }
  });
  app.delete('/api/admin/wildcard-golfers/:id', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const wildcardId = parseInt(id); await storage.deleteWildcardGolfer(wildcardId); res.json({ success: true }); } catch (error) { console.error('Delete wildcard golfer error:', error); res.status(500).json({ error: 'Failed to delete wildcard golfer' }); }
  });
  app.get('/api/admin/hole-in-ones/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try { const competitionId = parseInt(req.params.competitionId); const holeInOnes = await storage.getHoleInOnes(competitionId); const golferMap = new Map(); const golfers = await storage.getGolfers(); golfers.forEach(golfer => golferMap.set(golfer.id, golfer)); const holeInOnesWithGolferDetails = holeInOnes.map(hio => ({ ...hio, golfer: golferMap.get(hio.golferId) })); res.json(holeInOnesWithGolferDetails); } catch (error) { console.error('Error fetching hole-in-ones:', error); res.status(500).json({ error: 'Failed to fetch hole-in-ones' }); }
  });
  app.post('/api/admin/hole-in-ones', validateJWT, async (req: Request, res: Response) => {
    try { const validationResult = holeInOneFormSchema.safeParse(req.body); if (!validationResult.success) { return res.status(400).json({ error: 'Invalid hole-in-one data', details: validationResult.error.format() }); } const holeInOneData = validationResult.data; const holeInOne = await storage.createHoleInOne(holeInOneData); res.status(201).json(holeInOne); } catch (error) { console.error('Error creating hole-in-one:', error); res.status(500).json({ error: 'Failed to create hole-in-one' }); }
  });
  app.patch('/api/admin/hole-in-ones/:id', validateJWT, async (req: Request, res: Response) => {
    try { const holeInOneId = parseInt(req.params.id); const holeInOneData = req.body; holeInOneData.updatedAt = new Date().toISOString(); const updatedHoleInOne = await storage.updateHoleInOne(holeInOneId, holeInOneData); res.json(updatedHoleInOne); } catch (error) { console.error('Error updating hole-in-one:', error); res.status(500).json({ error: 'Failed to update hole-in-one' }); }
  });
  app.delete('/api/admin/hole-in-ones/:id', validateJWT, async (req: Request, res: Response) => {
    try { const holeInOneId = parseInt(req.params.id); await storage.deleteHoleInOne(holeInOneId); res.status(200).json({ message: 'Hole-in-one deleted successfully' }); } catch (error) { console.error('Error deleting hole-in-one:', error); res.status(500).json({ error: 'Failed to delete hole-in-one' }); }
  });

  // New endpoint to capture selection ranks for a competition
  app.post('/api/admin/competitions/:id/capture-ranks', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const competitionId = parseInt(req.params.id);
      if (isNaN(competitionId)) {
        return res.status(400).json({ error: 'Invalid competition ID' });
      }

      // Optional: Add check if deadline has passed before capturing
      // const competition = await storage.getCompetitionById(competitionId);
      // if (!competition || new Date() < new Date(competition.selectionDeadline)) {
      //   return res.status(400).json({ error: 'Cannot capture ranks before selection deadline' });
      // }

      console.log(`[API] Triggering rank capture for competition ID: ${competitionId}`);
      const result = await storage.captureSelectionRanksForCompetition(competitionId);
      console.log(`[API] Rank capture result for competition ID ${competitionId}:`, result);

      if (result.success) {
        // Update the timestamp after successful capture - Convert Date to ISO string (Reverting)
        await storage.updateCompetition(competitionId, { ranksCapturedAt: new Date().toISOString() });
        console.log(`Updated ranksCapturedAt for competition ${competitionId}`);
        res.json({ success: true, message: `Successfully captured/updated ${result.count} selection ranks and recorded timestamp.`, errors: result.errors });
      } else {
        // Even if some errors occurred, report partial success if count > 0
        // Do not update timestamp if the process wasn't fully successful (or decide based on requirements)
        res.status(500).json({ success: false, message: `Rank capture process completed with ${result.errors} errors. ${result.count} ranks captured. Timestamp not recorded.`, errors: result.errors, count: result.count });
      }
    } catch (error) {
      console.error(`Error capturing selection ranks for competition ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to capture selection ranks' });
    }
  });

  // New endpoint to clear down the database except for specified users
  app.post('/api/admin/clear-database', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      console.log(`[API /api/admin/clear-database] Starting clear down process, keeping admin users.`);

      await db.transaction(async (tx) => {
        // 1. Find the IDs of admin users to keep
        const adminUsers = await tx.select({ id: users.id })
          .from(users)
          .where(eq(users.isAdmin, true));

        const adminUserIds = adminUsers.map(u => u.id);
        console.log(`[API /api/admin/clear-database] Admin User IDs to keep: ${adminUserIds.join(', ')}`);

        if (adminUserIds.length > 0) {
          // 2. Delete selections for the admin users being kept
          // Note: You might want to keep admin selections depending on requirements,
          // but the original request was to clear them for the specified users.
          // Let's stick to clearing selections for admins for now.
          const deletedSelections = await tx.delete(selections)
            .where(inArray(selections.userId, adminUserIds))
            .returning({ id: selections.id });
          console.log(`[API /api/admin/clear-database] Deleted ${deletedSelections.length} selections for admin users.`);
        } else {
          console.log(`[API /api/admin/clear-database] No admin users found, skipping selection deletion for admins.`);
        }

        // 3. Find IDs of non-admin users
        const nonAdminUsers = await tx.select({ id: users.id })
          .from(users)
          .where(eq(users.isAdmin, false));
        const nonAdminUserIds = nonAdminUsers.map(u => u.id);
        console.log(`[API /api/admin/clear-database] Non-Admin User IDs to delete selections/users for: ${nonAdminUserIds.join(', ')}`);

        // 4. Delete selections for non-admin users (if any exist)
        if (nonAdminUserIds.length > 0) {
          const deletedNonAdminSelections = await tx.delete(selections)
            .where(inArray(selections.userId, nonAdminUserIds)) // <--- This should delete orphaned selections
            .returning({ id: selections.id });
          console.log(`[API /api/admin/clear-database] Deleted ${deletedNonAdminSelections.length} selections for non-admin users.`);
        } else {
           console.log(`[API /api/admin/clear-database] No non-admin users found, skipping selection deletion for non-admins.`);
        }
        
        // 5. Delete all users that are NOT admins (if any exist)
        if (nonAdminUserIds.length > 0) {
          const deletedUsers = await tx.delete(users)
            .where(inArray(users.id, nonAdminUserIds)) // Use the fetched IDs
            .returning({ id: users.id, email: users.email });
          console.log(`[API /api/admin/clear-database] Deleted ${deletedUsers.length} non-admin users.`);
        } else {
           console.log(`[API /api/admin/clear-database] No non-admin users found to delete.`);
        }

        // 6. Reset waiver chip status for remaining admin users (ADDED THIS STEP)
        if (adminUserIds.length > 0) {
          console.log(`[API /api/admin/clear-database] Attempting to reset waiver status for admin IDs: ${adminUserIds.join(', ')}`);
          const updatedAdmins = await tx.update(users)
            .set({
              hasUsedWaiverChip: false,
              waiverChipUsedCompetitionId: null,
              waiverChipOriginalGolferId: null,
              waiverChipReplacementGolferId: null
            })
            .where(inArray(users.id, adminUserIds))
            .returning({ id: users.id });
          const updatedAdminIds = updatedAdmins.map(u => u.id);
          console.log(`[API /api/admin/clear-database] Reset waiver chip status for ${updatedAdmins.length} admin users. IDs updated: ${updatedAdminIds.join(', ')}`);
        } else {
          console.log(`[API /api/admin/clear-database] No admin users found, skipping waiver chip reset.`);
        }
      });

      console.log(`[API /api/admin/clear-database] Database clear down successful.`);
      // Updated success message to reflect waiver reset
      res.json({ success: true, message: 'Database cleared successfully, keeping admin users, removing their selections, and resetting their waiver status.' });

    } catch (error) {
      console.error('[API /api/admin/clear-database] Error during database clear down:', error);
      res.status(500).json({ error: 'Failed to clear database.' });
    }
  });


  // New endpoint to trigger the golfer update script
  app.post('/api/admin/update-golfers', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      if (!tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      console.log('[API] Triggering golfer update script...');

      // Resolve the path to the script using import.meta.url for ES Modules
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const scriptPath = path.resolve(__dirname, '../scripts/update_golfers_datagolf.ts');

      // Check if the script exists before attempting to run
      // (Requires fs module, consider adding if needed for robustness)
      // import fs from 'fs';
      // if (!fs.existsSync(scriptPath)) {
      //   console.error(`Script not found at path: ${scriptPath}`);
      //   return res.status(500).json({ error: 'Golfer update script not found.' });
      // }

      // Execute the TypeScript script using tsx
      const process = spawn('npx', ['tsx', scriptPath], { stdio: 'pipe' }); // Use tsx

      let scriptOutput = '';
      let scriptError = '';

      process.stdout.on('data', (data) => {
        console.log(`[Golfer Update Script STDOUT]: ${data}`);
        scriptOutput += data.toString();
      });

      process.stderr.on('data', (data) => {
        console.error(`[Golfer Update Script STDERR]: ${data}`);
        scriptError += data.toString();
      });

      process.on('close', async (code) => { // Make this async
        console.log(`[Golfer Update Script] exited with code ${code}`);
        if (code === 0) {
          // Attempt to parse count/errors from output (simple example)
          const countMatch = scriptOutput.match(/Inserted (\d+) golfers/);
          const count = countMatch ? parseInt(countMatch[1], 10) : 'N/A';
          // res.json({ success: true, message: `Golfer update script finished.`, count: count, errors: 0 }); // Assume 0 errors on success code for now
          try {
            const now = new Date();
            await db.insert(appMetadata)
              .values({
                metaKey: 'golfers_last_updated_timestamp',
                metaValueTimestamp: now,
                updatedAt: now
              })
              .onConflictDoUpdate({
                target: appMetadata.metaKey,
                set: {
                  metaValueTimestamp: now,
                  updatedAt: now
                }
              });
            console.log('Successfully updated golfers_last_updated_timestamp in app_metadata');
            res.json({ success: true, message: 'Golfer update process completed and timestamp recorded.', count: count, errors: 0, output: scriptOutput, errorDetails: scriptError });
          } catch (dbError) {
            console.error('Error updating golfers_last_updated_timestamp in app_metadata:', dbError);
            // Still send success for script, but note the db error
            res.status(207).json({ success: true, message: 'Golfer update process completed, but failed to record timestamp.', count: count, errors: 0, output: scriptOutput, errorDetails: scriptError, dbError: (dbError as Error).message });
          }
        } else {
          res.status(500).json({ success: false, error: `Golfer update script failed with code ${code}.`, details: scriptError || scriptOutput });
        }
      });

       process.on('error', (err) => {
         console.error('[API] Failed to start golfer update script:', err);
         res.status(500).json({ error: 'Failed to start golfer update script.', details: err.message });
       });

    } catch (error) {
      console.error('Error triggering golfer update script:', error);
      res.status(500).json({ error: 'Failed to trigger golfer update script' });
    }
  });


  app.get('/api/admin/golfers-last-updated', validateJWT, async (req: Request, res: Response) => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    try {
      const result = await db.select({
          timestamp: appMetadata.metaValueTimestamp
        })
        .from(appMetadata)
        .where(eq(appMetadata.metaKey, 'golfers_last_updated_timestamp'))
        .limit(1);

      if (result.length > 0 && result[0].timestamp) {
        res.json({ lastUpdated: result[0].timestamp });
      } else {
        res.json({ lastUpdated: null });
      }
    } catch (error) {
      console.error('Error fetching golfers_last_updated_timestamp:', error);
      res.status(500).json({ error: 'Failed to fetch last updated timestamp' });
    }
  });

  // Return a new server but don't start it
  // This will be started in index.ts
  const server = new Server(app);
  return server;
}
