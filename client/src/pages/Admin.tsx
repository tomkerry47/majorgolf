import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import AdminCompetitions from "@/components/admin/AdminCompetitions";
import AdminGolfers from "@/components/admin/AdminGolfers";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminResults from "@/components/admin/AdminResults";
import AdminSelections from "@/components/admin/AdminSelections";

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect if not logged in or not an admin
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    } else if (!isAdmin) {
      setLocation("/");
    }
  }, [user, isAdmin, setLocation]);
  
  if (!user || !isAdmin) return null;
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mb-6">
          Manage competitions, golfers, users, and player selections.
        </p>
        
        <Tabs defaultValue="competitions">
          <TabsList className="mb-6">
            <TabsTrigger value="competitions">Competitions</TabsTrigger>
            <TabsTrigger value="golfers">Golfers</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="selections">User Selections</TabsTrigger>
          </TabsList>
          
          <TabsContent value="competitions">
            <AdminCompetitions />
          </TabsContent>
          
          <TabsContent value="golfers">
            <AdminGolfers />
          </TabsContent>
          
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>
          
          <TabsContent value="results">
            <AdminResults />
          </TabsContent>
          
          <TabsContent value="selections">
            <AdminSelections />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
