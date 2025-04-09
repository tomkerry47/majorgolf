import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Competition, Selection } from "@shared/schema"; // Import Competition and Selection types
// Removed Tabs imports as they are no longer needed

export default function Competitions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);
  
  // Explicitly type the useQuery hook
  const { data: competitions, isLoading } = useQuery<Competition[]>({ 
    queryKey: ['/api/competitions/all'],
    enabled: !!user, // Only fetch if user is logged in
  });

  // Fetch all selections for the current user
  const { data: userSelections, isLoading: isLoadingUserSelections } = useQuery<Selection[]>({
    queryKey: ['/api/selections/my-all'],
    enabled: !!user, // Only fetch if user is logged in
  });
  
  // Removed duplicated useQuery hook for userSelections
  
  if (!user) return null; // Should be handled by useEffect redirect, but good practice

  // Create a map for quick lookup of submitted competitions once userSelections are loaded
  const userSelectionMap = new Map(userSelections?.map(sel => [sel.competitionId, true]) || []);
  
  // Sort all competitions by start date
  const sortedCompetitions = competitions
    ? [...competitions].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    : [];
  
  // Update CompetitionCard props to receive hasSubmitted
  const CompetitionCard = ({ competition, hasSubmitted }: { competition: Competition, hasSubmitted: boolean }) => { 
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    const deadlineDate = new Date(competition.selectionDeadline); 

    // Calculate deadline time (06:00 AM on start date)
    const selectionLockTime = new Date(startDate);
    selectionLockTime.setHours(6, 0, 0, 0); 

    const now = new Date();
    // Disable button if competition is complete OR if user is not admin AND deadline has passed
    const isSelectionLocked = !user?.isAdmin && now >= selectionLockTime;
    // Button should be enabled if competition is not complete AND selection is not locked for the user
    const canMakeSelection = !competition.isComplete && !isSelectionLocked; 

    let status;
    let statusClass;
    
    if (competition.isActive) {
      status = "Active";
      statusClass = "bg-amber-500/10 text-amber-700 border-amber-200";
    } else if (competition.isComplete) {
      status = "Completed";
      statusClass = "bg-slate-500/10 text-slate-700 border-slate-200";
    } else {
      status = "Upcoming";
      statusClass = "bg-primary/10 text-primary border-primary/20";
    }
    
    return (
      <Card className="mb-4">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-medium mr-3">{competition.name}</h3>
                <Badge variant="outline" className={statusClass}>
                  {status}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                <i className="fas fa-map-marker-alt mr-2 text-gray-400"></i>
                {competition.venue}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <i className="fas fa-calendar mr-2 text-gray-400"></i>
                {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()} {/* Format dates */}
              </p>
              <p className="text-sm text-gray-600">
                <i className="fas fa-clock mr-2 text-gray-400"></i>
                Selection Deadline: {deadlineDate.toLocaleDateString()} {/* Format date */}
              </p>
              
              {hasSubmitted && ( // Use the passed prop
                <div className="mt-3 text-sm text-green-600 flex items-center"> {/* Use Tailwind color */}
                  <i className="fas fa-check-circle mr-1"></i>
                  Selections Submitted
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4 sm:mt-0"> {/* Container for buttons */}
              {/* View Competition Button (Always Enabled) */}
              <Link href={`/competitions/${competition.id}`} className="w-full sm:w-auto">
                <Button size="sm" variant="secondary" className="w-full"> 
                  View Competition
                </Button>
              </Link>

              {/* Make/Change Selections Button (Conditionally Enabled) */}
              <Link href={`/competitions/${competition.id}`} className="w-full sm:w-auto">
                <Button 
                  size="sm" 
                  variant={hasSubmitted ? "outline" : "default"} // Use passed prop
                  className="w-full" // Make button full width on small screens
                  disabled={!canMakeSelection} 
                >
                  {competition.isComplete ? "View Results" : (hasSubmitted ? "Change Selections" : "Make Selections")} {/* Use passed prop */}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  const LoadingSkeleton = () => (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i} className="mb-4">
          <CardContent className="p-6">
            <div className="flex justify-between">
              <div className="w-full">
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-1" />
                <Skeleton className="h-4 w-2/3 mb-1" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="h-9 w-[100px]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
  
  const EmptyState = ({ message }: { message: string }) => (
    <div className="py-10 text-center">
      <div className="text-gray-400 mb-3">
        <i className="fas fa-golf-ball text-4xl"></i>
      </div>
      <h3 className="text-lg font-medium text-gray-900">No competitions found</h3>
      <p className="text-sm text-gray-500 mt-1">{message}</p>
    </div>
  );
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Competitions</h1>
        
        {/* Removed Tabs component, directly render the list */}
        <div className="space-y-4">
          {isLoading || isLoadingUserSelections ? ( // Check both loading states
            <LoadingSkeleton />
          ) : sortedCompetitions.length === 0 ? (
            <EmptyState message="No competitions found." />
          ) : (
            sortedCompetitions.map((competition) => (
              <CompetitionCard 
                key={competition.id} 
                competition={competition} 
                hasSubmitted={userSelectionMap.has(competition.id)} // Pass hasSubmitted status from the map
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
