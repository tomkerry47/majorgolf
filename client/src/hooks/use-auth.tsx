import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStoredUser, fetchUserProfile, logout, login, register, isAuthenticated } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';

interface AuthContextType {
  user: any | null;
  profile: any | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, username: string, fullName?: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check for active session using localStorage
    const initAuth = async () => {
      try {
        setIsLoading(true);
        
        if (isAuthenticated()) {
          const storedUser = getStoredUser();
          setUser(storedUser);
          
          if (storedUser && storedUser.id) {
            try {
              const userProfile = await fetchUserProfile(storedUser.id);
              setProfile(userProfile);
            } catch (error) {
              console.error('Error fetching user profile:', error);
              // If we can't fetch the profile, the token may be invalid
              // Clear the auth data and redirect to login
              await logout();
              setUser(null);
              setProfile(null);
              setLocation('/login');
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [setLocation]);

  const signIn = async (email: string, password: string) => {
    const result = await login(email, password);
    setUser(result.user);
    setProfile(result.user);
    return result;
  };

  const signUp = async (email: string, password: string, username: string, fullName: string = username) => {
    const result = await register({
      email,
      password,
      username,
      fullName
    });
    return result;
  };

  const signOut = async () => {
    try {
      await logout();
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
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      isAdmin, 
      isLoading, 
      signIn, 
      signUp, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};