import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Bell, Lock, Globe, Save } from 'lucide-react';
import { getUserFriendlyErrorMessage } from '@/lib/error-handler';

const Settings = () => {
  const { user } = useAuth();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile settings
  const [fullName, setFullName] = useState('');
  
  // Privacy settings
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  
  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileError) throw profileError;
      
      if (profile) {
        setFullName(profile.full_name || '');
      }
      
    } catch (error) {
      logger.error('Error fetching settings:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error, 'Failed to load settings'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      logger.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error, 'Failed to save profile'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-1 sm:px-0">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Settings</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="profile" className="min-h-[44px] text-xs sm:text-sm py-2">
              <User className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Profile</span>
              <span className="xs:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="min-h-[44px] text-xs sm:text-sm py-2">
              <Lock className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Privacy</span>
              <span className="xs:hidden">Privacy</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto min-h-[44px]">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>
                  Control your privacy and data visibility
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="profile-visibility" className="text-sm">Profile Visibility</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Make your profile visible to others in your organization
                    </p>
                  </div>
                  <Switch
                    id="profile-visibility"
                    checked={profileVisibility}
                    onCheckedChange={setProfileVisibility}
                    className="shrink-0"
                  />
                </div>

                <Separator />

                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="show-email" className="text-sm">Show Email</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Display your email address on your profile
                    </p>
                  </div>
                  <Switch
                    id="show-email"
                    checked={showEmail}
                    onCheckedChange={setShowEmail}
                    className="shrink-0"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="font-medium">Data & Privacy</h3>
                  <p className="text-sm text-muted-foreground">
                    Your data is encrypted and stored securely. We comply with GDPR and other privacy regulations.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
