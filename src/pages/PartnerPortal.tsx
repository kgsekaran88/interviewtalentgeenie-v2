import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { logger } from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePortalCardOrder } from "@/hooks/usePortalCardOrder";
import { DraggablePortalCard } from "@/components/partner/DraggablePortalCard";
import { 
  Building2, 
  Users, 
  TrendingUp, 
  CreditCard, 
  Settings, 
  UserPlus,
  BarChart3,
  AlertCircle,
  Palette,
  Search,
  FileText,
  Calendar,
  Eye,
  BookTemplate,
  FileSpreadsheet,
  GripVertical,
  Check,
  X,
  RotateCcw
} from "lucide-react";
import { formatRoleName, getRoleColor } from "@/lib/roleFormatters";

const PartnerPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const impersonateOrgId = searchParams.get('impersonate');
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { userOrgId, isImpersonating, enterImpersonationMode } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { cardOrder, setCardOrder, isSaving, saveCardOrder, resetToDefault, isLoading: isLoadingOrder } = usePortalCardOrder('partner');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    // If impersonate param exists, set it in context first
    if (impersonateOrgId) {
      enterImpersonationMode(impersonateOrgId);
    }
    checkPlatformAdminStatus();
  }, [impersonateOrgId]);

  const checkPlatformAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check user roles
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = roleData?.map(r => r.role) || [];
      setUserRoles(roles);
      
      const isPlatformAdminUser = roles.includes('platform_admin');
      setIsPlatformAdmin(isPlatformAdminUser);

      // If platform admin and NOT impersonating (no URL param and no context flag), redirect to /admin
      const isCurrentlyImpersonating = !!impersonateOrgId || isImpersonating;
      if (isPlatformAdminUser && !isCurrentlyImpersonating) {
        navigate('/admin');
        return;
      }

      // Otherwise, proceed to fetch organization data
      fetchOrganizationData(impersonateOrgId);
    } catch (error) {
      logger.error('Error checking platform admin status:', error);
      // For platform admins with errors, redirect to admin dashboard
      // This prevents them from seeing "onboarding required" error
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'platform_admin')
          .maybeSingle();
        
        if (roleCheck) {
          navigate('/admin');
          return;
        }
      }
      fetchOrganizationData(null); // Continue for non-platform admins
    }
  };

  // Helper to fetch subscription, usage, and members for an org
  const fetchOrgDetails = async (org: any) => {
    // Fetch subscription
    const { data: subData } = await supabase
      .from("organization_subscriptions" as any)
      .select("*, subscription_plans(*)")
      .eq("organization_id", org.id)
      .eq("status", "active")
      .maybeSingle();

    if (subData) {
      setSubscription(subData);
      setPlan((subData as any).subscription_plans);
    }

    // Fetch usage from usage_tracking
    const { data: usageData } = await supabase
      .from("usage_tracking" as any)
      .select("*")
      .eq("organization_id", org.id)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Count completed interview ATTEMPTS (candidate submissions) for this organization
    const { count: attemptCount } = await supabase
      .from("interview_attempts" as any)
      .select("*, interviews!inner(organization_id)", { count: 'exact', head: true })
      .eq("interviews.organization_id", org.id)
      .in("status", ['submitted', 'evaluated', 'completed']);

    // Merge real attempt count with usage data
    const mergedUsage = {
      interviews_conducted: attemptCount || 0,
      ai_tokens_used: (usageData as any)?.ai_tokens_used || 0
    };

    setUsage(mergedUsage);

    // Fetch team members
    const { data: membersData } = await supabase
      .from("organization_members" as any)
      .select("*")
      .eq("organization_id", org.id)
      .eq("status", "active");

    // Fetch roles and profiles for all members
    if (membersData && membersData.length > 0) {
      const memberIds = membersData.map((m: any) => m.user_id);
      
      // Fetch roles
      const { data: rolesData } = await supabase
        .from("user_roles" as any)
        .select("user_id, role")
        .in("user_id", memberIds);

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from("profiles" as any)
        .select("id, full_name, email")
        .in("id", memberIds);

      // Merge roles and profiles with members
      const membersWithRoles = membersData.map((member: any) => {
        const profile = profilesData?.find((p: any) => p.id === member.user_id);
        return {
          ...member,
          profiles: profile || null,
          roles: rolesData?.filter((r: any) => r.user_id === member.user_id).map((r: any) => r.role) || []
        };
      });
      
      setMembers(membersWithRoles);
    }
  };

  const fetchOrganizationData = async (impersonateOrgId: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // If impersonating, fetch that org directly instead of user's membership
      if (impersonateOrgId) {
        const { data: impersonatedOrg, error: impersonateError } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", impersonateOrgId)
          .maybeSingle();

        if (impersonateError || !impersonatedOrg) {
          logger.error("Error fetching impersonated organization:", impersonateError);
          setError("Failed to load organization data.");
          setLoading(false);
          return;
        }

        // Use the impersonated org directly
        setOrganization(impersonatedOrg);
        await fetchOrgDetails(impersonatedOrg);
        setLoading(false);
        return;
      }

      // Check if user has organization membership
      const { data: memberData, error: memberError } = await supabase
        .from("organization_members" as any)
        .select("*, organizations(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (memberError) {
        logger.error("Error fetching organization membership:", memberError);
        setError("Failed to load organization data. This may be a permissions issue. Please contact Support@talentgeenie.com.");
        setLoading(false);
        return;
      }

      if (!memberData) {
        // Check if user has a partner application
        const { data: appData } = await supabase
          .from("partner_applications" as any)
          .select("status")
          .eq("applicant_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (appData) {
          const status = (appData as any).status;
          if (status === "pending") {
            setError("Your partner application is under review. You'll receive an email once it's approved.");
          } else if (status === "revision_requested") {
            setError("Your application requires revisions. Please complete the onboarding process.");
            // Redirect to onboarding after showing message
            setTimeout(() => navigate("/partner/onboarding"), 2000);
          } else if (status === "rejected") {
            setError("Your partner application was not approved. Please contact Support@talentgeenie.com for more information.");
          } else if (status === "approved") {
            setError("Your application was approved but organization setup is incomplete. Please contact Support@talentgeenie.com.");
          }
        } else {
          setError("You haven't completed partner onboarding yet. Please start the onboarding process.");
          // Redirect to onboarding after showing message
          setTimeout(() => navigate("/partner/onboarding"), 2000);
        }
        setLoading(false);
        return;
      }

      const org = (memberData as any).organizations;
      setOrganization(org);
      await fetchOrgDetails(org);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-success/10 text-success border-success/20",
      pending_approval: "bg-warning/10 text-warning border-warning/20",
      suspended: "bg-destructive/10 text-destructive border-destructive/20",
      draft: "bg-muted text-muted-foreground border-border",
      published: "bg-primary/10 text-primary border-primary/20",
      archived: "bg-secondary/10 text-secondary border-secondary/20",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = cardOrder.indexOf(active.id as string);
      const newIndex = cardOrder.indexOf(over.id as string);
      const newOrder = arrayMove(cardOrder, oldIndex, newIndex);
      setCardOrder(newOrder);
    }
  };

  const handleSaveLayout = async () => {
    const success = await saveCardOrder(cardOrder);
    if (success) {
      successToast('Layout saved successfully');
      setIsEditMode(false);
    } else {
      errorToast('Failed to save layout');
    }
  };

  const handleResetLayout = async () => {
    const success = await resetToDefault();
    if (success) {
      successToast('Layout reset to default');
      setIsEditMode(false);
    } else {
      errorToast('Failed to reset layout');
    }
  };

  // Card configuration with visibility rules
  const cardConfigs = useMemo(() => ({
    interview_management: {
      id: 'interview_management',
      visible: userRoles.includes('hr_recruiter') || userRoles.includes('partner_admin') || userRoles.includes('platform_admin'),
      title: 'Interview Management',
      description: 'Create & manage interviews',
      icon: FileText,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      borderColor: 'border-primary/10 hover:border-primary/30',
      route: '/partner/recruiting/interviews',
      actionText: 'Manage →',
      subtitle: 'View all interviews',
    },
    proctoring: {
      id: 'proctoring',
      visible: userRoles.includes('hr_recruiter') || userRoles.includes('partner_admin') || userRoles.includes('platform_admin'),
      title: 'Proctoring',
      description: 'Monitor integrity & sessions',
      icon: Eye,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      borderColor: 'border-primary/10 hover:border-primary/30',
      route: '/partner/recruiting/proctoring',
      actionText: 'Manage →',
      subtitle: 'View proctoring data',
    },
    reports_analytics: {
      id: 'reports_analytics',
      visible: userRoles.includes('partner_admin') || userRoles.includes('platform_admin'),
      title: 'Reports & Analytics',
      description: 'Dashboards, charts & export reports',
      icon: FileSpreadsheet,
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
      borderColor: 'border-accent/10 hover:border-accent/30',
      route: '/partner/reports',
      actionText: 'Generate →',
      subtitle: 'Dynamic reports with Excel export',
    },
    user_management: {
      id: 'user_management',
      visible: userRoles.includes('partner_admin') || userRoles.includes('platform_admin'),
      title: 'User Management',
      description: 'Manage team members',
      icon: Users,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      borderColor: 'border-primary/10 hover:border-primary/30',
      route: '/partner/users',
      actionText: 'Manage →',
      subtitle: `${members.length} member${members.length !== 1 ? 's' : ''}`,
    },
    interview_templates: {
      id: 'interview_templates',
      visible: userRoles.includes('hr_recruiter') || userRoles.includes('partner_admin') || userRoles.includes('platform_admin'),
      title: 'Interview Templates',
      description: 'Browse & create from templates',
      icon: BookTemplate,
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
      borderColor: 'border-accent/10 hover:border-accent/30',
      route: '/partner/recruiting/templates',
      actionText: 'Browse →',
      subtitle: 'Pre-configured interviews',
    },
    pending_reviews: {
      id: 'pending_reviews',
      visible: userRoles.includes('tech_spoc'),
      title: 'Pending Reviews',
      description: 'Review questions & assessments',
      icon: Search,
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
      borderColor: 'border-accent/10 hover:border-accent/30',
      route: '/partner/recruiting/pending-reviews',
      actionText: 'Review →',
      subtitle: 'Technical review queue',
    },
    learning_training: {
      id: 'learning_training',
      visible: true,
      title: 'Learning & Training',
      description: 'Training topics & assessments',
      icon: BarChart3,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      borderColor: 'border-primary/10 hover:border-primary/30',
      route: '/learning-dashboard',
      actionText: 'Manage →',
      subtitle: 'View learning resources',
    },
    billing_subscription: {
      id: 'billing_subscription',
      visible: plan && (userRoles.includes('partner_admin') || userRoles.includes('platform_admin') || userRoles.includes('billing_contact')),
      title: 'Billing & Subscription',
      description: plan?.name ? `${plan.name} Plan` : 'Manage billing',
      icon: CreditCard,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      borderColor: 'border-primary/10 hover:border-primary/30',
      route: '/partner/billing',
      actionText: 'Manage Billing →',
      subtitle: `Candidate Attempts: ${usage?.interviews_conducted || 0} / ${plan?.max_interviews || '∞'}`,
    },
    organization_settings: {
      id: 'organization_settings',
      visible: userRoles.includes('partner_admin') || userRoles.includes('platform_admin'),
      title: 'Organization Settings',
      description: 'Configure your organization',
      icon: Settings,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      borderColor: 'border-primary/10 hover:border-primary/30',
      route: '/partner/settings',
      actionText: 'Configure →',
      subtitle: organization?.name || '',
    },
  }), [userRoles, members.length, plan, usage, organization]);

  const visibleCards = useMemo(() => 
    cardOrder.filter(id => cardConfigs[id as keyof typeof cardConfigs]?.visible),
    [cardOrder, cardConfigs]
  );

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Error Loading Partner Portal</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" onClick={() => navigate('/partner/onboarding')}>
                    Go to Onboarding
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('/')}>
                    Go to Home
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold gradient-text flex items-center gap-2 sm:gap-3">
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
            <span className="truncate">Partner Hub</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground truncate">
            {organization.name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={getStatusColor(organization.status)}>
              {organization.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {subscription?.status === 'past_due' && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Payment Required</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your subscription payment is overdue. Please update your payment method to continue using the service.
                </p>
                <Button size="sm" variant="destructive" className="mt-3">
                  Update Payment Method
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-in">
        <Card className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-3 sm:p-4 md:p-6 relative">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <Badge variant="secondary" className="text-[10px] sm:text-xs hidden sm:flex">{members.length} / {plan?.max_users || 0}</Badge>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">{members.length}</p>
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-medium">Team Members</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-success/10 hover:border-success/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-3 sm:p-4 md:p-6 relative">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-success/10 group-hover:bg-success/20 transition-colors">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-success" />
              </div>
              <Badge variant="secondary" className="text-[10px] sm:text-xs hidden sm:flex">{usage?.interviews_conducted || 0} / {plan?.max_interviews || 0}</Badge>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">{usage?.interviews_conducted || 0}</p>
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-medium">Attempts</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-accent/10 hover:border-accent/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-3 sm:p-4 md:p-6 relative">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-accent" />
              </div>
              <Badge variant="secondary" className="text-[10px] sm:text-xs hidden sm:flex">{usage?.ai_tokens_used || 0} / {plan?.max_ai_usage || 0}</Badge>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">{usage?.ai_tokens_used || 0}</p>
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-medium">AI Usage</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-primary/10 hover:border-primary/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-3 sm:p-4 md:p-6 relative">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">
              ${((plan?.price_cents || 0) / 100).toFixed(0)}
            </p>
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-medium">Current Plan</p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Layout Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Dashboard Cards</h2>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(false)}
                disabled={isSaving}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetLayout}
                disabled={isSaving}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSaveLayout}
                disabled={isSaving}
              >
                <Check className="w-4 h-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save Layout'}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditMode(true)}
            >
              <GripVertical className="w-4 h-4 mr-1" />
              Edit Layout
            </Button>
          )}
        </div>
      </div>

      {isEditMode && (
        <p className="text-sm text-muted-foreground -mt-4">
          Drag cards to rearrange them. Click Save Layout when done.
        </p>
      )}

      {/* Management Cards Grid with DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleCards} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {visibleCards.map((cardId) => {
              const config = cardConfigs[cardId as keyof typeof cardConfigs];
              if (!config || !config.visible) return null;
              
              const IconComponent = config.icon;
              
              return (
                <DraggablePortalCard key={cardId} id={cardId} isEditMode={isEditMode}>
                  <Card 
                    className={`group cursor-pointer hover:shadow-lg transition-all duration-300 ${config.borderColor}`}
                    onClick={() => !isEditMode && navigate(config.route)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${config.iconBg} group-hover:opacity-80 transition-colors`}>
                          <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{config.title}</CardTitle>
                          <CardDescription className="text-sm">{config.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {config.subtitle}
                        </div>
                        <Button variant="ghost" size="sm" tabIndex={isEditMode ? -1 : 0}>
                          {config.actionText}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </DraggablePortalCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default PartnerPortal;
