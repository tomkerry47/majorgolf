import { useState, useEffect, useMemo } from "react"; // Combined imports
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
// Remove Select imports, add Combobox import
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox"; // Import Combobox
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
// Import Competition type
import { selectionFormSchema, type InsertSelection, type Golfer, type Selection, type Competition } from "@shared/schema";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import type { Control } from "react-hook-form"; // Import Control type

interface SelectionFormProps {
  competitionId: number;
  competitionName: string;
  selectionDeadline: string;
  onSuccess?: () => void;
}

// Define props for the inner content component
interface SelectionFormContentProps extends SelectionFormProps {
  form: ReturnType<typeof useForm<InsertSelection>>;
  golfers: Golfer[];
  existingSelection: Selection | null | undefined;
  captainChipStatus: { hasUsedCaptainsChip: boolean } | undefined;
  defaultValues: Partial<InsertSelection>; // Add defaultValues prop
  isLoadingSelection: boolean;
  isLoadingGolfers: boolean;
  isLoadingChipStatus: boolean;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  showCaptainSelector: boolean;
  setShowCaptainSelector: React.Dispatch<React.SetStateAction<boolean>>;
  mutation: ReturnType<typeof useMutation<any, any, InsertSelection>>; // Adjust types as needed
  // Add types for new data passed down
  allUserSelections: Selection[];
  // Remove competition props
  // allCompetitions: Competition[];
  // currentCompetition: Competition | undefined;
  isLoadingAllSelections: boolean; // Pass loading states too
  // Remove competition loading props
  // isLoadingAllCompetitions: boolean;
  // isLoadingCurrentCompetition: boolean;
}


export default function SelectionForm(props: SelectionFormProps) {
  const { competitionId } = props; // Destructure competitionId early
  const { toast } = useToast(); // Keep toast hook here if needed for mutation setup
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // State hooks remain in the parent
  const [isEditing, setIsEditing] = useState(false);
  const [showCaptainSelector, setShowCaptainSelector] = useState(false);

  // --- All Query Hooks remain in the parent ---
  const { data: existingSelection, isLoading: isLoadingSelection } = useQuery<Selection | null>({
    queryKey: ['/api/selections', competitionId], // Use competitionId in queryKey
    queryFn: () => apiRequest<Selection | null>(`/api/selections/${competitionId}`), // Fetch specific selection
    enabled: !!user && !!competitionId, // Only run if user and competitionId are available
    retry: false, // Don't retry if selection not found (404)
  });

  // Fetch user's captain chip status
  const { data: captainChipStatus, isLoading: isLoadingChipStatus } = useQuery<{ hasUsedCaptainsChip: boolean }>({
    queryKey: ['/api/users/me/has-used-captains-chip'], // Endpoint to check chip status for current user
    enabled: !!user, // Only run if user is logged in
  });

  // Fetch golfers - Updated to expect { golfers: [...] } and select the array
  const { data: golfers = [], isLoading: isLoadingGolfers } = useQuery<{ golfers: Golfer[] }, Error, Golfer[]>({
    queryKey: ['/api/golfers'],
    queryFn: () => apiRequest<{ golfers: Golfer[] }>('/api/golfers'),
    // More defensive select: ensure data exists and has the golfers property which is an array
    select: (data) => (data && Array.isArray(data.golfers) ? data.golfers : []),
  });

  // Fetch ALL user selections
  const { data: allUserSelections = [], isLoading: isLoadingAllSelections } = useQuery<Selection[]>({
    queryKey: ['/api/selections/my-all'],
    queryFn: () => apiRequest<Selection[]>('/api/selections/my-all'),
    enabled: !!user,
  });

  // Remove fetches for allCompetitions and currentCompetition


  // --- useForm hook remains in the parent ---
  // Memoize defaultValues to prevent unnecessary re-renders/effect triggers
  const defaultValues = useMemo<Partial<InsertSelection>>(() => ({
    competitionId: competitionId,
    golfer1Id: 0,
    golfer2Id: 0,
    golfer3Id: 0,
    useCaptainsChip: false,
    captainGolferId: undefined,
  }), [competitionId]); // Depend on competitionId

  const form = useForm<InsertSelection>({
    resolver: zodResolver(selectionFormSchema),
    defaultValues,
  });

  // --- Mutation hook remains in the parent (needs toast, queryClient) ---
   const mutation = useMutation({
    mutationFn: (data: InsertSelection) => {
      const payload = {
        ...data,
        // Ensure captainGolferId is only sent if useCaptainsChip is true
        captainGolferId: data.useCaptainsChip ? data.captainGolferId : undefined,
      };
      // Use isEditing state from parent
      if (isEditing && existingSelection) {
        return apiRequest(`/api/selections/${competitionId}`, 'PATCH', payload);
      } else {
        return apiRequest('/api/selections', 'POST', payload);
      }
    },
    onSuccess: () => {
      toast({
        title: `Selection ${isEditing ? 'Updated' : 'Submitted'}`,
        description: `Your selections for ${props.competitionName} have been saved.`, // Use props
      });
      queryClient.invalidateQueries({ queryKey: ['/api/selections', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/selections/my-all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/has-used-captains-chip'] });
      if (props.onSuccess) props.onSuccess(); // Use props
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: `Error ${isEditing ? 'Updating' : 'Submitting'} Selection`,
        description: error.message || "An unexpected error occurred.",
      });
    },
  });
  // --- End Mutation Hook ---

  // Update loading state check to include new queries
  if (
    isLoadingSelection ||
    isLoadingGolfers ||
    isLoadingChipStatus ||
    isLoadingAllSelections // Remove competition loading states
    // isLoadingAllCompetitions ||
    // isLoadingCurrentCompetition
  ) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    );
  }

  // Render the inner component, passing down all necessary state and data
  return (
    <SelectionFormContent
      {...props} // Pass original props
      form={form}
      golfers={golfers}
      existingSelection={existingSelection}
      captainChipStatus={captainChipStatus}
      isLoadingSelection={isLoadingSelection}
      isLoadingGolfers={isLoadingGolfers}
      isLoadingChipStatus={isLoadingChipStatus}
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      showCaptainSelector={showCaptainSelector}
      setShowCaptainSelector={setShowCaptainSelector}
      mutation={mutation}
      defaultValues={defaultValues} // Pass defaultValues down
      // Pass new data and loading states
      allUserSelections={allUserSelections}
      // Remove competition props
      // allCompetitions={allCompetitions}
      // currentCompetition={currentCompetition}
      isLoadingAllSelections={isLoadingAllSelections}
      // Remove competition loading props
      // isLoadingAllCompetitions={isLoadingAllCompetitions}
      // isLoadingCurrentCompetition={isLoadingCurrentCompetition}
    />
  );
}


// --- Inner Component for Content Logic and Rendering ---
function SelectionFormContent({
  competitionId,
  competitionName,
  selectionDeadline,
  onSuccess,
  form,
  golfers,
  existingSelection,
  captainChipStatus,
  isLoadingSelection,
  isLoadingGolfers,
  isLoadingChipStatus,
  isEditing,
  setIsEditing,
  showCaptainSelector,
  setShowCaptainSelector,
  mutation,
  defaultValues, // Destructure defaultValues from props
  // Destructure new props
  allUserSelections,
  isLoadingAllSelections // Destructure loading states
  // Remove competition props destructuring
  // allCompetitions,
  // currentCompetition,
  // isLoadingAllCompetitions,
  // isLoadingCurrentCompetition
}: SelectionFormContentProps) {

  // --- Logic & Hooks specific to content rendering ---
  const deadlinePassed = new Date() > new Date(selectionDeadline);
  // Use passed-in status/selection
  const hasUsedChip = captainChipStatus?.hasUsedCaptainsChip ?? false;
  const canUseChip = !hasUsedChip || (isEditing && existingSelection?.useCaptainsChip);

  // useMemo hooks are now inside the inner component

  // Calculate filtered golfer options based on ALL previous selections
  const filteredGolferOptions = useMemo(() => {
    // Simplified check: only need golfers and allUserSelections
    if (!golfers || !Array.isArray(golfers) || !allUserSelections) {
      return [];
    }

    // Get golfer IDs selected in ANY past competition (excluding the current one)
    const previouslySelectedGolferIds = new Set<number>();
    allUserSelections.forEach(selection => {
      // Only consider selections from *other* competitions
      if (selection.competitionId !== competitionId) {
        if (selection.golfer1Id) previouslySelectedGolferIds.add(selection.golfer1Id);
        if (selection.golfer2Id) previouslySelectedGolferIds.add(selection.golfer2Id);
        if (selection.golfer3Id) previouslySelectedGolferIds.add(selection.golfer3Id);
        if (selection.captainGolferId) previouslySelectedGolferIds.add(selection.captainGolferId);
      }
    });

    // Get the IDs of golfers currently selected in *this* form (if editing)
    const currentlySelectedInThisForm = new Set<number>();
    if (isEditing && existingSelection) {
        if (existingSelection.golfer1Id) currentlySelectedInThisForm.add(existingSelection.golfer1Id);
        if (existingSelection.golfer2Id) currentlySelectedInThisForm.add(existingSelection.golfer2Id);
        if (existingSelection.golfer3Id) currentlySelectedInThisForm.add(existingSelection.golfer3Id);
        if (existingSelection.captainGolferId) currentlySelectedInThisForm.add(existingSelection.captainGolferId);
    }


    // Filter the main golfer list
    const availableGolfers = golfers.filter(golfer => {
      // Allow if the golfer is part of the current selection being edited
      if (isEditing && currentlySelectedInThisForm.has(golfer.id)) {
        return true;
      }
      // Otherwise, exclude if they were selected in a previous competition of the same type
      return !previouslySelectedGolferIds.has(golfer.id);
    });

    // Map to the format needed by the Combobox
    return availableGolfers.map(golfer => ({
      value: golfer.id,
      label: `${golfer.firstName} ${golfer.lastName} ${golfer.rank ? `(#${golfer.rank})` : ''}`
    }));
    // Dependencies: golfers list, all user selections, current competitionId, editing state, and existing selection
  }, [golfers, allUserSelections, competitionId, isEditing, existingSelection]);


  // Watch relevant fields for captain options dependency
  const watchedGolfer1Id = form.watch('golfer1Id');
  const watchedGolfer2Id = form.watch('golfer2Id');
  const watchedGolfer3Id = form.watch('golfer3Id');

  // Prepare options for captain based on current selections
  const captainOptions = useMemo(() => {
    // Calculate selectedGolferIds inside useMemo using getValues
    const currentSelectedGolferIds = [
      form.getValues('golfer1Id'),
      form.getValues('golfer2Id'),
      form.getValues('golfer3Id')
    ].filter(id => id && id > 0);

    if (!golfers || !Array.isArray(golfers)) return [];
    return golfers
      .filter(g => currentSelectedGolferIds.includes(g.id)) // Use the calculated IDs
      .map(golfer => ({
        value: golfer.id,
        label: `${golfer.firstName} ${golfer.lastName} ${golfer.rank ? `(#${golfer.rank})` : ''}`
      }));
  // Depend on golfers and the watched values from the parent form instance
  }, [golfers, watchedGolfer1Id, watchedGolfer2Id, watchedGolfer3Id, form]);

  // Watch the specific field value for the checkbox state
  const watchedUseCaptainsChip = form.watch('useCaptainsChip');

  // useEffect hooks are now inside the inner component
  useEffect(() => {
    if (existingSelection) {
      form.reset({
        competitionId: existingSelection.competitionId,
        golfer1Id: existingSelection.golfer1Id || 0,
        golfer2Id: existingSelection.golfer2Id || 0,
        golfer3Id: existingSelection.golfer3Id || 0,
        useCaptainsChip: existingSelection.useCaptainsChip || false,
        captainGolferId: existingSelection.captainGolferId || undefined,
      });
      setIsEditing(true); // We are editing an existing selection
      setShowCaptainSelector(existingSelection.useCaptainsChip || false); // Show captain selector if chip was used
    } else {
      // Reset to defaults if no existing selection (e.g., navigating between competitions)
      form.reset(defaultValues);
      setIsEditing(false);
      setShowCaptainSelector(false);
    }
    // Revert: Add setters back to dependency array
  }, [existingSelection, competitionId, setIsEditing, setShowCaptainSelector]);

   // Update captain selector visibility based on the watched checkbox value
   useEffect(() => {
     // Update the state based on the watched value
     setShowCaptainSelector(!!watchedUseCaptainsChip);

     // Reset captainGolferId if checkbox is unchecked
     if (!watchedUseCaptainsChip) {
       // Use shouldValidate: true if you want validation to re-run after reset
       form.setValue('captainGolferId', undefined, { shouldValidate: true });
     }
   // Revert: Add form back to dependency array
   }, [watchedUseCaptainsChip, setShowCaptainSelector, form]);

  // onSubmit logic is now inside the inner component
  const onSubmit = (data: InsertSelection) => {
    // Ensure captain is selected if chip is used
    if (data.useCaptainsChip && !data.captainGolferId) {
       form.setError("captainGolferId", { type: "manual", message: "Please select your captain." });
       return;
    }
     // Ensure captain is one of the selected golfers
     if (data.useCaptainsChip && data.captainGolferId) {
       const selectedIds = [data.golfer1Id, data.golfer2Id, data.golfer3Id];
       if (!selectedIds.includes(data.captainGolferId)) {
         form.setError("captainGolferId", { type: "manual", message: "Captain must be one of your selected golfers." });
         return;
       }
     }
    // Use mutation passed from parent
    mutation.mutate(data);
  };

  // Conditional returns are now inside the inner component
  // Remove the loading check here as it's handled in the parent
  /*
  if (isLoadingSelection || isLoadingGolfers || isLoadingChipStatus) { // This check is now redundant
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    );
  }
  */

  // Removed the block that hid the form entirely after deadline if !isEditing
  // The form fields will now always render but be disabled if deadlinePassed.

  // Calculate selectedGolferIds needed for disabling combobox
  const selectedGolferIds = [watchedGolfer1Id, watchedGolfer2Id, watchedGolfer3Id].filter(id => id && id > 0);

  // Return the JSX from the inner component
  return (
    <Card>
      <CardHeader>
        {/* Show title based on whether a selection exists */}
        <CardTitle>{existingSelection ? 'Your Selection' : 'Make Your Selections'}</CardTitle>
        <CardDescription>For {competitionName}. Deadline: {new Date(selectionDeadline).toLocaleString()}</CardDescription>
        {/* Show deadline passed alert if applicable, regardless of editing state */}
        {deadlinePassed && (
           <Alert variant="default" className="mt-2 border-yellow-500 text-yellow-800">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Deadline Passed</AlertTitle>
             <AlertDescription>
               The selection deadline has passed. You can view your selection but cannot make changes.
             </AlertDescription>
           </Alert>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="golfer1Id"
                render={({ field }) => (
                  <FormItem className="flex flex-col"> {/* Ensure proper layout */}
                    <FormLabel>Selection 1</FormLabel>
                    <Combobox
                      options={filteredGolferOptions} // Use filtered options
                      value={field.value} // Use field.value directly
                      onChange={field.onChange} // Pass field.onChange directly
                      placeholder="Select Golfer 1"
                      searchPlaceholder="Search golfer..."
                      emptyText="No golfer found."
                      disabled={deadlinePassed}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="golfer2Id"
                render={({ field }) => (
                  <FormItem className="flex flex-col"> {/* Ensure proper layout */}
                    <FormLabel>Selection 2</FormLabel>
                     <Combobox
                      options={filteredGolferOptions} // Use filtered options
                      value={field.value} // Use field.value directly
                      onChange={field.onChange} // Pass field.onChange directly
                      placeholder="Select Golfer 2"
                      searchPlaceholder="Search golfer..."
                      emptyText="No golfer found."
                      disabled={deadlinePassed}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="golfer3Id"
                render={({ field }) => (
                  <FormItem className="flex flex-col"> {/* Ensure proper layout */}
                    <FormLabel>Selection 3</FormLabel>
                     <Combobox
                      options={filteredGolferOptions} // Use filtered options
                      value={field.value} // Use field.value directly
                      onChange={field.onChange} // Pass field.onChange directly
                      placeholder="Select Golfer 3"
                      searchPlaceholder="Search golfer..."
                      emptyText="No golfer found."
                      disabled={deadlinePassed}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

             {/* Captain's Chip Section */}
             <FormField
                control={form.control}
                name="useCaptainsChip"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={deadlinePassed || !canUseChip} // Disable if deadline passed or chip already used (unless editing the one where it was used)
                        id="useCaptainsChip"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel htmlFor="useCaptainsChip">
                        Use Captain's Chip? (Doubles your highest scorer's points - can only be used once!)
                      </FormLabel>
                      {!canUseChip && (
                        <p className="text-sm text-muted-foreground">
                          You have already used your Captain's Chip in another competition.
                        </p>
                      )}
                    </div>
                  </FormItem>
                )}
              />

             {/* Captain's Chip Section - Always render, control visibility via prop */}
             <CaptainCombobox
                  show={showCaptainSelector && (canUseChip ?? false)} // Ensure show is always boolean
                  control={form.control}
                  name="captainGolferId"
                  options={captainOptions}
                  disabled={deadlinePassed || selectedGolferIds.length === 0}
                  emptyText={selectedGolferIds.length > 0 ? "No selected golfer found." : "Select golfers first."}
             />


            {!deadlinePassed && (
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isEditing ? 'Update Selection' : 'Submit Selection'}
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


// --- Standalone CaptainCombobox Component (Remains the same) ---
interface CaptainComboboxProps {
  show: boolean; // New prop to control rendering
  control: Control<InsertSelection>; // Use Control type from react-hook-form
  name: "captainGolferId"; // Ensure the name is correct
  options: { value: number; label: string }[];
  disabled: boolean;
  emptyText: string;
}

const CaptainCombobox = ({ show, control, name, options, disabled, emptyText }: CaptainComboboxProps) => {
  // Return null if not supposed to be shown
  if (!show) {
    return null;
  }

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>Select Captain</FormLabel>
          <Combobox
            options={options}
            value={field.value || ""}
            onChange={field.onChange} // Pass field.onChange directly
            placeholder="Select Captain"
            searchPlaceholder="Search selected golfer..."
            emptyText={emptyText}
            disabled={disabled}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
// --- End Standalone Component ---
