import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { changePasswordSchema, type ChangePasswordRequest } from "@shared/schema";

const profileSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
  avatar: z.string().url({ message: "Avatar must be a valid URL" }).optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileDetailsProps {
  profileData: any;
  isOwnProfile: boolean;
}

export default function ProfileDetails({ profileData, isOwnProfile }: ProfileDetailsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profileData.username,
      fullName: profileData.fullName || '',
      avatar: profileData.avatar || '',
    },
  });

  const passwordForm = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  const startEditing = () => {
    setIsEditing(true);
  };
  
  const cancelEditing = () => {
    form.reset({
      username: profileData.username,
      fullName: profileData.fullName || '',
      avatar: profileData.avatar || '',
    });
    setIsEditing(false);
  };
  
  const onSubmit = async (data: ProfileFormValues) => {
    try {
      await apiRequest('PATCH', `/api/users/${profileData.id}`, data);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated."
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/users/${profileData.id}`] });
      setIsEditing(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while updating your profile."
      });
    }
  };

  const onPasswordSubmit = async (data: ChangePasswordRequest) => {
    try {
      const response = await apiRequest<{ message: string }>(
        `/api/users/${profileData.id}/change-password`,
        "POST",
        data,
      );

      toast({
        title: "Password updated",
        description: response.message || "Your password has been updated.",
      });

      passwordForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Password change failed",
        description: error.message || "Could not update your password.",
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            View {isOwnProfile ? 'your' : 'user'} profile details and statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing && isOwnProfile ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="avatar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avatar URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/avatar.jpg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={cancelEditing}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p className="mt-1 text-sm text-gray-900">{profileData.email}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Username</h3>
                  <p className="mt-1 text-sm text-gray-900">@{profileData.username}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                  <p className="mt-1 text-sm text-gray-900">{profileData.fullName || 'Not provided'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Member Since</h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(profileData.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Statistics</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-md">
                    <div className="text-sm font-medium text-gray-500">Competitions Played</div>
                    <div className="text-2xl font-semibold text-gray-900 mt-1">
                      {profileData.stats?.competitionsPlayed || '0'}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-md">
                    <div className="text-sm font-medium text-gray-500">Total Points</div>
                    <div className="text-2xl font-semibold text-primary mt-1">
                      {profileData.stats?.totalPoints || '0'}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-md">
                    <div className="text-sm font-medium text-gray-500">Best Rank</div>
                    <div className="text-2xl font-semibold text-gray-900 mt-1">
                      {profileData.stats?.bestRank || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        {isOwnProfile && !isEditing && (
          <CardFooter className="flex justify-end">
            <Button onClick={startEditing}>
              <i className="fas fa-edit mr-2"></i>
              Edit Profile
            </Button>
          </CardFooter>
        )}
      </Card>

      {isOwnProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Use your current password to set a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                    {passwordForm.formState.isSubmitting ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
