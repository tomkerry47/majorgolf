import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { supabase } from "../client/src/lib/supabase";
import { z } from "zod";
import { 
  loginSchema, 
  registerSchema, 
  insertCompetitionSchema, 
  insertGolferSchema, 
  insertSelectionSchema, 
  insertResultSchema,
  selectionFormSchema
} from "@shared/schema";

// Middleware to check JWT token from Authorization header
const validateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip authentication for auth endpoints, public routes and the frontend
    if (req.path === '/' || 
        req.path.startsWith('/assets/') ||
        !req.path.startsWith('/api/') || 
        req.path.startsWith('/api/auth/') || 
        req.path.startsWith('/api/competitions/') && req.method === 'GET' ||
        req.path === '/api/competitions' && req.method === 'GET' ||
        req.path === '/api/golfers' && req.method === 'GET' ||
        req.path.startsWith('/api/leaderboard') && req.method === 'GET') {
      return next();
    }
    
    // Check authorization header first
    const authHeader = req.headers.authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        try {
          // Verify token with Supabase
          const { data, error } = await supabase.auth.getUser(token);
          
          if (!error && data.user) {
            user = data.user;
          }
        } catch (tokenError) {
          console.error('Token validation error:', tokenError);
        }
      }
    }
    
    // If no user from auth header, try session
    if (!user) {
      const { data: session } = await supabase.auth.getSession();
      
      if (session && session.session && session.session.user) {
        user = session.session.user;
      }
    }
    
    // If still no user, return unauthorized
    if (!user) {
      console.log('No authenticated user found for:', req.path);
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Check if admin access is required
    const needsAdminAccess = req.path.startsWith('/api/admin/') || 
        (req.method === 'POST' && (
          req.path === '/api/competitions' || 
          req.path === '/api/golfers' || 
          req.path === '/api/results'
        )) ||
        (req.method === 'PATCH' && req.path.startsWith('/api/competitions/')) ||
        (req.method === 'DELETE' && req.path.startsWith('/api/competitions/'));
        
    if (needsAdminAccess) {
      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('isAdmin')
        .eq('id', user.id)
        .single();
        
      if (userError) {
        console.error('User data fetch error:', userError);
        return res.status(401).json({ error: "Error fetching user permissions" });
      }
      
      if (!userData?.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
    }
    
    // Store user info in request for later use
    (req as any).user = {
      id: user.id,
      email: user.email
    };
    
    next();
  } catch (error: any) {
    console.error('JWT validation exception:', error);
    res.status(401).json({ error: error.message || "Authentication error" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Test endpoint to verify our fallback implementation
  app.get('/api/test-leaderboard', async (req: Request, res: Response) => {
    try {
      // First test the RPC function
      let rpcWorking = false;
      try {
        await supabase.rpc('get_leaderboard', { competitionId: 1 });
        rpcWorking = true;
      } catch (e: any) {
        console.log('RPC test failed:', e.message);
      }
      
      // Then test the fallback implementation
      try {
        const fallbackData = await getLeaderboardManually(1);
        res.status(200).json({
          rpcFunctionAvailable: rpcWorking,
          fallbackImplementation: 'working',
          sample: fallbackData.length > 0 ? fallbackData[0] : null,
          message: 'Leaderboard implementation is working correctly. The fallback will be used when the RPC function is unavailable.'
        });
      } catch (e: any) {
        res.status(500).json({
          rpcFunctionAvailable: rpcWorking,
          fallbackImplementation: 'error',
          error: e.message,
          message: 'Fallback implementation error'
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Apply JWT validation middleware
  app.use(validateJWT);
  // Auth Routes
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            username: validatedData.username,
            fullName: validatedData.fullName,
          }
        }
      });
      
      if (error) throw error;
      
      res.status(201).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password
      });
      
      if (error) throw error;
      if (!data.session || !data.user) throw new Error('Failed to create session');

      // Fetch additional user data from the database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError) throw userError;

      res.status(200).json({ 
        session: data.session,
        user: {
          id: data.user.id,
          email: data.user.email,
          username: userData?.username || data.user.email?.split('@')[0],
          fullName: userData?.fullName || '',
          isAdmin: userData?.isAdmin || false
        }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Dashboard stats endpoint
  app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
    try {
      // Get user from request (set by validateJWT middleware) or try to get from session
      let userId;
      
      if ((req as any).user) {
        userId = (req as any).user.id;
      } else {
        // Fallback to session
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        userId = session.session.user.id;
      }
      
      // Get active competitions
      const { data: activeCompetitions, error: activeCompError } = await supabase
        .from('competitions')
        .select('id, name')
        .eq('isActive', true);
        
      if (activeCompError) throw activeCompError;
      
      // Get next competition deadline
      const { data: nextCompetition, error: nextCompError } = await supabase
        .from('competitions')
        .select('selectionDeadline')
        .eq('isComplete', false)
        .order('selectionDeadline', { ascending: true })
        .limit(1)
        .single();
        
      // Get user's total points across all competitions
      const { data: pointsData, error: pointsError } = await supabase.rpc(
        'get_user_total_points',
        { user_id: userId }
      );
      
      // Get user's current rank in active competition
      const { data: rankData, error: rankError } = await supabase.rpc(
        'get_user_rank',
        { user_id: userId }
      );
      
      // Format the next deadline date
      let nextDeadline = 'None';
      if (nextCompetition && nextCompetition.selectionDeadline) {
        const deadlineDate = new Date(nextCompetition.selectionDeadline);
        nextDeadline = deadlineDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      const stats = {
        activeCompetitions: activeCompetitions ? activeCompetitions.length : 0,
        nextDeadline: nextDeadline,
        totalPoints: pointsData || 0,
        currentRank: rankData || 'N/A'
      };
      
      res.status(200).json(stats);
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // User Routes
  app.get('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      
      // Verify user has access to view this profile (self or admin)
      let currentUserId;
      let isAdmin = false;
      
      if ((req as any).user) {
        currentUserId = (req as any).user.id;
        isAdmin = (req as any).user.isAdmin || false;
      } else {
        // Fallback to session
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        
        // Get user data to check if admin
        const { data: currentUser } = await supabase
          .from('users')
          .select('isAdmin')
          .eq('id', session.session.user.id)
          .single();
          
        currentUserId = session.session.user.id;
        isAdmin = currentUser?.isAdmin || false;
      }
      
      // Only allow users to access their own profile or admins to access any profile
      if (userId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get user from database instead of auth.admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      if (!userData) return res.status(404).json({ error: "User not found" });
      
      // Get user statistics
      const { data: stats, error: statsError } = await supabase.rpc('get_user_stats', { userId: userId });
      
      // Get user auth data for additional information
      const { data: authData } = await supabase.auth.getUser(userId);
      
      const enrichedUserData = {
        id: userData.id,
        email: userData.email,
        username: userData.username || userData.email?.split('@')[0],
        fullName: userData.fullName || '',
        avatar: userData.avatarUrl || '',
        stats: stats || {},
        isAdmin: !!userData.isAdmin
      };
      
      console.log('Fetched user data:', { userId, enrichedUserData });
      
      res.status(200).json(enrichedUserData);
    } catch (error: any) {
      console.error('Error in /api/users/:id route:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const updateData = req.body;
      
      // Verify user has access to update this profile (self or admin)
      let currentUserId;
      let isAdmin = false;
      
      if ((req as any).user) {
        currentUserId = (req as any).user.id;
        isAdmin = (req as any).user.isAdmin || false;
      } else {
        // Fallback to session
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        
        // Get user data to check if admin
        const { data: currentUser } = await supabase
          .from('users')
          .select('isAdmin')
          .eq('id', session.session.user.id)
          .single();
          
        currentUserId = session.session.user.id;
        isAdmin = currentUser?.isAdmin || false;
      }
      
      // Only allow users to update their own profile or admins to update any profile
      if (userId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Competition Routes
  app.get('/api/competitions', async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('startDate', { ascending: true });
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Also handle /api/competitions/all as an alias for /api/competitions
  app.get('/api/competitions/all', async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('startDate', { ascending: true });
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/competitions/active', async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('isActive', true)
        .order('startDate', { ascending: true });
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/competitions/upcoming', async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('isActive', false)
        .eq('isComplete', false)
        .order('startDate', { ascending: true });
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/competitions/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/competitions', async (req: Request, res: Response) => {
    try {
      const validatedData = insertCompetitionSchema.parse(req.body);
      
      // Create a new competition object with parsed dates
      const competitionData = {
        ...validatedData,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        selectionDeadline: new Date(validatedData.selectionDeadline)
      };
      
      console.log('Creating competition:', competitionData);
      
      const { data, error } = await supabase
        .from('competitions')
        .insert([competitionData])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating competition:', error);
        throw error;
      }
      
      res.status(201).json(data);
    } catch (error: any) {
      console.error('Error in POST /api/competitions:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Golfer Routes
  app.get('/api/golfers', async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('golfers')
        .select('*')
        .order('rank', { ascending: true });
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/golfers', async (req: Request, res: Response) => {
    try {
      const validatedData = insertGolferSchema.parse(req.body);
      
      const { data, error } = await supabase
        .from('golfers')
        .insert([validatedData])
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(201).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Selection Routes
  app.get('/api/selections/:competitionId', async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.competitionId;
      const userId = req.query.userId;
      
      // Get user from request (set by validateJWT middleware) or try to get from session
      let currentUserId;
      
      if ((req as any).user) {
        currentUserId = (req as any).user.id;
      } else {
        // Fallback to session
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        currentUserId = session.session.user.id;
      }
      
      // Query for user's selections for this competition
      const { data, error } = await supabase
        .from('selections')
        .select(`
          *,
          golfer1:golfers!golfer1Id(id, name),
          golfer2:golfers!golfer2Id(id, name),
          golfer3:golfers!golfer3Id(id, name)
        `)
        .eq('competitionId', competitionId)
        .eq('userId', userId || currentUserId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows returned" error
        throw error;
      }
      
      res.status(200).json(data || null);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/selections', async (req: Request, res: Response) => {
    try {
      const validatedData = selectionFormSchema.parse(req.body);
      
      // Get user from request (set by validateJWT middleware) or try to get from session
      let currentUserId;
      
      if ((req as any).user) {
        currentUserId = (req as any).user.id;
      } else {
        // Fallback to session
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        currentUserId = session.session.user.id;
      }
      
      // Check if selection deadline has passed
      const { data: competition } = await supabase
        .from('competitions')
        .select('selectionDeadline')
        .eq('id', validatedData.competitionId)
        .single();
      
      if (competition && new Date(competition.selectionDeadline) < new Date()) {
        return res.status(400).json({ error: "Selection deadline has passed" });
      }
      
      // Create selections
      const selectionData = {
        ...validatedData,
        userId: currentUserId
      };
      
      const { data, error } = await supabase
        .from('selections')
        .insert([selectionData])
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(201).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/selections/:competitionId', async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.competitionId;
      const validatedData = selectionFormSchema.parse(req.body);
      
      // Get user from request (set by validateJWT middleware) or try to get from session
      let currentUserId;
      
      if ((req as any).user) {
        currentUserId = (req as any).user.id;
      } else {
        // Fallback to session
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        currentUserId = session.session.user.id;
      }
      
      // Check if selection deadline has passed
      const { data: competition } = await supabase
        .from('competitions')
        .select('selectionDeadline')
        .eq('id', competitionId)
        .single();
      
      if (competition && new Date(competition.selectionDeadline) < new Date()) {
        return res.status(400).json({ error: "Selection deadline has passed" });
      }
      
      // Update selections
      const { data, error } = await supabase
        .from('selections')
        .update({
          golfer1Id: validatedData.golfer1Id,
          golfer2Id: validatedData.golfer2Id,
          golfer3Id: validatedData.golfer3Id
        })
        .eq('competitionId', competitionId)
        .eq('userId', currentUserId)
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Results Routes
  app.get('/api/results/:competitionId', async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.competitionId;
      
      // First check if avatarUrl column exists in golfers table
      let includeAvatarUrl = false;
      try {
        const { data: testGolfer, error: testError } = await supabase
          .from('golfers')
          .select('avatarUrl')
          .limit(1);
          
        if (!testError) {
          includeAvatarUrl = true;
        }
      } catch (e) {
        console.log('avatarUrl column does not exist in golfers table');
      }
      
      const { data, error } = await supabase
        .from('results')
        .select(`
          *,
          golfer:golferId(id, name${includeAvatarUrl ? ', avatarUrl' : ''})
        `)
        .eq('competitionId', competitionId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/results', async (req: Request, res: Response) => {
    try {
      const validatedData = insertResultSchema.parse(req.body);
      
      // User authentication and admin check is handled by the validateJWT middleware
      // No need to check here
      
      // Create result
      const { data, error } = await supabase
        .from('results')
        .insert([validatedData])
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(201).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Leaderboard Routes
  app.get('/api/leaderboard/:competitionId?', async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.competitionId;
      console.log('Leaderboard request for competitionId:', competitionId);
      
      // If no competition ID is provided, get the currently active competition
      if (!competitionId) {
        const { data: activeCompetition, error: competitionError } = await supabase
          .from('competitions')
          .select('id')
          .eq('isActive', true)
          .order('startDate', { ascending: true })
          .limit(1)
          .single();
        
        if (competitionError && competitionError.code !== 'PGRST116') {
          throw competitionError;
        }
        
        if (!activeCompetition) {
          return res.status(200).json([]);
        }
        
        try {
          // First try to use the RPC function if available
          const { data: leaderboard, error } = await supabase.rpc('get_leaderboard', { competitionId: activeCompetition.id });
          if (error) throw error;
          res.status(200).json(leaderboard);
        } catch (rpcError: any) {
          console.log('Falling back to manual leaderboard calculation:', rpcError.message || 'RPC function unavailable');
          
          // Manual calculation as fallback
          const fallbackLeaderboard = await getLeaderboardManually(activeCompetition.id);
          res.status(200).json(fallbackLeaderboard);
        }
      } else {
        // Get leaderboard for specified competition
        try {
          // First try to use the RPC function if available
          const { data: leaderboard, error } = await supabase.rpc('get_leaderboard', { competitionId: competitionId });
          if (error) throw error;
          res.status(200).json(leaderboard);
        } catch (rpcError: any) {
          console.log('Falling back to manual leaderboard calculation:', rpcError.message || 'RPC function unavailable');
          
          // Manual calculation as fallback
          const fallbackLeaderboard = await getLeaderboardManually(competitionId);
          res.status(200).json(fallbackLeaderboard);
        }
      }
    } catch (error: any) {
      console.error('Error in leaderboard route:', error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Helper function to calculate leaderboard manually if RPC function is unavailable
  async function getLeaderboardManually(competitionId: string | number): Promise<any[]> {
    try {
      console.log('Starting manual leaderboard calculation for competition:', competitionId);
      
      // Get all selections for this competition with simple query first
      console.log('Querying selections for competitionId:', competitionId, 'Type:', typeof competitionId);
      
      // Convert competitionId to number if it's a string
      const numericCompetitionId = typeof competitionId === 'string' ? parseInt(competitionId, 10) : competitionId;
      console.log('Using numericCompetitionId:', numericCompetitionId, 'Type:', typeof numericCompetitionId);
      
      // Use direct database connection instead of Supabase
      // Create a DB client
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      
      try {
        // Get selections directly
        const selectionsResult = await pool.query(
          'SELECT * FROM selections WHERE "competitionId" = $1',
          [numericCompetitionId]
        );
        
        const selections = selectionsResult.rows;
        console.log('Selections found (direct SQL):', selections?.length);
        if (selections?.length > 0) {
          console.log('Sample selection:', JSON.stringify(selections[0]));
        }
        
        if (!selections || selections.length === 0) {
          console.log('No selections found for this competition.');
          await pool.end();
          return [];
        }
      
      // Get users separately
      const userIdsSet = new Set<number>();
      selections.forEach(s => userIdsSet.add(s.userId));
      const uniqueUserIds = Array.from(userIdsSet);
      console.log('Unique user IDs:', uniqueUserIds);
      
      // Get users with direct SQL
      const usersResult = await pool.query(
        'SELECT id, username, email FROM users WHERE id = ANY($1)',
        [uniqueUserIds]
      );
      const users = usersResult.rows;
      console.log('Users found (direct SQL):', users?.length);
      
      // Get all golfer IDs used in selections
      const golferIds = selections.flatMap(s => [s.golfer1Id, s.golfer2Id, s.golfer3Id].filter(Boolean));
      const golferIdsSet = new Set<number>();
      golferIds.forEach(id => golferIdsSet.add(id));
      const uniqueGolferIds = Array.from(golferIdsSet);
      console.log('Unique golfer IDs:', uniqueGolferIds);
      
      // Get golfers with direct SQL
      const golfersResult = await pool.query(
        'SELECT id, name FROM golfers WHERE id = ANY($1)',
        [uniqueGolferIds]
      );
      const golfers = golfersResult.rows;
      console.log('Golfers found (direct SQL):', golfers?.length);
      
      // Create lookup maps
      const userMap = Object.fromEntries(users.map(u => [u.id, u]));
      const golferMap = Object.fromEntries(golfers.map(g => [g.id, g]));
      
      // Get all results for this competition with direct SQL
      const resultsResult = await pool.query(
        'SELECT * FROM results WHERE "competitionId" = $1',
        [numericCompetitionId]
      );
      const results = resultsResult.rows;
      console.log('Results found (direct SQL):', results?.length);
      if (results?.length > 0) {
        console.log('Sample result:', JSON.stringify(results[0]));
      }
      
      // Default points system (can be overridden by actual system if available)
      const defaultPointsLookup: Record<number, number> = {};
      for (let i = 1; i <= 10; i++) {
        defaultPointsLookup[i] = 11 - i;
      }
      
      // Try to get points system with direct SQL
      let pointsLookup = defaultPointsLookup;
      try {
        const pointsSystemResult = await pool.query('SELECT * FROM points_system');
        const pointsSystem = pointsSystemResult.rows;
          
        if (pointsSystem && pointsSystem.length > 0) {
          pointsLookup = Object.fromEntries(pointsSystem.map(ps => [ps.position, ps.points]));
          console.log('Using custom points system');
        } else {
          console.log('Using default points system (no custom system found)');
        }
      } catch (e) {
        console.log('Using default points system due to error:', e);
      }
      
      // Calculate points for each user
      const userPoints: Record<string, {
        userId: string,
        username: string,
        email: string,
        points: number,
        selections: { playerName: string, position?: number }[]
      }> = {};
      
      // Process selections with our lookup maps
      selections.forEach(selection => {
        const user = userMap[selection.userId];
        if (!user) {
          console.log('User not found for selection:', selection);
          return;
        }
        
        const userId = user.id;
        if (!userPoints[userId]) {
          userPoints[userId] = {
            userId,
            username: user.username,
            email: user.email,
            points: 0,
            selections: []
          };
        }
        
        // Add golfers to user's selections
        const golfer1 = golferMap[selection.golfer1Id];
        const golfer2 = golferMap[selection.golfer2Id];
        const golfer3 = golferMap[selection.golfer3Id];
        
        console.log('Selection golfers:', {
          golfer1Id: selection.golfer1Id, 
          golfer2Id: selection.golfer2Id, 
          golfer3Id: selection.golfer3Id
        });
        
        if (golfer1) {
          userPoints[userId].selections.push({
            playerName: golfer1.name
          });
        }
        
        if (golfer2) {
          userPoints[userId].selections.push({
            playerName: golfer2.name
          });
        }
        
        if (golfer3) {
          userPoints[userId].selections.push({
            playerName: golfer3.name
          });
        }
        
        // Calculate points if results exist
        if (results && results.length > 0) {
          results.forEach(result => {
            // Check if this result matches any of the user's golfers
            if (result.golferId === selection.golfer1Id || 
                result.golferId === selection.golfer2Id || 
                result.golferId === selection.golfer3Id) {
              
              const golferId = result.golferId;
              const position = result.position;
              
              // Add points based on position
              const points = result.points || pointsLookup[position] || 0;
              userPoints[userId].points += points;
              
              console.log(`Adding ${points} points to user ${userId} for golfer ${golferId} in position ${position}`);
              
              // Find matching golfer
              const matchingGolfer = golferId === selection.golfer1Id ? golfer1 :
                                    golferId === selection.golfer2Id ? golfer2 :
                                    golfer3;
              
              // Update position in selections
              if (matchingGolfer) {
                const golferSelection = userPoints[userId].selections.find(s => 
                  s.playerName === matchingGolfer.name
                );
                
                if (golferSelection) {
                  golferSelection.position = position;
                }
              }
            }
          });
        }
      });
      
      // Convert to array and sort by points (descending)
      const leaderboard = Object.values(userPoints).sort((a, b) => b.points - a.points);
      console.log('Final leaderboard entries:', leaderboard.length);
      
      // Add rank
      const rankedLeaderboard = leaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        lastPointsChange: 0 // We don't have historical data in this fallback
      }));
      
      console.log('Returning leaderboard with entries:', rankedLeaderboard.length);
      return rankedLeaderboard;
    } catch (error) {
      console.error('Error in manual leaderboard calculation:', error);
      throw error;
    }
  }

  // Admin Routes
  app.get('/api/admin/competitions', async (req: Request, res: Response) => {
    try {
      // User authentication and admin check is handled by the validateJWT middleware
      // No need to check here
      
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('startDate', { ascending: true });
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.patch('/api/admin/competitions/:id', async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.id;
      const updateData = req.body;
      
      // User authentication and admin check is handled by the validateJWT middleware
      // No need to check here
      
      // Format dates if they exist
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }
      if (updateData.selectionDeadline) {
        updateData.selectionDeadline = new Date(updateData.selectionDeadline);
      }
      
      const { data, error } = await supabase
        .from('competitions')
        .update(updateData)
        .eq('id', competitionId)
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.get('/api/admin/users', async (req: Request, res: Response) => {
    try {
      // User authentication and admin check is handled by the validateJWT middleware
      // No need to check here
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('username');
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/admin/competitions/:id/selections', async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.id;
      
      // User authentication and admin check is handled by the validateJWT middleware
      // No need to check here
      
      const { data, error } = await supabase
        .from('selections')
        .select(`
          *,
          user:users!userId(id, username, email),
          golfer1:golfers!golfer1Id(id, name),
          golfer2:golfers!golfer2Id(id, name),
          golfer3:golfers!golfer3Id(id, name)
        `)
        .eq('competitionId', competitionId);
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/admin/selections/:id', async (req: Request, res: Response) => {
    try {
      const selectionId = req.params.id;
      const updateData = req.body;
      
      // User authentication and admin check is handled by the validateJWT middleware
      // No need to check here
      
      const { data, error } = await supabase
        .from('selections')
        .update({
          golfer1Id: updateData.golfer1Id,
          golfer2Id: updateData.golfer2Id,
          golfer3Id: updateData.golfer3Id
        })
        .eq('id', selectionId)
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/admin/selections/:id', async (req: Request, res: Response) => {
    try {
      const selectionId = req.params.id;
      
      // User authentication and admin check is handled by the validateJWT middleware
      // No need to check here
      
      const { error } = await supabase
        .from('selections')
        .delete()
        .eq('id', selectionId);
      
      if (error) throw error;
      
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  
  return httpServer;
}
