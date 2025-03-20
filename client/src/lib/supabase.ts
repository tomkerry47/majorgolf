// This file serves as a compatibility layer for components that were previously using Supabase
// We've migrated to direct PostgreSQL but maintain this interface for backward compatibility

import { login, register, logout, fetchUserProfile as fetchProfile } from '@/lib/auth';

// This is a stub to maintain compatibility during the transition
// No actual Supabase functionality is used anymore - all operations use direct PostgreSQL
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
  channel: (channelName?: string) => ({
    on: (eventType: string, config: any, callback: any) => ({
      subscribe: () => ({ })
    })
  }),
  removeChannel: (channel: any) => { }
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

// These realtime subscription helpers are deprecated
// They have been replaced with query invalidation in the UI components
// Keeping the stubs here for backward compatibility
export function subscribeToCompetition(competitionId: number, callback: (payload: any) => void) {
  console.log('Realtime subscription replaced with polling, competitionId:', competitionId);
  return {
    unsubscribe: () => {}
  };
}

export function subscribeToLeaderboard(callback: (payload: any) => void) {
  console.log('Realtime subscription replaced with polling for leaderboard');
  return {
    unsubscribe: () => {}
  };
}
