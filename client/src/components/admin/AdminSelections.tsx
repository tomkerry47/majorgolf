import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { selectionFormSchema, type InsertSelection } from "@shared/schema";

export default function AdminSelections() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSelection, setSelectedSelection] = useState<any>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  
  // Get all competitions
  const { data: competitions, isLoading: isLoadingCompetitions } = useQuery({
    queryKey: ['/api/competitions'],
  });
  
  // Get all users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/admin/users'],
  });
  
  // Get selections for selected competition
  const { data: selections, isLoading: isLoadingSelections } = useQuery({
    queryKey: [`/api/admin/competitions/${selectedCompetition}/selections`],
    enabled: !!selectedCompetition,
  });
  
  // Get all golfers for the form
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery({
    queryKey: ['/api/golfers'],
  });
  
  const defaultValues: InsertSelection = {
    competitionId: selectedCompetition || 0,
    userId: selectedUser || 0,
    golfer1Id: 0,
    golfer2Id: 0,
    golfer3Id: 0,
  };
  
  const form = useForm<InsertSelection>({
    resolver: zodResolver(selectionFormSchema),
    defaultValues
  });
  
  const openEditDialog = (selection: any) => {
    form.reset({
      competitionId: selection.competitionId,
      userId: selection.userId,
      golfer1Id: selection.golfer1Id,
      golfer2Id: selection.golfer2Id,
      golfer3Id: selection.golfer3Id
    });
    setSelectedSelection(selection);
    setIsDialogOpen(true);
  };
  
  const openDeleteDialog = (selection: any) => {
    setSelectedSelection(selection);
    setIsDeleteDialogOpen(true);
  };
  
  const onSubmit = async (data: InsertSelection) => {
    try {
      await apiRequest('PATCH', `/api/admin/selections/${selectedSelection.id}`, data);
      toast({
        title: "Selection updated",
        description: "The selection has been successfully updated."
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/admin/competitions/${selectedCompetition}/selections`] });
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
      await apiRequest('DELETE', `/api/admin/selections/${selectedSelection.id}`, {});
      toast({
        title: "Selection deleted",
        description: "The selection has been successfully deleted."
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/admin/competitions/${selectedCompetition}/selections`] });
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred."
      });
    }
  };
  
  // Filtered selections by user if selectedUser is set
  const filteredSelections = selectedUser 
    ? selections?.filter(selection => selection.userId === selectedUser)
    : selections;
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage User Selections</CardTitle>
        <div className="flex gap-2">
          <Select
            value={selectedCompetition?.toString() || ""}
            onValueChange={(value) => setSelectedCompetition(parseInt(value))}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a competition" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingCompetitions ? (
                <div className="py-2 text-center text-sm text-gray-500">Loading...</div>
              ) : competitions?.length === 0 ? (
                <div className="py-2 text-center text-sm text-gray-500">No competitions found</div>
              ) : (
                competitions?.map((competition) => (
                  <SelectItem key={competition.id} value={competition.id.toString()}>
                    {competition.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          <Select
            value={selectedUser?.toString() || "0"}
            onValueChange={(value) => setSelectedUser(value === "0" ? null : parseInt(value))}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Filter by user (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All Users</SelectItem>
              {isLoadingUsers ? (
                <div className="py-2 text-center text-sm text-gray-500">Loading...</div>
              ) : users?.length === 0 ? (
                <div className="py-2 text-center text-sm text-gray-500">No users found</div>
              ) : (
                users?.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.username}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedCompetition ? (
          <div className="text-center py-10 text-gray-500">
            Please select a competition to view and manage selections.
          </div>
        ) : isLoadingSelections ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Selection 1</TableHead>
                <TableHead>Selection 2</TableHead>
                <TableHead>Selection 3</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSelections?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                    {selectedUser ? 
                      'This user has not made any selections for this competition.' : 
                      'No selections found for this competition.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSelections?.map((selection) => (
                  <TableRow key={selection.id}>
                    <TableCell className="font-medium">
                      {selection.user?.username || 'Unknown'}
                    </TableCell>
                    <TableCell>{selection.golfer1?.name || 'Unknown'}</TableCell>
                    <TableCell>{selection.golfer2?.name || 'Unknown'}</TableCell>
                    <TableCell>{selection.golfer3?.name || 'Unknown'}</TableCell>
                    <TableCell>{new Date(selection.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{new Date(selection.updatedAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(selection)}>
                        <i className="fas fa-edit mr-1"></i> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(selection)}>
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
      
      {/* Edit Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User Selection</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="golfer1Id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selection 1</FormLabel>
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
                name="golfer2Id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selection 2</FormLabel>
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
                name="golfer3Id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selection 3</FormLabel>
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
              
              <DialogFooter>
                <Button type="submit">
                  Save Changes
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
            <AlertDialogTitle>Delete Selection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user's selection? This action cannot be undone.
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
