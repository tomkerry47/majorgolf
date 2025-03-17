import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
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
import { redirect } from "wouter/use-location";

// Admin selection update form schema
const adminSelectionFormSchema = z.object({
  userId: z.string(),
  tournamentId: z.string(),
  playerOneId: z.string(),
  playerTwoId: z.string(),
  playerThreeId: z.string(),
}).refine(data => {
  const { playerOneId, playerTwoId, playerThreeId } = data;
  const uniqueIds = new Set([playerOneId, playerTwoId, playerThreeId]);
  return uniqueIds.size === 3;
}, {
  message: "Players must be unique",
  path: ["playerThreeId"],
});

type AdminSelectionFormValues = z.infer<typeof adminSelectionFormSchema>;

const Admin = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");

  // Redirect non-admin users
  if (user && !isAdmin) {
    redirect("/");
    return null;
  }

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
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: !!isAdmin,
  });

  // Fetch tournaments
  const { data: tournaments, isLoading: isLoadingTournaments } = useQuery({
    queryKey: ["/api/tournaments"],
    enabled: !!isAdmin,
  });

  // Fetch golf players
  const { data: golfPlayers, isLoading: isLoadingPlayers } = useQuery({
    queryKey: ["/api/players"],
    enabled: !!isAdmin,
  });

  // Fetch user's selections for the selected tournament
  const { data: userSelection, isLoading: isLoadingSelection } = useQuery({
    queryKey: ["/api/admin/selections", selectedUserId, selectedTournamentId],
    enabled: !!selectedUserId && !!selectedTournamentId && !!isAdmin,
  });

  // Update form when selection data changes
  useState(() => {
    if (selectedUserId) form.setValue("userId", selectedUserId);
    if (selectedTournamentId) form.setValue("tournamentId", selectedTournamentId);
    
    if (userSelection) {
      form.setValue("playerOneId", userSelection.playerOneId.toString());
      form.setValue("playerTwoId", userSelection.playerTwoId.toString());
      form.setValue("playerThreeId", userSelection.playerThreeId.toString());
    } else {
      form.setValue("playerOneId", "");
      form.setValue("playerTwoId", "");
      form.setValue("playerThreeId", "");
    }
  });

  // Update selections mutation
  const updateMutation = useMutation({
    mutationFn: async (values: AdminSelectionFormValues) => {
      return apiRequest("PATCH", "/api/admin/selections", {
        userId: parseInt(values.userId),
        tournamentId: parseInt(values.tournamentId),
        playerOneId: parseInt(values.playerOneId),
        playerTwoId: parseInt(values.playerTwoId),
        playerThreeId: parseInt(values.playerThreeId),
      });
    },
    onSuccess: () => {
      toast({
        title: "Selections updated",
        description: "Player selections have been updated successfully.",
      });
      
      // Invalidate selection queries
      queryClient.invalidateQueries({ 
        queryKey: ["/api/admin/selections", selectedUserId, selectedTournamentId] 
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating selections",
        description: error.message || "Failed to update selections. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: AdminSelectionFormValues) => {
    updateMutation.mutate(values);
  };

  if (!user) {
    return <div className="p-8">Loading...</div>;
  }

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
    t => t.id.toString() === selectedTournamentId
  );
  const isActiveTournament = selectedTournament?.status === 'active';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Admin Panel</h2>
        <Button variant="outline">Tournament Setup</Button>
      </div>
      
      <Tabs defaultValue="player-selections">
        <TabsList className="mb-4">
          <TabsTrigger value="player-selections">Player Selections</TabsTrigger>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
          <TabsTrigger value="players">Golf Players</TabsTrigger>
          <TabsTrigger value="results">Tournament Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="player-selections">
          <Card>
            <CardHeader>
              <CardTitle>Player Selection Management</CardTitle>
              <CardDescription>
                Modify user selections for tournaments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a user" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingUsers ? (
                                <div className="p-2">
                                  <Skeleton className="h-5 w-full" />
                                  <Skeleton className="h-5 w-full mt-2" />
                                </div>
                              ) : users?.length ? (
                                users.map(user => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.username} ({user.email})
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
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a tournament" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingTournaments ? (
                                <div className="p-2">
                                  <Skeleton className="h-5 w-full" />
                                  <Skeleton className="h-5 w-full mt-2" />
                                </div>
                              ) : tournaments?.length ? (
                                tournaments.map(tournament => (
                                  <SelectItem key={tournament.id} value={tournament.id.toString()}>
                                    {tournament.name} ({tournament.status})
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
                    <Alert variant="warning" className="bg-yellow-50 border-yellow-400">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Warning</AlertTitle>
                      <AlertDescription>
                        Editing player selections after the tournament has started may affect fairness. Use with caution.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {selectedUserId && selectedTournamentId && (
                    <>
                      {isLoadingSelection ? (
                        <div className="space-y-4">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : userSelection ? (
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                          <h4 className="text-md font-semibold text-gray-800 mb-3">
                            Current Selections
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                              { label: "Selection 1", id: userSelection.playerOneId, position: userSelection.playerOnePosition },
                              { label: "Selection 2", id: userSelection.playerTwoId, position: userSelection.playerTwoPosition },
                              { label: "Selection 3", id: userSelection.playerThreeId, position: userSelection.playerThreePosition }
                            ].map((selection, idx) => {
                              const player = golfPlayers?.find(p => p.id === selection.id);
                              return (
                                <div key={idx} className="bg-white p-3 rounded-md border border-gray-200">
                                  <div className="flex justify-between items-center">
                                    <div className="font-medium">{selection.label}</div>
                                    {selection.position !== undefined && (
                                      <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                        {selection.position ? `${selection.position}${getOrdinalSuffix(selection.position)}` : 'Made Cut'}
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <p className="text-gray-900">{player?.name || 'Unknown player'}</p>
                                    {selection.position && (
                                      <p className="text-sm text-gray-500">Current position: {selection.position}{getOrdinalSuffix(selection.position)}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
                          <p className="text-gray-500">No existing selections found for this user and tournament.</p>
                        </div>
                      )}
                      
                      <div className="mb-6">
                        <h4 className="text-md font-semibold text-gray-800 mb-3">Update Selections</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {["playerOneId", "playerTwoId", "playerThreeId"].map((fieldName, idx) => (
                            <FormField
                              key={fieldName}
                              control={form.control}
                              name={fieldName as "playerOneId" | "playerTwoId" | "playerThreeId"}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Selection {idx + 1}</FormLabel>
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a player" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {isLoadingPlayers ? (
                                        <div className="p-2">
                                          <Skeleton className="h-5 w-full" />
                                          <Skeleton className="h-5 w-full mt-2" />
                                        </div>
                                      ) : golfPlayers?.length ? (
                                        golfPlayers.map(player => (
                                          <SelectItem key={player.id} value={player.id.toString()}>
                                            {player.name} {player.worldRanking ? `(#${player.worldRanking})` : ''}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="none" disabled>No players available</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-3">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => form.reset()}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          variant="default"
                          disabled={updateMutation.isPending}
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
        
        <TabsContent value="tournaments">
          <Card>
            <CardHeader>
              <CardTitle>Tournament Management</CardTitle>
              <CardDescription>
                Create and manage golf tournaments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-gray-500">
                Tournament management functionality to be implemented
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="players">
          <Card>
            <CardHeader>
              <CardTitle>Golf Player Management</CardTitle>
              <CardDescription>
                Manage the list of available golf players
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-gray-500">
                Golf player management functionality to be implemented
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Tournament Results</CardTitle>
              <CardDescription>
                Update player positions and calculate points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-gray-500">
                Results management functionality to be implemented
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Helper function to get ordinal suffix
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) {
    return "st";
  }
  if (j === 2 && k !== 12) {
    return "nd";
  }
  if (j === 3 && k !== 13) {
    return "rd";
  }
  return "th";
}

export default Admin;
