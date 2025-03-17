import { useState } from "react";
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
import { Tournament } from "@shared/schema";

const Leaderboard = () => {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  // Fetch tournaments for the dropdown
  const { data: tournaments, isLoading: isLoadingTournaments } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
  });

  // Filter to active or completed tournaments
  const validTournaments = tournaments?.filter(t => 
    t.status === 'active' || t.status === 'completed'
  ) || [];

  // Set first tournament as default if none selected and we have data
  if (!selectedTournamentId && validTournaments.length > 0 && !isLoadingTournaments) {
    setSelectedTournamentId(validTournaments[0].id.toString());
  }

  // Fetch leaderboard data for selected tournament
  const { 
    data: leaderboard, 
    isLoading: isLoadingLeaderboard,
    refetch: refetchLeaderboard
  } = useQuery({
    queryKey: ["/api/leaderboard", selectedTournamentId],
    enabled: !!selectedTournamentId,
  });

  // Find currently selected tournament
  const selectedTournament = validTournaments.find(
    t => t.id.toString() === selectedTournamentId
  );

  // Tournament status and last updated info
  const tournamentStatus = selectedTournament?.status || 'completed';
  const lastUpdated = leaderboard?.lastUpdated 
    ? new Date(leaderboard.lastUpdated).toLocaleString()
    : 'Never';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Leaderboard</h2>
        <div className="flex items-center space-x-2">
          {isLoadingTournaments ? (
            <Skeleton className="h-10 w-56 rounded" />
          ) : (
            <Select
              value={selectedTournamentId || ''}
              onValueChange={setSelectedTournamentId}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select tournament" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Tournaments</SelectLabel>
                  {validTournaments.length > 0 ? (
                    validTournaments.map((tournament) => (
                      <SelectItem key={tournament.id} value={tournament.id.toString()}>
                        {tournament.name} {tournament.status === 'active' ? '(Active)' : ''}
                      </SelectItem>
                    ))
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
            disabled={isLoadingLeaderboard || !selectedTournamentId}
          >
            <RefreshCcw className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Tournament status */}
      {selectedTournament && (
        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div className="mb-3 md:mb-0">
              <span className={`
                inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2
                ${tournamentStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
              `}>
                {tournamentStatus === 'active' ? 'ACTIVE' : 'COMPLETED'}
              </span>
              {tournamentStatus === 'active' && leaderboard?.currentRound && (
                <span className="text-sm text-gray-500">
                  Round {leaderboard.currentRound} of 4 {leaderboard.roundCompleted ? 'completed' : 'in progress'}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {lastUpdated}
            </div>
          </div>
        </div>
      )}
      
      {/* Leaderboard table */}
      {selectedTournamentId ? (
        <LeaderboardTable 
          data={leaderboard?.standings || []} 
          isLoading={isLoadingLeaderboard}
          userId={leaderboard?.currentUserId}
        />
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">No tournament selected</h3>
          <p className="mt-2 text-gray-500">Please select a tournament to view the leaderboard.</p>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
