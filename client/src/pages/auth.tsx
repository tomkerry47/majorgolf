import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { loginSchema, type LoginCredentials } from "@shared/schema"; // Import shared schema
import { 
  Card, 
  CardContent,
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Trophy } from "lucide-react";

// Removed local loginSchema definition

// Use LoginCredentials type from shared schema
// type LoginValues = z.infer<typeof loginSchema>; // Removed local type

const Auth = () => {
  console.log("Auth component rendered");
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  
  useEffect(() => {
    console.log("Auth component mounted");
    // Preflight check to ensure API connectivity
    fetch('/api/competitions')
      .then(response => {
        console.log("API connectivity test result:", response.status);
      })
      .catch(error => {
        console.error("API connectivity test failed:", error);
      });
  }, []);

  // Login form - Use imported schema and type
  const loginForm = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema), // Use imported schema
    defaultValues: {
      identifier: "", // Use identifier
      password: "",
    },
  });

  const onLoginSubmit = async (values: LoginCredentials) => { // Use imported type
    try {
      const normalizedIdentifier = values.identifier.trim(); // Use identifier
      console.log('Attempting login with:', normalizedIdentifier);
      const result = await signIn(normalizedIdentifier, values.password); // Pass identifier
      console.log('Login successful:', result);
      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });
      setLocation("/");
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login failed",
        description: error.message || "There was a problem logging in. Please check your credentials.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-primary-600 flex items-center justify-center text-white">
              <Trophy className="h-6 w-6" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Major Predictor</h2>
          <p className="mt-2 text-sm text-gray-600">
            Track your golf tournament selections and compete with friends
          </p>
        </div>
        <Card>
          <CardHeader className="text-center"> {/* Added text-center class */}
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                    name="identifier" // Change name to identifier
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email or Username</FormLabel> {/* Change label */}
                        <FormControl>
                          <Input 
                            type="text" // Change type to text
                            placeholder="Email or Username" // Change placeholder
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="******" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loginForm.formState.isSubmitting}
                  >
                    {loginForm.formState.isSubmitting ? "Logging in..." : "Sign In"}
                  </Button>
                  {/* Moved Forgot Password instruction */}
                  <div className="text-sm text-right pt-2"> {/* Added padding-top */}
                    <span className="font-medium text-gray-600 hover:text-gray-500">
                      Forgot password? Contact admin.
                    </span>
                  </div>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="text-center text-sm text-gray-500">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
