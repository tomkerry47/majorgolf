import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Check, 
  Loader2, 
  Plus,
  Save,
  Trash2, 
  Trophy, 
  X 
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { InsertResult, Golfer, Result, Competition } from '@shared/schema';

// Form schema for tournament results
const resultFormSchema = z.object({
  competitionId: z.number(),
  golferId: z.number(),
  position: z.number().int().min(0).max(100),
  score: z.number(),
});

type ResultFormValues = z.infer<typeof resultFormSchema>;

interface TournamentResultsProps {
  competitionId: string;
  onBack: () => void;
}

export default function TournamentResults({ competitionId, onBack }: TournamentResultsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCompletingTournament, setIsCompletingTournament] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  
  // Form setup
  const form = useForm<ResultFormValues>({
    resolver: zodResolver(resultFormSchema),
    defaultValues: {
      competitionId: parseInt(competitionId),
      golferId: undefined,
      position: undefined,
      score: undefined,
    },
  });
  
  // Edit form setup (separate form for editing)
  const editForm = useForm<Partial<ResultFormValues>>({
    resolver: zodResolver(resultFormSchema.partial()),
    defaultValues: {
      position: undefined,
      score: undefined,
    },
  });
  
  // Fetch tournament details
  const { data: tournament, isPending: isTournamentLoading } = useQuery<Competition>({
    queryKey: ['/api/competitions', competitionId],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: !!competitionId,
  });
  
  // Fetch results
  const { 
    data: results, 
    isPending: isResultsLoading
  } = useQuery<Result[]>({
    queryKey: ['/api/admin/tournament-results', competitionId],
    queryFn: getQueryFn({ on401: 'throw' }),
    enabled: !!competitionId,
  });
  
  // Fetch golfers
  const { 
    data: golfers, 
    isPending: isGolfersLoading
  } = useQuery<Golfer[]>({
    queryKey: ['/api/golfers'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });
  
  // Create result mutation
  const createMutation = useMutation({
    mutationFn: (values: ResultFormValues) => 
      apiRequest('/api/admin/tournament-results', 'POST', JSON.stringify(values)),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Tournament result added successfully',
      });
      form.reset();
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tournament-results', competitionId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add tournament result',
        variant: 'destructive',
      });
    }
  });
  
  // Update result mutation
  const updateMutation = useMutation({
    mutationFn: (values: { id: number, data: Partial<ResultFormValues> }) => 
      apiRequest(`/api/admin/tournament-results/${values.id}`, 'PATCH', values.data),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Tournament result updated successfully',
      });
      editForm.reset();
      setIsEditDialogOpen(false);
      setSelectedResult(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tournament-results', competitionId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update tournament result',
        variant: 'destructive',
      });
    }
  });
  
  // Delete result mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/tournament-results/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Tournament result deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tournament-results', competitionId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete tournament result',
        variant: 'destructive',
      });
    }
  });
  
  // Complete tournament mutation
  const completeTournamentMutation = useMutation({
    mutationFn: () => 
      apiRequest(`/api/admin/complete-tournament/${competitionId}`, 'POST'),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Tournament completed successfully',
      });
      setIsCompletingTournament(false);
      queryClient.invalidateQueries({ queryKey: ['/api/competitions', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/competitions'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete tournament',
        variant: 'destructive',
      });
      setIsCompletingTournament(false);
    }
  });
  
  // Submit handler for adding a new result
  const onSubmit = (data: ResultFormValues) => {
    createMutation.mutate(data);
  };
  
  // Submit handler for editing a result
  const onEditSubmit = (data: Partial<ResultFormValues>) => {
    if (!selectedResult) return;
    
    updateMutation.mutate({
      id: selectedResult.id,
      data: {
        position: data.position,
        score: data.score,
      },
    });
  };
  
  // Handle delete
  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };
  
  // Handle edit dialog open
  const handleEditClick = (result: Result) => {
    setSelectedResult(result);
    editForm.setValue('position', result.position);
    editForm.setValue('score', result.score);
    setIsEditDialogOpen(true);
  };
  
  // Handle complete tournament
  const handleCompleteTournament = () => {
    setIsCompletingTournament(true);
    completeTournamentMutation.mutate();
  };
  
  // Loading state
  const isLoading = isTournamentLoading || isResultsLoading || isGolfersLoading;
  
  // Find golfer name by ID
  const getGolferName = (golferId: number) => {
    if (!golfers) return 'Unknown Golfer';
    const golfer = golfers.find(g => g.id === golferId);
    return golfer ? golfer.name : 'Unknown Golfer';
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tournaments
        </Button>
        
        {tournament && !tournament.isComplete && (
          <Button
            variant="default"
            onClick={handleCompleteTournament}
            disabled={isCompletingTournament || !results || results.length === 0}
          >
            {isCompletingTournament ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trophy className="mr-2 h-4 w-4" />
            )}
            Complete Tournament
          </Button>
        )}
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>
                {tournament ? tournament.name : 'Loading tournament...'}
                {tournament && tournament.isComplete && (
                  <Badge className="ml-2 bg-green-500" variant="secondary">
                    Completed
                  </Badge>
                )}
                {tournament && tournament.isActive && !tournament.isComplete && (
                  <Badge className="ml-2" variant="secondary">
                    Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {tournament ? tournament.venue : ''}
                {tournament && ` (${new Date(tournament.startDate).toLocaleDateString()} - ${new Date(tournament.endDate).toLocaleDateString()})`}
              </CardDescription>
            </div>
            
            {tournament && !tournament.isComplete && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Result
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Tournament Result</DialogTitle>
                    <DialogDescription>
                      Enter the golfer's position and score for this tournament.
                    </DialogDescription>
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
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              defaultValue={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select golfer" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {golfers && golfers.map(golfer => (
                                  <SelectItem 
                                    key={golfer.id} 
                                    value={golfer.id.toString()}
                                  >
                                    {golfer.name}
                                  </SelectItem>
                                ))}
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
                                placeholder="Enter position (e.g. 1 for 1st place)"
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormDescription>
                              {getOrdinalSuffix(field.value || 0)} place
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="score"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Score</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Enter score (e.g. -12)"
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsAddDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={createMutation.isPending}
                        >
                          {createMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Add Result
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : results && results.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Golfer</TableHead>
                  <TableHead>Score</TableHead>
                  {!tournament?.isComplete && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(result => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <span className="font-medium">
                        {result.position}{getOrdinalSuffix(result.position)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {result.golfers ? result.golfers.name : getGolferName(result.golferId)}
                    </TableCell>
                    <TableCell>
                      {result.score > 0 ? `+${result.score}` : result.score}
                    </TableCell>
                    {!tournament?.isComplete && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(result)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(result.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500">No results found for this tournament.</p>
              {!tournament?.isComplete && (
                <p className="text-sm text-gray-500 mt-2">
                  Click the "Add Result" button to add golfer results.
                </p>
              )}
            </div>
          )}
        </CardContent>
        
        {tournament?.isComplete && (
          <CardFooter className="bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center text-green-700 dark:text-green-400">
              <Check className="h-5 w-5 mr-2" />
              <span>This tournament has been completed and points have been awarded.</span>
            </div>
          </CardFooter>
        )}
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tournament Result</DialogTitle>
            <DialogDescription>
              Update the golfer's position and score for this tournament.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              {selectedResult && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Golfer</h4>
                  <p className="text-sm">
                    {selectedResult.golfers 
                      ? selectedResult.golfers.name 
                      : getGolferName(selectedResult.golferId)
                    }
                  </p>
                </div>
              )}
              
              <FormField
                control={editForm.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter position (e.g. 1 for 1st place)"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      {getOrdinalSuffix(field.value || 0)} place
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Score</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter score (e.g. -12)"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedResult(null);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Result
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to get ordinal suffix
function getOrdinalSuffix(num: number): string {
  if (num <= 0) return '';
  
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
}