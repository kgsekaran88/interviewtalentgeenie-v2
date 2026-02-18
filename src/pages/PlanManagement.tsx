import { useState, useEffect } from 'react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { 
  CreditCard, Edit, Plus, Save, X, Loader2, 
  CheckCircle, XCircle, Users, Brain, Briefcase, DollarSign, Calculator 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  plan_type: string;
  price_amount: number;
  billing_period: string;
  max_users: number;
  max_interviews: number;
  max_ai_usage: number;
  features: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  currency: 'USD' | 'INR' | 'GBP';
  // Usage-based pricing fields
  pricing_model: 'fixed' | 'usage_based' | 'hybrid';
  price_per_interview: number;
  price_per_invitation: number;
  price_per_completed_interview: number;
  included_interviews: number;
  included_invitations: number;
  overage_price_per_interview: number;
  overage_price_per_invitation: number;
  minimum_monthly: number;
  pricing_notes: string | null;
  // Annual discount
  annual_discount_percent: number;
}

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'INR', label: 'Indian Rupee (₹)', symbol: '₹' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' }
];

const PLAN_TYPES = ['starter', 'professional', 'business', 'enterprise'];
const BILLING_PERIODS = ['monthly', 'annual'];
const PRICING_MODELS = [
  { value: 'fixed', label: 'Fixed Price', description: 'Flat monthly/annual fee' },
  { value: 'usage_based', label: 'Usage-Based', description: 'Pay per interview' },
  { value: 'hybrid', label: 'Hybrid', description: 'Base fee + overage charges' }
];

export default function PlanManagement() {
  const { isPlatformAdmin, loading: rolesLoading } = useUserRoles();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [featuresText, setFeaturesText] = useState('');

  useEffect(() => {
    if (!rolesLoading && isPlatformAdmin) {
      fetchPlans();
    }
  }, [rolesLoading, isPlatformAdmin]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPlans((data || []) as SubscriptionPlan[]);
    } catch (error: any) {
      toast({ title: 'Error loading plans', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan({ ...plan });
    setFeaturesText(Array.isArray(plan.features) ? plan.features.join('\n') : '');
    setIsCreating(false);
    setShowDialog(true);
  };

  const handleCreate = () => {
    setEditingPlan({
      id: '',
      name: '',
      description: '',
      plan_type: 'starter',
      price_amount: 0,
      billing_period: 'monthly',
      max_users: 5,
      max_interviews: 100,
      max_ai_usage: 10000,
      features: [],
      is_active: true,
      display_order: plans.length + 1,
      created_at: '',
      updated_at: '',
      currency: 'USD',
      // Usage-based pricing defaults
      pricing_model: 'fixed',
      price_per_interview: 0,
      price_per_invitation: 0,
      price_per_completed_interview: 0,
      included_interviews: 0,
      included_invitations: 0,
      overage_price_per_interview: 0,
      overage_price_per_invitation: 0,
      minimum_monthly: 0,
      pricing_notes: null,
      annual_discount_percent: 20
    });
    setFeaturesText('');
    setIsCreating(true);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!editingPlan) return;

    setSaving(true);
    try {
      const features = featuresText.split('\n').filter(f => f.trim());
      const planData = {
        name: editingPlan.name,
        description: editingPlan.description,
        plan_type: editingPlan.plan_type,
        price_amount: editingPlan.price_amount,
        billing_period: editingPlan.billing_period,
        max_users: editingPlan.max_users,
        max_interviews: editingPlan.max_interviews,
        max_ai_usage: editingPlan.max_ai_usage,
        features,
        is_active: editingPlan.is_active,
        display_order: editingPlan.display_order,
        currency: editingPlan.currency,
        // Usage-based pricing fields
        pricing_model: editingPlan.pricing_model,
        price_per_interview: editingPlan.price_per_interview,
        price_per_invitation: editingPlan.price_per_invitation,
        price_per_completed_interview: editingPlan.price_per_completed_interview,
        included_interviews: editingPlan.included_interviews,
        included_invitations: editingPlan.included_invitations,
        overage_price_per_interview: editingPlan.overage_price_per_interview,
        overage_price_per_invitation: editingPlan.overage_price_per_invitation,
        minimum_monthly: editingPlan.minimum_monthly,
        pricing_notes: editingPlan.pricing_notes,
        annual_discount_percent: editingPlan.annual_discount_percent
      };

      if (isCreating) {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(planData);
        if (error) throw error;
        toast({ title: 'Plan created successfully' });
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);
        if (error) throw error;
        toast({ title: 'Plan updated successfully' });
      }

      setShowDialog(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (error: any) {
      toast({ title: 'Error saving plan', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const togglePlanActive = async (plan: SubscriptionPlan) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;
      toast({ title: `Plan ${plan.is_active ? 'deactivated' : 'activated'}` });
      fetchPlans();
    } catch (error: any) {
      toast({ title: 'Error updating plan', description: error.message, variant: 'destructive' });
    }
  };

  const formatPrice = (amount: number, currency: string = 'USD') => {
    const localeMap: Record<string, string> = {
      'USD': 'en-US',
      'INR': 'en-IN',
      'GBP': 'en-GB'
    };
    return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find(c => c.value === currency)?.symbol || '$';
  };

  if (rolesLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-responsive-lg font-bold gradient-text flex items-center gap-3">
            <CreditCard className="w-8 h-8" />
            Subscription Plan Management
          </h1>
          <p className="text-muted-foreground">
            Configure interview limits, pricing, and features for each plan
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 min-h-[44px] w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Create Plan
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{plans.length}</p>
                <p className="text-xs text-muted-foreground">Total Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{plans.filter(p => p.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.max(...plans.map(p => p.max_interviews))}
                </p>
                <p className="text-xs text-muted-foreground">Max Interviews (Top Plan)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Interview Plans</CardTitle>
          <CardDescription>
            These limits are enforced across the platform during interview creation and invitation sending
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Pricing Model</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead className="text-center">Per Interview</TableHead>
                <TableHead className="text-center">Max Interviews</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {plan.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={
                        plan.pricing_model === 'usage_based' 
                          ? 'border-success/50 text-success bg-success/10' 
                          : plan.pricing_model === 'hybrid'
                          ? 'border-warning/50 text-warning bg-warning/10'
                          : ''
                      }
                    >
                      {plan.pricing_model === 'fixed' && '💰 Fixed'}
                      {plan.pricing_model === 'usage_based' && '📊 Usage-Based'}
                      {plan.pricing_model === 'hybrid' && '🔄 Hybrid'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{formatPrice(plan.price_amount, plan.currency)}</p>
                      <p className="text-xs text-muted-foreground">/{plan.billing_period}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {(plan.pricing_model === 'usage_based' || plan.pricing_model === 'hybrid') ? (
                      <div>
                        <span className="font-mono font-bold text-success">
                          {formatPrice(plan.price_per_interview || plan.overage_price_per_interview || 0, plan.currency)}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {plan.pricing_model === 'hybrid' && plan.included_interviews > 0 
                            ? `(${plan.included_interviews} included)` 
                            : 'per interview'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono font-bold text-primary">
                      {plan.max_interviews === -1 ? '∞' : plan.max_interviews.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    {plan.is_active ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(plan)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Switch
                        checked={plan.is_active}
                        onCheckedChange={() => togglePlanActive(plan)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? 'Create New Plan' : 'Edit Plan'}
            </DialogTitle>
            <DialogDescription>
              {isCreating 
                ? 'Configure a new subscription plan for the platform' 
                : 'Update plan settings. Changes will affect new subscriptions and usage checks.'}
            </DialogDescription>
          </DialogHeader>

          {editingPlan && (
            <Tabs defaultValue="pricing" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="identity">Identity</TabsTrigger>
                <TabsTrigger value="limits">Limits</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
              </TabsList>

              {/* Tab 1: Pricing Model - The fundamental choice that determines everything else */}
              <TabsContent value="pricing" className="space-y-4 mt-4">
                {/* Currency Selection - First because it affects all pricing fields */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <h4 className="font-semibold">Select Currency</h4>
                    </div>
                    <Select
                      value={editingPlan.currency}
                      onValueChange={(value: 'USD' | 'INR' | 'GBP') => setEditingPlan({ ...editingPlan, currency: value })}
                    >
                      <SelectTrigger className="text-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.value} value={curr.value}>
                            <span className="font-mono text-lg mr-2">{curr.symbol}</span>
                            {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Pricing Model Selection */}
                <Card className="border-success/20 bg-success/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="w-5 h-5 text-success" />
                      <h4 className="font-semibold">Pricing Model</h4>
                      <Badge variant="outline" className="ml-auto">
                        {getCurrencySymbol(editingPlan.currency)} {editingPlan.currency}
                      </Badge>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        {PRICING_MODELS.map((model) => (
                          <div
                            key={model.value}
                            onClick={() => setEditingPlan({ ...editingPlan, pricing_model: model.value as 'fixed' | 'usage_based' | 'hybrid' })}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              editingPlan.pricing_model === model.value
                                ? 'border-success bg-success/10'
                                : 'border-muted hover:border-muted-foreground/30'
                            }`}
                          >
                            <div className="text-center">
                              <span className="text-2xl mb-2 block">
                                {model.value === 'fixed' && '💰'}
                                {model.value === 'usage_based' && '📊'}
                                {model.value === 'hybrid' && '🔄'}
                              </span>
                              <p className="font-semibold text-sm">{model.label}</p>
                              <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Dynamic pricing fields based on model selection */}
                      <div className="border-t pt-4 mt-4">
                        {/* Base Price - shown for fixed and hybrid */}
                        {(editingPlan.pricing_model === 'fixed' || editingPlan.pricing_model === 'hybrid') && (
                          <div className="space-y-2 mb-4">
                            <Label className="text-base font-medium">
                              Base Price ({getCurrencySymbol(editingPlan.currency)}) *
                            </Label>
                            <Input
                              type="number"
                              value={editingPlan.price_amount}
                              onChange={(e) => setEditingPlan({ ...editingPlan, price_amount: parseFloat(e.target.value) || 0 })}
                              placeholder="99"
                              className="text-lg font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                              Display: {formatPrice(editingPlan.price_amount, editingPlan.currency)}/{editingPlan.billing_period}
                            </p>
                          </div>
                        )}

                        {/* Fixed pricing info */}
                        {editingPlan.pricing_model === 'fixed' && (
                          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                            <Calculator className="w-4 h-4 inline mr-2" />
                            Fixed pricing: Partners pay a flat fee regardless of usage.
                          </div>
                        )}

                        {/* Usage-based pricing options */}
                        {editingPlan.pricing_model === 'usage_based' && (
                          <>
                            <h5 className="font-medium mb-3">Per-Unit Pricing</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                  <Briefcase className="w-4 h-4" />
                                  Per Interview ({getCurrencySymbol(editingPlan.currency)})
                                </Label>
                                <Input
                                  type="number"
                                  value={editingPlan.price_per_interview}
                                  onChange={(e) => setEditingPlan({ 
                                    ...editingPlan, 
                                    price_per_interview: parseFloat(e.target.value) || 0 
                                  })}
                                  placeholder="5"
                                  className="font-mono"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" />
                                  Per Completed ({getCurrencySymbol(editingPlan.currency)})
                                </Label>
                                <Input
                                  type="number"
                                  value={editingPlan.price_per_completed_interview}
                                  onChange={(e) => setEditingPlan({ 
                                    ...editingPlan, 
                                    price_per_completed_interview: parseFloat(e.target.value) || 0 
                                  })}
                                  placeholder="3"
                                  className="font-mono"
                                />
                              </div>
                            </div>
                            <div className="mt-4 space-y-2">
                              <Label className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Per Invitation ({getCurrencySymbol(editingPlan.currency)})
                              </Label>
                              <Input
                                type="number"
                                value={editingPlan.price_per_invitation}
                                onChange={(e) => setEditingPlan({ 
                                  ...editingPlan, 
                                  price_per_invitation: parseFloat(e.target.value) || 0 
                                })}
                                placeholder="1"
                                className="font-mono"
                              />
                            </div>
                            <div className="mt-4 space-y-2">
                              <Label>Minimum Monthly Commitment ({getCurrencySymbol(editingPlan.currency)})</Label>
                              <Input
                                type="number"
                                value={editingPlan.minimum_monthly}
                                onChange={(e) => setEditingPlan({ 
                                  ...editingPlan, 
                                  minimum_monthly: parseFloat(e.target.value) || 0 
                                })}
                                placeholder="50"
                                className="font-mono"
                              />
                              <p className="text-xs text-muted-foreground">Optional minimum charge</p>
                            </div>
                          </>
                        )}

                        {/* Hybrid: Base + Included + Overage */}
                        {editingPlan.pricing_model === 'hybrid' && (
                          <>
                            <div className="border-t pt-4 mt-4">
                              <h5 className="font-medium mb-3 flex items-center gap-2">
                                <Calculator className="w-4 h-4" />
                                Included in Base Price
                              </h5>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Included Interviews</Label>
                                  <Input
                                    type="number"
                                    value={editingPlan.included_interviews}
                                    onChange={(e) => setEditingPlan({ 
                                      ...editingPlan, 
                                      included_interviews: parseInt(e.target.value) || 0 
                                    })}
                                    placeholder="50"
                                    className="font-mono"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Included Invitations</Label>
                                  <Input
                                    type="number"
                                    value={editingPlan.included_invitations}
                                    onChange={(e) => setEditingPlan({ 
                                      ...editingPlan, 
                                      included_invitations: parseInt(e.target.value) || 0 
                                    })}
                                    placeholder="100"
                                    className="font-mono"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                              <h5 className="font-medium mb-3">Overage Pricing</h5>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Overage per Interview ({getCurrencySymbol(editingPlan.currency)})</Label>
                                  <Input
                                    type="number"
                                    value={editingPlan.overage_price_per_interview}
                                    onChange={(e) => setEditingPlan({ 
                                      ...editingPlan, 
                                      overage_price_per_interview: parseFloat(e.target.value) || 0 
                                    })}
                                    placeholder="6"
                                    className="font-mono"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Overage per Invitation ({getCurrencySymbol(editingPlan.currency)})</Label>
                                  <Input
                                    type="number"
                                    value={editingPlan.overage_price_per_invitation}
                                    onChange={(e) => setEditingPlan({ 
                                      ...editingPlan, 
                                      overage_price_per_invitation: parseFloat(e.target.value) || 0 
                                    })}
                                    placeholder="1.50"
                                    className="font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-2 border-t pt-4">
                        <Label>Pricing Notes (internal)</Label>
                        <Textarea
                          value={editingPlan.pricing_notes || ''}
                          onChange={(e) => setEditingPlan({ ...editingPlan, pricing_notes: e.target.value })}
                          placeholder="Special pricing arrangement..."
                          rows={2}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Billing - Period, Annual Discount */}
              <TabsContent value="billing" className="space-y-4 mt-4">
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <h4 className="font-semibold">Billing Configuration</h4>
                      <Badge variant="outline" className="ml-auto">
                        {getCurrencySymbol(editingPlan.currency)} {editingPlan.currency}
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Billing Period</Label>
                          <Select
                            value={editingPlan.billing_period}
                            onValueChange={(value) => setEditingPlan({ ...editingPlan, billing_period: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BILLING_PERIODS.map((period) => (
                                <SelectItem key={period} value={period} className="capitalize">
                                  {period}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Annual Discount %
                            <Badge variant="outline" className="text-xs">Default: 20%</Badge>
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={editingPlan.annual_discount_percent}
                            onChange={(e) => setEditingPlan({ 
                              ...editingPlan, 
                              annual_discount_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                            })}
                            placeholder="20"
                          />
                        </div>
                      </div>

                      {editingPlan.price_amount > 0 && (
                        <div className="p-3 rounded-lg bg-muted/50 text-sm">
                          <p className="text-muted-foreground">
                            <strong>Annual price preview:</strong>{' '}
                            {formatPrice(editingPlan.price_amount * 12 * (1 - editingPlan.annual_discount_percent / 100), editingPlan.currency)}/year
                            {' '}({editingPlan.annual_discount_percent}% off monthly rate)
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: Identity - Name, Description, Type, Display Order, Status */}
              <TabsContent value="identity" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plan Name *</Label>
                    <Input
                      value={editingPlan.name}
                      onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      placeholder="Professional Plan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan Type</Label>
                    <Select
                      value={editingPlan.plan_type}
                      onValueChange={(value) => setEditingPlan({ ...editingPlan, plan_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLAN_TYPES.map((type) => (
                          <SelectItem key={type} value={type} className="capitalize">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingPlan.description || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                    placeholder="Perfect for growing teams..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      value={editingPlan.display_order}
                      onChange={(e) => setEditingPlan({ ...editingPlan, display_order: parseInt(e.target.value) || 0 })}
                      placeholder="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower numbers appear first on pricing page
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-3 h-10 px-3 border rounded-md bg-muted/30">
                      <Switch
                        checked={editingPlan.is_active}
                        onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, is_active: checked })}
                      />
                      <span className={editingPlan.is_active ? 'text-success font-medium' : 'text-muted-foreground'}>
                        {editingPlan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Inactive plans are hidden from users
                    </p>
                  </div>
                </div>
              </TabsContent>


              {/* Tab 4: Limits */}
              <TabsContent value="limits" className="space-y-4 mt-4">
                <Card className="border-warning/20 bg-warning/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Briefcase className="w-5 h-5 text-warning" />
                      <h4 className="font-semibold">Usage Limits</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      These limits are enforced platform-wide when organizations use the platform
                    </p>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          Max Interviews per Month
                        </Label>
                        <Input
                          type="number"
                          value={editingPlan.max_interviews}
                          onChange={(e) => setEditingPlan({ ...editingPlan, max_interviews: parseInt(e.target.value) || 0 })}
                          placeholder="100"
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                          Use -1 for unlimited. Organizations are blocked once limit is reached.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Max Team Members
                        </Label>
                        <Input
                          type="number"
                          value={editingPlan.max_users}
                          onChange={(e) => setEditingPlan({ ...editingPlan, max_users: parseInt(e.target.value) || 0 })}
                          placeholder="10"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum users per organization on this plan
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Brain className="w-4 h-4" />
                          Max AI Usage (tokens)
                        </Label>
                        <Input
                          type="number"
                          value={editingPlan.max_ai_usage}
                          onChange={(e) => setEditingPlan({ ...editingPlan, max_ai_usage: parseInt(e.target.value) || 0 })}
                          placeholder="10000"
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                          AI token limit for question generation and evaluations
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 5: Features */}
              <TabsContent value="features" className="space-y-4 mt-4">
                <Card className="border-muted">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="w-5 h-5 text-primary" />
                      <h4 className="font-semibold">Plan Features</h4>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Features (one per line)</Label>
                      <Textarea
                        value={featuresText}
                        onChange={(e) => setFeaturesText(e.target.value)}
                        placeholder="AI Question Generation&#10;Advanced Proctoring&#10;Priority Support&#10;Custom Branding"
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        These features are displayed on the pricing page and help users compare plans
                      </p>
                    </div>

                    {featuresText && (
                      <div className="mt-4 p-3 rounded-lg bg-muted/50">
                        <p className="text-xs font-medium mb-2">Preview ({featuresText.split('\n').filter(f => f.trim()).length} features):</p>
                        <ul className="space-y-1">
                          {featuresText.split('\n').filter(f => f.trim()).slice(0, 5).map((feature, idx) => (
                            <li key={idx} className="text-sm flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-success" />
                              {feature.trim()}
                            </li>
                          ))}
                          {featuresText.split('\n').filter(f => f.trim()).length > 5 && (
                            <li className="text-xs text-muted-foreground">
                              +{featuresText.split('\n').filter(f => f.trim()).length - 5} more...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isCreating ? 'Create Plan' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
