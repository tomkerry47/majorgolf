import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { insertResultSchema, type InsertResult } from "@shared/schema";

export default function AdminResults() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null);
  const [formAction, setFormAction] = useState<'create' | 'edit'>('create');
  
  // Get all competitions
  const { data: competitions, isLoading: isLoadingCompetitions } = useQuery({
    queryKey: ['/api/competitions'],
  });
  
  // Get competition results for selected competition
  const { data: results, isLoading: isLoadingResults } = useQuery({
    queryKey: [`/api/admin/competitions/${selectedCompetition}/results`],
    enabled: !!selectedCompetition,
  });
  
  // Get all golfers
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery({
    queryKey: ['/api/golfers'],
  });
  
  const defaultValues: InsertResult = {
    competitionId: selectedCompetition || 0,
    golferId: 0,
    position: 0,
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
        await apiRequest('POST', '/api/admin/results', data);
        toast({
          title: "Result created",
          description: "The result has been successfully created."
        });
      } else {
        await apiRequest('PATCH', `/api/admin/results/${selectedResult.id}`, data);
        toast({
          title: "Result updated",
          description: "The result has been successfully updated."
        });
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/admin/competitions/${selectedCompetition}/results`] });
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
      await apiRequest('DELETE', `/api/admin/results/${selectedResult.id}`, {});
      toast({
        title: "Result deleted",
        description: "The result has been successfully deleted."
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/admin/competitions/${selectedCompetition}/results`] });
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred."
      });
    }
  };
  
  const activeCompetitions = competitions?.filter(c => c.isActive || c.isComplete) || [];
  
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
                activeCompetitions.map((competition) => (
                  <SelectItem key={competition.id} value={competition.id.toString()}>
                    {competition.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          <Button onClick={openCreateDialog} disabled={!selectedCompetition}>
            <i className="fas fa-plus mr-2"></i>
            Add Result
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedCompetition ? (
          <div className="text-center py-10 text-gray-500">
            Please select a competition to view and manage results.
          </div>
        ) : isLoadingResults ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
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
              {results?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                    No results found for this competition. Add some to get started.
                  </TableCell>
                </TableRow>
              ) : (
                results?.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">{result.position}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {result.golfer?.avatar ? (
                          <img 
                            className="h-8 w-8 rounded-full mr-2" 
                            src={result.golfer.avatar} 
                            alt={result.golfer.name} 
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                            <span className="text-sm font-medium text-gray-800">
                              {result.golfer?.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        {result.golfer?.name}
                      </div>
                    </TableCell>
                    <TableCell>{result.points}</TableCell>
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
                          golfers?.map((golfer) => (
                            <SelectItem key={golfer.id} value={golfer.id.toString()}>
                              {golfer.name}
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
                        onChange={(e) => field.onChange(parseInt(e.target.value))} 
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
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
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
    </Card>
  );
}
