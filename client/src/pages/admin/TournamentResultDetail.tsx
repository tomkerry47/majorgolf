import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button"; 
import { ArrowLeft } from 'lucide-react'; 
import { type Result, type Golfer, type Competition } from "@shared/schema"; // Import Competition type

interface TournamentResultDetailProps {
  competitionId: string; // Expecting string from URL param
  onBack: () => void; // Function to go back
}

// This component might not be actively used based on current admin page structure,
// but we'll update it for correctness.
export default function TournamentResultDetail({ competitionId, onBack }: TournamentResultDetailProps) {
  const competitionIdNum = parseInt(competitionId); // Convert string ID to number

  // Fetch results for the specific competition
  const { data: results, isLoading: isLoadingResults } = useQuery<Result[]>({
    queryKey: ['/api/results', competitionIdNum], // Use public endpoint
    queryFn: () => apiRequest(`/api/results/${competitionIdNum}`),
    enabled: !isNaN(competitionIdNum), // Only fetch if ID is a valid number
  });

  // Fetch all golfers for name lookup
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery<Golfer[]>({
    queryKey: ['/api/golfers'], // Use public endpoint
  });

  // Create a map for quick golfer name lookup
  const golferMap = useMemo(() => {
    if (!golfers) return new Map<number, Golfer>();
    return new Map(golfers.map(golfer => [golfer.id, golfer]));
  }, [golfers]);

  // Fetch competition details (optional, for displaying name)
  const { data: competition, isLoading: isLoadingCompetition } = useQuery<Competition>({
    queryKey: ['/api/competitions', competitionIdNum],
     queryFn: () => apiRequest(`/api/competitions/${competitionIdNum}`),
     enabled: !isNaN(competitionIdNum),
  });


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
         {/* Back Button */}
         <Button variant="outline" size="icon" onClick={onBack} className="mr-4">
           <ArrowLeft className="h-4 w-4" />
         </Button>
        <div className="flex-grow">
          <CardTitle>
            Results for: {isLoadingCompetition ? <Skeleton className="h-6 w-48 inline-block" /> : competition?.name ?? `Competition ${competitionId}`}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingResults || isLoadingGolfers ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Golfer</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results && results.length > 0 ? (
                results.map((result) => {
                  const golfer = golferMap.get(result.golferId);
                  return (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">{result.position === 0 ? 'CUT' : result.position}</TableCell>
                      <TableCell>
                        {/* Use firstName and lastName */}
                        {golfer ? `${golfer.firstName} ${golfer.lastName}` : 'Unknown Golfer'}
                      </TableCell>
                      <TableCell>{result.score > 0 ? `+${result.score}` : result.score === 0 ? 'E' : result.score}</TableCell>
                      <TableCell>{result.points ?? 0}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                    No results found for this tournament.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
