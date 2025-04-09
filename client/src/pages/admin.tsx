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
import type { User, Competition, Golfer, Selection } from "@shared/schema"; // Import necessary types

// Admin selection update form schema
const adminSelectionFormSchema = z.object({
  userId: z.string().min(1, "User is required"), // Ensure not empty
  tournamentId: z.string().min(1, "Tournament is required"), // Ensure not empty
  playerOneId: z.string().min(1, "Selection 1 is required"),
  playerTwoId: z.string().min(1, "Selection 2 is required"),
  playerThreeId: z.string().min(1, "Selection 3 is required"),
}).refine(data => {
  const { playerOneId, playerTwoId, playerThreeId } = data;
  const validIds = [playerOneId, playerTwoId, playerThreeId].filter(id => id && id !== "0");
  const uniqueIds = new Set(validIds);
  return uniqueIds.size === 3;
}, {
  message: "Players must be unique and selected",
  path: ["playerThreeId"],
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

  // Update form when selection data changes or user/tournament changes
  useEffect(() => {
    form.setValue("userId", selectedUserId);
    form.setValue("tournamentId", selectedTournamentId);
    
    if (userSelection) {
      form.setValue("playerOneId", userSelection.golfer1Id?.toString() || ""); 
      form.setValue("playerTwoId", userSelection.golfer2Id?.toString() || "");
      form.setValue("playerThreeId", userSelection.golfer3Id?.toString() || "");
    } else {
      // Reset player fields if no selection or user/tournament changes
      form.setValue("playerOneId", "");
      form.setValue("playerTwoId", "");
      form.setValue("playerThreeId", "");
    }
  }, [selectedUserId, selectedTournamentId, userSelection, form]);

  // Update selections mutation (Needs selection ID)
  const updateMutation = useMutation({
    mutationFn: async (values: AdminSelectionFormValues) => {
      if (!userSelection?.id) {
        throw new Error("Cannot update selection: Selection ID is missing.");
      }
      // Use the correct PATCH endpoint with the selection ID
      return apiRequest("PATCH", `/api/admin/selections/${userSelection.id}`, {
        // Send only the golfer IDs as per the backend route expectation
        golfer1Id: parseInt(values.playerOneId),
        golfer2Id: parseInt(values.playerTwoId),
        golfer3Id: parseInt(values.playerThreeId),
        // userId and competitionId are not needed for PATCH by ID
      });
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
    },
    onError: (error: any) => {
      toast({
        title: "Error updating selections",
        description: error.message || "Failed to update selections. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: AdminSelectionFormValues) => {
     if (!userSelection) {
       toast({ title: "Cannot Update", description: "No existing selection found to update.", variant: "destructive"});
       return;
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
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3">
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
      </Tabs>
    </div>
  );
};

export default Admin;
