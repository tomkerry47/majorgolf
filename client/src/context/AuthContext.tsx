import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'; // Import useCallback
import { getStoredUser, fetchUserProfile, logout, login, isAuthenticated } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';

interface AuthContextType {
  user: any | null;
  profile: any | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (identifier: string, password: string) => Promise<any>; // Changed email to identifier
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>; // Added refresh function
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null); // This often stores the more basic user info from login
  const [profile, setProfile] = useState<any | null>(null); // This stores the detailed profile
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

  const signInUser = async (identifier: string, password: string) => { // Changed email to identifier
    try {
      const result = await login(identifier, password); // Pass identifier to login lib function
      setUser(result.user);
      setProfile(result.user);
      return result;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await logout();
      setUser(null);
      setProfile(null);
      setLocation('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshUserProfileData = useCallback(async () => { // Wrap with useCallback
    // Ensure `user` is in the dependency array if it's used to fetch the profile (e.g., user.id)
    // Also, `fetchUserProfile` should ideally be stable or included if it's not.
    if (user && user.id) {
      try {
        console.log('AuthContext: Refreshing user profile...');
        const updatedProfile = await fetchUserProfile(user.id);
        setProfile(updatedProfile);
        setUser(updatedProfile); // Update user state as well
        console.log('AuthContext: User profile refreshed.', updatedProfile);
      } catch (error) {
        console.error('AuthContext: Error refreshing user profile:', error);
      }
    } else {
      console.warn('AuthContext: Cannot refresh profile, no user ID available to refresh.');
    }
  }, [user?.id]); // Add user?.id as a dependency. `user` itself would cause a loop if `setUser` is called.

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
      signIn: signInUser,
      signOut: signOutUser,
      refreshUserProfile: refreshUserProfileData // Provide the refresh function
    }}>
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
