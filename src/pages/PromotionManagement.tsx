import { useState, useEffect } from 'react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { 
  Tag, Edit, Plus, Save, X, Loader2, CheckCircle, XCircle, 
  Calendar, Users, Percent, Copy, Gift, Clock, Building
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
import { format } from 'date-fns';

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  promotion_type: 'coupon_code' | 'time_limited' | 'first_period' | 'partner_specific';
  code: string | null;
  discount_percent: number;
  valid_from: string;
  valid_until: string | null;
  first_period_type: 'month' | 'year' | null;
  first_period_discount_percent: number | null;
  max_uses: number | null;
  current_uses: number;
  max_uses_per_org: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const PROMOTION_TYPES = [
  { value: 'coupon_code', label: 'Coupon Code', icon: Tag, description: 'Partners enter a code at signup' },
  { value: 'time_limited', label: 'Time-Limited Offer', icon: Clock, description: 'Automatic discount during date range' },
  { value: 'first_period', label: 'First Period Discount', icon: Gift, description: 'Discounted first month/year' },
  { value: 'partner_specific', label: 'Partner-Specific', icon: Building, description: 'Custom pricing for specific partners' }
];

export default function PromotionManagement() {
  const { isPlatformAdmin, loading: rolesLoading } = useUserRoles();
  const { toast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!rolesLoading && isPlatformAdmin) {
      fetchPromotions();
    }
  }, [rolesLoading, isPlatformAdmin]);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions((data || []) as Promotion[]);
    } catch (error: any) {
      toast({ title: 'Error loading promotions', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromo({ ...promo });
    setIsCreating(false);
    setShowDialog(true);
  };

  const handleCreate = () => {
    setEditingPromo({
      id: '',
      name: '',
      description: '',
      promotion_type: 'coupon_code',
      code: '',
      discount_percent: 20,
      valid_from: new Date().toISOString(),
      valid_until: null,
      first_period_type: 'month',
      first_period_discount_percent: 100,
      max_uses: null,
      current_uses: 0,
      max_uses_per_org: 1,
      is_active: true,
      created_at: '',
      updated_at: ''
    });
    setIsCreating(true);
    setShowDialog(true);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (editingPromo) {
      setEditingPromo({ ...editingPromo, code });
    }
  };

  const handleSave = async () => {
    if (!editingPromo) return;

    setSaving(true);
    try {
      const promoData = {
        name: editingPromo.name,
        description: editingPromo.description,
        promotion_type: editingPromo.promotion_type,
        code: editingPromo.promotion_type === 'coupon_code' ? editingPromo.code?.toUpperCase() : null,
        discount_percent: editingPromo.discount_percent,
        valid_from: editingPromo.valid_from,
        valid_until: editingPromo.valid_until || null,
        first_period_type: editingPromo.promotion_type === 'first_period' ? editingPromo.first_period_type : null,
        first_period_discount_percent: editingPromo.promotion_type === 'first_period' ? editingPromo.first_period_discount_percent : null,
        max_uses: editingPromo.max_uses,
        max_uses_per_org: editingPromo.max_uses_per_org,
        is_active: editingPromo.is_active
      };

      if (isCreating) {
        const { error } = await supabase
          .from('promotions')
          .insert(promoData);
        if (error) throw error;
        toast({ title: 'Promotion created successfully' });
      } else {
        const { error } = await supabase
          .from('promotions')
          .update(promoData)
          .eq('id', editingPromo.id);
        if (error) throw error;
        toast({ title: 'Promotion updated successfully' });
      }

      setShowDialog(false);
      setEditingPromo(null);
      fetchPromotions();
    } catch (error: any) {
      toast({ title: 'Error saving promotion', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const togglePromoActive = async (promo: Promotion) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id);

      if (error) throw error;
      toast({ title: `Promotion ${promo.is_active ? 'deactivated' : 'activated'}` });
      fetchPromotions();
    } catch (error: any) {
      toast({ title: 'Error updating promotion', description: error.message, variant: 'destructive' });
    }
  };

  const getPromoTypeIcon = (type: string) => {
    const found = PROMOTION_TYPES.find(t => t.value === type);
    return found ? found.icon : Tag;
  };

  const getPromoStatus = (promo: Promotion) => {
    if (!promo.is_active) return { label: 'Inactive', variant: 'secondary' as const };
    
    const now = new Date();
    const validFrom = new Date(promo.valid_from);
    const validUntil = promo.valid_until ? new Date(promo.valid_until) : null;
    
    if (now < validFrom) return { label: 'Scheduled', variant: 'outline' as const };
    if (validUntil && now > validUntil) return { label: 'Expired', variant: 'destructive' as const };
    if (promo.max_uses && promo.current_uses >= promo.max_uses) return { label: 'Exhausted', variant: 'destructive' as const };
    
    return { label: 'Active', variant: 'default' as const };
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
            <Tag className="w-8 h-8" />
            Promotion Management
          </h1>
          <p className="text-muted-foreground">
            Create and manage promotional offers, coupon codes, and partner-specific pricing
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 min-h-[44px] w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Create Promotion
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-primary/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{promotions.length}</p>
                <p className="text-xs text-muted-foreground">Total Promotions</p>
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
                <p className="text-2xl font-bold">
                  {promotions.filter(p => getPromoStatus(p).label === 'Active').length}
                </p>
                <p className="text-xs text-muted-foreground">Active Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Percent className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {promotions.reduce((sum, p) => sum + p.current_uses, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Uses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-info/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Gift className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {promotions.filter(p => p.promotion_type === 'coupon_code').length}
                </p>
                <p className="text-xs text-muted-foreground">Coupon Codes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promotions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Promotions</CardTitle>
          <CardDescription>
            Manage promotional offers and track their usage
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Promotion</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-center">Usage</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((promo) => {
                const status = getPromoStatus(promo);
                const TypeIcon = getPromoTypeIcon(promo.promotion_type);
                return (
                  <TableRow key={promo.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{promo.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {promo.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <TypeIcon className="w-3 h-3" />
                        {PROMOTION_TYPES.find(t => t.value === promo.promotion_type)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-success">
                        {promo.discount_percent}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {promo.code ? (
                        <Badge variant="secondary" className="font-mono">
                          {promo.code}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono">
                        {promo.current_uses}
                        {promo.max_uses ? `/${promo.max_uses}` : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p>From: {format(new Date(promo.valid_from), 'MMM d, yyyy')}</p>
                        {promo.valid_until && (
                          <p className="text-muted-foreground">
                            Until: {format(new Date(promo.valid_until), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>
                        {status.label === 'Active' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {status.label === 'Inactive' && <XCircle className="w-3 h-3 mr-1" />}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(promo)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Switch
                          checked={promo.is_active}
                          onCheckedChange={() => togglePromoActive(promo)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {promotions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No promotions yet. Create your first promotion to get started.
                  </TableCell>
                </TableRow>
              )}
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
              {isCreating ? 'Create New Promotion' : 'Edit Promotion'}
            </DialogTitle>
            <DialogDescription>
              {isCreating 
                ? 'Configure a new promotional offer' 
                : 'Update promotion settings'}
            </DialogDescription>
          </DialogHeader>

          {editingPromo && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Promotion Name</Label>
                    <Input
                      value={editingPromo.name}
                      onChange={(e) => setEditingPromo({ ...editingPromo, name: e.target.value })}
                      placeholder="Summer Sale 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Promotion Type</Label>
                    <Select
                      value={editingPromo.promotion_type}
                      onValueChange={(value: Promotion['promotion_type']) => 
                        setEditingPromo({ ...editingPromo, promotion_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROMOTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="w-4 h-4" />
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingPromo.description || ''}
                    onChange={(e) => setEditingPromo({ ...editingPromo, description: e.target.value })}
                    placeholder="Get 20% off your first 3 months..."
                    rows={2}
                  />
                </div>

                {/* Coupon Code */}
                {editingPromo.promotion_type === 'coupon_code' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Coupon Code
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={editingPromo.code || ''}
                        onChange={(e) => setEditingPromo({ 
                          ...editingPromo, 
                          code: e.target.value.toUpperCase() 
                        })}
                        placeholder="SUMMER20"
                        className="font-mono uppercase"
                      />
                      <Button variant="outline" onClick={generateCode} type="button">
                        <Copy className="w-4 h-4 mr-2" />
                        Generate
                      </Button>
                    </div>
                  </div>
                )}

                {/* Discount Percent */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Discount Percentage
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editingPromo.discount_percent}
                    onChange={(e) => setEditingPromo({ 
                      ...editingPromo, 
                      discount_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                    })}
                    placeholder="20"
                  />
                </div>

                {/* First Period Settings */}
                {editingPromo.promotion_type === 'first_period' && (
                  <Card className="border-primary/20">
                    <CardContent className="pt-4 space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Gift className="w-4 h-4" />
                        First Period Settings
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Period Type</Label>
                          <Select
                            value={editingPromo.first_period_type || 'month'}
                            onValueChange={(value: 'month' | 'year') => 
                              setEditingPromo({ ...editingPromo, first_period_type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="month">First Month</SelectItem>
                              <SelectItem value="year">First Year</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>First Period Discount %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={editingPromo.first_period_discount_percent || 100}
                            onChange={(e) => setEditingPromo({ 
                              ...editingPromo, 
                              first_period_discount_percent: parseInt(e.target.value) || 0
                            })}
                            placeholder="100"
                          />
                          <p className="text-xs text-muted-foreground">
                            100% = completely free first period
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-4">
                {/* Validity Period */}
                <Card className="border-warning/20">
                  <CardContent className="pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Validity Period
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valid From</Label>
                        <Input
                          type="datetime-local"
                          value={editingPromo.valid_from ? 
                            format(new Date(editingPromo.valid_from), "yyyy-MM-dd'T'HH:mm") : ''}
                          onChange={(e) => setEditingPromo({ 
                            ...editingPromo, 
                            valid_from: new Date(e.target.value).toISOString()
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valid Until (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={editingPromo.valid_until ? 
                            format(new Date(editingPromo.valid_until), "yyyy-MM-dd'T'HH:mm") : ''}
                          onChange={(e) => setEditingPromo({ 
                            ...editingPromo, 
                            valid_until: e.target.value ? new Date(e.target.value).toISOString() : null
                          })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty for no expiration
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Usage Limits */}
                <Card className="border-info/20">
                  <CardContent className="pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Usage Limits
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Max Total Uses</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editingPromo.max_uses || ''}
                          onChange={(e) => setEditingPromo({ 
                            ...editingPromo, 
                            max_uses: e.target.value ? parseInt(e.target.value) : null
                          })}
                          placeholder="Unlimited"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty for unlimited uses
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Max Uses per Organization</Label>
                        <Input
                          type="number"
                          min="1"
                          value={editingPromo.max_uses_per_org}
                          onChange={(e) => setEditingPromo({ 
                            ...editingPromo, 
                            max_uses_per_org: parseInt(e.target.value) || 1
                          })}
                          placeholder="1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingPromo.is_active}
                    onCheckedChange={(checked) => setEditingPromo({ ...editingPromo, is_active: checked })}
                  />
                  <Label>Promotion is active</Label>
                </div>
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
              {isCreating ? 'Create Promotion' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
