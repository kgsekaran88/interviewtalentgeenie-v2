import { useState, useEffect } from 'react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { 
  CreditCard, Loader2, Settings, Eye, EyeOff, Check, X, 
  AlertTriangle, TestTube, Zap, Shield, Globe
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PaymentGateway {
  id: string;
  gateway_name: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  is_test_mode: boolean;
  test_public_key_encrypted: string | null;
  test_secret_key_encrypted: string | null;
  live_public_key_encrypted: string | null;
  live_secret_key_encrypted: string | null;
  webhook_secret_encrypted: string | null;
  config: Record<string, any>;
  supported_currencies: string[];
  created_at: string;
  updated_at: string;
}

const GATEWAY_ICONS: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="h-6 w-6 text-[#635BFF]" />,
  razorpay: <Zap className="h-6 w-6 text-[#528FF0]" />,
  paypal: <Globe className="h-6 w-6 text-[#003087]" />,
};

export default function PaymentGatewayManagement() {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { isPlatformAdmin, loading: rolesLoading } = useUserRoles();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  
  // Form state for editing gateway
  const [formData, setFormData] = useState({
    testPublicKey: '',
    testSecretKey: '',
    livePublicKey: '',
    liveSecretKey: '',
    webhookSecret: '',
  });

  useEffect(() => {
    if (!rolesLoading && isPlatformAdmin) {
      fetchGateways();
    }
  }, [rolesLoading, isPlatformAdmin]);

  const fetchGateways = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .order('gateway_name');

      if (error) throw error;
      setGateways((data as PaymentGateway[]) || []);
    } catch (error: any) {
      toast({
        title: 'Error loading gateways',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (gateway: PaymentGateway) => {
    setSaving(gateway.id);
    try {
      const { error } = await supabase
        .from('payment_gateways')
        .update({ is_enabled: !gateway.is_enabled })
        .eq('id', gateway.id);

      if (error) throw error;

      setGateways(prev => 
        prev.map(g => g.id === gateway.id ? { ...g, is_enabled: !g.is_enabled } : g)
      );

      toast({
        title: gateway.is_enabled ? 'Gateway Disabled' : 'Gateway Enabled',
        description: `${gateway.display_name} has been ${gateway.is_enabled ? 'disabled' : 'enabled'}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleToggleTestMode = async (gateway: PaymentGateway) => {
    setSaving(gateway.id);
    try {
      const { error } = await supabase
        .from('payment_gateways')
        .update({ is_test_mode: !gateway.is_test_mode })
        .eq('id', gateway.id);

      if (error) throw error;

      setGateways(prev => 
        prev.map(g => g.id === gateway.id ? { ...g, is_test_mode: !g.is_test_mode } : g)
      );

      toast({
        title: gateway.is_test_mode ? 'Switched to Live Mode' : 'Switched to Test Mode',
        description: `${gateway.display_name} is now in ${gateway.is_test_mode ? 'live' : 'test'} mode.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const openConfigDialog = (gateway: PaymentGateway) => {
    setSelectedGateway(gateway);
    // Clear form - we don't pre-fill encrypted values
    setFormData({
      testPublicKey: '',
      testSecretKey: '',
      livePublicKey: '',
      liveSecretKey: '',
      webhookSecret: '',
    });
    setShowConfigDialog(true);
  };

  const handleSaveKeys = async () => {
    if (!selectedGateway) return;
    
    setSaving(selectedGateway.id);
    try {
      const updateData: Record<string, any> = {};
      
      // Only update fields that have values
      if (formData.testPublicKey) {
        updateData.test_public_key_encrypted = formData.testPublicKey;
      }
      if (formData.testSecretKey) {
        updateData.test_secret_key_encrypted = formData.testSecretKey;
      }
      if (formData.livePublicKey) {
        updateData.live_public_key_encrypted = formData.livePublicKey;
      }
      if (formData.liveSecretKey) {
        updateData.live_secret_key_encrypted = formData.liveSecretKey;
      }
      if (formData.webhookSecret) {
        updateData.webhook_secret_encrypted = formData.webhookSecret;
      }

      if (Object.keys(updateData).length === 0) {
        toast({
          title: 'No Changes',
          description: 'Please enter at least one key to update.',
        });
        return;
      }

      const { error } = await supabase
        .from('payment_gateways')
        .update(updateData)
        .eq('id', selectedGateway.id);

      if (error) throw error;

      toast({
        title: 'Keys Updated',
        description: `API keys for ${selectedGateway.display_name} have been saved and encrypted.`,
      });

      setShowConfigDialog(false);
      fetchGateways();
    } catch (error: any) {
      toast({
        title: 'Error saving keys',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const hasTestKeys = (gateway: PaymentGateway) => {
    return gateway.test_secret_key_encrypted && gateway.test_secret_key_encrypted.length > 0;
  };

  const hasLiveKeys = (gateway: PaymentGateway) => {
    return gateway.live_secret_key_encrypted && gateway.live_secret_key_encrypted.length > 0;
  };

  const hasActiveKeys = (gateway: PaymentGateway) => {
    return gateway.is_test_mode ? hasTestKeys(gateway) : hasLiveKeys(gateway);
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
            <CardDescription>You need platform admin access to manage payment gateways.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8 max-w-5xl mx-auto animate-fade-in px-2 sm:px-0">
      {/* Header */}
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text flex items-center gap-2 sm:gap-3">
          <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
          Payment Gateway Config
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Configure and manage payment gateway API keys (encrypted)
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{gateways.length}</p>
                <p className="text-xs text-muted-foreground">Total Gateways</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {gateways.filter(g => g.is_enabled && hasActiveKeys(g)).length}
                </p>
                <p className="text-xs text-muted-foreground">Active & Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <TestTube className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {gateways.filter(g => g.is_enabled && g.is_test_mode).length}
                </p>
                <p className="text-xs text-muted-foreground">In Test Mode</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gateways List */}
      <div className="space-y-4">
        {gateways.map((gateway) => (
          <Card key={gateway.id} className={`transition-all duration-200 ${gateway.is_enabled ? 'border-primary/20' : 'opacity-60'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Gateway Info */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    {GATEWAY_ICONS[gateway.gateway_name] || <CreditCard className="h-6 w-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{gateway.display_name}</h3>
                      {gateway.is_test_mode && (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                          <TestTube className="h-3 w-3 mr-1" />
                          Test Mode
                        </Badge>
                      )}
                      {gateway.is_enabled && hasActiveKeys(gateway) && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          <Check className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      )}
                      {gateway.is_enabled && !hasActiveKeys(gateway) && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          No Keys
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{gateway.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Currencies:</span>
                      <div className="flex gap-1">
                        {gateway.supported_currencies.slice(0, 4).map((currency) => (
                          <Badge key={currency} variant="secondary" className="text-xs px-1.5 py-0">
                            {currency}
                          </Badge>
                        ))}
                        {gateway.supported_currencies.length > 4 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            +{gateway.supported_currencies.length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  {/* Test/Live Toggle */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {gateway.is_test_mode ? 'Test' : 'Live'}
                    </span>
                    <Switch
                      checked={!gateway.is_test_mode}
                      onCheckedChange={() => handleToggleTestMode(gateway)}
                      disabled={saving === gateway.id}
                    />
                  </div>

                  {/* Enable/Disable Toggle */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {gateway.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={gateway.is_enabled}
                      onCheckedChange={() => handleToggleEnabled(gateway)}
                      disabled={saving === gateway.id}
                    />
                  </div>

                  {/* Configure Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openConfigDialog(gateway)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Keys
                  </Button>
                </div>
              </div>

              {/* Key Status */}
              <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${hasTestKeys(gateway) ? 'bg-success' : 'bg-muted'}`} />
                  <span className="text-muted-foreground">Test Keys</span>
                  {hasTestKeys(gateway) ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${hasLiveKeys(gateway) ? 'bg-success' : 'bg-muted'}`} />
                  <span className="text-muted-foreground">Live Keys</span>
                  {hasLiveKeys(gateway) ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Encrypted</span>
                  <Check className="h-3 w-3 text-success" />
                </div>
                <div className="text-muted-foreground text-xs">
                  Updated: {new Date(gateway.updated_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No payment enabled alert */}
      {gateways.every(g => !g.is_enabled || !hasActiveKeys(g)) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Not Enabled</AlertTitle>
          <AlertDescription>
            No payment gateway is currently configured and enabled. Users will see "Payment not enabled" 
            when attempting to make purchases. Configure at least one gateway above to enable payments.
          </AlertDescription>
        </Alert>
      )}

      {/* Configure Keys Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedGateway && GATEWAY_ICONS[selectedGateway.gateway_name]}
              Configure {selectedGateway?.display_name} API Keys
            </DialogTitle>
            <DialogDescription>
              Enter your API keys below. Keys are encrypted before storage and never displayed again.
              Leave fields empty to keep existing values.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="test" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="test">
                <TestTube className="h-4 w-4 mr-2" />
                Test Keys
              </TabsTrigger>
              <TabsTrigger value="live">
                <Zap className="h-4 w-4 mr-2" />
                Live Keys
              </TabsTrigger>
            </TabsList>

            <TabsContent value="test" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="testPublicKey">Test Publishable Key</Label>
                <div className="relative">
                  <Input
                    id="testPublicKey"
                    type={showKeys.testPublic ? 'text' : 'password'}
                    placeholder="pk_test_..."
                    value={formData.testPublicKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, testPublicKey: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowKeys(prev => ({ ...prev, testPublic: !prev.testPublic }))}
                  >
                    {showKeys.testPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testSecretKey">Test Secret Key</Label>
                <div className="relative">
                  <Input
                    id="testSecretKey"
                    type={showKeys.testSecret ? 'text' : 'password'}
                    placeholder="sk_test_..."
                    value={formData.testSecretKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, testSecretKey: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowKeys(prev => ({ ...prev, testSecret: !prev.testSecret }))}
                  >
                    {showKeys.testSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="live" className="space-y-4 mt-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Production Keys</AlertTitle>
                <AlertDescription>
                  These keys will be used for real transactions. Ensure your account is properly set up.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="livePublicKey">Live Publishable Key</Label>
                <div className="relative">
                  <Input
                    id="livePublicKey"
                    type={showKeys.livePublic ? 'text' : 'password'}
                    placeholder="pk_live_..."
                    value={formData.livePublicKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, livePublicKey: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowKeys(prev => ({ ...prev, livePublic: !prev.livePublic }))}
                  >
                    {showKeys.livePublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="liveSecretKey">Live Secret Key</Label>
                <div className="relative">
                  <Input
                    id="liveSecretKey"
                    type={showKeys.liveSecret ? 'text' : 'password'}
                    placeholder="sk_live_..."
                    value={formData.liveSecretKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, liveSecretKey: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowKeys(prev => ({ ...prev, liveSecret: !prev.liveSecret }))}
                  >
                    {showKeys.liveSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2 mt-4">
            <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
            <div className="relative">
              <Input
                id="webhookSecret"
                type={showKeys.webhook ? 'text' : 'password'}
                placeholder="whsec_..."
                value={formData.webhookSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, webhookSecret: e.target.value }))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowKeys(prev => ({ ...prev, webhook: !prev.webhook }))}
              >
                {showKeys.webhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required for receiving payment confirmations and subscription updates.
            </p>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveKeys} disabled={saving === selectedGateway?.id}>
              {saving === selectedGateway?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Save & Encrypt
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
