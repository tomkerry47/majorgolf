import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { loginSchema, type LoginCredentials } from "@shared/schema";


export default function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { signIn } = useAuth();

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "", // Changed from email
      password: "",
    }
  });

  async function onSubmit(data: LoginCredentials) {
    setIsLoading(true);
    try {
      // Identifier can be email or username
      const { identifier, password } = data; 
      const normalizedIdentifier = identifier.trim(); // Trim whitespace
      console.log('Login attempt with:', { identifier: normalizedIdentifier });
        
        console.log('Starting signIn process...');
        // Pass identifier to signIn function (AuthContext needs update too)
        const result = await signIn(normalizedIdentifier, password); 
        console.log('SignIn complete, result:', result ? 'Success' : 'Failed');
        
        console.log('Showing success toast...');
        toast({
          title: "Welcome back!",
          description: "You have been successfully logged in.",
        });
        
        console.log('Attempting to navigate to dashboard...');
      setLocation("/");
      console.log('Navigation command sent.');
    } catch (error: any) {
      console.error("Login error in form submit:", error);

      let errorTitle = "Login failed";
      let errorMessage = "An error occurred during login.";

      // Log detailed error info for debugging
      console.log("Login Error details:", {
        error,
        message: error.message,
        name: error.name,
        status: error.status
      });

      // Handle error message
      if (error?.message) {
        errorMessage = error.message;
        
        // Check for specific error messages
        if (error.message.includes("credentials") || error.message.includes("password")) {
          errorTitle = "Invalid credentials";
          errorMessage = "The identifier or password you entered is incorrect. Please try again."; // Updated message
        } else if (error.message.includes("not found") || error.message.includes("no user")) {
          errorTitle = "User not found";
          errorMessage = "No account exists with this email or username. Please check your details."; // Updated message
        }
      }

      toast({
        variant: "destructive",
        title: errorTitle,
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="identifier" // Changed from email
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email or Username</FormLabel> {/* Changed label */}
                  <FormControl>
                    <Input 
                      type="text" // Changed type to text
                      placeholder="Email or Username" // Changed placeholder
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </span>
              ) : (
                <span>Login</span>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      {/* Footer can be removed or kept simple */}
      {/* <CardFooter className="flex justify-center">
        <p className="text-sm text-center text-gray-600">
          Need help? Contact support.
        </p>
      </CardFooter> */}
    </Card>
  );
}
