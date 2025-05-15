import React, { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import SelectionForm from "@/components/selections/SelectionForm";
import { Button } from "@/components/ui/button"; 
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import LeaderboardTable from "@/components/leaderboard-table"; 
import type { Competition as CompetitionType, Result, Golfer } from "@shared/schema";

// Define the expected shape for a single user selection with nested golfer details
interface UserCompetitionSelection {
  id: number; 
  golfer: {
    id: number;
    name: string; 
    firstName?: string; 
    lastName?: string; 
    avatar?: string;
    rank: number | string; 
    waiverRank?: number | null; 
  };
  position?: number | string; 
  points: number; 
  isCaptain: boolean;
  isWildcard: boolean; 
}


// Define the expected shape of the enhanced competition data from the backend
interface EnhancedCompetition extends CompetitionType {
  allSelections?: {
    userId: number;
    username: string;
    golfer1Id: number;
    golfer2Id: number;
    golfer3Id: number;
    golfer1?: Golfer | null;
    golfer2?: Golfer | null;
    golfer3?: Golfer | null;
    golfer1Name?: string;
    golfer2Name?: string;
    golfer3Name?: string;
    golfer1Rank?: number | null; 
    golfer2Rank?: number | null; 
     golfer3Rank?: number | null;
   useCaptainsChip: boolean;
   captainGolferId?: number | null;
   waiverChipOriginalGolferId?: number | null; 
   waiverChipReplacementGolferId?: number | null; 
   waiverChipOriginalGolferDetails?: { name: string; rank: number | null } | null; 
 }[] | null;
  currentRound?: number | null; 
}

// Define the shape of the results data expected from the API
interface CompetitionResult {
  id: number;
  competitionId: number;
  golferId: number;
  position: number;
  score: number;
  points?: number;
  created_at: string;
  golfer?: Golfer | null; 
}

// Copied from leaderboard.tsx - Shape for the Leaderboard data
interface LeaderboardEntryForPage { 
  rank: number;
  userId: number;
  username: string;
  email: string;
  avatarUrl?: string;
  points: number;
  selections?: { 
    playerId: number;
    playerName: string;
    position?: number;
    isCaptain: boolean;
    isWaiver: boolean; 
    rank?: number | null; 
  }[];
  lastPointsChange?: number | null;
  hasUsedCaptainsChip: boolean;
  hasUsedWaiverChip: boolean;
  captainGolferId?: number | null;
  waiverReplacementGolferId?: number | null;
}

interface LeaderboardData {
  standings: LeaderboardEntryForPage[]; 
  currentUserId?: number;
  lastUpdated?: string | null;
  currentRound?: number;
  roundCompleted?: boolean;
}

// Define the expected shape for chip usage data from the new API endpoint
interface ChipUsageInfo {
  userId: number;
  username: string;
  useCaptainsChip: boolean;
  captainGolferId?: number | null;
  captainGolferName?: string | null;
  captainGolferRank?: number | null;
  useWaiverChip: boolean; 
  waiverChipOriginalGolferId?: number | null;
  waiverChipOriginalGolferName?: string | null;
  waiverChipOriginalGolferRank?: number | null;
  waiverChipReplacementGolferId?: number | null;
  waiverChipReplacementGolferName?: string | null;
  waiverChipReplacementGolferRank?: number | null;
}

interface ChipUsageData {
  chips: ChipUsageInfo[];
}


// Adapted GolferSelection component for this page
function GolferSelectionDisplay({ selection }: { selection: UserCompetitionSelection }) {
  const { golfer, position, points, isCaptain, isWildcard: isWaiverReplacement } = selection;
  const rankToCheck = isWaiverReplacement ? golfer.waiverRank : golfer.rank;
  const rankNumber = typeof rankToCheck === 'string' ? parseInt(rankToCheck, 10) : rankToCheck;
  const isRankWildcard = typeof rankNumber === 'number' && !isNaN(rankNumber) && rankNumber > 50; 

  return (
    <div className="relative rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm flex items-center space-x-3 hover:border-primary/30">
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
          {golfer.avatar ? (
            <img className="h-10 w-10 rounded-full" src={golfer.avatar} alt={golfer.name} />
          ) : (
            <span className="text-sm font-medium text-gray-800">{golfer.name.charAt(0)}</span>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {golfer.name}
          {isCaptain && <span className="ml-1 text-xs font-bold text-primary">(C)</span>}
          {isWaiverReplacement && <span className="ml-1 text-xs font-bold text-blue-600">(W)</span>} {/* Waiver Badge */}
          {isRankWildcard && <span className="ml-1 text-xs font-bold text-orange-600">(*)</span>} {/* Wildcard Badge */}
         </p>
         <p className="text-sm text-gray-500 truncate">
           Rank: {golfer.rank || 'N/A'} • Position: {position === 0 ? '(MC)' : position || '(MC)'} {/* Changed N/A to (MC) */}
         </p>
       </div>
       <div className="flex-shrink-0 text-sm font-semibold text-success">
         +{ (points || 0) * (isCaptain || isRankWildcard ? 2 : 1) } pts
       </div>
    </div>
  );
}


export default function Competition() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/competitions/:id");
  const competitionId = params?.id ? parseInt(params.id) : 0;
  const [isEditingSelection, setIsEditingSelection] = useState(false); // Moved state here

  // Redirect to login if no user
  useEffect(() => {
    if (user === null) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  // --- Unconditional Hook Calls ---

  // Fetch enhanced competition data
  const { data: competition, isLoading: isLoadingCompetition, isSuccess: isCompetitionSuccess } = useQuery<EnhancedCompetition>({ 
    queryKey: [`/api/competitions/${competitionId}`],
    queryFn: () => apiRequest<EnhancedCompetition>(`/api/competitions/${competitionId}`, 'GET'),
    enabled: !!user && !!competitionId,
  });

  // Fetch competition results - Enable based on competition status
  const { data: competitionResults, isLoading: isLoadingResults } = useQuery<CompetitionResult[]>({
    queryKey: [`/api/results/${competitionId}`],
    queryFn: () => apiRequest<CompetitionResult[]>(`/api/results/${competitionId}`, 'GET'),
    enabled: !!user && !!competitionId && isCompetitionSuccess && !!competition && (competition.isActive || competition.isComplete), 
  });

  // Fetch logged-in user's selections - Enable based on user/compID only
  const { data: userSelections, isLoading: isLoadingUserSelections } = useQuery<UserCompetitionSelection[] | null>({
    queryKey: ['/api/selections', competitionId], 
    queryFn: () => { 
       if (!competitionId) return null; 
       return apiRequest<UserCompetitionSelection[] | null>(`/api/selections/${competitionId}`, 'GET');
    },
    enabled: !!user && !!competitionId,
    retry: false, 
  });

  // Fetch predictor leaderboard data - Enable based on competition status
  const { data: predictorLeaderboardData, isLoading: isLoadingPredictorLeaderboard } = useQuery<LeaderboardData>({
    queryKey: [`/api/leaderboard/${competitionId}`],
    queryFn: () => apiRequest<LeaderboardData>(`/api/leaderboard/${competitionId}`, 'GET'),
    enabled: !!user && !!competitionId && isCompetitionSuccess && !!competition && (competition.isActive || competition.isComplete),
  });

  // Fetch chip usage data - Enable based on competition data and deadline
  const { data: chipUsageData, isLoading: isLoadingChipUsage } = useQuery<ChipUsageData>({
    queryKey: [`/api/competitions/${competitionId}/chips`],
    queryFn: () => apiRequest<ChipUsageData>(`/api/competitions/${competitionId}/chips`, 'GET'),
    enabled: !!user && !!competitionId && isCompetitionSuccess && !!competition && (new Date() > new Date(competition.selectionDeadline)), 
  });

  // --- End Unconditional Hook Calls ---

  if (user === undefined || !match) return null; // Still needed for initial auth check

  // === Reintroduce Early Return for Loading State ===
  if (isLoadingCompetition) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-full mb-4" />
              <Skeleton className="h-4 w-2/3 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show not found message if competition data fetch succeeded but no competition was found
  if (isCompetitionSuccess && !competition) { 
    return (
       <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Competition Not Found</h1>
        </div>
      </div>
    );
  }

  // Calculate deadlinePassed *after* loading/not found checks, ensuring competition is defined
  // Add a check to ensure competition is not null before accessing its properties
  const deadlinePassed = competition ? new Date() > new Date(competition.selectionDeadline) : false;


  const getStatusBadge = () => {
    // No need for loading check here as we return early if isLoadingCompetition
    // Add check for competition existence
    if (!competition) return <Skeleton className="h-6 w-20" />; 
    
    if (competition.isActive) {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">Active</Badge>;
    } else if (competition.isComplete) {
      return <Badge variant="outline" className="bg-slate-500/10 text-slate-700 border-slate-200">Completed</Badge>;
    } else {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Upcoming</Badge>;
    }
  };

  // Helper to get round display name
  const getRoundDisplayName = (round: number | null | undefined): string | null => {
    if (round === null || round === undefined) return null;
    if (round === 1) return "Round 1";
    if (round === 2) return "Round 2";
    if (round === 3) return "Round 3";
    if (round === 4) return "Final Round";
    return `Round ${round}`; 
  };

  // Helper to display golfer name
  const getGolferDisplayName = (golfer?: Golfer | null, fallbackName?: string): string => {
    if (golfer && golfer.firstName && golfer.lastName) {
      return `${golfer.firstName} ${golfer.lastName}`;
    }
    if (golfer && golfer.name) {
        return golfer.name;
    }
    return fallbackName || 'Unknown Golfer';
  };

  // Calculate golfer selection counts if allSelections data is available
  const golferSelectionCounts = new Map<number, number>();
  // Add check for competition existence
  if (competition?.allSelections) {
    competition.allSelections.forEach(sel => {
      if (sel.golfer1Id) golferSelectionCounts.set(sel.golfer1Id, (golferSelectionCounts.get(sel.golfer1Id) || 0) + 1);
      if (sel.golfer2Id) golferSelectionCounts.set(sel.golfer2Id, (golferSelectionCounts.get(sel.golfer2Id) || 0) + 1);
      if (sel.golfer3Id) golferSelectionCounts.set(sel.golfer3Id, (golferSelectionCounts.get(sel.golfer3Id) || 0) + 1);
    });
  }
  // Add check for competition existence
  const showSelectionCounts = !!competition?.allSelections && deadlinePassed; 

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
           {/* Add check for competition existence */}
           <h1 className="text-2xl font-semibold text-gray-900">{competition?.name || <Skeleton className="h-8 w-1/2" />}</h1>
          {getStatusBadge()}
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
             {/* Add check for competition existence */}
             { !competition ? (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <Skeleton className="h-12 w-full" /> 
                 <Skeleton className="h-12 w-full" />
                 <Skeleton className="h-12 w-full" />
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                   <h3 className="text-sm font-medium text-gray-500">Venue</h3>
                   <p className="mt-1 text-sm text-gray-900">{competition.venue}</p>
                 </div>
                 <div>
                   <h3 className="text-sm font-medium text-gray-500">Dates</h3>
                   <p className="mt-1 text-sm text-gray-900">
                     {new Date(competition.startDate).toLocaleDateString()} - {new Date(competition.endDate).toLocaleDateString()}
                   </p>
                 </div>
                 <div>
                   <h3 className="text-sm font-medium text-gray-500">Selection Deadline</h3>
                   <p className="mt-1 text-sm text-gray-900">
                     {new Date(competition.selectionDeadline).toLocaleDateString()}
                     {deadlinePassed && ( 
                       <span className="text-red-600 ml-2">(Passed)</span>
                     )}
                   </p>
                 </div>
               </div>
             )}
          </CardContent>
        </Card>

        <Tabs defaultValue="leaderboard">
          <TabsList className="mb-14 flex-wrap"> {/* Changed margin bottom to 14 */}
            <TabsTrigger value="predictor-leaderboard">Predictor Leaderboard</TabsTrigger>
            <TabsTrigger value="leaderboard">Actual Leaderboard</TabsTrigger>
            <TabsTrigger value="results">Points Allocated</TabsTrigger>
            <TabsTrigger value="selections">Your Selections</TabsTrigger>
            {/* Render deadline-dependent triggers conditionally */}
            {deadlinePassed && (
              <TabsTrigger value="all-selections">All Selections</TabsTrigger>
            )}
            {deadlinePassed && (
              <TabsTrigger value="chips-used">Chips Used</TabsTrigger>
            )}
          </TabsList>

          {/* --- Tab Content Sections --- */}

          <TabsContent value="selections">
            {isLoadingUserSelections ? (
              <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
            ) : isEditingSelection && competition ? (
              <SelectionForm
                competitionId={competitionId}
                competitionName={competition.name}
                selectionDeadline={competition.selectionDeadline}
                onSuccess={() => setIsEditingSelection(false)} // Hide form on success
              />
            ) : userSelections && userSelections.length > 0 && competition ? (
              <Card>
                <CardHeader>
                  <CardTitle>Your Selection</CardTitle>
                  <CardDescription>For {competition.name}. Deadline: {new Date(competition.selectionDeadline).toLocaleString()}</CardDescription>
                  {deadlinePassed && (
                    <Badge variant="destructive" className="mt-2">Deadline Passed</Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {userSelections.map((selection) => (
                      <GolferSelectionDisplay key={selection.id} selection={selection} />
                    ))}
                  </div>
                  {!deadlinePassed && (
                    <Button variant="outline" className="mt-4" onClick={() => setIsEditingSelection(true)}>
                      Edit Selection
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : !deadlinePassed && competition ? (
              <SelectionForm
                competitionId={competitionId}
                competitionName={competition.name}
                selectionDeadline={competition.selectionDeadline}
                // onSuccess for new selections could also hide form or navigate, if desired
              />
            ) : deadlinePassed ? (
              <Card>
                <CardHeader><CardTitle>No Selection Made or Deadline Passed</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-gray-500">You did not make a selection for this competition, or the deadline to edit has passed.</p></CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="predictor-leaderboard">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Predictor Leaderboard</CardTitle>
                  {/* Add check for competition existence */}
                  {competition && (
                    <Badge variant="outline" className={
                      competition.isComplete
                        ? "bg-green-500/10 text-green-700 border-green-200"
                        : "bg-yellow-500/10 text-yellow-700 border-yellow-200"
                    }>
                      Status: {competition.isComplete ? 'Result' : 'Pending'}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  User rankings for this competition. Last updated: {predictorLeaderboardData?.lastUpdated ? new Date(predictorLeaderboardData.lastUpdated).toLocaleString() : 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                  <LeaderboardTable
                    data={predictorLeaderboardData?.standings || []}
                    isLoading={isLoadingPredictorLeaderboard}
                    userId={predictorLeaderboardData?.currentUserId}
                    displayMode="competition" 
                  />
                  {!isLoadingPredictorLeaderboard && (!predictorLeaderboardData || predictorLeaderboardData.standings.length === 0) && (
                    <div className="py-10 text-center">
                      <div className="text-gray-400 mb-3"><i className="fas fa-users text-4xl"></i></div>
                      <h3 className="text-lg font-medium text-gray-900">Predictor Leaderboard Not Available</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        User rankings for this competition will appear here once available.
                      </p>
                    </div>
                 )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center"> 
                    <CardTitle>Actual Leaderboard</CardTitle>
                    {/* Add check for competition existence */}
                    {competition?.currentRound && competitionResults?.length ? (
                      <Badge variant="secondary">
                        {getRoundDisplayName(competition.currentRound)} Results
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingResults ? (
                    <div className="p-6"><Skeleton className="h-64 w-full" /></div>
                  ) : competitionResults?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Pos</TableHead>
                          <TableHead>Golfer</TableHead>
                          {showSelectionCounts && <TableHead className="text-center w-24">Selected By</TableHead>}
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {competitionResults.map((result) => (
                          <TableRow key={result.golferId}>
                            <TableCell className="font-medium">{result.position === 0 ? 'CUT' : result.position || 'N/A'}</TableCell>
                            <TableCell>{getGolferDisplayName(result.golfer)}</TableCell>
                            {showSelectionCounts && (
                              <TableCell className="text-center">
                                {golferSelectionCounts.get(result.golferId) || 0}
                              </TableCell>
                            )}
                            <TableCell className="text-right">{result.score > 0 ? `+${result.score}` : result.score === 0 ? 'E' : result.score}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-10 text-center">
                      <div className="text-gray-400 mb-3"><i className="fas fa-list-ol text-4xl"></i></div> 
                      <h3 className="text-lg font-medium text-gray-900">Tournament Leaderboard Not Available</h3> 
                      <p className="text-sm text-gray-500 mt-1">
                        The official tournament leaderboard will appear here once available. 
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results">
            <Card>
               <CardHeader>
                 <div className="flex justify-between items-center"> 
                   <CardTitle>Points Allocated</CardTitle>
                   {/* Add check for competition existence */}
                   {competition && ( 
                     <Badge variant="outline" className={
                       competition.isComplete
                         ? "bg-green-500/10 text-green-700 border-green-200" 
                         : "bg-yellow-500/10 text-yellow-700 border-yellow-200" 
                     }>
                       Points: {competition.isComplete ? 'Finalised' : 'Pending'}
                     </Badge>
                   )}
                 </div>
               </CardHeader>
              <CardContent className="p-0">
                {isLoadingResults ? (
                  <div className="p-6"><Skeleton className="h-64 w-full" /></div>
                ) : competitionResults?.length ? (
                  <Table>
                    <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Pos</TableHead>
                          <TableHead>Golfer</TableHead>
                          {showSelectionCounts && <TableHead className="text-center w-24">Selected By</TableHead>}
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {competitionResults.map((result) => (
                          <TableRow key={result.golferId}>
                            <TableCell className="font-medium">{result.position === 0 ? 'CUT' : result.position || 'N/A'}</TableCell>
                            <TableCell>{getGolferDisplayName(result.golfer)}</TableCell>
                            {showSelectionCounts && (
                              <TableCell className="text-center">
                                {golferSelectionCounts.get(result.golferId) || 0}
                              </TableCell>
                            )}
                            <TableCell className="text-right">{result.score > 0 ? `+${result.score}` : result.score === 0 ? 'E' : result.score}</TableCell>
                            <TableCell className="text-right font-medium">{result.points ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-10 text-center">
                    <div className="text-gray-400 mb-3"><i className="fas fa-golf-ball text-4xl"></i></div>
                    <h3 className="text-lg font-medium text-gray-900">No Results Available</h3>
                    {/* Add check for competition existence */}
                    <p className="text-sm text-gray-500 mt-1">
                      {competition?.isComplete ? "Results will be posted soon." : "Results will be available after the competition."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Render deadline-dependent content conditionally */}
          {deadlinePassed && (
            <TabsContent value="all-selections">
              <Card>
                <CardHeader>
                  <CardTitle>All Player Selections</CardTitle>
                  <CardDescription>Selections are revealed after the deadline.</CardDescription>
                </CardHeader> 
                <CardContent className="p-0">
                  {/* Add check for competition existence */}
                  {competition?.allSelections && competition.allSelections.length > 0 ? (
                    <Table>
                      <TableCaption>All selections for {competition.name}</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Selection 1</TableHead>
                          <TableHead>Selection 2</TableHead>
                          <TableHead>Selection 3</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {competition.allSelections.map((sel) => {
                          const waiverUsed = !!sel.waiverChipOriginalGolferId;
                          const replacementId = sel.waiverChipReplacementGolferId;
                          
                          const renderGolferCell = (golferId: number, golferName: string | undefined, golferRank: number | null | undefined, golferObj: Golfer | null | undefined) => {
                            const displayName = getGolferDisplayName(golferObj, golferName);
                            const displayRank = golferRank; 
                            const showWaiverBadge = waiverUsed && golferId === replacementId;
                            const showWildcardBadge = typeof displayRank === 'number' && displayRank > 50;

                            return (
                              <>
                                {displayName}
                                {displayRank && <span className="text-xs text-gray-500 ml-1">({displayRank})</span>}
                                {showWaiverBadge && <span className="text-blue-600 font-bold ml-1">(W)</span>}
                                {showWildcardBadge && <span className="text-orange-600 font-bold ml-1">(*)</span>}
                                {sel.useCaptainsChip && sel.captainGolferId === golferId && <span className="text-green-600 font-bold ml-1">(C)</span>}
                              </>
                            );
                          };

                          return (
                            <TableRow key={sel.userId}>
                              <TableCell className="font-medium">{sel.username}</TableCell>
                              <TableCell>
                                {renderGolferCell(sel.golfer1Id, sel.golfer1Name, sel.golfer1Rank, sel.golfer1)}
                              </TableCell>
                              <TableCell>
                                {renderGolferCell(sel.golfer2Id, sel.golfer2Name, sel.golfer2Rank, sel.golfer2)}
                              </TableCell>
                              <TableCell>
                                {renderGolferCell(sel.golfer3Id, sel.golfer3Name, sel.golfer3Rank, sel.golfer3)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      No selections have been made for this competition yet, or data is unavailable.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Render deadline-dependent content conditionally */}
          {deadlinePassed && (
            <TabsContent value="chips-used">
              <Card>
                <CardHeader>
                  <CardTitle>Chips Used</CardTitle>
                  <CardDescription>Captain and Waiver chips used by players in this competition.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingChipUsage ? (
                    <Skeleton className="h-48 w-full" />
                  ) : chipUsageData && chipUsageData.chips.length > 0 ? (
                    <>
                      {/* Captains Chips Section */}
                      <div>
                        <h3 className="text-lg font-medium mb-2">Captains Chips Used</h3>
                        {chipUsageData.chips.some(chip => chip.useCaptainsChip) ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Captain Golfer</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {chipUsageData.chips
                                .filter(chip => chip.useCaptainsChip && chip.captainGolferName) 
                                .map((chip) => {
                                  const isWildcard = typeof chip.captainGolferRank === 'number' && chip.captainGolferRank > 50;
                                  return (
                                    <TableRow key={`captain-${chip.userId}`}>
                                      <TableCell className="font-medium">{chip.username}</TableCell>
                                      <TableCell>
                                        {chip.captainGolferName}
                                        {chip.captainGolferRank && <span className="text-xs text-gray-500 ml-1">({chip.captainGolferRank})</span>}
                                        {isWildcard && <span className="text-orange-600 font-bold ml-1">(*)</span>}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-gray-500">No Captains chips were used in this competition.</p>
                        )}
                      </div>

                      {/* Waiver Chips Section */}
                      <div>
                        <h3 className="text-lg font-medium mb-2">Waiver Chips Used</h3>
                        {chipUsageData.chips.some(chip => chip.useWaiverChip) ? (
                           <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Replaced Golfer</TableHead>
                                <TableHead>Replacement Golfer</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {chipUsageData.chips
                                .filter(chip => chip.useWaiverChip && chip.waiverChipOriginalGolferName && chip.waiverChipReplacementGolferName) 
                                .map((chip) => {
                                  const isReplacementWildcard = typeof chip.waiverChipReplacementGolferRank === 'number' && chip.waiverChipReplacementGolferRank > 50;
                                  return (
                                    <TableRow key={`waiver-${chip.userId}`}>
                                      <TableCell className="font-medium">{chip.username}</TableCell>
                                      <TableCell>
                                        {chip.waiverChipOriginalGolferName}
                                        {chip.waiverChipOriginalGolferRank && <span className="text-xs text-gray-500 ml-1">({chip.waiverChipOriginalGolferRank})</span>}
                                      </TableCell>
                                      <TableCell>
                                        {chip.waiverChipReplacementGolferName}
                                        {chip.waiverChipReplacementGolferRank && <span className="text-xs text-gray-500 ml-1">({chip.waiverChipReplacementGolferRank})</span>}
                                        {isReplacementWildcard && <span className="text-orange-600 font-bold ml-1">(*)</span>}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-gray-500">No Waiver chips were used in this competition.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      Chip usage information is not yet available or no chips were used.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
  );
}
