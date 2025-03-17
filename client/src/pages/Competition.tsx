import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/table";

export default function Competition() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/competitions/:id");
  const competitionId = params?.id ? parseInt(params.id) : 0;
  
  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);
  
  const { data: competition, isLoading: isLoadingCompetition } = useQuery({
    queryKey: [`/api/competitions/${competitionId}`],
    enabled: !!user && !!competitionId,
  });
  
  const { data: competitionResults, isLoading: isLoadingResults } = useQuery({
    queryKey: [`/api/competitions/${competitionId}/results`],
    enabled: !!user && !!competitionId,
  });
  
  const { data: userSelections, isLoading: isLoadingSelections } = useQuery({
    queryKey: [`/api/selections/${competitionId}`],
    enabled: !!user && !!competitionId,
  });
  
  if (!user || !match) return null;
  
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
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-gray-400 mb-4">
                <i className="fas fa-exclamation-triangle text-4xl"></i>
              </div>
              <h3 className="text-lg font-medium">Competition Not Found</h3>
              <p className="text-sm text-gray-500 mt-2 mb-4">
                The competition you're looking for doesn't exist or you don't have access to it.
              </p>
            </CardContent>
          </Card>
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
                  {new Date(competition.selectionDeadline) < new Date() && (
                    <span className="text-error ml-2">(Passed)</span>
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
          </TabsList>
          
          <TabsContent value="selections">
            <SelectionForm competitionId={competitionId} />
          </TabsContent>
          
          <TabsContent value="leaderboard">
            <Card>
              <CardContent className="p-0">
                {isLoadingSelections ? (
                  <div className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Selection 1</TableHead>
                        <TableHead>Selection 2</TableHead>
                        <TableHead>Selection 3</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userSelections?.competitionLeaderboard?.length ? (
                        userSelections.competitionLeaderboard.map((entry, index) => (
                          <TableRow key={entry.userId} className={entry.userId === user.id ? "bg-primary/5" : undefined}>
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell>
                              {entry.userName}
                              {entry.userId === user.id && " (You)"}
                            </TableCell>
                            <TableCell>{entry.selections[0]?.golferName || 'N/A'}</TableCell>
                            <TableCell>{entry.selections[1]?.golferName || 'N/A'}</TableCell>
                            <TableCell>{entry.selections[2]?.golferName || 'N/A'}</TableCell>
                            <TableCell className="text-right font-medium">{entry.totalPoints}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No leaderboard data available for this competition yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="results">
            <Card>
              <CardContent className="p-0">
                {isLoadingResults ? (
                  <div className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : competitionResults?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Position</TableHead>
                        <TableHead>Golfer</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competitionResults.map((result) => (
                        <TableRow key={result.golferId}>
                          <TableCell className="font-medium">{result.position}</TableCell>
                          <TableCell>{result.golferName}</TableCell>
                          <TableCell className="text-right font-medium">{result.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-10 text-center">
                    <div className="text-gray-400 mb-3">
                      <i className="fas fa-golf-ball text-4xl"></i>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No Results Available</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {competition.isComplete 
                        ? "Results will be posted soon." 
                        : "Results will be available after the competition."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
