import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge'; // Import Badge
import type { User } from '@shared/schema';

// Define the shape of the user data passed to the modal
interface AdminUser extends User {
  lastLoginAt?: string | null;
  selectionCount?: number;
}

// Define the shape of the detailed selection data expected from the API
interface SelectionDetail {
  selectionId: number;
  competitionId: number;
  competitionName: string;
  competitionStartDate: string | null;
  isCompetitionComplete: boolean;
  golfer1: { id: number; name: string; rank?: number | null; result?: { position: number; points?: number | null } | null } | null;
  golfer2: { id: number; name: string; rank?: number | null; result?: { position: number; points?: number | null } | null } | null;
  golfer3: { id: number; name: string; rank?: number | null; result?: { position: number; points?: number | null } | null } | null;
  useCaptainsChip: boolean;
  captainGolferId?: number | null;
  totalPoints: number;
}

interface ViewUserSelectionsModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
}

const ViewUserSelectionsModal: React.FC<ViewUserSelectionsModalProps> = ({ user, isOpen, onClose }) => {
  const { data: selections, isLoading, error } = useQuery<SelectionDetail[]>({
    queryKey: ['/api/admin/users', user?.id, 'selections'],
    queryFn: () => apiRequest<SelectionDetail[]>(`/api/admin/users/${user!.id}/selections`),
    enabled: !!user && isOpen, // Only fetch when the modal is open and a user is selected
  });

  if (!isOpen || !user) {
    return null;
  }

  const renderGolferCell = (golfer: SelectionDetail['golfer1'], isCaptain: boolean) => {
    if (!golfer) return <TableCell>N/A</TableCell>;
    return (
      <TableCell>
        {golfer.name} {golfer.rank ? `(#${golfer.rank})` : ''} {isCaptain && <Badge variant="secondary">C</Badge>}
        {golfer.result && (
          <span className="text-xs text-muted-foreground block">
            Pos: {golfer.result.position || 'N/A'}, Pts: {golfer.result.points ?? 'N/A'}
          </span>
        )}
      </TableCell>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl"> {/* Increased width */}
        <DialogHeader>
          <DialogTitle>Selections for {user.username}</DialogTitle>
          <DialogDescription>
            Viewing all competition selections made by this user.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto"> {/* Added scroll */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {error && <p className="text-red-500">Error loading selections: {error.message}</p>}
          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competition</TableHead>
                  <TableHead>Golfer 1</TableHead>
                  <TableHead>Golfer 2</TableHead>
                  <TableHead>Golfer 3</TableHead>
                  <TableHead>Total Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selections && selections.length > 0 ? (
                  selections.map((sel) => (
                    <TableRow key={sel.selectionId}>
                      <TableCell>
                        {sel.competitionName}
                        <span className="text-xs text-muted-foreground block">
                          {sel.competitionStartDate ? new Date(sel.competitionStartDate).toLocaleDateString() : ''}
                          {sel.isCompetitionComplete ? ' (Complete)' : ''}
                        </span>
                      </TableCell>
                      {renderGolferCell(sel.golfer1, sel.useCaptainsChip && sel.captainGolferId === sel.golfer1?.id)}
                      {renderGolferCell(sel.golfer2, sel.useCaptainsChip && sel.captainGolferId === sel.golfer2?.id)}
                      {renderGolferCell(sel.golfer3, sel.useCaptainsChip && sel.captainGolferId === sel.golfer3?.id)}
                      <TableCell>{sel.totalPoints}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">No selections found for this user.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ViewUserSelectionsModal;
