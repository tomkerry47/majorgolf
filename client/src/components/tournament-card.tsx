import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CalendarIcon, MapPinIcon, ChevronRightIcon } from "lucide-react";
import { Tournament } from "@shared/schema";
import { format } from "date-fns";

interface TournamentCardProps {
  tournament: Tournament;
}

const TournamentCard = ({ tournament }: TournamentCardProps) => {
  const { id, name, location, startDate, endDate, status, imageUrl, selectionDeadline } = tournament;
  
  // Determine status label color
  const statusColor = {
    upcoming: 'from-green-700 to-green-500 text-green-700',
    active: 'from-red-700 to-red-500 text-red-700',
    completed: 'from-blue-700 to-blue-500 text-blue-700',
  }[status];
  
  // Format dates
  const formattedDateRange = `${format(new Date(startDate), 'MMMM d')}-${format(new Date(endDate), 'd, yyyy')}`;
  const deadlineDate = new Date(selectionDeadline);
  const isPastDeadline = deadlineDate < new Date();
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className={`h-40 bg-gradient-to-r ${statusColor} relative`}>
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt={name} 
            className="w-full h-full object-cover opacity-50"
          />
        )}
        <div className="absolute inset-0 p-4 flex flex-col justify-end">
          <span className={`bg-white px-2 py-1 rounded text-xs font-semibold inline-block w-min whitespace-nowrap mb-1 ${statusColor}`}>
            {status.toUpperCase()}
          </span>
          <h3 className="text-white text-xl font-bold">{name}</h3>
        </div>
      </div>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center text-sm text-gray-500 mb-3">
          <CalendarIcon className="h-4 w-4 mr-1" />
          {formattedDateRange}
        </div>
        <div className="flex items-center text-sm text-gray-500 mb-3">
          <MapPinIcon className="h-4 w-4 mr-1" />
          {location}
        </div>
        <div className="mb-3">
          {status === 'upcoming' && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isPastDeadline ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
              Selection deadline: {format(deadlineDate, 'MMMM d, yyyy')}
            </span>
          )}
          {status === 'active' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Currently active
            </span>
          )}
          {status === 'completed' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Tournament completed
            </span>
          )}
        </div>
      </div>
      <div className="p-4 flex justify-between items-center">
        <span className="text-gray-700 text-sm">
          {/* Player count would be fetched from API in a real implementation */}
          {Math.floor(Math.random() * 30) + 10} players selected
        </span>
        {status === 'upcoming' && !isPastDeadline && (
          <Button asChild variant="link" className="text-primary-600 hover:text-primary-700 p-0">
            <Link href="/selections">
              Make Selection
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
        {(status === 'active' || status === 'completed') && (
          <Button asChild variant="link" className="text-secondary-800 hover:text-secondary-700 p-0">
            <Link href="/leaderboard">
              View Leaderboard
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
        {status === 'upcoming' && isPastDeadline && (
          <Button asChild variant="link" className="text-gray-500 hover:text-gray-700 p-0">
            <Link href={`/tournaments?id=${id}`}>
              View Details
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default TournamentCard;
