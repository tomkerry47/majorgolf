import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

export default function Leaderboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);
  
  const [selectedCompetition, setSelectedCompetition] = useState<number | 'all'>('all');
  
  const { data: competitions } = useQuery({
    queryKey: ['/api/competitions'],
    enabled: !!user,
  });
  
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['/api/leaderboard', selectedCompetition],
    enabled: !!user,
  });
  
  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('leaderboard_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'results'
      }, () => {
        // Invalidate the query to refresh data
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  
  if (!user) return null;
  
  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return "bg-secondary text-white";
      case 2: return "bg-slate-600 text-white";
      case 3: return "bg-amber-500 text-white";
      default: return "bg-slate-400 text-white";
    }
  };
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Leaderboard</h1>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {selectedCompetition === 'all' 
                  ? 'All Competitions' 
                  : competitions?.find(c => c.id === selectedCompetition)?.name || 'Select Competition'}
                <i className="fas fa-chevron-down ml-2"></i>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedCompetition('all')}>
                All Competitions
              </DropdownMenuItem>
              {competitions?.map(comp => (
                <DropdownMenuItem 
                  key={comp.id} 
                  onClick={() => setSelectedCompetition(comp.id)}
                >
                  {comp.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedCompetition === 'all' 
                ? 'Overall Standings' 
                : `${competitions?.find(c => c.id === selectedCompetition)?.name || 'Competition'} Standings`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Competitions</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="ml-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16 mt-1" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : leaderboard?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                      No leaderboard data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  // Actual data
                  leaderboard?.map((entry, index) => (
                    <TableRow 
                      key={entry.userId} 
                      className={entry.userId === user.id ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-slate-50"}
                    >
                      <TableCell className="whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className="flex items-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${getRankBadgeColor(index + 1)}`}>
                            {index + 1}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {entry.avatar ? (
                              <img 
                                className="h-10 w-10 rounded-full" 
                                src={entry.avatar} 
                                alt={entry.username} 
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-800">
                                {entry.fullName?.charAt(0) || entry.username.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {entry.fullName || entry.username}
                              {entry.userId === user.id && " (You)"}
                            </div>
                            <div className="text-sm text-gray-500">@{entry.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-gray-500">
                        {entry.competitionsPlayed}/{entry.totalCompetitions}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-semibold">{entry.totalPoints}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-medium">
                        <Button variant="link" className="text-primary hover:text-primary/80" asChild>
                          <a href={`/profile/${entry.userId}`}>View</a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
