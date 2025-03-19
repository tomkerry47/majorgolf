import { 
  users, type User, type InsertUser, 
  competitions, type Competition, type InsertCompetition,
  golfers, type Golfer, type InsertGolfer,
  selections, type Selection, type InsertSelection,
  results, type Result, type InsertResult,
  userPoints, type UserPoints, type InsertUserPoints,
  pointSystem, type PointSystem, type InsertPointSystem
} from "@shared/schema";
import { db, pgClient, hashPassword } from "./db";
import { eq, and, sql, desc, asc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Competition methods
  getCompetitions(): Promise<Competition[]>;
  getActiveCompetitions(): Promise<Competition[]>;
  getUpcomingCompetitions(): Promise<Competition[]>;
  getCompletedCompetitions(): Promise<Competition[]>;
  getCompetitionById(id: number): Promise<Competition | undefined>;
  createCompetition(competition: InsertCompetition): Promise<Competition>;
  updateCompetition(id: number, competitionData: Partial<Competition>): Promise<Competition>;
  
  // Golfer methods
  getGolfers(): Promise<Golfer[]>;
  getGolferById(id: number): Promise<Golfer | undefined>;
  createGolfer(golfer: InsertGolfer): Promise<Golfer>;
  updateGolfer(id: number, golferData: Partial<Golfer>): Promise<Golfer>;
  
  // Selection methods
  getUserSelections(userId: number, competitionId: number): Promise<Selection | undefined>;
  getAllSelections(competitionId: number): Promise<Selection[]>;
  createSelection(selection: InsertSelection): Promise<Selection>;
  updateSelection(id: number, selectionData: Partial<Selection>): Promise<Selection>;
  deleteSelection(id: number): Promise<void>;
  
  // Results methods
  getResults(competitionId: number): Promise<Result[]>;
  getResultById(id: number): Promise<Result | undefined>;
  createResult(result: InsertResult): Promise<Result>;
  updateResult(id: number, resultData: Partial<Result>): Promise<Result>;
  deleteResult(id: number): Promise<void>;
  
  // User Points methods
  getUserPoints(userId: number, competitionId: number): Promise<UserPoints | undefined>;
  getAllUserPoints(competitionId: number): Promise<UserPoints[]>;
  createUserPoints(userPoints: InsertUserPoints): Promise<UserPoints>;
  updateUserPoints(id: number, userPointsData: Partial<UserPoints>): Promise<UserPoints>;
  
  // Point System methods
  getPointSystem(): Promise<PointSystem[]>;
  updatePointSystem(position: number, points: number): Promise<PointSystem>;
  
  // Leaderboard methods
  getLeaderboard(competitionId?: number): Promise<any[]>;
}

// Implementation of IStorage using Drizzle ORM with PostgreSQL
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log(`Looking up user by email: ${email}`);
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (user) {
        console.log(`User found: ${user.username} (ID: ${user.id})`);
      } else {
        console.log(`No user found for email: ${email}`);
      }
      return user || undefined;
    } catch (error) {
      console.error(`Error looking up user by email: ${email}`, error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash password if provided
    if (insertUser.password) {
      insertUser.password = await hashPassword(insertUser.password);
    }
    
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    // Hash password if provided
    if (userData.password) {
      userData.password = await hashPassword(userData.password);
    }
    
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.username);
  }
  
  // Competition methods
  async getCompetitions(): Promise<Competition[]> {
    return await db
      .select()
      .from(competitions)
      .orderBy(competitions.startDate);
  }
  
  async getActiveCompetitions(): Promise<Competition[]> {
    return await db
      .select()
      .from(competitions)
      .where(
        and(
          eq(competitions.isActive, true),
          eq(competitions.isComplete, false)
        )
      )
      .orderBy(competitions.startDate);
  }
  
  async getUpcomingCompetitions(): Promise<Competition[]> {
    const currentDate = new Date();
    return await db
      .select()
      .from(competitions)
      .where(
        and(
          eq(competitions.isActive, false),
          eq(competitions.isComplete, false)
        )
      )
      .orderBy(competitions.startDate);
  }
  
  async getCompletedCompetitions(): Promise<Competition[]> {
    return await db
      .select()
      .from(competitions)
      .where(eq(competitions.isComplete, true))
      .orderBy(desc(competitions.endDate));
  }
  
  async getCompetitionById(id: number): Promise<Competition | undefined> {
    const [competition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, id));
    return competition || undefined;
  }
  
  async createCompetition(competition: InsertCompetition): Promise<Competition> {
    const [newCompetition] = await db
      .insert(competitions)
      .values(competition)
      .returning();
    return newCompetition;
  }
  
  async updateCompetition(id: number, competitionData: Partial<Competition>): Promise<Competition> {
    const [competition] = await db
      .update(competitions)
      .set(competitionData)
      .where(eq(competitions.id, id))
      .returning();
    return competition;
  }
  
  // Golfer methods
  async getGolfers(): Promise<Golfer[]> {
    // Select only columns that exist in the database
    const results = await db
      .select({
        id: golfers.id,
        name: golfers.name,
        rank: golfers.rank,
        avatarUrl: golfers.avatarUrl
      })
      .from(golfers)
      .orderBy(golfers.rank);
    
    // Convert to Golfer type with optional fields
    return results.map(golfer => ({
      ...golfer,
      country: undefined, // Add missing optional fields with undefined values
      createdAt: undefined
    }));
  }
  
  async getGolferById(id: number): Promise<Golfer | undefined> {
    // Select only columns that exist in the database
    const [result] = await db
      .select({
        id: golfers.id,
        name: golfers.name,
        rank: golfers.rank,
        avatarUrl: golfers.avatarUrl
      })
      .from(golfers)
      .where(eq(golfers.id, id));
    
    if (!result) return undefined;
    
    // Convert to Golfer type with optional fields
    return {
      ...result,
      country: undefined, // Add missing optional fields with undefined values
      createdAt: undefined
    };
  }
  
  async createGolfer(golfer: InsertGolfer): Promise<Golfer> {
    // Only include fields that exist in the database
    const golferToInsert = {
      name: golfer.name,
      rank: golfer.rank,
      avatarUrl: golfer.avatarUrl
    };
    
    const [newGolfer] = await db
      .insert(golfers)
      .values(golferToInsert)
      .returning();
    
    // Convert to Golfer type with optional fields
    return {
      ...newGolfer,
      country: undefined,
      createdAt: undefined
    };
  }
  
  async updateGolfer(id: number, golferData: Partial<Golfer>): Promise<Golfer> {
    // Only include fields that exist in the database
    const golferToUpdate: any = {};
    if (golferData.name !== undefined) golferToUpdate.name = golferData.name;
    if (golferData.rank !== undefined) golferToUpdate.rank = golferData.rank;
    if (golferData.avatarUrl !== undefined) golferToUpdate.avatarUrl = golferData.avatarUrl;
    
    const [updatedGolfer] = await db
      .update(golfers)
      .set(golferToUpdate)
      .where(eq(golfers.id, id))
      .returning();
    
    // Convert to Golfer type with optional fields
    return {
      ...updatedGolfer,
      country: undefined,
      createdAt: undefined
    };
  }
  
  // Selection methods
  async getUserSelections(userId: number, competitionId: number): Promise<Selection | undefined> {
    const [selection] = await db
      .select()
      .from(selections)
      .where(
        and(
          eq(selections.userId, userId),
          eq(selections.competitionId, competitionId)
        )
      );
    return selection || undefined;
  }
  
  async getAllSelections(competitionId: number): Promise<Selection[]> {
    return await db
      .select()
      .from(selections)
      .where(eq(selections.competitionId, competitionId));
  }
  
  async createSelection(selection: InsertSelection): Promise<Selection> {
    const [newSelection] = await db
      .insert(selections)
      .values(selection)
      .returning();
    return newSelection;
  }
  
  async updateSelection(id: number, selectionData: Partial<Selection>): Promise<Selection> {
    const [selection] = await db
      .update(selections)
      .set(selectionData)
      .where(eq(selections.id, id))
      .returning();
    return selection;
  }
  
  async deleteSelection(id: number): Promise<void> {
    await db
      .delete(selections)
      .where(eq(selections.id, id));
  }
  
  // Results methods
  async getResults(competitionId: number): Promise<Result[]> {
    return await db
      .select()
      .from(results)
      .where(eq(results.competitionId, competitionId))
      .orderBy(results.position);
  }
  
  async getResultById(id: number): Promise<Result | undefined> {
    const [result] = await db
      .select()
      .from(results)
      .where(eq(results.id, id));
    return result || undefined;
  }
  
  async createResult(result: InsertResult): Promise<Result> {
    const [newResult] = await db
      .insert(results)
      .values(result)
      .returning();
    return newResult;
  }
  
  async updateResult(id: number, resultData: Partial<Result>): Promise<Result> {
    const [updatedResult] = await db
      .update(results)
      .set(resultData)
      .where(eq(results.id, id))
      .returning();
    return updatedResult;
  }
  
  async deleteResult(id: number): Promise<void> {
    await db
      .delete(results)
      .where(eq(results.id, id));
  }

  // User Points methods
  async getUserPoints(userId: number, competitionId: number): Promise<UserPoints | undefined> {
    const [userPoint] = await db
      .select()
      .from(userPoints)
      .where(
        and(
          eq(userPoints.userId, userId),
          eq(userPoints.competitionId, competitionId)
        )
      );
    return userPoint || undefined;
  }
  
  async getAllUserPoints(competitionId: number): Promise<UserPoints[]> {
    return await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.competitionId, competitionId))
      .orderBy(desc(userPoints.points));
  }
  
  async createUserPoints(userPointsData: InsertUserPoints): Promise<UserPoints> {
    const [newUserPoints] = await db
      .insert(userPoints)
      .values(userPointsData)
      .returning();
    return newUserPoints;
  }
  
  async updateUserPoints(id: number, userPointsData: Partial<UserPoints>): Promise<UserPoints> {
    const [updatedUserPoints] = await db
      .update(userPoints)
      .set(userPointsData)
      .where(eq(userPoints.id, id))
      .returning();
    return updatedUserPoints;
  }
  
  // Point System methods
  async getPointSystem(): Promise<PointSystem[]> {
    return await db
      .select()
      .from(pointSystem)
      .orderBy(pointSystem.position);
  }
  
  async updatePointSystem(position: number, points: number): Promise<PointSystem> {
    const [updatedPoints] = await db
      .update(pointSystem)
      .set({ points })
      .where(eq(pointSystem.position, position))
      .returning();
    return updatedPoints;
  }
  
  // Leaderboard methods
  async getLeaderboard(competitionId?: number): Promise<any[]> {
    // If we're querying for a specific competition
    if (competitionId) {
      const leaderboardQuery = `
        SELECT 
          u.id AS "userId",
          u.username,
          u.email,
          u.avatar_url AS "avatarUrl",
          up.points,
          up.details,
          ROW_NUMBER() OVER (ORDER BY up.points DESC) AS rank
        FROM 
          user_points up
        JOIN 
          users u ON up."userId" = u.id
        WHERE 
          up."competitionId" = $1
        ORDER BY 
          up.points DESC
      `;
      
      const result = await pgClient.query(leaderboardQuery, [competitionId]);
      return result.rows;
    }
    
    // Otherwise get the overall leaderboard
    const overallLeaderboardQuery = `
      SELECT 
        u.id AS "userId",
        u.username,
        u.email,
        u.avatar_url AS "avatarUrl",
        SUM(up.points) AS points,
        ROW_NUMBER() OVER (ORDER BY SUM(up.points) DESC) AS rank
      FROM 
        users u
      LEFT JOIN 
        user_points up ON u.id = up."userId"
      GROUP BY 
        u.id, u.username, u.email, u.avatar_url
      ORDER BY 
        points DESC
    `;
    
    const result = await pgClient.query(overallLeaderboardQuery);
    return result.rows;
  }
}

// Export the storage instance
export const storage = new DatabaseStorage();