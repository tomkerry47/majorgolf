import type { Express, Request, Response } from "express";
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

export async function registerRoutes(app: Express): Promise<Server> {
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
            full_name: validatedData.fullName,
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
          fullName: userData?.full_name || '',
          isAdmin: userData?.is_admin || false
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
      const { data: stats, error: statsError } = await supabase.rpc('get_user_stats', { user_id: userId });
      
      // Get user auth data for additional information
      const { data: authData } = await supabase.auth.getUser(userId);
      
      const enrichedUserData = {
        id: userData.id,
        email: userData.email,
        username: userData.username || userData.email?.split('@')[0],
        fullName: userData.full_name || '',
        avatar: userData.avatar_url || '',
        stats: stats || {},
        isAdmin: !!userData.is_admin
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
        .order('start_date', { ascending: true });
      
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
        .order('start_date', { ascending: true });
      
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
        .eq('is_active', true)
        .order('start_date', { ascending: true });
      
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
        .eq('is_active', false)
        .eq('is_complete', false)
        .order('start_date', { ascending: true });
      
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
          golfer1:golfer1_id(id, name, avatar),
          golfer2:golfer2_id(id, name, avatar),
          golfer3:golfer3_id(id, name, avatar)
        `)
        .eq('competition_id', competitionId)
        .eq('user_id', userId || currentUserId)
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
        .select('selection_deadline')
        .eq('id', validatedData.competitionId)
        .single();
      
      if (competition && new Date(competition.selection_deadline) < new Date()) {
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
        .select('selection_deadline')
        .eq('id', competitionId)
        .single();
      
      if (competition && new Date(competition.selection_deadline) < new Date()) {
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
        .eq('competition_id', competitionId)
        .eq('user_id', session.session.user.id)
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
          golfer:golfer_id(id, name, avatar)
        `)
        .eq('competition_id', competitionId)
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
      
      // Get user from session to check admin status
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Check if user is admin
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', session.session.user.id)
        .single();
      
      if (!user.is_admin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
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
          .eq('is_active', true)
          .order('start_date', { ascending: true })
          .limit(1)
          .single();
        
        if (competitionError && competitionError.code !== 'PGRST116') {
          throw competitionError;
        }
        
        if (!activeCompetition) {
          return res.status(200).json([]);
        }
        
        const { data: leaderboard, error } = await supabase.rpc('get_leaderboard', { competition_id: activeCompetition.id });
        
        if (error) throw error;
        
        res.status(200).json(leaderboard);
      } else {
        // Get leaderboard for specified competition
        const { data: leaderboard, error } = await supabase.rpc('get_leaderboard', { competition_id: competitionId });
        
        if (error) throw error;
        
        res.status(200).json(leaderboard);
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Admin Routes
  app.get('/api/admin/users', async (req: Request, res: Response) => {
    try {
      // Get user from session to check admin status
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Check if user is admin
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', session.session.user.id)
        .single();
      
      if (!user.is_admin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
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
      
      // Get user from session to check admin status
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Check if user is admin
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', session.session.user.id)
        .single();
      
      if (!user.is_admin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { data, error } = await supabase
        .from('selections')
        .select(`
          *,
          user:user_id(id, username, email),
          golfer1:golfer1_id(id, name),
          golfer2:golfer2_id(id, name),
          golfer3:golfer3_id(id, name)
        `)
        .eq('competition_id', competitionId);
      
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
      
      // Get user from session to check admin status
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Check if user is admin
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', session.session.user.id)
        .single();
      
      if (!user.is_admin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
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
      
      // Get user from session to check admin status
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Check if user is admin
      const { data: user } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', session.session.user.id)
        .single();
      
      if (!user.is_admin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
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
