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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Competition, type Result, type Golfer } from "@shared/schema"; // Import Golfer type

export default function TournamentResults() {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);

  // Fetch all competitions
  const { data: competitions, isLoading: isLoadingCompetitions } = useQuery<Competition[]>({
    queryKey: ['/api/competitions/all'], // Use public endpoint
  });

  // Fetch results for the selected competition
  const { data: results, isLoading: isLoadingResults } = useQuery<Result[]>({
    queryKey: ['/api/results', selectedCompetitionId], // Use public endpoint
    queryFn: () => apiRequest(`/api/results/${selectedCompetitionId}`),
    enabled: !!selectedCompetitionId, // Only fetch if a competition is selected
  });

  // Fetch all golfers for name lookup - Updated to handle { golfers: [...] }
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery<{ golfers: Golfer[] }, Error, Golfer[]>({
    queryKey: ['/api/golfers'],
    queryFn: () => apiRequest<{ golfers: Golfer[] }>('/api/golfers'), // Fetch the object
    // More defensive select: ensure data exists and has the golfers property which is an array
    select: (data) => (data && Array.isArray(data.golfers) ? data.golfers : []),
  });

  // Create a map for quick golfer name lookup
  const golferMap = useMemo(() => {
    // Explicitly check if golfers is an array before mapping
    if (!golfers || !Array.isArray(golfers)) {
      return new Map<number, Golfer>();
    }
    return new Map(golfers.map(golfer => [golfer.id, golfer]));
  }, [golfers]);

  // Filter for completed competitions
  const completedCompetitions = useMemo(() => {
    return competitions?.filter(c => c.isComplete) || [];
  }, [competitions]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tournament Results</CardTitle>
        <Select
          value={selectedCompetitionId?.toString() || ""}
          onValueChange={(value) => setSelectedCompetitionId(value ? parseInt(value) : null)}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select completed tournament" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingCompetitions ? (
              <div className="p-2 text-center text-sm text-gray-500">Loading...</div>
            ) : completedCompetitions.length > 0 ? (
              completedCompetitions.map((competition) => (
                <SelectItem key={competition.id} value={competition.id.toString()}>
                  {competition.name}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-center text-sm text-gray-500">No completed tournaments</div>
            )}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {!selectedCompetitionId ? (
          <div className="text-center py-10 text-gray-500">
            Please select a completed tournament to view results.
          </div>
        ) : isLoadingResults || isLoadingGolfers ? (
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
              {/* Add explicit check to ensure results is an array */}
              {results && Array.isArray(results) && results.length > 0 ? (
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
