import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, AlertTriangle, Award, Calendar, Shield, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function VerifyCertificate() {
  const [searchParams] = useSearchParams();
  const codeParam = searchParams.get('code');
  
  const [verificationCode, setVerificationCode] = useState(codeParam || '');
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (codeParam) {
      handleVerify();
    }
  }, [codeParam]);

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a verification code',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setVerified(null);
    setCertificate(null);

    try {
      // Use secure RPC function that requires verification code input
      // Prevents enumeration - can only get data for specific codes
      const { data, error } = await supabase
        .rpc('verify_certificate_by_code', { 
          p_verification_code: verificationCode.trim() 
        });

      if (error || !data || data.length === 0) {
        setVerified(false);
        toast({
          title: 'Invalid Certificate',
          description: 'No certificate found with this verification code',
          variant: 'destructive',
        });
        return;
      }

      const cert = data[0];
      // Transform to match expected format
      const transformedCert = {
        ...cert,
        certification_topics: { name: cert.certification_name },
        profiles: { full_name: cert.candidate_name }
      };
      setCertificate(transformedCert);

      // Check validity
      const isValid = !cert.is_revoked && new Date(cert.expires_at) > new Date();
      setVerified(isValid);

      if (!isValid) {
        if (cert.is_revoked) {
          toast({
            title: 'Certificate Revoked',
            description: cert.revoked_reason || 'This certificate has been revoked',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Certificate Expired',
            description: 'This certificate has expired',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Certificate Verified',
          description: 'This is a valid certificate',
        });
      }
    } catch (error) {
      logger.error('Error verifying certificate:', error);
      setVerified(false);
      toast({
        title: 'Error',
        description: 'Failed to verify certificate',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-6 sm:py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-accent mb-4">
            <Award className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Verify Certificate</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Enter a verification code to check certificate authenticity
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Enter Verification Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                placeholder="Enter certificate verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>
            <Button onClick={handleVerify} disabled={loading} className="w-full min-h-[44px]">
              {loading ? 'Verifying...' : 'Verify Certificate'}
            </Button>
          </CardContent>
        </Card>

        {verified !== null && (
          <Card className={verified ? 'border-green-500' : 'border-red-500'}>
            <CardHeader>
              <div className="flex items-center gap-3">
                {verified ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                    <div>
                      <CardTitle className="text-green-500">Valid Certificate</CardTitle>
                      <p className="text-sm text-muted-foreground">This certificate is authentic and active</p>
                    </div>
                  </>
                ) : certificate?.is_revoked ? (
                  <>
                    <XCircle className="w-8 h-8 text-red-500" />
                    <div>
                      <CardTitle className="text-red-500">Revoked Certificate</CardTitle>
                      <p className="text-sm text-muted-foreground">This certificate has been revoked</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-8 h-8 text-orange-500" />
                    <div>
                      <CardTitle className="text-orange-500">Expired Certificate</CardTitle>
                      <p className="text-sm text-muted-foreground">This certificate has expired</p>
                    </div>
                  </>
                )}
              </div>
            </CardHeader>
            
            {certificate && (
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Award className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Certification</p>
                      <p className="font-semibold">{certificate.certification_topics?.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Certificate Holder</p>
                      <p className="font-semibold">{certificate.profiles?.full_name || certificate.profiles?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Certificate Number</p>
                      <p className="font-mono text-sm">{certificate.certificate_number}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Issued</p>
                        <p className="font-semibold">{new Date(certificate.issued_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Expires</p>
                        <p className="font-semibold">{new Date(certificate.expires_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-sm text-muted-foreground mb-1">Score</p>
                      <p className="text-2xl font-bold">{certificate.score}%</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <p className="text-sm text-muted-foreground mb-1">Integrity</p>
                      <p className="text-2xl font-bold">{certificate.integrity_score}/100</p>
                    </div>
                  </div>

                  {certificate.is_revoked && certificate.revoked_reason && (
                    <div className="p-3 border border-red-500 rounded-lg bg-red-50 dark:bg-red-950">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Revocation Reason:</p>
                      <p className="text-sm text-red-600 dark:text-red-400">{certificate.revoked_reason}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}