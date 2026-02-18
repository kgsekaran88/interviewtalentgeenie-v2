import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, Share2, CheckCircle, AlertCircle, Shield, Trophy } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { logger } from '@/lib/logger';

const MyCertificates = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: certificates, isLoading } = useQuery({
    queryKey: ['my-certificates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('certificates' as any)
        .select(`
          *,
          certification_topics (
            display_name,
            provider,
            difficulty_level
          )
        `)
        .eq('user_id', user.id)
        .eq('is_revoked', false)
        .order('issued_at', { ascending: false });
      
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const { data: userBadges } = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_badges' as any)
        .select(`
          *,
          certificate_badges (
            name,
            description,
            icon_name,
            color
          )
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });
      
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const handleDownloadPDF = async (certificateId: string) => {
    try {
      toast.info('Generating PDF...');
      
      const { data, error } = await invokeFunction('generate-certificate-pdf', {
        body: { certificateId },
      });

      if (error) throw error;

      // Create a temporary div to render the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.html;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '1122px'; // A4 landscape width in pixels
      document.body.appendChild(tempDiv);

      // Generate PDF from HTML
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`certificate-${data.certificateNumber}.pdf`);

      // Cleanup
      document.body.removeChild(tempDiv);
      
      toast.success('Certificate downloaded!');
    } catch (error) {
      logger.error('Error downloading certificate:', error);
      toast.error('Failed to download certificate');
    }
  };

  const handleShareLinkedIn = (certificate: any) => {
    const verifyUrl = `${window.location.origin}/verify-certificate?code=${certificate.verification_code}`;
    const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(certificate.certification_topics.display_name)}&organizationName=${encodeURIComponent('TalentGeenie Platform')}&issueYear=${new Date(certificate.issued_at).getFullYear()}&issueMonth=${new Date(certificate.issued_at).getMonth() + 1}&expirationYear=${new Date(certificate.expires_at).getFullYear()}&expirationMonth=${new Date(certificate.expires_at).getMonth() + 1}&certUrl=${encodeURIComponent(verifyUrl)}&certId=${certificate.certificate_number}`;
    
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
    toast.success('Opening LinkedIn to add certification...');
  };

  const handleCopyVerificationLink = (code: string) => {
    const url = `${window.location.origin}/verify-certificate?code=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Verification link copied!');
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading certificates...</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-4 sm:py-8 px-4">
        <div className="mb-6 sm:mb-8">
          <div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Award className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">My Certificates</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            View and manage your earned certifications
          </p>
        </div>
      </div>

      {/* Achievement Badges */}
      {userBadges && userBadges.length > 0 && (
        <Card className="mb-6 border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <CardTitle>Your Achievements</CardTitle>
            </div>
            <CardDescription>Badges earned for your certification journey</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {userBadges.map((userBadge: any) => {
                const badge = userBadge.certificate_badges;
                const BadgeIcon = Shield; // You can map icon_name to actual icons
                
                return (
                  <div
                    key={userBadge.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 animate-scale-in hover-scale"
                    style={{
                      borderColor: `hsl(var(--${badge.color}))`,
                      backgroundColor: `hsl(var(--${badge.color}) / 0.1)`,
                    }}
                  >
                    <BadgeIcon className="h-5 w-5" style={{ color: `hsl(var(--${badge.color}))` }} />
                    <div>
                      <p className="font-semibold text-sm">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {certificates && certificates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {certificates.map((cert: any) => {
            const expired = isExpired(cert.expires_at);
            
            return (
              <Card key={cert.id} className={expired ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Badge className="bg-blue-100 text-blue-800 capitalize">
                      {cert.certification_topics.provider}
                    </Badge>
                    {expired ? (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Expired
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Valid
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">
                    {cert.certification_topics.display_name}
                  </CardTitle>
                  <CardDescription>
                    Certificate #{cert.certificate_number}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Score</p>
                      <p className="font-semibold">{cert.score}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Integrity</p>
                      <p className="font-semibold">{cert.integrity_score}/100</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Issued</p>
                      <p className="font-semibold">
                        {new Date(cert.issued_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p className="font-semibold">
                        {new Date(cert.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPDF(cert.id)}
                    disabled={expired}
                    className="min-h-[44px] flex-1 sm:flex-none"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShareLinkedIn(cert)}
                    disabled={expired}
                    className="min-h-[44px] flex-1 sm:flex-none"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyVerificationLink(cert.verification_code)}
                    className="min-h-[44px] flex-1 sm:flex-none"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Verify
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Certificates Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start taking certification exams to earn your first certificate
            </p>
            <Button onClick={() => window.location.href = '/certifications'}>
              Browse Certifications
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </AppLayout>
  );
};

export default MyCertificates;