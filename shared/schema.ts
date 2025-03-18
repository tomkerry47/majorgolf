import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  fullName: text("fullName").notNull(),
  password: text("password"),
  avatarUrl: text("avatarUrl"),
  isAdmin: boolean("isAdmin").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Competitions table
export const competitions = pgTable("competitions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  venue: text("venue").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  selectionDeadline: timestamp("selectionDeadline").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  isComplete: boolean("isComplete").default(false).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
});

// Golfers table
export const golfers = pgTable("golfers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rank: integer("rank"),
  avatarUrl: text("avatarUrl"),
});

// User selections table
export const selections = pgTable("selections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  competitionId: integer("competitionId").notNull().references(() => competitions.id),
  golfer1Id: integer("golfer1Id").notNull().references(() => golfers.id),
  golfer2Id: integer("golfer2Id").notNull().references(() => golfers.id),
  golfer3Id: integer("golfer3Id").notNull().references(() => golfers.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  uniqueUserCompetition: uniqueIndex("selections_user_competition_unique_idx").on(t.userId, t.competitionId)
}));

// Competition results table
export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  competitionId: integer("competitionId").notNull().references(() => competitions.id),
  golferId: integer("golferId").notNull().references(() => golfers.id),
  position: integer("position").notNull(),
  points: integer("points").notNull(),
});

// Points by position table
export const pointsSystem = pgTable("points_system", {
  position: integer("position").primaryKey(),
  points: integer("points").notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true,
  isAdmin: true
});

// Define a custom competition insert schema
export const insertCompetitionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  venue: z.string().min(1, "Venue is required"),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  selectionDeadline: z.string().or(z.date()),
  isActive: z.boolean().default(false),
  isComplete: z.boolean().default(false),
  description: z.string().optional(),
  imageUrl: z.string().optional()
});

export const insertGolferSchema = createInsertSchema(golfers).omit({ 
  id: true
});

export const insertSelectionSchema = createInsertSchema(selections).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertResultSchema = createInsertSchema(results).omit({ 
  id: true
});

export const insertPointSystemSchema = createInsertSchema(pointsSystem);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type Competition = typeof competitions.$inferSelect;

export type InsertGolfer = z.infer<typeof insertGolferSchema>;
export type Golfer = typeof golfers.$inferSelect;

export type InsertSelection = z.infer<typeof insertSelectionSchema>;
export type Selection = typeof selections.$inferSelect;

export type InsertResult = z.infer<typeof insertResultSchema>;
export type Result = typeof results.$inferSelect;

export type InsertPointSystem = z.infer<typeof insertPointSystemSchema>;
export type PointSystem = typeof pointsSystem.$inferSelect;

// Custom schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

// Extended schema with validation
export const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, { message: "Password must be at least 6 characters long" }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type RegisterCredentials = z.infer<typeof registerSchema>;

// Extended schema for selection form with validation
export const selectionFormSchema = insertSelectionSchema
  .refine((data) => data.golfer1Id !== data.golfer2Id && 
                     data.golfer1Id !== data.golfer3Id && 
                     data.golfer2Id !== data.golfer3Id, {
    message: "You must select three different golfers",
    path: ["golfer3Id"],
  });
