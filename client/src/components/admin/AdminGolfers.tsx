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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { insertGolferSchema, type InsertGolfer } from "@shared/schema";

export default function AdminGolfers() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedGolfer, setSelectedGolfer] = useState<any>(null);
  const [formAction, setFormAction] = useState<'create' | 'edit'>('create');
  
  const { data: golfers, isLoading } = useQuery({
    queryKey: ['/api/admin/golfers'],
  });
  
  const defaultValues: InsertGolfer = {
    name: '',
    rank: undefined,
    avatar: ''
  };
  
  const form = useForm<InsertGolfer>({
    resolver: zodResolver(insertGolferSchema),
    defaultValues
  });
  
  const openCreateDialog = () => {
    form.reset(defaultValues);
    setFormAction('create');
    setSelectedGolfer(null);
    setIsDialogOpen(true);
  };
  
  const openEditDialog = (golfer: any) => {
    form.reset({
      name: golfer.name,
      rank: golfer.rank || undefined,
      avatar: golfer.avatar || ''
    });
    setFormAction('edit');
    setSelectedGolfer(golfer);
    setIsDialogOpen(true);
  };
  
  const openDeleteDialog = (golfer: any) => {
    setSelectedGolfer(golfer);
    setIsDeleteDialogOpen(true);
  };
  
  const onSubmit = async (data: InsertGolfer) => {
    try {
      if (formAction === 'create') {
        await apiRequest('POST', '/api/admin/golfers', data);
        toast({
          title: "Golfer created",
          description: "The golfer has been successfully created."
        });
      } else {
        await apiRequest('PATCH', `/api/admin/golfers/${selectedGolfer.id}`, data);
        toast({
          title: "Golfer updated",
          description: "The golfer has been successfully updated."
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/golfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/golfers'] });
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
      await apiRequest('DELETE', `/api/admin/golfers/${selectedGolfer.id}`, {});
      toast({
        title: "Golfer deleted",
        description: "The golfer has been successfully deleted."
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/golfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/golfers'] });
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred."
      });
    }
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Golfers</CardTitle>
        <Button onClick={openCreateDialog}>
          <i className="fas fa-plus mr-2"></i>
          Add Golfer
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Avatar</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {golfers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                    No golfers found. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                golfers?.map((golfer) => (
                  <TableRow key={golfer.id}>
                    <TableCell className="font-medium">{golfer.name}</TableCell>
                    <TableCell>{golfer.rank || 'N/A'}</TableCell>
                    <TableCell>
                      {golfer.avatar ? (
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          <img 
                            src={golfer.avatar} 
                            alt={golfer.name} 
                            className="h-10 w-10 object-cover" 
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-800">
                            {golfer.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(golfer)}>
                        <i className="fas fa-edit mr-1"></i> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(golfer)}>
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
      
      {/* Create/Edit Golfer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{formAction === 'create' ? 'Add New Golfer' : 'Edit Golfer'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Golfer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Rory McIlroy" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="rank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>World Rank</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g. 1" 
                        value={field.value === undefined ? '' : field.value} 
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="avatar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avatar URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/avatar.jpg" 
                        {...field} 
                        value={field.value || ''} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit">
                  {formAction === 'create' ? 'Add Golfer' : 'Save Changes'}
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
            <AlertDialogTitle>Delete Golfer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedGolfer?.name}"? This action cannot be undone.
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
