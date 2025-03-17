import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

interface GolferSelectionProps {
  name: string;
  position: number | string;
  points: number;
  avatar?: string;
}

function GolferSelection({ name, position, points, avatar }: GolferSelectionProps) {
  return (
    <div className="relative rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm flex items-center space-x-3 hover:border-primary/30">
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
          {avatar ? (
            <img className="h-10 w-10 rounded-full" src={avatar} alt={name} />
          ) : (
            <span className="text-sm font-medium text-gray-800">{name.charAt(0)}</span>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <p className="text-sm text-gray-500 truncate">Current Position: {position}</p>
      </div>
      <div className="flex-shrink-0 text-sm font-semibold text-success">+{points} pts</div>
    </div>
  );
}

export default function CurrentCompetition() {
  const { data: activeCompetition, isLoading } = useQuery({
    queryKey: ['/api/competitions/active'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: userSelections, isLoading: isLoadingSelections } = useQuery({
    queryKey: ['/api/selections/my', activeCompetition?.id],
    enabled: !!activeCompetition?.id,
  });

  // Subscribe to realtime updates for results
  useEffect(() => {
    if (!activeCompetition?.id) return;

    const channel = supabase
      .channel(`results-${activeCompetition.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'results',
        filter: `competition_id=eq.${activeCompetition.id}`
      }, () => {
        // Invalidate queries when data changes
        // This will refetch the data automatically
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompetition?.id]);

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Current Competition</h2>
        </div>
        <Card className="mt-4">
          <CardHeader className="bg-secondary/5">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="py-6">
            <Skeleton className="h-5 w-1/4 mb-4" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Current Competition</h2>
          <Link href="/competitions">
            <a className="text-sm font-medium text-primary hover:text-primary/80">View all competitions</a>
          </Link>
        </div>
        <Card className="mt-4">
          <CardContent className="py-6 flex flex-col items-center justify-center text-center">
            <div className="text-gray-500 mb-4">
              <i className="fas fa-calendar-alt text-4xl"></i>
            </div>
            <h3 className="text-lg font-medium">No Active Competition</h3>
            <p className="text-sm text-gray-500 mt-2 mb-4">There are no active competitions at the moment.</p>
            <Link href="/competitions">
              <Button>View Upcoming Competitions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasSelections = userSelections && userSelections.length > 0;
  const totalPoints = hasSelections ? userSelections.reduce((sum, selection) => sum + selection.points, 0) : 0;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Current Competition</h2>
        <Link href="/competitions" className="text-sm font-medium text-primary hover:text-primary/80">
          View all competitions
        </Link>
      </div>
      
      <Card className="mt-4">
        <CardHeader className="bg-secondary/5 px-4 py-5 sm:px-6">
          <div className="flex justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">{activeCompetition.name}</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {activeCompetition.venue} • {new Date(activeCompetition.startDate).toLocaleDateString()} - {new Date(activeCompetition.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">
                <i className="fas fa-flag mr-1"></i> In Progress
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <h4 className="text-md font-medium text-gray-900">Your Selections</h4>
          
          {isLoadingSelections ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !hasSelections ? (
            <div className="mt-4 py-6 flex flex-col items-center justify-center text-center">
              <div className="text-gray-400 mb-3">
                <i className="fas fa-golf-ball text-3xl"></i>
              </div>
              <p className="text-sm text-gray-500">You haven't made your selections for this competition yet.</p>
              <Link href={`/competitions/${activeCompetition.id}`}>
                <Button className="mt-4">Make Selections</Button>
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {userSelections.map((selection, index) => (
                <GolferSelection
                  key={index}
                  name={selection.golfer.name}
                  position={selection.position || 'N/A'}
                  points={selection.points || 0}
                  avatar={selection.golfer.avatar}
                />
              ))}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="bg-slate-50 px-4 py-4 sm:px-6 border-t border-gray-200">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm font-medium text-gray-500">
              Total points for this competition: <span className="text-primary font-semibold">{totalPoints}</span>
            </p>
            <Link href="/leaderboard">
              <Button variant="outline" size="sm" className="text-gray-700">
                <i className="fas fa-eye mr-1.5"></i> View Full Leaderboard
              </Button>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
