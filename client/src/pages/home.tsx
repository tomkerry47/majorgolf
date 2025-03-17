import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import StatCard from "@/components/stat-card";
import TournamentCard from "@/components/tournament-card";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const Home = () => {
  const { user } = useAuth();

  // Fetch user stats
  const { data: userStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/users/stats"],
    enabled: !!user,
  });

  // Fetch active tournaments
  const { data: tournaments, isLoading: isLoadingTournaments } = useQuery({
    queryKey: ["/api/tournaments"],
  });

  // Fetch next tournament
  const { data: nextTournament, isLoading: isLoadingNextTournament } = useQuery({
    queryKey: ["/api/tournaments/next"],
  });

  return (
    <div className="space-y-8">
      {/* Dashboard Section */}
      <section id="dashboard">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Dashboard</h2>
        
        {/* Stats summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {isLoadingStats ? (
            // Skeleton loading states
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-5 border-l-4 border-primary">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </div>
            ))
          ) : (
            <>
              <StatCard
                title="Your Rank"
                value={userStats?.rank || "-"}
                icon="ranking"
                color="primary"
              />
              <StatCard
                title="Total Points"
                value={userStats?.totalPoints || "0"}
                icon="points"
                color="secondary"
              />
              <StatCard
                title="Best Tournament"
                value={userStats?.bestTournament || "-"}
                icon="trophy"
                color="accent"
              />
              <StatCard
                title="Active Tournaments"
                value={userStats?.activeTournaments || "0"}
                icon="clipboard"
                color="green"
              />
            </>
          )}
        </div>
        
        {/* Upcoming tournament banner */}
        {isLoadingNextTournament ? (
          <div className="bg-gradient-to-r from-secondary-800 to-primary-600 rounded-lg shadow-lg text-white p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0 space-y-2">
                <Skeleton className="h-4 w-40 bg-white/30" />
                <Skeleton className="h-8 w-64 bg-white/30" />
                <Skeleton className="h-4 w-36 bg-white/30" />
              </div>
              <div className="flex space-x-3">
                <Skeleton className="h-10 w-32 bg-white/30 rounded-md" />
                <Skeleton className="h-10 w-32 bg-white/30 rounded-md" />
              </div>
            </div>
          </div>
        ) : nextTournament ? (
          <div className="bg-gradient-to-r from-secondary-800 to-primary-600 rounded-lg shadow-lg text-white p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0">
                <p className="text-primary-100 text-sm font-medium mb-1">UPCOMING TOURNAMENT</p>
                <h3 className="text-2xl font-bold mb-1">{nextTournament.name}</h3>
                <p className="flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-1" />
                  <span>
                    {format(new Date(nextTournament.startDate), "MMMM d")} - 
                    {format(new Date(nextTournament.endDate), "d, yyyy")}
                  </span>
                </p>
              </div>
              <div className="flex space-x-3">
                <Button asChild variant="secondary">
                  <Link href="/selections">Make Selection</Link>
                </Button>
                <Button asChild>
                  <Link href={`/tournaments?id=${nextTournament.id}`}>View Details</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-secondary-800 to-primary-600 rounded-lg shadow-lg text-white p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0">
                <p className="text-primary-100 text-sm font-medium mb-1">NO UPCOMING TOURNAMENTS</p>
                <h3 className="text-2xl font-bold mb-1">Stay tuned for updates</h3>
                <p className="flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-1" />
                  <span>Check back soon for new tournaments</span>
                </p>
              </div>
              <div className="flex space-x-3">
                <Button asChild variant="secondary">
                  <Link href="/tournaments">View All Tournaments</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
      
      {/* Tournaments Section */}
      <section id="tournaments">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Tournaments</h2>
          <div>
            <Button asChild variant="link">
              <Link href="/tournaments">See All Tournaments</Link>
            </Button>
          </div>
        </div>
        
        {isLoadingTournaments ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tournaments && tournaments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.slice(0, 3).map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900">No tournaments available</h3>
            <p className="mt-1 text-sm text-gray-500">Check back soon for upcoming tournaments.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
