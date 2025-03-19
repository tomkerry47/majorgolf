import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, Menu, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Navigation = () => {
  const [location] = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Error signing out",
        description: error.message || "There was a problem signing out.",
        variant: "destructive",
      });
    }
  };

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

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/tournaments", label: "Tournaments" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/selections", label: "My Selections" },
  ];

  // Add admin link if user is admin
  if (isAdmin) {
    navLinks.push({ href: "/admin", label: "Admin" });
  }

  return (
    <header className="bg-primary-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Shield className="h-8 w-8" />
          <h1 className="text-xl font-bold">Golf Syndicate Tracker</h1>
        </div>
        
        {/* Mobile menu button */}
        <button type="button" className="block sm:hidden text-white focus:outline-none" onClick={toggleMobileMenu}>
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        
        {/* Desktop navigation */}
        <nav className="hidden sm:flex items-center space-x-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <a className={`text-white hover:text-primary-200 font-medium ${location === link.href ? 'text-primary-200' : ''}`}>
                {link.label}
              </a>
            </Link>
          ))}
          
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 focus:outline-none p-0 hover:bg-transparent">
                  <Avatar className="h-8 w-8">
                    {user.avatarUrl && <img src={user.avatarUrl} alt={user.username || 'User'} />}
                    <AvatarFallback className="bg-primary-700">
                      {getAvatarFallback()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">{user.username || user.email}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <a className="w-full">Profile</a>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <a className="w-full">Settings</a>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
      
      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-primary-700 pb-3 pt-2">
          <div className="px-4 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <a className={`block py-2 text-white hover:bg-primary-800 rounded px-2 ${location === link.href ? 'bg-primary-800' : ''}`}>
                  {link.label}
                </a>
              </Link>
            ))}
            <Link href="/profile">
              <a className="block py-2 text-white hover:bg-primary-800 rounded px-2">Profile</a>
            </Link>
            <Link href="/settings">
              <a className="block py-2 text-white hover:bg-primary-800 rounded px-2">Settings</a>
            </Link>
            <button 
              onClick={handleSignOut}
              className="w-full text-left block py-2 text-white hover:bg-primary-800 rounded px-2"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navigation;
