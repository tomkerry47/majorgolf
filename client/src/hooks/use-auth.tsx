import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: {
    id: string;
    email: string;
    username?: string;
    avatarUrl?: string;
  } | null;
  isAdmin: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, username: string, fullName?: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isLoading: true,
  signUp: async () => null,
  signIn: async () => null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const queryClient = useQueryClient();

  // Initialize user data on mount and listen for auth changes
  useEffect(() => {
    console.log("Setting up auth state listener");
    
    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change event:", event, session ? "Has session" : "No session");
        
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          console.log("User signed in or updated:", session?.user?.email);
          
          if (session?.user) {
            try {
              // Try to get user by auth ID first
              let { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              // If that fails, try by email
              if (error && session.user.email) {
                console.log("User not found by ID, trying email lookup");
                const { data: emailUser, error: emailError } = await supabase
                  .from('users')
                  .select('*')
                  .eq('email', session.user.email)
                  .single();
                
                if (!emailError && emailUser) {
                  console.log("Found user by email:", emailUser);
                  userData = emailUser;
                  error = null;
                  
                  // Update user ID to match auth if needed
                  if (emailUser.id !== session.user.id) {
                    console.log("Updating user ID to match auth ID");
                    const { error: updateError } = await supabase
                      .from('users')
                      .update({ id: session.user.id })
                      .eq('id', emailUser.id);
                    
                    if (updateError) {
                      console.error("Error updating user ID:", updateError);
                    }
                  }
                }
              }
              
              // If user still not found, create new user record
              if (error) {
                console.error("Error fetching user data:", error);
                console.log("Error details:", error);
                
                if (session.user.email) {
                  console.log("User not found in database, creating user record");
                  
                  const username = session.user.email.split('@')[0] || 'user';
                  const fullName = username;
                  
                  const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert({
                      id: session.user.id,
                      email: session.user.email,
                      username: username,
                      fullName: fullName,
                    })
                    .select()
                    .single();
                  
                  if (insertError) {
                    console.error("Error creating user record:", insertError);
                    
                    // If insert failed (likely due to duplicate email), try a fetch with email again
                    // This handles race conditions where the user exists but ID doesn't match
                    if (insertError.code === '23505') { // Unique constraint violation
                      const { data: existingUser, error: fetchError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', session.user.email)
                        .single();
                      
                      if (!fetchError && existingUser) {
                        userData = existingUser;
                      }
                    }
                  } else {
                    console.log("Created new user record:", newUser);
                    userData = newUser;
                  }
                }
              }
              
              // Set user state based on resolved userData
              if (userData) {
                console.log("Setting user data:", userData);
                setUser({
                  id: session.user.id,
                  email: session.user.email || '',
                  username: userData.username,
                  avatarUrl: userData.avatarUrl,
                });
                setIsAdmin(!!userData.isAdmin);
              } else {
                // Fallback to basic user info if database sync failed
                console.log("Using basic user info from auth");
                setUser({
                  id: session.user.id,
                  email: session.user.email || '',
                });
                setIsAdmin(false);
              }
            } catch (error) {
              console.error("Error in auth state listener:", error);
            } finally {
              setIsLoading(false);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log("User signed out");
          setUser(null);
          setIsAdmin(false);
          setIsLoading(false);
          queryClient.clear();
        } else if (event === 'TOKEN_REFRESHED') {
          console.log("Token refreshed");
        }
      }
    );

    // Check current session on load
    const checkCurrentSession = async () => {
      try {
        console.log("Checking current session...");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          setIsLoading(false);
          return;
        }
        
        console.log("Current session:", data.session ? "Found" : "None");
        
        if (data.session) {
          // Session exists, no need to do anything - the onAuthStateChange listener will handle it
          console.log("Session user:", data.session.user.email);
        } else {
          // No session
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error checking session:", error);
        setIsLoading(false);
      }
    };

    checkCurrentSession();

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [queryClient]);

  // Simple authentication functions with detailed logging
  const signUp = async (email: string, password: string, username: string, fullName: string = '') => {
    try {
      console.log("Attempting to sign up:", email);
      
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, full_name: fullName }
        }
      });
      
      if (error) {
        console.error("Sign-up error:", error);
        throw error;
      }
      
      console.log("Sign-up response:", data);
      
      // Note: We don't need to manually set user state here
      // The onAuthStateChange listener will handle that
      
      if (data.user) {
        // Create user in database
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: data.user.email,
              username,
            },
          ]);
        
        if (insertError) {
          console.error("Error inserting user into database:", insertError);
          throw insertError;
        }
      }
      
      return data;
    } catch (error) {
      console.error("Complete sign-up error:", error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log("Attempting to sign in:", email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error("Sign-in error:", error);
        throw error;
      }
      
      console.log("Sign-in successful, user:", data.user?.email);
      
      // User state will be set by the onAuthStateChange listener
      return data;
    } catch (error) {
      console.error("Complete sign-in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log("Attempting to sign out");
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Sign-out error:", error);
        throw error;
      }
      
      console.log("Sign-out successful");
      
      // User state will be cleared by the onAuthStateChange listener
    } catch (error) {
      console.error("Sign-out error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Create custom hook for auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}