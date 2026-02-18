import { useState } from "react";
import { logger } from "@/lib/logger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layouts/AdminLayout";

const CertificationConfiguration = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['certification-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certification_global_config' as any)
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();
      
      if (error) throw error;
      return data as any;
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: any) => {
      const { error } = await supabase
        .from('certification_global_config' as any)
        .update({ 
          config: newConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certification-config'] });
      toast.success('Configuration updated successfully');
    },
    onError: (error) => {
      logger.error('Error updating config:', error);
      toast.error('Failed to update configuration');
    },
  });

  const [localConfig, setLocalConfig] = useState<any>(null);

  const handleConfigChange = (path: string[], value: any) => {
    const updated = { ...(localConfig || config?.config) };
    let current = updated;
    
    // Create nested objects if they don't exist
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    setLocalConfig(updated);
  };

  const handleSave = () => {
    if (localConfig) {
      updateConfigMutation.mutate(localConfig);
      setLocalConfig(null);
    }
  };

  const handleReset = () => {
    setLocalConfig(null);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  const currentConfig = localConfig || config?.config || {};
  const hasChanges = localConfig !== null;

  return (
    <AdminLayout>
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Certification Configuration</h1>
              <p className="text-sm text-muted-foreground">Global settings for all certification assessments</p>
            </div>
          </div>
          
          {hasChanges && (
            <div className="flex gap-2 self-start sm:self-auto">
              <Button variant="outline" onClick={handleReset} size="sm" className="min-h-[44px]">
                <RotateCcw className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
              <Button onClick={handleSave} size="sm" className="min-h-[44px]">
                <Save className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Save Changes</span>
              </Button>
            </div>
          )}
        </div>

        <Tabs defaultValue="questions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto">
            <TabsTrigger value="questions" className="text-xs sm:text-sm min-h-[44px]">Questions</TabsTrigger>
            <TabsTrigger value="exam" className="text-xs sm:text-sm min-h-[44px]">Exam</TabsTrigger>
            <TabsTrigger value="proctoring" className="text-xs sm:text-sm min-h-[44px]">Proctoring</TabsTrigger>
            <TabsTrigger value="certificate" className="text-xs sm:text-sm min-h-[44px] hidden sm:flex">Certificate</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs sm:text-sm min-h-[44px] hidden sm:flex">AI</TabsTrigger>
          </TabsList>

          {/* Question Generation Tab */}
          <TabsContent value="questions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Question Generation Settings</CardTitle>
                <CardDescription>Configure how questions are auto-generated for each certification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Total Questions Per Certification</Label>
                  <Input
                    type="number"
                    value={currentConfig.question_generation?.total_questions || 50}
                    onChange={(e) => handleConfigChange(['question_generation', 'total_questions'], parseInt(e.target.value))}
                    min={10}
                    max={100}
                  />
                  <p className="text-sm text-muted-foreground">Number of questions to generate for each exam attempt (all questions are MCQ format)</p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Difficulty Distribution (%)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Beginner</Label>
                      <Input
                        type="number"
                        value={currentConfig.question_generation?.difficulty_distribution?.beginner || 20}
                        onChange={(e) => handleConfigChange(['question_generation', 'difficulty_distribution', 'beginner'], parseInt(e.target.value))}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Intermediate</Label>
                      <Input
                        type="number"
                        value={currentConfig.question_generation?.difficulty_distribution?.intermediate || 50}
                        onChange={(e) => handleConfigChange(['question_generation', 'difficulty_distribution', 'intermediate'], parseInt(e.target.value))}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Advanced</Label>
                      <Input
                        type="number"
                        value={currentConfig.question_generation?.difficulty_distribution?.advanced || 30}
                        onChange={(e) => handleConfigChange(['question_generation', 'difficulty_distribution', 'advanced'], parseInt(e.target.value))}
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exam Settings Tab */}
          <TabsContent value="exam" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Exam Settings</CardTitle>
                <CardDescription>Configure exam timing and passing criteria</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label>Time Limit (minutes)</Label>
                    <Input
                      type="number"
                      value={currentConfig.exam_settings?.time_limit_minutes || 90}
                      onChange={(e) => handleConfigChange(['exam_settings', 'time_limit_minutes'], parseInt(e.target.value))}
                      min={30}
                      max={240}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Passing Score (%)</Label>
                    <Input
                      type="number"
                      value={currentConfig.exam_settings?.passing_score_percentage || 70}
                      onChange={(e) => handleConfigChange(['exam_settings', 'passing_score_percentage'], parseInt(e.target.value))}
                      min={50}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Integrity Score</Label>
                    <Input
                      type="number"
                      value={currentConfig.exam_settings?.min_integrity_score || 70}
                      onChange={(e) => handleConfigChange(['exam_settings', 'min_integrity_score'], parseInt(e.target.value))}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Proctoring Tab */}
          <TabsContent value="proctoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Proctoring Settings</CardTitle>
                <CardDescription>Configure proctoring rules for exam integrity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Camera</Label>
                      <p className="text-sm text-muted-foreground">Force camera access during exam</p>
                    </div>
                    <Switch
                      checked={currentConfig.proctoring_settings?.require_camera ?? true}
                      onCheckedChange={(checked) => handleConfigChange(['proctoring_settings', 'require_camera'], checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Microphone</Label>
                      <p className="text-sm text-muted-foreground">Force microphone access during exam</p>
                    </div>
                    <Switch
                      checked={currentConfig.proctoring_settings?.require_microphone ?? true}
                      onCheckedChange={(checked) => handleConfigChange(['proctoring_settings', 'require_microphone'], checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Multiple Persons</Label>
                      <p className="text-sm text-muted-foreground">Allow multiple people in camera view</p>
                    </div>
                    <Switch
                      checked={currentConfig.proctoring_settings?.allow_multiple_persons ?? false}
                      onCheckedChange={(checked) => handleConfigChange(['proctoring_settings', 'allow_multiple_persons'], checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Detect Copy Attempts</Label>
                      <p className="text-sm text-muted-foreground">Track copy/paste actions</p>
                    </div>
                    <Switch
                      checked={currentConfig.proctoring_settings?.detect_copy_attempts ?? true}
                      onCheckedChange={(checked) => handleConfigChange(['proctoring_settings', 'detect_copy_attempts'], checked)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Max Tab Switches Allowed</Label>
                    <Input
                      type="number"
                      value={currentConfig.proctoring_settings?.max_tab_switches || 0}
                      onChange={(e) => handleConfigChange(['proctoring_settings', 'max_tab_switches'], parseInt(e.target.value))}
                      min={0}
                      max={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Look Aways Allowed</Label>
                    <Input
                      type="number"
                      value={currentConfig.proctoring_settings?.max_look_aways || 5}
                      onChange={(e) => handleConfigChange(['proctoring_settings', 'max_look_aways'], parseInt(e.target.value))}
                      min={0}
                      max={20}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificate Tab */}
          <TabsContent value="certificate" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Certificate Settings</CardTitle>
                <CardDescription>Configure certificate validity and retake policies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Certificate Validity (days)</Label>
                  <Input
                    type="number"
                    value={currentConfig.certificate_validity_days || 365}
                    onChange={(e) => handleConfigChange(['certificate_validity_days'], parseInt(e.target.value))}
                    min={30}
                    max={1825}
                  />
                  <p className="text-sm text-muted-foreground">How long certificates remain valid</p>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold">Retake Policy</h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Retakes</Label>
                      <p className="text-sm text-muted-foreground">Enable candidates to retake failed exams</p>
                    </div>
                    <Switch
                      checked={currentConfig.retake_settings?.allow_retake ?? true}
                      onCheckedChange={(checked) => handleConfigChange(['retake_settings', 'allow_retake'], checked)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Cooldown Period (days)</Label>
                      <Input
                        type="number"
                        value={currentConfig.retake_settings?.retake_cooldown_days || 30}
                        onChange={(e) => handleConfigChange(['retake_settings', 'retake_cooldown_days'], parseInt(e.target.value))}
                        min={1}
                        max={180}
                        disabled={!currentConfig.retake_settings?.allow_retake}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Retakes</Label>
                      <Input
                        type="number"
                        value={currentConfig.retake_settings?.max_retakes || 3}
                        onChange={(e) => handleConfigChange(['retake_settings', 'max_retakes'], parseInt(e.target.value))}
                        min={1}
                        max={10}
                        disabled={!currentConfig.retake_settings?.allow_retake}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Generation Settings</CardTitle>
                <CardDescription>Configure AI model used for question generation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Select
                    value={currentConfig.ai_settings?.model || 'google/gemini-2.5-flash'}
                    onValueChange={(value) => handleConfigChange(['ai_settings', 'model'], value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</SelectItem>
                      <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (Higher Quality)</SelectItem>
                      <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                      <SelectItem value="openai/gpt-5">GPT-5 (Premium)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Model used to generate certification questions</p>
                </div>

                <div className="space-y-2">
                  <Label>Temperature (0.0 - 1.0)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={currentConfig.ai_settings?.temperature || 0.7}
                    onChange={(e) => handleConfigChange(['ai_settings', 'temperature'], parseFloat(e.target.value))}
                    min={0}
                    max={1}
                  />
                  <p className="text-sm text-muted-foreground">Higher = more creative, Lower = more deterministic</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default CertificationConfiguration;