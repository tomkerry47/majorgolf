import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Competitions from "@/pages/Competitions";
import Competition from "@/pages/Competition";
import Leaderboard from "@/pages/Leaderboard";
import Admin from "@/pages/Admin";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/not-found";
import PointSystemAdmin from "@/pages/admin/PointSystem";
import TournamentResultsAdmin from "@/pages/admin/TournamentResults";
import TournamentResultDetail from "@/pages/admin/TournamentResultDetail";
import { AuthProvider } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useState, useEffect } from "react";

// Simple test component
const SimpleTest = () => {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f0f9ff',
      borderRadius: '8px',
      margin: '20px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h1 style={{ color: '#0369a1', fontSize: '24px', marginBottom: '16px' }}>
        Golf Syndicate Tracker
      </h1>
      <p style={{ color: '#334155', marginBottom: '12px' }}>
        The application is loading...
      </p>
      <p style={{ color: '#334155', marginBottom: '12px' }}>
        Current URL: {window.location.href}
      </p>
      <button 
        style={{
          backgroundColor: '#0ea5e9',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer'
        }}
        onClick={() => {
          console.log("Test button clicked");
          fetch('/api/competitions')
            .then(res => res.json())
            .then(data => {
              console.log("API data:", data);
              alert("API call successful!");
            })
            .catch(err => {
              console.error("API error:", err);
              alert("API call failed: " + err.message);
            });
        }}
      >
        Test API Connection
      </button>
    </div>
  );
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFullApp, setShowFullApp] = useState(false);
  
  useEffect(() => {
    console.log("App component mounted");
    console.log("Current URL:", window.location.href);
    
    // Check if we can access the API
    fetch('/api/competitions')
      .then(res => {
        console.log("API response status:", res.status);
        if (res.ok) {
          console.log("API connection successful");
          setShowFullApp(true);
        }
        return res.json();
      })
      .then(data => {
        console.log("API data:", data);
      })
      .catch(err => {
        console.error("API connection error:", err);
      });
  }, []);

  // Show simple test component first
  if (!showFullApp) {
    return <SimpleTest />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
                  <Route path="/admin" component={Admin} />
                  <Route path="/admin/point-system" component={PointSystemAdmin} />
                  <Route path="/admin/tournament-results" component={TournamentResultsAdmin} />
                  <Route path="/admin/tournament-results/:id" component={TournamentResultDetail} />
                  <Route path="/profile" component={Profile} />
                  <Route component={NotFound} />
                </Switch>
              </main>
            </div>
          </div>
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
