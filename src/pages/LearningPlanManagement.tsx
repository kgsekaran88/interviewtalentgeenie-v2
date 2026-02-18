import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, GraduationCap, BookOpen, Brain, Sparkles } from "lucide-react";

interface LearningPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: string;
  max_assessments: number;
  max_certifications: number;
  max_ai_usage: number;
  features: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const defaultPlan: Omit<LearningPlan, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  price: 0,
  billing_period: 'monthly',
  max_assessments: 10,
  max_certifications: 5,
  max_ai_usage: 100,
  features: [],
  is_active: true,
  display_order: 0,
};

export default function LearningPlanManagement() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LearningPlan | null>(null);
  const [formData, setFormData] = useState(defaultPlan);
  const [featuresText, setFeaturesText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      const typedPlans = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : []
      })) as LearningPlan[];
      
      setPlans(typedPlans);
    } catch (error) {
      logger.error('Error fetching learning plans:', error);
      toast.error('Failed to load learning plans');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData(defaultPlan);
    setFeaturesText('');
    setDialogOpen(true);
  };

  const openEditDialog = (plan: LearningPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      billing_period: plan.billing_period,
      max_assessments: plan.max_assessments,
      max_certifications: plan.max_certifications,
      max_ai_usage: plan.max_ai_usage,
      features: plan.features,
      is_active: plan.is_active,
      display_order: plan.display_order,
    });
    setFeaturesText(plan.features.join('\n'));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    setSaving(true);
    try {
      const features = featuresText.split('\n').filter(f => f.trim());
      const planData = {
        ...formData,
        features,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('learning_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        toast.success('Learning plan updated successfully');
      } else {
        const { error } = await supabase
          .from('learning_plans')
          .insert([planData]);

        if (error) throw error;
        toast.success('Learning plan created successfully');
      }

      setDialogOpen(false);
      fetchPlans();
    } catch (error) {
      logger.error('Error saving learning plan:', error);
      toast.error('Failed to save learning plan');
    } finally {
      setSaving(false);
    }
  };

  const togglePlanStatus = async (plan: LearningPlan) => {
    try {
      const { error } = await supabase
        .from('learning_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;
      toast.success(`Plan ${plan.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchPlans();
    } catch (error) {
      logger.error('Error toggling plan status:', error);
      toast.error('Failed to update plan status');
    }
  };

  const formatLimit = (value: number) => {
    return value === -1 ? 'Unlimited' : value.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Learning Plan Management</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Configure learning subscription plans</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="min-h-[44px] self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Learning Plan' : 'Create Learning Plan'}</DialogTitle>
              <DialogDescription>
                Configure the learning plan settings. These limits will be enforced across the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Learner Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this plan"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billing_period">Billing Period</Label>
                  <Select
                    value={formData.billing_period}
                    onValueChange={(value) => setFormData({ ...formData, billing_period: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">One-Time</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    min="0"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Usage Limits
                </h4>
                <p className="text-xs text-muted-foreground">Use -1 for unlimited</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_assessments" className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Max Assessments
                    </Label>
                    <Input
                      id="max_assessments"
                      type="number"
                      min="-1"
                      value={formData.max_assessments}
                      onChange={(e) => setFormData({ ...formData, max_assessments: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_certifications" className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      Max Certifications
                    </Label>
                    <Input
                      id="max_certifications"
                      type="number"
                      min="-1"
                      value={formData.max_certifications}
                      onChange={(e) => setFormData({ ...formData, max_certifications: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_ai_usage" className="flex items-center gap-1">
                      <Brain className="h-3 w-3" />
                      Max AI Usage
                    </Label>
                    <Input
                      id="max_ai_usage"
                      type="number"
                      min="-1"
                      value={formData.max_ai_usage}
                      onChange={(e) => setFormData({ ...formData, max_ai_usage: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Features (one per line)</Label>
                <Textarea
                  id="features"
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : (editingPlan ? 'Update Plan' : 'Create Plan')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                ${plan.price}
                <span className="text-sm font-normal text-muted-foreground">/{plan.billing_period}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <BookOpen className="h-3 w-3" />
                    Assessments
                  </span>
                  <span className="font-medium">{formatLimit(plan.max_assessments)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <GraduationCap className="h-3 w-3" />
                    Certifications
                  </span>
                  <span className="font-medium">{formatLimit(plan.max_certifications)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Brain className="h-3 w-3" />
                    AI Usage
                  </span>
                  <span className="font-medium">{formatLimit(plan.max_ai_usage)}</span>
                </div>
              </div>

              {plan.features.length > 0 && (
                <div className="border-t pt-3 space-y-1">
                  {plan.features.slice(0, 3).map((feature, index) => (
                    <p key={index} className="text-xs text-muted-foreground">• {feature}</p>
                  ))}
                  {plan.features.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{plan.features.length - 3} more</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Status</span>
                <Switch
                  checked={plan.is_active}
                  onCheckedChange={() => togglePlanStatus(plan)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Learning Plans</h3>
            <p className="text-muted-foreground mb-4">Create your first learning plan to get started</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
