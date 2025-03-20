import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Competition, Golfer, WildcardGolfer } from '@shared/schema';

// Form schema for setting wildcard golfers
const wildcardGolferSchema = z.object({
  competitionId: z.coerce.number().min(1, 'Please select a competition'),
  golferId: z.coerce.number().min(1, 'Please select a golfer'),
  isWildcard: z.boolean().default(true)
});

type WildcardGolferFormValues = z.infer<typeof wildcardGolferSchema>;

export default function AdminWildcardGolfers() {
  const [activeTab, setActiveTab] = useState('add');
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch competitions
  const { data: competitions, isLoading: isLoadingCompetitions } = useQuery({
    queryKey: ['/api/competitions'],
    queryFn: async () => {
      const response = await apiRequest('/api/competitions');
      return response as unknown as Competition[];
    }
  });

  // Fetch golfers
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery({
    queryKey: ['/api/golfers'],
    queryFn: async () => {
      const response = await apiRequest('/api/golfers');
      return response as unknown as Golfer[];
    }
  });

  // Fetch wildcard golfers for selected competition
  const { data: wildcardGolfers, isLoading: isLoadingWildcards } = useQuery({
    queryKey: ['/api/admin/wildcard-golfers', selectedCompetition],
    queryFn: async () => {
      if (!selectedCompetition) return [];
      const response = await apiRequest(`/api/admin/wildcard-golfers/${selectedCompetition}`);
      return response as unknown as WildcardGolfer[];
    },
    enabled: !!selectedCompetition
  });

  // Setup form for adding/updating wildcard golfers
  const form = useForm<WildcardGolferFormValues>({
    resolver: zodResolver(wildcardGolferSchema),
    defaultValues: {
      competitionId: 0,
      golferId: 0,
      isWildcard: true
    }
  });

  // Mutation to set wildcard status
  const setWildcardMutation = useMutation({
    mutationFn: async (values: WildcardGolferFormValues) => {
      return await apiRequest<WildcardGolfer>('/api/admin/wildcard-golfers', 'POST', values);
    },
    onSuccess: () => {
      toast({
        title: 'Wildcard status updated',
        description: 'The golfer wildcard status has been updated successfully.'
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/wildcard-golfers'] });
      if (selectedCompetition) {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/wildcard-golfers', selectedCompetition] });
      }
      
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update wildcard status: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Mutation to remove wildcard status
  const removeWildcardMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest<void>(`/api/admin/wildcard-golfers/${id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: 'Wildcard removed',
        description: 'The wildcard status has been removed successfully.'
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/wildcard-golfers'] });
      if (selectedCompetition) {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/wildcard-golfers', selectedCompetition] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to remove wildcard status: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: WildcardGolferFormValues) => {
    setWildcardMutation.mutate(data);
  };

  const handleCompetitionChange = (competitionId: string) => {
    setSelectedCompetition(parseInt(competitionId, 10));
  };

  // Effect to update the form's competition ID when tab or selected competition changes
  useEffect(() => {
    if (selectedCompetition) {
      form.setValue('competitionId', selectedCompetition);
    }
  }, [selectedCompetition, form]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Wildcard Golfers Management</h1>
      
      <Tabs defaultValue="add" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="add">Add/Update Wildcards</TabsTrigger>
          <TabsTrigger value="view">View Wildcards</TabsTrigger>
        </TabsList>
        
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add or Update Wildcard Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="competitionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Competition</FormLabel>
                        <Select
                          disabled={isLoadingCompetitions}
                          onValueChange={field.onChange}
                          value={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a competition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {competitions?.map((competition: Competition) => (
                              <SelectItem key={competition.id} value={competition.id.toString()}>
                                {competition.name} ({competition.venue})
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
                    name="golferId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Golfer</FormLabel>
                        <Select
                          disabled={isLoadingGolfers || !form.getValues('competitionId')}
                          onValueChange={field.onChange}
                          value={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a golfer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {golfers?.map((golfer: Golfer) => (
                              <SelectItem key={golfer.id} value={golfer.id.toString()}>
                                {golfer.name} (Rank: {golfer.rank})
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
                    name="isWildcard"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Mark as Wildcard (outside top 50)</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    disabled={
                      setWildcardMutation.isPending || 
                      isLoadingCompetitions || 
                      isLoadingGolfers || 
                      !form.getValues('competitionId') || 
                      !form.getValues('golferId')
                    }
                  >
                    {setWildcardMutation.isPending ? 'Saving...' : 'Save Wildcard Status'}
                  </Button>
                </form>
              </Form>
              
              <div className="mt-6">
                <p className="text-sm text-gray-500">
                  Mark golfers who are outside the world top 50 as "wildcards." 
                  When these golfers are selected by users, they will earn double points based on their tournament performance.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="view">
          <Card>
            <CardHeader>
              <CardTitle>View Wildcard Golfers</CardTitle>
              <div className="mt-4">
                <Label htmlFor="competition-filter">Filter by Competition</Label>
                <Select 
                  onValueChange={handleCompetitionChange} 
                  value={selectedCompetition?.toString() || ''}
                >
                  <SelectTrigger id="competition-filter">
                    <SelectValue placeholder="Select a competition" />
                  </SelectTrigger>
                  <SelectContent>
                    {competitions?.map((competition: Competition) => (
                      <SelectItem key={competition.id} value={competition.id.toString()}>
                        {competition.name} ({competition.venue})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingWildcards ? (
                <div className="text-center py-4">Loading wildcards...</div>
              ) : wildcardGolfers && wildcardGolfers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Golfer</TableHead>
                      <TableHead>Rank</TableHead>
                      <TableHead>Wildcard Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wildcardGolfers.map((wildcard: WildcardGolfer) => {
                      const golfer = golfers?.find((g: Golfer) => g.id === wildcard.golferId);
                      return (
                        <TableRow key={wildcard.id}>
                          <TableCell>{golfer?.name || `Golfer #${wildcard.golferId}`}</TableCell>
                          <TableCell>{golfer?.rank || 'Unknown'}</TableCell>
                          <TableCell>
                            {wildcard.isWildcard ? (
                              <span className="text-green-500 font-semibold">Wildcard (2x points)</span>
                            ) : (
                              <span className="text-gray-500">Not a wildcard</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="destructive" size="sm">Remove</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Confirm Removal</DialogTitle>
                                </DialogHeader>
                                <p>
                                  Are you sure you want to remove the wildcard status for {golfer?.name || `Golfer #${wildcard.golferId}`}?
                                </p>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                  </DialogClose>
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => removeWildcardMutation.mutate(wildcard.id)}
                                    disabled={removeWildcardMutation.isPending}
                                  >
                                    {removeWildcardMutation.isPending ? 'Removing...' : 'Remove Wildcard'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4">
                  {selectedCompetition ? 
                    'No wildcard golfers found for this competition.' : 
                    'Please select a competition to view wildcards.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}