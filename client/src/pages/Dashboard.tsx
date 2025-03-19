import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import StatCard from "@/components/dashboard/StatCard";
import CurrentCompetition from "@/components/dashboard/CurrentCompetition";
import Leaderboard from "@/components/dashboard/Leaderboard";
import UpcomingCompetitions from "@/components/dashboard/UpcomingCompetitions";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [connectionStatus, setConnectionStatus] = useState<string>("checking");
  
  // Check connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setConnectionStatus("checking");
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (error) {
          console.error("Connection check error:", error);
          setConnectionStatus("error");
        } else {
          console.log("Database connection successful");
          setConnectionStatus("connected");
        }
      } catch (err) {
        console.error("Connection check failed:", err);
        setConnectionStatus("error");
      }
    };
    
    checkConnection();
    
    // Set up a periodic check
    const interval = setInterval(() => {
      checkConnection();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Redirect to login if no user and not loading
  useEffect(() => {
    console.log("Dashboard auth check:", { user, isLoading, connectionStatus });
    if (!isLoading && !user) {
      console.log("No user found, redirecting to login");
      setLocation("/login");
    }
  }, [user, isLoading, connectionStatus, setLocation]);
  
  // Define dashboard stats type
  interface DashboardStats {
    activeCompetitions: number;
    nextDeadline: string;
    totalPoints: number;
    currentRank: string | number;
  }
  
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    enabled: !!user,
  });
  
  if (!user) return null;
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <div className="mt-2 flex flex-col sm:flex-row sm:justify-between">
          <p className="text-sm text-gray-500">
            Welcome to your Golf Syndicate Tracker. View upcoming competitions and your current standings.
          </p>
          <div className="mt-3 sm:mt-0">
            <Button asChild>
              <Link href="/competitions">
                <span className="-ml-1 mr-2">➕</span>
                New Selection
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Competitions"
            value={dashboardStats?.activeCompetitions || 0}
            icon={<span className="text-primary h-6 w-6">🏆</span>}
            iconBgClass="bg-primary/10"
            loading={isLoadingStats}
          />
          
          <StatCard
            title="Your Current Rank"
            value={dashboardStats?.currentRank || 'N/A'}
            icon={<span className="text-info h-6 w-6">🏅</span>}
            iconBgClass="bg-info/10"
            loading={isLoadingStats}
          />
          
          <StatCard
            title="Total Points"
            value={dashboardStats?.totalPoints || 0}
            icon={<span className="text-success h-6 w-6">📈</span>}
            iconBgClass="bg-success/10"
            loading={isLoadingStats}
          />
          
          <StatCard
            title="Next Deadline"
            value={dashboardStats?.nextDeadline || 'None'}
            icon={<span className="text-amber-500 h-6 w-6">📅</span>}
            iconBgClass="bg-amber-500/10"
            loading={isLoadingStats}
          />
        </div>

        <CurrentCompetition />
        
        <Leaderboard />
        
        <UpcomingCompetitions />
      </div>
    </div>
  );
}
