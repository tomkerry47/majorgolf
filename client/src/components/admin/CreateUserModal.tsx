import React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Checkbox import removed
import {
  Dialog, // Re-add Dialog import
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Define Zod schema for the create user form
const createUserSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  username: z.string().min(3, { message: 'Username must be at least 3 characters' }),
  fullName: z.string().min(1, { message: 'Full name is required' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  // isAdmin field removed from schema
});

type CreateUserFormData = Omit<z.infer<typeof createUserSchema>, 'isAdmin'>; // Omit isAdmin from type

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormData>({ // Use updated type
    resolver: zodResolver(createUserSchema),
    // No need for isAdmin in defaultValues
  });

  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserFormData) => apiRequest('/api/admin/users', 'POST', data),
    onSuccess: (newUser) => {
      toast({
        title: 'User Created',
        description: `User ${newUser.username} created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/details'] }); // Refresh user list
      reset(); // Reset form fields
      onClose(); // Close modal
    },
    onError: (error: any) => {
      toast({
        title: 'Creation Failed',
        description: error.response?.data?.error || error.message || 'Could not create user.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit: SubmitHandler<CreateUserFormData> = (data) => {
    createUserMutation.mutate(data);
  };

  // Reset form when modal is closed
  React.useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Try a larger max-width */}
      <DialogContent className="sm:max-w-lg"> 
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        {/* Ensure form takes full width */}
        {/* Use a simpler vertical grid layout */}
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          {/* Email */}
          <div className="grid gap-2"> {/* Group label and input */}
            <Label htmlFor="email">Email</Label>
            <Input id="email" {...register('email')} />
            {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          </div>

          {/* Username */}
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" {...register('username')} />
            {errors.username && <p className="text-red-500 text-sm">{errors.username.message}</p>}
          </div>

          {/* Full Name */}
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" {...register('fullName')} />
            {errors.fullName && <p className="text-red-500 text-sm">{errors.fullName.message}</p>}
          </div>

          {/* Password */}
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
          </div>

          {/* Is Admin Checkbox Removed */}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserModal;
