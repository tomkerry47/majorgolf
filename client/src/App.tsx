import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "./hooks/use-auth";
import Layout from "./components/layout";
import Home from "./pages/home";
import Tournaments from "./pages/tournaments";
import Leaderboard from "./pages/leaderboard";
import Selections from "./pages/selections";
import Admin from "./pages/admin";
import Auth from "./pages/auth";
import { useEffect } from "react";

function Router() {
  const [location] = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={Auth} />
      
      {/* Protected routes inside Layout */}
      <Route path="/">
        {() => (
          <Layout>
            <Home />
          </Layout>
        )}
      </Route>
      <Route path="/tournaments">
        {() => (
          <Layout>
            <Tournaments />
          </Layout>
        )}
      </Route>
      <Route path="/leaderboard">
        {() => (
          <Layout>
            <Leaderboard />
          </Layout>
        )}
      </Route>
      <Route path="/selections">
        {() => (
          <Layout>
            <Selections />
          </Layout>
        )}
      </Route>
      <Route path="/admin">
        {() => (
          <Layout>
            <Admin />
          </Layout>
        )}
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
