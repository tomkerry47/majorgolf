import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const [location] = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const closeSidebar = () => {
    if (open) setOpen(false);
  };

  const isActivePath = (path: string) => {
    if (path === '/') return location === path;
    return location.startsWith(path);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 md:relative md:z-0 w-64 flex flex-col transition-transform transform-gpu duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex flex-col flex-grow pt-5 bg-secondary overflow-y-auto [&_*]:text-black"> {/* Force all elements to be black */}
          <div className="flex items-center flex-shrink-0 px-4 mb-5">
            <span className="text-xl font-semibold text-black">Golf Syndicate</span>
          </div>
          <nav className="flex-1 px-2 pb-4 space-y-1">
            <Link 
              href="/"
              className={cn(
                "flex items-center px-2 py-3 text-sm font-medium text-white rounded-md",
                isActivePath('/') ? "bg-primary" : "hover:bg-primary/20"
              )}
              onClick={closeSidebar}
            >
              <i className="fas fa-home w-6 h-6 mr-3 text-white"></i>
              Dashboard
            </Link>
            <Link 
              href="/competitions"
              className={cn(
                "flex items-center px-2 py-3 text-sm font-medium text-white rounded-md",
                isActivePath('/competitions') ? "bg-primary" : "hover:bg-primary/20"
              )}
              onClick={closeSidebar}
            >
              <i className="fas fa-golf-ball w-6 h-6 mr-3 text-white"></i>
              Competitions
            </Link>
            <Link 
              href="/leaderboard"
              className={cn(
                "flex items-center px-2 py-3 text-sm font-medium text-white rounded-md",
                isActivePath('/leaderboard') ? "bg-primary" : "hover:bg-primary/20"
              )}
              onClick={closeSidebar}
            >
              <i className="fas fa-table-list w-6 h-6 mr-3 text-white"></i>
              Leaderboard
            </Link>
            <Link 
              href="/profile"
              className={cn(
                "flex items-center px-2 py-3 text-sm font-medium text-white rounded-md",
                isActivePath('/profile') ? "bg-primary" : "hover:bg-primary/20"
              )}
              onClick={closeSidebar}
            >
              <i className="fas fa-user w-6 h-6 mr-3 text-white"></i>
              Profile
            </Link>
            {isAdmin && (
              <>
                <Link 
                  href="/admin"
                  className={cn(
                    "flex items-center px-2 py-3 text-sm font-medium text-white rounded-md",
                    isActivePath('/admin') && !isActivePath('/admin/point-system') ? "bg-primary" : "hover:bg-primary/20"
                  )}
                  onClick={closeSidebar}
                >
                  <i className="fas fa-user-cog w-6 h-6 mr-3 text-white"></i>
                  Admin
                </Link>
                {/* Removed Point System Link */}
                {/* Removed Tournament Results Link */}
               </>
             )}
           </nav>

          {user && (
            <div className="px-4 py-4 mt-auto">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt={user.username} 
                      className="h-8 w-8 rounded-full" 
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-800">
                      {user.username?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">
                    {user.username}
                  </p>
                  <button 
                    onClick={signOut}
                    className="text-xs font-medium text-gray-300 hover:text-white"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
