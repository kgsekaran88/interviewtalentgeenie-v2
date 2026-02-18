import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionErrors';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Building2, Users, CreditCard, FileCheck, TrendingUp, Settings, Shield, Loader2,
  CheckCircle2, XCircle, AlertCircle, Clock, Check, X, Send, Brain, Bot, Cloud,
  Activity, History, BookOpen, Award, Network, AlertTriangle, Tag, MessageSquare, Timer,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AdminSection {
  id: string;
  title: string;
  description: string;
  icon: any;
  path: string;
  category: string;
}

interface AdminCategory {
  name: string;
  description: string;
  sections: AdminSection[];
}

const ADMIN_CATEGORIES: AdminCategory[] = [
  {
    name: 'Critical Operations',
    description: 'Access control, security, and user management',
    sections: [
      { id: 'organizations', title: 'Partner Organizations', description: 'View & manage all partners', icon: Building2, path: '/admin/organizations', category: 'critical' },
      { id: 'users', title: 'User Management', description: 'Manage all platform users', icon: Users, path: '/admin/user-management', category: 'critical' },
      { id: 'roles', title: 'Role Permissions', description: 'Configure RBAC and permissions', icon: Shield, path: '/admin/role-permissions', category: 'critical' },
    ]
  },
  {
    name: 'Billing & Subscriptions',
    description: 'Revenue, pricing, and payment management',
    sections: [
      { id: 'plan-management', title: 'Subscription Plans', description: 'Configure interview limits & pricing', icon: CreditCard, path: '/admin/plan-management', category: 'billing' },
      { id: 'learning-plan-management', title: 'Learning Plans', description: 'Configure learning limits & pricing', icon: CreditCard, path: '/admin/learning-plan-management', category: 'billing' },
      { id: 'payment-gateways', title: 'Payment Gateways', description: 'Configure Stripe, Razorpay & more', icon: CreditCard, path: '/admin/payment-gateways', category: 'billing' },
      { id: 'promotions', title: 'Promotions', description: 'Coupon codes, discounts & offers', icon: Tag, path: '/admin/promotions', category: 'billing' },
      { id: 'billing', title: 'Billing Management', description: 'Invoices and revenue tracking', icon: CreditCard, path: '/admin/billing', category: 'billing' },
      { id: 'cost-monitoring', title: 'Cost Monitoring', description: 'Track AI, storage & usage costs', icon: TrendingUp, path: '/admin/cost-monitoring', category: 'billing' },
    ]
  },
  {
    name: 'Monitoring & Analytics',
    description: 'Logs, metrics, and platform insights',
    sections: [
      { id: 'system-monitoring', title: 'System Monitoring', description: 'End-to-end platform health & diagnostics', icon: Activity, path: '/admin/system-monitoring', category: 'monitoring' },
      { id: 'ai-usage', title: 'AI Usage Monitoring', description: 'Track AI calls, tokens & costs', icon: Brain, path: '/admin/ai-usage-monitoring', category: 'monitoring' },
      { id: 'log-analysis', title: 'AI Log Analysis', description: 'Natural language log queries & actions', icon: MessageSquare, path: '/admin/log-analysis', category: 'monitoring' },
      { id: 'preinterview-logs', title: 'Pre-Interview Check Logs', description: 'Debug candidate setup issues', icon: AlertTriangle, path: '/admin/preinterview-logs', category: 'monitoring' },
      { id: 'operation-logs', title: 'Interview Operation Logs', description: 'Track submissions & evaluations', icon: Activity, path: '/admin/operation-logs', category: 'monitoring' },
      { id: 'scheduled-jobs-monitor', title: 'Scheduled Jobs', description: 'Cron job status & manual triggers', icon: Timer, path: '/admin/scheduled-jobs', category: 'monitoring' },
      { id: 'analytics', title: 'Platform Analytics', description: 'Platform-wide insights & metrics', icon: TrendingUp, path: '/admin/analytics', category: 'monitoring' },
    ]
  },
  {
    name: 'Communications',
    description: 'Email and notification settings',
    sections: [
      { id: 'email-configuration', title: 'Email Configuration', description: 'Configure Resend API & sender settings', icon: Settings, path: '/admin/email-configuration', category: 'communications' },
    ]
  },
  {
    name: 'Learning & Certification',
    description: 'Training, certifications, and learning content',
    sections: [
      { id: 'learning-management', title: 'Learning Management', description: 'Manage learning content', icon: BookOpen, path: '/admin/learning-management', category: 'learning' },
      { id: 'training', title: 'Training Plans', description: 'Create & assign training plans', icon: Users, path: '/admin/training', category: 'learning' },
      { id: 'certification-admin', title: 'Certification Admin', description: 'Manage certification topics', icon: Award, path: '/admin/certification-admin', category: 'learning' },
      { id: 'certification-analytics', title: 'Certification Analytics', description: 'Certification metrics & insights', icon: TrendingUp, path: '/admin/certification-analytics', category: 'learning' },
    ]
  },
  {
    name: 'AI & Automation',
    description: 'AI configuration and proctoring settings',
    sections: [
      { id: 'ai-config', title: 'AI Configuration', description: 'Configure AI models & features', icon: Brain, path: '/admin/ai-configuration', category: 'ai' },
      { id: 'chatbot', title: 'Chatbot Management', description: 'AI assistant configuration', icon: Bot, path: '/admin/chatbot-management', category: 'ai' },
      { id: 'proctoring', title: 'Proctoring Settings', description: 'Configure interview monitoring', icon: Shield, path: '/admin/proctoring-settings', category: 'ai' },
    ]
  },
  {
    name: 'DevOps & Documentation',
    description: 'Deployment, testing, and platform documentation',
    sections: [
      { id: 'scheduled-jobs', title: 'Scheduled Jobs', description: 'Manage cron jobs & automated tasks', icon: Timer, path: '/admin/scheduled-jobs', category: 'devops' },
      { id: 'testing-hub', title: 'Testing Hub', description: 'Automated testing & QA', icon: FileCheck, path: '/admin/testing-hub', category: 'devops' },
      { id: 'deploy', title: 'Deployment Configurator', description: 'Deploy self-hosted copy', icon: Cloud, path: '/admin/deploy', category: 'devops' },
      { id: 'deploy-dashboard', title: 'Deployment Dashboard', description: 'Live infrastructure status', icon: Activity, path: '/admin/deploy-dashboard', category: 'devops' },
      { id: 'deploy-history', title: 'Deployment History', description: 'Track and rollback deployments', icon: History, path: '/admin/deploy-history', category: 'devops' },
      { id: 'documentation', title: 'Documentation', description: 'Platform documentation', icon: BookOpen, path: '/admin/documentation', category: 'devops' },
      { id: 'architecture', title: 'Architecture Diagrams', description: 'System architecture visualization', icon: Network, path: '/admin/architecture', category: 'devops' },
      { id: 'settings', title: 'Platform Settings', description: 'General platform configuration', icon: Settings, path: '/admin/settings', category: 'devops' },
    ]
  }
];

export default function PlatformAdminHub() {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { user } = useAuth();
  const { isPlatformAdmin, loading: rolesLoading } = useUserRoles();
  const { selectedOrgId, enterImpersonationMode } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  // Stats
  const [stats, setStats] = useState({ totalOrgs: 0, pendingApps: 0, activeOrgs: 0, activeSubs: 0 });

  useEffect(() => {
    if (!rolesLoading && isPlatformAdmin) {
      fetchAllData();
    }
  }, [rolesLoading, isPlatformAdmin]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchApplications(), fetchOrganizations(), fetchStats()]);
    } catch (error: any) {
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    const { data, error } = await supabase.from('partner_applications').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    setApplications(data || []);
  };

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select(`
        *,
        member_count:organization_members(count)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setOrganizations(data || []);
  };

  const fetchStats = async () => {
    const [orgsRes, appsRes, activeRes, subsRes] = await Promise.all([
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('partner_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('organization_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    setStats({ totalOrgs: orgsRes.count || 0, pendingApps: appsRes.count || 0, activeOrgs: activeRes.count || 0, activeSubs: subsRes.count || 0 });
  };

  const handleApprove = async (app: any) => {
    try {
      // Call edge function with service role privileges
      const { data, error } = await invokeFunction('approve-partner-application', {
        body: { applicationId: app.id },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error('Failed to approve application');
      }

      toast({
        title: 'Application Approved',
        description: `${data.organizationName} has been activated and the applicant has been granted access.`,
      });
      fetchAllData();
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
    if (!selectedApp || !rejectReason) return;
    try {
      const { error } = await supabase
        .from('partner_applications')
        .update({ 
          status: 'rejected', 
          rejection_reason: rejectReason,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedApp.id);
      
      if (error) throw error;
      
      toast({ title: 'Application Rejected' });
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedApp(null);
      fetchAllData();
    } catch (error: any) {
      logger.error('Rejection error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to reject application', 
        variant: 'destructive' 
      });
    }
  };

  const handleSendBackForReview = async () => {
    if (!selectedApp || !reviewNotes) return;
    try {
      const { error } = await supabase
        .from('partner_applications')
        .update({ 
          status: 'revision_requested', 
          review_notes: reviewNotes,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedApp.id);
      
      if (error) throw error;
      
      toast({ 
        title: 'Sent Back for Review',
        description: 'The applicant will be notified to revise their application.' 
      });
      setShowReviewDialog(false);
      setReviewNotes('');
      setSelectedApp(null);
      fetchAllData();
    } catch (error: any) {
      logger.error('Send back error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to send back for review', 
        variant: 'destructive' 
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { icon: any; className: string }> = {
      pending: { icon: Clock, className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
      approved: { icon: CheckCircle2, className: 'bg-green-500/10 text-green-700 border-green-500/20' },
      rejected: { icon: XCircle, className: 'bg-red-500/10 text-red-700 border-red-500/20' },
      revision_requested: { icon: AlertCircle, className: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
      active: { icon: CheckCircle2, className: 'bg-green-500/10 text-green-700 border-green-500/20' },
      cancelled: { icon: XCircle, className: 'bg-red-500/10 text-red-700 border-red-500/20' },
      expired: { icon: XCircle, className: 'bg-gray-500/10 text-gray-700 border-gray-500/20' },
    };
    const { icon: Icon, className } = config[status] || { icon: AlertCircle, className: 'bg-secondary' };
    return <Badge variant="outline" className={className}><Icon className="w-3 h-3 mr-1" />{status.replace('_', ' ')}</Badge>;
  };

  if (rolesLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!isPlatformAdmin) {
    return <div className="flex items-center justify-center h-[50vh]"><Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader></Card></div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold gradient-text flex items-center gap-2 sm:gap-3">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
            <span>Platform Admin Hub</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Unified control center for partner applications and operational management
          </p>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-in">
        <Card 
          className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-300 hover-lift cursor-pointer"
          onClick={() => navigate('/admin/organizations')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-3 sm:p-5 relative">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground mb-0.5">{stats.totalOrgs}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Total Organizations</p>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden border-warning/10 hover:border-warning/30 transition-all duration-300 hover-lift cursor-pointer"
          onClick={() => navigate('/admin/partner-applications-review')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-3 sm:p-5 relative">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              </div>
              {stats.pendingApps > 0 && (
                <Badge variant="secondary" className="animate-pulse text-[10px] sm:text-xs px-1.5 sm:px-2">
                  {stats.pendingApps}
                </Badge>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground mb-0.5">{stats.pendingApps}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Pending Applications</p>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden border-success/10 hover:border-success/30 transition-all duration-300 hover-lift cursor-pointer"
          onClick={() => navigate('/admin/organizations')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-3 sm:p-5 relative">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground mb-0.5">{stats.activeOrgs}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Active Organizations</p>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-300 hover-lift cursor-pointer"
          onClick={() => navigate('/admin/billing')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-3 sm:p-5 relative">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground mb-0.5">{stats.activeSubs}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Active Subscriptions</p>
          </CardContent>
        </Card>
      </div>

      {/* 3-Tier Platform Management Structure */}
      <div className="space-y-6 sm:space-y-8">
        {ADMIN_CATEGORIES.map((category) => (
          <div key={category.name}>
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2">{category.name}</h2>
              <p className="text-sm sm:text-base text-muted-foreground">{category.description}</p>
            </div>
            
            {/* Partner Applications under Critical Operations */}
            {category.name === 'Critical Operations' && (
              <Card className="group relative overflow-hidden border-primary/10 hover:border-primary/20 transition-all duration-300 mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
                <CardHeader className="border-b border-border/50 relative p-3 sm:py-4 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 shrink-0">
                        <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base sm:text-lg flex flex-wrap items-center gap-2">
                          <span>Partner Applications</span>
                          {stats.pendingApps > 0 && (
                            <Badge className="animate-pulse bg-primary/20 text-primary border-primary/30 text-xs">
                              {stats.pendingApps} Pending
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm hidden sm:block">Review and approve partner onboarding requests</CardDescription>
                      </div>
                    </div>
                    <Button 
                      onClick={() => navigate('/admin/applications')} 
                      size="sm" 
                      variant="outline"
                      className="hover:bg-primary/10 hover:text-primary hover:border-primary/30 min-h-[44px] w-full sm:w-auto"
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:pt-4 sm:px-6 relative">
                  {applications.filter(a => a.status === 'pending').length === 0 ? (
                    <div className="text-center py-6 sm:py-8">
                      <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm text-muted-foreground">No pending applications</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {applications.filter(a => a.status === 'pending').slice(0, 3).map((app, index) => (
                        <div 
                          key={app.id} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200 animate-fade-in"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm sm:text-base truncate">{app.organization_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{app.contact_email}</p>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button 
                              onClick={(e) => { e.stopPropagation(); handleApprove(app); }} 
                              size="sm"
                              className="bg-success/10 text-success hover:bg-success/20 border-success/20 h-10 w-10 sm:h-8 sm:w-8 p-0"
                              variant="outline"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button 
                              onClick={(e) => { e.stopPropagation(); setSelectedApp(app); setShowRejectDialog(true); }} 
                              variant="outline" 
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 border-destructive/20 h-10 w-10 sm:h-8 sm:w-8 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            <div className={`grid gap-3 sm:gap-4 ${
              category.sections.length <= 3 
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' 
                : category.sections.length <= 4 
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {category.sections.map(section => {
                const Icon = section.icon;
                return (
                  <Card
                    key={section.id}
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50 group active:scale-[0.98]"
                    onClick={() => navigate(section.path)}
                  >
                    <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors shrink-0">
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <CardTitle className="text-sm sm:text-base leading-tight">{section.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0">
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{section.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Dialogs */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>Provide a reason for rejection</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea 
            placeholder="Rejection reason..." 
            value={rejectReason} 
            onChange={(e) => setRejectReason(e.target.value)} 
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject}>Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Changes</AlertDialogTitle>
            <AlertDialogDescription>Provide feedback for revision</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea 
            placeholder="Review notes..." 
            value={reviewNotes} 
            onChange={(e) => setReviewNotes(e.target.value)} 
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendBackForReview}>Send Back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
