import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [isUpdating, setIsUpdating] = useState(false); // Keep isUpdating state

  // Fetch golfers data
  const { data: golfersData, isLoading: isLoadingGolfers, error: golfersError } = useQuery<{ golfers: Golfer[] }>({
    queryKey: ['/api/golfers'],
    queryFn: () => apiRequest('/api/golfers', 'GET'),
  });

  // Fetch the last run timestamp
  const { data: lastRunData, isLoading: isLoadingTimestamp } = useQuery<{ lastUpdated: string | null }>({
    queryKey: ['/api/admin/golfers-last-updated'],
    queryFn: () => apiRequest('/api/admin/golfers-last-updated', 'GET'),
  });

  const lastRunTimestamp = lastRunData?.lastUpdated ? new Date(lastRunData.lastUpdated) : null;

  const updateGolfersMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/update-golfers', 'POST'),
    onMutate: () => {
      setIsUpdating(true);
      toast({
        title: "Update Started",
        description: "Updating golfer list from DataGolf. This may take a moment...",
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Update Successful",
        description: `Golfers table cleared and ${data?.count ?? 'N/A'} golfers inserted. Errors: ${data?.errors ?? 0}. ${data?.dbError ? `Timestamp DB Error: ${data.dbError}` : ''}`,
      });
      // Invalidate queries to refresh lists and the timestamp
      queryClient.invalidateQueries({ queryKey: ['/api/golfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/golfers-last-updated'] });
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
        <div className="flex items-center">
          <Button
            onClick={handleUpdateGolfers}
            disabled={isUpdating || isLoadingGolfers || isLoadingTimestamp}
          >
            {isUpdating ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isUpdating ? 'Updating Golfers...' : 'Update Golfer List from DataGolf'}
          </Button>
          {isLoadingTimestamp && (
            <p className="text-sm text-muted-foreground ml-2 mt-1">Loading timestamp...</p>
          )}
          {!isLoadingTimestamp && lastRunTimestamp && (
            <p className="text-sm text-muted-foreground ml-2 mt-1">
              Last run: {lastRunTimestamp.toLocaleString()}
            </p>
          )}
          {!isLoadingTimestamp && !lastRunTimestamp && (
            <p className="text-sm text-muted-foreground ml-2 mt-1">
              Last run: Never
            </p>
          )}
        </div>

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
            <div className="border rounded-md max-h-96 overflow-y-auto overflow-x-auto"> {/* Added x-scroll */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Short Name</TableHead> {/* Added Short Name Header */}
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
                        <TableCell>{golfer.shortName ?? 'N/A'}</TableCell> {/* Added Short Name Cell */}
                        <TableCell>{golfer.rank}</TableCell>
                        <TableCell>{golfer.firstName ?? 'N/A'}</TableCell>
                        <TableCell>{golfer.lastName ?? 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center"> {/* Adjusted colSpan */}
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
