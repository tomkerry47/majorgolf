import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getQueryFn } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Competition } from '@shared/schema';

export default function TournamentResultsAdmin() {
  const [, setLocation] = useLocation();
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  
  // Fetch competitions
  const { data: competitions, isPending } = useQuery({
    queryKey: ['/api/admin/competitions'],
    queryFn: getQueryFn({ on401: 'throw' }),
  });

  // Filter completed competitions
  const completedCompetitions = Array.isArray(competitions) 
    ? competitions.filter((comp: Competition) => comp.isComplete) 
    : [];
  
  // Filter active competitions
  const activeCompetitions = Array.isArray(competitions) 
    ? competitions.filter((comp: Competition) => comp.isActive) 
    : [];
  
  // Filter upcoming competitions
  const upcomingCompetitions = Array.isArray(competitions) 
    ? competitions.filter((comp: Competition) => !comp.isActive && !comp.isComplete) 
    : [];
  
  // Navigate to the tournament management page
  const handleCompetitionSelect = (value: string) => {
    setSelectedCompetition(value);
    if (value) {
      setLocation(`/admin/tournament-results/${value}`);
    }
  };
  
  return (
    <div className="container px-4 py-6 mx-auto max-w-5xl">
      <Button 
        variant="ghost" 
        className="mb-4"
        onClick={() => setLocation('/admin')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Admin
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle>Tournament Results</CardTitle>
          <CardDescription>
            Manage tournament results and calculate player points
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Select Tournament</h3>
                <p className="text-sm text-gray-500">
                  Choose a tournament to view or manage its results
                </p>
                
                <Select 
                  value={selectedCompetition} 
                  onValueChange={handleCompetitionSelect}
                >
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="Select a tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCompetitions.length > 0 && (
                      <div>
                        <p className="px-2 py-1.5 text-sm font-medium text-gray-500">
                          Active Tournaments
                        </p>
                        {activeCompetitions.map((comp: Competition) => (
                          <SelectItem key={comp.id} value={comp.id.toString()}>
                            {comp.name}
                          </SelectItem>
                        ))}
                      </div>
                    )}
                    
                    {upcomingCompetitions.length > 0 && (
                      <div>
                        <p className="px-2 py-1.5 text-sm font-medium text-gray-500">
                          Upcoming Tournaments
                        </p>
                        {upcomingCompetitions.map((comp: Competition) => (
                          <SelectItem key={comp.id} value={comp.id.toString()}>
                            {comp.name}
                          </SelectItem>
                        ))}
                      </div>
                    )}
                    
                    {completedCompetitions.length > 0 && (
                      <div>
                        <p className="px-2 py-1.5 text-sm font-medium text-gray-500">
                          Completed Tournaments
                        </p>
                        {completedCompetitions.map((comp: Competition) => (
                          <SelectItem key={comp.id} value={comp.id.toString()}>
                            {comp.name}
                          </SelectItem>
                        ))}
                      </div>
                    )}
                    
                    {(!Array.isArray(competitions) || competitions.length === 0) && (
                      <SelectItem value="none" disabled>
                        No tournaments available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-medium mb-2">Tournament Management</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Select a tournament from the dropdown above to:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>View and edit tournament results</li>
                  <li>Enter player scores and positions</li>
                  <li>Mark tournaments as complete</li>
                  <li>Calculate player points based on results</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}