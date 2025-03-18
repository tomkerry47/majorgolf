import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { insertCompetitionSchema, type InsertCompetition } from "@shared/schema";
import { Switch } from "@/components/ui/switch";

export default function AdminCompetitions() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<any>(null);
  const [formAction, setFormAction] = useState<'create' | 'edit'>('create');
  const [isCreatingTournaments, setIsCreatingTournaments] = useState(false);
  
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['/api/admin/competitions'],
  });
  
  const defaultValues: Partial<InsertCompetition> = {
    name: '',
    venue: '',
    startDate: '',
    endDate: '',
    selectionDeadline: '',
    isActive: false,
    isComplete: false
  };
  
  const form = useForm<InsertCompetition>({
    resolver: zodResolver(insertCompetitionSchema),
    defaultValues
  });
  
  const openCreateDialog = () => {
    form.reset(defaultValues);
    setFormAction('create');
    setSelectedCompetition(null);
    setIsDialogOpen(true);
  };
  
  const openEditDialog = (competition: any) => {
    const formattedCompetition = {
      ...competition,
      startDate: new Date(competition.startDate).toISOString().slice(0, 16),
      endDate: new Date(competition.endDate).toISOString().slice(0, 16),
      selectionDeadline: new Date(competition.selectionDeadline).toISOString().slice(0, 16)
    };
    
    form.reset(formattedCompetition);
    setFormAction('edit');
    setSelectedCompetition(competition);
    setIsDialogOpen(true);
  };
  
  const openDeleteDialog = (competition: any) => {
    setSelectedCompetition(competition);
    setIsDeleteDialogOpen(true);
  };
  
  const onSubmit = async (data: InsertCompetition) => {
    try {
      if (formAction === 'create') {
        await apiRequest('POST', '/api/competitions', data);
        toast({
          title: "Competition created",
          description: "The competition has been successfully created."
        });
      } else {
        await apiRequest('PATCH', `/api/admin/competitions/${selectedCompetition.id}`, data);
        toast({
          title: "Competition updated",
          description: "The competition has been successfully updated."
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/competitions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions/upcoming'] });
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
      await apiRequest('DELETE', `/api/admin/competitions/${selectedCompetition.id}`, {});
      toast({
        title: "Competition deleted",
        description: "The competition has been successfully deleted."
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/competitions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions/upcoming'] });
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred."
      });
    }
  };
  
  const createMajorTournaments = async () => {
    try {
      setIsCreatingTournaments(true);
      
      const tournaments = [
        {
          name: "The Masters",
          venue: "Augusta National Golf Club",
          startDate: new Date("2025-04-10T08:00:00"),
          endDate: new Date("2025-04-13T20:00:00"),
          selectionDeadline: new Date("2025-04-09T23:59:59"),
          isActive: false,
          isComplete: false,
          description: "The Masters Tournament is played annually at Augusta National Golf Club in Augusta, Georgia. It is one of the four major championships in professional golf.",
          imageUrl: "https://www.masters.com/images/pics/large/masters_logo_meta.jpg"
        },
        {
          name: "PGA Championship",
          venue: "Quail Hollow Club",
          startDate: new Date("2025-05-15T08:00:00"),
          endDate: new Date("2025-05-18T20:00:00"),
          selectionDeadline: new Date("2025-05-14T23:59:59"),
          isActive: false,
          isComplete: false,
          description: "The PGA Championship is one of golf's four major championships. Since 2019, it has been played in May, making it the second major of the golf season.",
          imageUrl: "https://www.pgachampionship.com/assets/images/pgachampionship-logo.png"
        },
        {
          name: "U.S. Open",
          venue: "Pinehurst Resort",
          startDate: new Date("2025-06-12T08:00:00"),
          endDate: new Date("2025-06-15T20:00:00"),
          selectionDeadline: new Date("2025-06-11T23:59:59"),
          isActive: false,
          isComplete: false,
          description: "The United States Open Championship is the annual open national championship of golf in the United States. It is the third of the four major championships.",
          imageUrl: "https://www.usopen.com/content/dam/usopen/logo/us-open-championship-logo.svg"
        },
        {
          name: "The Open Championship",
          venue: "Royal Liverpool Golf Club", 
          startDate: new Date("2025-07-17T08:00:00"),
          endDate: new Date("2025-07-20T20:00:00"),
          selectionDeadline: new Date("2025-07-16T23:59:59"),
          isActive: false,
          isComplete: false,
          description: "The Open Championship, often referred to as The Open or the British Open, is the oldest golf tournament in the world. It is one of the four major championships.",
          imageUrl: "https://www.theopen.com/assets/site/logos/the-open-logo-white.svg"
        },
        {
          name: "The Players Championship",
          venue: "TPC Sawgrass",
          startDate: new Date("2025-03-13T08:00:00"),
          endDate: new Date("2025-03-16T20:00:00"),
          selectionDeadline: new Date("2025-03-12T23:59:59"),
          isActive: true,
          isComplete: false,
          description: "The Players Championship is an annual golf tournament on the PGA Tour. Originally known as the Tournament Players Championship, it is often regarded as golf's fifth major.",
          imageUrl: "https://www.theplayers.com/content/dam/pga/tournaments/tournament-sites/the-players-championship/the-players-logo.svg"
        }
      ];
      
      let successCount = 0;
      
      for (const tournament of tournaments) {
        try {
          // Convert dates to ISO strings for API submission
          const formattedTournament = {
            ...tournament,
            startDate: tournament.startDate.toISOString(),
            endDate: tournament.endDate.toISOString(),
            selectionDeadline: tournament.selectionDeadline.toISOString()
          };
          
          await apiRequest('POST', '/api/competitions', formattedTournament);
          successCount++;
        } catch (error: any) {
          console.error(`Error creating ${tournament.name}:`, error);
        }
      }
      
      if (successCount > 0) {
        toast({
          title: "Tournaments Created",
          description: `Successfully created ${successCount} of 5 major tournaments.`
        });
        
        queryClient.invalidateQueries({ queryKey: ['/api/admin/competitions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/competitions'] });
        queryClient.invalidateQueries({ queryKey: ['/api/competitions/all'] });
        queryClient.invalidateQueries({ queryKey: ['/api/competitions/active'] });
        queryClient.invalidateQueries({ queryKey: ['/api/competitions/upcoming'] });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create any tournaments. Please check the console for errors."
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while creating tournaments."
      });
    } finally {
      setIsCreatingTournaments(false);
    }
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Competitions</CardTitle>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={createMajorTournaments} 
            disabled={isCreatingTournaments}
          >
            {isCreatingTournaments ? 'Creating...' : 'Create 5 Major Tournaments'}
          </Button>
          <Button onClick={openCreateDialog}>
            <i className="fas fa-plus mr-2"></i>
            Add Competition
          </Button>
        </div>
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
                <TableHead>Venue</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                    No competitions found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                competitions?.map((competition) => (
                  <TableRow key={competition.id}>
                    <TableCell className="font-medium">{competition.name}</TableCell>
                    <TableCell>{competition.venue}</TableCell>
                    <TableCell>
                      {new Date(competition.startDate).toLocaleDateString()} - {new Date(competition.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{new Date(competition.selectionDeadline).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {competition.isComplete ? (
                        <Badge variant="outline" className="bg-slate-100 text-slate-800">Completed</Badge>
                      ) : competition.isActive ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-primary/10 text-primary">Upcoming</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(competition)}>
                        <i className="fas fa-edit mr-1"></i> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(competition)}>
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
      
      {/* Create/Edit Competition Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{formAction === 'create' ? 'Create New Competition' : 'Edit Competition'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Competition Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. The Masters 2023" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="venue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Augusta National Golf Club" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="selectionDeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selection Deadline</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter a description of the tournament..." 
                        className="resize-none h-20"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tournament Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/logo.png" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-3 border rounded-md">
                      <FormLabel>Active</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isComplete"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-3 border rounded-md">
                      <FormLabel>Completed</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button type="submit">
                  {formAction === 'create' ? 'Create Competition' : 'Save Changes'}
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
            <AlertDialogTitle>Delete Competition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCompetition?.name}"? This action cannot be undone.
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
