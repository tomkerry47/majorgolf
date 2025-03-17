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
import { AuthProvider } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useState } from "react";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
