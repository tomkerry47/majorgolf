import { useQuery } from "@tanstack/react-query"; // Removed useState
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Removed Tabs imports
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getAuthHeaders } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Define interface for the enriched selection data
interface EnrichedSelection {
  id: number;
  userId: number;
  competitionId: number;
  golfer1Id: number;
  golfer2Id: number;
  golfer3Id: number;
  useCaptainsChip: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  competition: {
    id: number;
    name: string;
    venue: string;
    startDate: string | null;
    endDate: string | null;
    selectionDeadline: string | null;
    isActive: boolean;
    isComplete: boolean;
  } | null;
  golfer1: { id: number; name: string; avatar: string | null } | null;
  golfer2: { id: number; name: string; avatar: string | null } | null;
  golfer3: { id: number; name: string; avatar: string | null } | null;
  golfer1Result: { position: number; points: number | null } | null;
  golfer2Result: { position: number; points: number | null } | null;
  golfer3Result: { position: number; points: number | null } | null;
  totalPoints: number;
}


interface ProfileSelectionsProps {
  // userId prop removed
  username: string;
}

  // userId removed from function parameters
export default function ProfileSelections({ username }: ProfileSelectionsProps) {
  // Removed selectedStatus state
  console.log("[ProfileSelections] Rendering component for username:", username); // Added log

  // Specify the type for useQuery data
  // Add 'error' to the destructured result
  const { data: userSelections, isLoading, error } = useQuery<EnrichedSelection[], Error>({ // Added Error type
    // Updated queryKey to use the correct endpoint
    queryKey: ['/api/selections/my-all'],
    queryFn: async ({ queryKey }) => {
      console.log("[ProfileSelections] Fetching data for queryKey:", queryKey); // Added log
      const headers = getAuthHeaders();
      console.log("[ProfileSelections] Using auth headers:", headers); // Added log
      
      const response = await fetch(queryKey[0] as string, {
        headers,
        credentials: 'include'
      });
      
      console.log("[ProfileSelections] Fetch response status:", response.status); // Added log
      
      if (!response.ok) {
         const errorText = await response.text(); // Try to get error text
         console.error("[ProfileSelections] Fetch failed:", response.status, errorText); // Added log
        throw new Error(`Failed to fetch user selections: ${response.status} ${errorText}`); // Include status/text
      }
      const jsonData = await response.json();
      console.log("[ProfileSelections] Fetch successful, data received:", jsonData); // Added log
      return jsonData;
    },
    // enabled check removed as userId is no longer needed
    // onSuccess/onError removed as they are not direct options in TanStack Query v5
  });
  
  // Log loading state and error
  console.log("[ProfileSelections] isLoading:", isLoading);
  if (error) {
    console.error("[ProfileSelections] useQuery error:", error);
  }
  
  if (isLoading) {
    console.log("[ProfileSelections] Showing loading skeleton."); // Added log
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selection History</CardTitle>
          {/* Removed Tabs, TabsList, TabsTrigger */}
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Add explicit check for userSelections before filtering/logging
  if (!userSelections && !isLoading) { // Only show 'no data' if not loading
     console.log("[ProfileSelections] No userSelections data available and not loading."); // Added log
    // Optionally return a message or different loading state if needed
    return (
       <Card>
         <CardHeader>
           <CardTitle>Selection History</CardTitle>
         </CardHeader>
         <CardContent>
           <p className="text-center py-5 text-gray-500">No selection data available.</p>
         </CardContent>
       </Card>
     );
  }

  // Handle error state
  if (error) {
    console.error("[ProfileSelections] Rendering error state.");
    return (
      <Card>
        <CardHeader><CardTitle>Selection History</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center py-5 text-destructive">Error loading selections: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Handle case where data is successfully fetched but is empty or undefined
  if (!userSelections || userSelections.length === 0) {
    console.log("[ProfileSelections] Rendering no selections found state.");
     return (
       <Card>
         <CardHeader><CardTitle>Selection History</CardTitle></CardHeader>
         <CardContent>
           <p className="text-center py-5 text-gray-500">No selections found for {username}.</p>
         </CardContent>
       </Card>
     );
  }

  // --- Data is available, proceed with filtering ---
  console.log("[ProfileSelections] Data available, proceeding to filter.");

  // Filter selections into categories
  const upcomingSelections = userSelections.filter((s: EnrichedSelection) => !s.competition?.isActive && !s.competition?.isComplete);
  const activeSelections = userSelections.filter((s: EnrichedSelection) => s.competition?.isActive);
  const completedSelections = userSelections.filter((s: EnrichedSelection) => s.competition?.isComplete);
 
   // Log the filtered data
   console.log("[ProfileSelections] Filtered Selections:", { upcomingSelections, activeSelections, completedSelections });
 
   // Helper function to render a selection table
  const renderSelectionTable = (selections: EnrichedSelection[], title: string) => {
    if (selections.length === 0) {
      return (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center py-5 text-gray-500">No {title.toLowerCase()} selections found for {username}.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competition</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Selection 1</TableHead>
                <TableHead>Selection 2</TableHead>
                <TableHead>Selection 3</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selections.map((selection: EnrichedSelection) => {
                // Removed detailed logging from inside the map
                return (
                  <TableRow key={selection.id}>
                    <TableCell className="font-medium">
                      <div>
                      <div>{selection.competition?.name}</div>
                      <div className="text-xs text-gray-500">{selection.competition?.venue}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {selection.competition?.startDate ? new Date(selection.competition.startDate).toLocaleDateString() : 'N/A'}
                      {" - "}
                      {selection.competition?.endDate ? new Date(selection.competition.endDate).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="mt-1">
                      {selection.competition?.isComplete ? (
                        <Badge variant="outline" className="bg-slate-100 text-slate-800">Completed</Badge>
                      ) : selection.competition?.isActive ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-primary/10 text-primary">Upcoming</Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Display Golfer 1 */}
                  <TableCell>
                    <div className="flex items-center">
                      {selection.golfer1?.avatar ? (
                        <img className="h-6 w-6 rounded-full mr-2" src={selection.golfer1.avatar} alt={selection.golfer1.name} />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-gray-800">{selection.golfer1?.name?.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <div>{selection.golfer1?.name || 'N/A'}</div>
                        {selection.golfer1Result && (selection.competition?.isComplete || selection.competition?.isActive) && (
                          <div className="text-xs text-gray-500">
                            Pos: {selection.golfer1Result.position}, Pts: <span className="text-success font-medium">+{selection.golfer1Result.points ?? 0}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Display Golfer 2 */}
                  <TableCell>
                    <div className="flex items-center">
                      {selection.golfer2?.avatar ? (
                        <img className="h-6 w-6 rounded-full mr-2" src={selection.golfer2.avatar} alt={selection.golfer2.name} />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-gray-800">{selection.golfer2?.name?.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <div>{selection.golfer2?.name || 'N/A'}</div>
                        {selection.golfer2Result && (selection.competition?.isComplete || selection.competition?.isActive) && (
                          <div className="text-xs text-gray-500">
                            Pos: {selection.golfer2Result.position}, Pts: <span className="text-success font-medium">+{selection.golfer2Result.points ?? 0}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Display Golfer 3 */}
                  <TableCell>
                    <div className="flex items-center">
                      {selection.golfer3?.avatar ? (
                        <img className="h-6 w-6 rounded-full mr-2" src={selection.golfer3.avatar} alt={selection.golfer3.name} />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-gray-800">{selection.golfer3?.name?.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <div>{selection.golfer3?.name || 'N/A'}</div>
                        {selection.golfer3Result && (selection.competition?.isComplete || selection.competition?.isActive) && (
                          <div className="text-xs text-gray-500">
                            Pos: {selection.golfer3Result.position}, Pts: <span className="text-success font-medium">+{selection.golfer3Result.points ?? 0}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Display Total Points */}
                  <TableCell className="text-right font-medium">
                    {selection.competition?.isActive || selection.competition?.isComplete ? (
                      <span className="text-lg">{selection.totalPoints || 0}</span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span> // Show dash for upcoming
                    )}
                  </TableCell>
                </TableRow>
                ); // Add semicolon and ensure correct placement
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      {renderSelectionTable(upcomingSelections, "Upcoming Selections")}
      {renderSelectionTable(activeSelections, "Active Selections")}
      {renderSelectionTable(completedSelections, "Completed Selections")}
    </div>
  );
}
