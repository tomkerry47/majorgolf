import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { holeInOneFormSchema, type HoleInOne, type Competition, type Golfer } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Award, Edit, Trash2 } from 'lucide-react';

// Define the form schema for hole-in-one records without createdAt and updatedAt fields which are auto-generated
type HoleInOneFormValues = {
  competitionId: number;
  golferId: number;
  holeNumber: number;
  roundNumber: number;
};

export default function AdminHoleInOne() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [selectedHoleInOne, setSelectedHoleInOne] = useState<HoleInOne | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);

  // Fetch competitions
  const { data: competitions } = useQuery<Competition[]>({
    queryKey: ['/api/competitions'],
    select: (data) => data.sort((a, b) => {
      // Show active competitions first, then upcoming, then completed
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      if (!a.isComplete && b.isComplete) return -1;
      if (a.isComplete && !b.isComplete) return 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }),
  });

  // Fetch golfers
  const { data: golfers } = useQuery<Golfer[]>({
    queryKey: ['/api/golfers'],
    select: (data) => data.sort((a, b) => a.rank - b.rank),
  });

  // Fetch hole-in-ones for selected competition
  const { data: holeInOnes, isLoading } = useQuery<HoleInOne[]>({
    queryKey: ['/api/admin/hole-in-ones', selectedCompetitionId],
    queryFn: () => apiRequest<HoleInOne[]>(`GET`, `/api/admin/hole-in-ones/${selectedCompetitionId}`),
    enabled: !!selectedCompetitionId,
  });

  // Form for adding/editing hole-in-one
  const form = useForm<HoleInOneFormValues>({
    resolver: zodResolver(holeInOneFormSchema.omit({ createdAt: true, updatedAt: true })),
    defaultValues: {
      competitionId: selectedCompetitionId || 0,
      golferId: 0,
      holeNumber: 1,
      roundNumber: 1,
    }
  });

  // Create hole-in-one mutation
  const createMutation = useMutation({
    mutationFn: (values: HoleInOneFormValues) =>
      apiRequest<HoleInOne>(`POST`, `/api/admin/hole-in-ones`, values),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Hole-in-one record added successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hole-in-ones', selectedCompetitionId] });
      setIsAddDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to add hole-in-one: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update hole-in-one mutation
  const updateMutation = useMutation({
    mutationFn: (values: HoleInOneFormValues & { id: number }) => {
      const { id, ...data } = values;
      return apiRequest<HoleInOne>(`PATCH`, `/api/admin/hole-in-ones/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Hole-in-one record updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hole-in-ones', selectedCompetitionId] });
      setIsEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update hole-in-one: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete hole-in-one mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest<void>(`DELETE`, `/api/admin/hole-in-ones/${id}`),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Hole-in-one record deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hole-in-ones', selectedCompetitionId] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete hole-in-one: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Handle form submission for adding new hole-in-one
  const onSubmit = (data: HoleInOneFormValues) => {
    if (selectedHoleInOne) {
      // Update existing record
      updateMutation.mutate({ ...data, id: selectedHoleInOne.id });
    } else {
      // Create new record
      createMutation.mutate(data);
    }
  };

  // Open add dialog
  const handleAddClick = () => {
    form.reset({
      competitionId: selectedCompetitionId || 0,
      golferId: 0,
      holeNumber: 1,
      roundNumber: 1,
    });
    setSelectedHoleInOne(null);
    setIsAddDialogOpen(true);
  };

  // Open edit dialog
  const handleEditClick = (holeInOne: HoleInOne) => {
    setSelectedHoleInOne(holeInOne);
    form.reset({
      competitionId: holeInOne.competitionId,
      golferId: holeInOne.golferId,
      holeNumber: holeInOne.holeNumber,
      roundNumber: holeInOne.roundNumber,
    });
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const handleDeleteClick = (holeInOne: HoleInOne) => {
    setSelectedHoleInOne(holeInOne);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (selectedHoleInOne) {
      deleteMutation.mutate(selectedHoleInOne.id);
    }
  };

  // Get golfer name by ID
  const getGolferName = (golferId: number) => {
    const golfer = golfers?.find((g) => g.id === golferId);
    return golfer ? golfer.name : 'Unknown Golfer';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Hole-in-One Records</CardTitle>
          <CardDescription>
            Manage hole-in-one records for each tournament. Each hole-in-one is worth 20 points to users who selected that golfer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-full max-w-xs">
                <Label htmlFor="competition-select">Select Tournament</Label>
                <Select
                  onValueChange={(value) => setSelectedCompetitionId(parseInt(value))}
                  value={selectedCompetitionId?.toString() || ""}
                >
                  <SelectTrigger id="competition-select">
                    <SelectValue placeholder="Select Tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {competitions?.map((competition: any) => (
                      <SelectItem key={competition.id} value={competition.id.toString()}>
                        {competition.name} {competition.isActive ? '(Active)' : competition.isComplete ? '(Completed)' : '(Upcoming)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleAddClick} 
                disabled={!selectedCompetitionId}
                className="mt-6"
              >
                Add Hole-in-One Record
              </Button>
            </div>

            {selectedCompetitionId && (
              <div className="border rounded-md">
                {isLoading ? (
                  <div className="p-8 text-center">Loading hole-in-one records...</div>
                ) : holeInOnes && holeInOnes.length > 0 ? (
                  <Table>
                    <TableCaption>Hole-in-One Records</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Golfer</TableHead>
                        <TableHead>Round</TableHead>
                        <TableHead>Hole</TableHead>
                        <TableHead>Date Recorded</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holeInOnes.map((holeInOne: any) => (
                        <TableRow key={holeInOne.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-yellow-500" />
                              {holeInOne.golfer ? holeInOne.golfer.name : getGolferName(holeInOne.golferId)}
                            </div>
                          </TableCell>
                          <TableCell>{holeInOne.roundNumber}</TableCell>
                          <TableCell>{holeInOne.holeNumber}</TableCell>
                          <TableCell>{new Date(holeInOne.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(holeInOne)}
                              >
                                <Edit className="w-4 h-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteClick(holeInOne)}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-yellow-500" />
                    <p>No hole-in-one records found for this tournament.</p>
                    <p className="text-sm text-muted-foreground">
                      Add a record using the button above.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedHoleInOne ? 'Edit Hole-in-One Record' : 'Add New Hole-in-One Record'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="competitionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tournament</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={String(field.value)}
                      disabled={!!selectedHoleInOne}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Tournament" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {competitions?.map((competition: any) => (
                          <SelectItem key={competition.id} value={competition.id.toString()}>
                            {competition.name}
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
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Golfer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {golfers?.map((golfer: any) => (
                          <SelectItem key={golfer.id} value={golfer.id.toString()}>
                            {golfer.rank}. {golfer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="roundNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Round</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="4"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="holeNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hole</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="18"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">Cancel</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete this hole-in-one record? This action cannot be undone.
          </p>
          {selectedHoleInOne && (
            <p className="font-medium">
              {getGolferName(selectedHoleInOne.golferId)} - Round {selectedHoleInOne.roundNumber}, Hole {selectedHoleInOne.holeNumber}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}