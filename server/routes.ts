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
    // Check if it's an admin route or one that requires admin privileges
    if (req.path.startsWith('/api/admin/') || 
        (req.method === 'POST' && (
          req.path === '/api/competitions' || 
          req.path === '/api/golfers' || 
          req.path === '/api/results'
        )) ||
        (req.method === 'PATCH' && req.path.startsWith('/api/competitions/')) ||
        (req.method === 'DELETE' && req.path.startsWith('/api/competitions/'))
    ) {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header missing" });
      }
      
      // Extract token from Bearer format
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: "Invalid authorization format" });
      }
      
      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.error('JWT validation error:', error);
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
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
      
      // Store user info in request for later use
      (req as any).user = {
        id: user.id,
        email: user.email,
        isAdmin: userData.isAdmin
      };
    }
    
    next();
  } catch (error: any) {
    console.error('JWT validation exception:', error);
    res.status(401).json({ error: error.message || "Authentication error" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
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

  // User Routes
  app.get('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      
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
      
      // Get user from session
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const currentUserId = session.session.user.id;
      
      // Query for user's selections for this competition
      const { data, error } = await supabase
        .from('selections')
        .select(`
          *,
          golfer1:golfer1Id(id, name, avatarUrl),
          golfer2:golfer2Id(id, name, avatarUrl),
          golfer3:golfer3Id(id, name, avatarUrl)
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
      
      // Get user from session
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return res.status(401).json({ error: "Not authenticated" });
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
        userId: session.session.user.id
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
      
      // Get user from session
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return res.status(401).json({ error: "Not authenticated" });
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
        .eq('userId', session.session.user.id)
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
      
      const { data, error } = await supabase
        .from('results')
        .select(`
          *,
          golfer:golferId(id, name, avatarUrl)
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
        
        const { data: leaderboard, error } = await supabase.rpc('get_leaderboard', { competitionId: activeCompetition.id });
        
        if (error) throw error;
        
        res.status(200).json(leaderboard);
      } else {
        // Get leaderboard for specified competition
        const { data: leaderboard, error } = await supabase.rpc('get_leaderboard', { competitionId: competitionId });
        
        if (error) throw error;
        
        res.status(200).json(leaderboard);
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

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
          user:userId(id, username, email),
          golfer1:golfer1Id(id, name),
          golfer2:golfer2Id(id, name),
          golfer3:golfer3Id(id, name)
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
