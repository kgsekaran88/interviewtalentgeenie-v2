import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Brain, Lock, CheckCircle, ArrowLeft, Mail } from "lucide-react";
import { passwordResetSchema } from "@/lib/validations";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { ValidationAlert } from "@/components/ValidationAlert";

const ResetPasswordConfirm = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [isSetupFlow, setIsSetupFlow] = useState(false);
  const [setupToken, setSetupToken] = useState<string | null>(null);

  useEffect(() => {
    validateResetRequest();
  }, []);

  const validateResetRequest = async () => {
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const emailParam = searchParams.get('email');
    
    // Check if this is a password setup flow (new user invitation)
    if (token && type === 'setup') {
      setIsSetupFlow(true);
      setSetupToken(token);
      
      // Token validation is handled by the edge function for security
      // We just need the token to be present - edge function will validate expiry/usage
      setIsValid(true);
      setValidating(false);
      return;
    }
    
    // Original password reset flow (email-based)
    if (!emailParam) {
      toast({
        title: "Invalid Reset Link",
        description: "This password reset link is invalid. Please request a new one.",
        variant: "destructive",
      });
      setTimeout(() => navigate('/reset-password'), 2000);
      setValidating(false);
      return;
    }

    setEmail(emailParam);
    setIsValid(true);
    setValidating(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError("");

    try {
      // Validate input
      const validatedData = passwordResetSchema.parse({
        password,
        confirmPassword,
      });

      if (isSetupFlow && setupToken) {
        // Password setup flow for new users
        const { data, error } = await invokeFunction('complete-password-setup', {
          body: {
            token: setupToken,
            password: validatedData.password,
          },
        });

        if (error) throw error;

        if (data.error) {
          throw new Error(data.error);
        }

        toast({
          title: "Password Set Successfully",
          description: "Your password has been set. You can now sign in.",
        });

        setTimeout(() => navigate('/auth'), 2000);
      } else {
        // Original password reset flow
        setValidationError("Password reset requires email configuration. Please contact your administrator to set up SMTP for automated password resets.");

        // In production with SMTP, this would work:
        // const { error } = await supabase.auth.updateUser({
        //   password: validatedData.password,
        // });
      }

    } catch (error: any) {
      setValidationError(error.errors?.[0]?.message || error.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md glass border-border/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <p className="text-muted-foreground">Validating reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md glass border-border/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Invalid Reset Link</h3>
                <p className="text-sm text-muted-foreground">
                  This password reset link is invalid or has expired.
                </p>
              </div>
              <Button onClick={() => navigate('/reset-password')} variant="outline">
                Request New Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg animate-fade-in">
                <Lock className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardTitle className="text-3xl font-bold gradient-text">
                {isSetupFlow ? "Set Your Password" : "Set New Password"}
              </CardTitle>
              <CardDescription className="text-base">
                {isSetupFlow 
                  ? "Welcome! Create a secure password for your account" 
                  : "Choose a strong password for your account"}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {!isSetupFlow && email && (
              <Alert className="bg-primary/10 border-primary/20">
                <Mail className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  Resetting password for <strong>{email}</strong>
                </AlertDescription>
              </Alert>
            )}

            {validationError && (
              <ValidationAlert type="warning" message={validationError} />
            )}

            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  New Password
                </Label>
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder="Enter your new password"
                  value={password}
                  onValueChange={(value) => {
                    setPassword(value);
                    setValidationError("");
                  }}
                  required
                  minLength={8}
                  className="h-12 glass border-border/50 focus:border-primary transition-all"
                />
                
                {password && <PasswordRequirements password={password} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Confirm New Password
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onValueChange={(value) => {
                    setConfirmPassword(value);
                    setValidationError("");
                  }}
                  required
                  className="h-12 glass border-border/50 focus:border-primary transition-all"
                />
              </div>

              {!isSetupFlow && (
                <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> SMTP email service needs to be configured for automated password resets. Please contact your administrator.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all text-base font-medium" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Resetting Password...
                  </div>
                ) : (
                  <>
                    Reset Password
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                After resetting, you'll be able to sign in with your new password
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordConfirm;
