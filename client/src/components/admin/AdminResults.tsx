import { useState, useMemo, useEffect } from "react"; // Import useMemo and useEffect
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query"; // Add useMutation
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from 'lucide-react'; // Add icons
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Add CardDescription
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Import necessary types
import { insertResultSchema, type InsertResult, type Competition, type Result, type Golfer } from "@shared/schema";

// Helper function to display golfer name
const getGolferDisplayName = (golfer?: Golfer | null): string => {
  if (golfer && golfer.firstName && golfer.lastName) {
    return `${golfer.firstName} ${golfer.lastName}`;
  }
  return 'Unknown Golfer'; 
};

export default function AdminResults() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null);
  const [formAction, setFormAction] = useState<'create' | 'edit'>('create');
  // State for confirmation dialog
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState<{
    competitionId: number | null;
    dbName: string;
    fetchedName: string;
    cleanedFetchedName: string;
  } | null>(null);


  // --- Start: Modified Update Results Logic ---
  // Mutation for triggering result updates for a SPECIFIC tournament
  const { mutate: updateSelectedResults, isPending: isUpdatingSelected } = useMutation({
    // Update mutation function signature and body to accept forceUpdate
    mutationFn: ({ competitionId, forceUpdate = false }: { competitionId: number; forceUpdate?: boolean }) =>
      apiRequest('/api/admin/update-results', 'POST', { competitionId, forceUpdate }), // Pass forceUpdate
    onSuccess: (data, variables) => { // data might be undefined on 409, variables has competitionId
      // Close confirmation dialog if it was open
      setShowConfirmationDialog(false);
      setConfirmationDetails(null);
      toast({
        title: 'Success',
        description: `Update triggered/completed for competition ID ${variables.competitionId}. Results & points are being processed/updated.`,
      });
      // Refetch results and leaderboard for the updated competition
      if (variables.competitionId) {
        queryClient.refetchQueries({ queryKey: [`/api/admin/tournament-results/${variables.competitionId}`] });
        queryClient.refetchQueries({ queryKey: [`/api/leaderboard/${variables.competitionId}`] }); // Refetch specific leaderboard
      }
      // Refetch competitions list (status might change) and overall leaderboard
      queryClient.refetchQueries({ queryKey: ['/api/competitions'] }); // Refetch competitions to get updated timestamp
      queryClient.refetchQueries({ queryKey: ['/api/leaderboard'] }); // Refetch overall leaderboard
    },
    onError: (error: any, variables) => { // variables has competitionId
      // Close confirmation dialog if it was open (in case of error during forced update)
      setShowConfirmationDialog(false);
      setConfirmationDetails(null);

      // Log the error object for debugging
      console.error("Mutation onError:", error);
      console.log("Error Response Status:", error.response?.status);
      console.log("Error Response Data:", error.response?.data); // This will likely remain undefined

      // Attempt to parse the error message string for status and JSON data
      let isConfirmationRequired = false;
      if (error instanceof Error && error.message) {
        const match = error.message.match(/^(\d+):\s*({.*})$/); // Regex to capture status and JSON string
        if (match) {
          const status = parseInt(match[1], 10);
          const jsonString = match[2];
          console.log(`Parsed from error message - Status: ${status}, JSON String: ${jsonString}`);
          if (status === 409) {
            try {
              const errorData = JSON.parse(jsonString);
              console.log("Parsed error data from message:", errorData);
              if (errorData?.status === 'confirmation_required') {
                isConfirmationRequired = true;
                console.log("Mismatch detected from error message, attempting to show confirmation dialog.");
                setConfirmationDetails({
                  competitionId: variables.competitionId,
                  dbName: errorData.dbName,
                  fetchedName: errorData.fetchedName,
                  cleanedFetchedName: errorData.cleanedFetchedName,
                });
                setShowConfirmationDialog(true); // This should trigger the dialog
              }
            } catch (parseError) {
              console.error("Failed to parse JSON from error message:", parseError);
            }
          }
        }
      }

      // If confirmation wasn't triggered, show the standard toast
      if (!isConfirmationRequired) {
          console.log("Error is not a 409 confirmation required (or failed to parse message), showing standard toast."); // Add log
          // Handle other errors
          toast({
            title: 'Error Triggering Update',
            description: error.message || `Failed to trigger update for competition ID ${variables.competitionId}.`,
            variant: 'destructive',
          });
      }
    }
  });
  // --- End: Modified Update Results Logic ---

  // Get all competitions
  const { data: competitions, isLoading: isLoadingCompetitions } = useQuery({
    queryKey: ['/api/competitions'],
  });
  
   // Get competition results for selected competition
   const { data: results, isLoading: isLoadingResults } = useQuery({
     queryKey: [`/api/admin/tournament-results/${selectedCompetition}`], // Corrected path
     enabled: !!selectedCompetition,
   });
  
  // Get all golfers - Updated to handle { golfers: [...] }
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery<{ golfers: Golfer[] }, Error, Golfer[]>({
    queryKey: ['/api/golfers'],
    queryFn: () => apiRequest<{ golfers: Golfer[] }>('/api/golfers'), // Fetch the object
    // Extremely defensive select: Check data is object, golfers property exists and is an array
    select: (data) => {
      if (typeof data === 'object' && data !== null && Array.isArray(data.golfers)) {
        return data.golfers;
      }
      // Return empty array in all other cases (including fetch errors handled by react-query)
      return []; 
    },
  });

  // Create a map for quick golfer name lookup
  // Create a map for quick golfer lookup (includes name for display)
  const golferMap = useMemo(() => {
    try {
      // Stricter check + try...catch: Only proceed if golfers is definitely an array
      if (Array.isArray(golfers)) {
        // This is the line causing the error (116 in original stack trace)
        return new Map(golfers.map(golfer => [golfer.id, golfer]));
      }
    } catch (error) {
      console.error("Error creating golferMap:", error, "golfers value:", golfers);
    }
    // Otherwise, always return an empty map
    return new Map<number, Golfer>();
  }, [golfers]);

  // Add score to defaultValues
  const defaultValues: InsertResult = { 
    competitionId: selectedCompetition || 0,
    golferId: 0,
    position: 0,
    score: 0, // Added required score field
    points: 0
  };
  
  const form = useForm<InsertResult>({
    resolver: zodResolver(insertResultSchema),
    defaultValues
  });
  
  // Update form values when competition changes
  const updateFormCompetition = (competitionId: number) => {
    form.setValue("competitionId", competitionId);
  };
  
  const openCreateDialog = () => {
    if (!selectedCompetition) {
      toast({
        variant: "destructive",
        title: "Select a competition",
        description: "Please select a competition first."
      });
      return;
    }
    
    form.reset({
      ...defaultValues,
      competitionId: selectedCompetition
    });
    setFormAction('create');
    setSelectedResult(null);
    setIsDialogOpen(true);
  };
  
  const openEditDialog = (result: any) => {
    form.reset({
      competitionId: result.competitionId,
      golferId: result.golferId,
      position: result.position,
      score: result.score, // Add score when editing
      points: result.points
    });
    setFormAction('edit');
    setSelectedResult(result);
    setIsDialogOpen(true);
  };
  
  const openDeleteDialog = (result: any) => {
    setSelectedResult(result);
    setIsDeleteDialogOpen(true);
  };
  
   const onSubmit = async (data: InsertResult) => {
     try {
       if (formAction === 'create') {
         await apiRequest('POST', '/api/admin/tournament-results', data); // Corrected path
         toast({
           title: "Result created",
           description: "The result has been successfully created."
         });
       } else {
         await apiRequest('PATCH', `/api/admin/tournament-results/${selectedResult.id}`, data); // Corrected path
         toast({
           title: "Result updated",
           description: "The result has been successfully updated."
         });
       }
       
       queryClient.invalidateQueries({ queryKey: [`/api/admin/tournament-results/${selectedCompetition}`] }); // Corrected path
       setIsDialogOpen(false);
     } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred."
      });
    }
  };
  
   const handleDelete = async () => {
     try {
       await apiRequest('DELETE', `/api/admin/tournament-results/${selectedResult.id}`); // Corrected path, removed empty body
       toast({
         title: "Result deleted",
         description: "The result has been successfully deleted."
       });
       
       queryClient.invalidateQueries({ queryKey: [`/api/admin/tournament-results/${selectedCompetition}`] }); // Corrected path
       setIsDeleteDialogOpen(false);
     } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred."
      });
    }
  };
  
  // Add explicit types and default empty array, ensure competitions is an array before filtering
  const activeCompetitions = Array.isArray(competitions) ? competitions.filter((c: Competition) => c.isActive || c.isComplete) : [];
  
  // Find the currently selected competition object to access its lastResultsUpdateAt
  const currentCompetitionDetails = useMemo(() => {
    if (!selectedCompetition || !Array.isArray(competitions)) {
      return null;
    }
    return competitions.find(c => c.id === selectedCompetition);
  }, [selectedCompetition, competitions]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Results</CardTitle>
        <div className="flex gap-2">
          <Select
            value={selectedCompetition?.toString() || ""}
            onValueChange={(value) => {
              const id = parseInt(value);
              setSelectedCompetition(id);
              updateFormCompetition(id);
            }}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a competition" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCompetitions ? (
                <div className="py-2 text-center text-sm text-gray-500">Loading...</div>
              ) : activeCompetitions.length === 0 ? (
                 <div className="py-2 text-center text-sm text-gray-500">No active competitions</div>
               ) : (
                 // Add explicit type
                 activeCompetitions.map((competition: Competition) => ( 
                   <SelectItem key={competition.id} value={competition.id.toString()}>
                     {competition.name}
                   </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* --- Start: Moved Update Selected Results Section (Conditional) --- */}
        {selectedCompetition && ( // Show only when a competition is selected
          <div className="mb-6 pb-6 border-b"> {/* Add separator (changed mt/pt to mb/pb and border-t to border-b) */}
            <Card>
              <CardHeader>
                <CardTitle>Update Selected Tournament</CardTitle> {/* Changed Title */}
                <CardDescription>
                  Fetch the latest results for the selected tournament and allocate points. {/* Changed Description */}
                </CardDescription>
              </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                      Click the button below to automatically update results for the selected tournament. {/* Changed Description */}
                      This will also allocate points based on player positions. This process might take a moment.
                    </p>

                    <Button
                      // Pass selectedCompetition to the mutation
                      onClick={() => updateSelectedResults({ competitionId: selectedCompetition })}
                      disabled={
                         !selectedCompetition || // Still disable if no competition selected
                         isUpdatingSelected ||   // Still disable during update
                         isLoadingCompetitions || // Still disable if competitions are loading
                         isLoadingResults         // Still disable if results are loading
                         // Removed check for captureTimes
                       }
                       className="w-full md:w-auto"
                     >
                       {isUpdatingSelected ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       ) : (
                         <RefreshCw className="mr-2 h-4 w-4" /> // Always show refresh icon when not loading
                       )}
                        {/* Change Button Text based on state */}
                        {isUpdatingSelected
                          ? 'Updating Results...'
                          : 'Update Selected Results' // Always show default text when not loading
                        }
                      </Button>
                      {/* Display last update time from competition data */}
                     {currentCompetitionDetails?.lastResultsUpdateAt && (
                       <p className="text-sm text-gray-500 mt-2 text-center md:text-left">
                         Last Updated: {new Date(currentCompetitionDetails.lastResultsUpdateAt).toLocaleString()}
                       </p>
                     )}
                  </div>
                </CardContent>
              </Card>
          </div>
        )}
        {/* --- End: Moved Update Selected Results Section --- */}

        {!selectedCompetition ? (
          <div className="text-center py-10 text-gray-500">
            Please select a competition to view and manage results.
          </div>
        ) : isLoadingResults || isLoadingGolfers ? ( // Wait for golfers too
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <> {/* Added Fragment */}
            {/* Moved Add Result Button Here */}
            <div className="mb-4 flex justify-end">
              <Button onClick={openCreateDialog} disabled={!selectedCompetition}>
                <i className="fas fa-plus mr-2"></i>
                Add Result
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Golfer</TableHead>
                <TableHead>Points</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
             <TableBody>
               {/* Add nullish coalescing and ensure results is an array */}
               {!(Array.isArray(results) && results.length > 0) ? ( 
                 <TableRow>
                   <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                     No results found for this competition. Add some to get started.
                   </TableCell>
                 </TableRow>
               ) : (
                 // Add explicit type and ensure results is an array
                 (results as Result[]).map((result: Result) => ( 
                   <TableRow key={result.id}>
                     <TableCell className="font-medium">{result.position}</TableCell>
                     <TableCell>
                      <div className="flex items-center">
                        {/* Avatar URL is not available on result.golfers, use fallback */}
                        {/* Avatar Placeholder - Use golferNameMap for initial */}
                        {/* Avatar Placeholder - Use first initial of first name */}
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                          <span className="text-sm font-medium text-gray-800">
                            {(golferMap.get(result.golferId)?.firstName?.charAt(0) ?? '?').toUpperCase()}
                          </span>
                        </div>
                        {/* Use helper function for display */}
                        {getGolferDisplayName(golferMap.get(result.golferId))}
                      </div>
                    </TableCell>
                    <TableCell>{result.points ?? 0}</TableCell> {/* Handle potentially null points */}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(result)}>
                        <i className="fas fa-edit mr-1"></i> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(result)}>
                        <i className="fas fa-trash mr-1"></i> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
             </TableBody>
           </Table>
          </> // Close the fragment here
         )}
       </CardContent>

      {/* Create/Edit Result Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{formAction === 'create' ? 'Add New Result' : 'Edit Result'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="golferId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Golfer</FormLabel>
                    <Select 
                      value={field.value.toString()} 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a golfer" />
                        </SelectTrigger>
                      </FormControl>
                       <SelectContent>
                          {isLoadingGolfers ? (
                            <div className="py-2 text-center text-sm text-gray-500">Loading...</div>
                          ) : (
                            // Add explicit type and ensure golfers is an array
                            (Array.isArray(golfers) ? golfers : []).map((golfer: Golfer) => ( 
                              <SelectItem key={golfer.id} value={golfer.id.toString()}>
                                {/* Use helper function for display */}
                                {getGolferDisplayName(golfer)}
                              </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                         placeholder="e.g. 1" 
                         {...field}
                         // Ensure value is string for input, handle NaN from parseInt
                         value={field.value?.toString() ?? ""} 
                         onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} 
                       />
                     </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Points</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                         placeholder="e.g. 100" 
                         {...field} 
                         // Ensure value is string for input, handle NaN from parseInt
                         value={field.value?.toString() ?? ""}
                         onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                       />
                     </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit">
                  {formAction === 'create' ? 'Add Result' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Result</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this result? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog for Name Mismatch */}
      <AlertDialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Tournament Name Mismatch</AlertDialogTitle>
            <AlertDialogDescription>
              The competition name in the database does not match the name found in the results source:
              <ul className="list-disc pl-5 mt-2 text-sm">
                <li>Database Name: <strong>{confirmationDetails?.dbName}</strong></li>
                <li>Fetched Name: <strong>{confirmationDetails?.fetchedName}</strong></li>
                <li>(Cleaned Fetched Name: <strong>{confirmationDetails?.cleanedFetchedName}</strong>)</li>
              </ul>
              <p className="mt-3">Do you want to proceed with updating results using this source anyway?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmationDetails(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmationDetails?.competitionId) {
                  updateSelectedResults({
                    competitionId: confirmationDetails.competitionId,
                    forceUpdate: true // Force the update
                  });
                }
                // Dialog will be closed by onSuccess/onError
              }}
            >
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
