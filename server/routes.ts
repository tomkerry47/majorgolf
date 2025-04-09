import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { storage, type IStorage } from './storage'; // Import IStorage type
import {
  loginSchema,
  registerSchema,
  selectionFormSchema,
  insertResultSchema,
  insertCompetitionSchema,
  holeInOneFormSchema,
  type Competition,
  type Selection,
  User,
  Golfer,
  type UserPoints,
  type SelectionRank, // Import SelectionRank type
  type Result // Import Result type
} from '@shared/schema';
import { generateToken, verifyToken, comparePassword } from './db';
import { ZodError } from 'zod';
import { pgClient, pool } from './db';
import { updateResultsAndAllocatePoints } from '../scripts/update_results_and_allocate_points';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url'; // Import fileURLToPath for ES Modules

// Extended user interface including JWT properties
interface ExtendedUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  database_id?: number;
  isAdmin?: boolean;
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
  const path = req.path.replace(/^\/api/, '');
  const method = req.method;
  const route = `${path} ${method}`;
  console.log(`Validating auth for: ${route}`);

  // List of explicitly public routes (paths starting after /api/)
  const publicRoutes = [
    '/auth/login POST',
    '/auth/register POST',
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

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const data = registerSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) { return res.status(400).json({ error: 'User already exists' }); }
      const newUser = await storage.createUser({ email: data.email, username: data.username, fullName: data.fullName || data.username, password: data.password, isAdmin: false });
      const token = generateToken(newUser.id, newUser.email, newUser.isAdmin);
      res.cookie('authToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.status(201).json({ user: { id: newUser.id.toString(), email: newUser.email, username: newUser.username, avatarUrl: newUser.avatarUrl, isAdmin: newUser.isAdmin }, token });
    } catch (error) { if (error instanceof ZodError) { return res.status(400).json({ error: error.errors }); } console.error('Register error:', error); res.status(500).json({ error: 'Registration failed' }); }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) { return res.status(401).json({ error: 'Invalid credentials' }); }
      if (!user.password) { return res.status(401).json({ error: 'Password not set' }); }
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) { return res.status(401).json({ error: 'Invalid credentials' }); }
      const token = generateToken(user.id, user.email, user.isAdmin);
      res.cookie('authToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ user: { id: user.id.toString(), email: user.email, username: user.username, avatarUrl: user.avatarUrl, isAdmin: user.isAdmin }, token });
    } catch (error) { if (error instanceof ZodError) { return res.status(400).json({ error: error.errors }); } console.error('Login error:', error); res.status(500).json({ error: 'Login failed' }); }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    res.clearCookie('authToken'); res.json({ success: true });
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
  app.get('/api/competitions/upcoming', async (req: Request, res: Response) => {
    try { const upcomingCompetitions = await storage.getUpcomingCompetitions(); res.json(upcomingCompetitions); } catch (error) { console.error('Get upcoming competitions error:', error); res.status(500).json({ error: 'Failed to fetch upcoming competitions' }); }
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
            captainGolferId: sel.captainGolferId
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

  app.get('/api/golfers', async (req: Request, res: Response) => {
    try { const golfers = await storage.getGolfers(); res.json({ golfers }); } catch (error) { console.error('Get golfers error:', error); res.status(500).json({ error: 'Failed to fetch golfers' }); } // Wrap in { golfers: ... }
  });
  app.get('/api/results/:competitionId', async (req: Request, res: Response) => {
    try { const { competitionId } = req.params; const results = await storage.getResults(parseInt(competitionId)); const resultsWithGolfers = await Promise.all(results.map(async (result) => { const golfer = await storage.getGolferById(result.golferId); return { ...result, golfer: golfer ? { id: golfer.id, name: golfer.name } : undefined }; })); res.json(resultsWithGolfers); } catch (error) { console.error('Get results error:', error); res.status(500).json({ error: 'Failed to fetch results' }); }
  });
  app.get('/api/leaderboard/:competitionId?', async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.competitionId ? parseInt(req.params.competitionId) : undefined;
      const leaderboard = await storage.getLeaderboard(competitionId);
      if (typeof competitionId === 'number' && !isNaN(competitionId)) {
         const tokenUser = req.user as ExtendedUser | undefined;
         const userId = tokenUser?.database_id;
        const enhancedLeaderboard = await Promise.all(leaderboard.map(async (entry) => {
          let selectionRecord: Selection | undefined = undefined;
          // Fetch selections for the specific user in the leaderboard entry
          selectionRecord = await storage.getUserSelections(entry.userId, competitionId);

          if (!selectionRecord) { return { ...entry, selections: [] }; }
          const golfer1 = await storage.getGolferById(selectionRecord.golfer1Id);
          const golfer2 = await storage.getGolferById(selectionRecord.golfer2Id);
          const golfer3 = await storage.getGolferById(selectionRecord.golfer3Id);
          const results = await storage.getResults(competitionId);
          const selections = [
            { playerId: selectionRecord.golfer1Id, playerName: golfer1?.name || 'Unknown', position: results.find(r => r.golferId === selectionRecord.golfer1Id)?.position },
            { playerId: selectionRecord.golfer2Id, playerName: golfer2?.name || 'Unknown', position: results.find(r => r.golferId === selectionRecord.golfer2Id)?.position },
            { playerId: selectionRecord.golfer3Id, playerName: golfer3?.name || 'Unknown', position: results.find(r => r.golferId === selectionRecord.golfer3Id)?.position }
          ];
          return { ...entry, selections };
        }));
        res.json(enhancedLeaderboard);
      } else { res.json(leaderboard); }
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
      const userId = user.id; const activeCompetitions = await storage.getActiveCompetitions(); const upcomingCompetitions = await storage.getUpcomingCompetitions(); let nextDeadline = ""; if (upcomingCompetitions.length > 0) { upcomingCompetitions.sort((a, b) => new Date(a.selectionDeadline).getTime() - new Date(b.selectionDeadline).getTime()); nextDeadline = upcomingCompetitions[0].selectionDeadline; }
      const leaderboardQuery = `SELECT SUM(points) as total_points, ROW_NUMBER() OVER (ORDER BY SUM(points) DESC) as rank FROM user_points WHERE "userId" = $1 GROUP BY "userId"`;
      const leaderboardResult = await pgClient.query(leaderboardQuery, [userId]); const totalPoints = leaderboardResult.rows.length > 0 ? parseInt(leaderboardResult.rows[0].total_points) || 0 : 0; const currentRank = leaderboardResult.rows.length > 0 ? leaderboardResult.rows[0].rank : 'N/A';
      res.json({ activeCompetitions: activeCompetitions.length, nextDeadline, totalPoints, currentRank });
    } catch (error) { console.error('Dashboard stats error:', error); res.status(500).json({ error: 'Failed to fetch dashboard stats' }); }
  });

  // --- PROTECTED ROUTES --- (Apply validateJWT middleware individually)

  // User profile routes
  app.get('/api/users/:id', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const tokenUser = req.user as ExtendedUser; const requestedUserId = parseInt(id); if (tokenUser.database_id !== requestedUserId && !tokenUser.isAdmin) { return res.status(403).json({ error: 'Unauthorized to access this resource' }); } const user = await storage.getUser(requestedUserId); if (!user) { return res.status(404).json({ error: 'User not found' }); } const { password, ...userData } = user; res.json(userData); } catch (error) { console.error('Get user error:', error); res.status(500).json({ error: 'Failed to fetch user' }); }
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
  // Updated route to return enriched selection details for the dashboard
  app.get('/api/selections/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try {
      const competitionId = parseInt(req.params.competitionId);
      const tokenUser = req.user as ExtendedUser;
      const userId = tokenUser.database_id!;

      if (isNaN(competitionId)) {
        return res.status(400).json({ error: 'Invalid competition ID' });
      }

      // 1. Fetch the base selection record
      const selectionRecord = await storage.getUserSelections(userId, competitionId);

      if (!selectionRecord) {
        return res.json(null); // No selection found for this user/competition
      }

      // 2. Fetch details for all selected golfers concurrently
      const golferIds = [selectionRecord.golfer1Id, selectionRecord.golfer2Id, selectionRecord.golfer3Id];
      const golferPromises = golferIds.map(id => storage.getGolferById(id));
      const golfers = await Promise.all(golferPromises);

      // 3. Fetch results for the competition to get points and positions
      const results = await storage.getResults(competitionId);
      const resultsMap = new Map<number, Result>();
      results.forEach(r => resultsMap.set(r.golferId, r));

      // 4. Fetch rank at deadline for each golfer concurrently
      const rankPromises = golferIds.map(id => storage.getSelectionRank(userId, competitionId, id));
      const ranks = await Promise.all(rankPromises);
      const rankMap = new Map<number, number | undefined>();
      ranks.forEach((rankRecord, index) => {
        rankMap.set(golferIds[index], rankRecord?.rankAtDeadline);
      });

      // 5. Construct the response array
      const enrichedSelections = await Promise.all(golfers.map(async (golfer, index) => { // Make map async
        if (!golfer) {
          // Handle case where a golfer might not be found (though unlikely if selection exists)
          return null;
        }
        const golferId = golfer.id;
        const result = resultsMap.get(golferId);
        const isCaptain = selectionRecord.useCaptainsChip && selectionRecord.captainGolferId === golferId;

        // Fetch rank at deadline for wildcard check
        const rankAtDeadline = rankMap.get(golferId);
        const isWildcard = rankAtDeadline !== undefined && rankAtDeadline >= 51;

        return {
          id: selectionRecord.id, // Include selection ID if needed, though maybe not necessary per golfer
          golfer: {
            id: golfer.id,
            name: golfer.name,
            avatar: golfer.avatarUrl,
            rank: golfer.rank || 'N/A' // Include current rank (from golfer table)
          },
          position: result?.position || 'N/A',
          points: result?.points || 0,
          isCaptain: isCaptain,
          isWildcard: isWildcard // Use rank-based wildcard logic
        };
      }));

      const validSelections = enrichedSelections.filter(selection => selection !== null); // Filter out any null entries

      res.json(validSelections);

    } catch (error) {
      console.error('Get selections error:', error);
      res.status(500).json({ error: 'Failed to fetch selections' });
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
    try { const competitions = await storage.getCompetitions(); res.json(competitions); } catch (error) { console.error('Admin get competitions error:', error); res.status(500).json({ error: 'Failed to fetch competitions' }); }
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
  app.get('/api/admin/users', validateJWT, async (req: Request, res: Response) => {
    try { const users = await storage.getAllUsers(); const sanitizedUsers = users.map(user => { const { password, ...userData } = user; return userData; }); res.json(sanitizedUsers); } catch (error) { console.error('Admin get users error:', error); res.status(500).json({ error: 'Failed to fetch users' }); }
  });
  app.get('/api/admin/point-system', validateJWT, async (req: Request, res: Response) => {
    try { const pointSystem = await storage.getPointSystem(); res.json(pointSystem); } catch (error) { console.error('Admin get point system error:', error); res.status(500).json({ error: 'Failed to fetch point system' }); }
  });
  app.patch('/api/admin/point-system/:position', validateJWT, async (req: Request, res: Response) => {
    try { const { position } = req.params; const { points } = req.body; if (typeof points !== 'number') { return res.status(400).json({ error: 'Points must be a number' }); } const updatedPointSystem = await storage.updatePointSystem(parseInt(position), points); res.json(updatedPointSystem); } catch (error) { console.error('Admin update point system error:', error); res.status(500).json({ error: 'Failed to update point system' }); }
  });
  app.get('/api/admin/tournament-results/:competitionId', validateJWT, async (req: Request, res: Response) => {
    try { const { competitionId } = req.params; const results = await storage.getResults(parseInt(competitionId)); const resultsWithGolfers = await Promise.all(results.map(async (result) => { const golfer = await storage.getGolferById(result.golferId); return { ...result, golfer: golfer ? { id: golfer.id, name: golfer.name } : undefined }; })); res.json(resultsWithGolfers); } catch (error) { console.error('Admin get tournament results error:', error); res.status(500).json({ error: 'Failed to fetch tournament results' }); }
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
  app.patch('/api/admin/selections/:id', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const selectionId = parseInt(id); const existingSelection = await storage.getSelectionById(selectionId); if (!existingSelection) { return res.status(404).json({ error: 'Selection not found' }); } if (req.body.useCaptainsChip !== undefined && req.body.useCaptainsChip !== existingSelection.useCaptainsChip) { if (req.body.useCaptainsChip) { const hasUsedCaptainsChip = await storage.hasUsedCaptainsChip(existingSelection.userId); if (hasUsedCaptainsChip) { const selections = await storage.getAllSelections(existingSelection.competitionId); const userSelectionWithChip = selections.find(s => s.userId === existingSelection.userId && s.useCaptainsChip && s.id !== selectionId); if (userSelectionWithChip) { return res.status(400).json({ error: 'This user has already used their captain\'s chip in another competition' }); } } } } const updatedSelection = await storage.updateSelection(selectionId, req.body); const user = await storage.getUser(updatedSelection.userId); const golfer1 = await storage.getGolferById(updatedSelection.golfer1Id); const golfer2 = await storage.getGolferById(updatedSelection.golfer2Id); const golfer3 = await storage.getGolferById(updatedSelection.golfer3Id); res.json({ ...updatedSelection, user: user ? { id: user.id, username: user.username, email: user.email } : undefined, golfer1: golfer1 ? { id: golfer1.id, name: golfer1.name } : undefined, golfer2: golfer2 ? { id: golfer2.id, name: golfer2.name } : undefined, golfer3: golfer3 ? { id: golfer3.id, name: golfer3.name } : undefined }); } catch (error) { console.error('Admin update selection error:', error); res.status(500).json({ error: 'Failed to update selection' }); }
  });
  app.delete('/api/admin/selections/:id', validateJWT, async (req: Request, res: Response) => {
    try { const { id } = req.params; const selectionId = parseInt(id); await storage.deleteSelection(selectionId); res.json({ success: true }); } catch (error) { console.error('Admin delete selection error:', error); res.status(500).json({ error: 'Failed to delete selection' }); }
  });
  app.post('/api/admin/update-results', validateJWT, async (req: Request, res: Response) => {
    try {
      // Extract competitionId from request body
      const { competitionId } = req.body;

      // Validate competitionId (optional but recommended)
      if (typeof competitionId !== 'number') {
        return res.status(400).json({ error: 'Invalid or missing competitionId' });
      }

      // Use statically imported function
      // Pass the imported pool and the specific competitionId to the function
      await updateResultsAndAllocatePoints(pool, competitionId); // Pass pool and competitionId
      res.json({ success: true, message: `Update triggered for competition ${competitionId}` });
    } catch (error) {
      console.error(`Admin update results error for competition ${req.body?.competitionId}:`, error); // Log with ID
      res.status(500).json({ error: 'Failed to update results' });
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
        res.json({ success: true, message: `Successfully captured/updated ${result.count} selection ranks.`, errors: result.errors });
      } else {
        // Even if some errors occurred, report partial success if count > 0
        res.status(500).json({ success: false, message: `Rank capture process completed with ${result.errors} errors. ${result.count} ranks captured.`, errors: result.errors, count: result.count });
      }
    } catch (error) {
      console.error(`Error capturing selection ranks for competition ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to capture selection ranks' });
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

      process.on('close', (code) => {
        console.log(`[Golfer Update Script] exited with code ${code}`);
        if (code === 0) {
          // Attempt to parse count/errors from output (simple example)
          const countMatch = scriptOutput.match(/Inserted (\d+) golfers/);
          const count = countMatch ? parseInt(countMatch[1], 10) : 'N/A';
          res.json({ success: true, message: `Golfer update script finished.`, count: count, errors: 0 }); // Assume 0 errors on success code for now
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


  // Return a new server but don't start it
  // This will be started in index.ts
  const server = new Server(app);
  return server;
}
