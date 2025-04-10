import { z } from "zod";
import { pgTable, serial, varchar, text, boolean, timestamp, integer, date, primaryKey, uniqueIndex } from "drizzle-orm/pg-core"; // Added uniqueIndex
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
  hasUsedWaiverChip: boolean("hasUsedWaiverChip").default(false).notNull(),
  waiverChipUsedCompetitionId: integer("waiverChipUsedCompetitionId").references(() => competitions.id), // Added
  waiverChipOriginalGolferId: integer("waiverChipOriginalGolferId").references(() => golfers.id),       // Added
  waiverChipReplacementGolferId: integer("waiverChipReplacementGolferId").references(() => golfers.id), // Added
  hasPaid: boolean("hasPaid").default(false).notNull(), // Added paid status
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt") // Added last login timestamp (nullable)
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
  imageUrl: text("imageUrl"),
  externalLeaderboardUrl: text('externalLeaderboardUrl'), // Add new optional URL field
});

export const golfers = pgTable("golfers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // Keep original name field
  shortName: text("shortName"),                     // Keep shortName field
  firstName: varchar("firstName", { length: 50 }), // Add firstName (nullable)
  lastName: varchar("lastName", { length: 50 }),   // Add lastName (nullable)
  rank: integer("rank").notNull(),
  avatarUrl: text("avatarUrl"),
  // Note: The 'country' and 'createdAt' columns are defined in schema but not in DB
  // Will be added in future DB migration
  // country: varchar("country", { length: 50 }).notNull(),
  // createdAt: timestamp("createdAt").defaultNow().notNull()
});

export const selections = pgTable("selections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  competitionId: integer("competitionId").notNull(),
  golfer1Id: integer("golfer1Id").notNull(),
  golfer2Id: integer("golfer2Id").notNull(),
  golfer3Id: integer("golfer3Id").notNull(),
  useCaptainsChip: boolean("useCaptainsChip").default(false).notNull(),
  captainGolferId: integer("captainGolferId"), // Added nullable integer for captain ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});

export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  competitionId: integer("competitionId").notNull(),
  golferId: integer("golferId").notNull(),
  position: integer("position").notNull(),
  score: integer("score").notNull(),
  points: integer("points").default(0),
  created_at: timestamp("created_at").defaultNow().notNull() // Use snake_case to match DB column name
});

export const pointSystem = pgTable("points_system", {
  id: serial("id").primaryKey(),
  position: integer("position").notNull(),
  points: integer("points").notNull()
});

export const userPoints = pgTable("user_points", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  competitionId: integer("competitionId").notNull(),
  points: integer("points").notNull(),
  details: text("details"), // JSON string containing point details
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    // Add a unique constraint on userId and competitionId
    userCompetitionUnique: uniqueIndex("user_competition_idx").on(table.userId, table.competitionId),
  };
});

export const wildcardGolfers = pgTable("wildcard_golfers", {
  id: serial("id").primaryKey(),
  competitionId: integer("competitionId").notNull(),
  golferId: integer("golferId").notNull(),
  isWildcard: boolean("isWildcard").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});

export const holeInOnes = pgTable("hole_in_ones", {
  id: serial("id").primaryKey(),
  competitionId: integer("competitionId").notNull(),
  golferId: integer("golferId").notNull(),
  holeNumber: integer("holeNumber").notNull(),
  roundNumber: integer("roundNumber").notNull(), // 1-4 for typical tournaments
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull()
});

// New table to store ranks at selection deadline
export const selectionRanks = pgTable("selection_ranks", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: 'cascade' }), // Foreign key to users
  competitionId: integer("competitionId").notNull().references(() => competitions.id, { onDelete: 'cascade' }), // Foreign key to competitions
  golferId: integer("golferId").notNull().references(() => golfers.id, { onDelete: 'cascade' }), // Foreign key to golfers
  rankAtDeadline: integer("rankAtDeadline").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => {
  return {
    // Unique constraint to prevent duplicate rank entries for the same selection
    userCompetitionGolferUnique: uniqueIndex("user_competition_golfer_rank_idx").on(table.userId, table.competitionId, table.golferId),
  };
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
  hasUsedWaiverChip: boolean;
  waiverChipUsedCompetitionId?: number | null; // Added
  waiverChipOriginalGolferId?: number | null;  // Added
  waiverChipReplacementGolferId?: number | null; // Added
  createdAt: string;
  lastLoginAt?: string | null; // Added last login timestamp type
  hasPaid: boolean; // Added paid status type
  selectionCount?: number; // Added count of selections
  hasUsedCaptainsChip?: boolean; // Added optional field for calculated status
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
  externalLeaderboardUrl?: string | null; // Add corresponding type field
}

export interface Golfer {
  id: number;
  name: string; // Keep original name field
  shortName?: string | null; 
  firstName?: string | null; // Add firstName type
  lastName?: string | null;  // Add lastName type
  rank: number;
  country?: string; 
  avatarUrl?: string;
  createdAt?: string; 
}

export interface Selection {
  id: number;
  userId: number;
  competitionId: number;
  golfer1Id: number;
  golfer2Id: number;
  golfer3Id: number;
  useCaptainsChip: boolean;
  captainGolferId?: number | null; // Added optional captain ID
  createdAt: string;
  updatedAt: string;
}

export interface Result {
  id: number;
  competitionId: number;
  golferId: number;
  position: number;
  score: number;
  points?: number;
  created_at: string; // Use snake_case to match DB column name
  // Join with the golfer 
  golfer?: { // Renamed from 'golfers' to 'golfer'
    id: number;
    name: string;
  };
}

export interface PointSystem {
  id: number;
  position: number;
  points: number;
}

export interface UserPoints {
  id: number;
  userId: number;
  competitionId: number;
  points: number;
  details?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WildcardGolfer {
  id: number;
  competitionId: number;
  golferId: number;
  isWildcard: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HoleInOne {
  id: number;
  competitionId: number;
  golferId: number;
  holeNumber: number;
  roundNumber: number;
  createdAt: string;
  updatedAt: string;
}

// Add interface for SelectionRank
export interface SelectionRank {
  id: number;
  userId: number;
  competitionId: number;
  golferId: number;
  rankAtDeadline: number;
  createdAt: string;
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
    externalLeaderboardUrl: z.string().url().optional().nullable(), // Add to Zod schema
  });

export const insertGolferSchema = createInsertSchema(golfers, {
  shortName: z.string().optional().nullable(), 
  firstName: z.string().optional().nullable(), 
  lastName: z.string().optional().nullable(),  
}).omit({ id: true });

export const insertSelectionSchema = createInsertSchema(selections)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    captainGolferId: z.number().optional().nullable(), // Ensure captainGolferId is optional and nullable
  });

export const insertResultSchema = createInsertSchema(results)
  .omit({ id: true, created_at: true });

export const insertPointSystemSchema = createInsertSchema(pointSystem)
  .omit({ id: true });

export const insertUserPointsSchema = createInsertSchema(userPoints)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertWildcardGolferSchema = createInsertSchema(wildcardGolfers)
  .omit({ id: true, createdAt: true, updatedAt: true });
  
export const insertHoleInOneSchema = createInsertSchema(holeInOnes)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Add schema for SelectionRank
export const insertSelectionRankSchema = createInsertSchema(selectionRanks)
  .omit({ id: true, createdAt: true });

// Type definitions for typescript usage
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type InsertGolfer = z.infer<typeof insertGolferSchema>;
export type InsertSelection = z.infer<typeof insertSelectionSchema>;
export type InsertResult = z.infer<typeof insertResultSchema>;
export type InsertPointSystem = z.infer<typeof insertPointSystemSchema>;
export type InsertUserPoints = z.infer<typeof insertUserPointsSchema>;
export type InsertWildcardGolfer = z.infer<typeof insertWildcardGolferSchema>;
export type InsertHoleInOne = z.infer<typeof insertHoleInOneSchema>;
export type InsertSelectionRank = z.infer<typeof insertSelectionRankSchema>; // Add type

// Hole in One form schema with validation
export const holeInOneFormSchema = insertHoleInOneSchema
  .extend({
    competitionId: z.number(),
    golferId: z.number().refine(val => val > 0, "Please select a golfer"),
    holeNumber: z.number().min(1).max(18, "Hole number must be between 1 and 18"),
    roundNumber: z.number().min(1).max(4, "Round number must be between 1 and 4")
  });

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
    useCaptainsChip: z.boolean().default(false),
    captainGolferId: z.number().optional(),
  })
  .refine(
    data => new Set([data.golfer1Id, data.golfer2Id, data.golfer3Id]).size === 3,
    {
      message: "You must select three different golfers",
      path: ["golfer3Id"],
    }
  );
  // .refine( // Temporarily commented out for debugging
  //   data => {
  //     if (!data.useCaptainsChip) {
  //       return true; // No captain selected, validation passes
  //     }
  //     // If captain chip is used, captainGolferId must be defined and match one of the selections
  //     // Using loose equality (==) for debugging potential type mismatches
  //     return data.captainGolferId != undefined && 
  //            (data.captainGolferId == data.golfer1Id || 
  //             data.captainGolferId == data.golfer2Id || 
  //             data.captainGolferId == data.golfer3Id);
  //   },
  //   {
  //     message: "Captain must be one of your selected golfers",
  //     path: ["captainGolferId"], // Apply error to this field
  //   }
  // );
