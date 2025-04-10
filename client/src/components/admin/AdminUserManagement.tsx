import React, { useState, useEffect } from 'react'; // Import useEffect
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import EditUserModal from './EditUserModal';
import ViewUserSelectionsModal from './ViewUserSelectionsModal'; // Import the selections modal
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast'; // Import useToast
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components
import type { User } from '@shared/schema'; // Assuming User type is defined here

// Define a more detailed user type for the admin view
interface AdminUser extends User {
  lastLoginAt?: string | null; // Add last login time
  hasUsedCaptainsChip?: boolean; // Add captain chip status
  // hasUsedWaiverChip is already defined in the base User interface as boolean
  // TODO: Add field for selections (might be an array or specific structure)
}

const AdminUserManagement: React.FC = () => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewSelectionsModalOpen, setIsViewSelectionsModalOpen] = useState(false); // State for selections modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null); // User for editing or viewing selections
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [userToReset, setUserToReset] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const queryClient = useQueryClient(); // Get query client instance
  const { toast } = useToast(); // Get toast function

  // Fetch all users (adjust endpoint if needed)
  const { data: users, isLoading, error } = useQuery<AdminUser[]>({ // Removed refetch, rely on invalidation
    queryKey: ['/api/admin/users/details'], // Use a new endpoint for detailed user info
    queryFn: () => apiRequest<AdminUser[]>('/api/admin/users/details'),
  });

  // Force refetch on mount to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/users/details'] });
  }, [queryClient]);


  // Mutation for resetting password
  const resetPasswordMutation = useMutation({
    mutationFn: (userId: number) => apiRequest(`/api/admin/users/${userId}/reset-password`, 'POST'),
    onSuccess: (data: any) => { // Expect data with temporaryPassword
      setNewPassword(data.temporaryPassword); // Store the new password to display
      // No need to invalidate user list query as password isn't shown
      toast({
        title: "Password Reset Successful",
        description: `Password for ${userToReset?.username} has been reset.`,
      });
      // Keep the confirmation dialog open to show the password
    },
    onError: (error: any) => {
      toast({
        title: "Password Reset Failed",
        description: error.response?.data?.error || error.message || "Could not reset password.",
        variant: "destructive",
      });
      setShowResetConfirm(false); // Close dialog on error
      setUserToReset(null);
    },
  });

  const handleEditClick = (user: AdminUser) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const handleViewSelectionsClick = (user: AdminUser) => {
    setSelectedUser(user); // Use the same state for the user context
    setIsViewSelectionsModalOpen(true);
  };

  const handleCloseViewSelectionsModal = () => {
    setIsViewSelectionsModalOpen(false);
    setSelectedUser(null);
  };

  const handleResetPasswordClick = (user: AdminUser) => {
    setUserToReset(user);
    setNewPassword(null); // Clear previous password if any
    setShowResetConfirm(true);
  };

  const confirmPasswordReset = () => {
    if (userToReset) {
      resetPasswordMutation.mutate(userToReset.id);
    }
    // Don't close the dialog immediately, wait for onSuccess to show password
  };

  const closeResetDialog = () => {
    setShowResetConfirm(false);
    setUserToReset(null);
    setNewPassword(null);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage registered users.</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full mb-4" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Failed to load users: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>View and manage registered users.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Selections</TableHead> {/* Placeholder */}
              <TableHead>Captain's Chip</TableHead> {/* Added Captain's Chip column */}
              <TableHead>Waiver Chip</TableHead> {/* Placeholder */}
              <TableHead>Admin Status</TableHead> {/* Added Admin Status column */}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users && users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {/* Placeholder for Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} className="h-8 w-8 rounded-full" />
                      ) : (
                        <span className="text-xs font-medium text-gray-600">
                          {user.username?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  {/* Format the lastLoginAt timestamp */}
                  <TableCell>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</TableCell> 
                  {/* Button to view selections */}
                  <TableCell>
                    <Button variant="link" size="sm" onClick={() => handleViewSelectionsClick(user)} disabled={(user.selectionCount ?? 0) === 0}>
                      View ({user.selectionCount ?? 0})
                    </Button>
                  </TableCell>
                  <TableCell>{user.hasUsedCaptainsChip ? 'Used' : 'Available'}</TableCell> {/* Display Captain's Chip status */}
                  <TableCell> {user.hasUsedWaiverChip ? 'Used' : 'Available'} </TableCell>
                  <TableCell>{user.isAdmin ? 'Yes' : 'No'}</TableCell> {/* Display Admin Status */}
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(user)}>Edit</Button>
                      {/* Use AlertDialogTrigger for the reset button */}
                      <AlertDialog open={showResetConfirm && userToReset?.id === user.id} onOpenChange={(open) => { if (!open) closeResetDialog(); }}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" onClick={() => handleResetPasswordClick(user)}>Reset PW</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Password for {userToReset?.username}?</AlertDialogTitle>
                            {newPassword ? (
                              <AlertDialogDescription>
                                Password has been reset. The temporary password is:
                                <strong className="block text-lg my-2 p-2 bg-muted rounded">{newPassword}</strong>
                                Please provide this to the user immediately. They should change it upon next login.
                              </AlertDialogDescription>
                            ) : (
                              <AlertDialogDescription>
                                This action cannot be undone. A new temporary password will be generated.
                              </AlertDialogDescription>
                            )}
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            {newPassword ? (
                              <AlertDialogAction onClick={closeResetDialog}>Close</AlertDialogAction>
                            ) : (
                              <>
                                <AlertDialogCancel onClick={closeResetDialog}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmPasswordReset} disabled={resetPasswordMutation.isPending}>
                                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
                                </AlertDialogAction>
                              </>
                            )}
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center">No users found.</TableCell> {/* Adjusted colSpan */}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      {/* Render the modals */}
      <EditUserModal
        user={selectedUser}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
      />
      <ViewUserSelectionsModal
        user={selectedUser}
        isOpen={isViewSelectionsModalOpen}
        onClose={handleCloseViewSelectionsModal}
      />
    </Card>
  );
};

export default AdminUserManagement;
