import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { 
  Building2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  FileCheck,
  Plus
} from "lucide-react";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { logger } from '@/lib/logger';

const MyApplications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { errorToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [organizationStatus, setOrganizationStatus] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);

      // Check organization membership
      const { data: orgData, error: orgError } = await supabase
        .from("organization_members")
        .select("*, organization:organizations(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (orgError && orgError.code !== 'PGRST116') {
        throw orgError;
      }

      if (orgData) {
        setOrganizationStatus(orgData);
      }

      // Fetch all applications
      const { data: appsData, error: appsError } = await supabase
        .from("partner_applications")
        .select("*")
        .eq("applicant_user_id", user.id)
        .order("created_at", { ascending: false });

      if (appsError) throw appsError;

      if (appsData) {
        setApplications(appsData);
      }
    } catch (error) {
      logger.error('Error fetching data:', error);
      errorToast(error, 'Error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: Clock, label: "Under Review" },
      approved: { variant: "default", icon: CheckCircle, label: "Approved" },
      rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
      revision_requested: { variant: "outline", icon: AlertCircle, label: "Revision Requested" },
    };
    return configs[status] || configs.pending;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">My Applications</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            View and manage your partner applications
          </p>
        </div>

        {/* Organization Status */}
        {organizationStatus && (
          <Card className="mb-6 border-2 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Active Organization</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {organizationStatus.organization?.name}
                  </p>
                  <Button onClick={() => navigate('/partner/portal')}>
                    Go to Organization Portal
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Applications List */}
        <div className="space-y-4">
          {applications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Applications Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start your journey by submitting a partner application
                </p>
                <Button onClick={() => navigate('/partner/onboarding')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit New Application
                </Button>
              </CardContent>
            </Card>
          ) : (
            applications.map((app) => {
              const config = getStatusConfig(app.status);
              const Icon = config.icon;
              
              return (
                <Card key={app.id} className="hover:border-primary/20 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                          <CardTitle className="text-xl">{app.organization_name}</CardTitle>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{app.industry}</span>
                          <span>•</span>
                          <span>{app.company_size}</span>
                          <span>•</span>
                          <span>Submitted {new Date(app.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant={config.variant} className="gap-1 shrink-0">
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {app.status === 'revision_requested' && app.rejection_reason && (
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-warning mb-1">Action Required</p>
                        <p className="text-sm text-muted-foreground">{app.rejection_reason}</p>
                      </div>
                    )}
                    
                    {app.status === 'rejected' && app.rejection_reason && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-destructive mb-1">Rejection Reason</p>
                        <p className="text-sm text-muted-foreground">{app.rejection_reason}</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => navigate('/partner/onboarding')}
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] w-full sm:w-auto"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      
                      {app.status === 'revision_requested' && (
                        <Button
                          onClick={() => navigate('/partner/onboarding')}
                          size="sm"
                          className="bg-gradient-to-r from-primary to-accent min-h-[44px] w-full sm:w-auto"
                        >
                          <FileCheck className="w-4 h-4 mr-2" />
                          Revise & Resubmit
                        </Button>
                      )}

                      {app.status === 'rejected' && (
                        <Button
                          onClick={() => navigate('/partner/onboarding')}
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Submit New Application
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {!organizationStatus && applications.every(app => ['rejected', 'approved'].includes(app.status)) && (
          <Card className="mt-4 border-primary/20">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Ready to submit a new partner application?
              </p>
              <Button onClick={() => navigate('/partner/onboarding')}>
                <Plus className="w-4 h-4 mr-2" />
                Submit New Application
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default MyApplications;