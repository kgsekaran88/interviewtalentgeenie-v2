import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Save, Loader2, CheckCircle2, AlertTriangle, Send, Eye, EyeOff, ExternalLink, FileText, Settings, BarChart3, RefreshCw, X, Check } from 'lucide-react';
import EmailTemplateEditor from '@/components/EmailTemplateEditor';
import { format } from 'date-fns';

interface EmailConfig {
  email_provider_api_key: string;
  email_from_address: string;
  email_from_name: string;
  email_enabled: boolean;
}

interface EmailStats {
  template: string;
  total: number;
  sent: number;
  failed: number;
}

interface ProviderStats {
  provider: string;
  total: number;
  sent: number;
  failed: number;
}

interface EmailLog {
  id: string;
  template: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string | null;
  sent: boolean;
  sent_at: string | null;
  error_message: string | null;
  resend_count: number;
  created_at: string;
}

export default function EmailConfiguration() {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [emailStats, setEmailStats] = useState<EmailStats[]>([]);
  const [providerStats, setProviderStats] = useState<ProviderStats[]>([]);
  const [failedEmails, setFailedEmails] = useState<EmailLog[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  
  const [config, setConfig] = useState<EmailConfig>({
    email_provider_api_key: '',
    email_from_address: '',
    email_from_name: 'TalentGeenie',
    email_enabled: false,
  });

  useEffect(() => {
    fetchConfig();
    fetchEmailStats();
  }, []);

  const fetchEmailStats = async () => {
    try {
      setLoadingStats(true);
      
      // Fetch email stats grouped by template and provider
      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('template, sent, provider');
      
      if (error) throw error;
      
      // Calculate stats by template
      const statsMap: Record<string, EmailStats> = {};
      // Calculate stats by provider
      const providerMap: Record<string, ProviderStats> = {};
      
      logs?.forEach((log: { template: string; sent: boolean; provider?: string }) => {
        // Template stats
        if (!statsMap[log.template]) {
          statsMap[log.template] = { template: log.template, total: 0, sent: 0, failed: 0 };
        }
        statsMap[log.template].total++;
        if (log.sent) {
          statsMap[log.template].sent++;
        } else {
          statsMap[log.template].failed++;
        }
        
        // Provider stats
        const provider = log.provider || 'resend';
        if (!providerMap[provider]) {
          providerMap[provider] = { provider, total: 0, sent: 0, failed: 0 };
        }
        providerMap[provider].total++;
        if (log.sent) {
          providerMap[provider].sent++;
        } else {
          providerMap[provider].failed++;
        }
      });
      
      setEmailStats(Object.values(statsMap).sort((a, b) => b.total - a.total));
      setProviderStats(Object.values(providerMap).sort((a, b) => b.total - a.total));
      
      // Fetch failed emails for resend
      const { data: failed, error: failedError } = await supabase
        .from('email_logs')
        .select('*')
        .eq('sent', false)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!failedError && failed) {
        setFailedEmails(failed as EmailLog[]);
      }
    } catch (error) {
      logger.error('Error fetching email stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleResendEmail = async (emailLogId: string) => {
    try {
      setResendingId(emailLogId);
      
      const { data, error } = await invokeFunction('resend-email', {
        body: { emailLogId }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        successToast('Email resent successfully');
        // Refresh the failed emails list
        fetchEmailStats();
      } else {
        throw new Error(data?.error || 'Failed to resend email');
      }
    } catch (error: any) {
      logger.error('Error resending email:', error);
      errorToast(error.message || 'Failed to resend email');
    } finally {
      setResendingId(null);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('platform_configurations')
        .select('key, value')
        .in('key', ['email_provider_api_key', 'email_from_address', 'email_from_name', 'email_enabled']);

      if (error) throw error;

      const configMap: Record<string, string> = {};
      data?.forEach(item => {
        configMap[item.key] = item.value;
      });

      setConfig({
        email_provider_api_key: configMap.email_provider_api_key || '',
        email_from_address: configMap.email_from_address || '',
        email_from_name: configMap.email_from_name || 'TalentGeenie',
        email_enabled: configMap.email_enabled === 'true',
      });
    } catch (error) {
      logger.error('Error fetching email config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updates = [
        { key: 'email_provider_api_key', value: config.email_provider_api_key },
        { key: 'email_from_address', value: config.email_from_address },
        { key: 'email_from_name', value: config.email_from_name },
        { key: 'email_enabled', value: config.email_enabled.toString() },
      ];

      for (const update of updates) {
        // Check if key exists
        const { data: existing } = await supabase
          .from('platform_configurations')
          .select('id')
          .eq('key', update.key)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('platform_configurations')
            .update({ value: update.value, updated_at: new Date().toISOString() })
            .eq('key', update.key);
          if (error) throw error;
        } else {
          // Insert new with required category field
          const { error } = await supabase
            .from('platform_configurations')
            .insert({ key: update.key, value: update.value, category: 'email' } as any);
          if (error) throw error;
        }
      }

      toast({
        title: 'Configuration Saved',
        description: 'Email settings have been updated successfully.',
      });
    } catch (error) {
      logger.error('Error saving email config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save email configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address to send a test email.',
        variant: 'destructive',
      });
      return;
    }

    // Validate configuration before testing
    if (!config.email_provider_api_key) {
      toast({
        title: 'API Key Missing',
        description: 'Please enter and save your Resend API key before testing.',
        variant: 'destructive',
      });
      return;
    }

    if (!config.email_from_address) {
      toast({
        title: 'From Address Missing',
        description: 'Please enter and save your From Email Address before testing.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setTesting(true);

      const { data, error } = await invokeFunction('send-email', {
        body: {
          template: 'test_email',
          to: testEmail,
          data: {
            sent_at: new Date().toLocaleString(),
            platform_name: 'TalentGeenie',
          },
        },
      });

      // Check for function invoke errors
      if (error) throw error;
      
      // Check for API response errors
      if (data && !data.success) {
        const errorMsg = data.error || 'Unknown error';
        // Provide user-friendly error messages based on common Resend errors
        let friendlyError = errorMsg;
        if (errorMsg.includes('API key')) {
          friendlyError = 'Invalid API key. Please check your Resend API key is correct.';
        } else if (errorMsg.includes('domain') || errorMsg.includes('not verified')) {
          friendlyError = `Domain not verified. The "From" address "${config.email_from_address}" must be from a verified domain in Resend.`;
        } else if (errorMsg.includes('rate limit')) {
          friendlyError = 'Rate limit exceeded. Please wait a moment before trying again.';
        }
        throw new Error(friendlyError);
      }

      toast({
        title: 'Test Email Sent Successfully',
        description: `Email sent to ${testEmail}. Your configuration is working correctly!`,
      });
    } catch (error: any) {
      logger.error('Error sending test email:', error);
      toast({
        title: 'Configuration Test Failed',
        description: error.message || 'Failed to send test email. Check your API key and domain verification.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const isConfigValid = config.email_provider_api_key && config.email_from_address;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 sm:gap-3">
            <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
            Email Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure email provider settings and templates
          </p>
        </div>
        <Badge 
          variant={config.email_enabled && isConfigValid ? "default" : "secondary"}
          className="text-sm self-start sm:self-auto"
        >
          {config.email_enabled && isConfigValid ? (
            <><CheckCircle2 className="w-3 h-3 mr-1" /> Active</>
          ) : (
            <><AlertTriangle className="w-3 h-3 mr-1" /> Inactive</>
          )}
        </Badge>
      </div>

      <Tabs defaultValue="settings" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm min-h-[44px] py-2 px-1 sm:px-3">
            <Settings className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline">Provider</span>
            <span className="xs:hidden">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm min-h-[44px] py-2 px-1 sm:px-3">
            <FileText className="w-4 h-4 shrink-0" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm min-h-[44px] py-2 px-1 sm:px-3">
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline">Analytics</span>
            <span className="xs:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          {/* Resend Setup Guide */}
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                This platform uses <strong>Resend</strong> for email delivery. You need a Resend account and verified domain.
              </span>
              <Button variant="outline" size="sm" asChild>
                <a href="https://resend.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Go to Resend
                </a>
              </Button>
            </AlertDescription>
          </Alert>

          {/* Main Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Email Provider Settings</CardTitle>
          <CardDescription>
            Configure your Resend API key and sender details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="email-enabled" className="text-base font-medium">Enable Email Sending</Label>
              <p className="text-sm text-muted-foreground">
                Toggle to enable or disable all platform email notifications
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={config.email_enabled}
              onCheckedChange={(checked) => setConfig({ ...config, email_enabled: checked })}
            />
          </div>

          <Separator />

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">Resend API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={config.email_provider_api_key}
                onChange={(e) => setConfig({ ...config, email_provider_api_key: e.target.value })}
                placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from{' '}
              <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Resend Dashboard → API Keys
              </a>
            </p>
          </div>

          {/* From Address */}
          <div className="space-y-2">
            <Label htmlFor="from-address">From Email Address</Label>
            <Input
              id="from-address"
              type="email"
              value={config.email_from_address}
              onChange={(e) => setConfig({ ...config, email_from_address: e.target.value })}
              placeholder="noreply@talentgeenie.com"
            />
            <p className="text-xs text-muted-foreground">
              Must be from a{' '}
              <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                verified domain in Resend
              </a>
              . For testing, use <code className="bg-muted px-1 rounded">onboarding@resend.dev</code>
            </p>
          </div>

          {/* From Name */}
          <div className="space-y-2">
            <Label htmlFor="from-name">From Name</Label>
            <Input
              id="from-name"
              value={config.email_from_name}
              onChange={(e) => setConfig({ ...config, email_from_name: e.target.value })}
              placeholder="TalentGeenie"
            />
            <p className="text-xs text-muted-foreground">
              The display name shown to email recipients
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Configuration</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Email */}
      <Card>
        <CardHeader>
          <CardTitle>Test Email Delivery</CardTitle>
          <CardDescription>
            Send a test email to verify your configuration is working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigValid && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please configure and save your API key and from address before testing.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address to test"
                disabled={!isConfigValid}
              />
            </div>
            <Button 
              onClick={handleTestEmail} 
              disabled={testing || !isConfigValid}
              variant="outline"
            >
              {testing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Send Test</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Domain Verification Reminder */}
      <Card className="border-warning/50 bg-warning/5">
        <CardHeader>
          <CardTitle className="text-warning flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Important: Domain Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            For emails to be delivered successfully, you must verify your domain in Resend:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Go to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Resend Domains</a></li>
            <li>Add your domain (e.g., <code className="bg-muted px-1 rounded">yourdomain.com</code>)</li>
            <li>Add the required DNS records (SPF, DKIM, DMARC)</li>
            <li>Wait for verification (usually takes a few minutes)</li>
            <li>Update the "From Email Address" above to use your verified domain</li>
          </ol>
          <p className="text-xs">
            <strong>Note:</strong> Using unverified domains will cause all emails to fail silently.
          </p>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Customize Email Templates</CardTitle>
              <CardDescription>
                Edit the content of emails sent by the platform. Use variables like {'{{organization_name}}'} for dynamic content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailTemplateEditor />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Email Stats by Provider */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Email Statistics by Provider</CardTitle>
                <CardDescription>Track sent and failed emails per provider</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchEmailStats} disabled={loadingStats}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingStats ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {providerStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No email data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerStats.map((stat) => (
                      <TableRow key={stat.provider}>
                        <TableCell className="font-medium capitalize">
                          <Badge variant="outline" className="font-medium">
                            {stat.provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{stat.total}</TableCell>
                        <TableCell className="text-right text-green-600">{stat.sent}</TableCell>
                        <TableCell className="text-right text-red-600">{stat.failed}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={stat.sent / stat.total > 0.9 ? 'default' : 'destructive'}>
                            {Math.round((stat.sent / stat.total) * 100)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Email Stats by Template */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Email Statistics by Template</CardTitle>
                <CardDescription>Track sent and failed emails per template type</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {emailStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No email data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailStats.map((stat) => (
                      <TableRow key={stat.template}>
                        <TableCell className="font-medium">{stat.template.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right">{stat.total}</TableCell>
                        <TableCell className="text-right text-green-600">{stat.sent}</TableCell>
                        <TableCell className="text-right text-red-600">{stat.failed}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={stat.sent / stat.total > 0.9 ? 'default' : 'destructive'}>
                            {Math.round((stat.sent / stat.total) * 100)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Failed Emails with Resend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <X className="w-5 h-5 text-destructive" />
                Failed Emails - Resend Option
              </CardTitle>
              <CardDescription>Retry sending failed emails</CardDescription>
            </CardHeader>
            <CardContent>
              {failedEmails.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Check className="w-5 h-5 mr-2 text-green-500" />
                  No failed emails
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedEmails.map((email) => (
                      <TableRow key={email.id}>
                        <TableCell className="font-medium">{email.template.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{email.recipient_email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {email.error_message || 'Unknown error'}
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(email.created_at), 'MMM d, HH:mm')}</TableCell>
                        <TableCell>{email.resend_count}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResendEmail(email.id)}
                            disabled={resendingId === email.id}
                          >
                            {resendingId === email.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <><RefreshCw className="w-4 h-4 mr-1" /> Resend</>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
