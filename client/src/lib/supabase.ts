import { createClient } from '@supabase/supabase-js';

// Use hardcoded values for client-side development
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

console.log('Supabase client initialized');

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
  console.log('Fetching user profile for ID:', userId);
  
  try {
    // Try to get user by ID first
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.log('Error fetching user profile by ID:', error);
      
      // If not found, try to get current user from auth and use email to find profile
      const { data: userData } = await supabase.auth.getUser();
      
      if (userData && userData.user && userData.user.email) {
        console.log('Trying to find user by email:', userData.user.email);
        
        const { data: emailUser, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', userData.user.email)
          .single();
        
        if (emailError) {
          console.log('Error fetching user profile by email:', emailError);
          
          // If still not found, create a new user profile
          console.log('Creating new user profile for auth user');
          
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: userData.user.email,
              username: userData.user.email.split('@')[0],
              fullName: userData.user.email.split('@')[0]
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating user profile:', createError);
            throw createError;
          }
          
          return newUser;
        }
        
        // If found by email but ID doesn't match, update the ID
        if (emailUser && emailUser.id !== userId) {
          console.log('Found user by email but ID mismatch. Updating ID...');
          
          // Keep a copy of the user data
          const userCopy = { ...emailUser };
          
          try {
            // This may fail due to FK constraints if the user has related records
            const { data: updatedUser, error: updateError } = await supabase
              .from('users')
              .update({ id: userId })
              .eq('id', emailUser.id)
              .select()
              .single();
            
            if (updateError) {
              console.error('Failed to update user ID:', updateError);
              // Return the original user data anyway
              return userCopy;
            }
            
            return updatedUser;
          } catch (updateError) {
            console.error('Exception updating user ID:', updateError);
            // Return the original user data anyway
            return userCopy;
          }
        }
        
        return emailUser;
      }
      
      throw error; // Rethrow original error if we can't find user by email
    }
    
    console.log('User profile fetched successfully');
    return data;
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
