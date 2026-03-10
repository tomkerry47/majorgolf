import { Switch, Route } from "wouter";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Competitions from "@/pages/Competitions";
import Competition from "@/pages/Competition";
import Leaderboard from "@/pages/leaderboard";
import Admin from "@/pages/admin";
import Profile from "@/pages/Profile";
import Rules from "@/pages/Rules";
import NotFound from "@/pages/not-found";
// import PointSystemAdmin from "@/pages/admin/PointSystem"; // Removed import
// import TournamentResultsAdmin from "@/pages/admin/TournamentResults"; // Removed import
import TournamentResultDetail from "@/pages/admin/TournamentResultDetail";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Auth from "./pages/auth";
import ForcePasswordChange from "@/components/auth/ForcePasswordChange";
import { useLocation, type RouteComponentProps } from "wouter"; // Import useLocation and RouteComponentProps

// Wrapper component to handle route params
const TournamentResultDetailWrapper = (props: RouteComponentProps<{ id: string }>) => {
  const [, navigate] = useLocation();
  // Extract the 'id' param and pass it as 'competitionId'
  // Provide a fallback or handle cases where 'id' might be missing/invalid if necessary
  const competitionId = props.params.id; 
  
  // Basic check if competitionId is valid before rendering
  if (!competitionId || isNaN(parseInt(competitionId))) {
     // Handle invalid ID, e.g., navigate to NotFound or show an error
     navigate("/404"); // Example: redirect to not found
     return null; 
  }

  return <TournamentResultDetail competitionId={competitionId} onBack={() => navigate('/admin')} />;
};


function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const hasResetToken = new URLSearchParams(window.location.search).has("reset");
  
  console.log("App component mounted - PostgreSQL database connected");
  console.log("Auth state:", { user, isLoading, location });
  
  // Show a loading indicator while auth state is initializing
  if (isLoading) {
    console.log("Auth is still loading, showing spinner");
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // If user is not authenticated, show the auth page
  if (!user) {
    console.log("No authenticated user, showing Auth component");
    try {
      return <Auth />;
    } catch (error) {
      console.error("Error rendering Auth component:", error);
      // Fallback UI in case Auth component errors
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Unable to load authentication</h1>
          <p className="text-gray-700 mb-4">There was a problem loading the authentication page.</p>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" 
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }
  }

  if (hasResetToken) {
    console.log("Reset token detected, showing Auth component");
    return <Auth />;
  }

  if (user.mustChangePassword) {
    console.log("User must change password before accessing the app");
    return <ForcePasswordChange />;
  }

  return (
    <div className="min-h-screen">
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/login" component={Login} />
              <Route path="/register" component={Register} />
              <Route path="/competitions" component={Competitions} />
              <Route path="/competitions/:id" component={Competition} />
              <Route path="/leaderboard" component={Leaderboard} />
              <Route path="/rules" component={Rules} />
              <Route path="/admin" component={Admin} />
              {/* <Route path="/admin/point-system" component={PointSystemAdmin} /> */}
              {/* <Route path="/admin/tournament-results" component={TournamentResultsAdmin} /> */}
              {/* Use the wrapper component for the route */}
              <Route path="/admin/tournament-results/:id" component={TournamentResultDetailWrapper} /> 
              <Route path="/profile" component={Profile} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
