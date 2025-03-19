import { z } from "zod";
import { pgTable, serial, varchar, text, boolean, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Define Drizzle schema for database tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  username: varchar("username", { length: 50 }).notNull(),
  fullName: varchar("fullName", { length: 100 }).notNull(),
  password: text("password"),
  avatarUrl: text("avatarUrl"),
  isAdmin: boolean("isAdmin").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

export const competitions = pgTable("competitions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  venue: varchar("venue", { length: 100 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  selectionDeadline: date("selectionDeadline").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  isComplete: boolean("isComplete").default(false).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl")
});

export const golfers = pgTable("golfers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  rank: integer("rank").notNull(),
  country: varchar("country", { length: 50 }).notNull(),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

export const selections = pgTable("selections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  competitionId: integer("competitionId").notNull(),
  golfer1Id: integer("golfer1Id").notNull(),
  golfer2Id: integer("golfer2Id").notNull(),
  golfer3Id: integer("golfer3Id").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});

export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  competitionId: integer("competitionId").notNull(),
  golferId: integer("golferId").notNull(),
  position: integer("position").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

export const pointSystem = pgTable("pointSystem", {
  id: serial("id").primaryKey(),
  position: integer("position").notNull(),
  points: integer("points").notNull()
});

// Define types based on Drizzle schema
export interface User {
  id: number;
  email: string;
  username: string;
  fullName: string;
  password?: string;
  avatarUrl?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Competition {
  id: number;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  selectionDeadline: string;
  isActive: boolean;
  isComplete: boolean;
  description?: string;
  imageUrl?: string;
}

export interface Golfer {
  id: number;
  name: string;
  rank: number;
  country: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Selection {
  id: number;
  userId: number;
  competitionId: number;
  golfer1Id: number;
  golfer2Id: number;
  golfer3Id: number;
  createdAt: string;
  updatedAt: string;
}

export interface Result {
  id: number;
  competitionId: number;
  golferId: number;
  position: number;
  score: number;
  createdAt: string;
}

export interface PointSystem {
  id: number;
  position: number;
  points: number;
}

// Validation schemas for insert operations using drizzle-zod
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true });

export const insertCompetitionSchema = createInsertSchema(competitions)
  .omit({ id: true })
  .extend({
    startDate: z.string().or(z.date()),
    endDate: z.string().or(z.date()),
    selectionDeadline: z.string().or(z.date()),
  });

export const insertGolferSchema = createInsertSchema(golfers)
  .omit({ id: true, createdAt: true });

export const insertSelectionSchema = createInsertSchema(selections)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertResultSchema = createInsertSchema(results)
  .omit({ id: true, createdAt: true });

export const insertPointSystemSchema = createInsertSchema(pointSystem)
  .omit({ id: true });

// Type definitions for typescript usage
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type InsertGolfer = z.infer<typeof insertGolferSchema>;
export type InsertSelection = z.infer<typeof insertSelectionSchema>;
export type InsertResult = z.infer<typeof insertResultSchema>;
export type InsertPointSystem = z.infer<typeof insertPointSystemSchema>;

// Login and Registration schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

export const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type RegisterCredentials = z.infer<typeof registerSchema>;

// Selection form schema with validation
export const selectionFormSchema = insertSelectionSchema
  .omit({ userId: true })
  .extend({
    competitionId: z.number(),
    golfer1Id: z.number().refine(val => val > 0, "Please select a golfer"),
    golfer2Id: z.number().refine(val => val > 0, "Please select a golfer"),
    golfer3Id: z.number().refine(val => val > 0, "Please select a golfer"),
  })
  .refine(
    data => new Set([data.golfer1Id, data.golfer2Id, data.golfer3Id]).size === 3,
    {
      message: "You must select three different golfers",
      path: ["golfer3Id"],
    }
  );