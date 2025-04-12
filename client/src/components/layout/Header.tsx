import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Removed Input import as search bar is gone
// import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; // Added Avatar imports

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ sidebarOpen, setSidebarOpen }: HeaderProps) {
  const { user, isAdmin, signOut } = useAuth();
  // Removed searchQuery state as search bar is gone
  // const [searchQuery, setSearchQuery] = useState("");

  // Generate avatar fallback from username or email
  const getAvatarFallback = () => {
    if (!user) return "";
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "?";
  };


  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
      <button
        type="button"
        className="md:hidden px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <span className="sr-only">Open sidebar</span>
        <i className="fas fa-bars h-6 w-6"></i> {/* Assuming FontAwesome is used */}
      </button>

      {/* Centered Title */}
      <div className="flex-1 px-4 flex justify-center items-center">
        <h2 className="text-xl font-semibold text-gray-700">Major Predictor</h2>
      </div>

      {/* Right-aligned User Menu - Added pr-4 for padding */}
      <div className="ml-4 flex items-center md:ml-6 pr-4"> 
          {user ? (
            <>
              {/* Removed Notifications Button */}

              {/* Profile dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                    <Avatar className="h-8 w-8">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username || 'User'} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getAvatarFallback()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-4 py-2 text-sm">
                    <p className="font-medium">{user.username || 'User'}</p>
                    <p className="text-gray-500 truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  {/* Add other relevant links */}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">Admin</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex space-x-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
    </div> // This closing div matches the main outer div
  );
}
