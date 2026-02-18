import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, RotateCcw, Shield, Eye, Mic, Monitor, User, AlertTriangle, Keyboard, Volume2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface ViolationConfig {
  key: string;
  label: string;
  description: string;
  category: 'identity' | 'objects' | 'behavior' | 'audio' | 'environment' | 'screen' | 'typing';
  defaultScore: number;
  severity: 'very_high' | 'high' | 'medium' | 'low';
}

const VIOLATION_CONFIGS: ViolationConfig[] = [
  // Identity violations (Very High / High)
  { key: 'different_person_detected', label: 'Different Person Detected', description: 'Candidate substitution detected', category: 'identity', defaultScore: 15, severity: 'very_high' },
  { key: 'identity_verification_uncertain', label: 'Identity Uncertain', description: 'Could not verify same person', category: 'identity', defaultScore: 8, severity: 'medium' },
  { key: 'no_person_in_frame', label: 'No Person in Frame', description: 'Candidate not visible for extended period', category: 'identity', defaultScore: 10, severity: 'high' },
  { key: 'face_at_edge', label: 'Face at Edge', description: 'Face partially visible at frame edge', category: 'identity', defaultScore: 3, severity: 'low' },
  { key: 'face_occluded', label: 'Face Occluded', description: 'Face blocked by hands or objects', category: 'identity', defaultScore: 5, severity: 'medium' },
  
  // Object violations
  { key: 'phone_detected', label: 'Phone Detected', description: 'Mobile phone visible in frame', category: 'objects', defaultScore: 15, severity: 'very_high' },
  { key: 'headphones_detected', label: 'Headphones Detected', description: 'Earphones or headphones visible', category: 'objects', defaultScore: 5, severity: 'medium' },
  { key: 'suspicious_background_objects', label: 'Suspicious Objects', description: 'Prohibited items in background', category: 'objects', defaultScore: 5, severity: 'medium' },
  
  // Screen violations
  { key: 'suspicious_screen_content', label: 'AI Tools / Chat Detected', description: 'ChatGPT, Gemini, or similar visible', category: 'screen', defaultScore: 15, severity: 'very_high' },
  
  // Behavior violations
  { key: 'looking_away', label: 'Looking Away', description: 'Eyes away from screen for extended period', category: 'behavior', defaultScore: 5, severity: 'medium' },
  { key: 'eye_gaze_off_screen', label: 'Eye Gaze Off Screen', description: 'Reading from off-screen source', category: 'behavior', defaultScore: 5, severity: 'medium' },
  { key: 'tab_switch', label: 'Tab Switch', description: 'Switched browser tab during interview', category: 'behavior', defaultScore: 5, severity: 'medium' },
  { key: 'copy_attempt', label: 'Copy Attempt', description: 'Tried to copy content', category: 'behavior', defaultScore: 3, severity: 'low' },
  { key: 'print_screen', label: 'Print Screen', description: 'Screenshot attempt detected', category: 'behavior', defaultScore: 5, severity: 'medium' },
  
  // Audio violations
  { key: 'multiple_voices', label: 'Multiple Voices', description: 'Additional voices detected', category: 'audio', defaultScore: 8, severity: 'medium' },
  { key: 'multiple_speakers', label: 'Multiple Speakers', description: 'Multiple distinct speakers in audio', category: 'audio', defaultScore: 8, severity: 'medium' },
  { key: 'audio_playback', label: 'Audio Playback', description: 'External audio playing detected', category: 'audio', defaultScore: 5, severity: 'medium' },
  { key: 'external_conversation', label: 'External Conversation', description: 'Talking to someone off-screen', category: 'audio', defaultScore: 10, severity: 'high' },
  { key: 'reading_pattern', label: 'Reading Pattern', description: 'Non-spontaneous speech detected', category: 'audio', defaultScore: 5, severity: 'medium' },
  
  // Environment violations
  { key: 'multiple_monitors', label: 'Multiple Monitors', description: 'Secondary display detected', category: 'environment', defaultScore: 5, severity: 'medium' },
  { key: 'virtual_machine', label: 'Virtual Machine', description: 'VM environment detected', category: 'environment', defaultScore: 10, severity: 'high' },
  { key: 'poor_lighting', label: 'Poor Lighting', description: 'Insufficient lighting conditions', category: 'environment', defaultScore: 2, severity: 'low' },
  { key: 'background_changed', label: 'Background Changed', description: 'Environment changed during interview', category: 'environment', defaultScore: 3, severity: 'low' },
  { key: 'clothing_changed', label: 'Clothing Changed', description: 'Candidate clothing changed', category: 'environment', defaultScore: 2, severity: 'low' },
  
  // Typing violations
  { key: 'suspicious_typing', label: 'Suspicious Typing', description: 'Unusual typing patterns detected', category: 'typing', defaultScore: 3, severity: 'low' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  identity: <User className="h-4 w-4" />,
  objects: <AlertTriangle className="h-4 w-4" />,
  screen: <Monitor className="h-4 w-4" />,
  behavior: <Eye className="h-4 w-4" />,
  audio: <Volume2 className="h-4 w-4" />,
  environment: <Shield className="h-4 w-4" />,
  typing: <Keyboard className="h-4 w-4" />,
};

const SEVERITY_COLORS: Record<string, string> = {
  very_high: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-muted text-muted-foreground',
};

interface ProctoringSettingsData {
  id?: string;
  organization_id?: string | null;
  // Feature toggles
  enable_face_detection: boolean;
  enable_eye_tracking: boolean;
  enable_voice_analysis: boolean;
  enable_tab_switching: boolean;
  enable_screen_recording: boolean;
  enable_object_detection: boolean;
  enable_screen_content_analysis: boolean;
  // Thresholds
  look_away_threshold_seconds: number;
  tab_switch_max_count: number;
  // Violation scores (dynamic keys)
  [key: `score_${string}`]: number;
  // Violation enabled toggles (dynamic keys)
  [key: `enabled_${string}`]: boolean;
  // Min passing score
  min_passing_score: number;
}

const getDefaultSettings = (): ProctoringSettingsData => {
  const settings: ProctoringSettingsData = {
    enable_face_detection: true,
    enable_eye_tracking: true,
    enable_voice_analysis: true,
    enable_tab_switching: true,
    enable_screen_recording: true,
    enable_object_detection: true,
    enable_screen_content_analysis: true,
    look_away_threshold_seconds: 5,
    tab_switch_max_count: 3,
    min_passing_score: 70,
  };
  
  // Add default scores and enabled flags for each violation
  for (const config of VIOLATION_CONFIGS) {
    settings[`score_${config.key}`] = config.defaultScore;
    settings[`enabled_${config.key}`] = true;
  }
  
  return settings;
};

const ProctoringSettings: React.FC = () => {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [settings, setSettings] = useState<ProctoringSettingsData>(getDefaultSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('proctoring_settings')
        .select('*')
        .is('organization_id', null)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({ ...getDefaultSettings(), ...data } as ProctoringSettingsData);
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load proctoring settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id, ...settingsData } = settings;

      if (id) {
        const { error } = await supabase
          .from('proctoring_settings')
          .update(settingsData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('proctoring_settings')
          .insert([{ ...settingsData, organization_id: null }]);
        if (error) throw error;
      }

      toast({
        title: 'Settings Saved',
        description: 'Proctoring settings have been updated successfully',
      });

      await loadSettings();
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save proctoring settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(getDefaultSettings());
    toast({
      title: 'Settings Reset',
      description: 'Settings have been reset to defaults',
    });
  };

  const updateSetting = (key: string, value: number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getViolationsByCategory = (category: string) => {
    return VIOLATION_CONFIGS.filter(v => v.category === category);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 sm:h-8 sm:w-8 shrink-0" />
            Proctoring Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
            Configure violation detection, scoring, and integrity thresholds
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={handleReset} size="sm" className="min-h-[44px]">
            <RotateCcw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Reset to Defaults</span>
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="min-h-[44px]">
            <Save className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Settings'}</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="violations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="violations" className="text-xs sm:text-sm min-h-[44px]">Violations</TabsTrigger>
          <TabsTrigger value="features" className="text-xs sm:text-sm min-h-[44px]">Detection</TabsTrigger>
          <TabsTrigger value="thresholds" className="text-xs sm:text-sm min-h-[44px]">Thresholds</TabsTrigger>
        </TabsList>

        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Violation Deduction Scores</CardTitle>
              <CardDescription>
                Configure how many points to deduct for each violation type. Enable/disable specific violations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {['identity', 'objects', 'screen', 'behavior', 'audio', 'environment', 'typing'].map((category) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 text-lg font-semibold capitalize">
                    {CATEGORY_ICONS[category]}
                    {category} Violations
                  </div>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {getViolationsByCategory(category).map((config) => (
                      <div key={config.key} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={settings[`enabled_${config.key}`] !== false}
                              onCheckedChange={(checked) => updateSetting(`enabled_${config.key}`, checked)}
                            />
                            <span className="font-medium text-sm">{config.label}</span>
                          </div>
                          <Badge className={SEVERITY_COLORS[config.severity]}>
                            {config.severity.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Points:</Label>
                          <Input
                            type="number"
                            min="0"
                            max="50"
                            value={settings[`score_${config.key}`] ?? config.defaultScore}
                            onChange={(e) => updateSetting(`score_${config.key}`, parseInt(e.target.value) || 0)}
                            className="h-8 w-20"
                            disabled={settings[`enabled_${config.key}`] === false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detection Features</CardTitle>
              <CardDescription>Enable or disable entire detection categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>AI Face Detection</Label>
                    <p className="text-xs text-muted-foreground">Detect faces, multiple persons, look-aways</p>
                  </div>
                  <Switch
                    checked={settings.enable_face_detection}
                    onCheckedChange={(checked) => updateSetting('enable_face_detection', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Eye Tracking</Label>
                    <p className="text-xs text-muted-foreground">Track eye gaze and focus patterns</p>
                  </div>
                  <Switch
                    checked={settings.enable_eye_tracking}
                    onCheckedChange={(checked) => updateSetting('enable_eye_tracking', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Voice Analysis</Label>
                    <p className="text-xs text-muted-foreground">Detect multiple voices and audio anomalies</p>
                  </div>
                  <Switch
                    checked={settings.enable_voice_analysis}
                    onCheckedChange={(checked) => updateSetting('enable_voice_analysis', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Tab Switch Detection</Label>
                    <p className="text-xs text-muted-foreground">Log when candidate switches browser tabs</p>
                  </div>
                  <Switch
                    checked={settings.enable_tab_switching}
                    onCheckedChange={(checked) => updateSetting('enable_tab_switching', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Screen Recording</Label>
                    <p className="text-xs text-muted-foreground">Record candidate's screen during interview</p>
                  </div>
                  <Switch
                    checked={settings.enable_screen_recording}
                    onCheckedChange={(checked) => updateSetting('enable_screen_recording', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Object Detection</Label>
                    <p className="text-xs text-muted-foreground">Detect phones, headphones, and objects</p>
                  </div>
                  <Switch
                    checked={settings.enable_object_detection}
                    onCheckedChange={(checked) => updateSetting('enable_object_detection', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Screen Content Analysis</Label>
                    <p className="text-xs text-muted-foreground">AI analysis of screen content for tools</p>
                  </div>
                  <Switch
                    checked={settings.enable_screen_content_analysis}
                    onCheckedChange={(checked) => updateSetting('enable_screen_content_analysis', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thresholds" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Violation Thresholds</CardTitle>
                <CardDescription>Configure when violations are triggered</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Look Away Threshold (seconds)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.look_away_threshold_seconds}
                    onChange={(e) => updateSetting('look_away_threshold_seconds', parseInt(e.target.value) || 5)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Time before a look-away violation is logged
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Max Tab Switches</Label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={settings.tab_switch_max_count}
                    onChange={(e) => updateSetting('tab_switch_max_count', parseInt(e.target.value) || 3)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum allowed tab switches before flagging
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integrity Scoring</CardTitle>
                <CardDescription>Configure passing thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Minimum Passing Integrity Score</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.min_passing_score}
                    onChange={(e) => updateSetting('min_passing_score', parseInt(e.target.value) || 70)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Candidates with scores below this threshold will be flagged for review
                  </p>
                </div>
                <Separator />
                <div className="text-sm space-y-2">
                  <p className="font-medium">Hiring Decision Rules:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Integrity &lt; 50%: Automatic rejection (severe violation)</li>
                    <li>Integrity 51-70%: Conditional recommend (manual review)</li>
                    <li>Technical &lt; 60%: Rejection regardless of integrity</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProctoringSettings;