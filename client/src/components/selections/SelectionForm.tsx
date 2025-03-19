import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

  const form = useForm<InsertSelection>({
    resolver: zodResolver(selectionFormSchema),
    defaultValues: {
      competitionId,
      userId: 0, // This will be set on the server
      golfer1Id: 0,
      golfer2Id: 0,
      golfer3Id: 0,
    },
  });

  // Set default values if we have existing selections
  useEffect(() => {
    if (existingSelections) {
      // Type assertion to handle properties safely
      const selection = existingSelections as unknown as InsertSelection;
      form.reset({
        competitionId,
        userId: selection.userId || 0,
        golfer1Id: selection.golfer1Id || 0,
        golfer2Id: selection.golfer2Id || 0,
        golfer3Id: selection.golfer3Id || 0,
      });
    }
  }, [existingSelections, competitionId, form]);

  async function onSubmit(data: InsertSelection) {
    setIsSubmitting(true);
    try {
      if (existingSelections) {
        // Update existing selections
        await apiRequest('PATCH', `/api/selections/${competitionId}`, data);
        toast({
          title: "Selections updated",
          description: "Your selections have been updated successfully.",
        });
      } else {
        // Create new selections
        await apiRequest('POST', '/api/selections', data);
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

  if (isLoadingCompetition || isLoadingGolfers || isLoadingSelections) {
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