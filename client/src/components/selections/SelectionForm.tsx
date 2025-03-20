import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { selectionFormSchema, type InsertSelection, type Golfer, type Competition, type Selection } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface SelectionFormProps {
  competitionId: number;
  onSuccess?: () => void;
}

export default function SelectionForm({ competitionId, onSuccess }: SelectionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openPopover1, setOpenPopover1] = useState(false);
  const [openPopover2, setOpenPopover2] = useState(false);
  const [openPopover3, setOpenPopover3] = useState(false);

  // Fetch competition details
  const { data: competition, isLoading: isLoadingCompetition } = useQuery<Competition>({
    queryKey: [`/api/competitions/${competitionId}`],
  });

  // Fetch available golfers
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery<Golfer[]>({
    queryKey: ['/api/golfers'],
  });

  // Fetch existing selections if any
  const { data: existingSelections, isLoading: isLoadingSelections } = useQuery<Selection>({
    queryKey: [`/api/selections/${competitionId}`],
  });
  
  // Check if the user has already used their captain's chip
  const { data: captainsChipStatus, isLoading: isLoadingCaptainsChip } = useQuery<{ hasUsedCaptainsChip: boolean }>({
    queryKey: ['/api/users/me/has-used-captains-chip'],
  });

  // Define the extended form type
  type SelectionFormValues = InsertSelection & { captainGolferId?: number };
  
  const form = useForm<SelectionFormValues>({
    resolver: zodResolver(selectionFormSchema),
    defaultValues: {
      competitionId,
      userId: 0, // This will be set on the server
      golfer1Id: 0,
      golfer2Id: 0,
      golfer3Id: 0,
      useCaptainsChip: false,
      captainGolferId: 0, // Track which golfer is the captain (not stored in DB)
    },
  });

  // Set default values if we have existing selections
  useEffect(() => {
    if (existingSelections) {
      // Type assertion to handle properties safely
      const selection = existingSelections as unknown as InsertSelection;
      
      // Determine which golfer is the captain based on existing selections
      let captainGolferId = 0;
      if (selection.useCaptainsChip) {
        // For now, we don't know which golfer is the captain
        // In the future, we'll need to store this in the database
        captainGolferId = selection.golfer1Id;
      }
      
      form.reset({
        competitionId,
        userId: selection.userId || 0,
        golfer1Id: selection.golfer1Id || 0,
        golfer2Id: selection.golfer2Id || 0,
        golfer3Id: selection.golfer3Id || 0,
        useCaptainsChip: selection.useCaptainsChip || false,
        captainGolferId: captainGolferId,
      });
    }
  }, [existingSelections, competitionId, form]);

  async function onSubmit(data: InsertSelection & { captainGolferId?: number }) {
    setIsSubmitting(true);
    try {
      // Remove captainGolferId from data before sending to server
      // Create a new object without the captainGolferId property
      const { captainGolferId, ...selectionData } = data;
      
      if (existingSelections) {
        // Update existing selections
        await apiRequest('PATCH', `/api/selections/${competitionId}`, selectionData);
        toast({
          title: "Selections updated",
          description: "Your selections have been updated successfully.",
        });
      } else {
        // Create new selections
        await apiRequest('POST', '/api/selections', selectionData);
        toast({
          title: "Selections submitted",
          description: "Your selections have been submitted successfully.",
        });
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/selections/${competitionId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions/upcoming'] });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error submitting selections:", error);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error.message || "An error occurred while submitting your selections.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingCompetition || isLoadingGolfers || isLoadingSelections || isLoadingCaptainsChip) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-2/3 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    );
  }

  // Type guard to check if competition and its deadline are available
  const hasDeadline = competition && competition.selectionDeadline ? true : false;
  const selectionDeadline = hasDeadline && competition ? String(competition.selectionDeadline) : '';
  const isDeadlinePassed = hasDeadline ? new Date(selectionDeadline) < new Date() : false;
  
  // Sort golfers by rank
  const sortedGolfers = golfers ? [...golfers].sort((a: Golfer, b: Golfer) => {
    // Handle null or undefined ranks by placing them at the end
    if (a.rank === null || a.rank === undefined) return 1;
    if (b.rank === null || b.rank === undefined) return -1;
    return a.rank - b.rank;
  }) : [];
  
  // Helper function to find golfer name by ID
  const getGolferNameById = (id: number) => {
    const golfer = golfers?.find((g: Golfer) => g.id === id);
    return golfer ? `${golfer.name}${golfer.rank ? ` (Rank: ${golfer.rank})` : ''}` : 'Select a golfer';
  };
  
  // Helper methods for form watching with correct types
  const watchGolfer1Id = () => form.watch("golfer1Id") as number;
  const watchGolfer2Id = () => form.watch("golfer2Id") as number;
  const watchGolfer3Id = () => form.watch("golfer3Id") as number;
  const watchCaptainGolferId = () => form.watch("captainGolferId") as number;
  const watchUseCaptainsChip = () => form.watch("useCaptainsChip") as boolean;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existingSelections ? "Edit Your Selections" : "Make Your Selections"} - {competition?.name}
        </CardTitle>
        <CardDescription>
          Select three golfers for this competition. 
          {isDeadlinePassed ? (
            <span className="text-error font-medium"> Note: The selection deadline has passed. Your changes may not be accepted.</span>
          ) : (
            hasDeadline && selectionDeadline
              ? ` You can change your selections until ${new Date(selectionDeadline).toLocaleString()}.`
              : ` You can change your selections until the deadline.`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="golfer1Id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Selection 1</FormLabel>
                  <Popover open={openPopover1} onOpenChange={setOpenPopover1}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openPopover1}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isDeadlinePassed}
                        >
                          {field.value ? getGolferNameById(field.value) : "Select a golfer"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search golfer..." />
                        <CommandList>
                          <CommandEmpty>No golfer found.</CommandEmpty>
                          <CommandGroup>
                            {sortedGolfers.map((golfer) => (
                              <CommandItem
                                key={golfer.id}
                                value={golfer.name}
                                onSelect={() => {
                                  form.setValue("golfer1Id", golfer.id);
                                  setOpenPopover1(false);
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
                                {golfer.name} {golfer.rank ? `(Rank: ${golfer.rank})` : ''}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="golfer2Id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Selection 2</FormLabel>
                  <Popover open={openPopover2} onOpenChange={setOpenPopover2}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openPopover2}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isDeadlinePassed}
                        >
                          {field.value ? getGolferNameById(field.value) : "Select a golfer"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search golfer..." />
                        <CommandList>
                          <CommandEmpty>No golfer found.</CommandEmpty>
                          <CommandGroup>
                            {sortedGolfers.map((golfer) => (
                              <CommandItem
                                key={golfer.id}
                                value={golfer.name}
                                onSelect={() => {
                                  form.setValue("golfer2Id", golfer.id);
                                  setOpenPopover2(false);
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
                                {golfer.name} {golfer.rank ? `(Rank: ${golfer.rank})` : ''}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="golfer3Id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Selection 3</FormLabel>
                  <Popover open={openPopover3} onOpenChange={setOpenPopover3}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openPopover3}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isDeadlinePassed}
                        >
                          {field.value ? getGolferNameById(field.value) : "Select a golfer"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search golfer..." />
                        <CommandList>
                          <CommandEmpty>No golfer found.</CommandEmpty>
                          <CommandGroup>
                            {sortedGolfers.map((golfer) => (
                              <CommandItem
                                key={golfer.id}
                                value={golfer.name}
                                onSelect={() => {
                                  form.setValue("golfer3Id", golfer.id);
                                  setOpenPopover3(false);
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
                                {golfer.name} {golfer.rank ? `(Rank: ${golfer.rank})` : ''}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Captain's Chip section */}
            <div className="mt-8 mb-2">
              <h3 className="text-lg font-medium">Captain's Chip</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Select one golfer as your captain to double their points. You can only use this once per season.
                {captainsChipStatus?.hasUsedCaptainsChip && 
                  " You have already used your captain's chip in another tournament."}
              </p>
              
              {/* Don't show captain options if chip already used */}
              {!captainsChipStatus?.hasUsedCaptainsChip && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Golfer 1 Captain Option */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      watchUseCaptainsChip() && watchCaptainGolferId() === watchGolfer1Id() 
                        ? "border-primary bg-primary/10" 
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      if (watchGolfer1Id() === 0) {
                        toast({
                          title: "Please select golfer 1 first",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      const currentValue = watchUseCaptainsChip() && 
                                          watchCaptainGolferId() === watchGolfer1Id();
                      
                      if (currentValue) {
                        // Deselecting
                        form.setValue("useCaptainsChip", false);
                        form.setValue("captainGolferId", 0);
                      } else {
                        // Selecting
                        form.setValue("useCaptainsChip", true);
                        form.setValue("captainGolferId", watchGolfer1Id());
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Golfer 1</h4>
                        <p className="text-sm truncate">{getGolferNameById(watchGolfer1Id())}</p>
                      </div>
                      {watchUseCaptainsChip() && watchCaptainGolferId() === watchGolfer1Id() && (
                        <span className="bg-primary text-white px-2 py-1 rounded text-xs">Captain</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Golfer 2 Captain Option */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      watchUseCaptainsChip() && watchCaptainGolferId() === watchGolfer2Id() 
                        ? "border-primary bg-primary/10" 
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      if (watchGolfer2Id() === 0) {
                        toast({
                          title: "Please select golfer 2 first",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      const currentValue = watchUseCaptainsChip() && 
                                          watchCaptainGolferId() === watchGolfer2Id();
                      
                      if (currentValue) {
                        // Deselecting
                        form.setValue("useCaptainsChip", false);
                        form.setValue("captainGolferId", 0);
                      } else {
                        // Selecting
                        form.setValue("useCaptainsChip", true);
                        form.setValue("captainGolferId", watchGolfer2Id());
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Golfer 2</h4>
                        <p className="text-sm truncate">{getGolferNameById(watchGolfer2Id())}</p>
                      </div>
                      {watchUseCaptainsChip() && watchCaptainGolferId() === watchGolfer2Id() && (
                        <span className="bg-primary text-white px-2 py-1 rounded text-xs">Captain</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Golfer 3 Captain Option */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      watchUseCaptainsChip() && watchCaptainGolferId() === watchGolfer3Id() 
                        ? "border-primary bg-primary/10" 
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      if (watchGolfer3Id() === 0) {
                        toast({
                          title: "Please select golfer 3 first",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      const currentValue = watchUseCaptainsChip() && 
                                          watchCaptainGolferId() === watchGolfer3Id();
                      
                      if (currentValue) {
                        // Deselecting
                        form.setValue("useCaptainsChip", false);
                        form.setValue("captainGolferId", 0);
                      } else {
                        // Selecting
                        form.setValue("useCaptainsChip", true);
                        form.setValue("captainGolferId", watchGolfer3Id());
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Golfer 3</h4>
                        <p className="text-sm truncate">{getGolferNameById(watchGolfer3Id())}</p>
                      </div>
                      {watchUseCaptainsChip() && watchCaptainGolferId() === watchGolfer3Id() && (
                        <span className="bg-primary text-white px-2 py-1 rounded text-xs">Captain</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Hidden field to track captain golfer ID */}
            <input type="hidden" {...form.register("captainGolferId")} />
            
            <Button 
              type="submit" 
              className="w-full mt-6" 
              disabled={isSubmitting || isDeadlinePassed}
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </div>
              ) : (
                existingSelections ? "Update Selections" : "Save Selections"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}