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
import { Badge } from "@/components/ui/badge"; // Import Badge
// Import AvatarImage as well
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// Define leaderboard entry type and export it
export interface LeaderboardEntry { // Added export
  rank: number;
  userId: number;
  username: string;
  email: string;
  avatarUrl?: string;
  points: number;
  selections?: { // Make selections optional and add chip flags
    playerId: number; // Keep player ID if needed
    playerName: string;
    position?: number;
    isCaptain: boolean; // Added
    isWaiver: boolean; // Added
    rank?: number | null; // Added rank
  }[];
  lastPointsChange?: number | null; // Allow null as well
  // User-level chip status might still be useful for other UI elements, keep them for now
  hasUsedCaptainsChip: boolean;
  hasUsedWaiverChip: boolean;
  // Add IDs needed for context if required later (though maybe not directly for display here)
  captainGolferId?: number | null;
  waiverReplacementGolferId?: number | null;
}

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
  userId?: number;
  displayMode: 'overall' | 'competition'; // Added prop to control display logic
}

const LeaderboardTable = ({ data, isLoading, userId, displayMode }: LeaderboardTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30; // Changed from 10 to 30
  
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
                  {/* Conditionally render Selections Header */}
                  {displayMode === 'competition' && <TableHead>Selections</TableHead>}
                  <TableHead>Points</TableHead> {/* Changed from "Last Points" */}
                  {/* Conditionally render Chips Header */}
                  {displayMode === 'overall' && <TableHead className="text-center">Chips Used</TableHead>} {/* Changed from "Chips" */}
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
                   {/* Conditionally render Selections Skeleton */}
                   {displayMode === 'competition' && <TableCell><Skeleton className="h-4 w-56" /></TableCell>}
                   <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                   {/* Conditionally render Chips Skeleton */}
                   {displayMode === 'overall' && <TableCell><Skeleton className="h-5 w-10" /></TableCell>}
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
        {/* Removed table-fixed */}
        <Table>
          <TableHeader>
            <TableRow>
              {/* Set fixed width for Rank */}
              <TableHead className="w-20">Rank</TableHead> 
                {/* Removed width constraints for Player */}
                <TableHead>Player</TableHead> 
                {/* Conditionally render Selections Header with responsive min-width */}
                {displayMode === 'competition' && <TableHead className="min-w-[200px] sm:min-w-[250px] md:min-w-[300px]">Selections</TableHead>}
                <TableHead className="w-20">Points</TableHead> {/* Changed from "Last Points" */}
                {/* Conditionally render Chips Header with fixed width */}
                {displayMode === 'overall' && <TableHead className="w-24 text-center">Chips Used</TableHead>} {/* Changed from "Chips" */}
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
                {/* Restored default padding */}
                <TableCell className="font-medium">{entry.rank}</TableCell> 
                {/* Restored default padding */}
                <TableCell> 
                  <div className="flex items-center">
                    {/* Reduced avatar size and margin */}
                    <Avatar className="h-8 w-8 mr-1 overflow-hidden flex-shrink-0">
                      {/* Use AvatarImage component */}
                      <AvatarImage src={entry.avatarUrl} alt={entry.username} className="object-cover" />
                      <AvatarFallback className="bg-primary-600 text-white">
                        {entry.username.slice(0, 2).toUpperCase()}
                     </AvatarFallback>
                     </Avatar>
                     {/* Added flex-1 and min-w-0 */}
                     <div className="flex-1 min-w-0">
                       {/* Removed badges from username display, removed nowrap */}
                       <div className="text-sm font-medium text-gray-900 truncate">{entry.username}</div>
                       <div className="text-sm text-gray-500 truncate">@{entry.username.toLowerCase().replace(/\s+/g, '')}</div>
                      </div>
                    </div>
                 </TableCell>
                 {/* Conditionally render Selections Cell */}
                 {displayMode === 'competition' && (
                   <TableCell className="text-sm text-gray-500">
                     {/* Check if selections exist and assign to a new variable */}
                  {(() => {
                    const selections = entry.selections; // Assign to new variable
                    if (selections && selections.length > 0) {
                      return selections.map((selection, idx) => {
                        const isRankWildcard = typeof selection.rank === 'number' && selection.rank > 50; // Check rank
                        return (
                          // Use a span for each selection to allow inline badges
                          <span key={selection.playerId || idx} className="mr-2 inline-flex items-center"> {/* Added key, mr-2, inline-flex, items-center */}
                            <span className={selection.position === 1 ? 'text-green-700 font-medium' : ''}> {/* Apply styling to name/position span */}
                              {selection.playerName}
                              {/* Display (MC) for position 0, otherwise format position */}
                              {selection.position === 0 ? ' (MC)' : selection.position != null ? ` (${selection.position}${getOrdinalSuffix(selection.position)})` : ''}
                            </span>
                            {/* Conditionally Add Badges next to the golfer name based on displayMode */}
                            {displayMode === 'competition' && selection.isCaptain && (
                              <Badge variant="outline" className="ml-1 text-xs px-1 py-0.5 bg-green-100 text-green-800 border-green-300">C</Badge>
                            )}
                            {displayMode === 'competition' && selection.isWaiver && (
                              <Badge variant="outline" className="ml-1 text-xs px-1 py-0.5 bg-blue-100 text-blue-800 border-blue-300">W</Badge>
                            )}
                            {/* Add Wildcard (*) badge */}
                            {displayMode === 'competition' && isRankWildcard && (
                              <Badge variant="outline" className="ml-1 text-xs px-1 py-0.5 bg-orange-100 text-orange-800 border-orange-300">*</Badge>
                            )}
                            {/* Add comma separator if not the last item */}
                            {idx < selections.length - 1 && <span className="ml-1">,</span>}
                          </span>
                        );
                      });
                    } else {
                      return <span>-</span>; // Display dash if no selections
                     }
                   })()}
                   </TableCell>
                 )}
                 <TableCell>
                   {/* Conditionally render last points change, checking for null/undefined */}
                   {entry.lastPointsChange !== undefined && entry.lastPointsChange !== null ? (
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${entry.lastPointsChange > 0
                        ? 'bg-green-100 text-green-800'
                        : entry.lastPointsChange < 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800' // Handle 0 points case
                      }`}>
                      {entry.lastPointsChange > 0 ? '+' : ''}{entry.lastPointsChange}
                    </span>
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      -
                     </span> // Display dash if null/undefined
                   )}
                 </TableCell>
                 {/* Conditionally render Chips Cell for overall mode */}
                 {displayMode === 'overall' && (
                   <TableCell className="text-center">
                     {entry.hasUsedCaptainsChip && (
                       <Badge variant="outline" className="mr-1 text-xs px-1.5 py-0.5 bg-green-100 text-green-800 border-green-300">C</Badge>
                     )}
                     {entry.hasUsedWaiverChip && (
                       <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 border-blue-300">W</Badge>
                     )}
                     {!entry.hasUsedCaptainsChip && !entry.hasUsedWaiverChip && (
                       <span className="text-gray-400">-</span>
                     )}
                   </TableCell>
                 )}
               </TableRow>
             ))}
          </TableBody>
        </Table>
      </div>
      
      {totalPages > 1 && (
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              {/* Removed disabled prop */}
              <PaginationLink 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                aria-disabled={currentPage === 1} // Use aria-disabled for accessibility
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} // Add styling for disabled state
              >
                Previous
              </PaginationLink>
              {/* Removed disabled prop */}
              <PaginationLink 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                aria-disabled={currentPage === totalPages} // Use aria-disabled for accessibility
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} // Add styling for disabled state
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
                    {/* Removed disabled prop */}
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      aria-disabled={currentPage === 1} // Use aria-disabled for accessibility
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} // Add styling for disabled state
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
                    {/* Removed disabled prop */}
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      aria-disabled={currentPage === totalPages} // Use aria-disabled for accessibility
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} // Add styling for disabled state
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
