import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { User } from '@shared/schema'; // Assuming User type is defined here

// Define the shape of the user data passed to the modal
interface AdminUser extends User {
  lastLoginAt?: string | null;
}

interface EditUserModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
}

// Validation schema for the edit form
const editUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  // avatarFile: z.instanceof(File).optional(), // For avatar upload
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false); // Add state for isAdmin

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: '',
      email: '',
      fullName: '',
    },
  });

  // Reset form when user changes or modal opens/closes
  useEffect(() => {
    if (user && isOpen) {
      form.reset({
        username: user.username,
        email: user.email,
        fullName: user.fullName || '', // Handle potentially missing fullName
      });
      setAvatarPreview(user.avatarUrl || null); // Set initial avatar preview
      setAvatarFile(null); // Clear any previously selected file
      setIsAdmin(user.isAdmin); // Initialize isAdmin state
    } else if (!isOpen) {
      form.reset({ username: '', email: '', fullName: '' }); // Clear form on close
      setAvatarPreview(null);
      setAvatarFile(null);
      setIsAdmin(false); // Reset isAdmin state
    }
  }, [user, isOpen, form]);

  // Mutation for updating user details (name, email, fullName)
  const updateUserMutation = useMutation({
    mutationFn: (data: Partial<EditUserFormValues>) => {
      if (!user) throw new Error('User not selected');
      // Only send changed fields
      const changedData: Partial<User> = {};
      if (data.username !== user.username) changedData.username = data.username;
      if (data.email !== user.email) changedData.email = data.email;
      if (data.fullName !== user.fullName) changedData.fullName = data.fullName;
      // Also include isAdmin if it changed
      if (isAdmin !== user.isAdmin) changedData.isAdmin = isAdmin;


      if (Object.keys(changedData).length === 0) {
        // If only avatar changed, we don't call this mutation
        return Promise.resolve(null); // Indicate no update needed here
      }
      console.log("Sending update data:", changedData); // Debug log
      return apiRequest(`/api/admin/users/${user.id}`, 'PATCH', changedData);
    },
    onError: (error: any) => {
      toast({
        title: 'Error Updating User',
        description: error.response?.data?.error || error.message || 'Could not update user details.',
        variant: 'destructive',
      });
    },
    // onSuccess handled in onSubmit after potential avatar upload
  });

  // Mutation for uploading avatar
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => {
      if (!user) throw new Error('User not selected');
      const formData = new FormData();
      formData.append('avatar', file);
      // Use the existing user avatar upload endpoint, but target the specific user ID
      // Use the new admin-specific endpoint
      return apiRequest(`/api/admin/users/${user.id}/avatar`, 'POST', formData);
    },
    onSuccess: (data: any) => { // Add type annotation for data if possible, otherwise use any
       // The response from the admin endpoint might include the updated user data
       const updatedUserData = data?.user;
       toast({ title: 'Avatar Uploaded', description: `Avatar for ${updatedUserData?.username || 'user'} updated successfully.` });
       // Update the user data in the cache or refetch
       queryClient.invalidateQueries({ queryKey: ['/api/admin/users/details'] });
       onClose(); // Close modal after successful upload
    },
    onError: (error: any) => {
      toast({
        title: 'Avatar Upload Failed',
        description: error.response?.data?.error || error.message || 'Could not upload avatar.',
        variant: 'destructive',
      });
    },
  });


  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: EditUserFormValues) => {
    if (!user) return;

    let detailsUpdated = false;
    let avatarUploadSuccess = true; // Assume success if no avatar change

    // 1. Update User Details (if changed)
    const changedData: Partial<User> = {};
    if (data.username !== user.username) changedData.username = data.username;
    if (data.email !== user.email) changedData.email = data.email;
    if (data.fullName !== user.fullName) changedData.fullName = data.fullName;
    // Check if isAdmin changed
    const isAdminChanged = isAdmin !== user.isAdmin;
    if (isAdminChanged) changedData.isAdmin = isAdmin;


    // Update if details OR isAdmin changed
    if (Object.keys(changedData).length > 0) {
       try {
         // Pass the combined changes (details + isAdmin)
         await updateUserMutation.mutateAsync(changedData);
         detailsUpdated = true;
       } catch (e) {
         // Error already handled by mutation's onError
         return; // Stop processing if details update fails
       }
    }

    // 2. Upload Avatar (if changed)
    if (avatarFile) {
      try {
        await uploadAvatarMutation.mutateAsync(avatarFile);
        // Success handled by mutation's onSuccess (which closes modal)
      } catch (e) {
        avatarUploadSuccess = false;
        // Error handled by mutation's onError
      }
    }

    // 3. Show success message and close modal if details updated and no avatar change OR if avatar upload was the only change and succeeded
     if ((detailsUpdated && !avatarFile) || (!detailsUpdated && avatarFile && avatarUploadSuccess)) {
        toast({ title: 'User Updated', description: 'User details saved successfully.' });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users/details'] });
        onClose();
     } else if (detailsUpdated && avatarFile && avatarUploadSuccess) {
        // If both updated, avatar success message/closure already happened
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users/details'] });
     }
  };

  if (!isOpen || !user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User: {user.username}</DialogTitle>
          <DialogDescription>
            Make changes to the user's profile. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          {/* Avatar Preview and Upload */}
          <div className="flex flex-col items-center gap-2">
             <Label>Avatar</Label>
             <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
               {avatarPreview ? (
                 <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
               ) : (
                 <span className="text-xl font-medium text-gray-500">
                   {user.username?.charAt(0)?.toUpperCase() || 'U'}
                 </span>
               )}
             </div>
             <Input
               id="avatarFile"
               type="file"
               accept="image/*"
               onChange={handleAvatarChange}
               className="text-sm"
             />
             {/* Display error for avatar if needed */}
          </div>

          {/* Username */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input
              id="username"
              {...form.register('username')}
              className="col-span-3"
            />
          </div>
          {form.formState.errors.username && (
            <p className="text-red-500 text-sm col-start-2 col-span-3">{form.formState.errors.username.message}</p>
          )}

          {/* Email */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              {...form.register('email')}
              className="col-span-3"
            />
          </div>
           {form.formState.errors.email && (
            <p className="text-red-500 text-sm col-start-2 col-span-3">{form.formState.errors.email.message}</p>
          )}

          {/* Full Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fullName" className="text-right">
              Full Name
            </Label>
            <Input
              id="fullName"
              {...form.register('fullName')}
              className="col-span-3"
            />
          </div>
           {form.formState.errors.fullName && (
            <p className="text-red-500 text-sm col-start-2 col-span-3">{form.formState.errors.fullName.message}</p>
          )}

          {/* Is Admin Checkbox */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isAdmin" className="text-right">
              Admin Status
            </Label>
            <div className="col-span-3 flex items-center space-x-2">
               <Checkbox
                 id="isAdmin"
                 checked={isAdmin}
                 onCheckedChange={(checked) => setIsAdmin(Boolean(checked))} // Update state on change
               />
               <label
                 htmlFor="isAdmin"
                 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
               >
                 Mark as Administrator
               </label>
            </div>
          </div>


          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={updateUserMutation.isPending || uploadAvatarMutation.isPending}>
              {(updateUserMutation.isPending || uploadAvatarMutation.isPending) ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserModal;
