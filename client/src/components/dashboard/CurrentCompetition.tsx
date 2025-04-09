import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query"; // Import useQueryClient
import { apiRequest } from "@/lib/queryClient"; // Import apiRequest
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// Updated GolferSelectionProps to include rank, captain, and wildcard
interface GolferSelectionProps {
  name: string;
  position: number | string;
  points: number;
  avatar?: string;
  rank: number | string; // Added rank
  isCaptain: boolean; // Added captain flag
  isWildcard: boolean; // Added wildcard flag
}

function GolferSelection({ name, position, points, avatar, rank, isCaptain, isWildcard }: GolferSelectionProps) {
  return (
    <div className="relative rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm flex items-center space-x-3 hover:border-primary/30">
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
          {avatar ? (
            <img className="h-10 w-10 rounded-full" src={avatar} alt={name} />
          ) : (
            <span className="text-sm font-medium text-gray-800">{name.charAt(0)}</span>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {name}
          {isCaptain && <span className="ml-1 text-xs font-bold text-primary">(C)</span>}
          {isWildcard && <span className="ml-1 text-xs font-bold text-info">(W)</span>}
        </p>
        <p className="text-sm text-gray-500 truncate">
          Rank: {rank} • Position: {position}
        </p>
      </div>
      <div className="flex-shrink-0 text-sm font-semibold text-success">+{points} pts</div>
    </div>
  );
}

export default function CurrentCompetition() {
  interface Competition {
    id: number;
    name: string;
    venue: string;
    startDate: string;
    endDate: string;
    selectionDeadline: string;
    isActive: boolean;
  }

  // Updated Selection interface to match the new API response
  interface Selection {
    id: number; // Selection record ID (might not be needed per golfer)
    golfer: {
      id: number;
      name: string;
      avatar?: string;
      rank: number | string; // Added rank
    };
    position?: number | string; // Position in the competition
    points: number; // Points gained in the competition
    isCaptain: boolean; // Added captain flag
    isWildcard: boolean; // Added wildcard flag
  }

  // Expect an array of competitions, even if only one is active
  const { data: activeCompetitions, isLoading } = useQuery<Competition[]>({ 
    queryKey: ['/api/competitions/active'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Get the first active competition, if any
  const currentCompetition = activeCompetitions?.[0];
  const queryClientHook = useQueryClient(); // Get queryClient instance

  // Fetch user's selection for the current competition
  const { data: userSelections, isLoading: isLoadingSelections } = useQuery<Selection[] | null>({ // Allow null
    // Corrected queryKey
    queryKey: ['/api/selections', currentCompetition?.id], 
    // Added queryFn to fetch from the correct endpoint
    queryFn: () => {
      if (!currentCompetition?.id) return null; // Return null if no ID
      return apiRequest<Selection[] | null>(`/api/selections/${currentCompetition.id}`, 'GET');
    },
    enabled: !!currentCompetition?.id, // Enable only if there's an active competition ID
  });

  // Setup polling for results updates
  useEffect(() => {
    if (!currentCompetition?.id) return;

    // Poll for updates every 30 seconds
    const intervalId = setInterval(() => {
      // Use the corrected queryKey for invalidation
      queryClientHook.invalidateQueries({
        queryKey: ['/api/selections', currentCompetition.id], 
      });
      queryClientHook.invalidateQueries({
        queryKey: ['/api/results', currentCompetition.id], 
      });
    }, 30000); // 30 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [currentCompetition?.id]); // Depend on currentCompetition?.id

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Current Competition</h2>
        </div>
        <Card className="mt-4">
          <CardHeader className="bg-secondary/5">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="py-6">
            <Skeleton className="h-5 w-1/4 mb-4" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if there is a currentCompetition after loading
  if (!currentCompetition) { 
    return (
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Current Competition</h2>
          <Link href="/competitions" className="text-sm font-medium text-primary hover:text-primary/80">
            View all competitions
          </Link>
        </div>
        <Card className="mt-4">
          <CardContent className="py-6 flex flex-col items-center justify-center text-center">
            <div className="text-gray-500 mb-4">
              <i className="fas fa-calendar-alt text-4xl"></i>
            </div>
            <h3 className="text-lg font-medium">No Active Competition</h3>
            <p className="text-sm text-gray-500 mt-2 mb-4">There are no active competitions at the moment.</p>
            <Button asChild>
              <Link href="/competitions">View Upcoming Competitions</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format dates now that we know currentCompetition exists
  const startDateString = new Date(currentCompetition.startDate).toLocaleDateString();
  const endDateString = new Date(currentCompetition.endDate).toLocaleDateString();

  const hasSelections = userSelections && userSelections.length > 0;
  const totalPoints = hasSelections ? userSelections.reduce((sum, selection) => sum + selection.points, 0) : 0;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Current Competition</h2>
        <Link href="/competitions" className="text-sm font-medium text-primary hover:text-primary/80">
          View all competitions
        </Link>
      </div>
      
      <Card className="mt-4">
        <CardHeader className="bg-secondary/5 px-4 py-5 sm:px-6">
          <div className="flex justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">{currentCompetition.name}</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {currentCompetition.venue} • {startDateString} - {endDateString}
              </p>
            </div>
            <div className="flex items-center">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">
                <i className="fas fa-flag mr-1"></i> In Progress
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <h4 className="text-md font-medium text-gray-900">Your Selections</h4>
          
          {isLoadingSelections ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !hasSelections ? (
            <div className="mt-4 py-6 flex flex-col items-center justify-center text-center">
              <div className="text-gray-400 mb-3">
                <i className="fas fa-golf-ball text-3xl"></i>
              </div>
              <p className="text-sm text-gray-500">You haven't made your selections for this competition yet.</p>
              <Button asChild className="mt-4">
                <Link href={`/competitions/${currentCompetition.id}`}>Make Selections</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {userSelections.map((selection, index) => (
                <GolferSelection
                  key={selection.golfer.id} // Use golfer ID for a more stable key
                  name={selection.golfer.name}
                  position={selection.position || 'N/A'}
                  points={selection.points || 0}
                  avatar={selection.golfer.avatar}
                  rank={selection.golfer.rank || 'N/A'} // Pass rank
                  isCaptain={selection.isCaptain} // Pass isCaptain
                  isWildcard={selection.isWildcard} // Pass isWildcard
                />
              ))}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="bg-slate-50 px-4 py-4 sm:px-6 border-t border-gray-200">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm font-medium text-gray-500">
              Total points for this competition: <span className="text-primary font-semibold">{totalPoints}</span>
            </p>
            <Button variant="outline" size="sm" className="text-gray-700" asChild>
              <Link href="/leaderboard">
                <i className="fas fa-eye mr-1.5"></i> View Full Leaderboard
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
