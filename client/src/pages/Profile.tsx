import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import ProfileDetails from "@/components/profile/ProfileDetails";
import ProfileSelections from "@/components/profile/ProfileSelections";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [matchParams, params] = useRoute("/profile/:id");
  const isOwnProfile = !matchParams || (user && params?.id === user.id);
  const userId = params?.id || (user?.id as string);
  
  // Redirect to login if no user
  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);
  
  const { data: profileData, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}`],
    enabled: !!user && !!userId,
  });
  
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
          <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
            {profileData.avatar ? (
              <img 
                src={profileData.avatar} 
                alt={profileData.username} 
                className="h-12 w-12 rounded-full" 
              />
            ) : (
              <span className="text-md font-medium text-gray-800">
                {profileData.fullName?.charAt(0) || profileData.username?.charAt(0) || 'U'}
              </span>
            )}
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              {profileData.fullName || profileData.username}
              {isOwnProfile && " (You)"}
            </h1>
            <p className="text-sm text-gray-500">@{profileData.username}</p>
          </div>
        </div>
        
        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
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
            <ProfileSelections 
              userId={userId} 
              username={profileData.username}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
