import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { selectionFormSchema, type InsertSelection } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface SelectionFormProps {
  competitionId: number;
  onSuccess?: () => void;
}

export default function SelectionForm({ competitionId, onSuccess }: SelectionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch competition details
  const { data: competition, isLoading: isLoadingCompetition } = useQuery({
    queryKey: [`/api/competitions/${competitionId}`],
  });

  // Fetch available golfers
  const { data: golfers, isLoading: isLoadingGolfers } = useQuery({
    queryKey: ['/api/golfers'],
  });

  // Fetch existing selections if any
  const { data: existingSelections, isLoading: isLoadingSelections } = useQuery({
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
      form.reset({
        competitionId,
        userId: existingSelections.userId,
        golfer1Id: existingSelections.golfer1Id,
        golfer2Id: existingSelections.golfer2Id,
        golfer3Id: existingSelections.golfer3Id,
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

  const isDeadlinePassed = competition && new Date(competition.selectionDeadline) < new Date();

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
            ` You can change your selections until ${new Date(competition?.selectionDeadline).toLocaleString()}.`
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
                <FormItem>
                  <FormLabel>Selection 1</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={field.value ? field.value.toString() : undefined}
                    disabled={isDeadlinePassed}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a golfer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {golfers?.map((golfer) => (
                        <SelectItem key={golfer.id} value={golfer.id.toString()}>
                          {golfer.name} {golfer.rank ? `(Rank: ${golfer.rank})` : ''}
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
              name="golfer2Id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selection 2</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={field.value ? field.value.toString() : undefined}
                    disabled={isDeadlinePassed}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a golfer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {golfers?.map((golfer) => (
                        <SelectItem key={golfer.id} value={golfer.id.toString()}>
                          {golfer.name} {golfer.rank ? `(Rank: ${golfer.rank})` : ''}
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
              name="golfer3Id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selection 3</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={field.value ? field.value.toString() : undefined}
                    disabled={isDeadlinePassed}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a golfer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {golfers?.map((golfer) => (
                        <SelectItem key={golfer.id} value={golfer.id.toString()}>
                          {golfer.name} {golfer.rank ? `(Rank: ${golfer.rank})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
