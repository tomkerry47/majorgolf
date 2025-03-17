import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { 
  supabase, 
  signUp as supabaseSignUp, 
  signIn as supabaseSignIn,
  signOut as supabaseSignOut,
  getCurrentUser,
  AuthUser
} from "@/lib/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: {
    id: string;
    email: string;
    username?: string;
    avatarUrl?: string;
  } | null;
  isAdmin: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, username: string, fullName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isLoading: true,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const queryClient = useQueryClient();

  // Initialize user data
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get current user from Supabase Auth
        const currentUser = await getCurrentUser();
        
        if (currentUser) {
          // Get additional user data from database
          const { data: userData, error } = await supabase
            .from('users')
            .select('id, username, email, is_admin, avatar_url')
            .eq('email', currentUser.email)
            .single();
          
          if (userData) {
            setUser({
              id: currentUser.id,
              email: currentUser.email || '',
              username: userData.username,
              avatarUrl: userData.avatar_url,
            });
            setIsAdmin(!!userData.is_admin);
          } else if (!error) {
            // User exists in auth but not in DB
            setUser({
              id: currentUser.id,
              email: currentUser.email || '',
              username: currentUser.user_metadata.username,
              avatarUrl: currentUser.user_metadata.avatar_url,
            });
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (session?.user) {
            const { data: userData } = await supabase
              .from('users')
              .select('id, username, email, is_admin, avatar_url')
              .eq('email', session.user.email)
              .single();
              
            if (userData) {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                username: userData.username,
                avatarUrl: userData.avatar_url,
              });
              setIsAdmin(!!userData.is_admin);
            } else {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                username: session.user.user_metadata.username,
                avatarUrl: session.user.user_metadata.avatar_url,
              });
              setIsAdmin(false);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAdmin(false);
          // Clear all queries when signing out
          queryClient.clear();
        }
      }
    );

    initializeAuth();

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [queryClient]);

  // Sign up mutation with user creation in database
  const signUpMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      username,
    }: {
      email: string;
      password: string;
      username: string;
    }) => {
      // Sign up with Supabase Auth
      const { user: authUser } = await supabaseSignUp(email, password, username);

      if (authUser) {
        // Create user in database
        const { data, error } = await supabase.from('users').insert([
          {
            email,
            username,
            id: authUser.id,
          },
        ]);

        if (error) throw error;
        return { user: authUser, data };
      }
      throw new Error("Failed to create user account");
    },
  });

  // Sign in mutation
  const signInMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return await supabaseSignIn(email, password);
    },
  });

  // Sign out mutation
  const signOutMutation = useMutation({
    mutationFn: async () => {
      return await supabaseSignOut();
    },
    onSuccess: () => {
      setUser(null);
      setIsAdmin(false);
      // Clear all queries
      queryClient.clear();
    },
  });

  const signUp = async (email: string, password: string, username: string) => {
    await signUpMutation.mutateAsync({ email, password, username });
  };

  const signIn = async (email: string, password: string) => {
    await signInMutation.mutateAsync({ email, password });
  };

  const signOut = async () => {
    await signOutMutation.mutateAsync();
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

export const useAuth = () => useContext(AuthContext);
