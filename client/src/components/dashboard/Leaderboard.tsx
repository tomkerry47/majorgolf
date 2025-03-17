import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export default function Leaderboard() {
  const { user } = useAuth();
  const [selectedCompetition, setSelectedCompetition] = useState<number | 'all'>('all');
  
  const { data: competitions } = useQuery({
    queryKey: ['/api/competitions'],
  });
  
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['/api/leaderboard', selectedCompetition],
  });
  
  // Subscribe to realtime updates
  useEffect(() => {
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
  }, []);
  
  const currentUserId = user?.id;
  
  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return "bg-secondary text-white";
      case 2: return "bg-slate-600 text-white";
      case 3: return "bg-amber-500 text-white";
      default: return "bg-slate-400 text-white";
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Current Leaderboard</h2>
        <div className="relative inline-block text-left">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                {selectedCompetition === 'all' 
                  ? 'All Competitions' 
                  : competitions?.find(c => c.id === selectedCompetition)?.name || 'Select Competition'}
                <i className="fas fa-chevron-down -mr-1 ml-2 h-5 w-5"></i>
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
      </div>

      <div className="mt-4 flex flex-col">
        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Competitions</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    // Loading skeleton
                    Array(5).fill(0).map((_, i) => (
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
                      <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Actual data
                    leaderboard?.map((entry, index) => (
                      <TableRow 
                        key={entry.userId} 
                        className={currentUserId === entry.userId ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-slate-50"}
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
                                {currentUserId === entry.userId && " (You)"}
                              </div>
                              <div className="text-sm text-gray-500">@{entry.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-gray-500">
                          {entry.competitionsPlayed}/{entry.totalCompetitions}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">{entry.totalPoints}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-medium">
                          <Link href={`/profile/${entry.userId}`} className="text-primary hover:text-primary/80">
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
