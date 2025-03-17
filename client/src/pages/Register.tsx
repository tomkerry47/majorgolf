import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AuthForm from "@/components/auth/AuthForm";

export default function Register() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);
  
  if (user) return null;
  
  return (
    <div className="min-h-screen flex flex-col justify-center p-4 bg-slate-50">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Golf Syndicate Tracker</h1>
        <p className="text-gray-600">Create a new account</p>
      </div>
      <AuthForm type="register" />
    </div>
  );
}
