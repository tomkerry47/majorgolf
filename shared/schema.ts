import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for tournament status
export const tournamentStatusEnum = pgEnum("tournament_status", ["upcoming", "active", "completed"]);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tournaments table
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: tournamentStatusEnum("status").default("upcoming").notNull(),
  imageUrl: text("image_url"),
  selectionDeadline: timestamp("selection_deadline").notNull(),
});

// Golf players table
export const golfPlayers = pgTable("golf_players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country"),
  worldRanking: integer("world_ranking"),
});

// User selections table
export const selections = pgTable("selections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  tournamentId: integer("tournament_id").references(() => tournaments.id).notNull(),
  playerOneId: integer("player_one_id").references(() => golfPlayers.id).notNull(),
  playerTwoId: integer("player_two_id").references(() => golfPlayers.id).notNull(),
  playerThreeId: integer("player_three_id").references(() => golfPlayers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tournament results table
export const tournamentResults = pgTable("tournament_results", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id).notNull(),
  playerId: integer("player_id").references(() => golfPlayers.id).notNull(),
  position: integer("position"),
  madeCut: boolean("made_cut").default(true).notNull(),
  points: integer("points").default(0).notNull(),
});

// User points table
export const userPoints = pgTable("user_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  tournamentId: integer("tournament_id").references(() => tournaments.id).notNull(),
  points: integer("points").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// Schema for inserting tournaments
export const insertTournamentSchema = createInsertSchema(tournaments).omit({
  id: true,
});

// Schema for inserting golf players
export const insertGolfPlayerSchema = createInsertSchema(golfPlayers).omit({
  id: true,
});

// Schema for inserting selections
export const insertSelectionSchema = createInsertSchema(selections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for inserting tournament results
export const insertTournamentResultSchema = createInsertSchema(tournamentResults).omit({
  id: true,
});

// Schema for inserting user points
export const insertUserPointSchema = createInsertSchema(userPoints).omit({
  id: true,
  lastUpdated: true,
});

// Registration schema with password confirmation
export const registrationSchema = insertUserSchema
  .extend({
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Registration = z.infer<typeof registrationSchema>;
export type Login = z.infer<typeof loginSchema>;

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;

export type GolfPlayer = typeof golfPlayers.$inferSelect;
export type InsertGolfPlayer = z.infer<typeof insertGolfPlayerSchema>;

export type Selection = typeof selections.$inferSelect;
export type InsertSelection = z.infer<typeof insertSelectionSchema>;

export type TournamentResult = typeof tournamentResults.$inferSelect;
export type InsertTournamentResult = z.infer<typeof insertTournamentResultSchema>;

export type UserPoint = typeof userPoints.$inferSelect;
export type InsertUserPoint = z.infer<typeof insertUserPointSchema>;
