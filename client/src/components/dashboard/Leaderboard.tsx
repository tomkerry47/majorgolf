import { useState, useEffect } from "react";
import { Link } from "wouter"; // Keep Link if needed for golfer profiles later
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient"; // Keep apiRequest if needed later
import { type Competition } from "@shared/schema"; // Import Competition type

// Removed local Competition interface definition

// Interface for Tournament Result (matching API response from /api/results/:id)
interface TournamentResult {
  id: number;
  competitionId: number;
  golferId: number;
  position: number;
  score: number;
  points?: number; // Points might be optional depending on calculation status
  created_at: string;
  golfer?: { // Joined golfer data
    id: number;
    name: string;
    // avatarUrl?: string; // Add if API provides it
  };
}

// Renamed component conceptually
export default function TournamentResultsDisplay() {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);

  // Fetch completed or active competitions for the dropdown
  const { data: competitions, isLoading: isLoadingCompetitions } = useQuery<Competition[]>({
    queryKey: ['/api/competitions'],
    select: (data) => data?.filter(c => c.isComplete || c.isActive) || [], // Filter for relevant competitions
  });

  // Set default selected competition once competitions load
  useEffect(() => {
    if (!selectedCompetitionId && competitions && competitions.length > 0) {
      // Default to the first completed/active competition
      setSelectedCompetitionId(competitions[0].id);
    }
  }, [competitions, selectedCompetitionId]);

  // Fetch results for the selected competition
  const { data: results, isLoading: isLoadingResults } = useQuery<TournamentResult[]>({
    queryKey: ['/api/results', selectedCompetitionId], // Use correct API endpoint
    enabled: !!selectedCompetitionId, // Only fetch when an ID is selected
  });

  // Log the fetched data when it changes
  useEffect(() => {
    if (results) {
      console.log(`Results data received for competition ${selectedCompetitionId}:`, JSON.stringify(results, null, 2));
    }
  }, [results, selectedCompetitionId]);

  const getPositionDisplay = (position: number) => {
    // Add logic for T (Tied) if API provides tie info, otherwise just return position
    // Example: return result.isTied ? `T${position}` : position;
    return position;
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Tournament Results</h2>
        <div className="relative inline-block text-left">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                {/* Display selected competition name or prompt */}
                {isLoadingCompetitions
                  ? 'Loading...'
                  : competitions?.find(c => c.id === selectedCompetitionId)?.name || 'Select Competition'}
                <i className="fas fa-chevron-down -mr-1 ml-2 h-5 w-5"></i>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Removed "All Competitions" */}
              {isLoadingCompetitions ? (
                 <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
              ) : competitions?.length === 0 ? (
                 <DropdownMenuItem disabled>No competitions available</DropdownMenuItem>
              ) : (
                 competitions?.map(comp => (
                   <DropdownMenuItem
                     key={comp.id}
                     onClick={() => setSelectedCompetitionId(comp.id)}
                   >
                     {comp.name}
                   </DropdownMenuItem>
                 ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 flex flex-col">
        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Pos</TableHead> {/* Changed from Rank */}
                    <TableHead>Player</TableHead>
                    <TableHead>Score</TableHead> {/* Added Score */}
                    <TableHead>Points</TableHead>
                    {/* Removed Actions column unless needed */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingResults || (isLoadingCompetitions && !selectedCompetitionId) ? ( // Show skeleton while loading competitions or results
                    // Loading skeleton
                    Array(10).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="ml-4">
                              <Skeleton className="h-4 w-24" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : !selectedCompetitionId ? (
                     <TableRow>
                       <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                         Please select a competition.
                       </TableCell>
                     </TableRow>
                  ) : results?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                        No results available for this competition yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Actual data
                    results?.map((result) => (
                      <TableRow key={result.id} className="hover:bg-slate-50">
                        <TableCell className="whitespace-nowrap text-sm font-medium text-gray-900">
                          {/* Display Position */}
                          {getPositionDisplay(result.position)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center">
                            {/* Golfer Avatar Placeholder - Add real avatar if available */}
                            <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                               <span className="text-sm font-medium text-gray-800">
                                 {result.golfer?.name?.charAt(0) || '?'}
                               </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {result.golfer?.name || 'Unknown Golfer'}
                              </div>
                              {/* Optional: Add golfer country or other details if needed */}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-gray-500">
                          {/* Display Score */}
                          {result.score}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {/* Display Points */}
                          <div className="text-sm text-gray-900 font-medium">{result.points ?? '-'}</div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
