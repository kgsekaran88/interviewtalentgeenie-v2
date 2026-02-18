import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Cloud,
  Database,
  Server,
  Shield,
  Mail,
  CreditCard,
  Brain,
  Monitor,
  FileCode,
  Download,
  PlayCircle,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Globe,
  HardDrive,
  Settings,
  Lock,
  TrendingUp
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DeploymentConfig {
  project: {
    name: string;
    environment: string;
    new_github_org: string;
    repo_name: string;
    branch: string;
  };
  domain: {
    domain_name: string;
    dns_provider: string;
    create_cert: boolean;
  };
  cloud: {
    provider: string;
    region: string;
    vpc_cidr: string;
  };
  compute: {
    app_instance_type: string;
    min_replicas: number;
    max_replicas: number;
  };
  database: {
    type: string;
    engine_version: string;
    instance_class: string;
    storage_gb: number;
  };
  storage: {
    recordings_bucket: string;
    retention_days: number;
    copy_recordings: boolean;
    recordings_sample_rate: number;
  };
  auth: {
    jwt_secret_placeholder: string;
    sso_enabled: boolean;
    sso_provider: string;
  };
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    from_email: string;
  };
  payments: {
    enabled: boolean;
    provider: string;
  };
  ai: {
    provider: string;
    question_generation_model: string;
    scoring_model: string;
  };
  chatbot: {
    enabled: boolean;
    provider: string;
    vector_db: string;
  };
  migration: {
    include_partners: string[];
    mask_pii: boolean;
    include_recordings: boolean;
    max_interviews_to_import: number;
  };
  monitoring: {
    enable_prometheus: boolean;
    alert_emails: string[];
  };
}

export default function DeploymentConfigurator() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('project');
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  const [config, setConfig] = useState<DeploymentConfig>({
    project: {
      name: 'ias-platform',
      environment: 'staging',
      new_github_org: '',
      repo_name: 'ias-platform-copy',
      branch: 'main'
    },
    domain: {
      domain_name: '',
      dns_provider: 'route53',
      create_cert: true
    },
    cloud: {
      provider: 'aws',
      region: 'ap-south-1',
      vpc_cidr: '10.0.0.0/16'
    },
    compute: {
      app_instance_type: 't3.medium',
      min_replicas: 2,
      max_replicas: 4
    },
    database: {
      type: 'postgres',
      engine_version: '14',
      instance_class: 'db.t3.medium',
      storage_gb: 100
    },
    storage: {
      recordings_bucket: '',
      retention_days: 90,
      copy_recordings: false,
      recordings_sample_rate: 0.1
    },
    auth: {
      jwt_secret_placeholder: '***REPLACE_IN_SECRETS_MANAGER***',
      sso_enabled: false,
      sso_provider: 'saml'
    },
    smtp: {
      enabled: false,
      host: '',
      port: 587,
      from_email: ''
    },
    payments: {
      enabled: false,
      provider: 'stripe'
    },
    ai: {
      provider: 'openai',
      question_generation_model: 'gpt-5-mini-2025-08-07',
      scoring_model: 'custom-scoring-model-v1'
    },
    chatbot: {
      enabled: true,
      provider: 'langchain',
      vector_db: 'pinecone'
    },
    migration: {
      include_partners: [],
      mask_pii: true,
      include_recordings: false,
      max_interviews_to_import: 100
    },
    monitoring: {
      enable_prometheus: true,
      alert_emails: []
    }
  });

  const updateConfig = (section: keyof DeploymentConfig, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      // Validate required fields
      const errors: string[] = [];
      
      if (!config.project.new_github_org) errors.push('GitHub organization is required');
      if (!config.domain.domain_name) errors.push('Domain name is required');
      if (!config.storage.recordings_bucket) errors.push('Recordings bucket name is required');
      
      if (errors.length > 0) {
        toast.error('Validation Failed', {
          description: errors.join(', ')
        });
        setIsValidating(false);
        return;
      }

      // Simulate validation API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Configuration validated successfully', {
        description: 'All fields are valid and ready for dry run'
      });
    } catch (error) {
      toast.error('Validation failed', {
        description: 'Please check your configuration'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDryRun = async () => {
    setIsDryRunning(true);
    try {
      // Simulate terraform plan
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = {
        resources_to_create: 47,
        resources_to_modify: 0,
        resources_to_destroy: 0,
        estimated_cost: {
          monthly: 287.50,
          breakdown: {
            compute: 120,
            database: 85,
            storage: 45,
            networking: 37.50
          }
        },
        warnings: [
          'RDS instance will be publicly accessible (consider using VPN)',
          'S3 bucket versioning is disabled'
        ]
      };
      
      setDryRunResult(result);
      toast.success('Dry run completed', {
        description: `${result.resources_to_create} resources will be created`
      });
    } catch (error) {
      toast.error('Dry run failed', {
        description: 'Check terraform configuration'
      });
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleDeploy = async () => {
    if (!dryRunResult) {
      toast.error('Please run dry run first');
      return;
    }

    setIsDeploying(true);
    try {
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      toast.success('Deployment initiated', {
        description: 'Infrastructure is being provisioned. Check CI/CD logs for progress.'
      });
    } catch (error) {
      toast.error('Deployment failed', {
        description: 'Check logs for details'
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDownloadConfig = () => {
    const yamlContent = `# Deployment Configuration for ${config.project.name}
project:
  name: "${config.project.name}"
  environment: "${config.project.environment}"
  new_github_org: "${config.project.new_github_org}"
  repo_name: "${config.project.repo_name}"
  branch: "${config.project.branch}"

domain:
  domain_name: "${config.domain.domain_name}"
  dns_provider: "${config.domain.dns_provider}"
  create_cert: ${config.domain.create_cert}

cloud:
  provider: "${config.cloud.provider}"
  region: "${config.cloud.region}"
  vpc_cidr: "${config.cloud.vpc_cidr}"

compute:
  app_instance_type: "${config.compute.app_instance_type}"
  min_replicas: ${config.compute.min_replicas}
  max_replicas: ${config.compute.max_replicas}

database:
  type: "${config.database.type}"
  engine_version: "${config.database.engine_version}"
  instance_class: "${config.database.instance_class}"
  storage_gb: ${config.database.storage_gb}

storage:
  recordings_bucket: "${config.storage.recordings_bucket}"
  retention_days: ${config.storage.retention_days}
  copy_recordings: ${config.storage.copy_recordings}
  recordings_sample_rate: ${config.storage.recordings_sample_rate}

auth:
  jwt_secret_placeholder: "${config.auth.jwt_secret_placeholder}"
  sso_enabled: ${config.auth.sso_enabled}
  sso_provider: "${config.auth.sso_provider}"

smtp:
  enabled: ${config.smtp.enabled}
  host: "${config.smtp.host}"
  port: ${config.smtp.port}
  from_email: "${config.smtp.from_email}"
  password_placeholder: "***REPLACE_IN_SECRETS_MANAGER***"

payments:
  enabled: ${config.payments.enabled}
  provider: "${config.payments.provider}"
  provider_config_placeholder: {}

ai:
  provider: "${config.ai.provider}"
  api_key_placeholder: "***REPLACE_IN_SECRETS_MANAGER***"
  question_generation_model: "${config.ai.question_generation_model}"
  scoring_model: "${config.ai.scoring_model}"

chatbot:
  enabled: ${config.chatbot.enabled}
  provider: "${config.chatbot.provider}"
  vector_db: "${config.chatbot.vector_db}"
  api_key_placeholder: "***REPLACE_IN_SECRETS_MANAGER***"

migration:
  include_partners: ${JSON.stringify(config.migration.include_partners)}
  mask_pii: ${config.migration.mask_pii}
  include_recordings: ${config.migration.include_recordings}
  max_interviews_to_import: ${config.migration.max_interviews_to_import}

monitoring:
  enable_prometheus: ${config.monitoring.enable_prometheus}
  alert_emails: ${JSON.stringify(config.monitoring.alert_emails)}
`;

    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deployment-variables.yml';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Configuration downloaded');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-bold gradient-text">Deployment Configurator</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              Deploy a self-hosted copy to your cloud
            </p>
          </div>
        </div>

        {/* Status Alert */}
        <Alert className="mb-4 sm:mb-6 border-primary/50 bg-primary/5">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <AlertDescription className="text-xs sm:text-sm">
            <strong>Security Notice:</strong> All secrets must be stored in your cloud provider's Secrets Manager.
          </AlertDescription>
        </Alert>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Configuration Form */}
          <div className="lg:col-span-2">
            <Card className="glass">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Configuration</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Configure your deployment parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-4 sm:grid-cols-8 mb-4 sm:mb-6 h-auto">
                    <TabsTrigger value="project" className="text-xs min-h-[40px] px-1 sm:px-3">Project</TabsTrigger>
                    <TabsTrigger value="cloud" className="text-xs min-h-[40px] px-1 sm:px-3">Cloud</TabsTrigger>
                    <TabsTrigger value="database" className="text-xs min-h-[40px] px-1 sm:px-3">DB</TabsTrigger>
                    <TabsTrigger value="storage" className="text-xs min-h-[40px] px-1 sm:px-3">Storage</TabsTrigger>
                    <TabsTrigger value="auth" className="text-xs min-h-[40px] px-1 sm:px-3">Auth</TabsTrigger>
                    <TabsTrigger value="services" className="text-xs min-h-[40px] px-1 sm:px-3">Services</TabsTrigger>
                    <TabsTrigger value="migration" className="text-xs min-h-[40px] px-1 sm:px-3">Migrate</TabsTrigger>
                    <TabsTrigger value="monitoring" className="text-xs min-h-[40px] px-1 sm:px-3">Monitor</TabsTrigger>
                  </TabsList>

                  {/* Project Tab */}
                  <TabsContent value="project" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input
                        id="project-name"
                        value={config.project.name}
                        onChange={(e) => updateConfig('project', 'name', e.target.value)}
                        placeholder="ias-platform"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="environment">Environment</Label>
                      <Select
                        value={config.project.environment}
                        onValueChange={(value) => updateConfig('project', 'environment', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="production">Production</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="github-org">GitHub Organization</Label>
                      <Input
                        id="github-org"
                        value={config.project.new_github_org}
                        onChange={(e) => updateConfig('project', 'new_github_org', e.target.value)}
                        placeholder="my-organization"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="repo-name">Repository Name</Label>
                      <Input
                        id="repo-name"
                        value={config.project.repo_name}
                        onChange={(e) => updateConfig('project', 'repo_name', e.target.value)}
                        placeholder="ias-platform-copy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch">Branch</Label>
                      <Input
                        id="branch"
                        value={config.project.branch}
                        onChange={(e) => updateConfig('project', 'branch', e.target.value)}
                        placeholder="main"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="domain-name">Domain Name</Label>
                      <Input
                        id="domain-name"
                        value={config.domain.domain_name}
                        onChange={(e) => updateConfig('domain', 'domain_name', e.target.value)}
                        placeholder="staging.ias.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dns-provider">DNS Provider</Label>
                      <Select
                        value={config.domain.dns_provider}
                        onValueChange={(value) => updateConfig('domain', 'dns_provider', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="route53">AWS Route 53</SelectItem>
                          <SelectItem value="cloudflare">Cloudflare</SelectItem>
                          <SelectItem value="godaddy">GoDaddy</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="create-cert"
                        checked={config.domain.create_cert}
                        onCheckedChange={(checked) => updateConfig('domain', 'create_cert', checked)}
                      />
                      <Label htmlFor="create-cert">Auto-create SSL Certificate</Label>
                    </div>
                  </TabsContent>

                  {/* Cloud Tab */}
                  <TabsContent value="cloud" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cloud-provider">Cloud Provider</Label>
                      <Select
                        value={config.cloud.provider}
                        onValueChange={(value) => updateConfig('cloud', 'provider', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aws">Amazon Web Services (AWS)</SelectItem>
                          <SelectItem value="azure">Microsoft Azure</SelectItem>
                          <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="region">Region</Label>
                      <Input
                        id="region"
                        value={config.cloud.region}
                        onChange={(e) => updateConfig('cloud', 'region', e.target.value)}
                        placeholder="ap-south-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vpc-cidr">VPC CIDR</Label>
                      <Input
                        id="vpc-cidr"
                        value={config.cloud.vpc_cidr}
                        onChange={(e) => updateConfig('cloud', 'vpc_cidr', e.target.value)}
                        placeholder="10.0.0.0/16"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instance-type">App Instance Type</Label>
                      <Input
                        id="instance-type"
                        value={config.compute.app_instance_type}
                        onChange={(e) => updateConfig('compute', 'app_instance_type', e.target.value)}
                        placeholder="t3.medium"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min-replicas">Min Replicas</Label>
                        <Input
                          id="min-replicas"
                          type="number"
                          value={config.compute.min_replicas}
                          onChange={(e) => updateConfig('compute', 'min_replicas', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-replicas">Max Replicas</Label>
                        <Input
                          id="max-replicas"
                          type="number"
                          value={config.compute.max_replicas}
                          onChange={(e) => updateConfig('compute', 'max_replicas', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Database Tab */}
                  <TabsContent value="database" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="db-type">Database Type</Label>
                      <Select
                        value={config.database.type}
                        onValueChange={(value) => updateConfig('database', 'type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="postgres">PostgreSQL</SelectItem>
                          <SelectItem value="mysql">MySQL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="engine-version">Engine Version</Label>
                      <Input
                        id="engine-version"
                        value={config.database.engine_version}
                        onChange={(e) => updateConfig('database', 'engine_version', e.target.value)}
                        placeholder="14"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instance-class">Instance Class</Label>
                      <Input
                        id="instance-class"
                        value={config.database.instance_class}
                        onChange={(e) => updateConfig('database', 'instance_class', e.target.value)}
                        placeholder="db.t3.medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storage-gb">Storage (GB)</Label>
                      <Input
                        id="storage-gb"
                        type="number"
                        value={config.database.storage_gb}
                        onChange={(e) => updateConfig('database', 'storage_gb', parseInt(e.target.value))}
                      />
                    </div>
                  </TabsContent>

                  {/* Storage Tab */}
                  <TabsContent value="storage" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recordings-bucket">Recordings Bucket Name</Label>
                      <Input
                        id="recordings-bucket"
                        value={config.storage.recordings_bucket}
                        onChange={(e) => updateConfig('storage', 'recordings_bucket', e.target.value)}
                        placeholder="ias-recordings"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retention-days">Retention Days</Label>
                      <Input
                        id="retention-days"
                        type="number"
                        value={config.storage.retention_days}
                        onChange={(e) => updateConfig('storage', 'retention_days', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="copy-recordings"
                        checked={config.storage.copy_recordings}
                        onCheckedChange={(checked) => updateConfig('storage', 'copy_recordings', checked)}
                      />
                      <Label htmlFor="copy-recordings">Copy Recordings During Migration</Label>
                    </div>
                    {config.storage.copy_recordings && (
                      <div className="space-y-2">
                        <Label htmlFor="sample-rate">Sample Rate (0-1)</Label>
                        <Input
                          id="sample-rate"
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={config.storage.recordings_sample_rate}
                          onChange={(e) => updateConfig('storage', 'recordings_sample_rate', parseFloat(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Copy {(config.storage.recordings_sample_rate * 100).toFixed(0)}% of recordings to reduce costs
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Auth Tab */}
                  <TabsContent value="auth" className="space-y-4">
                    <Alert className="border-warning/50 bg-warning/5">
                      <Lock className="w-4 h-4 text-warning" />
                      <AlertDescription>
                        Secrets must be configured in your cloud Secrets Manager before deployment
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label>JWT Secret</Label>
                      <Input
                        disabled
                        value={config.auth.jwt_secret_placeholder}
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        Configure in Secrets Manager as: JWT_SECRET
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="sso-enabled"
                        checked={config.auth.sso_enabled}
                        onCheckedChange={(checked) => updateConfig('auth', 'sso_enabled', checked)}
                      />
                      <Label htmlFor="sso-enabled">Enable SSO</Label>
                    </div>
                    {config.auth.sso_enabled && (
                      <div className="space-y-2">
                        <Label htmlFor="sso-provider">SSO Provider</Label>
                        <Select
                          value={config.auth.sso_provider}
                          onValueChange={(value) => updateConfig('auth', 'sso_provider', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="saml">SAML 2.0</SelectItem>
                            <SelectItem value="oidc">OpenID Connect</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </TabsContent>

                  {/* Services Tab */}
                  <TabsContent value="services" className="space-y-6">
                    {/* SMTP */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold">SMTP Configuration</h3>
                        </div>
                        <Switch
                          checked={config.smtp.enabled}
                          onCheckedChange={(checked) => updateConfig('smtp', 'enabled', checked)}
                        />
                      </div>
                      {config.smtp.enabled && (
                        <>
                          <Input
                            placeholder="smtp.example.com"
                            value={config.smtp.host}
                            onChange={(e) => updateConfig('smtp', 'host', e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="587"
                            value={config.smtp.port}
                            onChange={(e) => updateConfig('smtp', 'port', parseInt(e.target.value))}
                          />
                          <Input
                            placeholder="no-reply@example.com"
                            value={config.smtp.from_email}
                            onChange={(e) => updateConfig('smtp', 'from_email', e.target.value)}
                          />
                        </>
                      )}
                    </div>

                    {/* Payments */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold">Payments</h3>
                        </div>
                        <Switch
                          checked={config.payments.enabled}
                          onCheckedChange={(checked) => updateConfig('payments', 'enabled', checked)}
                        />
                      </div>
                      {config.payments.enabled && (
                        <Select
                          value={config.payments.provider}
                          onValueChange={(value) => updateConfig('payments', 'provider', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stripe">Stripe</SelectItem>
                            <SelectItem value="razorpay">Razorpay</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* AI */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">AI Configuration</h3>
                      </div>
                      <Select
                        value={config.ai.provider}
                        onValueChange={(value) => updateConfig('ai', 'provider', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="azure-openai">Azure OpenAI</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="gpt-5-mini-2025-08-07"
                        value={config.ai.question_generation_model}
                        onChange={(e) => updateConfig('ai', 'question_generation_model', e.target.value)}
                      />
                      <Input
                        placeholder="custom-scoring-model-v1"
                        value={config.ai.scoring_model}
                        onChange={(e) => updateConfig('ai', 'scoring_model', e.target.value)}
                      />
                    </div>

                    {/* Chatbot */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold">Chatbot</h3>
                        </div>
                        <Switch
                          checked={config.chatbot.enabled}
                          onCheckedChange={(checked) => updateConfig('chatbot', 'enabled', checked)}
                        />
                      </div>
                      {config.chatbot.enabled && (
                        <>
                          <Select
                            value={config.chatbot.provider}
                            onValueChange={(value) => updateConfig('chatbot', 'provider', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="langchain">LangChain</SelectItem>
                              <SelectItem value="llamaindex">LlamaIndex</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={config.chatbot.vector_db}
                            onValueChange={(value) => updateConfig('chatbot', 'vector_db', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pinecone">Pinecone</SelectItem>
                              <SelectItem value="qdrant">Qdrant</SelectItem>
                              <SelectItem value="weaviate">Weaviate</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  {/* Migration Tab */}
                  <TabsContent value="migration" className="space-y-4">
                    <Alert className="border-warning/50 bg-warning/5">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <AlertDescription>
                        Migration is non-destructive. Original data remains intact.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label htmlFor="max-interviews">Max Interviews to Import</Label>
                      <Input
                        id="max-interviews"
                        type="number"
                        value={config.migration.max_interviews_to_import}
                        onChange={(e) => updateConfig('migration', 'max_interviews_to_import', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="mask-pii"
                        checked={config.migration.mask_pii}
                        onCheckedChange={(checked) => updateConfig('migration', 'mask_pii', checked)}
                      />
                      <Label htmlFor="mask-pii">Mask PII (Recommended)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="include-recordings"
                        checked={config.migration.include_recordings}
                        onCheckedChange={(checked) => updateConfig('migration', 'include_recordings', checked)}
                      />
                      <Label htmlFor="include-recordings">Include Recording Metadata</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partners">Partner IDs (comma-separated or "all")</Label>
                      <Textarea
                        id="partners"
                        placeholder="partner1,partner2 or leave empty for all"
                        className="min-h-[100px]"
                      />
                    </div>
                  </TabsContent>

                  {/* Monitoring Tab */}
                  <TabsContent value="monitoring" className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="prometheus"
                        checked={config.monitoring.enable_prometheus}
                        onCheckedChange={(checked) => updateConfig('monitoring', 'enable_prometheus', checked)}
                      />
                      <Label htmlFor="prometheus">Enable Prometheus Metrics</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="alert-emails">Alert Emails (comma-separated)</Label>
                      <Textarea
                        id="alert-emails"
                        placeholder="ops@example.com, admin@example.com"
                        className="min-h-[100px]"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Actions Panel */}
          <div className="space-y-6">
            {/* Action Buttons */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="w-full"
                  variant="outline"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isValidating ? 'Validating...' : 'Validate Config'}
                </Button>
                
                <Button
                  onClick={handleDryRun}
                  disabled={isDryRunning}
                  className="w-full"
                  variant="outline"
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  {isDryRunning ? 'Running...' : 'Dry Run (Plan)'}
                </Button>
                
                <Button
                  onClick={handleDeploy}
                  disabled={isDeploying || !dryRunResult}
                  className="w-full bg-gradient-to-r from-primary to-accent"
                >
                  <Cloud className="w-4 h-4 mr-2" />
                  {isDeploying ? 'Deploying...' : 'Deploy'}
                </Button>
                
                <Button
                  onClick={handleDownloadConfig}
                  variant="secondary"
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Config
                </Button>
              </CardContent>
            </Card>

            {/* Dry Run Results */}
            {dryRunResult && (
              <Card className="glass border-primary/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Dry Run Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Resources</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Create:</span>
                        <Badge variant="default">{dryRunResult.resources_to_create}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Modify:</span>
                        <Badge variant="secondary">{dryRunResult.resources_to_modify}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Destroy:</span>
                        <Badge variant="destructive">{dryRunResult.resources_to_destroy}</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Estimated Monthly Cost</p>
                    <p className="text-2xl font-bold gradient-text">
                      ${dryRunResult.estimated_cost.monthly}
                    </p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Compute:</span>
                        <span>${dryRunResult.estimated_cost.breakdown.compute}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Database:</span>
                        <span>${dryRunResult.estimated_cost.breakdown.database}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Storage:</span>
                        <span>${dryRunResult.estimated_cost.breakdown.storage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Networking:</span>
                        <span>${dryRunResult.estimated_cost.breakdown.networking}</span>
                      </div>
                    </div>
                  </div>

                  {dryRunResult.warnings.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Warnings</p>
                      {dryRunResult.warnings.map((warning: string, idx: number) => (
                        <Alert key={idx} className="mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          <AlertDescription className="text-xs">{warning}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Info */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Deployment Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Domain</p>
                    <p className="text-muted-foreground text-xs">
                      {config.domain.domain_name || 'Not configured'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Cloud className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Cloud Provider</p>
                    <p className="text-muted-foreground text-xs capitalize">
                      {config.cloud.provider} - {config.cloud.region}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Database className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Database</p>
                    <p className="text-muted-foreground text-xs">
                      {config.database.type} {config.database.engine_version}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <HardDrive className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Storage</p>
                    <p className="text-muted-foreground text-xs">
                      {config.storage.recordings_bucket || 'Not configured'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
