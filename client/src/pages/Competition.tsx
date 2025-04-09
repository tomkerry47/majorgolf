import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; 
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import SelectionForm from "@/components/selections/SelectionForm";
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
import type { Competition as CompetitionType, Selection, Result, Golfer } from "@shared/schema"; 

// Define the expected shape of the enhanced competition data from the backend
interface EnhancedCompetition extends CompetitionType {
  allSelections?: { 
    userId: number;
    username: string;
    golfer1Id: number; 
    golfer2Id: number; 
    golfer3Id: number; 
    // Use Golfer objects directly if backend provides them, otherwise keep names
    golfer1?: Golfer | null; 
    golfer2?: Golfer | null;
    golfer3?: Golfer | null;
    // Fallback names if golfer objects aren't joined
    golfer1Name?: string;
    golfer2Name?: string;
    golfer3Name?: string;
    golfer1Rank?: number | null; // Add rank field
    golfer2Rank?: number | null; // Add rank field
    golfer3Rank?: number | null; // Add rank field
    useCaptainsChip: boolean;
    captainGolferId?: number | null;
  }[] | null;
}

// Define the shape of the results data expected from the API
// Redefine without extending Result to avoid type conflict
interface CompetitionResult { 
  id: number;
  competitionId: number;
  golferId: number;
  position: number;
  score: number;
  points?: number;
  created_at: string; 
  golfer?: Golfer | null; // Expect nested golfer object with firstName/lastName
}

export default function Competition() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/competitions/:id");
  const competitionId = params?.id ? parseInt(params.id) : 0;
  
  // Redirect to login if no user
  useEffect(() => {
    if (user === null) { 
      setLocation("/login");
    }
  }, [user, setLocation]);
  
  // Fetch enhanced competition data (potentially including allSelections)
  const { data: competition, isLoading: isLoadingCompetition } = useQuery<EnhancedCompetition>({
    queryKey: [`/api/competitions/${competitionId}`],
    queryFn: () => apiRequest<EnhancedCompetition>(`/api/competitions/${competitionId}`, 'GET'), 
    enabled: !!user && !!competitionId,
  });
  
  // Fetch competition results
  const { data: competitionResults, isLoading: isLoadingResults } = useQuery<CompetitionResult[]>({
    queryKey: [`/api/results/${competitionId}`], 
    queryFn: () => apiRequest<CompetitionResult[]>(`/api/results/${competitionId}`, 'GET'), 
    enabled: !!user && !!competitionId && (competition?.isActive || competition?.isComplete), 
  });
  
  // Fetch logged-in user's selections (still needed for the "Your Selections" tab)
  const { data: userSelection, isLoading: isLoadingUserSelection } = useQuery<Selection | null>({ 
    queryKey: [`/api/selections/${competitionId}`],
    queryFn: () => apiRequest<Selection | null>(`/api/selections/${competitionId}`, 'GET'), 
    enabled: !!user && !!competitionId,
  });
  
  if (user === undefined || !match) return null; 
  
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
  
  if (!competition) {
    return (
       <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Competition Not Found</h1>
          {/* ... (rest of not found card) ... */}
        </div>
      </div>
    );
  }
  
  const getStatusBadge = () => {
    if (competition.isActive) {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">Active</Badge>;
    } else if (competition.isComplete) {
      return <Badge variant="outline" className="bg-slate-500/10 text-slate-700 border-slate-200">Completed</Badge>;
    } else {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Upcoming</Badge>;
    }
  };

  const deadlinePassed = new Date() > new Date(competition.selectionDeadline);
  
  // Helper to display golfer name
  const getGolferDisplayName = (golfer?: Golfer | null, fallbackName?: string): string => {
    if (golfer && golfer.firstName && golfer.lastName) {
      return `${golfer.firstName} ${golfer.lastName}`;
    }
    return fallbackName || 'Unknown Golfer';
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{competition.name}</h1>
          {getStatusBadge()}
        </div>
        
        <Card className="mb-6">
          <CardContent className="p-6">
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
          </CardContent>
        </Card>
        
        <Tabs defaultValue="selections">
          <TabsList className="mb-6">
            <TabsTrigger value="selections">Your Selections</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            {deadlinePassed && (
              <TabsTrigger value="all-selections">All Selections</TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="selections">
            {/* Pass competitionName and selectionDeadline to SelectionForm */}
            <SelectionForm 
              competitionId={competitionId} 
              competitionName={competition.name} 
              selectionDeadline={competition.selectionDeadline} 
            />
          </TabsContent>
          
          <TabsContent value="leaderboard">
             <Card>
              <CardHeader><CardTitle>Leaderboard</CardTitle></CardHeader>
              <CardContent className="p-0">
                 <div className="p-8 text-center text-gray-500">Leaderboard data needs to be fetched separately.</div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="results">
            <Card>
               <CardHeader><CardTitle>Results</CardTitle></CardHeader>
              <CardContent className="p-0">
                {isLoadingResults ? (
                  <div className="p-6"><Skeleton className="h-64 w-full" /></div>
                ) : competitionResults?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Golfer</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competitionResults.map((result) => (
                        <TableRow key={result.golferId}>
                          <TableCell className="font-medium">{result.position === 0 ? 'CUT' : result.position || 'N/A'}</TableCell>
                          {/* Use helper function to display name */}
                          <TableCell>{getGolferDisplayName(result.golfer)}</TableCell> 
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
                    <p className="text-sm text-gray-500 mt-1">
                      {competition.isComplete ? "Results will be posted soon." : "Results will be available after the competition."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* New Tab Content for All Selections */}
          {deadlinePassed && (
            <TabsContent value="all-selections">
              <Card>
                <CardHeader>
                  <CardTitle>All Player Selections</CardTitle>
                  <CardDescription>Selections are revealed after the deadline.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {competition.allSelections && competition.allSelections.length > 0 ? (
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
                        {competition.allSelections.map((sel) => (
                          <TableRow key={sel.userId}>
                            <TableCell className="font-medium">{sel.username}</TableCell>
                            <TableCell>
                              {getGolferDisplayName(sel.golfer1, sel.golfer1Name)}
                              {sel.golfer1Rank && <span className="text-xs text-gray-500 ml-1">(Rank: {sel.golfer1Rank})</span>}
                              {sel.golfer1Rank && sel.golfer1Rank >= 51 && <span className="text-blue-600 font-bold ml-1">(W)</span>}
                              {sel.useCaptainsChip && sel.captainGolferId === sel.golfer1Id && <span className="text-green-600 font-bold ml-1">(C)</span>}
                            </TableCell>
                            <TableCell>
                              {getGolferDisplayName(sel.golfer2, sel.golfer2Name)}
                              {sel.golfer2Rank && <span className="text-xs text-gray-500 ml-1">(Rank: {sel.golfer2Rank})</span>}
                              {sel.golfer2Rank && sel.golfer2Rank >= 51 && <span className="text-blue-600 font-bold ml-1">(W)</span>}
                              {sel.useCaptainsChip && sel.captainGolferId === sel.golfer2Id && <span className="text-green-600 font-bold ml-1">(C)</span>}
                            </TableCell>
                            <TableCell>
                              {getGolferDisplayName(sel.golfer3, sel.golfer3Name)}
                              {sel.golfer3Rank && <span className="text-xs text-gray-500 ml-1">(Rank: {sel.golfer3Rank})</span>}
                              {sel.golfer3Rank && sel.golfer3Rank >= 51 && <span className="text-blue-600 font-bold ml-1">(W)</span>}
                              {sel.useCaptainsChip && sel.captainGolferId === sel.golfer3Id && <span className="text-green-600 font-bold ml-1">(C)</span>}
                            </TableCell>
                          </TableRow>
                        ))}
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

        </Tabs>
      </div>
    </div>
  );
}
