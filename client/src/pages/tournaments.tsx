import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TournamentCard from "@/components/tournament-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tournament } from "@shared/schema";

type TournamentStatus = "all" | "upcoming" | "active" | "completed";

const Tournaments = () => {
  const [status, setStatus] = useState<TournamentStatus>("all");
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(location.split("?")[1]);
  const selectedId = params.get("id");

  // Fetch tournaments
  const { data: tournaments, isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  // Filter tournaments based on status
  const filteredTournaments = tournaments?.filter((tournament) => {
    if (status === "all") return true;
    return tournament.status === status;
  });

  // If a specific tournament ID is provided, show its details
  const selectedTournament = selectedId 
    ? tournaments?.find(t => t.id === parseInt(selectedId))
    : null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Tournaments</h2>

      {selectedTournament ? (
        <div className="space-y-6">
          <Button 
            variant="outline"
            onClick={() => setLocation("/tournaments")}
            className="mb-4"
          >
            Back to All Tournaments
          </Button>
          
          {/* Tournament Detail */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="h-60 bg-gradient-to-r from-green-700 to-green-500 relative">
              {selectedTournament.imageUrl && (
                <img 
                  src={selectedTournament.imageUrl} 
                  alt={selectedTournament.name} 
                  className="w-full h-full object-cover opacity-50"
                />
              )}
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <span className={`
                  bg-white px-3 py-1 rounded text-sm font-semibold inline-block w-min whitespace-nowrap mb-2
                  ${selectedTournament.status === 'upcoming' ? 'text-green-700' : 
                    selectedTournament.status === 'active' ? 'text-red-700' : 'text-blue-700'}
                `}>
                  {selectedTournament.status.toUpperCase()}
                </span>
                <h3 className="text-white text-3xl font-bold">{selectedTournament.name}</h3>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="text-lg font-semibold mb-3">Tournament Details</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Location:</span>
                      <p className="text-gray-900">{selectedTournament.location}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Dates:</span>
                      <p className="text-gray-900">
                        {new Date(selectedTournament.startDate).toLocaleDateString()} - 
                        {new Date(selectedTournament.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Selection Deadline:</span>
                      <p className="text-gray-900">
                        {new Date(selectedTournament.selectionDeadline).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold mb-3">Scoring Rules</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>1st place: 100 points</li>
                    <li>2nd place: 75 points</li>
                    <li>3rd place: 60 points</li>
                    <li>4th-10th place: 40-10 points (decreasing by 5)</li>
                    <li>Made cut: 5 points</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex justify-center mt-6">
                {selectedTournament.status === 'active' ? (
                  <Button asChild>
                    <a href="/leaderboard">View Leaderboard</a>
                  </Button>
                ) : selectedTournament.status === 'upcoming' ? (
                  <Button asChild>
                    <a href="/selections">Make Selections</a>
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <a href="/leaderboard">View Final Results</a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Tabs defaultValue={status} onValueChange={(value) => setStatus(value as TournamentStatus)}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
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
          ) : filteredTournaments && filteredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">No tournaments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {status === "all" 
                  ? "There are currently no tournaments available."
                  : `There are no ${status} tournaments at the moment.`}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Tournaments;
