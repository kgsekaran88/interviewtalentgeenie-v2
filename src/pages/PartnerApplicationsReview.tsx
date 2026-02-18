import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { logger } from '@/lib/logger';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionErrors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileCheck, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Building2,
  Mail,
  Calendar,
  Globe,
  Phone,
  Users,
  MapPin,
  FileText,
  Eye,
  CreditCard,
  User
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow, format } from 'date-fns';

interface PartnerApplication {
  id: string;
  organization_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  industry: string;
  company_size: string;
  organization_size: string;
  country: string;
  use_case: string;
  status: string;
  created_at: string;
  selected_plan_id: string;
  applicant_user_id: string;
  website?: string;
  review_notes?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export default function PartnerApplicationsReview() {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<PartnerApplication | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      logger.error('Error fetching applications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load applications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openDetailView = (app: PartnerApplication) => {
    setSelectedApp(app);
    setShowDetailSheet(true);
  };

  const handleApprove = async (app: PartnerApplication) => {
    try {
      const { data, error } = await invokeFunction('approve-partner-application', {
        body: { applicationId: app.id },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error('Failed to approve application');
      }

      toast({
        title: 'Application Approved',
        description: `${data.organizationName} has been activated.`,
      });
      setShowDetailSheet(false);
      setSelectedApp(null);
      fetchApplications();
    } catch (error: any) {
      logger.error('Approval error:', error);
      toast({
        title: 'Error',
        description: getEdgeFunctionErrorMessage(error, 'Failed to approve application'),
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('partner_applications')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectReason,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedApp.id);

      toast({ 
        title: 'Application Rejected', 
        description: `${selectedApp.organization_name} application has been rejected.` 
      });
      
      setShowRejectDialog(false);
      setShowDetailSheet(false);
      setRejectReason('');
      setSelectedApp(null);
      fetchApplications();
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to reject application', 
        variant: 'destructive' 
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredApplications = applications.filter(app => app.status === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3">
            <FileCheck className="h-6 w-6 sm:h-8 sm:w-8 shrink-0" />
            <span className="hidden sm:inline">Partner Applications</span>
            <span className="sm:hidden">Applications</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Review and manage partner onboarding requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Pending</p>
                <p className="text-lg sm:text-2xl font-bold">{applications.filter(a => a.status === 'pending').length}</p>
              </div>
              <Clock className="h-5 w-5 sm:h-8 sm:w-8 text-yellow-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Approved</p>
                <p className="text-lg sm:text-2xl font-bold">{applications.filter(a => a.status === 'approved').length}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 sm:h-8 sm:w-8 text-green-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Rejected</p>
                <p className="text-lg sm:text-2xl font-bold">{applications.filter(a => a.status === 'rejected').length}</p>
              </div>
              <XCircle className="h-5 w-5 sm:h-8 sm:w-8 text-red-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="p-3 sm:p-6">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="pending" className="text-xs sm:text-sm min-h-[44px]">Pending</TabsTrigger>
              <TabsTrigger value="approved" className="text-xs sm:text-sm min-h-[44px]">Approved</TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs sm:text-sm min-h-[44px]">Rejected</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <TabsContent value={activeTab} className="mt-0 space-y-3 sm:space-y-4">
              {filteredApplications.length === 0 ? (
                <div className="text-center py-12">
                  <FileCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No {activeTab} applications</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredApplications.map((app) => (
                    <Card key={app.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetailView(app)}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <Building2 className="h-5 w-5 text-primary" />
                              <div>
                                <h3 className="font-semibold text-lg">{app.organization_name}</h3>
                                <p className="text-sm text-muted-foreground">{app.industry}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                {app.contact_name || 'N/A'}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {app.contact_email}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                              </div>
                              <div>
                                {getStatusBadge(app.status)}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button 
                              onClick={(e) => { e.stopPropagation(); openDetailView(app); }} 
                              variant="outline" 
                              size="sm"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Review
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedApp?.organization_name}
            </SheetTitle>
            <SheetDescription>
              Application submitted {selectedApp?.created_at && formatDistanceToNow(new Date(selectedApp.created_at), { addSuffix: true })}
            </SheetDescription>
          </SheetHeader>

          {selectedApp && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                {getStatusBadge(selectedApp.status)}
              </div>

              <Separator />

              {/* Organization Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Organization Details</h4>
                
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Organization Name</p>
                      <p className="text-sm text-muted-foreground">{selectedApp.organization_name}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Industry</p>
                      <p className="text-sm text-muted-foreground">{selectedApp.industry || 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Users className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Company Size</p>
                      <p className="text-sm text-muted-foreground">{selectedApp.company_size || selectedApp.organization_size || 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Country</p>
                      <p className="text-sm text-muted-foreground">{selectedApp.country || 'Not specified'}</p>
                    </div>
                  </div>

                  {selectedApp.website && (
                    <div className="flex items-start gap-3">
                      <Globe className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Website</p>
                        <a href={selectedApp.website.startsWith('http') ? selectedApp.website : `https://${selectedApp.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          {selectedApp.website}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Contact Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h4>
                
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Contact Name</p>
                      <p className="text-sm text-muted-foreground">{selectedApp.contact_name || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <a href={`mailto:${selectedApp.contact_email}`} className="text-sm text-primary hover:underline">
                        {selectedApp.contact_email}
                      </a>
                    </div>
                  </div>

                  {selectedApp.contact_phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{selectedApp.contact_phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Use Case */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Use Case / Purpose</h4>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedApp.use_case || 'No use case provided'}</p>
                </div>
              </div>

              {/* Timeline */}
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Timeline</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Applied</span>
                    <span>{format(new Date(selectedApp.created_at), 'PPp')}</span>
                  </div>
                  {selectedApp.reviewed_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reviewed</span>
                      <span>{format(new Date(selectedApp.reviewed_at), 'PPp')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Reason if rejected */}
              {selectedApp.status === 'rejected' && selectedApp.rejection_reason && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-red-500 uppercase tracking-wide">Rejection Reason</h4>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <p className="text-sm">{selectedApp.rejection_reason}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons for Pending */}
              {selectedApp.status === 'pending' && (
                <SheetFooter className="flex gap-2 pt-4">
                  <Button 
                    onClick={() => handleApprove(selectedApp)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve Application
                  </Button>
                  <Button 
                    onClick={() => setShowRejectDialog(true)}
                    variant="destructive"
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject Application
                  </Button>
                </SheetFooter>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {selectedApp?.organization_name}'s application
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-24"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
