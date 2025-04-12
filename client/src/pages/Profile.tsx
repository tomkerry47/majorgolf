import React, { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProfileDetails from "@/components/profile/ProfileDetails";
import ProfileSelections from "@/components/profile/ProfileSelections";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [matchParams, params] = useRoute("/profile/:id");
  const isOwnProfile = !matchParams || (user && params?.id === user.id);
  const userId = params?.id || (user?.id as string);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);
  
  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const headers = getAuthHeaders();
      
      const response = await fetch(`/api/users/${userId}`, {
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }
      return response.json();
    },
    enabled: !!user && !!userId,
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      // Basic validation (optional: add size/type checks)
      if (event.target.files[0].size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File too large", description: "Please select an image smaller than 5MB.", variant: "destructive" });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      const headers = getAuthHeaders();
      // Let the browser set the Content-Type for FormData
      // headers.delete('Content-Type');

      const response = await fetch(`/api/users/avatar`, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed due to network or server error.' }));
        throw new Error(errorData.message || 'Failed to upload avatar');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Avatar updated successfully!" });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input
      }
      // Invalidate profile query to refetch data with new avatar
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (error) => {
      toast({ title: "Avatar upload failed", description: error.message, variant: "destructive" });
      setSelectedFile(null);
       if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input
      }
    },
  });

  const handleUploadClick = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };


  // Handle API errors
  if (error) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <Card>
            <CardHeader className="text-center">
              <h2 className="text-xl font-semibold">Error Loading Profile</h2>
              <p className="text-sm text-gray-500">There was an error loading the profile data. Please try again later.</p>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }
  
  if (!user) return null;
  
  if (isLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center mb-6">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="ml-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24 mt-1" />
            </div>
          </div>
          
          <Tabs defaultValue="profile">
            <TabsList className="mb-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="selections">Selections History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="selections">
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }
  
  if (!profileData) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <Card>
            <CardHeader className="text-center">
              <h2 className="text-xl font-semibold">User Not Found</h2>
              <p className="text-sm text-gray-500">The user profile you're looking for does not exist.</p>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex items-center mb-6">
          {/* Avatar Display */}
          <div className="relative h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            {profileData.avatarUrl ? ( // Assuming the field is avatarUrl now
              <img
                src={profileData.avatarUrl}
                alt={profileData.username}
                className="h-12 w-12 rounded-full object-cover" // Added object-cover
              />
            ) : (
              <span className="text-lg font-medium text-gray-700"> {/* Adjusted styles */}
                {profileData.fullName?.charAt(0).toUpperCase() || profileData.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
            {/* Edit Icon/Upload Trigger */}
            {isOwnProfile && (
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-1 cursor-pointer transition-colors duration-150"
                title="Change avatar"
              >
                {/* SVG for a pencil icon (replace with your icon library if available) */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/gif, image/webp" // Specify accepted types
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden" // Keep it hidden
                />
              </label>
            )}
          </div>
          {/* User Info */}
          <div className="ml-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              {profileData.fullName || profileData.username}
              {isOwnProfile && " (You)"}
            </h1>
            <p className="text-sm text-gray-500">@{profileData.username}</p>
          </div>
        </div>

        {/* Upload Controls - Shown only when a file is selected and it's own profile */}
        {isOwnProfile && selectedFile && (
          <div className="mb-6 p-4 border rounded-md bg-gray-50 flex items-center gap-3">
            <p className="text-sm text-gray-700 flex-grow">
              Selected: <span className="font-medium">{selectedFile.name}</span>
            </p>
            <Button
              onClick={handleUploadClick}
              disabled={uploadMutation.isPending}
              size="sm"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Avatar'}
            </Button>
            <Button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              variant="outline"
              size="sm"
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="profile">
          {/* Added flex-wrap */}
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="selections">Selections History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <ProfileDetails 
              profileData={profileData} 
              isOwnProfile={isOwnProfile} 
            />
          </TabsContent>
          
          <TabsContent value="selections">
            {/* userId prop removed */}
            <ProfileSelections 
              username={profileData.username}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
