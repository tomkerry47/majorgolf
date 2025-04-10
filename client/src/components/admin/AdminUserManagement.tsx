import React, { useState, useEffect } from 'react'; // Import useEffect
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import EditUserModal from './EditUserModal';
import CreateUserModal from './CreateUserModal'; // Import the create modal
import ViewUserSelectionsModal from './ViewUserSelectionsModal'; // Import the selections modal
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
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
  hasPaid: boolean; // Ensure hasPaid is included (already added in schema.ts)
  // hasUsedWaiverChip is already defined in the base User interface as boolean
  // TODO: Add field for selections (might be an array or specific structure)
}

const AdminUserManagement: React.FC = () => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false); // State for create modal
  const [isViewSelectionsModalOpen, setIsViewSelectionsModalOpen] = useState(false); // State for selections modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null); // User for editing or viewing selections
  // const [showResetConfirm, setShowResetConfirm] = useState(false); // Remove this state, use userToReset directly
  const [userToReset, setUserToReset] = useState<AdminUser | null>(null);
  // const [newPassword, setNewPassword] = useState<string | null>(null); // Remove state for displaying password in dialog

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
      console.log("Received temporary password:", data.temporaryPassword);
      // setNewPassword(data.temporaryPassword); // Don't store in state for dialog
      toast({
        title: "Password Reset Successful",
        // Display password in the toast description
        description: `Password for ${userToReset?.username} reset. Temp PW: ${data.temporaryPassword}`,
        duration: 9000 // Increase duration to allow reading the password
      });
      closeResetDialog(); // Close the dialog on success
    },
    onError: (error: any) => {
      toast({
        title: "Password Reset Failed",
        description: error.response?.data?.error || error.message || "Could not reset password.",
        variant: "destructive",
      });
      // setShowResetConfirm(false); // Close dialog on error - handled by setting userToReset to null
      setUserToReset(null); // Also closes dialog on error
    },
  });

  // Mutation for updating user details (including hasPaid)
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: Partial<AdminUser> }) =>
      apiRequest(`/api/admin/users/${userId}`, 'PATCH', data),
    onSuccess: (updatedUser: AdminUser) => {
      // Invalidate the users query to refetch and update the table
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/details'] });
      toast({
        title: "User Updated",
        description: `User ${updatedUser.username} has been updated.`,
      });
    },
    onError: (error: any, variables) => {
      toast({
        title: "Update Failed",
        description: `Could not update user ${variables.userId}: ${error.response?.data?.error || error.message}`,
        variant: "destructive",
      });
      // Optionally refetch to revert optimistic updates if implemented
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/details'] });
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

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
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
    // setNewPassword(null); // No longer needed
  };

  const confirmPasswordReset = () => {
    if (userToReset) {
      resetPasswordMutation.mutate(userToReset.id);
      // Let onSuccess or onError handle closing the dialog via setUserToReset(null)
    }
  };

  const closeResetDialog = () => {
    setUserToReset(null);
    // setNewPassword(null); // No longer needed
  }

  // Handler for changing the 'hasPaid' status
  const handlePaidChange = (userId: number, currentStatus: boolean) => {
    updateUserMutation.mutate({ userId, data: { hasPaid: !currentStatus } });
  };


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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View, manage, and create registered users.</CardDescription>
        </div>
        <Button onClick={handleOpenCreateModal}>Create User</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Selections</TableHead>
              <TableHead>Captain's Chip</TableHead>
              <TableHead>Waiver Chip</TableHead>
              <TableHead>Paid Status</TableHead> {/* Added Paid Status column */}
              <TableHead>Admin Status</TableHead>
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
                  <TableCell>{user.hasUsedCaptainsChip ? 'Used' : 'Available'}</TableCell>
                  <TableCell> {user.hasUsedWaiverChip ? 'Used' : 'Available'} </TableCell>
                  {/* Paid Status Checkbox */}
                  <TableCell>
                    <Checkbox
                      id={`paid-${user.id}`}
                      checked={user.hasPaid}
                      onCheckedChange={() => handlePaidChange(user.id, user.hasPaid)}
                      disabled={updateUserMutation.isPending && updateUserMutation.variables?.userId === user.id} // Disable while updating this user
                    />
                  </TableCell>
                  <TableCell>{user.isAdmin ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(user)}>Edit</Button>
                      {/* Use AlertDialogTrigger for the reset button - open controlled by userToReset state */}
                      <AlertDialog open={userToReset?.id === user.id} onOpenChange={(open) => { if (!open) closeResetDialog(); }}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" onClick={() => handleResetPasswordClick(user)}>Reset PW</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Password for {userToReset?.username}?</AlertDialogTitle>
                            {/* Always show the confirmation message */}
                            <AlertDialogDescription>
                              This action cannot be undone. A new temporary password will be generated and shown in a notification.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            {/* Always show Cancel and Confirm */}
                            <>
                              <AlertDialogCancel onClick={closeResetDialog}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={confirmPasswordReset} disabled={resetPasswordMutation.isPending}>
                                {resetPasswordMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
                              </AlertDialogAction>
                            </>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center">No users found.</TableCell> {/* Adjusted colSpan */}
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
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
      />
    </Card>
  );
};

export default AdminUserManagement;
