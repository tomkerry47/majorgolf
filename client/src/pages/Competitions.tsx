import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Competitions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);
  
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['/api/competitions/all'],
    enabled: !!user,
  });
  
  if (!user) return null;
  
  const activeCompetitions = competitions?.filter(c => c.isActive) || [];
  const upcomingCompetitions = competitions?.filter(c => !c.isActive && !c.isComplete) || [];
  const pastCompetitions = competitions?.filter(c => c.isComplete) || [];
  
  const CompetitionCard = ({ competition }: { competition: any }) => {
    const startDate = new Date(competition.startDate).toLocaleDateString();
    const endDate = new Date(competition.endDate).toLocaleDateString();
    const deadlineDate = new Date(competition.selectionDeadline).toLocaleDateString();
    
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
                {startDate} - {endDate}
              </p>
              <p className="text-sm text-gray-600">
                <i className="fas fa-clock mr-2 text-gray-400"></i>
                Selection Deadline: {deadlineDate}
              </p>
              
              {competition.hasSubmitted && (
                <div className="mt-3 text-sm text-success flex items-center">
                  <i className="fas fa-check-circle mr-1"></i>
                  You have submitted your selections
                </div>
              )}
            </div>
            
            <Link href={`/competitions/${competition.id}`}>
              <Button size="sm" variant={competition.hasSubmitted ? "outline" : "default"}>
                {competition.hasSubmitted ? "View Selections" : "Make Selections"}
              </Button>
            </Link>
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
        
        <Tabs defaultValue="active">
          <TabsList className="mb-6">
            <TabsTrigger value="active">
              Active
              {activeCompetitions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                  {activeCompetitions.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming
              {upcomingCompetitions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                  {upcomingCompetitions.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active">
            {isLoading ? (
              <LoadingSkeleton />
            ) : activeCompetitions.length === 0 ? (
              <EmptyState message="There are no active competitions at the moment." />
            ) : (
              activeCompetitions.map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} />
              ))
            )}
          </TabsContent>
          
          <TabsContent value="upcoming">
            {isLoading ? (
              <LoadingSkeleton />
            ) : upcomingCompetitions.length === 0 ? (
              <EmptyState message="There are no upcoming competitions scheduled." />
            ) : (
              upcomingCompetitions.map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} />
              ))
            )}
          </TabsContent>
          
          <TabsContent value="past">
            {isLoading ? (
              <LoadingSkeleton />
            ) : pastCompetitions.length === 0 ? (
              <EmptyState message="There are no past competitions to display." />
            ) : (
              pastCompetitions.map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
