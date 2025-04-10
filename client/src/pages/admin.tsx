import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Added useQueryClient
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient as qc } from "@/lib/queryClient"; // Renamed import to avoid conflict
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import AdminHoleInOne from "@/components/admin/AdminHoleInOne";
import AdminWaiverChips from "@/components/admin/AdminWaiverChips";
import AdminResults from "@/components/admin/AdminResults";
import AdminPointSystem from "@/components/admin/AdminPointSystem";
import AdminCompetitions from "@/components/admin/AdminCompetitions";
import AdminGolfers from "@/components/admin/AdminGolfers"; // Import AdminGolfers component
import AdminUserManagement from "@/components/admin/AdminUserManagement"; // Import the new component
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import type { User, Competition, Golfer, Selection } from "@shared/schema"; // Import necessary types

// Admin selection update form schema
const adminSelectionFormSchema = z.object({
  userId: z.string().min(1, "User is required"), // Ensure not empty
  tournamentId: z.string().min(1, "Tournament is required"), // Ensure not empty
  playerOneId: z.string().min(1, "Selection 1 is required"),
  playerTwoId: z.string().min(1, "Selection 2 is required"),
  playerThreeId: z.string().min(1, "Selection 3 is required"),
  // Add captain fields
  useCaptainsChip: z.boolean().optional().default(false),
  captainGolferId: z.string().optional(), // Store as string initially from select
}).refine(data => {
  // Refine player uniqueness
  const { playerOneId, playerTwoId, playerThreeId } = data;
  const validIds = [playerOneId, playerTwoId, playerThreeId].filter(id => id && id !== "0");
  const uniqueIds = new Set(validIds);
  return uniqueIds.size === 3;
}, {
  message: "Players must be unique and selected",
  path: ["playerThreeId"], // Keep existing refinement for player uniqueness
}).refine(data => {
  // Refine captain selection: if chip is used, captain must be selected
  if (data.useCaptainsChip && !data.captainGolferId) {
    return false;
  }
  return true;
}, {
  message: "Captain must be selected if using the Captain's Chip.",
  path: ["captainGolferId"],
}).refine(data => {
   // Refine captain selection: captain must be one of the three selected players
   if (data.useCaptainsChip && data.captainGolferId) {
     const selectedIds = [data.playerOneId, data.playerTwoId, data.playerThreeId];
     if (!selectedIds.includes(data.captainGolferId)) {
       return false;
     }
   }
   return true;
 }, {
   message: "Captain must be one of the selected golfers.",
   path: ["captainGolferId"],
 });

type AdminSelectionFormValues = z.infer<typeof adminSelectionFormSchema>;

// Helper function to get ordinal suffix
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) { return "st"; }
  if (j === 2 && k !== 12) { return "nd"; }
  if (j === 3 && k !== 13) { return "rd"; }
  return "th";
}

const Admin = () => {
  const { user, isAdmin, isLoading: isAuthLoading } = useAuth(); // Get isLoading from useAuth
  const { toast } = useToast();
  const queryClient = useQueryClient(); // Use the hook
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [useWaiver, setUseWaiver] = useState(false); // State for waiver checkbox

  const [, setLocation] = useLocation();

  // Redirect non-admin users *after* auth loading is complete
  useEffect(() => {
    if (!isAuthLoading && !isAdmin) {
      setLocation("/");
    }
  }, [isAuthLoading, isAdmin, setLocation]);

  // Form for admin selection updates
  const form = useForm<AdminSelectionFormValues>({
    resolver: zodResolver(adminSelectionFormSchema),
    defaultValues: {
      userId: "",
      tournamentId: "",
      playerOneId: "",
      playerTwoId: "",
      playerThreeId: "",
    },
  });

  // Fetch users
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!isAdmin,
  });

  // Fetch tournaments (Corrected API path)
  const { data: tournaments, isLoading: isLoadingTournaments } = useQuery<Competition[]>({
    queryKey: ["/api/competitions/all"], // Use public endpoint
    enabled: !!isAdmin,
  });

  // Fetch golf players - Updated to expect { golfers: [...] } and select the array
  const { data: golfPlayers, isLoading: isLoadingPlayers } = useQuery<{ golfers: Golfer[] }, Error, Golfer[]>({ // Expect object, return array
    queryKey: ["/api/golfers"], // Use public endpoint
    queryFn: () => apiRequest<{ golfers: Golfer[] }>('/api/golfers'), // Fetch the object
    select: (data) => data.golfers, // Select the golfers array from the data
    enabled: !!isAdmin,
  });

  // Fetch user's selections for the selected tournament using the correct admin route
  const { data: userSelection, isLoading: isLoadingSelection } = useQuery<Selection>({
    queryKey: ["/api/admin/user-selection", selectedUserId, selectedTournamentId], // Ensure queryKey matches the actual endpoint structure
    queryFn: () => apiRequest<Selection>(`/api/admin/user-selection/${selectedUserId}/${selectedTournamentId}`, 'GET'), 
    enabled: !!selectedUserId && !!selectedTournamentId && !!isAdmin,
    retry: false, // Don't retry on 404 (selection not found)
  });

  // Fetch the selected user's global captain chip status
  const { data: selectedUserCaptainChipStatus, isLoading: isLoadingSelectedUserChipStatus } = useQuery<{ hasUsedCaptainsChip: boolean }>({
    queryKey: ['/api/users', selectedUserId, 'has-used-captains-chip'], // Use selectedUserId
    queryFn: () => apiRequest<{ hasUsedCaptainsChip: boolean }>(`/api/users/${selectedUserId}/has-used-captains-chip`),
    enabled: !!selectedUserId && !!isAdmin, // Enable only when a user is selected
  });


  // Find the currently selected user's data (needed for disabling waiver checkbox)
  const currentUserData = users?.find(u => u.id.toString() === selectedUserId);

  // Update form when selection data changes or user/tournament changes
  useEffect(() => {
    form.setValue("userId", selectedUserId);
    form.setValue("tournamentId", selectedTournamentId);
    
    if (userSelection) {
      form.setValue("playerOneId", userSelection.golfer1Id?.toString() || "");
      form.setValue("playerTwoId", userSelection.golfer2Id?.toString() || "");
      form.setValue("playerThreeId", userSelection.golfer3Id?.toString() || "");
      // Set captain fields based on fetched selection
      form.setValue("useCaptainsChip", userSelection.useCaptainsChip || false);
      form.setValue("captainGolferId", userSelection.captainGolferId?.toString() || undefined);
    } else {
      // Reset player and captain fields if no selection or user/tournament changes
      form.setValue("playerOneId", "");
      form.setValue("playerTwoId", "");
      form.setValue("playerThreeId", "");
      form.setValue("useCaptainsChip", false);
      form.setValue("captainGolferId", undefined);
    }
  }, [selectedUserId, selectedTournamentId, userSelection, form]);

  // Update selections mutation (Needs selection ID)
  const updateMutation = useMutation({
    mutationFn: async (values: AdminSelectionFormValues) => {
      if (!userSelection?.id) {
        throw new Error("Cannot update selection: Selection ID is missing.");
      }

      let payload: any = {
        golfer1Id: parseInt(values.playerOneId),
        golfer2Id: parseInt(values.playerTwoId),
        golfer3Id: parseInt(values.playerThreeId),
        // Include captain fields from form values
        useCaptainsChip: values.useCaptainsChip,
        captainGolferId: values.useCaptainsChip ? parseInt(values.captainGolferId || "0") : undefined, // Parse if chip used
      };
      let updatedGolferSlot: number | null = null;
      let newGolferId: number | null = null;

      // Determine which golfer changed if waiver is used
      if (useWaiver) {
        let changes = 0;
        if (payload.golfer1Id !== userSelection.golfer1Id) { changes++; updatedGolferSlot = 1; newGolferId = payload.golfer1Id; }
        if (payload.golfer2Id !== userSelection.golfer2Id) { changes++; updatedGolferSlot = 2; newGolferId = payload.golfer2Id; }
        if (payload.golfer3Id !== userSelection.golfer3Id) { changes++; updatedGolferSlot = 3; newGolferId = payload.golfer3Id; }

        if (changes !== 1) {
          throw new Error("Waiver chip can only be used when swapping exactly one golfer.");
        }

        // Add waiver details to payload
        payload = {
          ...payload,
          isWaiverChipTransaction: true,
          updatedGolferSlot: updatedGolferSlot,
          newGolferId: newGolferId,
        };
      } else {
         payload = { ...payload, isWaiverChipTransaction: false };
      }

      // Corrected argument order: url, method, payload
      return apiRequest(`/api/admin/selections/${userSelection.id}`, "PATCH", payload);
    },
    onSuccess: () => {
      toast({
        title: "Selections updated",
        description: "Player selections have been updated successfully.",
      });
      // Invalidate the specific user selection query
      queryClient.invalidateQueries({ 
        queryKey: ["/api/admin/user-selection", selectedUserId, selectedTournamentId] 
      });
      // Also invalidate the list of all selections for that competition if it exists elsewhere
      queryClient.invalidateQueries({ 
        queryKey: ["/api/admin/competitions", selectedTournamentId, "selections"] 
      });
      // Invalidate users query as well in case waiver status changed
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setUseWaiver(false); // Reset waiver state after successful submission
    },
    onError: (error: any) => {
      toast({
        title: "Error updating selections",
        description: error.message || "Failed to update selections. Please try again.",
        variant: "destructive", // Removed duplicate variant property
      });
      // Note: Removed misplaced invalidateQueries and setUseWaiver from here
    }, 
    // Removed the duplicate onError handler that was here
  });

  const onSubmit = (values: AdminSelectionFormValues) => {
     if (!userSelection) {
       toast({ title: "Cannot Update", description: "No existing selection found to update.", variant: "destructive"});
       return;
     }
     // Check waiver condition before mutating
     if (useWaiver) {
        let changes = 0;
        if (parseInt(values.playerOneId) !== userSelection.golfer1Id) changes++;
        if (parseInt(values.playerTwoId) !== userSelection.golfer2Id) changes++;
        if (parseInt(values.playerThreeId) !== userSelection.golfer3Id) changes++;
        if (changes !== 1) {
           toast({ variant: "destructive", title: "Waiver Error", description: "Waiver chip can only be used when swapping exactly one golfer." });
           return;
        }
        if (currentUserData?.hasUsedWaiverChip) {
           toast({ variant: "destructive", title: "Waiver Error", description: "This user has already used their waiver chip." });
           return;
        }
     }
     updateMutation.mutate(values);
  };

  // Add console logs for debugging
  console.log("Admin Page Render State:");
  console.log("Selected User ID:", selectedUserId);
  console.log("Selected Tournament ID:", selectedTournamentId);
  console.log("Is Loading Selection:", isLoadingSelection);
  console.log("Fetched User Selection:", userSelection);

  // Use AuthContext's loading state
  if (isAuthLoading) {
     return <div className="p-8">Loading Authentication...</div>;
  }

  // Check for admin status *after* loading is complete
  if (!isAdmin) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
        <p>You do not have permission to access the admin area.</p>
      </div>
    );
  }

  // Find selected tournament to show warning if active
  const selectedTournament = tournaments?.find(
    (t: Competition) => t.id.toString() === selectedTournamentId
  );
  const isActiveTournament = selectedTournament?.isActive; 

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Admin Panel</h2>
        {/* <Button variant="outline">Tournament Setup</Button> */}
      </div>
      
      <Tabs defaultValue="player-selections">
        <TabsList className="mb-4">
          <TabsTrigger value="player-selections">Player Selections</TabsTrigger>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
          <TabsTrigger value="players">Golf Players</TabsTrigger>
          <TabsTrigger value="results">Tournament Results</TabsTrigger>
          <TabsTrigger value="point-system">Point System</TabsTrigger> {/* Add Point System Trigger */}
          <TabsTrigger value="hole-in-ones">Hole-in-Ones</TabsTrigger>
          <TabsTrigger value="waiver-chips">Waiver Chips</TabsTrigger>
          <TabsTrigger value="user-management">User Management</TabsTrigger> {/* Add User Management Trigger */}
        </TabsList>
        
        <TabsContent value="player-selections">
          <Card>
            <CardHeader>
              <CardTitle>Player Selection Management</CardTitle>
              <CardDescription>
                Modify user selections for tournaments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User Select */}
                    <FormField
                      control={form.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select User</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedUserId(value);
                              // Invalidate query when user changes
                              queryClient.invalidateQueries({ queryKey: ["/api/admin/user-selection", value, selectedTournamentId] });
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a user" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingUsers ? (
                                <div className="p-2"><Skeleton className="h-5 w-full" /></div>
                              ) : users?.length ? (
                                users.map((u: User) => (
                                  <SelectItem key={u.id} value={u.id.toString()}>
                                    {u.username} ({u.email})
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>No users available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Tournament Select */}
                     <FormField
                      control={form.control}
                      name="tournamentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tournament</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedTournamentId(value);
                              // Invalidate query when tournament changes
                              queryClient.invalidateQueries({ queryKey: ["/api/admin/user-selection", selectedUserId, value] });
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a tournament" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingTournaments ? (
                                <div className="p-2"><Skeleton className="h-5 w-full" /></div>
                              ) : tournaments?.length ? (
                                tournaments.map((tournament: Competition) => (
                                  <SelectItem key={tournament.id} value={tournament.id.toString()}>
                                    {tournament.name} ({tournament.isActive ? 'Active' : tournament.isComplete ? 'Completed' : 'Upcoming'})
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>No tournaments available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {isActiveTournament && (
                     <Alert className="bg-yellow-50 border-yellow-400 text-yellow-800"> 
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warning</AlertTitle>
                      <AlertDescription>
                        Editing player selections after the tournament has started may affect fairness. Use with caution.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Display Current/Update Selections only when user and tournament are selected */}
                  {selectedUserId && selectedTournamentId && (
                    <>
                      {/* Current Selections Display */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h4 className="text-md font-semibold text-gray-800 mb-3">
                          Current Selections
                        </h4>
                        {isLoadingSelection ? (
                           <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
                        ) : userSelection ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                              { label: "Selection 1", id: userSelection.golfer1Id },
                              { label: "Selection 2", id: userSelection.golfer2Id },
                              { label: "Selection 3", id: userSelection.golfer3Id }
                            ].map((selectionItem, idx) => {
                              const player = golfPlayers?.find((p: Golfer) => p.id === selectionItem.id);
                              return (
                                <div key={idx} className="bg-white p-3 rounded-md border border-gray-200">
                                  <p className="font-medium">{selectionItem.label}</p>
                                  {/* Use firstName and lastName */}
                                  <p className="text-gray-900">{player ? `${player.firstName} ${player.lastName}` : 'N/A'}</p> 
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No existing selections found for this user and tournament.</p>
                        )}
                      </div>
                      
                      {/* Update Selections Form Fields */}
                      <div className="mb-6">
                        <h4 className="text-md font-semibold text-gray-800 mb-3">Update Selections</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Player 1 Select */}
                          <FormField
                            control={form.control}
                            name="playerOneId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Selection 1</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a player" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {isLoadingPlayers ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                                     golfPlayers && golfPlayers.map((player: Golfer) => ( // Add check for golfPlayers array
                                      <SelectItem key={player.id} value={player.id.toString()}>
                                        {/* Use firstName and lastName */}
                                        {player.firstName} {player.lastName} {player.rank ? `(#${player.rank})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           {/* Player 2 Select */}
                           <FormField
                            control={form.control}
                            name="playerTwoId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Selection 2</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a player" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                     {isLoadingPlayers ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                                     golfPlayers && golfPlayers.map((player: Golfer) => ( // Add check for golfPlayers array
                                      <SelectItem key={player.id} value={player.id.toString()}>
                                        {/* Use firstName and lastName */}
                                        {player.firstName} {player.lastName} {player.rank ? `(#${player.rank})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           {/* Player 3 Select */}
                           <FormField
                            control={form.control}
                            name="playerThreeId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Selection 3</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a player" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                     {isLoadingPlayers ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                                     golfPlayers && golfPlayers.map((player: Golfer) => ( // Add check for golfPlayers array
                                      <SelectItem key={player.id} value={player.id.toString()}>
                                        {/* Use firstName and lastName */}
                                        {player.firstName} {player.lastName} {player.rank ? `(#${player.rank})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                         {/* Waiver Chip Checkbox */}
                         <div className="flex items-center space-x-2 pt-4">
                           <Checkbox
                             id="useWaiverAdmin" // Unique ID
                             checked={useWaiver}
                             onCheckedChange={(checked: boolean | 'indeterminate') => setUseWaiver(Boolean(checked))}
                             disabled={currentUserData?.hasUsedWaiverChip}
                           />
                           <label
                             htmlFor="useWaiverAdmin"
                             className={`text-sm font-medium leading-none ${currentUserData?.hasUsedWaiverChip ? 'text-gray-400 cursor-not-allowed' : 'peer-disabled:cursor-not-allowed peer-disabled:opacity-70'}`}
                           >
                             Use Waiver Chip for this swap? {currentUserData?.hasUsedWaiverChip ? '(Already Used)' : ''}
                           </label>
                         </div>

                         {/* Captain's Chip Checkbox */}
                         <FormField
                           control={form.control}
                           name="useCaptainsChip"
                           render={({ field }) => (
                             <FormItem className="flex flex-row items-center space-x-2 pt-4">
                               <FormControl>
                                 <Checkbox
                                   checked={field.value}
                                   onCheckedChange={field.onChange}
                                   // Disable if the selected user has already used the chip globally
                                   disabled={selectedUserCaptainChipStatus?.hasUsedCaptainsChip && !(userSelection?.useCaptainsChip)} // Allow unchecking if currently checked
                                   id="useCaptainAdmin"
                                 />
                               </FormControl>
                               <FormLabel htmlFor="useCaptainAdmin" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                 Assign Captain's Chip? (Overrides user's choice if they used it)
                                 {/* Display message if chip already used */}
                                 {selectedUserCaptainChipStatus?.hasUsedCaptainsChip && !(userSelection?.useCaptainsChip) && (
                                    <p className="text-xs text-muted-foreground pt-1">
                                      This user has already used their Captain's Chip.
                                    </p>
                                  )}
                               </FormLabel>
                             </FormItem>
                           )}
                         />

                         {/* Captain Select Dropdown (Conditional) */}
                         {form.watch("useCaptainsChip") && (
                           <FormField
                             control={form.control}
                             name="captainGolferId"
                             render={({ field }) => (
                               <FormItem>
                                 <FormLabel>Select Captain</FormLabel>
                                 <Select value={field.value} onValueChange={field.onChange}>
                                   <FormControl>
                                     <SelectTrigger><SelectValue placeholder="Select captain" /></SelectTrigger>
                                   </FormControl>
                                   <SelectContent>
                                     {[form.watch("playerOneId"), form.watch("playerTwoId"), form.watch("playerThreeId")]
                                       .filter(id => id && id !== "0") // Filter out empty/placeholder values
                                       .map(golferId => {
                                         const player = golfPlayers?.find(p => p.id.toString() === golferId);
                                         return player ? (
                                           <SelectItem key={player.id} value={player.id.toString()}>
                                             {player.firstName} {player.lastName}
                                           </SelectItem>
                                         ) : null;
                                       })}
                                   </SelectContent>
                                 </Select>
                                 <FormMessage />
                               </FormItem>
                             )}
                           />
                         )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3 mt-6"> {/* Added margin-top */}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { // Reset form including player selections
                            form.reset({ 
                              userId: selectedUserId, 
                              tournamentId: selectedTournamentId, 
                              playerOneId: userSelection?.golfer1Id?.toString() || "",
                              playerTwoId: userSelection?.golfer2Id?.toString() || "",
                              playerThreeId: userSelection?.golfer3Id?.toString() || ""
                            });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          variant="default"
                          disabled={updateMutation.isPending || !userSelection} // Disable if no selection exists to update
                        >
                          {updateMutation.isPending ? "Updating..." : "Update Selections"}
                        </Button>
                      </div>
                    </>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Other Admin Tabs */}
        <TabsContent value="tournaments">
          <AdminCompetitions /> 
        </TabsContent>
        <TabsContent value="players">
           <AdminGolfers /> {/* Use the new AdminGolfers component */}
         </TabsContent>
         <TabsContent value="results">
            <AdminResults />
         </TabsContent>
         <TabsContent value="point-system"> {/* Add Point System Content */}
            <AdminPointSystem />
         </TabsContent>
         <TabsContent value="hole-in-ones">
           <AdminHoleInOne />
        </TabsContent>
        <TabsContent value="waiver-chips">
          <AdminWaiverChips />
        </TabsContent>
        <TabsContent value="user-management"> {/* Add User Management Content */}
          <AdminUserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
