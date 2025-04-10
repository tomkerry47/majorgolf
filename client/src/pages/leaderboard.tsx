import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import LeaderboardTable from "@/components/leaderboard-table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Competition } from "@shared/schema";

interface LeaderboardData {
  standings: Array<any>; // Consider defining a more specific type for standings entries later
  currentUserId?: number;
  lastUpdated?: string | null; // Corrected: Use nullable string
  currentRound?: number;
  roundCompleted?: boolean;
}

const Leaderboard = () => {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);

  // Fetch competitions for the dropdown
  const { data: competitions, isLoading: isLoadingCompetitions } = useQuery<Competition[]>({
    queryKey: ["/api/competitions"],
  });

  // Add an "All Tournaments" option
  const allOption = { id: "all", name: "All Tournaments" };
  
  // Filter to active or completed competitions
  const validCompetitions = competitions?.filter(c => 
    c.isActive || c.isComplete
  ) || [];
  
  // Fetch leaderboard data based on selected competition
  const { 
    // Correct default value and destructuring
    data: leaderboardData = { standings: [], lastUpdated: null }, 
    isLoading: isLoadingLeaderboard,
    refetch: refetchLeaderboard
  } = useQuery<LeaderboardData, Error>({ 
    queryKey: [
      "/api/leaderboard", 
      selectedCompetitionId === "all" ? undefined : selectedCompetitionId
    ],
    queryFn: async () => { // Define the query function
      const competitionParam = selectedCompetitionId === "all" ? '' : `/${selectedCompetitionId}`;
      const response = await fetch(`/api/leaderboard${competitionParam}`);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      // Assuming the API returns the LeaderboardData structure directly or needs parsing
      // Let's assume it returns { standings: [], ... } structure based on previous analysis
      const fetchedData = await response.json(); 
      // Check if the response is an array (like from the route) or the expected object
      if (Array.isArray(fetchedData)) {
        // If it's just the array (likely overall standings), wrap it
        return { standings: fetchedData } as LeaderboardData; 
      }
      // If it's already the object structure, return as is
      return fetchedData as LeaderboardData; 
    },
    enabled: true // Keep enabled
    // Removed onSuccess and onError callbacks
  });

  // Find currently selected competition
  const selectedCompetition = selectedCompetitionId === "all" 
    ? allOption
    : validCompetitions.find(c => c.id.toString() === selectedCompetitionId);
    
  // Extract standings and lastUpdated from the fetched data
  const leaderboardStandings = leaderboardData?.standings || [];
  const lastUpdatedTimestamp = leaderboardData?.lastUpdated;

  // Set "All Tournaments" as default view
  useEffect(() => {
    if (!selectedCompetitionId && !isLoadingCompetitions) {
      setSelectedCompetitionId("all");
    }
  }, [isLoadingCompetitions, selectedCompetitionId]);

  // Competition status and last updated info
  const competitionStatus = selectedCompetitionId === "all" 
    ? undefined
    : (selectedCompetition as Competition)?.isActive ? 'active' : 'completed';
    
  // Format the last updated timestamp for display
  const formattedLastUpdated = lastUpdatedTimestamp
    ? new Date(lastUpdatedTimestamp).toLocaleString()
    : 'Never';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Leaderboard</h2>
        <div className="flex items-center space-x-2">
          {isLoadingCompetitions ? (
            <Skeleton className="h-10 w-56 rounded" />
          ) : (
            <Select
              value={selectedCompetitionId || ''}
              onValueChange={setSelectedCompetitionId}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select tournament" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Tournaments</SelectLabel>
                  <SelectItem key="all" value="all">
                    All Tournaments
                  </SelectItem>
                  {validCompetitions.length > 0 ? (
                    validCompetitions.map((competition) => {
                      let statusLabel = '';
                      if (competition.isComplete) {
                        statusLabel = '(Completed)';
                      } else if (competition.isActive) {
                        statusLabel = '(Active)';
                      } else {
                        // Assuming if not active or complete, it's upcoming
                        statusLabel = '(Upcoming)'; 
                      }
                      return (
                        <SelectItem key={competition.id} value={competition.id.toString()}>
                          {competition.name} {statusLabel}
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="none" disabled>No tournaments available</SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => refetchLeaderboard()}
            disabled={isLoadingLeaderboard}
          >
            <RefreshCcw className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Competition status */}
      {selectedCompetition && selectedCompetitionId !== "all" && (
        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div className="mb-3 md:mb-0">
              <span className={`
                inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2
                ${competitionStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
              `}>
                {competitionStatus === 'active' ? 'ACTIVE' : 'COMPLETED'}
              </span>
              {/* Use leaderboardData here */}
              {competitionStatus === 'active' && leaderboardData?.currentRound && (
                <span className="text-sm text-gray-500">
                  Round {leaderboardData.currentRound} of 4 {leaderboardData.roundCompleted ? 'completed' : 'in progress'}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {formattedLastUpdated}
            </div>
          </div>
        </div>
      )}
      
      {/* All tournaments view */}
      {selectedCompetitionId === "all" && (
        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 bg-purple-100 text-purple-800">
                OVERALL STANDINGS
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {formattedLastUpdated}
            </div>
          </div>
        </div>
      )}
      
      {/* Leaderboard table */}
      <LeaderboardTable 
        data={leaderboardStandings} // Pass the extracted standings
        isLoading={isLoadingLeaderboard}
        userId={leaderboardData?.currentUserId} // Use leaderboardData here too
      />
    </div>
  );
};

export default Leaderboard;
