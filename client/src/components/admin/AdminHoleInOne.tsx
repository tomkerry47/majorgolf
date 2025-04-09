import { useState, useMemo, useEffect } from "react"; // Add useEffect
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { holeInOneFormSchema, type InsertHoleInOne, type Competition, type Golfer, type HoleInOne } from "@shared/schema";
import { Loader2 } from "lucide-react"; // Import Loader2

export default function AdminHoleInOne() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedHoleInOne, setSelectedHoleInOne] = useState<HoleInOne | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [formAction, setFormAction] = useState<'create' | 'edit'>('create');

  // Fetch competitions
  const { data: competitions, isLoading: isLoadingCompetitions } = useQuery<Competition[]>({
    queryKey: ['/api/competitions/all'],
  });

  // Fetch golfers - Updated to handle { golfers: [...] }
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery<{ golfers: Golfer[] }, Error, Golfer[]>({
    queryKey: ['/api/golfers'],
    queryFn: () => apiRequest<{ golfers: Golfer[] }>('/api/golfers'), // Fetch the object
    // More defensive select: ensure data exists and has the golfers property which is an array
    select: (data) => (data && Array.isArray(data.golfers) ? data.golfers : []),
  });

  // Fetch hole-in-ones for the selected competition
  const { data: holeInOnes = [], isLoading: isLoadingHoleInOnes } = useQuery<HoleInOne[]>({
    queryKey: ['/api/admin/hole-in-ones', selectedCompetitionId],
    queryFn: () => apiRequest(`/api/admin/hole-in-ones/${selectedCompetitionId}`),
    enabled: !!selectedCompetitionId, // Only fetch if a competition is selected
  });

  // Create a map for quick golfer name lookup
  const golferMap = useMemo(() => {
    // Explicitly check if golfers is an array before mapping
    if (!golfers || !Array.isArray(golfers)) {
      return new Map<number, Golfer>();
    }
    return new Map(golfers.map(golfer => [golfer.id, golfer]));
  }, [golfers]);

  const defaultValues: Partial<InsertHoleInOne> = {
    competitionId: selectedCompetitionId || 0,
    golferId: 0,
    holeNumber: 0,
    roundNumber: 0,
  };

  const form = useForm<InsertHoleInOne>({
    resolver: zodResolver(holeInOneFormSchema),
    defaultValues,
  });

  // Update form default competitionId when selection changes
  useEffect(() => {
    if (selectedCompetitionId) {
      form.setValue("competitionId", selectedCompetitionId);
    }
  }, [selectedCompetitionId, form]);

  const openCreateDialog = () => {
    if (!selectedCompetitionId) {
      toast({
        variant: "destructive",
        title: "Select a competition",
        description: "Please select a competition first.",
      });
      return;
    }
    form.reset({
      ...defaultValues,
      competitionId: selectedCompetitionId, // Ensure competitionId is set
    });
    setFormAction('create');
    setSelectedHoleInOne(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (hio: HoleInOne) => {
    form.reset({
      competitionId: hio.competitionId,
      golferId: hio.golferId,
      holeNumber: hio.holeNumber,
      roundNumber: hio.roundNumber,
    });
    setFormAction('edit');
    setSelectedHoleInOne(hio);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (hio: HoleInOne) => {
    setSelectedHoleInOne(hio);
    setIsDeleteDialogOpen(true);
  };

  // Create/Update Mutation
  const mutation = useMutation({
    mutationFn: (data: InsertHoleInOne) => {
      if (formAction === 'create') {
        return apiRequest('/api/admin/hole-in-ones', 'POST', data);
      } else if (selectedHoleInOne) {
        return apiRequest(`/api/admin/hole-in-ones/${selectedHoleInOne.id}`, 'PATCH', data);
      }
      throw new Error("Invalid action or missing selection");
    },
    onSuccess: () => {
      toast({
        title: `Hole-in-One ${formAction === 'create' ? 'Created' : 'Updated'}`,
        description: `The hole-in-one record has been successfully ${formAction === 'create' ? 'created' : 'updated'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hole-in-ones', selectedCompetitionId] });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred.",
      });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/hole-in-ones/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({
        title: "Hole-in-One Deleted",
        description: "The record has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hole-in-ones', selectedCompetitionId] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error Deleting",
        description: error.message || "An error occurred.",
      });
    },
  });

  const onSubmit = (data: InsertHoleInOne) => {
    mutation.mutate(data);
  };

  const handleDelete = () => {
    if (selectedHoleInOne) {
      deleteMutation.mutate(selectedHoleInOne.id);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Hole-in-Ones</CardTitle>
        <div className="flex gap-2">
          <Select
            value={selectedCompetitionId?.toString() || ""}
            onValueChange={(value) => setSelectedCompetitionId(value ? parseInt(value) : null)}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a competition" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCompetitions ? (
                <div className="p-2 text-center text-sm text-gray-500">Loading...</div>
              ) : competitions && competitions.length > 0 ? (
                competitions.map((competition) => (
                  <SelectItem key={competition.id} value={competition.id.toString()}>
                    {competition.name}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-center text-sm text-gray-500">No competitions found</div>
              )}
            </SelectContent>
          </Select>
          <Button onClick={openCreateDialog} disabled={!selectedCompetitionId}>
            <i className="fas fa-plus mr-2"></i>
            Add Hole-in-One
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedCompetitionId ? (
          <div className="text-center py-10 text-gray-500">
            Please select a competition to view and manage hole-in-one records.
          </div>
        ) : isLoadingHoleInOnes || isLoadingGolfers ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Golfer</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Hole</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holeInOnes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                    No hole-in-one records found for this competition.
                  </TableCell>
                </TableRow>
              ) : (
                holeInOnes.map((hio) => {
                  const golfer = golferMap.get(hio.golferId);
                  return (
                    <TableRow key={hio.id}>
                      <TableCell className="font-medium">
                        {golfer ? `${golfer.firstName} ${golfer.lastName}` : 'Unknown Golfer'} 
                      </TableCell>
                      <TableCell>{hio.roundNumber}</TableCell>
                      <TableCell>{hio.holeNumber}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(hio)}>
                          <i className="fas fa-edit mr-1"></i> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(hio)}>
                          <i className="fas fa-trash mr-1"></i> Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Hole-in-One Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{formAction === 'create' ? 'Add New Hole-in-One' : 'Edit Hole-in-One'}</DialogTitle>
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
                      value={field.value?.toString() || ""}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a golfer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingGolfers ? (
                          <div className="p-2 text-center text-sm text-gray-500">Loading...</div>
                        ) : golfers && Array.isArray(golfers) && golfers.length > 0 ? ( // Added Array.isArray check
                          golfers.map((golfer) => (
                            <SelectItem key={golfer.id} value={golfer.id.toString()}>
                              {golfer.firstName} {golfer.lastName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm text-gray-500">No golfers available</div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roundNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Round Number</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="4" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
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
                    <FormLabel>Hole Number</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="18" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {formAction === 'create' ? 'Add Record' : 'Save Changes'}
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
            <AlertDialogTitle>Delete Hole-in-One Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
