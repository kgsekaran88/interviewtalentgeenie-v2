import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Brain, Mail, Sparkles, ArrowLeft, Lock, User, CheckCircle2 } from "lucide-react";
import { signUpSchema, signInSchema, emailCheckSchema } from "@/lib/validations";
import { getAuthErrorMessage } from "@/lib/error-handler";
import { getUserFriendlyError } from "@/lib/userFriendlyErrors";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { ValidationAlert } from "@/components/ValidationAlert";
import { PasswordInput } from "@/components/PasswordInput";
import { logger } from '@/lib/logger';

type AuthStep = 'email' | 'signin' | 'signup' | 'verify';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const redirectUrl = searchParams.get("redirect") || "/";

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const roles = roleData?.map(r => r.role) || [];
        
        if (redirectUrl.includes('/partner')) {
          const { data: memberData } = await supabase
            .from("organization_members" as any)
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();

          if (memberData) {
            navigate('/partner/portal');
            return;
          }
          
          const { data: appData } = await supabase
            .from("partner_applications" as any)
            .select("*")
            .eq("applicant_user_id", user.id)
            .maybeSingle();

          if (appData && (appData as any).status === 'pending') {
            navigate('/partner/onboarding');
            return;
          }
        }

        navigate(redirectUrl);
      }
    };
    checkUser();
  }, [redirectUrl, navigate]);

  // Listen for verification in new tab
  useEffect(() => {
    const channel = supabase.channel('auth-verification');
    
    channel.on('broadcast', { event: 'verification-complete' }, () => {
      toast({
        title: "Email Verified!",
        description: "Your email has been verified. Please sign in to continue.",
      });
      setStep('signin');
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError("");

    try {
      const validatedData = emailCheckSchema.parse({ email });
      
      // Check if an account already exists (best-effort)
      const { data, error } = await supabase.rpc('check_user_exists', {
        user_email: validatedData.email,
      });

      if (error) {
        // Don't block auth if the account-existence check fails (network/backend hiccup).
        logger.warn('[Auth] check_user_exists failed (non-blocking):', error);
        setEmail(validatedData.email);
        setStep('signin');
        setValidationError(
          `${getUserFriendlyError(
            (error as any)?.message ?? String(error),
            "We couldn't check your account status right now."
          )} You can still try signing in, or create an account below.`
        );
        return;
      }

      // If user exists, show sign in form; otherwise show sign up form
      setEmail(validatedData.email);
      setStep(data ? 'signin' : 'signup');
    } catch (error: any) {
      setValidationError(error.errors?.[0]?.message || "Please enter a valid email address");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setValidationError("");

    try {
      const formData = new FormData(e.currentTarget);
      const rawData = {
        email: email,
        password: formData.get("password") as string,
      };

      const validatedData = signInSchema.parse(rawData);

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const roles = roleData?.map(r => r.role) || [];
        
        if (redirectUrl.includes('/partner')) {
          const { data: memberData } = await supabase
            .from("organization_members" as any)
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();

          if (memberData) {
            navigate('/partner/portal');
            return;
          }
        }
      }

      navigate(redirectUrl);
    } catch (error: any) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.issues?.[0];
        setValidationError(firstError?.message || "Please check your input and try again");
      } else {
        setValidationError(getAuthErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setValidationError("");

    try {
      const formData = new FormData(e.currentTarget);
      const rawData = {
        email: email,
        password: formData.get("password") as string,
        fullName: formData.get("fullName") as string,
      };

      const validatedData = signUpSchema.parse(rawData);

      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: { full_name: validatedData.fullName },
          emailRedirectTo: `${window.location.origin}/auth/verify`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Call post-signup edge function to create profile, assign guest role, and initialize onboarding
        try {
          const { data: session } = await supabase.auth.getSession();
          if (session?.session) {
            await invokeFunction('complete-user-signup', {
              headers: {
                Authorization: `Bearer ${session.session.access_token}`
              }
            });
          }
        } catch (postSignupError) {
          logger.error('Post-signup operations failed (non-blocking):', postSignupError);
          // Don't block signup if post-signup operations fail
        }
        
        setStep('verify');

        toast({
          title: "Account Created!",
          description: "Please check your email for the verification link.",
        });
      }
    } catch (error: any) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.issues?.[0];
        setValidationError(firstError?.message || "Please check your input and try again");
      } else {
        setValidationError(getAuthErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('email');
    setEmail("");
    setPassword("");
    setValidationError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Button>

        <Card className="glass border-border/50 shadow-xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg animate-fade-in">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Badge className="bg-gradient-to-r from-primary to-accent border-0 shadow-lg">
                    <Sparkles className="w-3 h-3" />
                  </Badge>
                </div>
              </div>
            </div>
            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardTitle className="text-3xl font-bold gradient-text">
                {step === 'verify' ? 'Verify Your Email' : 'Welcome to TalentGeenie'}
              </CardTitle>
              <CardDescription className="text-base">
                {step === 'email' && 'Enter your email to get started'}
                {step === 'signin' && 'Welcome back! Please sign in'}
                {step === 'signup' && 'Create your account'}
                {step === 'verify' && 'Almost there! Just one more step'}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Step 1: Email Input */}
            {step === 'email' && (
              <form onSubmit={handleEmailContinue} className="space-y-5 animate-fade-in">
                {validationError && (
                  <ValidationAlert type="error" message={validationError} />
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setValidationError("");
                    }}
                    required
                    className="h-12 glass border-border/50 focus:border-primary transition-all"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all text-base font-medium" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Checking...
                    </div>
                  ) : (
                    <>
                      Continue
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Step 2a: Sign In Form */}
            {step === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-5 animate-fade-in">
                <Alert className="bg-primary/10 border-primary/20">
                  <Mail className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    Signing in as <strong>{email}</strong>
                  </AlertDescription>
                </Alert>

                {validationError && (
                  <ValidationAlert type="error" message={validationError} />
                )}

                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-sm font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    Password
                  </Label>
                  <PasswordInput
                    id="signin-password"
                    name="password"
                    placeholder="Enter your password"
                    required
                    onChange={() => setValidationError("")}
                    className="h-12 glass border-border/50 focus:border-primary transition-all"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all text-base font-medium" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </div>
                  ) : (
                    <>
                      Sign In
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </>
                  )}
                </Button>

                <div className="text-center space-y-2">
                  <Button 
                    type="button"
                    variant="link" 
                    onClick={() => navigate('/reset-password')}
                    className="text-sm text-primary hover:underline p-0 h-auto"
                  >
                    Forgot your password?
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    New here?{" "}
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => {
                        setStep('signup');
                        setPassword("");
                        setValidationError("");
                      }}
                      className="p-0 h-auto align-baseline"
                    >
                      Create an account
                    </Button>
                  </p>

                  <div>
                    <Button 
                      type="button"
                      variant="ghost" 
                      onClick={resetFlow}
                      className="text-sm"
                    >
                      Use a different email
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Step 2b: Sign Up Form */}
            {step === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-5 animate-fade-in">
                <Alert className="bg-accent/10 border-accent/20">
                  <Mail className="h-4 w-4 text-accent" />
                  <AlertDescription className="text-sm">
                    Creating account for <strong>{email}</strong>
                  </AlertDescription>
                </Alert>

                {validationError && (
                  <ValidationAlert type="error" message={validationError} />
                )}

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="John Doe"
                    required
                    onChange={() => setValidationError("")}
                    className="h-12 glass border-border/50 focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    Password
                  </Label>
                  <PasswordInput
                    id="signup-password"
                    name="password"
                    placeholder="Create a strong password"
                    value={password}
                    onValueChange={(value) => {
                      setPassword(value);
                      setValidationError("");
                    }}
                    required
                    className="h-12 glass border-border/50 focus:border-primary transition-all"
                  />
                  
                  {password && <PasswordRequirements password={password} />}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all text-base font-medium" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </div>
                  ) : (
                    <>
                      Create Account
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </>
                  )}
                </Button>

                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => {
                        setStep('signin');
                        setPassword("");
                        setValidationError("");
                      }}
                      className="p-0 h-auto align-baseline"
                    >
                      Sign in
                    </Button>
                  </p>

                  <Button 
                    type="button"
                    variant="ghost" 
                    onClick={resetFlow}
                    className="text-sm"
                  >
                    Use a different email
                  </Button>
                </div>
              </form>
            )}

            {/* Step 3: Email Verification - Simple message */}
            {step === 'verify' && (
              <div className="space-y-6 animate-fade-in">
                <div className="p-8 bg-muted/30 rounded-lg text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Check Your Email</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a verification link to <strong className="text-foreground">{email}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click the link in the email to verify your account and complete registration.
                    </p>
                  </div>
                </div>

                <Alert className="bg-primary/5 border-primary/20">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    After verifying, you can sign in to access your account.
                  </AlertDescription>
                </Alert>
                  
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setStep('email');
                      setEmail("");
                      setPassword("");
                    }}
                  >
                    Try Different Email
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                    onClick={() => {
                      setStep('signin');
                      setPassword("");
                    }}
                  >
                    Go to Sign In
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
