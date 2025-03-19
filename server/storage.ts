import { 
  type User, type InsertUser, type Competition, type Golfer, 
  type Selection, type Result, type InsertSelection, type InsertCompetition,
  type InsertGolfer, type InsertResult
} from "@shared/schema";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User>;
  
  // Competition methods
  getCompetitions(): Promise<Competition[]>;
  getCompetitionById(id: number): Promise<Competition | undefined>;
  createCompetition(competition: InsertCompetition): Promise<Competition>;
  updateCompetition(id: number, competitionData: Partial<Competition>): Promise<Competition>;
  
  // Golfer methods
  getGolfers(): Promise<Golfer[]>;
  getGolferById(id: number): Promise<Golfer | undefined>;
  createGolfer(golfer: InsertGolfer): Promise<Golfer>;
  
  // Selection methods
  getUserSelections(userId: number, competitionId: number): Promise<Selection | undefined>;
  createSelection(selection: InsertSelection): Promise<Selection>;
  updateSelection(id: number, selectionData: Partial<Selection>): Promise<Selection>;
  
  // Results methods
  getResults(competitionId: number): Promise<Result[]>;
  createResult(result: InsertResult): Promise<Result>;
}

// Implementation of IStorage interface using Supabase
export class SupabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(insertUser)
      .select()
      .single();
    
    if (error) throw new Error(`Error creating user: ${error.message}`);
    return data as User;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(userData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Error updating user: ${error.message}`);
    return data as User;
  }
  
  async getCompetitions(): Promise<Competition[]> {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('startDate', { ascending: true });
    
    if (error) throw new Error(`Error getting competitions: ${error.message}`);
    return data as Competition[];
  }
  
  async getCompetitionById(id: number): Promise<Competition | undefined> {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return data as Competition;
  }
  
  async createCompetition(competition: InsertCompetition): Promise<Competition> {
    const { data, error } = await supabase
      .from('competitions')
      .insert(competition)
      .select()
      .single();
    
    if (error) throw new Error(`Error creating competition: ${error.message}`);
    return data as Competition;
  }
  
  async updateCompetition(id: number, competitionData: Partial<Competition>): Promise<Competition> {
    const { data, error } = await supabase
      .from('competitions')
      .update(competitionData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Error updating competition: ${error.message}`);
    return data as Competition;
  }
  
  async getGolfers(): Promise<Golfer[]> {
    const { data, error } = await supabase
      .from('golfers')
      .select('*')
      .order('rank', { ascending: true });
    
    if (error) throw new Error(`Error getting golfers: ${error.message}`);
    return data as Golfer[];
  }
  
  async getGolferById(id: number): Promise<Golfer | undefined> {
    const { data, error } = await supabase
      .from('golfers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return data as Golfer;
  }
  
  async createGolfer(golfer: InsertGolfer): Promise<Golfer> {
    const { data, error } = await supabase
      .from('golfers')
      .insert(golfer)
      .select()
      .single();
    
    if (error) throw new Error(`Error creating golfer: ${error.message}`);
    return data as Golfer;
  }
  
  async getUserSelections(userId: number, competitionId: number): Promise<Selection | undefined> {
    const { data, error } = await supabase
      .from('selections')
      .select('*')
      .eq('userId', userId)
      .eq('competitionId', competitionId)
      .single();
    
    if (error || !data) return undefined;
    return data as Selection;
  }
  
  async createSelection(selection: InsertSelection): Promise<Selection> {
    const { data, error } = await supabase
      .from('selections')
      .insert(selection)
      .select()
      .single();
    
    if (error) throw new Error(`Error creating selection: ${error.message}`);
    return data as Selection;
  }
  
  async updateSelection(id: number, selectionData: Partial<Selection>): Promise<Selection> {
    const { data, error } = await supabase
      .from('selections')
      .update(selectionData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Error updating selection: ${error.message}`);
    return data as Selection;
  }
  
  async getResults(competitionId: number): Promise<Result[]> {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('competitionId', competitionId)
      .order('position', { ascending: true });
    
    if (error) throw new Error(`Error getting results: ${error.message}`);
    return data as Result[];
  }
  
  async createResult(result: InsertResult): Promise<Result> {
    const { data, error } = await supabase
      .from('results')
      .insert(result)
      .select()
      .single();
    
    if (error) throw new Error(`Error creating result: ${error.message}`);
    return data as Result;
  }
}

// Export the storage instance
export const storage = new SupabaseStorage();