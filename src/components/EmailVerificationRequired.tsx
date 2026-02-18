import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailVerificationRequiredProps {
  userEmail: string;
  userName?: string;
}

export const EmailVerificationRequired = ({ userEmail, userName }: EmailVerificationRequiredProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResendVerification = async () => {
    if (!user) return;
    
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-email', {
        body: {
          userId: user.id,
          email: userEmail,
          userName: userName || userEmail.split('@')[0],
        },
      });

      if (error) {
        throw error;
      }

      setResent(true);
      toast({
        title: "Verification email sent",
        description: `We've sent a new verification link to ${userEmail}`,
      });
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      toast({
        title: "Failed to send email",
        description: "Please try again later or contact support.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleRefreshStatus = async () => {
    // Refresh the page to re-check verification status
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription className="text-base mt-2">
            We've sent a verification link to
          </CardDescription>
          <p className="font-medium text-foreground mt-1">{userEmail}</p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="mb-2">
              Please check your inbox and click the verification link to activate your account.
            </p>
            <p>
              Can't find it? Check your spam folder or request a new link.
            </p>
          </div>

          <div className="space-y-3">
            {resent ? (
              <div className="flex items-center justify-center gap-2 text-green-600 py-2">
                <CheckCircle className="h-5 w-5" />
                <span>Verification email sent!</span>
              </div>
            ) : (
              <Button 
                onClick={handleResendVerification} 
                className="w-full"
                disabled={resending}
              >
                {resending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            )}

            <Button 
              onClick={handleRefreshStatus} 
              variant="outline" 
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              I've Verified - Refresh
            </Button>

            <Button 
              onClick={handleSignOut} 
              variant="ghost" 
              className="w-full text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-2">
            Need help? Contact{' '}
            <a href="mailto:support@talentgeenie.com" className="text-primary hover:underline">
              support@talentgeenie.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
