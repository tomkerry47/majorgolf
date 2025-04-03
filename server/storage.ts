import { 
  users, type User, type InsertUser, 
  competitions, type Competition, type InsertCompetition,
  golfers, type Golfer, type InsertGolfer,
  selections, type Selection, type InsertSelection,
  results, type Result, type InsertResult,
  userPoints, type UserPoints, type InsertUserPoints,
  pointSystem, type PointSystem, type InsertPointSystem,
  wildcardGolfers, type WildcardGolfer, type InsertWildcardGolfer,
  holeInOnes, type HoleInOne, type InsertHoleInOne
} from "@shared/schema";
import { db, pgClient, hashPassword } from "./db";
import { eq, and, sql, desc, asc, count } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  hasUsedWaiverChip(userId: number): Promise<boolean>;
  markWaiverChipAsUsed(userId: number): Promise<User>;

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
  getUserSelectionsForAllCompetitions(userId: number): Promise<Selection[]>; // Added method
  getSelectionById(id: number): Promise<Selection | undefined>;
  hasUsedCaptainsChip(userId: number): Promise<boolean>;
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

  // Wildcard Golfer methods
  getWildcardGolfers(competitionId: number): Promise<WildcardGolfer[]>;
  getWildcardGolfer(competitionId: number, golferId: number): Promise<WildcardGolfer | undefined>;
  createWildcardGolfer(wildcardGolfer: InsertWildcardGolfer): Promise<WildcardGolfer>;
  updateWildcardGolfer(id: number, wildcardGolferData: Partial<WildcardGolfer>): Promise<WildcardGolfer>;
  deleteWildcardGolfer(id: number): Promise<void>;

  // Leaderboard methods
  getLeaderboard(competitionId?: number): Promise<any[]>;

  // Hole In One methods
  getHoleInOnes(competitionId: number): Promise<HoleInOne[]>;
  getHoleInOneById(id: number): Promise<HoleInOne | undefined>;
  getGolferHoleInOnes(competitionId: number, golferId: number): Promise<HoleInOne[]>;
  createHoleInOne(holeInOne: InsertHoleInOne): Promise<HoleInOne>;
  updateHoleInOne(id: number, holeInOneData: Partial<HoleInOne>): Promise<HoleInOne>;
  deleteHoleInOne(id: number): Promise<void>;
}

// Helper function to convert DB user to User interface type
function formatUserForResponse(user: any): User | undefined {
  if (!user) return undefined;
  
  return {
    ...user,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt
  };
}

// Implementation of IStorage using Drizzle ORM with PostgreSQL
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return formatUserForResponse(user);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return formatUserForResponse(user);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log(`Looking up user by email: ${email}`);
    try {
      // Convert email to lowercase for case-insensitive matching
      const normalizedEmail = email.toLowerCase().trim();
      const [user] = await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${normalizedEmail})`);
      if (user) {
        console.log(`User found: ${user.username} (ID: ${user.id})`);
      } else {
        console.log(`No user found for email: ${email}`);
      }
      return formatUserForResponse(user);
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
    return formatUserForResponse(user)!;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    // Hash password if provided
    if (userData.password) {
      userData.password = await hashPassword(userData.password);
    }

    // Convert string dates to Date objects if needed
    const dataToUpdate: any = { ...userData };
    if (typeof dataToUpdate.createdAt === 'string') {
      dataToUpdate.createdAt = new Date(dataToUpdate.createdAt);
    }

    const [user] = await db
      .update(users)
      .set(dataToUpdate)
      .where(eq(users.id, id))
      .returning();
    return formatUserForResponse(user)!;
  }

  async getAllUsers(): Promise<User[]> {
    const userList = await db.select().from(users).orderBy(users.username);
    return userList.map(user => formatUserForResponse(user)!) as User[];
  }

  // Competition methods
  async getCompetitions(): Promise<Competition[]> {
    const competitionsList = await db
      .select()
      .from(competitions)
      .orderBy(competitions.startDate);
    return competitionsList as unknown as Competition[];
  }

  async getActiveCompetitions(): Promise<Competition[]> {
    const activeCompetitions = await db
      .select()
      .from(competitions)
      .where(
        and(
          eq(competitions.isActive, true),
          eq(competitions.isComplete, false)
        )
      )
      .orderBy(competitions.startDate);
    return activeCompetitions as unknown as Competition[];
  }

  async getUpcomingCompetitions(): Promise<Competition[]> {
    const currentDate = new Date();
    const upcomingCompetitions = await db
      .select()
      .from(competitions)
      .where(
        and(
          eq(competitions.isActive, false),
          eq(competitions.isComplete, false)
        )
      )
      .orderBy(competitions.startDate);
    return upcomingCompetitions as unknown as Competition[];
  }

  async getCompletedCompetitions(): Promise<Competition[]> {
    const completedCompetitions = await db
      .select()
      .from(competitions)
      .where(eq(competitions.isComplete, true))
      .orderBy(desc(competitions.endDate));
    return completedCompetitions as unknown as Competition[];
  }

  async getCompetitionById(id: number): Promise<Competition | undefined> {
    const [competition] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, id));
    return competition as unknown as Competition | undefined;
  }

  async createCompetition(competition: InsertCompetition): Promise<Competition> {
    // Convert string dates to Date objects if needed
    const competitionToInsert: any = { ...competition };

    if (typeof competitionToInsert.startDate === 'string') {
      competitionToInsert.startDate = new Date(competitionToInsert.startDate);
    }
    if (typeof competitionToInsert.endDate === 'string') {
      competitionToInsert.endDate = new Date(competitionToInsert.endDate);
    }
    if (typeof competitionToInsert.selectionDeadline === 'string') {
      competitionToInsert.selectionDeadline = new Date(competitionToInsert.selectionDeadline);
    }

    const [newCompetition] = await db
      .insert(competitions)
      .values(competitionToInsert)
      .returning();
    return newCompetition as unknown as Competition;
  }

  async updateCompetition(id: number, competitionData: Partial<Competition>): Promise<Competition> {
    const [competition] = await db
      .update(competitions)
      .set(competitionData)
      .where(eq(competitions.id, id))
      .returning();
    return competition as unknown as Competition;
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
      createdAt: undefined,
      avatarUrl: golfer.avatarUrl || undefined
    })) as Golfer[];
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
      createdAt: undefined,
      avatarUrl: result.avatarUrl || undefined
    } as Golfer;
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
      createdAt: undefined,
      avatarUrl: newGolfer.avatarUrl || undefined
    } as Golfer;
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
      createdAt: undefined,
      avatarUrl: updatedGolfer.avatarUrl || undefined
    } as Golfer;
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

    if (!selection) return undefined;

    // Convert Date to string for Selection interface
    return {
      ...selection,
      createdAt: selection.createdAt instanceof Date ? selection.createdAt.toISOString() : selection.createdAt,
      updatedAt: selection.updatedAt instanceof Date ? selection.updatedAt.toISOString() : selection.updatedAt
    } as Selection;
  }

  async getUserSelectionsForAllCompetitions(userId: number): Promise<Selection[]> {
    const userSelections = await db
      .select()
      .from(selections)
      .where(eq(selections.userId, userId));

    // Format for Selection interface
    return userSelections.map(s => ({
      ...s,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt
    })) as Selection[];
  }

  async getSelectionById(id: number): Promise<Selection | undefined> {
    const [selection] = await db
      .select()
      .from(selections)
      .where(eq(selections.id, id));

    if (!selection) return undefined;

    // Convert Date to string for Selection interface
    return {
      ...selection,
      createdAt: selection.createdAt instanceof Date ? selection.createdAt.toISOString() : selection.createdAt,
      updatedAt: selection.updatedAt instanceof Date ? selection.updatedAt.toISOString() : selection.updatedAt
    } as Selection;
  }

  async hasUsedCaptainsChip(userId: number): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(selections)
      .where(
        and(
          eq(selections.userId, userId),
          eq(selections.useCaptainsChip, true)
        )
      );

    return result[0].count > 0;
  }

  async hasUsedWaiverChip(userId: number): Promise<boolean> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    return user?.hasUsedWaiverChip || false;
  }

  async markWaiverChipAsUsed(userId: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ hasUsedWaiverChip: true })
      .where(eq(users.id, userId))
      .returning();

    return formatUserForResponse(updatedUser)!;
  }

  async getAllSelections(competitionId: number): Promise<Selection[]> {
    const allSelections = await db
      .select()
      .from(selections)
      .where(eq(selections.competitionId, competitionId));

    // Convert Date to string for Selection interface
    return allSelections.map(s => ({
      ...s,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt
    })) as Selection[];
  }

  async createSelection(selection: InsertSelection): Promise<Selection> {
    // Convert string dates to Date objects for database
    const selectionToInsert: any = { ...selection };

    if (typeof selectionToInsert.createdAt === 'string') {
      selectionToInsert.createdAt = new Date(selectionToInsert.createdAt);
    }
    if (typeof selectionToInsert.updatedAt === 'string') {
      selectionToInsert.updatedAt = new Date(selectionToInsert.updatedAt);
    }

    const [newSelection] = await db
      .insert(selections)
      .values(selectionToInsert)
      .returning();

    // Convert Date to string for Selection interface
    return {
      ...newSelection,
      createdAt: newSelection.createdAt instanceof Date ? newSelection.createdAt.toISOString() : newSelection.createdAt,
      updatedAt: newSelection.updatedAt instanceof Date ? newSelection.updatedAt.toISOString() : newSelection.updatedAt
    } as Selection;
  }

  async updateSelection(id: number, selectionData: Partial<Selection>): Promise<Selection> {
    // Convert string dates to Date objects for database
    const dataToUpdate: any = { ...selectionData };

    if (typeof dataToUpdate.createdAt === 'string') {
      dataToUpdate.createdAt = new Date(dataToUpdate.createdAt);
    }
    if (typeof dataToUpdate.updatedAt === 'string') {
      dataToUpdate.updatedAt = new Date(dataToUpdate.updatedAt);
    }

    const [selection] = await db
      .update(selections)
      .set(dataToUpdate)
      .where(eq(selections.id, id))
      .returning();

    // Convert Date to string for Selection interface
    return {
      ...selection,
      createdAt: selection.createdAt instanceof Date ? selection.createdAt.toISOString() : selection.createdAt,
      updatedAt: selection.updatedAt instanceof Date ? selection.updatedAt.toISOString() : selection.updatedAt
    } as Selection;
  }

  async deleteSelection(id: number): Promise<void> {
    await db
      .delete(selections)
      .where(eq(selections.id, id));
  }

  // Results methods
  async getResults(competitionId: number): Promise<Result[]> {
    const resultsData = await db
      .select()
      .from(results)
      .where(eq(results.competitionId, competitionId))
      .orderBy(results.position);

    // Format for Result interface
    return resultsData.map(r => ({
      ...r,
      points: r.points || undefined,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
    })) as Result[];
  }

  async getResultById(id: number): Promise<Result | undefined> {
    const [result] = await db
      .select()
      .from(results)
      .where(eq(results.id, id));

    if (!result) return undefined;

    // Format for Result interface
    return {
      ...result,
      points: result.points || undefined,
      created_at: result.created_at instanceof Date ? result.created_at.toISOString() : result.created_at
    } as Result;
  }

  async createResult(result: InsertResult): Promise<Result> {
    // Convert string date to Date object for database
    const resultToInsert: any = { ...result };

    if (typeof resultToInsert.created_at === 'string') {
      resultToInsert.created_at = new Date(resultToInsert.created_at);
    }

    const [newResult] = await db
      .insert(results)
      .values(resultToInsert)
      .returning();

    // Format for Result interface
    return {
      ...newResult,
      points: newResult.points || undefined,
      created_at: newResult.created_at instanceof Date ? newResult.created_at.toISOString() : newResult.created_at
    } as Result;
  }

  async updateResult(id: number, resultData: Partial<Result>): Promise<Result> {
    // Convert string date to Date object for database
    const dataToUpdate: any = { ...resultData };

    if (typeof dataToUpdate.created_at === 'string') {
      dataToUpdate.created_at = new Date(dataToUpdate.created_at);
    }

    const [updatedResult] = await db
      .update(results)
      .set(dataToUpdate)
      .where(eq(results.id, id))
      .returning();

    // Format for Result interface
    return {
      ...updatedResult,
      points: updatedResult.points || undefined,
      created_at: updatedResult.created_at instanceof Date ? updatedResult.created_at.toISOString() : updatedResult.created_at
    } as Result;
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

    if (!userPoint) return undefined;

    // Format for UserPoints interface
    return {
      ...userPoint,
      details: userPoint.details || undefined,
      createdAt: userPoint.createdAt instanceof Date ? userPoint.createdAt.toISOString() : userPoint.createdAt,
      updatedAt: userPoint.updatedAt instanceof Date ? userPoint.updatedAt.toISOString() : userPoint.updatedAt
    } as UserPoints;
  }

  async getAllUserPoints(competitionId: number): Promise<UserPoints[]> {
    const allUserPoints = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.competitionId, competitionId))
      .orderBy(desc(userPoints.points));

    // Format for UserPoints interface
    return allUserPoints.map(up => ({
      ...up,
      details: up.details || undefined,
      createdAt: up.createdAt instanceof Date ? up.createdAt.toISOString() : up.createdAt,
      updatedAt: up.updatedAt instanceof Date ? up.updatedAt.toISOString() : up.updatedAt
    })) as UserPoints[];
  }

  async createUserPoints(userPointsData: InsertUserPoints): Promise<UserPoints> {
    // Convert string dates to Date objects for database
    const dataToInsert: any = { ...userPointsData };

    if (typeof dataToInsert.createdAt === 'string') {
      dataToInsert.createdAt = new Date(dataToInsert.createdAt);
    }
    if (typeof dataToInsert.updatedAt === 'string') {
      dataToInsert.updatedAt = new Date(dataToInsert.updatedAt);
    }

    const [newUserPoints] = await db
      .insert(userPoints)
      .values(dataToInsert)
      .returning();

    // Format for UserPoints interface
    return {
      ...newUserPoints,
      details: newUserPoints.details || undefined,
      createdAt: newUserPoints.createdAt instanceof Date ? newUserPoints.createdAt.toISOString() : newUserPoints.createdAt,
      updatedAt: newUserPoints.updatedAt instanceof Date ? newUserPoints.updatedAt.toISOString() : newUserPoints.updatedAt
    } as UserPoints;
  }

  async updateUserPoints(id: number, userPointsData: Partial<UserPoints>): Promise<UserPoints> {
    // Convert string dates to Date objects for database
    const dataToUpdate: any = { ...userPointsData };

    if (typeof dataToUpdate.createdAt === 'string') {
      dataToUpdate.createdAt = new Date(dataToUpdate.createdAt);
    }
    if (typeof dataToUpdate.updatedAt === 'string') {
      dataToUpdate.updatedAt = new Date(dataToUpdate.updatedAt);
    }

    const [updatedUserPoints] = await db
      .update(userPoints)
      .set(dataToUpdate)
      .where(eq(userPoints.id, id))
      .returning();

    // Format for UserPoints interface
    return {
      ...updatedUserPoints,
      details: updatedUserPoints.details || undefined,
      createdAt: updatedUserPoints.createdAt instanceof Date ? updatedUserPoints.createdAt.toISOString() : updatedUserPoints.createdAt,
      updatedAt: updatedUserPoints.updatedAt instanceof Date ? updatedUserPoints.updatedAt.toISOString() : updatedUserPoints.updatedAt
    } as UserPoints;
  }

  // Point System methods
  async getPointSystem(): Promise<PointSystem[]> {
    try {
      // Use raw SQL as the schema and actual table structure differ
      const result = await pgClient.query(
        'SELECT position, points FROM points_system ORDER BY position'
      );
      return result.rows.map(row => ({
        id: row.position, // Use position as id since we don't have an id column
        position: row.position,
        points: row.points
      }));
    } catch (error) {
      console.error('Error fetching point system:', error);
      return [];
    }
  }

  async updatePointSystem(position: number, points: number): Promise<PointSystem> {
    try {
      // Use raw SQL as the schema and actual table structure differ
      const result = await pgClient.query(
        'UPDATE points_system SET points = $1 WHERE position = $2 RETURNING position, points',
        [points, position]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`No point system entry found for position ${position}`);
      }
      
      return {
        id: result.rows[0].position, // Use position as id
        position: result.rows[0].position,
        points: result.rows[0].points
      };
    } catch (error) {
      console.error('Error updating point system:', error);
      throw error;
    }
  }

  // Wildcard Golfer methods
  async getWildcardGolfers(competitionId: number): Promise<WildcardGolfer[]> {
    const wildcards = await db
      .select()
      .from(wildcardGolfers)
      .where(eq(wildcardGolfers.competitionId, competitionId))
      .orderBy(wildcardGolfers.golferId);

    // Format for WildcardGolfer interface
    return wildcards.map(wc => ({
      ...wc,
      createdAt: wc.createdAt instanceof Date ? wc.createdAt.toISOString() : wc.createdAt,
      updatedAt: wc.updatedAt instanceof Date ? wc.updatedAt.toISOString() : wc.updatedAt
    })) as WildcardGolfer[];
  }

  async getWildcardGolfer(competitionId: number, golferId: number): Promise<WildcardGolfer | undefined> {
    const [wildcard] = await db
      .select()
      .from(wildcardGolfers)
      .where(
        and(
          eq(wildcardGolfers.competitionId, competitionId),
          eq(wildcardGolfers.golferId, golferId)
        )
      );

    if (!wildcard) return undefined;

    // Format for WildcardGolfer interface
    return {
      ...wildcard,
      createdAt: wildcard.createdAt instanceof Date ? wildcard.createdAt.toISOString() : wildcard.createdAt,
      updatedAt: wildcard.updatedAt instanceof Date ? wildcard.updatedAt.toISOString() : wildcard.updatedAt
    } as WildcardGolfer;
  }

  async createWildcardGolfer(wildcardGolfer: InsertWildcardGolfer): Promise<WildcardGolfer> {
    // Convert string dates to Date objects for database
    const dataToInsert: any = { ...wildcardGolfer };

    if (typeof dataToInsert.createdAt === 'string') {
      dataToInsert.createdAt = new Date(dataToInsert.createdAt);
    }
    if (typeof dataToInsert.updatedAt === 'string') {
      dataToInsert.updatedAt = new Date(dataToInsert.updatedAt);
    }

    const [newWildcard] = await db
      .insert(wildcardGolfers)
      .values(dataToInsert)
      .returning();

    // Format for WildcardGolfer interface
    return {
      ...newWildcard,
      createdAt: newWildcard.createdAt instanceof Date ? newWildcard.createdAt.toISOString() : newWildcard.createdAt,
      updatedAt: newWildcard.updatedAt instanceof Date ? newWildcard.updatedAt.toISOString() : newWildcard.updatedAt
    } as WildcardGolfer;
  }

  async updateWildcardGolfer(id: number, wildcardGolferData: Partial<WildcardGolfer>): Promise<WildcardGolfer> {
    // Convert string dates to Date objects for database
    const dataToUpdate: any = { ...wildcardGolferData };

    if (typeof dataToUpdate.createdAt === 'string') {
      dataToUpdate.createdAt = new Date(dataToUpdate.createdAt);
    }
    if (typeof dataToUpdate.updatedAt === 'string') {
      dataToUpdate.updatedAt = new Date(dataToUpdate.updatedAt);
    }

    const [updatedWildcard] = await db
      .update(wildcardGolfers)
      .set(dataToUpdate)
      .where(eq(wildcardGolfers.id, id))
      .returning();

    // Format for WildcardGolfer interface
    return {
      ...updatedWildcard,
      createdAt: updatedWildcard.createdAt instanceof Date ? updatedWildcard.createdAt.toISOString() : updatedWildcard.createdAt,
      updatedAt: updatedWildcard.updatedAt instanceof Date ? updatedWildcard.updatedAt.toISOString() : updatedWildcard.updatedAt
    } as WildcardGolfer;
  }

  async deleteWildcardGolfer(id: number): Promise<void> {
    await db
      .delete(wildcardGolfers)
      .where(eq(wildcardGolfers.id, id));
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
          u."avatarUrl",
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
        u."avatarUrl",
        SUM(up.points) AS points,
        ROW_NUMBER() OVER (ORDER BY SUM(up.points) DESC) AS rank
      FROM 
        users u
      LEFT JOIN 
        user_points up ON u.id = up."userId"
      GROUP BY 
        u.id, u.username, u.email, u."avatarUrl"
      ORDER BY 
        points DESC
    `;

    const result = await pgClient.query(overallLeaderboardQuery);
    return result.rows;
  }

  // Hole In One methods
  async getHoleInOnes(competitionId: number): Promise<HoleInOne[]> {
    const holeInOnesData = await db
      .select()
      .from(holeInOnes)
      .where(eq(holeInOnes.competitionId, competitionId))
      .orderBy(holeInOnes.roundNumber, holeInOnes.holeNumber);

    // Convert Date to string for HoleInOne interface
    return holeInOnesData.map(h => ({
      ...h,
      createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : h.createdAt,
      updatedAt: h.updatedAt instanceof Date ? h.updatedAt.toISOString() : h.updatedAt
    })) as HoleInOne[];
  }

  async getHoleInOneById(id: number): Promise<HoleInOne | undefined> {
    const [holeInOne] = await db
      .select()
      .from(holeInOnes)
      .where(eq(holeInOnes.id, id));

    if (!holeInOne) return undefined;

    // Convert Date to string for HoleInOne interface
    return {
      ...holeInOne,
      createdAt: holeInOne.createdAt instanceof Date ? holeInOne.createdAt.toISOString() : holeInOne.createdAt,
      updatedAt: holeInOne.updatedAt instanceof Date ? holeInOne.updatedAt.toISOString() : holeInOne.updatedAt
    } as HoleInOne;
  }

  async getGolferHoleInOnes(competitionId: number, golferId: number): Promise<HoleInOne[]> {
    const holeInOnesData = await db
      .select()
      .from(holeInOnes)
      .where(
        and(
          eq(holeInOnes.competitionId, competitionId),
          eq(holeInOnes.golferId, golferId)
        )
      )
      .orderBy(holeInOnes.roundNumber, holeInOnes.holeNumber);

    // Convert Date to string for HoleInOne interface
    return holeInOnesData.map(h => ({
      ...h,
      createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : h.createdAt,
      updatedAt: h.updatedAt instanceof Date ? h.updatedAt.toISOString() : h.updatedAt
    })) as HoleInOne[];
  }

  async createHoleInOne(holeInOne: InsertHoleInOne): Promise<HoleInOne> {
    // Convert string dates to Date objects for database
    const holeInOneToInsert: any = { ...holeInOne };

    if (typeof holeInOneToInsert.createdAt === 'string') {
      holeInOneToInsert.createdAt = new Date(holeInOneToInsert.createdAt);
    }
    if (typeof holeInOneToInsert.updatedAt === 'string') {
      holeInOneToInsert.updatedAt = new Date(holeInOneToInsert.updatedAt);
    }

    const [newHoleInOne] = await db
      .insert(holeInOnes)
      .values(holeInOneToInsert)
      .returning();

    // Convert Date to string for HoleInOne interface
    return {
      ...newHoleInOne,
      createdAt: newHoleInOne.createdAt instanceof Date ? newHoleInOne.createdAt.toISOString() : newHoleInOne.createdAt,
      updatedAt: newHoleInOne.updatedAt instanceof Date ? newHoleInOne.updatedAt.toISOString() : newHoleInOne.updatedAt
    } as HoleInOne;
  }

  async updateHoleInOne(id: number, holeInOneData: Partial<HoleInOne>): Promise<HoleInOne> {
    // Convert string dates to Date objects for database
    const dataToUpdate: any = { ...holeInOneData };

    if (typeof dataToUpdate.createdAt === 'string') {
      dataToUpdate.createdAt = new Date(dataToUpdate.createdAt);
    }
    if (typeof dataToUpdate.updatedAt === 'string') {
      dataToUpdate.updatedAt = new Date(dataToUpdate.updatedAt);
    }

    const [holeInOne] = await db
      .update(holeInOnes)
      .set(dataToUpdate)
      .where(eq(holeInOnes.id, id))
      .returning();

    // Convert Date to string for HoleInOne interface
    return {
      ...holeInOne,
      createdAt: holeInOne.createdAt instanceof Date ? holeInOne.createdAt.toISOString() : holeInOne.createdAt,
      updatedAt: holeInOne.updatedAt instanceof Date ? holeInOne.updatedAt.toISOString() : holeInOne.updatedAt
    } as HoleInOne;
  }

  async deleteHoleInOne(id: number): Promise<void> {
    await db
      .delete(holeInOnes)
      .where(eq(holeInOnes.id, id));
  }
}

// Export the storage instance
export const storage = new DatabaseStorage();
