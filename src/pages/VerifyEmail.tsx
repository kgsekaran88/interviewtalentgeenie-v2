import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-email-token', {
          body: { token },
        });

        if (error) {
          console.error('Verification error:', error);
          if (error.message?.includes('expired')) {
            setStatus('expired');
            setMessage('Your verification link has expired. Please request a new one.');
          } else {
            setStatus('error');
            setMessage(error.message || 'Failed to verify email. Please try again.');
          }
          return;
        }

        if (data?.success) {
          setStatus('success');
          setEmail(data.email || '');
          setMessage('Your email has been verified successfully!');
        } else {
          setStatus('error');
          setMessage(data?.error || 'Verification failed. Please try again.');
        }
      } catch (err) {
        console.error('Verification exception:', err);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    verifyToken();
  }, [searchParams]);

  const handleResendVerification = async () => {
    // Redirect to auth page where they can request a new verification email
    navigate('/auth?resend=true');
  };

  const handleContinue = () => {
    navigate('/dashboard');
  };

  const handleLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
              </div>
              <CardTitle>Verifying Your Email</CardTitle>
              <CardDescription>Please wait while we verify your email address...</CardDescription>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="mx-auto mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-green-600">Email Verified!</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="mx-auto mb-4">
                <XCircle className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Verification Failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
          
          {status === 'expired' && (
            <>
              <div className="mx-auto mb-4">
                <Mail className="h-16 w-16 text-amber-500" />
              </div>
              <CardTitle className="text-amber-600">Link Expired</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {status === 'success' && (
            <div className="space-y-3">
              {email && (
                <p className="text-center text-sm text-muted-foreground">
                  Verified email: <span className="font-medium">{email}</span>
                </p>
              )}
              <Button onClick={handleContinue} className="w-full">
                Continue to Dashboard
              </Button>
              <Button onClick={handleLogin} variant="outline" className="w-full">
                Go to Login
              </Button>
            </div>
          )}
          
          {(status === 'error' || status === 'expired') && (
            <div className="space-y-3">
              <Button onClick={handleResendVerification} className="w-full">
                Request New Verification Email
              </Button>
              <Button onClick={handleLogin} variant="outline" className="w-full">
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
