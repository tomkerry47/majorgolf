import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; // Import useQuery
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react"; // Import Loader2
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import Table components
import { Golfer } from "shared/schema"; // Import Golfer type

export default function AdminGolfers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch golfers data
  const { data: golfersData, isLoading: isLoadingGolfers, error: golfersError } = useQuery<{ golfers: Golfer[] }>({
    queryKey: ['/api/golfers'], // Use the standard endpoint for fetching golfers
    queryFn: () => apiRequest('/api/golfers', 'GET'),
  });

  const updateGolfersMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/update-golfers', 'POST'),
    onMutate: () => {
      setIsUpdating(true);
      toast({
        title: "Update Started",
        description: "Updating golfer list from DataGolf. This may take a moment...",
      });
    },
    onSuccess: (data: any) => { // Define type for data if known, e.g., { success: boolean, count: number, errors: number }
      toast({
        title: "Update Successful",
        description: `Golfers table cleared and ${data?.count ?? 'N/A'} golfers inserted. Errors: ${data?.errors ?? 0}.`,
      });
      // Invalidate golfer queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['/api/golfers'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update golfer list.",
      });
    },
    onSettled: () => {
      setIsUpdating(false);
    },
  });

  const handleUpdateGolfers = () => {
    // Maybe add a confirmation dialog here in the future
    updateGolfersMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Golf Player Management</CardTitle>
        <CardDescription>
          Update the master golfer list and rankings from the DataGolf source, and view current golfers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Update Action</AlertTitle>
          <AlertDescription>
            Running the update will fetch the latest golfer rankings from DataGolf, update existing golfers in the database, and insert any new golfers found. It does not delete existing golfers.
          </AlertDescription>
        </Alert>
        <Button
          onClick={handleUpdateGolfers}
          disabled={isUpdating || isLoadingGolfers} // Disable if updating or loading
        >
          {isUpdating ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isUpdating ? 'Updating Golfers...' : 'Update Golfer List from DataGolf'}
        </Button>

        {/* Display current golfers */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Current Golfers in Database</h3>
          {isLoadingGolfers && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2">Loading golfers...</span>
            </div>
          )}
          {golfersError && (
             <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Error Loading Golfers</AlertTitle>
               <AlertDescription>
                 {(golfersError as Error).message || "Could not fetch golfer data."}
               </AlertDescription>
             </Alert>
          )}
          {golfersData && golfersData.golfers && (
            <div className="border rounded-md max-h-96 overflow-y-auto"> {/* Added scroll */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {golfersData.golfers.length > 0 ? (
                    // Sort golfers by rank before mapping
                    [...golfersData.golfers].sort((a, b) => a.rank - b.rank).map((golfer) => (
                      <TableRow key={golfer.id}>
                        <TableCell>{golfer.id}</TableCell>
                        <TableCell className="font-medium">{golfer.name}</TableCell>
                        <TableCell>{golfer.rank}</TableCell>
                        <TableCell>{golfer.firstName ?? 'N/A'}</TableCell>
                        <TableCell>{golfer.lastName ?? 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        No golfers found in the database.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
