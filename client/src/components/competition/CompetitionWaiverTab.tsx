import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Golfer } from "@shared/schema";

type DisplaySelection = {
  id: number;
  golfer: {
    id: number;
    name: string;
    rank: number | string;
  };
};

type RawSelection = {
  id: number;
  golfer1Id: number;
  golfer2Id: number;
  golfer3Id: number;
};

type HistoricalSelection = {
  competition?: { id: number } | null;
  golfer1?: { id: number } | null;
  golfer2?: { id: number } | null;
  golfer3?: { id: number } | null;
};

interface CompetitionWaiverTabProps {
  competitionId: number;
  competitionName: string;
  selectionDeadline: string;
  userSelections: DisplaySelection[] | null | undefined;
  isLoadingSelection: boolean;
}

export default function CompetitionWaiverTab({
  competitionId,
  competitionName,
  selectionDeadline,
  userSelections,
  isLoadingSelection,
}: CompetitionWaiverTabProps) {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | 3 | null>(null);
  const [replacementGolferId, setReplacementGolferId] = useState<string>("");

  const deadline = new Date(selectionDeadline);
  const waiverWindowEnd = new Date(deadline.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  const withinWaiverWindow = now > deadline && now <= waiverWindowEnd;
  const waiverUsedInThisCompetition = Boolean(
    user?.hasUsedWaiverChip && user?.waiverChipUsedCompetitionId === competitionId
  );
  const waiverUsedInAnotherCompetition = Boolean(
    user?.hasUsedWaiverChip && user?.waiverChipUsedCompetitionId !== competitionId
  );

  const { data: rawSelection, isLoading: isLoadingRawSelection } = useQuery<RawSelection | null>({
    queryKey: ["/api/selections/raw", competitionId],
    queryFn: () => apiRequest<RawSelection | null>(`/api/selections/${competitionId}?format=raw`, "GET"),
    enabled: !!user && !!competitionId,
  });

  const { data: golferResponse, isLoading: isLoadingGolfers } = useQuery<{ golfers: Golfer[] }>({
    queryKey: ["/api/golfers"],
    queryFn: () => apiRequest<{ golfers: Golfer[] }>("/api/golfers", "GET"),
    enabled: !!user,
  });

  const { data: selectionHistory = [], isLoading: isLoadingHistory } = useQuery<HistoricalSelection[]>({
    queryKey: ["/api/selections/my-all"],
    queryFn: () => apiRequest<HistoricalSelection[]>("/api/selections/my-all", "GET"),
    enabled: !!user,
  });

  const allGolfers = golferResponse?.golfers || [];
  const historicalGolferIds = useMemo(() => {
    const usedIds = new Set<string>();
    selectionHistory.forEach((selection) => {
      if (selection.golfer1?.id) usedIds.add(selection.golfer1.id.toString());
      if (selection.golfer2?.id) usedIds.add(selection.golfer2.id.toString());
      if (selection.golfer3?.id) usedIds.add(selection.golfer3.id.toString());
    });
    if (user?.waiverChipOriginalGolferId) usedIds.add(user.waiverChipOriginalGolferId.toString());
    if (user?.waiverChipReplacementGolferId) usedIds.add(user.waiverChipReplacementGolferId.toString());
    return usedIds;
  }, [selectionHistory, user?.waiverChipOriginalGolferId, user?.waiverChipReplacementGolferId]);

  const availableGolfers = useMemo(() => {
    return [...allGolfers]
      .filter((golfer) => !historicalGolferIds.has(golfer.id.toString()))
      .sort((a, b) => a.rank - b.rank);
  }, [allGolfers, historicalGolferIds]);

  const existingWaiverSlot = useMemo(() => {
    if (!waiverUsedInThisCompetition || !rawSelection || !user?.waiverChipReplacementGolferId) {
      return null;
    }

    if (rawSelection.golfer1Id === user.waiverChipReplacementGolferId) return 1;
    if (rawSelection.golfer2Id === user.waiverChipReplacementGolferId) return 2;
    if (rawSelection.golfer3Id === user.waiverChipReplacementGolferId) return 3;
    return null;
  }, [rawSelection, user?.waiverChipReplacementGolferId, waiverUsedInThisCompetition]);

  useEffect(() => {
    if (waiverUsedInThisCompetition && existingWaiverSlot) {
      setSelectedSlot(existingWaiverSlot);
      return;
    }

    if (!waiverUsedInThisCompetition) {
      setSelectedSlot(null);
    }
  }, [existingWaiverSlot, waiverUsedInThisCompetition]);

  const selectedReplacement = availableGolfers.find((golfer) => golfer.id.toString() === replacementGolferId);
  const waiverMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/selections/${competitionId}/waiver`, "POST", {
        updatedGolferSlot: selectedSlot ?? existingWaiverSlot,
        newGolferId: parseInt(replacementGolferId, 10),
      }),
    onSuccess: async (response: any) => {
      await refreshUserProfile();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/selections/${competitionId}`] }),
        queryClient.invalidateQueries({ queryKey: ["/api/selections/raw", competitionId] }),
        queryClient.invalidateQueries({ queryKey: [`/api/competitions/${competitionId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/leaderboard/${competitionId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/competitions/${competitionId}/chips`] }),
        queryClient.invalidateQueries({ queryKey: ["/api/selections/my-all"] }),
      ]);

      setReplacementGolferId("");
      toast({
        title: waiverUsedInThisCompetition ? "Waiver updated" : "Waiver used",
        description: response?.message || "Your waiver chip has been applied.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Waiver failed",
        description: error.message || "Could not apply your waiver chip.",
        variant: "destructive",
      });
    },
  });

  const handleApplyWaiver = () => {
    if (!(selectedSlot ?? existingWaiverSlot) || !replacementGolferId) {
      toast({
        title: "Choose a swap",
        description: waiverUsedInThisCompetition
          ? "Choose your new replacement golfer."
          : "Select the golfer you want to replace and choose a new golfer.",
        variant: "destructive",
      });
      return;
    }

    waiverMutation.mutate();
  };

  if (isLoadingSelection || isLoadingRawSelection || isLoadingGolfers || isLoadingHistory) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!rawSelection || !userSelections?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waiver Chip</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">You need an existing selection in {competitionName} before you can use a waiver chip.</p>
        </CardContent>
      </Card>
    );
  }

  if (!withinWaiverWindow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waiver Chip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant="outline" className="bg-slate-100 text-slate-700">Waiver window closed</Badge>
          <p className="text-sm text-gray-600">Round 2 has already started. No more waivers.</p>
        </CardContent>
      </Card>
    );
  }

  if (waiverUsedInAnotherCompetition) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waiver Chip</CardTitle>
          <CardDescription>Your one waiver chip across all five tournaments has already been used.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Waiver chip already spent</AlertTitle>
            <AlertDescription>
              You only get one waiver chip for the full five-tournament season. There are no extra waiver chips later.
            </AlertDescription>
          </Alert>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Already used</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waiver Chip</CardTitle>
        <CardDescription>
          {waiverUsedInThisCompetition
            ? "You have already used your waiver chip in this tournament. You can still change the replacement golfer until the 24-hour window ends."
            : "You can make one waiver swap in the first 24 hours after the deadline. Pick exactly one golfer to replace."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-red-200 bg-red-50 text-red-900 [&>svg]:text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{waiverUsedInThisCompetition ? "Still your only waiver chip" : "One waiver chip only"}</AlertTitle>
          <AlertDescription>
            {waiverUsedInThisCompetition
              ? "You can change the replacement player during this 24-hour window, but it still counts as your only waiver chip for the full season."
              : "Using this now spends your only waiver chip for the entire five-tournament season. You will not get another waiver later."}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          {userSelections.map((selection, index) => {
            const slot = (index + 1) as 1 | 2 | 3;
            const isSelected = (selectedSlot ?? existingWaiverSlot) === slot;
            const isLockedByExistingWaiver = waiverUsedInThisCompetition && existingWaiverSlot !== slot;

            return (
              <button
                key={selection.id}
                type="button"
                onClick={() => {
                  if (!isLockedByExistingWaiver) {
                    setSelectedSlot(slot);
                  }
                }}
                disabled={isLockedByExistingWaiver}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-slate-200 hover:border-primary/40",
                  isLockedByExistingWaiver && "cursor-not-allowed opacity-60 hover:border-slate-200"
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Selection {slot}</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{selection.golfer.name}</p>
                <p className="mt-1 text-sm text-slate-500">Rank at deadline: {selection.golfer.rank || "N/A"}</p>
                <div className="mt-4">
                  <Badge variant={isSelected ? "default" : "outline"}>
                    {isSelected
                      ? waiverUsedInThisCompetition
                        ? "Current waiver slot"
                        : "Replacing this golfer"
                      : waiverUsedInThisCompetition
                        ? "Waiver already locked here"
                        : "Select to replace"}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Replacement golfer</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className={cn("w-full justify-between", !replacementGolferId && "text-muted-foreground")}
              >
                {selectedReplacement
                  ? `${selectedReplacement.firstName ?? ""} ${selectedReplacement.lastName ?? ""}`.trim() || selectedReplacement.name
                  : "Select replacement golfer"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput placeholder="Search golfer..." />
                <CommandList>
                  <CommandEmpty>No eligible golfer found.</CommandEmpty>
                  <CommandGroup>
                    {availableGolfers.map((golfer) => (
                      <CommandItem
                        key={golfer.id}
                        value={`${golfer.firstName ?? ""} ${golfer.lastName ?? ""}`.trim() || golfer.name}
                        onSelect={() => setReplacementGolferId(golfer.id.toString())}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            golfer.id.toString() === replacementGolferId ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {`${golfer.firstName ?? ""} ${golfer.lastName ?? ""}`.trim() || golfer.name} {golfer.rank ? `(#${golfer.rank})` : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-slate-500">
            Previously used golfers are excluded automatically. This includes golfers you already used in other tournaments.
          </p>
          {waiverUsedInThisCompetition && (
            <p className="text-xs text-slate-500">
              Your waived-out golfer is fixed. During this window you can only change the replacement player.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleApplyWaiver} disabled={!(selectedSlot ?? existingWaiverSlot) || !replacementGolferId || waiverMutation.isPending}>
            {waiverMutation.isPending ? "Applying..." : waiverUsedInThisCompetition ? "Update Waiver Player" : "Use My Only Waiver Chip"}
          </Button>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Available until {waiverWindowEnd.toLocaleString()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
