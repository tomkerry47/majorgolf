import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with direct values
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Utility functions for auth
export async function signUp(email: string, password: string, userData: { username: string, fullName: string }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: userData.username,
        fullName: userData.fullName,
      }
    }
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

export async function signIn(email: string, password: string) {
  console.log('Attempting to sign in with:', { email });
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Supabase sign-in error:', error);
      throw error;
    }
    
    console.log('Sign-in successful, user data:', data.user);
    return data;
  } catch (err) {
    console.error('Sign-in exception:', err);
    throw err;
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  
  if (error) {
    return null;
  }
  
  return data.user;
}

// Session handling
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    throw error;
  }
  
  return data.session;
}

// Database functions
export async function fetchUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}

// Realtime subscription helpers
export function subscribeToCompetition(competitionId: number, callback: (payload: any) => void) {
  return supabase
    .channel(`competition:${competitionId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'results',
      filter: `competitionId=eq.${competitionId}`
    }, callback)
    .subscribe();
}

export function subscribeToLeaderboard(callback: (payload: any) => void) {
  return supabase
    .channel('leaderboard')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'results'
    }, callback)
    .subscribe();
}
