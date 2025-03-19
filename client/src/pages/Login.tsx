import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AuthForm from "@/components/auth/AuthForm";

export default function Login() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  
  // Redirect to dashboard if already logged in
  useEffect(() => {
    console.log("Login page check:", { user, isLoading, redirectAttempted });
    
    // Only redirect once we have definitive user data and haven't redirected yet
    if (user && !redirectAttempted) {
      console.log("User already logged in, redirecting to dashboard");
      setRedirectAttempted(true);
      // Short timeout to ensure all state updates are processed
      setTimeout(() => {
        setLocation("/");
      }, 100);
    }
  }, [user, isLoading, redirectAttempted, setLocation]);
  
  // Show loading indicator while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Golf Syndicate Tracker</h1>
          <p className="text-gray-600">Checking authentication status...</p>
        </div>
      </div>
    );
  }
  
  // If we have a user but somehow haven't redirected yet, show nothing to prevent flash
  if (user) return null;
  
  return (
    <div className="min-h-screen flex flex-col justify-center p-4 bg-slate-50">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Golf Syndicate Tracker</h1>
        <p className="text-gray-600">Sign in to your account</p>
      </div>
      <AuthForm type="login" />
    </div>
  );
}
