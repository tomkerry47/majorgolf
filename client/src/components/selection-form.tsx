import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GolfPlayer } from "@shared/schema";
import { UseFormReturn } from "react-hook-form";

interface SelectionFormProps {
  form: UseFormReturn<any>;
  golfPlayers: GolfPlayer[];
  isLoading: boolean;
  isPending: boolean;
}

const SelectionForm = ({ form, golfPlayers, isLoading, isPending }: SelectionFormProps) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  // Sort players by world ranking if available
  const sortedPlayers = [...golfPlayers].sort((a, b) => {
    if (a.worldRanking && b.worldRanking) {
      return a.worldRanking - b.worldRanking;
    }
    if (a.worldRanking) return -1;
    if (b.worldRanking) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormField
          control={form.control}
          name="playerOneId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Selection</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {sortedPlayers.map((player) => (
                    <SelectItem key={player.id} value={player.id.toString()}>
                      {player.name} {player.worldRanking ? `(#${player.worldRanking})` : ''}
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
          name="playerTwoId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Second Selection</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {sortedPlayers.map((player) => (
                    <SelectItem 
                      key={player.id} 
                      value={player.id.toString()}
                      disabled={player.id.toString() === form.getValues().playerOneId}
                    >
                      {player.name} {player.worldRanking ? `(#${player.worldRanking})` : ''}
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
          name="playerThreeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Third Selection</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {sortedPlayers.map((player) => (
                    <SelectItem 
                      key={player.id} 
                      value={player.id.toString()}
                      disabled={
                        player.id.toString() === form.getValues().playerOneId || 
                        player.id.toString() === form.getValues().playerTwoId
                      }
                    >
                      {player.name} {player.worldRanking ? `(#${player.worldRanking})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="flex justify-end">
        <Button 
          type="button" 
          variant="outline" 
          className="mr-3"
          onClick={() => form.reset()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Submitting..." : "Submit Selections"}
        </Button>
      </div>
    </div>
  );
};

export default SelectionForm;
