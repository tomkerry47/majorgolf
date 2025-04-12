import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query'; // Removed useMutation, useQueryClient
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog"; // Removed Dialog components as they are no longer needed
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  isAdmin: boolean;
  hasUsedWaiverChip: boolean;
  // Add fields for waiver details (populated by the updated API)
  waiverCompetitionName?: string | null;
  waiverOriginalGolferName?: string | null;
  waiverReplacementGolferName?: string | null;
}

export default function AdminWaiverChips() {
  const { toast } = useToast();
  // Removed queryClient as mutation is gone
  // Removed confirmDialogOpen and selectedUser states
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all users (now includes waiver details)
  const { data: users = [], isLoading, error } = useQuery<User[]>({ // Updated User type usage
    queryKey: ['/api/admin/users'],
    queryFn: () => apiRequest<User[]>('/api/admin/users'),
  });

  // Removed mutation and related handlers (markWaiverUsedMutation, handleMarkWaiverUsed, confirmMarkWaiverUsed)

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waiver Chip Management</CardTitle>
          <CardDescription>Loading user data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waiver Chip Management</CardTitle>
          <CardDescription>Error loading users</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Failed to load users. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waiver Chip Status</CardTitle>
        <CardDescription>
          View the status of each user's waiver chip. Usage is now handled via Admin Selections.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Label htmlFor="search">Search Users</Label>
          <Input
            id="search"
            placeholder="Search by name, username or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
           />
         </div>

         <div className="overflow-x-auto"> {/* Added wrapper */}
           <Table>
             <TableCaption>List of users and their waiver chip status</TableCaption>
             <TableHeader>
               <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Waiver Chip Status / Details</TableHead> 
              {/* Removed Actions column */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">No users found</TableCell> {/* Adjusted colSpan */}
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="flex items-center space-x-2">
                    <Avatar>
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.fullName}</div>
                      <div className="text-sm text-muted-foreground">@{user.username}</div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.hasUsedWaiverChip ? (
                      <div>
                        <Badge variant="destructive" className="mb-1">Used</Badge>
                        <div className="text-xs text-muted-foreground">
                          Comp: {user.waiverCompetitionName || 'N/A'}<br/>
                          Out: {user.waiverOriginalGolferName || 'N/A'}<br/>
                          In: {user.waiverReplacementGolferName || 'N/A'}
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Available
                      </Badge>
                    )}
                  </TableCell>
                  {/* Removed Actions cell */}
                </TableRow>
              ))
            )}
           </TableBody>
         </Table>
         </div> {/* Close wrapper */}
       </CardContent>
       {/* Removed Confirmation Dialog */}
    </Card>
  );
}
