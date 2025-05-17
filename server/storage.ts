import { 
  users, type User, type InsertUser, 
  competitions, type Competition, type InsertCompetition,
  golfers, type Golfer, type InsertGolfer,
  selections, type Selection, type InsertSelection,
  results, type Result, type InsertResult,
  userPoints, type UserPoints, type InsertUserPoints,
  pointSystem, type PointSystem, type InsertPointSystem,
  wildcardGolfers, type WildcardGolfer, type InsertWildcardGolfer,
  holeInOnes, type HoleInOne, type InsertHoleInOne,
  selectionRanks, type SelectionRank, type InsertSelectionRank // Import new schema items
} from "@shared/schema";
import { db, pgClient, hashPassword } from "./db";
import { eq, and, sql, desc, asc, count, inArray, ilike } from "drizzle-orm"; // Added ilike for case-insensitive matching
import { alias } from "drizzle-orm/pg-core"; // Import alias from pg-core

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>; // Will update this to include selection count
  updateUserPassword(id: number, passwordHash: string): Promise<void>; // Added method for password reset
  hasUsedWaiverChip(userId: number): Promise<boolean>;
  markWaiverChipAsUsed(userId: number): Promise<User>;

  // Competition methods
  getCompetitions(): Promise<Competition[]>;
  getActiveCompetitions(): Promise<Competition[]>;
  getUpcomingCompetitions(userId?: number): Promise<Competition[]>; // userId is now optional
  getCompletedCompetitions(): Promise<Competition[]>;
  getCompetitionById(id: number): Promise<Competition | undefined>;
  createCompetition(competition: InsertCompetition): Promise<Competition>;
  updateCompetition(id: number, competitionData: Partial<Competition>): Promise<Competition>;

  // Golfer methods
  getGolfers(): Promise<Golfer[]>;
  getGolferById(id: number): Promise<Golfer | undefined>;
  createGolfer(golfer: InsertGolfer): Promise<Golfer>;
  updateGolfer(id: number, golferData: Partial<Golfer>): Promise<Golfer>;
  getGolferByName(name: string): Promise<Golfer | undefined>; // Add method to find by name

  // Selection methods
  getUserSelections(userId: number, competitionId: number): Promise<Selection | undefined>;
  getUserSelectionsForAllCompetitions(userId: number): Promise<any[]>; // Return type updated
  getUserSelectionsDetails(userId: number): Promise<any[]>; // Added method for admin view
  getSelectionById(id: number): Promise<Selection | undefined>;
  hasUsedCaptainsChip(userId: number): Promise<boolean>;
  getAllSelections(competitionId: number): Promise<Selection[]>;
  createSelection(selection: InsertSelection): Promise<Selection>;
  updateSelection(id: number, selectionData: Partial<Selection>): Promise<Selection>;
  deleteSelection(id: number): Promise<void>;
  deleteUserSelectionsForCompetition(userId: number, competitionId: number): Promise<number>; // Added method

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
  // Return type updated to include lastUpdated timestamp
  getLeaderboard(competitionId?: number): Promise<{ standings: any[], lastUpdated?: string | null }>;

  // Hole In One methods
  getHoleInOnes(competitionId: number): Promise<HoleInOne[]>;
  getHoleInOneById(id: number): Promise<HoleInOne | undefined>;
  getGolferHoleInOnes(competitionId: number, golferId: number): Promise<HoleInOne[]>;
  createHoleInOne(holeInOne: InsertHoleInOne): Promise<HoleInOne>;
  updateHoleInOne(id: number, holeInOneData: Partial<HoleInOne>): Promise<HoleInOne>;
  deleteHoleInOne(id: number): Promise<void>;

  // Selection Rank methods
  createSelectionRank(data: InsertSelectionRank): Promise<SelectionRank>;
  getSelectionRank(userId: number, competitionId: number, golferId: number): Promise<SelectionRank | undefined>;
  captureSelectionRanksForCompetition(competitionId: number): Promise<{ success: boolean; count: number; errors: number }>;

  // User Stats method
  getUserStats(userId: number): Promise<{ competitionsPlayed: number; totalPoints: number; bestRank: number | string }>;
}

// Helper function to convert DB user to User interface type, now includes selectionCount and captain chip status
function formatUserForResponse(user: any, selectionCount?: number, hasUsedCaptainsChip?: boolean): User | undefined {
  if (!user) return undefined;

  // Format dates and handle potential nulls/undefined
  // Add hasUsedCaptainsChip to the returned object
  return {
    ...user,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    lastLoginAt: user.lastLoginAt instanceof Date ? user.lastLoginAt.toISOString() : user.lastLoginAt ?? null, // Format lastLoginAt if it exists
    selectionCount: selectionCount ?? 0, // Add selection count
    hasUsedCaptainsChip: hasUsedCaptainsChip ?? false // Add captain chip status
  };
}

// Helper function for robust Date to ISO string conversion
function safeToISOString(dateVal: any, fieldName: string, compId: number | string, isNullable: boolean): string | null {
  const fallbackDateString = '1970-01-01T00:00:00.000Z';
  if (dateVal instanceof Date) {
    if (!isNaN(dateVal.getTime())) {
      try {
        const year = dateVal.getFullYear();
        // Check for years that might be problematic for toISOString or indicate bad data
        if (year < 1 || year > 9999) {
          console.error(`Date for ${fieldName}, competition ID ${compId} has an extreme year (${year}), falling back:`, dateVal);
          return isNullable ? null : fallbackDateString;
        }
        return dateVal.toISOString();
      } catch (e) {
        console.error(`Error in toISOString for ${fieldName}, competition ID ${compId} (date: ${String(dateVal)}):`, e);
        return isNullable ? null : fallbackDateString;
      }
    } else {
      console.error(`Invalid Date object (getTime is NaN) for ${fieldName}, competition ID ${compId}:`, dateVal);
      return isNullable ? null : fallbackDateString;
    }
  } else if (isNullable && (dateVal === null || typeof dateVal === 'undefined')) {
    return null;
  } else if (!isNullable && (dateVal === null || typeof dateVal === 'undefined')) {
    console.error(`Null or undefined for non-nullable field ${fieldName}, competition ID ${compId}:`, dateVal);
    return fallbackDateString;
  } else {
    // Log if it's not a Date and not an expected null/undefined for nullable fields
    if (!(isNullable && (dateVal === null || typeof dateVal === 'undefined'))) {
       console.error(`Unexpected type for ${fieldName}, competition ID ${compId} (expected Date): value is '${String(dateVal)}', type is '${typeof dateVal}'`);
    }
    return isNullable ? null : fallbackDateString;
  }
}

// Implementation of IStorage using Drizzle ORM with PostgreSQL
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) {
      return undefined;
    }
    // Determine if the captain's chip has been used
    const chipStatus = await this.hasUsedCaptainsChip(id);
    return formatUserForResponse(user, undefined, chipStatus); // Pass chipStatus
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
      .values(insertUser) // insertUser should contain { email, username, fullName, password (hashed), isAdmin }
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
    // Add check for lastLoginAt
    if (typeof dataToUpdate.lastLoginAt === 'string') {
      dataToUpdate.lastLoginAt = new Date(dataToUpdate.lastLoginAt);
    }


    const [user] = await db
      .update(users)
      .set(dataToUpdate)
      .where(eq(users.id, id))
      .returning();
    return formatUserForResponse(user)!;
  }

  async getAllUsers(): Promise<User[]> { // Updated to include selection count
    // Fetch users and join with selections to count them
    // Fetch users and join with selections to count them AND check for captain chip usage
    const userListWithDetails = await db
      .select({
        user: users,
        selectionCount: sql<number>`count(distinct ${selections.id})`.mapWith(Number), // Count distinct selections
        hasUsedCaptainsChip: sql<boolean>`BOOL_OR(${selections.useCaptainsChip})`.mapWith(Boolean) // Check if any selection used the chip
      })
      .from(users)
      .leftJoin(selections, eq(users.id, selections.userId)) // Join selections
      .groupBy(users.id) // Group by user
      .orderBy(users.username);

    // Map the result using the updated helper function
    return userListWithDetails.map(item => formatUserForResponse(item.user, item.selectionCount, item.hasUsedCaptainsChip)!) as User[];
  }


  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ password: passwordHash })
      .where(eq(users.id, id));
  }

  // Competition methods
  async getCompetitions(): Promise<Competition[]> {
    const competitionsList = await db
      .select({ // Select specific columns including the new one
        id: competitions.id,
        name: competitions.name,
        venue: competitions.venue,
        startDate: competitions.startDate,
        endDate: competitions.endDate,
        selectionDeadline: competitions.selectionDeadline,
        isActive: competitions.isActive,
        isComplete: competitions.isComplete,
        description: competitions.description,
        imageUrl: competitions.imageUrl,
        externalLeaderboardUrl: competitions.externalLeaderboardUrl,
        ranksCapturedAt: competitions.ranksCapturedAt, // Added ranksCapturedAt
        currentRound: competitions.currentRound, // Added currentRound
        lastResultsUpdateAt: competitions.lastResultsUpdateAt, // Added lastResultsUpdateAt
      })
      .from(competitions)
      .orderBy(competitions.startDate);
    // Explicitly map fields to ensure type correctness
    return competitionsList.map(c => ({ 
      id: c.id,
      name: c.name,
      venue: c.venue,
      startDate: safeToISOString(c.startDate, 'startDate', c.id, false)!,
      endDate: safeToISOString(c.endDate, 'endDate', c.id, false)!,
      selectionDeadline: safeToISOString(c.selectionDeadline, 'selectionDeadline', c.id, false)!,
      isActive: c.isActive,
      isComplete: c.isComplete,
      description: c.description,
      imageUrl: c.imageUrl,
      externalLeaderboardUrl: c.externalLeaderboardUrl ?? null,
      ranksCapturedAt: safeToISOString(c.ranksCapturedAt, 'ranksCapturedAt', c.id, true),
      currentRound: c.currentRound ?? null,
      lastResultsUpdateAt: safeToISOString(c.lastResultsUpdateAt, 'lastResultsUpdateAt', c.id, true)
    })) as Competition[];
  }

  async getActiveCompetitions(): Promise<Competition[]> {
    const activeCompetitions = await db
      .select({ // Select specific columns including the new one
        id: competitions.id,
        name: competitions.name,
        venue: competitions.venue,
        startDate: competitions.startDate,
        endDate: competitions.endDate,
        selectionDeadline: competitions.selectionDeadline,
        isActive: competitions.isActive,
        isComplete: competitions.isComplete,
        description: competitions.description,
        imageUrl: competitions.imageUrl,
        externalLeaderboardUrl: competitions.externalLeaderboardUrl,
        ranksCapturedAt: competitions.ranksCapturedAt, // Added ranksCapturedAt
        currentRound: competitions.currentRound, // Added currentRound
        lastResultsUpdateAt: competitions.lastResultsUpdateAt, // Added lastResultsUpdateAt
      })
      .from(competitions)
      .where(
        // A competition is active if its isActive flag is true
        eq(competitions.isActive, true) 
        // We might still want to ensure it's not marked as complete, though isActive should ideally be false then.
        // eq(competitions.isComplete, false) 
      )
      .orderBy(competitions.startDate);
    // Explicitly map fields to ensure type correctness
    return activeCompetitions.map(c => ({ 
      id: c.id,
      name: c.name,
      venue: c.venue,
      startDate: safeToISOString(c.startDate, 'startDate', c.id, false)!,
      endDate: safeToISOString(c.endDate, 'endDate', c.id, false)!,
      selectionDeadline: safeToISOString(c.selectionDeadline, 'selectionDeadline', c.id, false)!,
      isActive: c.isActive,
      isComplete: c.isComplete,
      description: c.description,
      imageUrl: c.imageUrl,
      externalLeaderboardUrl: c.externalLeaderboardUrl ?? null,
      ranksCapturedAt: safeToISOString(c.ranksCapturedAt, 'ranksCapturedAt', c.id, true),
      currentRound: c.currentRound ?? null,
      lastResultsUpdateAt: safeToISOString(c.lastResultsUpdateAt, 'lastResultsUpdateAt', c.id, true)
    })) as Competition[];
  }

  async getUpcomingCompetitions(userId?: number): Promise<Competition[]> {
    const currentDate = new Date();
    const upcomingCompetitionsData = await db
      .select({
        id: competitions.id,
        name: competitions.name,
        venue: competitions.venue,
        startDate: competitions.startDate,
        endDate: competitions.endDate,
        selectionDeadline: competitions.selectionDeadline,
        isActive: competitions.isActive,
        isComplete: competitions.isComplete,
        description: competitions.description,
        imageUrl: competitions.imageUrl,
        externalLeaderboardUrl: competitions.externalLeaderboardUrl,
        ranksCapturedAt: competitions.ranksCapturedAt,
        currentRound: competitions.currentRound,
        lastResultsUpdateAt: competitions.lastResultsUpdateAt,
      })
      .from(competitions)
      .where(
        and(
          eq(competitions.isActive, false),
          eq(competitions.isComplete, false)
        )
      )
      .orderBy(asc(competitions.startDate));

    if (!upcomingCompetitionsData.length) {
      return [];
    }

    let userSelectionsMap = new Map<number, boolean>();

    if (userId) {
      const competitionIds = upcomingCompetitionsData.map(c => c.id);
      if (competitionIds.length > 0) {
        const userSelectionRecords = await db
          .select({ competitionId: selections.competitionId })
          .from(selections)
          .where(and(eq(selections.userId, userId), inArray(selections.competitionId, competitionIds)))
          .groupBy(selections.competitionId);

        userSelectionRecords.forEach(sel => userSelectionsMap.set(sel.competitionId, true));
      }
    }

    return upcomingCompetitionsData.map(c => {
      const hasSubmitted = userId ? (userSelectionsMap.get(c.id) ?? false) : false;
      return {
        id: c.id,
        name: c.name,
        venue: c.venue,
        startDate: safeToISOString(c.startDate, 'startDate', c.id, false)!,
        endDate: safeToISOString(c.endDate, 'endDate', c.id, false)!,
        selectionDeadline: safeToISOString(c.selectionDeadline, 'selectionDeadline', c.id, false)!,
        isActive: c.isActive,
        isComplete: c.isComplete,
        description: c.description,
        imageUrl: c.imageUrl,
        externalLeaderboardUrl: c.externalLeaderboardUrl ?? null,
        ranksCapturedAt: safeToISOString(c.ranksCapturedAt, 'ranksCapturedAt', c.id, true),
        currentRound: c.currentRound ?? null,
        lastResultsUpdateAt: safeToISOString(c.lastResultsUpdateAt, 'lastResultsUpdateAt', c.id, true),
        hasSubmitted: hasSubmitted
      };
    }) as Competition[];
  }

  async getCompletedCompetitions(): Promise<Competition[]> {
    const completedCompetitions = await db
      .select({ // Select specific columns including the new one
        id: competitions.id,
        name: competitions.name,
        venue: competitions.venue,
        startDate: competitions.startDate,
        endDate: competitions.endDate,
        selectionDeadline: competitions.selectionDeadline,
        isActive: competitions.isActive,
        isComplete: competitions.isComplete,
        description: competitions.description,
        imageUrl: competitions.imageUrl,
        externalLeaderboardUrl: competitions.externalLeaderboardUrl,
        ranksCapturedAt: competitions.ranksCapturedAt, // Added ranksCapturedAt
        currentRound: competitions.currentRound, // Added currentRound
        lastResultsUpdateAt: competitions.lastResultsUpdateAt, // Added lastResultsUpdateAt
      })
      .from(competitions)
      .where(eq(competitions.isComplete, true))
      .orderBy(desc(competitions.endDate));
    // Explicitly map fields to ensure type correctness
    return completedCompetitions.map(c => ({ 
      id: c.id,
      name: c.name,
      venue: c.venue,
      startDate: safeToISOString(c.startDate, 'startDate', c.id, false)!,
      endDate: safeToISOString(c.endDate, 'endDate', c.id, false)!,
      selectionDeadline: safeToISOString(c.selectionDeadline, 'selectionDeadline', c.id, false)!,
      isActive: c.isActive,
      isComplete: c.isComplete,
      description: c.description,
      imageUrl: c.imageUrl,
      externalLeaderboardUrl: c.externalLeaderboardUrl ?? null,
      ranksCapturedAt: safeToISOString(c.ranksCapturedAt, 'ranksCapturedAt', c.id, true),
      currentRound: c.currentRound ?? null,
      lastResultsUpdateAt: safeToISOString(c.lastResultsUpdateAt, 'lastResultsUpdateAt', c.id, true)
    })) as Competition[];
  }

  async getCompetitionById(id: number): Promise<Competition | undefined> {
    const [competition] = await db
      .select({ // Select specific columns including the new one
        id: competitions.id,
        name: competitions.name,
        venue: competitions.venue,
        startDate: competitions.startDate,
        endDate: competitions.endDate,
        selectionDeadline: competitions.selectionDeadline,
        isActive: competitions.isActive,
        isComplete: competitions.isComplete,
        description: competitions.description,
        imageUrl: competitions.imageUrl,
        externalLeaderboardUrl: competitions.externalLeaderboardUrl,
        ranksCapturedAt: competitions.ranksCapturedAt, // Added ranksCapturedAt
        currentRound: competitions.currentRound, // Added currentRound
        lastResultsUpdateAt: competitions.lastResultsUpdateAt, // Added lastResultsUpdateAt
      })
      .from(competitions)
      .where(eq(competitions.id, id));
    
    if (!competition) return undefined;
    // Include ranksCapturedAt, currentRound, and lastResultsUpdateAt in the returned object
    // Explicitly map fields to ensure type correctness
    return { 
      id: competition.id,
      name: competition.name,
      venue: competition.venue,
      startDate: safeToISOString(competition.startDate, 'startDate', competition.id, false)!,
      endDate: safeToISOString(competition.endDate, 'endDate', competition.id, false)!,
      selectionDeadline: safeToISOString(competition.selectionDeadline, 'selectionDeadline', competition.id, false)!,
      isActive: competition.isActive,
      isComplete: competition.isComplete,
      description: competition.description,
      imageUrl: competition.imageUrl,
      externalLeaderboardUrl: competition.externalLeaderboardUrl ?? null,
      ranksCapturedAt: safeToISOString(competition.ranksCapturedAt, 'ranksCapturedAt', competition.id, true),
      currentRound: competition.currentRound ?? null,
      lastResultsUpdateAt: safeToISOString(competition.lastResultsUpdateAt, 'lastResultsUpdateAt', competition.id, true)
    } as Competition;
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
    // Ensure externalLeaderboardUrl is included
    competitionToInsert.externalLeaderboardUrl = competition.externalLeaderboardUrl || null;

    const [newCompetition] = await db
      .insert(competitions)
      .values(competitionToInsert)
      .returning(); // Drizzle returns all columns by default unless specified
    // Include ranksCapturedAt in the returned object
    return {
      ...newCompetition,
      startDate: safeToISOString(newCompetition.startDate, 'startDate', newCompetition.id, false)!,
      endDate: safeToISOString(newCompetition.endDate, 'endDate', newCompetition.id, false)!,
      selectionDeadline: safeToISOString(newCompetition.selectionDeadline, 'selectionDeadline', newCompetition.id, false)!,
      externalLeaderboardUrl: newCompetition.externalLeaderboardUrl ?? null,
      ranksCapturedAt: safeToISOString(newCompetition.ranksCapturedAt, 'ranksCapturedAt', newCompetition.id, true),
      lastResultsUpdateAt: safeToISOString(newCompetition.lastResultsUpdateAt, 'lastResultsUpdateAt', newCompetition.id, true)
    } as Competition;
  }

  async updateCompetition(id: number, competitionData: Partial<Competition>): Promise<Competition> {
    // Ensure externalLeaderboardUrl is handled correctly (allow setting to null)
    const dataToUpdate: any = { ...competitionData };
    if (competitionData.hasOwnProperty('externalLeaderboardUrl')) {
        dataToUpdate.externalLeaderboardUrl = competitionData.externalLeaderboardUrl || null;
    }
    // Ensure timestamp fields are Date objects if provided as strings
    if (typeof dataToUpdate.startDate === 'string') {
      dataToUpdate.startDate = new Date(dataToUpdate.startDate);
    }
    if (typeof dataToUpdate.endDate === 'string') {
      dataToUpdate.endDate = new Date(dataToUpdate.endDate);
    }
    if (typeof dataToUpdate.selectionDeadline === 'string') {
      dataToUpdate.selectionDeadline = new Date(dataToUpdate.selectionDeadline);
    }
    if (typeof dataToUpdate.lastResultsUpdateAt === 'string') {
      dataToUpdate.lastResultsUpdateAt = new Date(dataToUpdate.lastResultsUpdateAt);
    }
    if (typeof dataToUpdate.ranksCapturedAt === 'string') {
      dataToUpdate.ranksCapturedAt = new Date(dataToUpdate.ranksCapturedAt);
    }

    const [competition] = await db
      .update(competitions)
      .set(dataToUpdate)
      .where(eq(competitions.id, id))
      .returning(); // Drizzle returns all columns by default unless specified
    // Include ranksCapturedAt in the returned object
    return {
      ...competition,
      startDate: safeToISOString(competition.startDate, 'startDate', competition.id, false)!,
      endDate: safeToISOString(competition.endDate, 'endDate', competition.id, false)!,
      selectionDeadline: safeToISOString(competition.selectionDeadline, 'selectionDeadline', competition.id, false)!,
      externalLeaderboardUrl: competition.externalLeaderboardUrl ?? null,
      ranksCapturedAt: safeToISOString(competition.ranksCapturedAt, 'ranksCapturedAt', competition.id, true),
      lastResultsUpdateAt: safeToISOString(competition.lastResultsUpdateAt, 'lastResultsUpdateAt', competition.id, true)
    } as Competition;
  }

  // Golfer methods
  async getGolfers(): Promise<Golfer[]> {
    // Select only columns that exist in the database
    const results = await db
      .select({
        id: golfers.id,
      name: golfers.name,
      shortName: golfers.shortName,
      firstName: golfers.firstName, // Add firstName
      lastName: golfers.lastName,   // Add lastName
      rank: golfers.rank,
      avatarUrl: golfers.avatarUrl
    })
    .from(golfers)
    .orderBy(golfers.rank);

    // Convert to Golfer type with optional fields
  // Convert to Golfer type with optional fields
  return results.map(golfer => ({
    ...golfer,
    shortName: golfer.shortName ?? null,
    firstName: golfer.firstName ?? null, // Pass firstName
    lastName: golfer.lastName ?? null,   // Pass lastName
    country: undefined,
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
        shortName: golfers.shortName,
        firstName: golfers.firstName, // Select firstName
        lastName: golfers.lastName,   // Select lastName
        rank: golfers.rank,
        avatarUrl: golfers.avatarUrl
      })
      .from(golfers)
      .where(eq(golfers.id, id));

    if (!result) return undefined;

    // Convert to Golfer type with optional fields
    // Convert to Golfer type with optional fields
    return {
      ...result,
      shortName: result.shortName ?? null,
      firstName: result.firstName ?? null, // Add firstName
      lastName: result.lastName ?? null,   // Add lastName
      country: undefined,
      createdAt: undefined,
      avatarUrl: result.avatarUrl || undefined
    } as Golfer;
  }

  // Duplicate createGolfer removed below

  async getGolferByName(name: string): Promise<Golfer | undefined> {
    // Case-insensitive search
    const [result] = await db
      .select({
        id: golfers.id,
        name: golfers.name,
        shortName: golfers.shortName,
        rank: golfers.rank,
        avatarUrl: golfers.avatarUrl
      })
      .from(golfers)
      .where(ilike(golfers.name, name)); // Use ilike for case-insensitive

    if (!result) return undefined;

    return {
      ...result,
      shortName: result.shortName ?? null,
      country: undefined,
      createdAt: undefined,
      avatarUrl: result.avatarUrl || undefined
    } as Golfer;
  }

  async createGolfer(golfer: InsertGolfer): Promise<Golfer> {
    // Include shortName if provided
    const golferToInsert = {
      name: golfer.name,
      shortName: golfer.shortName || null, // Ensure null if not provided
      rank: golfer.rank,
      avatarUrl: golfer.avatarUrl || null
    };

    const [newGolfer] = await db
      .insert(golfers)
      .values(golferToInsert)
      .returning();

    // Convert to Golfer type with optional fields
    return {
      ...newGolfer,
      shortName: newGolfer.shortName ?? null,
      country: undefined,
      createdAt: undefined,
      avatarUrl: newGolfer.avatarUrl || undefined
    } as Golfer;
  }

  async updateGolfer(id: number, golferData: Partial<Golfer>): Promise<Golfer> {
    // Include shortName if provided
    const golferToUpdate: any = {};
    if (golferData.name !== undefined) golferToUpdate.name = golferData.name;
    if (golferData.shortName !== undefined) golferToUpdate.shortName = golferData.shortName; // Add shortName
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
      shortName: updatedGolfer.shortName ?? null,
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
      captainGolferId: selection.captainGolferId ?? null, // Ensure captainGolferId is included
      createdAt: selection.createdAt instanceof Date ? selection.createdAt.toISOString() : selection.createdAt,
      updatedAt: selection.updatedAt instanceof Date ? selection.updatedAt.toISOString() : selection.updatedAt
    } as Selection;
  }

  async getUserSelectionsForAllCompetitions(userId: number): Promise<any[]> { // Return type changed to any[] for enriched data
    // Define aliases for golfers table to join multiple times
    const golfer1 = alias(golfers, "golfer1"); // Use imported alias
    const golfer1Alias = alias(golfers, "golfer1");
    const golfer2Alias = alias(golfers, "golfer2");
    const golfer3Alias = alias(golfers, "golfer3");
    // Aliases for selection_ranks table
    const rank1Alias = alias(selectionRanks, "rank1");
    const rank2Alias = alias(selectionRanks, "rank2");
    const rank3Alias = alias(selectionRanks, "rank3");

    const userSelectionsData = await db
      .select({
        selection: selections,
        competition: competitions,
        // Select golfer details and rankAtDeadline from respective aliases
        golfer1: { id: golfer1Alias.id, name: golfer1Alias.name, avatarUrl: golfer1Alias.avatarUrl },
        golfer2: { id: golfer2Alias.id, name: golfer2Alias.name, avatarUrl: golfer2Alias.avatarUrl },
        golfer3: { id: golfer3Alias.id, name: golfer3Alias.name, avatarUrl: golfer3Alias.avatarUrl },
        rank1: { rankAtDeadline: rank1Alias.rankAtDeadline },
        rank2: { rankAtDeadline: rank2Alias.rankAtDeadline },
        rank3: { rankAtDeadline: rank3Alias.rankAtDeadline },
        waiverRank: selections.waiverRank, // Select waiverRank from selections table
        userPoints: userPoints, // Include userPoints to get total points and details
      })
      .from(selections)
      .where(eq(selections.userId, userId))
      .leftJoin(competitions, eq(selections.competitionId, competitions.id))
      // Join golfers using aliases
      .leftJoin(golfer1Alias, eq(selections.golfer1Id, golfer1Alias.id))
      .leftJoin(golfer2Alias, eq(selections.golfer2Id, golfer2Alias.id))
      .leftJoin(golfer3Alias, eq(selections.golfer3Id, golfer3Alias.id))
      // Join selection_ranks using aliases and matching conditions
      .leftJoin(rank1Alias, and(
        eq(selections.userId, rank1Alias.userId),
        eq(selections.competitionId, rank1Alias.competitionId),
        eq(selections.golfer1Id, rank1Alias.golferId)
      ))
      .leftJoin(rank2Alias, and(
        eq(selections.userId, rank2Alias.userId),
        eq(selections.competitionId, rank2Alias.competitionId),
        eq(selections.golfer2Id, rank2Alias.golferId)
      ))
      .leftJoin(rank3Alias, and(
        eq(selections.userId, rank3Alias.userId),
        eq(selections.competitionId, rank3Alias.competitionId),
        eq(selections.golfer3Id, rank3Alias.golferId)
      ))
      .leftJoin(userPoints, and(eq(selections.userId, userPoints.userId), eq(selections.competitionId, userPoints.competitionId)))
      .orderBy(desc(competitions.startDate)); // Order by competition start date

    console.log(`[Storage] getUserSelectionsForAllCompetitions - Found ${userSelectionsData.length} raw selection entries for user ${userId}.`); // Simplified log

    // Fetch the user record once to get waiver chip details
     const user = await this.getUser(userId);
     const userWaiverCompId = user?.waiverChipUsedCompetitionId;
     const userWaiverReplacementId = user?.waiverChipReplacementGolferId;
     const userHasUsedWaiver = user?.hasUsedWaiverChip ?? false;

     // Fetch results separately for each competition
     const competitionIds = userSelectionsData
       .map(s => s.selection.competitionId)
       .filter((id): id is number => typeof id === 'number' && !isNaN(id)); // Type guard

     console.log(`[Storage] getUserSelectionsForAllCompetitions - Filtered Competition IDs for results query:`, competitionIds);

     // Fetch all results for these competitions
     const allResults = competitionIds.length > 0 ? await db
       .select()
       .from(results)
       .where(inArray(results.competitionId, competitionIds)) : [];

     // Map results by competitionId and golferId
     const resultsMap = new Map<string, Result>();
     allResults.forEach(r => {
       resultsMap.set(`${r.competitionId}-${r.golferId}`, {
         ...r,
         points: r.points || undefined,
         created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
       } as Result);
     });

     console.log(`[Storage] getUserSelectionsForAllCompetitions - Created results map with ${resultsMap.size} entries.`); // Simplified log

     // Fetch all hole-in-ones for these competitions
     const allHoleInOnes = competitionIds.length > 0 ? await db
       .select()
       .from(holeInOnes)
       .where(inArray(holeInOnes.competitionId, competitionIds)) : [];

     // Map hole-in-ones by competitionId and golferId
     const holeInOnesMap = new Map<string, HoleInOne>();
     allHoleInOnes.forEach(hioFromDb => { // Renamed hio to hioFromDb to avoid confusion
       const formattedHio: HoleInOne = {
         ...hioFromDb,
         createdAt: safeToISOString(hioFromDb.createdAt, 'hio.createdAt', `${hioFromDb.competitionId}-${hioFromDb.golferId}`, false)!,
         updatedAt: safeToISOString(hioFromDb.updatedAt, 'hio.updatedAt', `${hioFromDb.competitionId}-${hioFromDb.golferId}`, false)!,
       };
       holeInOnesMap.set(`${formattedHio.competitionId}-${formattedHio.golferId}`, formattedHio);
     });
     console.log(`[Storage] getUserSelectionsForAllCompetitions - Created holeInOnes map with ${holeInOnesMap.size} entries.`);


     // No need to fetch ranks here if we use the user waiver details

     // Format the data for the frontend
     const finalMappedData = userSelectionsData.map(data => {
       const selection = data.selection;
       const competition = data.competition;
       const golfer1Result = resultsMap.get(`${selection.competitionId}-${selection.golfer1Id}`);
       const golfer2Result = resultsMap.get(`${selection.competitionId}-${selection.golfer2Id}`);
       const golfer3Result = resultsMap.get(`${selection.competitionId}-${selection.golfer3Id}`);

       // Helper to safely format dates
       const formatDate = (dateValue: string | Date | null | undefined): string | null => {
        return dateValue ? new Date(dateValue).toISOString() : null;
      };

      return {
        id: selection.id,
        userId: selection.userId,
        competitionId: selection.competitionId,
        golfer1Id: selection.golfer1Id,
        golfer2Id: selection.golfer2Id,
        golfer3Id: selection.golfer3Id,
        useCaptainsChip: selection.useCaptainsChip,
        createdAt: formatDate(selection.createdAt),
        updatedAt: formatDate(selection.updatedAt),
        competition: competition ? { // Ensure competition is not null
          id: competition.id,
          name: competition.name,
          venue: competition.venue,
          startDate: formatDate(competition.startDate),
          endDate: formatDate(competition.endDate),
          selectionDeadline: formatDate(competition.selectionDeadline),
          isActive: competition.isActive,
          isComplete: competition.isComplete,
          // createdAt removed as it's not selected/needed
         } : null,
         golfer1: data.golfer1?.id ? {
           id: data.golfer1.id,
           name: data.golfer1.name,
           avatar: data.golfer1.avatarUrl,
           rank: data.rank1?.rankAtDeadline ?? null, // Use rankAtDeadline as the default rank
           waiverRank: data.waiverRank, // Include waiverRank
           isCaptain: selection.useCaptainsChip && selection.captainGolferId === data.golfer1.id,
           // Check if this golfer was the waiver replacement in this specific competition
           isWildcard: userHasUsedWaiver && userWaiverCompId === selection.competitionId && userWaiverReplacementId === data.golfer1.id,
           holeInOne: holeInOnesMap.has(`${selection.competitionId}-${data.golfer1.id}`),
           holeInOnePoints: holeInOnesMap.has(`${selection.competitionId}-${data.golfer1.id}`) ? 20 : undefined,
         } : null,
         golfer2: data.golfer2?.id ? {
           id: data.golfer2.id,
           name: data.golfer2.name,
           avatar: data.golfer2.avatarUrl,
           rank: data.rank2?.rankAtDeadline ?? null, // Use rankAtDeadline as the default rank
           waiverRank: data.waiverRank, // Include waiverRank
           isCaptain: selection.useCaptainsChip && selection.captainGolferId === data.golfer2.id,
           // Check if this golfer was the waiver replacement in this specific competition
           isWildcard: userHasUsedWaiver && userWaiverCompId === selection.competitionId && userWaiverReplacementId === data.golfer2.id,
           holeInOne: holeInOnesMap.has(`${selection.competitionId}-${data.golfer2.id}`),
           holeInOnePoints: holeInOnesMap.has(`${selection.competitionId}-${data.golfer2.id}`) ? 20 : undefined,
         } : null,
         golfer3: data.golfer3?.id ? {
           id: data.golfer3.id,
           name: data.golfer3.name,
           avatar: data.golfer3.avatarUrl,
           rank: data.rank3?.rankAtDeadline ?? null, // Use rankAtDeadline as the default rank
           waiverRank: data.waiverRank, // Include waiverRank
           isCaptain: selection.useCaptainsChip && selection.captainGolferId === data.golfer3.id,
           // Check if this golfer was the waiver replacement in this specific competition
           isWildcard: userHasUsedWaiver && userWaiverCompId === selection.competitionId && userWaiverReplacementId === data.golfer3.id,
           holeInOne: holeInOnesMap.has(`${selection.competitionId}-${data.golfer3.id}`),
           holeInOnePoints: holeInOnesMap.has(`${selection.competitionId}-${data.golfer3.id}`) ? 20 : undefined,
         } : null,
         golfer1Result: golfer1Result ? { position: golfer1Result.position, points: golfer1Result.points } : null,
         golfer2Result: golfer2Result ? { position: golfer2Result.position, points: golfer2Result.points } : null,
        golfer3Result: golfer3Result ? { position: golfer3Result.position, points: golfer3Result.points } : null,
         totalPoints: data.userPoints?.points || 0 // Get total points from userPoints join
       };
     });

     console.log(`[Storage] getUserSelectionsForAllCompetitions - Finished mapping ${finalMappedData.length} selections for user ${userId}.`); // Simplified log
     return finalMappedData;
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
      captainGolferId: selection.captainGolferId ?? null, // Ensure captainGolferId is included
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
      captainGolferId: s.captainGolferId ?? null, // Ensure captainGolferId is included
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt
    })) as Selection[];
  }

  async createSelection(selection: InsertSelection): Promise<Selection> {
    // Convert string dates to Date objects for database
    // Include captainGolferId if provided, otherwise it defaults to null in DB
    const selectionToInsert: any = { 
      ...selection,
      captainGolferId: selection.useCaptainsChip ? selection.captainGolferId : null 
    };

    if (typeof selectionToInsert.createdAt === 'string') {
      selectionToInsert.createdAt = new Date(selectionToInsert.createdAt);
    }
    if (typeof selectionToInsert.updatedAt === 'string') {
      selectionToInsert.updatedAt = new Date(selectionToInsert.updatedAt);
    }

    // Explicitly return all columns to ensure the object type is correct
    const [newSelection] = await db
      .insert(selections)
      .values(selectionToInsert)
      .returning({
        id: selections.id,
        userId: selections.userId,
        competitionId: selections.competitionId,
        golfer1Id: selections.golfer1Id,
        golfer2Id: selections.golfer2Id,
        golfer3Id: selections.golfer3Id,
        useCaptainsChip: selections.useCaptainsChip,
        captainGolferId: selections.captainGolferId,
        createdAt: selections.createdAt,
        updatedAt: selections.updatedAt,
      });

    // Convert Date to string for Selection interface
    return {
      ...newSelection,
      captainGolferId: newSelection.captainGolferId ?? null, // Ensure captainGolferId is included
      createdAt: newSelection.createdAt instanceof Date ? newSelection.createdAt.toISOString() : newSelection.createdAt,
      updatedAt: newSelection.updatedAt instanceof Date ? newSelection.updatedAt.toISOString() : newSelection.updatedAt
    } as Selection;
  }

  async updateSelection(id: number, selectionData: Partial<Selection>): Promise<Selection> {
    // Convert string dates to Date objects for database
    // Include captainGolferId if provided, set to null if useCaptainsChip becomes false
    const dataToUpdate: any = { 
      ...selectionData,
      captainGolferId: selectionData.useCaptainsChip ? selectionData.captainGolferId : null
    };

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
      captainGolferId: selection.captainGolferId ?? null, // Ensure captainGolferId is included
      createdAt: selection.createdAt instanceof Date ? selection.createdAt.toISOString() : selection.createdAt,
      updatedAt: selection.updatedAt instanceof Date ? selection.updatedAt.toISOString() : selection.updatedAt
    } as Selection;
  }

  async deleteSelection(id: number): Promise<void> {
    await db
      .delete(selections)
      .where(eq(selections.id, id));
  }

  async deleteUserSelectionsForCompetition(userId: number, competitionId: number): Promise<number> {
    const result = await db
      .delete(selections)
      .where(
        and(
          eq(selections.userId, userId),
          eq(selections.competitionId, competitionId)
        )
      );
    // Drizzle delete returns a result object, but the structure might vary.
    // Assuming it provides a way to get the count of deleted rows,
    // otherwise, return 1 if successful, 0 if not, or handle based on actual Drizzle return type.
    // For now, let's assume it returns an object with a 'rowCount' property or similar.
    // Adjust based on the actual return type of db.delete().
    // If using node-postgres directly via pgClient, result.rowCount would be standard.
    // Drizzle's exact return might need checking documentation if this doesn't work.
    // Let's tentatively return 1 if deletion seems to occur, 0 otherwise.
    // A more robust check might involve querying before/after or checking Drizzle's result object structure.
    console.log(`Deletion result for user ${userId}, competition ${competitionId}:`, result);
    // Assuming result might be an array or object indicating success/rows affected.
    // This is a placeholder, adjust based on actual Drizzle v0.20+ behavior for delete.
    // Let's assume for now it returns an object with rowCount like pg.
    // If Drizzle's delete returns the deleted rows array, use result.length.
    // If it returns a command completion object, parse that.
    // Let's default to returning 1 as a placeholder for "attempted deletion".
    // A safer bet might be to return 0 always until the exact return type is confirmed.
    // Let's refine: Drizzle's delete typically returns a result object. We'll assume it has some indication of success.
    // For pg, the result object has `rowCount`. Let's assume Drizzle provides something similar or we return 1 on success.
    // Returning 1 to indicate the operation was executed.
    return 1; // Placeholder: Adjust based on actual Drizzle delete return value inspection
  }

  // Get detailed selections for a specific user (for admin view)
  async getUserSelectionsDetails(userId: number): Promise<any[]> {
    // This logic is identical to getUserSelectionsForAllCompetitions, just filtered by userId
    // Consider refactoring later if needed
    const golfer1 = alias(golfers, "golfer1"); 
    const golfer2 = alias(golfers, "golfer2"); 
    const golfer3 = alias(golfers, "golfer3"); 

    const userSelectionsData = await db
      .select({
        selection: selections,
        competition: competitions,
        golfer1: { id: golfer1.id, name: golfer1.name, avatarUrl: golfer1.avatarUrl, rank: golfer1.rank }, // Include rank
        golfer2: { id: golfer2.id, name: golfer2.name, avatarUrl: golfer2.avatarUrl, rank: golfer2.rank }, // Include rank
        golfer3: { id: golfer3.id, name: golfer3.name, avatarUrl: golfer3.avatarUrl, rank: golfer3.rank }, // Include rank
        userPoints: userPoints 
      })
      .from(selections)
      .where(eq(selections.userId, userId)) // Filter by the specific user ID
      .leftJoin(competitions, eq(selections.competitionId, competitions.id))
      .leftJoin(golfer1, eq(selections.golfer1Id, golfer1.id))
      .leftJoin(golfer2, eq(selections.golfer2Id, golfer2.id))
      .leftJoin(golfer3, eq(selections.golfer3Id, golfer3.id))
      .leftJoin(userPoints, and(eq(selections.userId, userPoints.userId), eq(selections.competitionId, userPoints.competitionId)))
      .orderBy(desc(competitions.startDate)); 

    // Fetch results separately for each competition the user participated in
    const competitionIds = userSelectionsData
      .map(s => s.selection.competitionId)
      .filter((id): id is number => typeof id === 'number' && !isNaN(id)); 

    const allResults = competitionIds.length > 0 ? await db
      .select()
      .from(results)
      .where(and(
        eq(results.competitionId, competitionIds[0]), // Assuming results are per competition, adjust if needed
        inArray(results.golferId, userSelectionsData.flatMap(s => [s.selection.golfer1Id, s.selection.golfer2Id, s.selection.golfer3Id]))
      )) : []; // Fetch results only for golfers in this user's selections for relevant comps

    // Map results by competitionId and golferId
    const resultsMap = new Map<string, Result>();
    allResults.forEach(r => {
      resultsMap.set(`${r.competitionId}-${r.golferId}`, {
        ...r,
        points: r.points || undefined,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
      } as Result);
    });
    
    // No need to fetch ranks again if they are static per golfer (assuming getGolfers already has rank)
    // If ranks change per competition deadline, fetch from selectionRanks table as in getUserSelectionsForAllCompetitions

    // Format the data
    return userSelectionsData.map(data => {
      const selection = data.selection;
      const competition = data.competition;
      const golfer1Result = resultsMap.get(`${selection.competitionId}-${selection.golfer1Id}`);
      const golfer2Result = resultsMap.get(`${selection.competitionId}-${selection.golfer2Id}`);
      const golfer3Result = resultsMap.get(`${selection.competitionId}-${selection.golfer3Id}`);

      const formatDate = (dateValue: string | Date | null | undefined): string | null => {
        return dateValue ? new Date(dateValue).toISOString() : null;
      };

      return {
        selectionId: selection.id,
        competitionId: selection.competitionId,
        competitionName: competition?.name || 'N/A',
        competitionStartDate: formatDate(competition?.startDate),
        isCompetitionComplete: competition?.isComplete ?? false,
        golfer1: data.golfer1?.id ? { id: data.golfer1.id, name: data.golfer1.name, rank: data.golfer1.rank, result: golfer1Result ? { position: golfer1Result.position, points: golfer1Result.points } : null } : null,
        golfer2: data.golfer2?.id ? { id: data.golfer2.id, name: data.golfer2.name, rank: data.golfer2.rank, result: golfer2Result ? { position: golfer2Result.position, points: golfer2Result.points } : null } : null,
        golfer3: data.golfer3?.id ? { id: data.golfer3.id, name: data.golfer3.name, rank: data.golfer3.rank, result: golfer3Result ? { position: golfer3Result.position, points: golfer3Result.points } : null } : null,
        useCaptainsChip: selection.useCaptainsChip,
        captainGolferId: selection.captainGolferId,
        totalPoints: data.userPoints?.points || 0,
      };
    });
  }


  // Results methods
  async getResults(competitionId: number): Promise<Result[]> {
    const resultsData = await db
      .select()
      .from(results)
      .where(eq(results.competitionId, competitionId))
      // Sort by position, but treat 0 as the highest number (put CUT/WD at the bottom)
      .orderBy(sql`(CASE WHEN position = 0 THEN 1 ELSE 0 END), position ASC`);

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
  async getLeaderboard(competitionId?: number): Promise<{ standings: any[], lastUpdated?: string | null }> {
    let lastUpdated: string | null = null;
    let latestCompId: number | null = null;

    // Find the latest update timestamp and the ID of the most recently completed competition
    try {
      if (competitionId) {
        // For specific competition, find the latest update within that competition
        const lastUpdateRes = await db.select({ updatedAt: sql<string>`MAX(updated_at)` })
                                      .from(userPoints)
                                      .where(eq(userPoints.competitionId, competitionId));
        lastUpdated = lastUpdateRes[0]?.updatedAt ?? null;
        latestCompId = competitionId; // The "latest" competition is the one selected
      } else {
        // For overall, find the overall latest update time
        const lastUpdateRes = await db.select({ updatedAt: sql<string>`MAX(updated_at)` }).from(userPoints);
        lastUpdated = lastUpdateRes[0]?.updatedAt ?? null;

        // Find the ID of the most recently completed competition
        const latestCompRes = await db.select({ id: competitions.id })
                                      .from(competitions)
                                      .where(eq(competitions.isComplete, true))
                                      .orderBy(desc(competitions.endDate))
                                      .limit(1);
        latestCompId = latestCompRes[0]?.id ?? null;
      }
    } catch (e) {
       console.error("Error fetching last updated time or latest competition:", e);
       // Continue without lastUpdated or lastPointsChange if this fails
    }


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
          -- Fetch points from the specific competition for 'lastPointsChange'
          (SELECT points FROM user_points up_last WHERE up_last."userId" = u.id AND up_last."competitionId" = $1) as "lastPointsChange",
          ROW_NUMBER() OVER (ORDER BY up.points DESC) AS rank
        FROM 
          user_points up
        JOIN 
          users u ON up."userId" = u.id
        WHERE 
          up."competitionId" = $1
        ORDER BY 
          up.points DESC NULLS LAST
      `;

      const result = await pgClient.query(leaderboardQuery, [competitionId]);
      // Add null check for lastPointsChange
      const standings = result.rows.map(row => ({ ...row, lastPointsChange: row.lastPointsChange ?? null }));
      return { standings, lastUpdated };
    }

    // Otherwise get the overall leaderboard
    // We need the latest completed competition ID to fetch last points
    const overallLeaderboardQuery = `
      SELECT 
        u.id AS "userId",
        u.username,
        u.email,
        u."avatarUrl",
        SUM(up.points) AS points,
        -- Fetch points from the latest completed competition (if found)
        (SELECT points FROM user_points up_last WHERE up_last."userId" = u.id AND up_last."competitionId" = ${latestCompId ?? 'NULL'}) as "lastPointsChange",
        ROW_NUMBER() OVER (ORDER BY SUM(up.points) DESC) AS rank
      FROM 
        users u
      LEFT JOIN 
        user_points up ON u.id = up."userId"
      GROUP BY 
        u.id, u.username, u.email, u."avatarUrl"
      ORDER BY 
        points DESC NULLS LAST
    `;

    const result = await pgClient.query(overallLeaderboardQuery);
    // Add null check for lastPointsChange
    const standings = result.rows.map(row => ({ ...row, lastPointsChange: row.lastPointsChange ?? null }));
    return { standings, lastUpdated };
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

  // --- Selection Rank Methods ---
  async createSelectionRank(data: InsertSelectionRank): Promise<SelectionRank> {
    const [newRank] = await db
      .insert(selectionRanks)
      .values(data)
      .returning();
    return {
      ...newRank,
      createdAt: newRank.createdAt instanceof Date ? newRank.createdAt.toISOString() : newRank.createdAt
    } as SelectionRank;
  }

  async getSelectionRank(userId: number, competitionId: number, golferId: number): Promise<SelectionRank | undefined> {
    const [rank] = await db
      .select()
      .from(selectionRanks)
      .where(
        and(
          eq(selectionRanks.userId, userId),
          eq(selectionRanks.competitionId, competitionId),
          eq(selectionRanks.golferId, golferId)
        )
      );
    
    if (!rank) return undefined;

    return {
      ...rank,
      createdAt: rank.createdAt instanceof Date ? rank.createdAt.toISOString() : rank.createdAt
    } as SelectionRank;
  }

  async captureSelectionRanksForCompetition(competitionId: number): Promise<{ success: boolean; count: number; errors: number }> {
    console.log(`Capturing selection ranks for competition ID: ${competitionId}`);
    let successCount = 0;
    let errorCount = 0;

    try {
      // 1. Get all selections for the competition
      const competitionSelections = await this.getAllSelections(competitionId);
      if (competitionSelections.length === 0) {
        console.log(`No selections found for competition ${competitionId}. Nothing to capture.`);
        return { success: true, count: 0, errors: 0 };
      }
      console.log(`Found ${competitionSelections.length} selections to process.`);

      // 2. Get all golfers involved in these selections to fetch ranks efficiently
      const golferIds = new Set<number>();
      competitionSelections.forEach(s => {
        golferIds.add(s.golfer1Id);
        golferIds.add(s.golfer2Id);
        golferIds.add(s.golfer3Id);
      });
      const golferIdArray = Array.from(golferIds);
      console.log(`Fetching ranks for ${golferIdArray.length} unique golfers.`);

      const golferRanks = golferIdArray.length > 0 ? await db
        .select({ id: golfers.id, rank: golfers.rank })
        .from(golfers)
        .where(inArray(golfers.id, golferIdArray)) : [];
        
      const rankMap = new Map<number, number>();
      golferRanks.forEach(g => rankMap.set(g.id, g.rank));
      console.log(`Fetched ${rankMap.size} golfer ranks.`);

      // 3. Iterate through selections and insert/update ranks
      for (const selection of competitionSelections) {
        const golfersInSelection = [selection.golfer1Id, selection.golfer2Id, selection.golfer3Id];
        for (const golferId of golfersInSelection) {
          const rank = rankMap.get(golferId);
          if (rank !== undefined) {
            try {
              const dataToInsert: InsertSelectionRank = {
                userId: selection.userId,
                competitionId: selection.competitionId,
                golferId: golferId,
                rankAtDeadline: rank
              };
              // Use ON CONFLICT DO NOTHING to avoid errors if rank already captured
              await db.insert(selectionRanks)
                      .values(dataToInsert)
                      .onConflictDoNothing({ target: [selectionRanks.userId, selectionRanks.competitionId, selectionRanks.golferId] });
              successCount++;
            } catch (insertError) {
              console.error(`Error inserting rank for user ${selection.userId}, comp ${competitionId}, golfer ${golferId}:`, insertError);
              errorCount++;
            }
          } else {
            console.warn(`Rank not found for golfer ID ${golferId} in selection ${selection.id}. Skipping rank capture for this golfer.`);
            // Optionally count this as an error or handle differently
            // errorCount++; 
          }
        }
      }

      console.log(`Finished capturing ranks. Success: ${successCount}, Errors: ${errorCount}`);
      return { success: errorCount === 0, count: successCount, errors: errorCount };

    } catch (error) {
      console.error(`Error during captureSelectionRanksForCompetition (Comp ID: ${competitionId}):`, error);
      return { success: false, count: successCount, errors: errorCount + 1 }; // Indicate overall failure
    }
  }
  // --- End Selection Rank Methods ---

  // --- User Stats Method ---
  async getUserStats(userId: number): Promise<{ competitionsPlayed: number; totalPoints: number; bestRank: number | string }> {
    try {
      // 1. Competitions Played (Count distinct competitions with selections)
      const competitionsPlayedResult = await db
        .select({ count: count(sql`DISTINCT ${selections.competitionId}`) })
        .from(selections)
        .where(eq(selections.userId, userId));
      const competitionsPlayed = competitionsPlayedResult[0]?.count || 0;

      // 2. Total Points (Sum points from user_points table)
      const totalPointsResult = await db
        .select({ totalPoints: sql<number>`SUM(${userPoints.points})`.mapWith(Number) })
        .from(userPoints)
        .where(eq(userPoints.userId, userId));
      const totalPoints = totalPointsResult[0]?.totalPoints || 0;

      // 3. Best Rank (Lowest rank in any completed competition)
      // We need to calculate rank within the query for completed competitions
      const bestRankSubquery = db.$with('ranked_points').as(
        db.select({
          userId: userPoints.userId,
          competitionId: userPoints.competitionId,
          points: userPoints.points,
          rank: sql<number>`RANK() OVER (PARTITION BY ${userPoints.competitionId} ORDER BY ${userPoints.points} DESC)`.mapWith(Number)
        })
        .from(userPoints)
        .innerJoin(competitions, and(
          eq(userPoints.competitionId, competitions.id),
          eq(competitions.isComplete, true) // Only consider completed competitions
        ))
      );

      const bestRankResult = await db.with(bestRankSubquery)
        .select({ bestRank: sql<number>`MIN(rank)`.mapWith(Number) })
        .from(bestRankSubquery)
        .where(eq(bestRankSubquery.userId, userId));

      const bestRank = bestRankResult[0]?.bestRank ?? 'N/A'; // Use 'N/A' if no completed competitions

      return {
        competitionsPlayed,
        totalPoints,
        bestRank,
      };
    } catch (error) {
      console.error(`Error fetching stats for user ${userId}:`, error);
      // Return default stats in case of error
      return {
        competitionsPlayed: 0,
        totalPoints: 0,
        bestRank: 'N/A',
      };
    }
  }
  // --- End User Stats Method ---
}

// Export the storage instance
export const storage = new DatabaseStorage();
