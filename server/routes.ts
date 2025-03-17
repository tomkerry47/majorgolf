import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertSelectionSchema, registrationSchema, loginSchema, insertTournamentSchema, insertGolfPlayerSchema, insertTournamentResultSchema } from "@shared/schema";
import { zValidator } from "./validator";

export async function registerRoutes(app: Express): Promise<Server> {
  // prefix all routes with /api
  const api = "/api";

  // User authentication routes
  app.post(`${api}/auth/register`, zValidator(registrationSchema), async (req, res) => {
    try {
      const { username, email, password } = req.body;
      const user = await storage.createUser({ username, email, password, isAdmin: false });
      res.status(201).json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    } catch (error: any) {
      if (error.message.includes('unique constraint')) {
        return res.status(409).json({ message: 'Username or email already exists' });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post(`${api}/auth/login`, zValidator(loginSchema), async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Users
  app.get(`${api}/users/stats`, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : 1; // In production, get from auth token
      const userStats = await storage.getUserStats(userId);
      res.status(200).json(userStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tournaments
  app.get(`${api}/tournaments`, async (req, res) => {
    try {
      const tournaments = await storage.getTournaments();
      res.status(200).json(tournaments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get(`${api}/tournaments/available`, async (req, res) => {
    try {
      const tournaments = await storage.getAvailableTournaments();
      res.status(200).json(tournaments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get(`${api}/tournaments/next`, async (req, res) => {
    try {
      const tournament = await storage.getNextTournament();
      res.status(200).json(tournament);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(`${api}/tournaments`, zValidator(insertTournamentSchema), async (req, res) => {
    try {
      // This should be admin only
      const tournament = await storage.createTournament(req.body);
      res.status(201).json(tournament);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Golf Players
  app.get(`${api}/players`, async (req, res) => {
    try {
      const players = await storage.getGolfPlayers();
      res.status(200).json(players);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(`${api}/players`, zValidator(insertGolfPlayerSchema), async (req, res) => {
    try {
      // This should be admin only
      const player = await storage.createGolfPlayer(req.body);
      res.status(201).json(player);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Selections
  app.get(`${api}/selections`, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : 1; // In production, get from auth token
      const selections = await storage.getUserSelections(userId);
      res.status(200).json(selections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get(`${api}/selections/:tournamentId`, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : 1; // In production, get from auth token
      const tournamentId = parseInt(req.params.tournamentId);
      const selection = await storage.getUserTournamentSelection(userId, tournamentId);
      
      if (!selection) {
        return res.status(404).json({ message: 'Selection not found' });
      }
      
      res.status(200).json(selection);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(`${api}/selections`, async (req, res) => {
    try {
      const selectionData = insertSelectionSchema.parse(req.body);
      const userId = 1; // In production, get from auth token
      const selection = await storage.createOrUpdateSelection({
        ...selectionData,
        userId
      });
      res.status(201).json(selection);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid selection data', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Leaderboard
  app.get(`${api}/leaderboard`, async (req, res) => {
    try {
      const tournamentId = req.query.tournamentId ? parseInt(req.query.tournamentId as string) : undefined;
      const leaderboard = await storage.getLeaderboard(tournamentId);
      res.status(200).json(leaderboard);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get(`${api}/leaderboard/:tournamentId`, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.tournamentId);
      const userId = 1; // In production, get from auth token
      const leaderboard = await storage.getTournamentLeaderboard(tournamentId, userId);
      res.status(200).json(leaderboard);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin routes
  app.get(`${api}/admin/users`, async (req, res) => {
    try {
      // This should be admin only
      const users = await storage.getUsers();
      res.status(200).json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get(`${api}/admin/selections/:userId/:tournamentId`, async (req, res) => {
    try {
      // This should be admin only
      const userId = parseInt(req.params.userId);
      const tournamentId = parseInt(req.params.tournamentId);
      const selection = await storage.getUserTournamentSelection(userId, tournamentId);
      
      if (!selection) {
        return res.status(404).json({ message: 'Selection not found' });
      }
      
      res.status(200).json(selection);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch(`${api}/admin/selections`, async (req, res) => {
    try {
      // This should be admin only
      const { userId, tournamentId, playerOneId, playerTwoId, playerThreeId } = req.body;
      
      const selection = await storage.updateSelection({
        userId,
        tournamentId,
        playerOneId,
        playerTwoId,
        playerThreeId
      });
      
      res.status(200).json(selection);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(`${api}/admin/tournament-results`, zValidator(insertTournamentResultSchema), async (req, res) => {
    try {
      // This should be admin only
      const result = await storage.createOrUpdateTournamentResult(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}

