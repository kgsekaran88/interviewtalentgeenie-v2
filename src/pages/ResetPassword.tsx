import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Brain, Mail, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { passwordResetRequestSchema } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ValidationAlert } from "@/components/ValidationAlert";

type Step = 'email' | 'sent';

const ResetPasswordRequest = () => {
  const navigate = useNavigate();
  const { toast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError("");

    try {
      const validatedData = passwordResetRequestSchema.parse({ email });

      // Use Supabase's built-in password reset which sends an email
      const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      if (error) {
        throw error;
      }

      setStep('sent');
      toast({
        title: "Reset Link Sent!",
        description: "Please check your email for the password reset link.",
      });
    } catch (error: any) {
      if (error.errors?.[0]?.message) {
        setValidationError(error.errors[0].message);
      } else {
        setValidationError(error.message || "Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('email');
    setEmail("");
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
          onClick={() => navigate('/auth')}
          className="mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Sign In
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
                {step === 'email' ? 'Reset Password' : 'Check Your Email'}
              </CardTitle>
              <CardDescription className="text-base">
                {step === 'email' && 'Enter your email to receive a password reset link'}
                {step === 'sent' && 'We\'ve sent you a password reset link'}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Step 1: Email Input */}
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-5 animate-fade-in">
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
                  <p className="text-xs text-muted-foreground">
                    Enter the email address associated with your account
                  </p>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all text-base font-medium" 
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </div>
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Step 2: Email Sent Confirmation */}
            {step === 'sent' && (
              <div className="space-y-6 animate-fade-in">
                <div className="p-8 bg-muted/30 rounded-lg text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Check Your Inbox</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a password reset link to <strong className="text-foreground">{email}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click the link in the email to create a new password.
                    </p>
                  </div>
                </div>

                <Alert className="bg-primary/5 border-primary/20">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    Didn't receive the email? Check your spam folder or try again.
                  </AlertDescription>
                </Alert>
                  
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={resetFlow}
                  >
                    Try Different Email
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                    onClick={() => navigate('/auth')}
                  >
                    Back to Sign In
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

export default ResetPasswordRequest;
