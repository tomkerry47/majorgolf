import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import AdminPointSystem from "@/components/admin/AdminPointSystem";

export default function PointSystemAdmin() {
  const { user, isAdmin, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // Redirect if not admin
  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/login");
    }
  }, [user, isAdmin, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Point System Management</h1>
      <AdminPointSystem />
    </div>
  );
}