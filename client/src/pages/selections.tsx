import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tournament, GolfPlayer } from "@shared/schema";
import { Form } from "@/components/ui/form";
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoIcon, CalendarIcon, MapPinIcon } from "lucide-react";
import { format } from "date-fns";
import SelectionForm from "@/components/selection-form";

// Form schema for selections
const selectionFormSchema = z.object({
  tournamentId: z.string(),
  playerOneId: z.string(),
  playerTwoId: z.string(),
  playerThreeId: z.string(),
}).refine(data => {
  const { playerOneId, playerTwoId, playerThreeId } = data;
  const uniqueIds = new Set([playerOneId, playerTwoId, playerThreeId]);
  return uniqueIds.size === 3;
}, {
  message: "You must select three different players",
  path: ["playerThreeId"],
});

type SelectionFormValues = z.infer<typeof selectionFormSchema>;

const Selections = () => {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch tournaments that are upcoming or active
  const { data: tournaments, isLoading: isLoadingTournaments } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments/available"],
  });

  // Filter to upcoming tournaments with future deadlines
  const availableTournaments = tournaments?.filter(t => {
    if (t.status !== 'upcoming' && t.status !== 'active') return false;
    
    // If active, check if selections can still be changed
    const deadline = new Date(t.selectionDeadline);
    return deadline > new Date();
  }) || [];

  // Set first tournament as default if none selected and we have data
  if (!selectedTournamentId && availableTournaments.length > 0 && !isLoadingTournaments) {
    setSelectedTournamentId(availableTournaments[0].id.toString());
  }

  // Fetch golf players
  const { data: golfPlayers, isLoading: isLoadingPlayers } = useQuery<GolfPlayer[]>({
    queryKey: ["/api/players"],
  });

  // Fetch existing selections for the selected tournament
  const { data: existingSelection, isLoading: isLoadingSelection } = useQuery({
    queryKey: ["/api/selections", selectedTournamentId],
    enabled: !!selectedTournamentId,
  });

  // Find selected tournament
  const selectedTournament = availableTournaments.find(
    t => t.id.toString() === selectedTournamentId
  );

  // Set up form
  const form = useForm<SelectionFormValues>({
    resolver: zodResolver(selectionFormSchema),
    defaultValues: {
      tournamentId: selectedTournamentId || "",
      playerOneId: existingSelection?.playerOneId?.toString() || "",
      playerTwoId: existingSelection?.playerTwoId?.toString() || "",
      playerThreeId: existingSelection?.playerThreeId?.toString() || "",
    },
  });

  // Update form values when tournament or existing selection changes
  useState(() => {
    if (selectedTournamentId) {
      form.setValue("tournamentId", selectedTournamentId);
    }
    
    if (existingSelection) {
      form.setValue("playerOneId", existingSelection.playerOneId.toString());
      form.setValue("playerTwoId", existingSelection.playerTwoId.toString());
      form.setValue("playerThreeId", existingSelection.playerThreeId.toString());
    } else {
      form.setValue("playerOneId", "");
      form.setValue("playerTwoId", "");
      form.setValue("playerThreeId", "");
    }
  });

  // Submit selections mutation
  const submitMutation = useMutation({
    mutationFn: async (values: SelectionFormValues) => {
      return apiRequest("POST", "/api/selections", {
        tournamentId: parseInt(values.tournamentId),
        playerOneId: parseInt(values.playerOneId),
        playerTwoId: parseInt(values.playerTwoId),
        playerThreeId: parseInt(values.playerThreeId),
      });
    },
    onSuccess: () => {
      toast({
        title: "Selections saved",
        description: "Your player selections have been saved successfully.",
      });
      
      // Invalidate selections query to refetch data
      queryClient.invalidateQueries({ queryKey: ["/api/selections"] });
    },
    onError: (error) => {
      toast({
        title: "Error saving selections",
        description: error.message || "Failed to save your selections. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: SelectionFormValues) => {
    submitMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">My Selections</h2>
      
      {isLoadingTournaments ? (
        <Skeleton className="h-10 w-full max-w-md rounded-md" />
      ) : availableTournaments.length > 0 ? (
        <Select
          value={selectedTournamentId || ''}
          onValueChange={(value) => {
            setSelectedTournamentId(value);
            form.setValue("tournamentId", value);
          }}
        >
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Select tournament" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Available Tournaments</SelectLabel>
              {availableTournaments.map((tournament) => (
                <SelectItem key={tournament.id} value={tournament.id.toString()}>
                  {tournament.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Available Tournaments</CardTitle>
            <CardDescription>
              There are currently no tournaments available for selection.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      
      {selectedTournament && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{selectedTournament.name}</CardTitle>
            <CardDescription>
              <div className="flex items-center mt-1">
                <CalendarIcon className="h-4 w-4 mr-1" />
                <span>
                  {format(new Date(selectedTournament.startDate), "MMMM d")} - 
                  {format(new Date(selectedTournament.endDate), "d, yyyy")}
                </span>
              </div>
              <div className="flex items-center mt-1">
                <MapPinIcon className="h-4 w-4 mr-1" />
                <span>{selectedTournament.location}</span>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <InfoIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Selection Rules</h3>
                  <div className="mt-1 text-sm text-gray-600">
                    <p>Select three players for this tournament. Points will be awarded based on final standings.</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>1st place: 100 points</li>
                      <li>2nd place: 75 points</li>
                      <li>3rd place: 60 points</li>
                      <li>4th-10th place: 40-10 points</li>
                      <li>Made cut: 5 points</li>
                    </ul>
                  </div>
                  <div className="mt-2 text-sm font-medium text-amber-600">
                    Selection deadline: {format(new Date(selectedTournament.selectionDeadline), "MMMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>
              </div>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <SelectionForm
                  form={form}
                  golfPlayers={golfPlayers || []}
                  isLoading={isLoadingPlayers || isLoadingSelection}
                  isPending={submitMutation.isPending}
                />
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
      
      {/* Past Selections */}
      <div className="mt-10">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Past Selections</h3>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Query for past selections would go here */}
          <div className="p-8 text-center text-gray-500">
            Past tournament selections will appear here
          </div>
        </div>
      </div>
    </div>
  );
};

export default Selections;
