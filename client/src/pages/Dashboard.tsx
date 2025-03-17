import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import StatCard from "@/components/dashboard/StatCard";
import CurrentCompetition from "@/components/dashboard/CurrentCompetition";
import Leaderboard from "@/components/dashboard/Leaderboard";
import UpcomingCompetitions from "@/components/dashboard/UpcomingCompetitions";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);
  
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery({
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
                <i className="fas fa-plus -ml-1 mr-2 h-5 w-5"></i>
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
            icon={<i className="fas fa-trophy text-primary h-6 w-6"></i>}
            iconBgClass="bg-primary/10"
            loading={isLoadingStats}
          />
          
          <StatCard
            title="Your Current Rank"
            value={dashboardStats?.currentRank || 'N/A'}
            icon={<i className="fas fa-medal text-info h-6 w-6"></i>}
            iconBgClass="bg-info/10"
            loading={isLoadingStats}
          />
          
          <StatCard
            title="Total Points"
            value={dashboardStats?.totalPoints || 0}
            icon={<i className="fas fa-arrow-trend-up text-success h-6 w-6"></i>}
            iconBgClass="bg-success/10"
            loading={isLoadingStats}
          />
          
          <StatCard
            title="Next Deadline"
            value={dashboardStats?.nextDeadline || 'None'}
            icon={<i className="fas fa-calendar-alt text-amber-500 h-6 w-6"></i>}
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
