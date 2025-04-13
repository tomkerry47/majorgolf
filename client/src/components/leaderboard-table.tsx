import { useState, Fragment, useEffect, useRef, useCallback } from "react"; // Import Fragment, useEffect, useRef, useCallback
import { useQuery } from "@tanstack/react-query"; // Import useQuery
import { getAuthHeaders } from "@/lib/auth"; // Import auth helper
import { toJpeg } from 'html-to-image'; // Import html-to-image
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { Button } from "@/components/ui/button"; // Import Button
import { Download } from 'lucide-react'; // Import Download icon
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"; // Import AvatarImage as well

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
    points?: number | null; // Added points per golfer
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
  userId?: number; // ID of the currently logged-in user for highlighting
  displayMode: 'overall' | 'competition'; // Added prop to control display logic
  // competitionId is no longer directly needed here as context comes from displayMode/data
}

// Define interface for the detailed selection data we expect from the new fetch
// (Similar to ProfileSelections's EnrichedSelection, adjust as needed based on API)
interface UserSelectionHistoryEntry {
  id: number;
  competitionId: number;
  competition: { name: string; venue: string; startDate: string | null; endDate: string | null; isComplete: boolean; isActive: boolean; } | null;
  golfer1: { id: number; name: string; avatar: string | null; isCaptain: boolean; isWildcard: boolean; rank: number | null; waiverRank?: number | null; } | null;
  golfer2: { id: number; name: string; avatar: string | null; isCaptain: boolean; isWildcard: boolean; rank: number | null; waiverRank?: number | null; } | null;
  golfer3: { id: number; name: string; avatar: string | null; isCaptain: boolean; isWildcard: boolean; rank: number | null; waiverRank?: number | null; } | null;
  golfer1Result: { position: number; points: number | null } | null;
  golfer2Result: { position: number; points: number | null } | null;
  golfer3Result: { position: number; points: number | null } | null;
  totalPoints: number;
  useCaptainsChip: boolean; // Added
}

const LeaderboardTable = ({ data, isLoading, userId, displayMode }: LeaderboardTableProps) => {
  const auth = useAuth(); // Get auth context
  const tableRef = useRef<HTMLTableElement>(null); // Ref for the table element
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null); // State for expanded row
  const itemsPerPage = 30; // Changed from 10 to 30
  const [isExporting, setIsExporting] = useState(false); // State for export loading

  // --- State and Fetching for Overall Expanded View ---
  const {
    data: expandedUserData,
    isLoading: isLoadingExpanded,
    error: errorExpanded,
    refetch: refetchExpandedUser // Function to trigger fetch
  } = useQuery<UserSelectionHistoryEntry[], Error>({
    // Use a dynamic query key based on the expanded user ID
    queryKey: ['userSelectionsHistory', expandedRowId],
    queryFn: async ({ queryKey }) => {
      const [, userIdToFetch] = queryKey;
      if (!userIdToFetch) {
        // Should not happen if enabled is set correctly, but good practice
        throw new Error("No user ID provided for fetching history.");
      }
      console.log(`[LeaderboardTable] Fetching selection history for user ID: ${userIdToFetch}`);
      // *** IMPORTANT: This API endpoint needs to be created on the backend ***
      const response = await fetch(`/api/users/${userIdToFetch}/selections/all`, {
        headers: getAuthHeaders(), // Assuming auth might be needed
        credentials: 'include'
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LeaderboardTable] Fetch failed for user ${userIdToFetch}:`, response.status, errorText);
        throw new Error(`Failed to fetch user selection history: ${response.status} ${errorText}`);
      }
      const jsonData = await response.json();
      console.log(`[LeaderboardTable] Fetch successful for user ${userIdToFetch}, received ${jsonData?.length ?? 0} selections.`);
      return jsonData;
    },
    enabled: false, // Initially disable, enable only when a row is expanded in 'overall' mode
    retry: false, // Don't retry automatically on error for this pattern
    staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep data in cache for 10 minutes even if unused
  });

  // Effect to trigger fetch when expandedRowId changes in 'overall' mode
  useEffect(() => {
    if (displayMode === 'overall' && expandedRowId !== null) {
      console.log(`[LeaderboardTable] Overall mode expansion detected for user ${expandedRowId}. Triggering fetch.`);
      refetchExpandedUser(); // Trigger the fetch
    }
  }, [expandedRowId, displayMode, refetchExpandedUser]);
  // --- End State and Fetching ---

  // --- JPEG Export Function ---
  const handleExportJpeg = useCallback(async () => {
    if (!tableRef.current) {
      console.error("Table ref not found for export.");
      // Optionally show a user-facing error message
      return;
    }
    if (isExporting) return; // Prevent multiple clicks

    setIsExporting(true);
    console.log("Starting JPEG export...");

    try {
      // Ensure background is white for better image quality
      const dataUrl = await toJpeg(tableRef.current, {
        quality: 0.95,
        backgroundColor: 'white',
        // Consider adding pixelRatio for higher resolution if needed:
        // pixelRatio: window.devicePixelRatio || 1,
        // Filter out elements you don't want in the image (e.g., expansion rows if open)
        // filter: (node) => {
        //   // Example: Exclude expanded rows if needed
        //   // return !node.classList?.contains('expanded-row-class'); // Add a class to expanded rows if needed
        //   return true; // Include everything by default
        // }
      });

      const link = document.createElement('a');
      // Dynamic filename based on display mode
      const filename = `${displayMode}-leaderboard-${new Date().toISOString().split('T')[0]}.jpeg`;
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link); // Required for Firefox
      link.click();
      document.body.removeChild(link); // Clean up
      console.log("JPEG export successful.");

    } catch (err) {
      console.error('Oops, something went wrong!', err);
      // Optionally show a user-facing error message
    } finally {
      setIsExporting(false);
      console.log("Finished JPEG export attempt.");
    }
  }, [tableRef, isExporting, displayMode]); // Include isExporting and displayMode in dependencies
  // --- End JPEG Export Function ---

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
                  {/* Points column header - adjusted name based on mode */}
                  <TableHead className="w-24 text-center">{displayMode === 'overall' ? 'Last Event Pts' : 'Points'}</TableHead>
                  {/* Conditionally render Total Points Header */}
                  {displayMode === 'overall' && <TableHead className="w-24 text-center">Total Points</TableHead>}
                  {/* Conditionally render Chips Header */}
                  {displayMode === 'overall' && <TableHead className="w-24 text-center">Chips Used</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}> {/* Ensure unique key */}
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
                   {/* Last Event Points Skeleton */}
                   <TableCell className="text-center"><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                   {/* Conditionally render Total Points Skeleton */}
                   {displayMode === 'overall' && <TableCell className="text-center"><Skeleton className="h-6 w-16 rounded-full" /></TableCell>}
                   {/* Conditionally render Chips Skeleton */}
                   {displayMode === 'overall' && <TableCell className="text-center"><Skeleton className="h-5 w-10" /></TableCell>}
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
      <div className="overflow-x-auto" > {/* Add ref here if you want scrollable area */}
        {/* Removed table-fixed */}
        {/* Add ref={tableRef} to the Table component */}
        <Table ref={tableRef}>
          <TableHeader>
            <TableRow>
              {/* Set fixed width for Rank */}
              <TableHead className="w-9">Rank</TableHead>
                {/* Removed width constraints for Player */}
                <TableHead>Player</TableHead>
                {/* Conditionally render Selections Header with responsive min-width */}
                {displayMode === 'competition' && <TableHead className="min-w-[200px] sm:min-w-[250px] md:min-w-[300px]">Selections</TableHead>}
                {/* Points column header - adjusted name based on mode */}
                <TableHead className="w-24 text-center">{displayMode === 'overall' ? 'Last Event Pts' : 'Points'}</TableHead>
                {/* Conditionally render Total Points Header */}
                {displayMode === 'overall' && <TableHead className="w-24 text-center">Total Points</TableHead>}
                {/* Conditionally render Chips Header with fixed width */}
                {displayMode === 'overall' && <TableHead className="w-24 text-center">Chips Used</TableHead>}
              </TableRow>
              </TableHeader>
            <TableBody>
              {currentItems.map((entry) => {
                const isExpanded = expandedRowId === entry.userId;
                // Allow expanding in both modes now
                const canExpand = true;

                return (
                  <Fragment key={entry.userId}>
                    <TableRow
                      className={`
                        ${entry.rank === 1 ? 'bg-amber-50 border-l-4 border-amber-500' : ''}
                        ${entry.userId === userId ? 'bg-gray-50 border-l-4 border-primary-600' : ''}
                        ${canExpand ? 'cursor-pointer hover:bg-gray-100' : ''}
                        ${isExpanded ? 'border-b-0' : ''} {/* Remove bottom border if expanded */}
                      `}
                      onClick={() => {
                        // Toggle expansion regardless of mode
                        setExpandedRowId(isExpanded ? null : entry.userId);
                      }}
                    >
                      {/* Apply width class to rank cell */}
                      <TableCell className="font-medium w-9">{entry.rank}</TableCell>
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
                 {/* Last Event Pts Cell - Style changes based on mode */}
                 <TableCell className="text-center">
                   {/* Conditionally render last points change, checking for null/undefined */}
                   {entry.lastPointsChange !== undefined && entry.lastPointsChange !== null ? (
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full tabular-nums
                      ${displayMode === 'overall'
                        ? 'bg-orange-100 text-orange-800' /* Orange style for overall view */
                        : entry.lastPointsChange > 0 /* Green/Red/Gray for competition view */
                          ? 'bg-green-100 text-green-800'
                          : entry.lastPointsChange < 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                      {entry.lastPointsChange > 0 ? '+' : ''}{entry.lastPointsChange}
                    </span>
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      -
                     </span> // Display dash if null/undefined
                    )}
                 </TableCell>
                 {/* Conditionally render Total Points Cell for overall mode with Green/Red/Gray bubble */}
                 {displayMode === 'overall' && (
                   <TableCell className="text-center">
                     <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full tabular-nums
                       ${entry.points > 0
                         ? 'bg-green-100 text-green-800'
                         : entry.points < 0 // Handle potential negative total points
                           ? 'bg-red-100 text-red-800'
                           : 'bg-gray-100 text-gray-800' // Handle 0 total points
                       }`}>
                       {entry.points > 0 ? '+' : ''}{entry.points} {/* Display the total points with sign */}
                     </span>
                   </TableCell>
                 )}
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
                    {/* Expanded Row - Conditional Rendering based on mode */}
                    {isExpanded && (
                      <TableRow className="bg-gray-50 border-t-0">
                        {/* Adjust colSpan based on displayMode */}
                        <TableCell colSpan={displayMode === 'overall' ? 5 : 4} className="p-3">
                          {/* --- Competition Mode Expanded View --- */}
                          {displayMode === 'competition' && (
                            <div className="text-sm">
                              <h4 className="font-semibold mb-1 text-gray-700">Selections for this Competition:</h4>
                              {entry.selections && entry.selections.length > 0 ? (
                                <ul className="list-disc pl-5 space-y-1">
                                  {entry.selections.map((selection, idx) => {
                                    const isRankWildcard = typeof selection.rank === 'number' && selection.rank > 50;
                                    const points = selection.points ?? null;
                                    // Calculate displayed points (doubled if captain or rank wildcard)
                                    const displayedPoints = points !== null ? points * (selection.isCaptain || isRankWildcard ? 2 : 1) : null;

                                    return (
                                      <li key={selection.playerId || idx} className="text-gray-600">
                                        {selection.playerName}
                                        {/* Display Position */}
                                        {selection.position === 0 ? ' (MC)' : selection.position != null ? ` (${selection.position}${getOrdinalSuffix(selection.position)})` : ''}
                                        {/* Display Points if available */}
                                        {displayedPoints !== null && (
                                          <span className="ml-1.5 font-medium text-sm">
                                            ({displayedPoints > 0 ? '+' : ''}{displayedPoints} Pts)
                                          </span>
                                        )}
                                        {/* Badges */}
                                        {selection.isCaptain && (
                                          <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0.5 bg-green-100 text-green-800 border-green-300">Captain</Badge>
                                        )}
                                        {selection.isWaiver && (
                                          <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0.5 bg-blue-100 text-blue-800 border-blue-300">Waiver</Badge>
                                        )}
                                        {isRankWildcard && (
                                          <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0.5 bg-orange-100 text-orange-800 border-orange-300">Wildcard</Badge>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="text-gray-500 italic">No selections made for this competition.</p>
                              )}
                            </div>
                          )}
                          {/* --- Overall Mode Expanded View --- */}
                          {displayMode === 'overall' && (
                            <div className="text-sm">
                              <h4 className="font-semibold mb-1 text-gray-700">Selection History:</h4>
                              {isLoadingExpanded && (
                                <div className="flex items-center justify-center py-4">
                                  <Skeleton className="h-5 w-24" />
                                  <span className="ml-2">Loading history...</span>
                                </div>
                              )}
                              {errorExpanded && (
                                <p className="text-destructive text-center py-4">Error loading history: {errorExpanded.message}</p>
                              )}
                              {!isLoadingExpanded && !errorExpanded && expandedUserData && expandedUserData.length > 0 && (
                                // Render the fetched history (simple list for now, can be enhanced)
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                  {expandedUserData.map((compSelection) => (
                                    <div key={compSelection.id} className="border-b pb-2 last:border-b-0">
                                      <p className="font-medium text-gray-800">{compSelection.competition?.name || 'Unknown Competition'}</p>
                                      <ul className="list-disc pl-5 mt-1 text-xs space-y-0.5">
                                        {[compSelection.golfer1, compSelection.golfer2, compSelection.golfer3].map((golfer, gIdx) => {
                                          if (!golfer) return null;
                                          const result = gIdx === 0 ? compSelection.golfer1Result : gIdx === 1 ? compSelection.golfer2Result : compSelection.golfer3Result;
                                          const points = result?.points ?? null;
                                          const isRankWildcard = typeof golfer.rank === 'number' && golfer.rank > 50;
                                          const displayedPoints = points !== null ? points * (golfer.isCaptain || isRankWildcard ? 2 : 1) : null;

                                          return (
                                            <li key={golfer.id} className="text-gray-600">
                                              {golfer.name}
                                              {result?.position === 0 ? ' (MC)' : result?.position != null ? ` (${result.position}${getOrdinalSuffix(result.position)})` : ''}
                                              {displayedPoints !== null && ` (${displayedPoints > 0 ? '+' : ''}${displayedPoints} Pts)`}
                                              {golfer.isCaptain && <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0.5 bg-green-100 text-green-800 border-green-300">C</Badge>}
                                              {golfer.isWildcard && <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0.5 bg-blue-100 text-blue-800 border-blue-300">W</Badge>}
                                              {isRankWildcard && <Badge variant="outline" className="ml-1.5 text-xs px-1 py-0.5 bg-orange-100 text-orange-800 border-orange-300">*</Badge>}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                      <p className="text-right text-xs font-semibold mt-1">Total: {compSelection.totalPoints || 0} Pts</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!isLoadingExpanded && !errorExpanded && (!expandedUserData || expandedUserData.length === 0) && (
                                <p className="text-gray-500 italic text-center py-4">No selection history found.</p>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
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

      {/* Admin Export Button - Show for admins in either view */}
      {auth?.isAdmin && (
        <div className="px-4 py-3 border-t border-gray-200 sm:px-6 flex justify-end">
          <Button
            onClick={handleExportJpeg}
            disabled={isExporting || isLoading} // Disable while exporting or loading data
            variant="outline"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export as JPEG'}
          </Button>
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
