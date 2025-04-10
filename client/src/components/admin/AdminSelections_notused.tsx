import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react"; // Import icons

import { cn } from "@/lib/utils"; // Import cn utility
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select as ShadSelect, // Rename original Select to avoid conflict
  SelectContent as ShadSelectContent,
  SelectItem as ShadSelectItem,
  SelectTrigger as ShadSelectTrigger,
  SelectValue as ShadSelectValue,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList, // Import CommandList
} from "@/components/ui/command"; // Import Command components
import { selectionFormSchema, type InsertSelection, type Golfer, type Competition, type User } from "@shared/schema";

export default function AdminSelections() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSelection, setSelectedSelection] = useState<SelectionWithDetails | null>(null); // For editing/deleting
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null); // User ID for filtering or creating
  const [useWaiver, setUseWaiver] = useState(false); // State for waiver checkbox
  const [currentUserData, setCurrentUserData] = useState<User | null>(null); // State for the user being edited/created for
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null); // State for dialog mode

  // Define type for selection with user and golfer data
  interface SelectionWithDetails {
    id: number;
    competitionId: number;
    userId: number;
    golfer1Id: number;
    golfer2Id: number;
    golfer3Id: number;
    createdAt: string;
    updatedAt: string;
    user?: { id: number; username: string; email: string };
    golfer1?: { id: number; name: string };
    golfer2?: { id: number; name: string };
    golfer3?: { id: number; name: string };
  }

  // Get all competitions
  const { data: competitions = [], isLoading: isLoadingCompetitions } = useQuery<Competition[]>({
    queryKey: ['/api/competitions'],
  });

  // Get all users (now includes waiver details)
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  // Get selections for selected competition
  const { data: selections, isLoading: isLoadingSelections, isSuccess } = useQuery<SelectionWithDetails[] | null>({ // Allow null return type, get isSuccess
    queryKey: [`/api/admin/competitions/${selectedCompetition}/selections`],
    enabled: !!selectedCompetition,
    // Explicitly use apiRequest which handles 404s by returning null
    queryFn: ({ queryKey }) => apiRequest<SelectionWithDetails[] | null>(queryKey[0] as string), 
    initialData: null, // Start with null instead of [] to be explicit
  });

  // Get all golfers for the form
  const { data: golfers = [], isLoading: isLoadingGolfers } = useQuery<Golfer[]>({
    queryKey: ['/api/golfers'],
  });

  // Check if a selection exists for the currently selected user and competition
  // This calculation is done here but re-checked within the render logic for the button/table
  const selectionExistsForCurrentUser = !!( 
    selectedUser !== null &&
    selectedCompetition !== null &&
    selections && 
    selections.some(selection => selection.userId === selectedUser && selection.competitionId === selectedCompetition)
  );

  // --- Add Diagnostic Logging Effect ---
  useEffect(() => {
    // This log helps track state changes
    console.log("[AdminSelections Effect State]", {
      selectedCompetition,
      selectedUser,
      isLoadingSelections,
      isSuccess, 
      selectionExistsForCurrentUser, // Log the calculated value
      selectionsData: selections, 
    });
  }, [selectedCompetition, selectedUser, isLoadingSelections, isSuccess, selectionExistsForCurrentUser, selections]);
  // --- End Diagnostic Logging Effect ---


  const defaultValues: InsertSelection = {
    competitionId: selectedCompetition || 0,
    userId: selectedUser || 0,
    golfer1Id: 0,
    golfer2Id: 0,
    golfer3Id: 0,
    // Note: userId and competitionId will be set dynamically when opening dialog
  };

  const form = useForm<InsertSelection>({
    resolver: zodResolver(selectionFormSchema),
    defaultValues // Default values are minimal, will be reset on dialog open
  });

  // Function to open dialog for editing an existing selection
  const openEditDialog = (selection: SelectionWithDetails) => {
    setFormMode('edit');
    setSelectedSelection(selection); // Store the selection being edited
    const userForSelection = users.find(u => u.id === selection.userId);
    setCurrentUserData(userForSelection || null);
    setUseWaiver(false); // Reset waiver checkbox
    form.reset({
      competitionId: selection.competitionId,
      userId: selection.userId, // Set user ID for the form
      golfer1Id: selection.golfer1Id, // Populate with existing golfer IDs
      golfer2Id: selection.golfer2Id,
      golfer3Id: selection.golfer3Id
    });
    setIsDialogOpen(true);
  };

  // Function to open dialog for creating a new selection
  const openCreateDialog = () => {
    if (!selectedCompetition || !selectedUser) {
      toast({ variant: "destructive", title: "Error", description: "Please select a competition and a user first." });
      return;
    }
    setFormMode('create');
    setSelectedSelection(null); // No selection is being edited
    const userForSelection = users.find(u => u.id === selectedUser);
    setCurrentUserData(userForSelection || null);
    setUseWaiver(false); // Waiver not applicable for creation
    form.reset({
      competitionId: selectedCompetition, // Pre-fill competition ID
      userId: selectedUser, // Pre-fill user ID
      golfer1Id: 0, // Reset golfer IDs
      golfer2Id: 0,
      golfer3Id: 0
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (selection: SelectionWithDetails) => {
    setSelectedSelection(selection);
    setIsDeleteDialogOpen(true);
  };

  // --- TEST FUNCTION for Direct API Call ---
  const handleDirectApiCall = async () => {
    if (!selectedSelection) {
      toast({ variant: "destructive", title: "Error", description: "No selection selected for test." });
      return;
    }
    // Get current form values directly
    const currentFormData = form.getValues();
    console.log("[handleDirectApiCall] Form data:", currentFormData);

    // Construct payload manually (similar to onSubmit)
    let payload: any = { ...currentFormData };
     if (useWaiver) {
        let changes = 0;
        let updatedGolferSlot: number | null = null;
        let newGolferId: number | null = null;
        if (currentFormData.golfer1Id !== selectedSelection.golfer1Id) { changes++; updatedGolferSlot = 1; newGolferId = currentFormData.golfer1Id; }
        if (currentFormData.golfer2Id !== selectedSelection.golfer2Id) { changes++; updatedGolferSlot = 2; newGolferId = currentFormData.golfer2Id; }
        if (currentFormData.golfer3Id !== selectedSelection.golfer3Id) { changes++; updatedGolferSlot = 3; newGolferId = currentFormData.golfer3Id; }

        if (changes !== 1) {
          toast({ variant: "destructive", title: "Waiver Error", description: "Waiver chip can only be used when swapping exactly one golfer." });
          return;
        }
        payload = { ...currentFormData, isWaiverChipTransaction: true, updatedGolferSlot: updatedGolferSlot, newGolferId: newGolferId };
      } else {
         payload = { ...currentFormData, isWaiverChipTransaction: false };
      }

    console.log("[handleDirectApiCall] Payload:", payload);

    try {
      const apiUrl = `/api/admin/selections/${selectedSelection.id}`;
      const apiMethod = 'PATCH';
      console.log(`[handleDirectApiCall] Calling apiRequest: URL='${apiUrl}', Method='${apiMethod}'`);
      await apiRequest(apiUrl, apiMethod, payload);
      toast({ title: "Direct API Call Successful", description: "The selection update via direct call succeeded." });
      // Optionally invalidate queries and close dialog if successful
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/competitions/${selectedCompetition}/selections`] });
      setIsDialogOpen(false);
      setUseWaiver(false);
    } catch (error: any) {
      console.error("[handleDirectApiCall Error]", error);
      toast({
        variant: "destructive",
        title: "Direct API Call Error",
        description: error.message || "An error occurred during the direct API call."
      });
    }
  };
  // --- END TEST FUNCTION ---

  const onSubmit = async (data: InsertSelection) => {
    try {
      let apiUrl = '';
      let apiMethod: 'POST' | 'PATCH' = 'PATCH'; // Default to PATCH for edit
      let payload: any = { ...data };
      let successMessage = "Selection updated successfully.";

      if (formMode === 'create') {
        apiMethod = 'POST';
        // Assuming an admin endpoint exists or will be created for creating selections
        // If not, this might need adjustment based on backend capabilities.
        // Let's assume '/api/admin/selections' for now.
        apiUrl = '/api/admin/selections'; 
        payload = { ...data }; // Simple payload for creation
        successMessage = "Selection created successfully.";
        // Waiver chip logic is not applicable for creation
      } else if (formMode === 'edit' && selectedSelection) {
        apiUrl = `/api/admin/selections/${selectedSelection.id}`;
        apiMethod = 'PATCH';
        
        // Waiver chip logic only applies to edits
        if (useWaiver) {
          let changes = 0;
          let updatedGolferSlot: number | null = null;
          let newGolferId: number | null = null;
          if (data.golfer1Id !== selectedSelection.golfer1Id) { changes++; updatedGolferSlot = 1; newGolferId = data.golfer1Id; }
          if (data.golfer2Id !== selectedSelection.golfer2Id) { changes++; updatedGolferSlot = 2; newGolferId = data.golfer2Id; }
          if (data.golfer3Id !== selectedSelection.golfer3Id) { changes++; updatedGolferSlot = 3; newGolferId = data.golfer3Id; }

          if (changes !== 1) {
            toast({ variant: "destructive", title: "Waiver Error", description: "Waiver chip can only be used when swapping exactly one golfer." });
            return; // Stop submission
          }
          payload = { ...data, isWaiverChipTransaction: true, updatedGolferSlot: updatedGolferSlot, newGolferId: newGolferId };
        } else {
          payload = { ...data, isWaiverChipTransaction: false }; // Ensure flag is false if checkbox unchecked
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "Invalid form state." });
        return;
      }

      // Make the API request
      await apiRequest(apiUrl, apiMethod, payload);

      toast({ title: formMode === 'create' ? "Selection Created" : "Selection Updated", description: successMessage });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] }); // In case waiver status changed
      queryClient.invalidateQueries({ queryKey: [`/api/admin/competitions/${selectedCompetition}/selections`] });
      
      setIsDialogOpen(false);
      setFormMode(null); // Reset form mode
      setUseWaiver(false); // Reset waiver state
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
      if (!selectedSelection) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No selection selected."
        });
        return;
      }

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

  // --- Add Diagnostic Logging ---
  // Keep this log to see the state on each render
  // Note: selectionExistsForCurrentUser is calculated before this log now
  console.log("[AdminSelections Render State]", {
    selectedCompetition,
    selectedUser,
    isLoadingSelections,
    selectionExistsForCurrentUser,
    selectionsCount: selections?.length,
    // It's important that selectionsCount is > 0 if selectionExistsForCurrentUser is true,
    // but selectionExistsForCurrentUser could be false even if selectionsCount > 0 (if selections are for other users).
  });
  // --- End Diagnostic Logging ---

  // Calculate filtered selections and message states before returning JSX
  const filteredSelections = selectedUser !== null && selections
    ? selections.filter(selection => selection.userId === selectedUser)
    : selections; 

  const shouldShowNoSelectionsMessage = 
      selectedUser !== null && 
      !isLoadingSelections && 
      isSuccess && 
      selections !== null && 
      filteredSelections?.length === 0;

  // Add a specific check for the overall competition having no selections when no user is filtered
  const shouldShowNoSelectionsForCompMessage = 
      selectedUser === null && 
      !isLoadingSelections && 
      isSuccess && 
      selections !== null && 
      selections.length === 0;

  // Check for loading error state
  const hasLoadingError = !isLoadingSelections && (!isSuccess || selections === null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage User Selections</CardTitle>
        {/* Moved button container below */}
        <div className="flex gap-2 items-center">
          <ShadSelect // Use renamed ShadSelect
            value={selectedCompetition?.toString() || ""}
            onValueChange={(value) => setSelectedCompetition(parseInt(value))}
          >
            <ShadSelectTrigger className="w-[240px]">
              <ShadSelectValue placeholder="Select a competition" />
            </ShadSelectTrigger>
            <ShadSelectContent>
              {isLoadingCompetitions ? (
                <div className="py-2 text-center text-sm text-gray-500">Loading...</div>
              ) : competitions?.length === 0 ? (
                <div className="py-2 text-center text-sm text-gray-500">No competitions found</div>
              ) : (
                competitions?.map((competition) => {
                  let statusLabel = '';
                  if (competition.isComplete) {
                    statusLabel = '(Completed)';
                  } else if (competition.isActive) {
                    statusLabel = '(Active)';
                  } else {
                    statusLabel = '(Upcoming)';
                  }
                  return (
                    <ShadSelectItem key={competition.id} value={competition.id.toString()}>
                      {competition.name} {statusLabel}
                    </ShadSelectItem>
                  );
                })
              )}
            </ShadSelectContent>
          </ShadSelect>

          <ShadSelect // Use renamed ShadSelect
            value={selectedUser?.toString() || "0"}
            onValueChange={(value) => setSelectedUser(value === "0" ? null : parseInt(value))}
          >
            <ShadSelectTrigger className="w-[240px]">
              <ShadSelectValue placeholder="Filter by user (optional)" />
            </ShadSelectTrigger>
            <ShadSelectContent>
              <ShadSelectItem value="0">All Users</ShadSelectItem>
              {isLoadingUsers ? (
                <div className="py-2 text-center text-sm text-gray-500">Loading...</div>
              ) : users?.length === 0 ? (
                <div className="py-2 text-center text-sm text-gray-500">No users found</div>
              ) : (
                users?.map((user) => (
                  <ShadSelectItem key={user.id} value={user.id.toString()}>
                    {user.username}
                  </ShadSelectItem>
                ))
              )}
            </ShadSelectContent>
          </ShadSelect>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add Selection Button - Condition uses pre-calculated boolean */}
        {/* Show if Comp/User selected, query succeeded, not loading, AND the 'no selections for user' message should be shown */}
        {selectedCompetition !== null && selectedUser !== null && isSuccess && !isLoadingSelections && shouldShowNoSelectionsMessage && (
          <div className="mb-4"> 
            <Button onClick={openCreateDialog} size="sm">
              <i className="fas fa-plus mr-1"></i> Add Selection for {users.find(u => u.id === selectedUser)?.username || 'Selected User'}
            </Button>
          </div>
        )}
        
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
        ) : !isSuccess || selections === null ? ( // Handle loading error or null data after loading
           <div className="text-center py-10 text-gray-500">
             Error loading selections. Please try again.
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
              {/* Use the pre-calculated booleans for the empty/error state messages */}
              {hasLoadingError ? (
                 <TableRow>
                   <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                     {'Error loading selections. Please try again.'} 
                   </TableCell>
                 </TableRow>
              ) : shouldShowNoSelectionsMessage ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                    {'This user has not made any selections for this competition.'}
                  </TableCell>
                </TableRow>
              ) : shouldShowNoSelectionsForCompMessage ? ( 
                 <TableRow>
                   <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                     {'No selections found for this competition.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSelections?.map((selection) => ( // Use filteredSelections directly
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

      {/* Create/Edit Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setFormMode(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            {/* Dynamic Dialog Title */}
            <DialogTitle>{formMode === 'create' ? 'Create New Selection' : 'Edit User Selection'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Display User and Competition - Non-editable */}
              <div className="text-sm text-gray-600 space-y-1">
                 <p><strong>User:</strong> {currentUserData?.username || 'N/A'}</p>
                 <p><strong>Competition:</strong> {competitions.find(c => c.id === selectedCompetition)?.name || 'N/A'}</p>
              </div>
              <FormField
                control={form.control}
                name="golfer1Id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Selection 1</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between", // Changed width to full
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? golfers.find(
                                  (golfer) => golfer.id === field.value
                                )?.name
                              : "Select golfer"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[450px] p-0"> {/* Adjusted width */}
                        <Command>
                          <CommandInput placeholder="Search golfer..." />
                          <CommandList> {/* Wrap items in CommandList for scrolling */}
                            <CommandEmpty>No golfer found.</CommandEmpty>
                            <CommandGroup>
                              {isLoadingGolfers ? (
                                <CommandItem disabled>Loading...</CommandItem>
                              ) : (
                                golfers?.map((golfer) => (
                                  <CommandItem
                                    value={golfer.name} // Use name for search filtering
                                    key={golfer.id}
                                    onSelect={() => {
                                      form.setValue("golfer1Id", golfer.id);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        golfer.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {golfer.name}
                                  </CommandItem>
                                ))
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Golfer 2 Combobox */}
              <FormField
                control={form.control}
                name="golfer2Id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Selection 2</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? golfers.find(
                                  (golfer) => golfer.id === field.value
                                )?.name
                              : "Select golfer"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[450px] p-0">
                        <Command>
                          <CommandInput placeholder="Search golfer..." />
                           <CommandList>
                            <CommandEmpty>No golfer found.</CommandEmpty>
                            <CommandGroup>
                              {isLoadingGolfers ? (
                                <CommandItem disabled>Loading...</CommandItem>
                              ) : (
                                golfers?.map((golfer) => (
                                  <CommandItem
                                    value={golfer.name}
                                    key={golfer.id}
                                    onSelect={() => {
                                      form.setValue("golfer2Id", golfer.id);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        golfer.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {golfer.name}
                                  </CommandItem>
                                ))
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Golfer 3 Combobox */}
              <FormField
                control={form.control}
                name="golfer3Id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Selection 3</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? golfers.find(
                                  (golfer) => golfer.id === field.value
                                )?.name
                              : "Select golfer"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[450px] p-0">
                        <Command>
                          <CommandInput placeholder="Search golfer..." />
                           <CommandList>
                            <CommandEmpty>No golfer found.</CommandEmpty>
                            <CommandGroup>
                              {isLoadingGolfers ? (
                                <CommandItem disabled>Loading...</CommandItem>
                              ) : (
                                golfers?.map((golfer) => (
                                  <CommandItem
                                    value={golfer.name}
                                    key={golfer.id}
                                    onSelect={() => {
                                      form.setValue("golfer3Id", golfer.id);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        golfer.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {golfer.name}
                                  </CommandItem>
                                ))
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Waiver Chip Checkbox - Simple div structure */}
              <div className="flex items-center space-x-2 pt-4">
                 <Checkbox
                   id="useWaiver"
                   checked={useWaiver}
                   onCheckedChange={(checked: boolean | 'indeterminate') => setUseWaiver(Boolean(checked))}
                   // Disable if creating or if user has already used waiver
                   disabled={formMode === 'create' || currentUserData?.hasUsedWaiverChip}
                 />
                 <label
                   htmlFor="useWaiver"
                   className={`text-sm font-medium leading-none ${formMode === 'create' || currentUserData?.hasUsedWaiverChip ? 'text-gray-400 cursor-not-allowed' : 'peer-disabled:cursor-not-allowed peer-disabled:opacity-70'}`}
                 >
                   Use Waiver Chip for this swap? 
                   {formMode === 'create' ? ' (N/A for new selections)' : currentUserData?.hasUsedWaiverChip ? ' (Already Used)' : ''}
                 </label>
               </div>

              <DialogFooter>
                 {/* Dynamic Submit Button Text */}
                <Button type="submit">
                  {formMode === 'create' ? 'Create Selection' : 'Save Changes'}
                </Button>
                {/* Test button removed for clarity */}
                {/* <Button type="button" variant="outline" onClick={handleDirectApiCall}> Test Direct API Call </Button> */}
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
