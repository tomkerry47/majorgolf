import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Define leaderboard entry type
interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  email: string;
  avatarUrl?: string;
  points: number;
  selections: {
    playerName: string;
    position?: number;
  }[];
  lastPointsChange: number;
}

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
  userId?: number;
}

const LeaderboardTable = ({ data, isLoading, userId }: LeaderboardTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Calculate pagination
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
  
  // Generate page numbers
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }
  
  // Helper to handle pagination display
  const getPageNumbers = () => {
    const result = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Always show first page
    result.push(1);
    
    // Calculate middle pages
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);
    
    // Adjust if at the start or end
    if (currentPage <= 2) {
      endPage = Math.min(totalPages - 1, maxPagesToShow - 1);
    } else if (currentPage >= totalPages - 1) {
      startPage = Math.max(2, totalPages - maxPagesToShow + 2);
    }
    
    // Add ellipsis after first page if needed
    if (startPage > 2) {
      result.push('ellipsis1');
    }
    
    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      result.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      result.push('ellipsis2');
    }
    
    // Always show last page
    if (totalPages > 1) {
      result.push(totalPages);
    }
    
    return result;
  };
  
  // Render loading skeletons
  if (isLoading) {
    return (
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Selections</TableHead>
                <TableHead>Last Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Skeleton className="h-8 w-8 rounded-full mr-4" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
  
  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow-md rounded-lg overflow-hidden p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900">No leaderboard data available</h3>
        <p className="mt-2 text-gray-500">Check back once players have made their selections.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Selections</TableHead>
              <TableHead>Last Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((entry) => (
              <TableRow 
                key={entry.userId}
                className={`
                  ${entry.rank === 1 ? 'bg-amber-50 border-l-4 border-amber-500' : ''}
                  ${entry.userId === userId ? 'bg-gray-50 border-l-4 border-primary-600' : ''}
                `}
              >
                <TableCell className="font-medium">{entry.rank}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-4">
                      {entry.avatarUrl && <img src={entry.avatarUrl} alt={entry.username} />}
                      <AvatarFallback className="bg-primary-600 text-white">
                        {entry.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{entry.username}</div>
                      <div className="text-sm text-gray-500">@{entry.username.toLowerCase().replace(/\s+/g, '')}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">{entry.points}</TableCell>
                <TableCell className="text-sm text-gray-500">
                  {entry.selections.map((selection, idx) => (
                    <span key={idx} className={idx === 0 && selection.position === 1 ? 'text-green-700 font-medium' : ''}>
                      {selection.playerName}
                      {selection.position && ` (${selection.position}${getOrdinalSuffix(selection.position)})`}
                      {idx < entry.selections.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${entry.lastPointsChange > 0 
                      ? 'bg-green-100 text-green-800' 
                      : entry.lastPointsChange < 0 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                    {entry.lastPointsChange > 0 ? '+' : ''}{entry.lastPointsChange}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {totalPages > 1 && (
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <PaginationLink 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </PaginationLink>
              <PaginationLink 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </PaginationLink>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{" "}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, data.length)}
                  </span>{" "}
                  of <span className="font-medium">{data.length}</span> players
                </p>
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    />
                  </PaginationItem>
                  
                  {getPageNumbers().map((page, idx) => (
                    page === 'ellipsis1' || page === 'ellipsis2' ? (
                      <PaginationItem key={`ellipsis-${idx}`}>
                        <span className="pagination-ellipsis">&hellip;</span>
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={page}>
                        <PaginationLink 
                          onClick={() => setCurrentPage(Number(page))}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get ordinal suffix
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) {
    return "st";
  }
  if (j === 2 && k !== 12) {
    return "nd";
  }
  if (j === 3 && k !== 13) {
    return "rd";
  }
  return "th";
}

export default LeaderboardTable;
