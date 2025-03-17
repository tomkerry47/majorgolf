import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

function formatTimeUntil(date: string) {
  const now = new Date();
  const deadline = new Date(date);
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Passed";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day";
  return `${diffDays} days`;
}

interface CompetitionCardProps {
  id: number;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  selectionDeadline: string;
  hasSubmitted: boolean;
}

function CompetitionCard({ 
  id, 
  name, 
  venue, 
  startDate, 
  endDate, 
  selectionDeadline,
  hasSubmitted
}: CompetitionCardProps) {
  const daysUntil = formatTimeUntil(selectionDeadline);
  const isUrgent = daysUntil === "Today" || daysUntil === "1 day" || daysUntil === "2 days";
  
  async function resetSelections() {
    try {
      await apiRequest('DELETE', `/api/selections/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/competitions/upcoming'] });
    } catch (error) {
      console.error('Error resetting selections:', error);
    }
  }
  
  return (
    <Card className="overflow-hidden border border-slate-200">
      <CardContent className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">{name}</h3>
            <div className="mt-1 flex items-center text-sm text-gray-500">
              <i className="fas fa-map-marker-alt flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400"></i>
              <p>{venue}</p>
            </div>
            <div className="mt-1 flex items-center text-sm text-gray-500">
              <i className="fas fa-calendar flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400"></i>
              <p>{new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-sm font-medium text-gray-500">Selection Due</div>
            <div className={`text-lg font-semibold ${isUrgent ? 'text-error' : 'text-gray-900'}`}>
              {daysUntil}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="rounded-md bg-slate-50 px-6 py-3">
            <div className="flex">
              <div className="flex-shrink-0">
                {hasSubmitted ? (
                  <i className="fas fa-check-circle h-5 w-5 text-success"></i>
                ) : (
                  <i className="fas fa-info-circle h-5 w-5 text-info"></i>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-700">
                  {hasSubmitted 
                    ? "You have already made your selections" 
                    : "You have not made your selections yet"}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Button 
            variant={hasSubmitted ? "outline" : "default"} 
            className={`w-full ${hasSubmitted ? "text-gray-700" : "text-white"}`}
            asChild
          >
            <Link href={`/competitions/${id}`}>
              {hasSubmitted ? "View/Edit Selections" : "Make Selections"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UpcomingCompetitions() {
  const { data: upcomingCompetitions, isLoading } = useQuery({
    queryKey: ['/api/competitions/upcoming'],
  });

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Upcoming Competitions</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!upcomingCompetitions || upcomingCompetitions.length === 0) {
    return (
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Upcoming Competitions</h2>
        </div>
        <Card className="mt-4">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <div className="text-gray-400 mb-4">
              <i className="fas fa-calendar-alt text-4xl"></i>
            </div>
            <h3 className="text-lg font-medium">No Upcoming Competitions</h3>
            <p className="text-sm text-gray-500 mt-2">
              There are no upcoming competitions scheduled at the moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Upcoming Competitions</h2>
        <Link href="/competitions" className="text-sm font-medium text-primary hover:text-primary/80">
          View all
        </Link>
      </div>
      
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {upcomingCompetitions.slice(0, 2).map((competition) => (
          <CompetitionCard
            key={competition.id}
            id={competition.id}
            name={competition.name}
            venue={competition.venue}
            startDate={competition.startDate}
            endDate={competition.endDate}
            selectionDeadline={competition.selectionDeadline}
            hasSubmitted={competition.hasSubmitted}
          />
        ))}
      </div>
    </div>
  );
}
