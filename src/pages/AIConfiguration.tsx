import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAIHealthMonitoring } from "@/hooks/useAIHealthMonitoring";
import {
  Brain,
  Key,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Trash2,
  TestTube,
  Activity,
  AlertCircle,
  Save,
  RefreshCw,
  AlertTriangle,
  Bell,
  TrendingUp,
  Zap,
} from "lucide-react";

interface AIProvider {
  id: string;
  name: string;
  display_name: string;
  provider_type: string;
  base_url: string;
  supported_models: any; // Json type from Supabase
  is_active: boolean;
  description: string;
}

interface AICredential {
  id: string;
  provider_id: string;
  model_preference: string;
  rate_limit_per_minute: number;
  is_active: boolean;
  last_tested_at: string;
  test_status: string;
  test_error: string;
  providers?: AIProvider;
}

interface AIFeatureConfig {
  id: string;
  feature_name: string;
  display_name: string;
  description: string;
  primary_provider_id: string;
  fallback_provider_id: string;
  fallback_enabled: boolean;
  retry_attempts: number;
  timeout_seconds: number;
  usage_count: number;
  last_used_at?: string;
  is_enabled: boolean;
  primary_provider?: AIProvider;
  fallback_provider?: AIProvider;
}

interface DetectedAIFeature {
  id: string;
  name: string;
  edge_function: string;
  model_used: string;
  purpose: string;
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  error_count?: number;
  last_error?: string;
}

export default function AIConfiguration() {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [credentials, setCredentials] = useState<AICredential[]>([]);
  const [features, setFeatures] = useState<AIFeatureConfig[]>([]);
  const [detectedFeatures, setDetectedFeatures] = useState<DetectedAIFeature[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  
  // AI Health Monitoring
  const {
    healthData,
    alerts,
    updating,
    availableModels,
    fetchHealthData,
    updateFeatureModel,
    acknowledgeAlert,
    toggleFeatureEnabled,
  } = useAIHealthMonitoring();
  
  // Dialog states
  const [addKeyDialogOpen, setAddKeyDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [modelPreference, setModelPreference] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [providersRes, credentialsRes, featuresRes] = await Promise.all([
        supabase.from('ai_providers').select('*').eq('is_active', true),
        supabase.from('ai_provider_credentials').select('*, providers:ai_providers(*)').eq('is_active', true),
        supabase.from('ai_feature_configurations').select(`
          *,
          primary_provider:ai_providers!ai_feature_configurations_primary_provider_id_fkey(*),
          fallback_provider:ai_providers!ai_feature_configurations_fallback_provider_id_fkey(*)
        `),
      ]);

      if (providersRes.error) throw providersRes.error;
      if (credentialsRes.error) throw credentialsRes.error;
      if (featuresRes.error) throw featuresRes.error;

      setProviders(providersRes.data || []);
      setCredentials(credentialsRes.data || []);
      setFeatures(featuresRes.data || []);
    } catch (error: any) {
      toast({
        title: "Error Loading Configuration",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scanAIFeatures = async () => {
    setScanning(true);
    try {
      toast({
        title: "Scanning Platform",
        description: "Analyzing AI features and auto-updating configurations...",
      });

      const { data, error } = await invokeFunction('scan-ai-features', {
        body: {},
      });

      if (error) throw error;

      if (data?.success) {
        setDetectedFeatures(data.features || []);
        
        const statusCounts = {
          healthy: data.healthy_count || 0,
          degraded: data.degraded_count || 0,
          failed: data.failed_count || 0,
        };
        
        toast({
          title: "Scan Complete",
          description: `Found ${data.total_count || 0} features: ${statusCounts.healthy} healthy, ${statusCounts.degraded} degraded, ${statusCounts.failed} failed. Configurations updated automatically.`,
          variant: statusCounts.failed > 0 ? 'destructive' : 'default',
        });
        
        // Refresh all data
        await fetchHealthData();
        await fetchData();
      }
    } catch (error: any) {
      logger.error('Error scanning AI features:', error);
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to scan AI features",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const handleAddCredential = async () => {
    if (!selectedProvider) {
      toast({
        title: "Missing Information",
        description: "Please select a provider",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey || !apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "API key is mandatory for adding credentials",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // API key is automatically encrypted by database trigger (encrypt_api_key_trigger)
      const { error } = await supabase.from('ai_provider_credentials').insert({
        provider_id: selectedProvider,
        api_key_encrypted: apiKey, // Encrypted automatically by DB trigger using pgsodium
        model_preference: modelPreference,
        test_status: 'pending',
      });

      if (error) throw error;

      toast({
        title: "API Key Added",
        description: "Credential saved successfully. Test the connection to verify.",
      });

      setAddKeyDialogOpen(false);
      setApiKey("");
      setModelPreference("");
      setSelectedProvider("");
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error Adding Credential",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (credentialId: string, providerId: string) => {
    setTesting(credentialId);
    try {
      // Call edge function to test the connection
      const { data, error } = await invokeFunction('test-ai-connection', {
        body: { credential_id: credentialId, provider_id: providerId }
      });

      if (error) throw error;

      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const handleUpdateFeature = async (featureId: string, updates: Partial<AIFeatureConfig>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_feature_configurations')
        .update(updates)
        .eq('id', featureId);

      if (error) throw error;

      toast({
        title: "Configuration Updated",
        description: "AI feature configuration saved successfully.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const { error } = await supabase
        .from('ai_provider_credentials')
        .delete()
        .eq('id', credentialId);

      if (error) throw error;

      toast({
        title: "Credential Deleted",
        description: "API key removed successfully.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getProviderIcon = (type: string) => {
    const icons: Record<string, string> = {
      google: "🔵",
      openai: "🟢",
      anthropic: "🟣",
      perplexity: "🔷",
    };
    return icons[type] || "🤖";
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: any; icon: any }> = {
      success: { variant: "default", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: XCircle },
      pending: { variant: "secondary", icon: AlertCircle },
    };
    const config = styles[status] || styles.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 sm:gap-3">
          <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
          <span className="truncate">AI Configuration</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
          Manage AI providers, API keys, and feature assignments
        </p>
      </div>

      {/* Warning Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Available Services:</strong> Currently using Google Gemini as the primary AI provider. 
          Add your own API keys here to use additional AI providers like OpenAI, Anthropic, or Perplexity.
        </AlertDescription>
      </Alert>

      {/* Active Provider Status */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Active AI Provider Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Primary Provider</p>
              {credentials.length > 0 && credentials.some(c => c.test_status === 'success') ? (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="default">Configured</Badge>
                  <span className="text-muted-foreground">
                    Using custom provider from AI Configuration
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">Fallback</Badge>
                  <span className="text-muted-foreground">
                    Using environment variables (Gemini AI)
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Configured Providers</p>
              <div className="flex flex-wrap gap-2">
                {credentials.filter(c => c.test_status === 'success').length > 0 ? (
                  credentials
                    .filter(c => c.test_status === 'success')
                    .map(cred => (
                      <Badge key={cred.id} variant="secondary" className="text-xs">
                        {getProviderIcon(cred.providers?.provider_type || "")} {cred.providers?.display_name}
                      </Badge>
                    ))
                ) : (
                  <span className="text-xs text-muted-foreground">No custom providers configured</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <Alert variant={alerts[0].severity === 'critical' ? 'destructive' : 'default'}>
          <Bell className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{alerts.length} unacknowledged alert{alerts.length > 1 ? 's' : ''}</span>
            <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alerts[0].id)}>
              Acknowledge
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="health" className="text-xs sm:text-sm min-h-[44px]">Health</TabsTrigger>
          <TabsTrigger value="features" className="text-xs sm:text-sm min-h-[44px]">Features</TabsTrigger>
          <TabsTrigger value="credentials" className="text-xs sm:text-sm min-h-[44px]">API Keys</TabsTrigger>
          <TabsTrigger value="usage" className="text-xs sm:text-sm min-h-[44px]">Analytics</TabsTrigger>
        </TabsList>

        {/* Health Monitoring Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                AI Feature Health & Model Management
              </CardTitle>
              <CardDescription>
                Real-time monitoring with automated alerts and model switching
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthData.length > 0 ? (
                <div className="space-y-4">
                  {healthData.map((health) => (
                    <Card key={health.id} className="border-muted">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={health.is_enabled}
                              onCheckedChange={(checked) => toggleFeatureEnabled(health.feature_id, checked)}
                            />
                            <div>
                              <CardTitle className="text-base">{health.feature_name}</CardTitle>
                              <p className="text-sm text-muted-foreground">{health.edge_function}</p>
                            </div>
                          </div>
                          <Badge variant={
                            health.status === 'healthy' ? 'default' :
                            health.status === 'degraded' ? 'secondary' :
                            health.status === 'failed' ? 'destructive' : 'outline'
                          }>
                            {health.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Current Model</Label>
                            <Select
                              value={health.current_model}
                              onValueChange={(model) => updateFeatureModel(health.feature_id, { model })}
                              disabled={!health.is_enabled || updating}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModels.map((model) => (
                                  <SelectItem key={model} value={model}>{model}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              Fallback Model
                              <Switch
                                checked={health.fallback_enabled}
                                onCheckedChange={(enabled) => updateFeatureModel(health.feature_id, { fallback_enabled: enabled })}
                                disabled={!health.is_enabled}
                              />
                            </Label>
                            <Select
                              value={health.fallback_model || ''}
                              onValueChange={(model) => updateFeatureModel(health.feature_id, { fallback_model: model })}
                              disabled={!health.is_enabled || !health.fallback_enabled}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select fallback" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModels.filter(m => m !== health.current_model).map((model) => (
                                  <SelectItem key={model} value={model}>{model}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Requests: {health.total_requests}</span>
                          <span>Success: {health.successful_requests}</span>
                          <span>Failed: {health.failed_requests}</span>
                          {health.consecutive_failures > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {health.consecutive_failures} consecutive failures
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No health data available. Run a scan to initialize monitoring.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    AI Feature Configuration
                  </CardTitle>
                  <CardDescription>
                    Auto-detect AI features and update configurations
                  </CardDescription>
                </div>
                <Button 
                  onClick={scanAIFeatures} 
                  disabled={scanning}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? 'Scanning...' : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {detectedFeatures.length > 0 ? (
                <div className="rounded-lg border overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature Name</TableHead>
                        <TableHead>Edge Function</TableHead>
                        <TableHead>Model Used</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Purpose</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detectedFeatures.map((feature) => (
                        <TableRow key={feature.id}>
                          <TableCell className="font-medium">{feature.name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {feature.edge_function}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {feature.model_used}
                            </Badge>
                          </TableCell>
                          <TableCell>
                          {feature.status === 'healthy' && (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Healthy
                              </Badge>
                            )}
                            {feature.status === 'degraded' && (
                              <Badge variant="secondary" className="gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Degraded
                              </Badge>
                            )}
                            {feature.status === 'failed' && (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="w-3 h-3" />
                                Failed
                              </Badge>
                            )}
                            {feature.status === 'unknown' && (
                              <Badge variant="outline" className="gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Unknown
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-md">
                            {feature.purpose}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No AI features detected yet. Click scan to discover and configure automatically.
                  </p>
                  <Button 
                    onClick={scanAIFeatures} 
                    disabled={scanning}
                    variant="outline"
                    className="mt-4"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
                    Scan AI Features
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Legacy AI Feature Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provider Assignment (Legacy)</CardTitle>
              <CardDescription className="text-sm">
                Configure AI providers for specific features (manual configuration)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {features.map((feature) => (
                  <Card key={feature.id} className="border-muted">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{feature.display_name}</CardTitle>
                          <CardDescription className="text-sm mt-1">
                            {feature.description}
                          </CardDescription>
                        </div>
                        <Switch
                          checked={feature.is_enabled}
                          onCheckedChange={(checked) =>
                            handleUpdateFeature(feature.id, { is_enabled: checked })
                          }
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Primary Provider */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Primary Provider</Label>
                          <Select
                            value={feature.primary_provider_id || ""}
                            onValueChange={(value) =>
                              handleUpdateFeature(feature.id, { primary_provider_id: value })
                            }
                            disabled={!feature.is_enabled}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              {credentials.map((cred) => (
                                <SelectItem key={cred.id} value={cred.provider_id}>
                                  {getProviderIcon(cred.providers?.provider_type || "")} {cred.providers?.display_name}
                                  {cred.test_status === "success" && " ✓"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Fallback Provider */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            Fallback Provider
                            <Switch
                              checked={feature.fallback_enabled}
                              onCheckedChange={(checked) =>
                                handleUpdateFeature(feature.id, { fallback_enabled: checked })
                              }
                              disabled={!feature.is_enabled}
                            />
                          </Label>
                          <Select
                            value={feature.fallback_provider_id || ""}
                            onValueChange={(value) =>
                              handleUpdateFeature(feature.id, { fallback_provider_id: value })
                            }
                            disabled={!feature.is_enabled || !feature.fallback_enabled}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select fallback" />
                            </SelectTrigger>
                            <SelectContent>
                              {credentials
                                .filter((c) => c.provider_id !== feature.primary_provider_id)
                                .map((cred) => (
                                  <SelectItem key={cred.id} value={cred.provider_id}>
                                    {getProviderIcon(cred.providers?.provider_type || "")} {cred.providers?.display_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Advanced Settings */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Retry Attempts</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={feature.retry_attempts}
                            onChange={(e) =>
                              handleUpdateFeature(feature.id, {
                                retry_attempts: parseInt(e.target.value) || 3,
                              })
                            }
                            disabled={!feature.is_enabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Timeout (seconds)</Label>
                          <Input
                            type="number"
                            min="10"
                            max="300"
                            value={feature.timeout_seconds}
                            onChange={(e) =>
                              handleUpdateFeature(feature.id, {
                                timeout_seconds: parseInt(e.target.value) || 60,
                              })
                            }
                            disabled={!feature.is_enabled}
                          />
                        </div>
                      </div>

                      {/* Usage Stats */}
                      {feature.usage_count > 0 && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                          <span>Used: {feature.usage_count} times</span>
                          {feature.last_used_at && (
                            <span>Last used: {new Date(feature.last_used_at).toLocaleString()}</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="credentials" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    API Key Management
                  </CardTitle>
                  <CardDescription>
                    Securely store and manage API keys for AI providers
                  </CardDescription>
                </div>
                <Dialog open={addKeyDialogOpen} onOpenChange={setAddKeyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" />
                      Add API Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add API Key</DialogTitle>
                      <DialogDescription>
                        Add credentials for an AI provider to enable its use across the platform
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>AI Provider</Label>
                        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id}>
                                {getProviderIcon(provider.provider_type)} {provider.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>API Key *</Label>
                        <Input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter API key (required)"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          API key is mandatory to add credentials
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Preferred Model (Optional)</Label>
                        <Input
                          value={modelPreference}
                          onChange={(e) => setModelPreference(e.target.value)}
                          placeholder="e.g., gpt-5, claude-sonnet-4-5"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddKeyDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleAddCredential} 
                        disabled={saving || !apiKey.trim() || !selectedProvider}
                      >
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Add Key
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Tested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No API keys configured. Add your first API key to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    credentials.map((cred) => (
                      <TableRow key={cred.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getProviderIcon(cred.providers?.provider_type || "")}</span>
                            <span className="font-medium">{cred.providers?.display_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {cred.model_preference || "Default"}
                          </code>
                        </TableCell>
                        <TableCell>{getStatusBadge(cred.test_status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {cred.last_tested_at
                            ? new Date(cred.last_tested_at).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTestConnection(cred.id, cred.provider_id)}
                              disabled={testing === cred.id}
                            >
                              {testing === cred.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <TestTube className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCredential(cred.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>

              {credentials.length > 0 && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Available Providers</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {providers.map((provider) => {
                      const hasKey = credentials.some((c) => c.provider_id === provider.id);
                      const modelCount = Array.isArray(provider.supported_models) 
                        ? provider.supported_models.length 
                        : 0;
                      return (
                        <div
                          key={provider.id}
                          className="flex items-center gap-2 text-sm p-2 rounded border bg-background"
                        >
                          <span className="text-xl">{getProviderIcon(provider.provider_type)}</span>
                          <div className="flex-1">
                            <div className="font-medium">{provider.display_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {modelCount} models
                            </div>
                          </div>
                          {hasKey ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Analytics Tab */}
        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                AI Usage Analytics
              </CardTitle>
              <CardDescription>
                Monitor AI API usage, costs, and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {features
                  .filter((f) => f.usage_count > 0)
                  .map((feature) => (
                    <Card key={feature.id}>
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs">{feature.display_name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{feature.usage_count}</div>
                        <div className="text-xs text-muted-foreground">total calls</div>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              <Alert>
                <Activity className="h-4 w-4" />
                <AlertDescription>
                  Detailed usage logs with token counts, costs, and latency metrics will appear here as you use AI features.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
