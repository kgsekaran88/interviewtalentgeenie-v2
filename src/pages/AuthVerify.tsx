import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Brain, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { logger } from "@/lib/logger";

const AuthVerify = () => {
  const navigate = useNavigate();
  const { toast } = useUserFriendlyToast();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    handleEmailVerification();
  }, []);

  const handleEmailVerification = async () => {
    try {
      // Supabase redirects with hash fragment containing access_token after email verification
      // Example: /auth/verify#access_token=...&token_type=bearer&type=signup
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      logger.info('Auth verify page loaded', { 
        hasAccessToken: !!accessToken, 
        type,
        hash: window.location.hash ? 'present' : 'empty'
      });

      // If we have tokens in the hash, Supabase has already verified the email
      // and is redirecting back with a valid session
      if (accessToken) {
        // Set the session from the tokens
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });

        if (error) {
          logger.error('Error setting session:', error);
          setStatus('error');
          setMessage("Failed to complete verification. Please try signing in.");
          return;
        }

        if (data.session) {
          logger.info('Session established after email verification', { userId: data.session.user.id });
          
          // Call complete-user-signup to set up profile and role
          try {
            const { error: signupError } = await invokeFunction('complete-user-signup', {
              headers: {
                Authorization: `Bearer ${data.session.access_token}`
              }
            });
            
            if (signupError) {
              logger.warn('Post-signup setup had issues:', signupError);
              // Don't block - user is verified, just log the warning
            }
          } catch (err) {
            logger.warn('Post-signup function call failed:', err);
          }

          setStatus('success');
          setMessage("Email verified successfully! Redirecting to dashboard...");
          
          toast({
            title: "Email Verified!",
            description: "Your account is now active. Welcome!",
          });

          // Redirect to dashboard after short delay
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
          return;
        }
      }

      // No tokens in hash - check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is already logged in, redirect to dashboard
        setStatus('success');
        setMessage("You're already verified! Redirecting...");
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
        return;
      }

      // No session and no tokens - invalid or expired link
      setStatus('error');
      setMessage("This verification link is invalid or has expired. Please request a new one.");
      
    } catch (error) {
      logger.error('Verification error:', error);
      setStatus('error');
      setMessage("An unexpected error occurred during verification.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-scale-in">
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
                Email Verification
              </CardTitle>
              <CardDescription className="text-base">
                {status === 'verifying' && 'Please wait while we verify your email'}
                {status === 'success' && 'Your email has been verified successfully'}
                {status === 'error' && 'Verification failed'}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              {status === 'verifying' && (
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              )}
              
              {status === 'success' && (
                <div className="space-y-4 text-center">
                  <CheckCircle2 className="w-16 h-16 text-accent mx-auto animate-scale-in" />
                  <p className="text-sm text-muted-foreground">
                    Redirecting you to the dashboard...
                  </p>
                </div>
              )}
              
              {status === 'error' && (
                <div className="space-y-4 text-center">
                  <XCircle className="w-16 h-16 text-destructive mx-auto animate-scale-in" />
                  <Button
                    onClick={() => navigate('/auth')}
                    className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  >
                    Go to Sign In
                  </Button>
                </div>
              )}
              
              <p className="text-center text-sm text-foreground font-medium">
                {message}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthVerify;
