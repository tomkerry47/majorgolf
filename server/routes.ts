import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { storage } from './storage';
import {
  loginSchema,
  registerSchema,
  selectionFormSchema,
  insertResultSchema,
  insertCompetitionSchema,
  holeInOneFormSchema
} from '@shared/schema';
import { generateToken, verifyToken, comparePassword } from './db';
import { ZodError } from 'zod';
import { pgClient } from './db';

// Extended user interface including JWT properties
interface ExtendedUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  database_id?: number;
  isAdmin?: boolean;
}

// Middleware to validate JWT
const validateJWT = async (req: Request, res: Response, next: NextFunction) => {
  // Get the normalized path without the /api prefix
  const path = req.path.replace(/^\/api/, '');
  const method = req.method;
  const route = `${path} ${method}`;
  console.log(`Validating auth for: ${route}`);
  
  try {
    // Skip validation for public routes
    if (
      route === '/auth/login POST' ||
      route === '/auth/register POST' ||
      route === '/competitions GET' ||
      route === '/competitions/all GET' ||
      route === '/competitions/active GET' ||
      route === '/competitions/upcoming GET' ||
      route === '/golfers GET' ||
      route === '/leaderboard GET' ||
      route === '/leaderboard/:competitionId GET' ||
      route === '/test-leaderboard GET' ||
      route === '/dashboard/stats GET' ||
      // Match dynamic routes better
      (path.match(/^\/leaderboard\/\d+$/) && method === 'GET') ||
      (path.match(/^\/competitions\/\d+$/) && method === 'GET')
    ) {
      console.log('Public route detected, skipping auth');
      return next();
    }
    
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
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify token
    const decodedToken = verifyToken(token) as any;
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.log(`Valid token for user: ${decodedToken.email}`);
    
    // Check if user exists in database
    const user = await storage.getUserByEmail(decodedToken.email);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    console.log(`User found in database: ${user.username}`);
    
    // Set user context in request
    (req as any).user = {
      id: decodedToken.id,
      email: decodedToken.email,
      database_id: user.id,
      isAdmin: user.isAdmin
    };
    
    // Check admin routes
    if (req.path.startsWith('/api/admin') && !user.isAdmin) {
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
  // Health check
  app.get('/api/test-leaderboard', async (req: Request, res: Response) => {
    try {
      res.json([
        {
          rank: 1,
          userId: 1,
          username: "golfer1",
          email: "golfer1@example.com",
          points: 40,
          selections: [
            { playerName: "Tiger Woods", position: 1 },
            { playerName: "Rory McIlroy", position: 5 },
            { playerName: "Jordan Spieth", position: 10 }
          ]
        },
        {
          rank: 2,
          userId: 2,
          username: "golfer2",
          email: "golfer2@example.com",
          points: 30,
          selections: [
            { playerName: "Scottie Scheffler", position: 2 },
            { playerName: "Justin Thomas", position: 7 },
            { playerName: "Brooks Koepka", position: 15 }
          ]
        }
      ]);
    } catch (error) {
      console.error('Error in test leaderboard:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Authentication
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const data = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }
      
      // Create user in database
      const newUser = await storage.createUser({
        email: data.email,
        username: data.username,
        fullName: data.fullName || data.username,
        password: data.password,
        isAdmin: false
      });
      
      // Generate token
      const token = generateToken(newUser.id, newUser.email, newUser.isAdmin);
      
      // Set cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Return user data and token
      res.status(201).json({
        user: {
          id: newUser.id.toString(),
          email: newUser.email,
          username: newUser.username,
          avatarUrl: newUser.avatarUrl,
          isAdmin: newUser.isAdmin
        },
        token
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      console.log('Login attempt received:', req.body.email);
      // Validate request body
      const { email, password } = loginSchema.parse(req.body);
      console.log('Login validation passed for:', email);
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log('User not found for email:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      console.log('Found user:', { id: user.id, email: user.email, username: user.username });
      
      // Verify password
      if (!user.password) {
        console.log('User has no password set:', user.id);
        return res.status(401).json({ error: 'Password not set' });
      }
      
      console.log('Comparing passwords...');
      const isPasswordValid = await comparePassword(password, user.password);
      
      if (!isPasswordValid) {
        console.log('Password validation failed for user:', user.id);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      console.log('Password validation successful for user:', user.id);
      
      // Generate token
      const token = generateToken(user.id, user.email, user.isAdmin);
      console.log('JWT token generated for user:', user.id);
      
      // Set cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      console.log('Auth cookie set');
      
      // Return user data and token
      const responseData = {
        user: {
          id: user.id.toString(),
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
          isAdmin: user.isAdmin
        },
        token
      };
      console.log('Login successful for user:', user.email);
      res.json(responseData);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Login validation error:', error.errors);
        return res.status(400).json({ error: error.errors });
      }
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    // Clear auth cookie
    res.clearCookie('authToken');
    res.json({ success: true });
  });

  // Competitions without auth
  app.get('/api/competitions', async (req: Request, res: Response) => {
    try {
      const competitions = await storage.getCompetitions();
      res.json(competitions);
    } catch (error) {
      console.error('Get competitions error:', error);
      res.status(500).json({ error: 'Failed to fetch competitions' });
    }
  });

  app.get('/api/competitions/all', async (req: Request, res: Response) => {
    try {
      const competitions = await storage.getCompetitions();
      res.json(competitions);
    } catch (error) {
      console.error('Get all competitions error:', error);
      res.status(500).json({ error: 'Failed to fetch competitions' });
    }
  });

  app.get('/api/competitions/active', async (req: Request, res: Response) => {
    try {
      const activeCompetitions = await storage.getActiveCompetitions();
      res.json(activeCompetitions);
    } catch (error) {
      console.error('Get active competitions error:', error);
      res.status(500).json({ error: 'Failed to fetch active competitions' });
    }
  });

  app.get('/api/competitions/upcoming', async (req: Request, res: Response) => {
    try {
      const upcomingCompetitions = await storage.getUpcomingCompetitions();
      res.json(upcomingCompetitions);
    } catch (error) {
      console.error('Get upcoming competitions error:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming competitions' });
    }
  });

  app.get('/api/competitions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const competition = await storage.getCompetitionById(parseInt(id));
      
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      
      res.json(competition);
    } catch (error) {
      console.error('Get competition error:', error);
      res.status(500).json({ error: 'Failed to fetch competition' });
    }
  });

  app.get('/api/golfers', async (req: Request, res: Response) => {
    try {
      const golfers = await storage.getGolfers();
      res.json(golfers);
    } catch (error) {
      console.error('Get golfers error:', error);
      res.status(500).json({ error: 'Failed to fetch golfers' });
    }
  });

  app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
    try {
      // This is a special case where we need to detect if a user is logged in
      // If not, we'll return empty statistics
      const authHeader = req.headers.authorization;
      let token = '';
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
      }
      
      // If no token, return default stats
      if (!token) {
        return res.json({
          activeCompetitions: 0,
          nextDeadline: "",
          totalPoints: 0,
          currentRank: 'N/A'
        });
      }
      
      // Try to verify token
      const decodedToken = verifyToken(token) as any;
      if (!decodedToken) {
        return res.json({
          activeCompetitions: 0,
          nextDeadline: "",
          totalPoints: 0,
          currentRank: 'N/A'
        });
      }
      
      // Find user
      const user = await storage.getUserByEmail(decodedToken.email);
      if (!user) {
        return res.json({
          activeCompetitions: 0,
          nextDeadline: "",
          totalPoints: 0,
          currentRank: 'N/A'
        });
      }
      
      console.time('dashboard-stats');
      const userId = user.id;
      
      // Get active competitions
      const activeCompetitions = await storage.getActiveCompetitions();
      
      // Get upcoming competitions
      const upcomingCompetitions = await storage.getUpcomingCompetitions();
      
      // Get next competition deadline
      let nextDeadline = "";
      if (upcomingCompetitions.length > 0) {
        upcomingCompetitions.sort((a, b) => 
          new Date(a.selectionDeadline).getTime() - new Date(b.selectionDeadline).getTime()
        );
        nextDeadline = upcomingCompetitions[0].selectionDeadline;
      }
      
      // Get user's total points
      const leaderboardQuery = `
        SELECT 
          SUM(points) as total_points,
          ROW_NUMBER() OVER (ORDER BY SUM(points) DESC) as rank
        FROM 
          user_points
        WHERE 
          "userId" = $1
        GROUP BY 
          "userId"
      `;
      
      const leaderboardResult = await pgClient.query(leaderboardQuery, [userId]);
      const totalPoints = leaderboardResult.rows.length > 0 ? 
        parseInt(leaderboardResult.rows[0].total_points) || 0 : 0;
      const currentRank = leaderboardResult.rows.length > 0 ? 
        leaderboardResult.rows[0].rank : 'N/A';
      
      console.timeEnd('dashboard-stats');
      
      res.json({
        activeCompetitions: activeCompetitions.length,
        nextDeadline,
        totalPoints,
        currentRank
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // Apply JWT validation middleware for protected routes
  app.use('/api', validateJWT);

  // Protected routes below this line

  // User profile
  app.get('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(parseInt(id));
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Don't send password in response
      const { password, ...userData } = user;
      res.json(userData);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });
  
  app.get('/api/users/:id/has-used-captains-chip', validateJWT, async (req: Request, res: Response) => {
    try {
      const tokenUser = req.user as ExtendedUser;
      const requestedUserId = parseInt(req.params.id);
      
      // Only allow users to check their own status or admins to check any user
      if (tokenUser.database_id !== requestedUserId && !tokenUser.isAdmin) {
        return res.status(403).json({ error: 'Unauthorized to access this resource' });
      }
      
      const hasUsed = await storage.hasUsedCaptainsChip(requestedUserId);
      res.json({ hasUsedCaptainsChip: hasUsed });
    } catch (error) {
      console.error('Error checking captain\'s chip usage:', error);
      res.status(500).json({ error: 'Failed to check captain\'s chip usage' });
    }
  });

  app.patch('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      const requestUserId = (req as any).user.database_id;
      
      // Only allow users to update their own profile, unless admin
      if (userId !== requestUserId && !(req as any).user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized to update this user' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update user
      const updatedUser = await storage.updateUser(userId, req.body);
      
      // Don't send password in response
      const { password, ...userData } = updatedUser;
      res.json(userData);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Protected competition endpoints

  app.post('/api/competitions', async (req: Request, res: Response) => {
    try {
      // Only admins can create competitions
      if (!(req as any).user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const competitionData = insertCompetitionSchema.parse(req.body);
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

  // Golfers
  app.get('/api/golfers', async (req: Request, res: Response) => {
    try {
      const golfers = await storage.getGolfers();
      res.json(golfers);
    } catch (error) {
      console.error('Get golfers error:', error);
      res.status(500).json({ error: 'Failed to fetch golfers' });
    }
  });

  app.post('/api/golfers', async (req: Request, res: Response) => {
    try {
      // Only admins can create golfers
      if (!(req as any).user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const newGolfer = await storage.createGolfer(req.body);
      res.status(201).json(newGolfer);
    } catch (error) {
      console.error('Create golfer error:', error);
      res.status(500).json({ error: 'Failed to create golfer' });
    }
  });

  // Selections
  app.get('/api/selections/:competitionId', async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const userId = (req as any).user.database_id;
      
      const selection = await storage.getUserSelections(userId, parseInt(competitionId));
      res.json(selection || null);
    } catch (error) {
      console.error('Get selections error:', error);
      res.status(500).json({ error: 'Failed to fetch selections' });
    }
  });

  app.post('/api/selections', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.database_id;
      
      // Validate the selection
      const selectionData = selectionFormSchema.parse(req.body);
      
      // Check if competition exists and is accepting selections
      const competition = await storage.getCompetitionById(selectionData.competitionId);
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      
      // Check if the selection deadline has passed
      const deadlineDate = new Date(competition.selectionDeadline);
      const currentDate = new Date();
      if (currentDate > deadlineDate) {
        return res.status(400).json({ error: 'Selection deadline has passed' });
      }
      
      // Check if user already has selections for this competition
      const existingSelection = await storage.getUserSelections(userId, selectionData.competitionId);
      if (existingSelection) {
        return res.status(400).json({ error: 'You already have selections for this competition' });
      }
      
      // Check if the user is using a captain's chip and if they've already used it in another competition
      if (selectionData.useCaptainsChip) {
        const hasUsedCaptainsChip = await storage.hasUsedCaptainsChip(userId);
        if (hasUsedCaptainsChip) {
          return res.status(400).json({ error: 'You have already used your captain\'s chip in another competition' });
        }
      }
      
      // Create the selection
      const newSelection = await storage.createSelection({
        ...selectionData,
        userId
      });
      
      res.status(201).json(newSelection);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Create selection error:', error);
      res.status(500).json({ error: 'Failed to create selection' });
    }
  });

  app.patch('/api/selections/:competitionId', async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const userId = (req as any).user.database_id;
      
      // Validate the selection
      const selectionData = selectionFormSchema.parse(req.body);
      
      // Check if competition exists and is accepting selections
      const competition = await storage.getCompetitionById(parseInt(competitionId));
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      
      // Check if the selection deadline has passed
      const deadlineDate = new Date(competition.selectionDeadline);
      const currentDate = new Date();
      if (currentDate > deadlineDate) {
        return res.status(400).json({ error: 'Selection deadline has passed' });
      }
      
      // Get user's existing selection
      const existingSelection = await storage.getUserSelections(userId, parseInt(competitionId));
      if (!existingSelection) {
        return res.status(404).json({ error: 'No existing selection found' });
      }
      
      // Handle captain's chip changes
      if (selectionData.useCaptainsChip && !existingSelection.useCaptainsChip) {
        // User is trying to use the captain's chip
        const hasUsedCaptainsChip = await storage.hasUsedCaptainsChip(userId);
        if (hasUsedCaptainsChip) {
          return res.status(400).json({ error: 'You have already used your captain\'s chip in another competition' });
        }
      }
      
      // Update the selection
      const updatedSelection = await storage.updateSelection(existingSelection.id, {
        golfer1Id: selectionData.golfer1Id,
        golfer2Id: selectionData.golfer2Id,
        golfer3Id: selectionData.golfer3Id,
        useCaptainsChip: selectionData.useCaptainsChip
      });
      
      res.json(updatedSelection);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Update selection error:', error);
      res.status(500).json({ error: 'Failed to update selection' });
    }
  });

  // Results
  app.get('/api/results/:competitionId', async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const results = await storage.getResults(parseInt(competitionId));
      
      // Get golfer details for each result
      const resultsWithGolfers = await Promise.all(results.map(async (result) => {
        const golfer = await storage.getGolferById(result.golferId);
        return {
          ...result,
          golfer: golfer ? { id: golfer.id, name: golfer.name } : undefined
        };
      }));
      
      res.json(resultsWithGolfers);
    } catch (error) {
      console.error('Get results error:', error);
      res.status(500).json({ error: 'Failed to fetch results' });
    }
  });

  app.post('/api/results', async (req: Request, res: Response) => {
    try {
      // Only admins can create results
      if (!(req as any).user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const resultData = insertResultSchema.parse(req.body);
      const newResult = await storage.createResult(resultData);
      res.status(201).json(newResult);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Create result error:', error);
      res.status(500).json({ error: 'Failed to create result' });
    }
  });

  // Leaderboard
  app.get('/api/leaderboard/:competitionId?', async (req: Request, res: Response) => {
    try {
      console.log(`Leaderboard request for competitionId: ${req.params.competitionId}`);
      const competitionId = req.params.competitionId ? parseInt(req.params.competitionId) : undefined;
      
      // Get leaderboard
      const leaderboard = await storage.getLeaderboard(competitionId);
      
      if (competitionId) {
        // For competition-specific leaderboard, include selection details
        const enhancedLeaderboard = await Promise.all(
          leaderboard.map(async (entry) => {
            // Get user's selections for this competition
            const selectionRecord = await storage.getUserSelections(entry.userId, competitionId);
            
            if (!selectionRecord) {
              return {
                ...entry,
                selections: []
              };
            }
            
            // Get details for each selected golfer
            const golfer1 = await storage.getGolferById(selectionRecord.golfer1Id);
            const golfer2 = await storage.getGolferById(selectionRecord.golfer2Id);
            const golfer3 = await storage.getGolferById(selectionRecord.golfer3Id);
            
            // Get results for each golfer
            const results = await storage.getResults(competitionId);
            
            const selections = [
              {
                playerId: selectionRecord.golfer1Id,
                playerName: golfer1?.name || 'Unknown',
                position: results.find(r => r.golferId === selectionRecord.golfer1Id)?.position
              },
              {
                playerId: selectionRecord.golfer2Id,
                playerName: golfer2?.name || 'Unknown',
                position: results.find(r => r.golferId === selectionRecord.golfer2Id)?.position
              },
              {
                playerId: selectionRecord.golfer3Id,
                playerName: golfer3?.name || 'Unknown',
                position: results.find(r => r.golferId === selectionRecord.golfer3Id)?.position
              }
            ];
            
            return {
              ...entry,
              selections
            };
          })
        );
        
        res.json(enhancedLeaderboard);
      } else {
        // For overall leaderboard, don't include selection details
        res.json(leaderboard);
      }
    } catch (error) {
      console.error('Leaderboard error:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  async function getLeaderboardManually(competitionId: string | number): Promise<any[]> {
    // Get user points for the competition
    const userPointsQuery = `
      SELECT 
        up."userId",
        u.username,
        u.email,
        u.avatar_url as "avatarUrl",
        up.points,
        up.details,
        ROW_NUMBER() OVER (ORDER BY up.points DESC) as rank
      FROM 
        user_points up
      JOIN 
        users u ON up."userId" = u.id
      WHERE 
        up."competitionId" = $1
      ORDER BY 
        up.points DESC
    `;
    
    const userPointsResult = await pgClient.query(userPointsQuery, [competitionId]);
    
    return userPointsResult.rows.map(row => ({
      rank: parseInt(row.rank),
      userId: row.userId,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatarUrl,
      points: row.points,
      pointsDetails: row.details ? JSON.parse(row.details) : []
    }));
  }

  // Admin endpoints
  app.get('/api/admin/competitions', async (req: Request, res: Response) => {
    try {
      const competitions = await storage.getCompetitions();
      res.json(competitions);
    } catch (error) {
      console.error('Admin get competitions error:', error);
      res.status(500).json({ error: 'Failed to fetch competitions' });
    }
  });

  app.patch('/api/admin/competitions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const competitionId = parseInt(id);
      
      const updatedCompetition = await storage.updateCompetition(competitionId, req.body);
      res.json(updatedCompetition);
    } catch (error) {
      console.error('Admin update competition error:', error);
      res.status(500).json({ error: 'Failed to update competition' });
    }
  });

  app.get('/api/admin/users', async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      
      // Remove passwords from response
      const sanitizedUsers = users.map(user => {
        const { password, ...userData } = user;
        return userData;
      });
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Admin get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/point-system', async (req: Request, res: Response) => {
    try {
      const pointSystem = await storage.getPointSystem();
      res.json(pointSystem);
    } catch (error) {
      console.error('Admin get point system error:', error);
      res.status(500).json({ error: 'Failed to fetch point system' });
    }
  });

  app.patch('/api/admin/point-system/:position', async (req: Request, res: Response) => {
    try {
      const { position } = req.params;
      const { points } = req.body;
      
      if (typeof points !== 'number') {
        return res.status(400).json({ error: 'Points must be a number' });
      }
      
      const updatedPointSystem = await storage.updatePointSystem(parseInt(position), points);
      res.json(updatedPointSystem);
    } catch (error) {
      console.error('Admin update point system error:', error);
      res.status(500).json({ error: 'Failed to update point system' });
    }
  });

  app.get('/api/admin/tournament-results/:competitionId', async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      
      // Get all results for the competition
      const results = await storage.getResults(parseInt(competitionId));
      
      // Get golfer details for each result
      const resultsWithGolfers = await Promise.all(results.map(async (result) => {
        const golfer = await storage.getGolferById(result.golferId);
        return {
          ...result,
          golfer: golfer ? { id: golfer.id, name: golfer.name } : undefined
        };
      }));
      
      res.json(resultsWithGolfers);
    } catch (error) {
      console.error('Admin get tournament results error:', error);
      res.status(500).json({ error: 'Failed to fetch tournament results' });
    }
  });

  app.post('/api/admin/tournament-results', async (req: Request, res: Response) => {
    try {
      const resultData = insertResultSchema.parse(req.body);
      
      // Check if result already exists for this golfer and competition
      const existingResults = await storage.getResults(resultData.competitionId);
      const existingResult = existingResults.find(r => r.golferId === resultData.golferId);
      
      if (existingResult) {
        return res.status(400).json({ error: 'Result already exists for this golfer in this competition' });
      }
      
      // Create the result
      const newResult = await storage.createResult(resultData);
      
      // Get golfer details
      const golfer = await storage.getGolferById(resultData.golferId);
      
      res.status(201).json({
        ...newResult,
        golfer: golfer ? { id: golfer.id, name: golfer.name } : undefined
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Admin create tournament result error:', error);
      res.status(500).json({ error: 'Failed to create tournament result' });
    }
  });

  app.patch('/api/admin/tournament-results/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const resultId = parseInt(id);
      
      // Get existing result
      const existingResult = await storage.getResultById(resultId);
      if (!existingResult) {
        return res.status(404).json({ error: 'Result not found' });
      }
      
      // Update the result
      const updatedResult = await storage.updateResult(resultId, req.body);
      
      // Get golfer details
      const golfer = await storage.getGolferById(updatedResult.golferId);
      
      res.json({
        ...updatedResult,
        golfer: golfer ? { id: golfer.id, name: golfer.name } : undefined
      });
    } catch (error) {
      console.error('Admin update tournament result error:', error);
      res.status(500).json({ error: 'Failed to update tournament result' });
    }
  });

  app.delete('/api/admin/tournament-results/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const resultId = parseInt(id);
      
      // Delete the result
      await storage.deleteResult(resultId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Admin delete tournament result error:', error);
      res.status(500).json({ error: 'Failed to delete tournament result' });
    }
  });

  app.post('/api/admin/complete-tournament/:competitionId', async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      
      // Validate the competition exists
      const competition = await storage.getCompetitionById(parseInt(competitionId));
      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }
      
      // Use the allocation script to calculate points
      try {
        const { updateResultsAndAllocatePoints } = await import('../scripts/update_results_and_allocate_points.js');
        await updateResultsAndAllocatePoints(parseInt(competitionId));
      } catch (error) {
        console.error('Error running points allocation:', error);
        return res.status(500).json({ error: 'Failed to allocate points' });
      }
      
      // Update the competition to mark as complete
      const updatedCompetition = await storage.updateCompetition(parseInt(competitionId), {
        isComplete: true,
        isActive: false
      });
      
      res.json({ success: true, competition: updatedCompetition });
    } catch (error) {
      console.error('Admin complete tournament error:', error);
      res.status(500).json({ error: 'Failed to complete tournament' });
    }
  });

  app.get('/api/admin/competitions/:id/selections', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const competitionId = parseInt(id);
      
      // Get all selections for the competition
      const selectionRows = await storage.getAllSelections(competitionId);
      
      // For each selection, get the user and golfer details
      const selectionsWithDetails = await Promise.all(selectionRows.map(async (selection) => {
        // Get user data
        const user = await storage.getUser(selection.userId);
        
        // Get golfer data
        const golfer1 = await storage.getGolferById(selection.golfer1Id);
        const golfer2 = await storage.getGolferById(selection.golfer2Id);
        const golfer3 = await storage.getGolferById(selection.golfer3Id);
        
        return {
          ...selection,
          user: user ? {
            id: user.id,
            username: user.username,
            email: user.email
          } : undefined,
          golfer1: golfer1 ? {
            id: golfer1.id,
            name: golfer1.name
          } : undefined,
          golfer2: golfer2 ? {
            id: golfer2.id,
            name: golfer2.name
          } : undefined,
          golfer3: golfer3 ? {
            id: golfer3.id,
            name: golfer3.name
          } : undefined
        };
      }));
      
      res.json(selectionsWithDetails);
    } catch (error) {
      console.error('Admin get competition selections error:', error);
      res.status(500).json({ error: 'Failed to fetch competition selections' });
    }
  });

  app.patch('/api/admin/selections/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const selectionId = parseInt(id);
      
      // Get the existing selection to check for captains chip changes
      const existingSelection = await storage.getSelectionById(selectionId);
      if (!existingSelection) {
        return res.status(404).json({ error: 'Selection not found' });
      }
      
      // If they're trying to change the captains chip
      if (req.body.useCaptainsChip !== undefined && 
          req.body.useCaptainsChip !== existingSelection.useCaptainsChip) {
        
        // If trying to enable it, check if it's already been used elsewhere
        if (req.body.useCaptainsChip) {
          const hasUsedCaptainsChip = await storage.hasUsedCaptainsChip(existingSelection.userId);
          if (hasUsedCaptainsChip) {
            // Only allow if it's the same user's selection that already had it enabled
            const selections = await storage.getAllSelections(existingSelection.competitionId);
            const userSelectionWithChip = selections.find(s => 
              s.userId === existingSelection.userId && s.useCaptainsChip && s.id !== selectionId
            );
            
            if (userSelectionWithChip) {
              return res.status(400).json({ 
                error: 'This user has already used their captain\'s chip in another competition' 
              });
            }
          }
        }
      }
      
      // Update the selection
      const updatedSelection = await storage.updateSelection(selectionId, req.body);
      
      // Get user and golfer details
      const user = await storage.getUser(updatedSelection.userId);
      const golfer1 = await storage.getGolferById(updatedSelection.golfer1Id);
      const golfer2 = await storage.getGolferById(updatedSelection.golfer2Id);
      const golfer3 = await storage.getGolferById(updatedSelection.golfer3Id);
      
      res.json({
        ...updatedSelection,
        user: user ? {
          id: user.id,
          username: user.username,
          email: user.email
        } : undefined,
        golfer1: golfer1 ? {
          id: golfer1.id,
          name: golfer1.name
        } : undefined,
        golfer2: golfer2 ? {
          id: golfer2.id,
          name: golfer2.name
        } : undefined,
        golfer3: golfer3 ? {
          id: golfer3.id,
          name: golfer3.name
        } : undefined
      });
    } catch (error) {
      console.error('Admin update selection error:', error);
      res.status(500).json({ error: 'Failed to update selection' });
    }
  });

  app.delete('/api/admin/selections/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const selectionId = parseInt(id);
      
      // Delete the selection
      await storage.deleteSelection(selectionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Admin delete selection error:', error);
      res.status(500).json({ error: 'Failed to delete selection' });
    }
  });

  app.post('/api/admin/update-results', async (req: Request, res: Response) => {
    try {
      // Import the script to update results and allocate points
      const { updateResultsAndAllocatePoints } = await import('../scripts/update_results_and_allocate_points.js');
      
      // Run the function
      await updateResultsAndAllocatePoints();
      
      res.json({ success: true });
    } catch (error) {
      console.error('Admin update results error:', error);
      res.status(500).json({ error: 'Failed to update results' });
    }
  });

  // Wildcard Golfers API endpoints
  app.get('/api/admin/wildcard-golfers/:competitionId', async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const compId = parseInt(competitionId);
      
      // Get wildcard golfers for the competition
      const wildcardGolfers = await storage.getWildcardGolfers(compId);
      
      res.json(wildcardGolfers);
    } catch (error) {
      console.error('Get wildcard golfers error:', error);
      res.status(500).json({ error: 'Failed to get wildcard golfers' });
    }
  });

  app.post('/api/admin/wildcard-golfers', async (req: Request, res: Response) => {
    try {
      const { competitionId, golferId, isWildcard } = req.body;
      
      if (!competitionId || !golferId) {
        return res.status(400).json({ error: 'Competition ID and Golfer ID are required' });
      }
      
      // Check if the wildcard entry already exists
      const existingWildcard = await storage.getWildcardGolfer(competitionId, golferId);
      
      let wildcardGolfer;
      
      if (existingWildcard) {
        // Update existing wildcard
        wildcardGolfer = await storage.updateWildcardGolfer(existingWildcard.id, {
          isWildcard: isWildcard !== undefined ? isWildcard : true
        });
      } else {
        // Create new wildcard
        wildcardGolfer = await storage.createWildcardGolfer({
          competitionId,
          golferId,
          isWildcard: isWildcard !== undefined ? isWildcard : true
        });
      }
      
      res.status(201).json(wildcardGolfer);
    } catch (error) {
      console.error('Create/update wildcard golfer error:', error);
      res.status(500).json({ error: 'Failed to create/update wildcard golfer' });
    }
  });

  app.delete('/api/admin/wildcard-golfers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const wildcardId = parseInt(id);
      
      // Delete the wildcard
      await storage.deleteWildcardGolfer(wildcardId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete wildcard golfer error:', error);
      res.status(500).json({ error: 'Failed to delete wildcard golfer' });
    }
  });

  // Hole In One endpoints
  app.get('/api/admin/hole-in-ones/:competitionId', async (req: Request, res: Response) => {
    try {
      const competitionId = parseInt(req.params.competitionId);
      const holeInOnes = await storage.getHoleInOnes(competitionId);
      
      // Get golfer details for each hole-in-one
      const golferMap = new Map();
      const golfers = await storage.getGolfers();
      golfers.forEach(golfer => golferMap.set(golfer.id, golfer));
      
      const holeInOnesWithGolferDetails = holeInOnes.map(hio => ({
        ...hio,
        golfer: golferMap.get(hio.golferId)
      }));
      
      res.json(holeInOnesWithGolferDetails);
    } catch (error) {
      console.error('Error fetching hole-in-ones:', error);
      res.status(500).json({ error: 'Failed to fetch hole-in-ones' });
    }
  });
  
  app.post('/api/admin/hole-in-ones', async (req: Request, res: Response) => {
    try {
      const validationResult = holeInOneFormSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid hole-in-one data', 
          details: validationResult.error.format()
        });
      }
      
      const holeInOneData = validationResult.data;
      
      // Add timestamp fields if not provided
      if (!holeInOneData.createdAt) {
        holeInOneData.createdAt = new Date().toISOString();
      }
      if (!holeInOneData.updatedAt) {
        holeInOneData.updatedAt = new Date().toISOString();
      }
      
      const holeInOne = await storage.createHoleInOne(holeInOneData);
      res.status(201).json(holeInOne);
    } catch (error) {
      console.error('Error creating hole-in-one:', error);
      res.status(500).json({ error: 'Failed to create hole-in-one' });
    }
  });
  
  app.patch('/api/admin/hole-in-ones/:id', async (req: Request, res: Response) => {
    try {
      const holeInOneId = parseInt(req.params.id);
      
      // We don't validate the entire object since this is a partial update
      const holeInOneData = req.body;
      
      // Add updated timestamp
      holeInOneData.updatedAt = new Date().toISOString();
      
      const updatedHoleInOne = await storage.updateHoleInOne(holeInOneId, holeInOneData);
      res.json(updatedHoleInOne);
    } catch (error) {
      console.error('Error updating hole-in-one:', error);
      res.status(500).json({ error: 'Failed to update hole-in-one' });
    }
  });
  
  app.delete('/api/admin/hole-in-ones/:id', async (req: Request, res: Response) => {
    try {
      const holeInOneId = parseInt(req.params.id);
      await storage.deleteHoleInOne(holeInOneId);
      res.status(200).json({ message: 'Hole-in-one deleted successfully' });
    } catch (error) {
      console.error('Error deleting hole-in-one:', error);
      res.status(500).json({ error: 'Failed to delete hole-in-one' });
    }
  });
  
  // User-facing API endpoint to see hole-in-ones for a competition
  app.get('/api/competitions/:competitionId/hole-in-ones', async (req: Request, res: Response) => {
    try {
      const competitionId = parseInt(req.params.competitionId);
      const holeInOnes = await storage.getHoleInOnes(competitionId);
      
      // Get golfer details for each hole-in-one
      const golferMap = new Map();
      const golfers = await storage.getGolfers();
      golfers.forEach(golfer => golferMap.set(golfer.id, golfer));
      
      const holeInOnesWithGolferDetails = holeInOnes.map(hio => ({
        ...hio,
        golfer: golferMap.get(hio.golferId)
      }));
      
      res.json(holeInOnesWithGolferDetails);
    } catch (error) {
      console.error('Error fetching hole-in-ones:', error);
      res.status(500).json({ error: 'Failed to fetch hole-in-ones' });
    }
  });

  // Return a new server but don't start it
  // This will be started in index.ts
  const server = new Server(app);
  return server;
}