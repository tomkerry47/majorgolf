import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, getSession, getCurrentUser, fetchUserProfile } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';

interface AuthContextType {
  user: any | null;
  profile: any | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check for active session
    const initAuth = async () => {
      try {
        setIsLoading(true);
        const session = await getSession();
        
        if (session) {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
          
          if (currentUser) {
            const userProfile = await fetchUserProfile(currentUser.id);
            setProfile(userProfile);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      
      if (session?.user) {
        try {
          const userProfile = await fetchUserProfile(session.user.id);
          setProfile(userProfile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setProfile(null);
      }
      
      setIsLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOutUser = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setLocation('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // If still loading, show a simple loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-2 w-[300px]">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    );
  }

  const isAdmin = profile?.isAdmin || false;

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, isLoading, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
