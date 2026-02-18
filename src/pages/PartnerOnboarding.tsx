import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { logger } from '@/lib/logger';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Brain, Building2, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Plan {
  id: string;
  name: string;
  plan_type: string;
  price_amount: number;
  currency: string;
  max_interviews: number;
  max_users: number;
  description: string | null;
  features: string[];
}

const PartnerOnboarding = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    organizationName: "",
    contactName: "",
    contactEmail: user?.email || "",
    contactPhone: "",
    companySize: "",
    industry: "",
    useCase: "",
    selectedPlanId: searchParams.get("plan") || "",
  });
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [revisingApplicationId, setRevisingApplicationId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth?redirect=/partner/onboarding");
      return;
    }
    checkExistingData();
    fetchPlans();
  }, [user]);

  const checkExistingData = async () => {
    if (!user) return;

    // Check for existing organization membership
    const { data: memberData, error: memberError } = await supabase
      .from("organization_members" as any)
      .select("*, organizations(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (memberError) {
      logger.error("Error checking organization membership:", memberError);
      toast({
        title: "Error",
        description: "Failed to check organization membership. Please contact Support@talentgeenie.com.",
        variant: "destructive",
      });
      return;
    }

    if (memberData) {
      setHasOrganization(true);
      return;
    }

    // Check for existing application (excluding rejected ones - users can reapply after rejection)
    const { data: appData, error: appError } = await supabase
      .from("partner_applications" as any)
      .select("*")
      .eq("applicant_user_id", user.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appError) {
      logger.error("Error checking applications:", appError);
    } else if (appData) {
      setExistingApplication(appData);
      // If revision requested, pre-fill form
      if ((appData as any).status === 'revision_requested') {
        const app = appData as any;
        setFormData({
          organizationName: app.organization_name,
          contactName: app.contact_name,
          contactEmail: app.contact_email,
          contactPhone: app.contact_phone,
          companySize: app.company_size,
          industry: app.industry,
          useCase: app.use_case,
          selectedPlanId: app.selected_plan_id,
        });
        setIsRevising(true);
        setRevisingApplicationId(app.id);
      }
    }
  };

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("subscription_plans" as any)
      .select("*")
      .eq("billing_period", "monthly")
      .eq("is_active", true)
      .order("display_order");

    if (!error && data) {
      setPlans(data as any);
      if (searchParams.get("plan") && data.length > 0) {
        const planData = data as any[];
        const selectedPlan = planData.find((p: any) => p.plan_type === searchParams.get("plan"));
        if (selectedPlan) {
          setFormData(prev => ({ ...prev, selectedPlanId: selectedPlan.id }));
        }
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validation
    if (!formData.organizationName || !formData.contactName || !formData.contactEmail ||
        !formData.companySize || !formData.industry || !formData.useCase || !formData.selectedPlanId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const applicationData = {
      organization_name: formData.organizationName,
      contact_name: formData.contactName,
      contact_email: formData.contactEmail,
      contact_phone: formData.contactPhone,
      company_size: formData.companySize,
      industry: formData.industry,
      use_case: formData.useCase,
      selected_plan_id: formData.selectedPlanId,
      status: "pending",
      ...(isRevising ? { reviewed_by: null, reviewed_at: null, rejection_reason: null } : {}),
    };

    let error;
    let applicationId: string | null = null;
    
    if (isRevising && revisingApplicationId) {
      // Update existing application
      const result = await supabase
        .from("partner_applications" as any)
        .update(applicationData)
        .eq("id", revisingApplicationId);
      error = result.error;
      applicationId = revisingApplicationId;
    } else {
      // Create new application
      const result = await supabase
        .from("partner_applications" as any)
        .insert({
          ...applicationData,
          applicant_user_id: user.id,
        })
        .single();
      error = result.error;
      applicationId = (result.data as any)?.id;
    }

    if (error) {
      setLoading(false);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Notify platform admins about new application
    try {
      // Get selected plan name for email
      const planName = selectedPlan?.name || 'Not specified';
      
      await invokeFunction('send-email', {
        body: {
          template: 'partner_application_submitted',
          to: 'admin@talentgeenie.com',
          data: {
            organization_name: formData.organizationName,
            contact_email: formData.contactEmail,
            contact_name: formData.contactName,
            industry: formData.industry,
            company_size: formData.companySize,
            plan_name: planName,
            review_url: `${window.location.origin}/admin/partner-applications`
          }
        }
      });
      logger.info('Admin notification email sent for partner application');
    } catch (emailError) {
      // Don't block submission if email fails
      logger.error('Failed to send admin notification email:', emailError);
    }

    setLoading(false);

    toast({
      title: isRevising ? "Application Resubmitted!" : "Application Submitted!",
      description: "We'll review your application and get back to you within 24-48 hours.",
    });

    navigate("/");
  };

  const selectedPlan = plans.find(p => p.id === formData.selectedPlanId);

  // Show redirect if user already has organization
  if (hasOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="glass max-w-md">
          <CardHeader>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success/20 to-primary/20 flex items-center justify-center mb-4 mx-auto">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <CardTitle className="text-2xl text-center">You're Already Set Up!</CardTitle>
            <CardDescription className="text-center">
              You already have an active organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/partner/portal')}
              className="w-full bg-gradient-to-r from-primary to-accent"
            >
              Go to Partner Portal
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show status if application is pending, rejected, or needs revision
  if (existingApplication) {
    const isRevisionRequested = existingApplication.status === 'revision_requested';
    const isPending = existingApplication.status === 'pending';
    const isRejected = existingApplication.status === 'rejected';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="glass max-w-md w-full">
          <CardHeader>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto ${
              isPending ? 'bg-gradient-to-br from-warning/20 to-primary/20' 
              : isRevisionRequested ? 'bg-gradient-to-br from-secondary/20 to-primary/20'
              : 'bg-gradient-to-br from-destructive/20 to-primary/20'
            }`}>
              <Building2 className={`w-7 h-7 ${
                isPending ? 'text-warning' 
                : isRevisionRequested ? 'text-secondary'
                : 'text-destructive'
              }`} />
            </div>
            <CardTitle className="text-2xl text-center">
              {isPending && 'Application Under Review'}
              {isRevisionRequested && 'Revision Requested'}
              {isRejected && 'Application Rejected'}
              {!isPending && !isRevisionRequested && !isRejected && 'Application Status'}
            </CardTitle>
            <CardDescription className="text-center">
              {isPending && "We're reviewing your partner application. You'll receive an email within 24-48 hours."}
              {isRevisionRequested && "Please review the feedback below and resubmit your application with the requested changes."}
              {isRejected && `Your application has been rejected. ${existingApplication.rejection_reason || ''}`}
              {!isPending && !isRevisionRequested && !isRejected && `Status: ${existingApplication.status}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-sm">
              <p><strong>Organization:</strong> {existingApplication.organization_name}</p>
              <p><strong>Submitted:</strong> {new Date(existingApplication.created_at).toLocaleDateString()}</p>
              {isRevisionRequested && existingApplication.rejection_reason && (
                <div className="mt-4 p-3 rounded-md bg-secondary/10 border border-secondary/20">
                  <p className="font-semibold text-secondary mb-1">Feedback from Admin:</p>
                  <p className="text-foreground whitespace-pre-wrap">{existingApplication.rejection_reason}</p>
                </div>
              )}
            </div>
            {isRevisionRequested ? (
              <Button 
                onClick={() => {
                  // Pre-populate form with existing data for revision
                  setFormData({
                    organizationName: existingApplication.organization_name,
                    contactName: existingApplication.contact_name,
                    contactEmail: existingApplication.contact_email,
                    contactPhone: existingApplication.contact_phone || "",
                    companySize: existingApplication.company_size,
                    industry: existingApplication.industry,
                    useCase: existingApplication.use_case,
                    selectedPlanId: existingApplication.selected_plan_id,
                  });
                  setIsRevising(true);
                  setRevisingApplicationId(existingApplication.id); // Store ID for UPDATE
                  setExistingApplication(null); // Hide status screen, show form
                }}
                className="w-full"
              >
                Revise & Resubmit Application
              </Button>
            ) : (
              <Button 
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full"
              >
                Back to Home
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <nav className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg sm:text-xl gradient-text">TalentGeenie</span>
                <span className="text-xs text-muted-foreground hidden sm:block">Partner Onboarding</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-12 max-w-4xl">
        {/* Progress Steps */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base ${
                  step >= num ? 'bg-gradient-to-r from-primary to-accent text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > num ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : num}
                </div>
                {num < 3 && <div className={`w-10 sm:w-20 h-1 mx-1 sm:mx-2 ${step > num ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm">
            <span className={step >= 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}>Company</span>
            <span className={step >= 2 ? 'text-foreground font-medium' : 'text-muted-foreground'}>Plan</span>
            <span className={step >= 3 ? 'text-foreground font-medium' : 'text-muted-foreground'}>Review</span>
          </div>
        </div>

        {/* Step 1: Company Information */}
        {step === 1 && (
          <Card className="glass">
            <CardHeader>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                {isRevising ? "Revise Company Information" : "Company Information"}
              </CardTitle>
              <CardDescription>
                {isRevising ? "Update the information based on admin feedback" : "Tell us about your organization"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name *</Label>
                <Input
                  id="orgName"
                  value={formData.organizationName}
                  onChange={(e) => handleInputChange("organizationName", e.target.value)}
                  placeholder="Acme Corporation"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange("contactName", e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                    placeholder="john@acme.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange("contactPhone", e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companySize">Company Size *</Label>
                  <Select value={formData.companySize} onValueChange={(val) => handleInputChange("companySize", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-500">201-500 employees</SelectItem>
                      <SelectItem value="501+">501+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry *</Label>
                  <Select value={formData.industry} onValueChange={(val) => handleInputChange("industry", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="useCase">How will you use TalentGeenie? *</Label>
                <Textarea
                  id="useCase"
                  value={formData.useCase}
                  onChange={(e) => handleInputChange("useCase", e.target.value)}
                  placeholder="Describe your hiring needs and how you plan to use the platform..."
                  rows={4}
                />
              </div>

              <Button onClick={() => setStep(2)} className="w-full" size="lg">
                Continue to Plan Selection
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <Card className="glass">
            <CardHeader>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">Choose Your Plan</CardTitle>
              <CardDescription>Select the plan that fits your needs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      formData.selectedPlanId === plan.id ? 'border-primary border-2' : ''
                    }`}
                    onClick={() => handleInputChange("selectedPlanId", plan.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                          <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                          <div className="flex gap-4 text-sm">
                            <span>{plan.max_interviews} interviews/month</span>
                            <span>•</span>
                            <span>Up to {plan.max_users} users</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold gradient-text">
                            {plan.currency === 'INR' ? '₹' : plan.currency === 'GBP' ? '£' : '$'}{plan.price_amount}
                          </div>
                          <div className="text-sm text-muted-foreground">/month</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1"
                  disabled={!formData.selectedPlanId}
                >
                  Continue to Review
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <Card className="glass">
            <CardHeader>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                {isRevising ? "Review & Resubmit" : "Review Your Application"}
              </CardTitle>
              <CardDescription>
                {isRevising ? "Confirm your revised information" : "Please review your information before submitting"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Organization</Label>
                    <p className="font-medium">{formData.organizationName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Contact Person</Label>
                    <p className="font-medium">{formData.contactName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{formData.contactEmail}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{formData.contactPhone || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Company Size</Label>
                    <p className="font-medium">{formData.companySize}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Industry</Label>
                    <p className="font-medium">{formData.industry}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Use Case</Label>
                  <p className="font-medium">{formData.useCase}</p>
                </div>

                {selectedPlan && (
                  <Card className="border-primary/50">
                    <CardContent className="p-4">
                      <Label className="text-muted-foreground">Selected Plan</Label>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <p className="font-bold text-lg">{selectedPlan.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedPlan.max_interviews} interviews/month • Up to {selectedPlan.max_users} users
                          </p>
                        </div>
                        <div className="text-2xl font-bold gradient-text">
                          {selectedPlan.currency === 'INR' ? '₹' : selectedPlan.currency === 'GBP' ? '£' : '$'}{selectedPlan.price_amount}/mo
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  By submitting this application, you agree that the information provided is accurate.
                  Our team will review your application within 24-48 hours.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-primary to-accent"
                >
                  {loading ? "Submitting..." : isRevising ? "Resubmit Application" : "Submit Application"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PartnerOnboarding;
