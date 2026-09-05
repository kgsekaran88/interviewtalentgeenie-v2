import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, Save, Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useOrganization } from "@/contexts/OrganizationContext";

const OrganizationSettings = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { selectedOrgId } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    website: "",
    industry: "",
    size: "",
    country: "",
    description: "",
    // Business verification fields
    legal_business_name: "",
    business_registration_number: "",
    tax_id: "",
    business_address: "",
    business_phone: "",
    year_established: "",
  });

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const fetchOrganizationData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: userRoles } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", user.id);

      const isPlatformAdmin = (userRoles as any)?.some((r: any) => r.role === "platform_admin");
      const isPartnerAdmin = (userRoles as any)?.some((r: any) => r.role === "partner_admin");
      const hasAdminRole = isPlatformAdmin || isPartnerAdmin;

      if (!hasAdminRole) {
        toast({
          title: "Access Denied",
          description: "Only partner admins can access organization settings.",
          variant: "destructive",
        });
        navigate("/partner/portal");
        return;
      }

      let org: any = null;

      const { data: memberData } = await supabase
        .from("organization_members" as any)
        .select("*, organizations(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (memberData) {
        org = (memberData as any).organizations;
      } else if (isPlatformAdmin) {
        if (selectedOrgId) {
          const { data: byId } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", selectedOrgId)
            .maybeSingle();
          org = byId;
        }
        if (!org) {
          const { data: firstOrg } = await supabase
            .from("organizations")
            .select("*")
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          org = firstOrg;
        }
      }

      if (!org) {
        toast({
          title: "Access Denied",
          description: "No organization available for settings.",
          variant: "destructive",
        });
        navigate("/partner/portal");
        return;
      }

      setOrganization(org);
      setFormData({
        name: org.name || "",
        website: org.website || "",
        industry: org.industry || "",
        size: org.size || "",
        country: org.country || "",
        description: org.description || "",
        legal_business_name: org.legal_business_name || "",
        business_registration_number: org.business_registration_number || "",
        tax_id: org.tax_id || "",
        business_address: org.business_address || "",
        business_phone: org.business_phone || "",
        year_established: org.year_established?.toString() || "",
      });

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

  // Check if all required verification fields are filled
  const isVerificationComplete = () => {
    return !!(
      formData.legal_business_name?.trim() &&
      formData.business_registration_number?.trim() &&
      formData.tax_id?.trim() &&
      formData.business_address?.trim() &&
      formData.business_phone?.trim()
    );
  };

  // Calculate verification completion percentage
  const getVerificationProgress = () => {
    const fields = [
      formData.legal_business_name,
      formData.business_registration_number,
      formData.tax_id,
      formData.business_address,
      formData.business_phone,
    ];
    const filled = fields.filter(f => f?.trim()).length;
    return (filled / fields.length) * 100;
  };

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      // Determine verification status based on filled fields
      const newVerificationStatus = isVerificationComplete() ? 'verified' : 'unverified';
      
      const updateData = {
        ...formData,
        year_established: formData.year_established ? parseInt(formData.year_established) : null,
        verification_status: newVerificationStatus,
      };

      const { error } = await supabase
        .from("organizations" as any)
        .update(updateData)
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: newVerificationStatus === 'verified' 
          ? "Organization verified! All required business details are complete."
          : "Organization settings updated successfully.",
      });

      setOrganization({ ...organization, ...updateData });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto animate-fade-in px-1 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text flex items-center gap-2 sm:gap-3">
              <Building2 className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
              <span className="hidden sm:inline">Organization Settings</span>
              <span className="sm:hidden">Settings</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
              Manage your organization details, branding, and subscription
            </p>
          </div>
          <Badge variant="outline" className="bg-gradient-to-r from-primary/10 to-accent/10 self-start sm:self-auto">
            {organization.status}
          </Badge>
        </div>

        <Tabs defaultValue="general" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 glass h-auto">
            <TabsTrigger value="general" className="min-h-[44px] text-xs sm:text-sm py-2">
              <Building2 className="w-4 h-4 mr-1 sm:mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="subscription" className="min-h-[44px] text-xs sm:text-sm py-2">
              <CreditCard className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Subscription</span>
              <span className="xs:hidden">Plan</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* Verification Status Banner */}
            <Card className={`border ${isVerificationComplete() ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {isVerificationComplete() ? (
                    <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3 className={`font-semibold ${isVerificationComplete() ? 'text-success' : 'text-warning'}`}>
                      {isVerificationComplete() ? 'Organization Verified' : 'Complete Your Profile'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isVerificationComplete() 
                        ? 'All required business verification details are complete.'
                        : 'Fill in all required business details below to verify your organization.'}
                    </p>
                    {!isVerificationComplete() && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Verification Progress</span>
                          <span>{Math.round(getVerificationProgress())}%</span>
                        </div>
                        <Progress value={getVerificationProgress()} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Update your organization's basic information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="TechCorp Solutions"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      placeholder="Technology"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size">Company Size</Label>
                    <Input
                      id="size"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      placeholder="50-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="United States"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Tell us about your organization..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Business Verification Card */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Business Verification
                  {!isVerificationComplete() && (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                      Required
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Provide your official business details to verify your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="legal_business_name">Legal Business Name *</Label>
                    <Input
                      id="legal_business_name"
                      value={formData.legal_business_name}
                      onChange={(e) => setFormData({ ...formData, legal_business_name: e.target.value })}
                      placeholder="TechCorp Solutions Pvt Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_registration_number">Business Registration Number *</Label>
                    <Input
                      id="business_registration_number"
                      value={formData.business_registration_number}
                      onChange={(e) => setFormData({ ...formData, business_registration_number: e.target.value })}
                      placeholder="CIN/Registration Number"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">Tax ID / GST Number *</Label>
                    <Input
                      id="tax_id"
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      placeholder="GSTIN / Tax ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_phone">Business Phone *</Label>
                    <Input
                      id="business_phone"
                      value={formData.business_phone}
                      onChange={(e) => setFormData({ ...formData, business_phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business_address">Registered Business Address *</Label>
                    <Textarea
                      id="business_address"
                      value={formData.business_address}
                      onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                      placeholder="123 Business Street, City, State, ZIP"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year_established">Year Established</Label>
                    <Input
                      id="year_established"
                      type="number"
                      min="1800"
                      max={new Date().getFullYear()}
                      value={formData.year_established}
                      onChange={(e) => setFormData({ ...formData, year_established: e.target.value })}
                      placeholder="2020"
                    />
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Current Subscription</CardTitle>
                <CardDescription>
                  Manage your subscription plan and billing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {plan ? (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{plan.name}</h3>
                        <p className="text-muted-foreground mt-1">{plan.description}</p>
                      </div>
                      <Badge className="bg-gradient-to-r from-primary to-accent border-0">
                        {plan.plan_type}
                      </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 rounded-lg border bg-card/50">
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="text-2xl font-bold mt-1">
                          ${plan.price_amount || 0}
                          <span className="text-sm font-normal text-muted-foreground">/{plan.billing_period}</span>
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card/50">
                        <p className="text-sm text-muted-foreground">Max Users</p>
                        <p className="text-2xl font-bold mt-1">{plan.max_users}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card/50">
                        <p className="text-sm text-muted-foreground">Interviews/Month</p>
                        <p className="text-2xl font-bold mt-1">{plan.max_interviews}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                      <Button onClick={() => navigate("/pricing")}>
                        Upgrade Plan
                      </Button>
                      <Button variant="outline" onClick={() => navigate("/partner/billing")}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Manage Billing
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No active subscription found</p>
                    <Button onClick={() => navigate("/pricing")} className="mt-4">
                      View Plans
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
};

export default OrganizationSettings;
