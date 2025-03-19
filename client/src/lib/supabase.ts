// This file now serves as a compatibility layer for auth functionality
// It used to use Supabase but now delegates to our direct PostgreSQL implementation

import { login, register, logout, fetchUserProfile as fetchProfile } from '@/lib/auth';

console.log('Supabase client initialized'); // Keep for compatibility

// Empty client object for compatibility with existing code
export const supabase = {
  auth: {
    signUp: () => Promise.resolve({ data: null, error: null }),
    signInWithPassword: () => Promise.resolve({ data: null, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null })
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null })
      }),
      single: () => Promise.resolve({ data: null, error: null })
    }),
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: null })
      })
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null })
        })
      })
    })
  }),
  channel: () => ({
    on: () => ({
      subscribe: () => ({})
    })
  })
};

// Utility functions for auth - now using our direct PostgreSQL implementation
export async function signUp(email: string, password: string, userData: { username: string, fullName: string }) {
  console.log('Using direct PostgreSQL auth for signup');
  try {
    const result = await register({
      email,
      password,
      username: userData.username,
      fullName: userData.fullName || userData.username
    });
    return { user: result.user };
  } catch (error) {
    console.error('Direct auth signup error:', error);
    throw error;
  }
}

export async function signIn(email: string, password: string) {
  console.log('Using direct PostgreSQL auth for signin with:', { email });
  
  try {
    const result = await login(email, password);
    console.log('Sign-in successful, user data:', result.user);
    return { user: result.user, session: { access_token: result.token } };
  } catch (error) {
    console.error('Direct auth signin error:', error);
    throw error;
  }
}

export async function signOut() {
  console.log('Using direct PostgreSQL auth for signout');
  try {
    await logout();
  } catch (error) {
    console.error('Direct auth signout error:', error);
    throw error;
  }
}

export async function getCurrentUser() {
  // This would be implemented with our JWT token check
  // For now, just return what's in localStorage
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Session handling
export async function getSession() {
  // Check if we have a valid token
  const token = localStorage.getItem('token');
  return token ? { token } : null;
}

// Database functions
export async function fetchUserProfile(userId: string) {
  console.log('Fetching user profile for ID:', userId);
  
  try {
    // Use our direct fetch method
    const profile = await fetchProfile(userId);
    console.log('User profile fetched successfully');
    return profile;
  } catch (err) {
    console.error('Error in fetchUserProfile:', err);
    throw err;
  }
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
