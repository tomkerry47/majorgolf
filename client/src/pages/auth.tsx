import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ForgotPasswordRequest,
  type LoginCredentials,
  type ResetPasswordRequest,
} from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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

type AuthMode = "login" | "forgot" | "reset";

function getResetTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("reset")?.trim() || "";
}

const Auth = () => {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [resetToken, setResetToken] = useState(() => getResetTokenFromUrl());
  const [authMode, setAuthMode] = useState<AuthMode>(() => (
    getResetTokenFromUrl() ? "reset" : "login"
  ));

  useEffect(() => {
    fetch("/api/competitions").catch((error) => {
      console.error("API connectivity test failed:", error);
    });

    const handlePopState = () => {
      const token = getResetTokenFromUrl();
      setResetToken(token);
      setAuthMode(token ? "reset" : "login");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const loginForm = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const forgotForm = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const resetForm = useForm<ResetPasswordRequest>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: resetToken,
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    resetForm.setValue("token", resetToken);
  }, [resetToken, resetForm]);

  const showLogin = () => {
    setAuthMode("login");
    setResetToken("");
    resetForm.reset({
      token: "",
      password: "",
      confirmPassword: "",
    });
    window.history.replaceState(null, "", window.location.pathname);
  };

  const onLoginSubmit = async (values: LoginCredentials) => {
    try {
      const normalizedIdentifier = values.identifier.trim();
      await signIn(normalizedIdentifier, values.password);
      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
        duration: 2000,
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "There was a problem logging in. Please check your credentials.",
        variant: "destructive",
      });
    }
  };

  const onForgotPasswordSubmit = async (values: ForgotPasswordRequest) => {
    try {
      const response = await apiRequest<{ message: string }>("/api/auth/forgot-password", "POST", values);
      toast({
        title: "Check your email",
        description: response.message,
      });
      forgotForm.reset();
      showLogin();
    } catch (error: any) {
      toast({
        title: "Request failed",
        description: error.message || "Could not send reset email.",
        variant: "destructive",
      });
    }
  };

  const onResetPasswordSubmit = async (values: ResetPasswordRequest) => {
    try {
      const response = await apiRequest<{ message: string }>("/api/auth/reset-password", "POST", values);
      toast({
        title: "Password updated",
        description: response.message,
      });
      showLogin();
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message || "Could not reset your password.",
        variant: "destructive",
      });
    }
  };

  const titleByMode: Record<AuthMode, string> = {
    login: "Login",
    forgot: "Forgot Password",
    reset: "Set New Password",
  };

  const descriptionByMode: Record<AuthMode, string> = {
    login: "Enter your credentials to access your account.",
    forgot: "Enter your email address and we'll send you a reset link.",
    reset: "Choose a new password for your account.",
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
          <CardHeader className="text-center">
            <CardTitle>{titleByMode[authMode]}</CardTitle>
            <CardDescription>{descriptionByMode[authMode]}</CardDescription>
          </CardHeader>
          <CardContent>
            {authMode === "login" && (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="identifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email or Username</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="Email or Username" {...field} />
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
                  <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                    {loginForm.formState.isSubmitting ? "Logging in..." : "Sign In"}
                  </Button>
                  <div className="text-sm text-right pt-2">
                    <button
                      type="button"
                      className="font-medium text-primary-600 hover:text-primary-500"
                      onClick={() => setAuthMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              </Form>
            )}

            {authMode === "forgot" && (
              <Form {...forgotForm}>
                <form onSubmit={forgotForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                  <FormField
                    control={forgotForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={forgotForm.formState.isSubmitting}>
                    {forgotForm.formState.isSubmitting ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={showLogin}>
                    Back to login
                  </Button>
                </form>
              </Form>
            )}

            {authMode === "reset" && (
              <>
                {resetToken ? (
                  <Form {...resetForm}>
                    <form onSubmit={resetForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={resetForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="New password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resetForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Confirm password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={resetForm.formState.isSubmitting}>
                        {resetForm.formState.isSubmitting ? "Updating..." : "Set New Password"}
                      </Button>
                      <Button type="button" variant="ghost" className="w-full" onClick={showLogin}>
                        Back to login
                      </Button>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      This reset link is missing or invalid. Request a new password reset email.
                    </p>
                    <Button type="button" className="w-full" onClick={() => setAuthMode("forgot")}>
                      Request new reset link
                    </Button>
                    <Button type="button" variant="ghost" className="w-full" onClick={showLogin}>
                      Back to login
                    </Button>
                  </div>
                )}
              </>
            )}
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
