import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Settings, 
  Check, 
  Loader2, 
  AlertCircle,
  FileText,
  Clock,
  Target,
  BarChart3,
  Shield,
  Code,
  Database
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { toast } from 'sonner';
import { 
  detectExperienceLevel, 
  getRoleBasedConfig, 
  CategoryDifficultyDistribution,
  categoryToOverallDifficulty
} from '@/lib/roleBasedDefaults';

interface LocationState {
  jobDescription: string;
  jobTitle: string;
  skillDomain?: string;
  showCoding?: boolean;
  showDbSchema?: boolean;
  experienceLevel?: string;
  selectedSkills?: string[];
  // Client context from JD Builder
  clientKeywords?: string;
  primaryCloud?: string;
  industry?: string;
}

interface ExtractedDefaults {
  skills: string[];
  skillDomain: string;
  showCoding: boolean;
  showDbSchema: boolean;
  suggestedDefaults: {
    mcq: number;
    scenario: number;
    coding: number;
    descriptive: number;
  };
  categoryDifficulty: CategoryDifficultyDistribution;
  experienceLevel: string;
  minYearsExperience: number | null;
}

const QuickCreatePreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  const [isExtracting, setIsExtracting] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [extractedDefaults, setExtractedDefaults] = useState<ExtractedDefaults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proctoringEnabled, setProctoringEnabled] = useState(true);

  // Fixed values - bank size is now 100
  const questionCount = 10;
  const questionBankSize = 100;
  const timeLimit = 30;

  useEffect(() => {
    if (!locationState?.jobDescription || !locationState?.jobTitle) {
      navigate('/partner/recruiting/jd-builder');
      return;
    }
    extractSkillsAndDefaults();
  }, []);

  const extractSkillsAndDefaults = async () => {
    if (!locationState) return;

    setIsExtracting(true);
    setError(null);

    try {
      // Detect experience level from job title
      const detectedLevel = detectExperienceLevel(locationState.jobTitle);
      const roleConfig = getRoleBasedConfig(detectedLevel);
      
      // Check if skills were passed from JD Builder - use them directly instead of re-extracting
      if (locationState.selectedSkills && locationState.selectedSkills.length > 0) {
        logger.info('Using skills from JD Builder instead of re-extracting', { 
          skillCount: locationState.selectedSkills.length 
        });
        
        // Still call extract-skills but only for domain detection and defaults
        const { data, error: extractError } = await invokeFunction('extract-skills', {
          body: {
            jobTitle: locationState.jobTitle,
            jobDescription: locationState.jobDescription,
            experienceLevel: locationState.experienceLevel || detectedLevel,
            // Pass the selected skills so AI can consider them for domain detection
            preSelectedSkills: locationState.selectedSkills
          }
        });

        if (extractError) throw extractError;

        const finalDefaults = {
          mcq: data.suggestedDefaults?.mcq ?? roleConfig.questionTypeDistribution.mcq,
          scenario: data.suggestedDefaults?.scenario ?? roleConfig.questionTypeDistribution.scenario,
          coding: data.suggestedDefaults?.coding ?? roleConfig.questionTypeDistribution.coding,
          descriptive: data.suggestedDefaults?.descriptive ?? roleConfig.questionTypeDistribution.descriptive
        };

        // Use the skills from JD Builder, not the extracted ones
        setExtractedDefaults({
          skills: locationState.selectedSkills,
          skillDomain: locationState.skillDomain || data.skillDomain || 'backend',
          showCoding: locationState.showCoding ?? data.showCoding !== false,
          showDbSchema: locationState.showDbSchema ?? data.showDbSchema === true,
          suggestedDefaults: finalDefaults,
          categoryDifficulty: data.categoryDifficulty || roleConfig.categoryDifficulty,
          experienceLevel: locationState.experienceLevel || data.experienceLevel || detectedLevel,
          minYearsExperience: data.minYearsExperience ?? null
        });
      } else {
        // No skills from JD Builder - extract fresh (for pasted JD flow)
        const { data, error: extractError } = await invokeFunction('extract-skills', {
          body: {
            jobTitle: locationState.jobTitle,
            jobDescription: locationState.jobDescription,
            experienceLevel: locationState.experienceLevel || detectedLevel
          }
        });

        if (extractError) throw extractError;

        const finalDefaults = {
          mcq: data.suggestedDefaults?.mcq ?? roleConfig.questionTypeDistribution.mcq,
          scenario: data.suggestedDefaults?.scenario ?? roleConfig.questionTypeDistribution.scenario,
          coding: data.suggestedDefaults?.coding ?? roleConfig.questionTypeDistribution.coding,
          descriptive: data.suggestedDefaults?.descriptive ?? roleConfig.questionTypeDistribution.descriptive
        };

        setExtractedDefaults({
          skills: data.skills || [],
          skillDomain: data.skillDomain || 'backend',
          showCoding: data.showCoding !== false,
          showDbSchema: data.showDbSchema === true,
          suggestedDefaults: finalDefaults,
          categoryDifficulty: data.categoryDifficulty || roleConfig.categoryDifficulty,
          experienceLevel: data.experienceLevel || detectedLevel,
          minYearsExperience: data.minYearsExperience ?? null
        });
      }
    } catch (err: any) {
      logger.error('Error extracting skills:', err);
      setError(err.message || 'Failed to extract skills');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleQuickCreate = async () => {
    if (!locationState || !extractedDefaults) return;

    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for platform admin role first
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const isPlatformAdmin = userRoles?.some(r => r.role === 'platform_admin');

      const { data: orgMembership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (!orgMembership && !isPlatformAdmin) {
        throw new Error('No active organization membership');
      }

      // Build topics from extracted skills (top 8)
      const topSkills = extractedDefaults.skills.slice(0, 8);
      const equalPercent = Math.floor(100 / topSkills.length);
      const remainder = 100 - (equalPercent * topSkills.length);
      const topicDistribution: Record<string, number> = {};
      topSkills.forEach((skill, index) => {
        topicDistribution[skill] = equalPercent + (index === 0 ? remainder : 0);
      });

      const proctoringSettings = proctoringEnabled ? {
        camera: true,
        screen: true,
        voice: true,
        tab_switching: true
      } : null;

      // Calculate overall difficulty from category difficulty
      const overallDifficulty = categoryToOverallDifficulty(
        extractedDefaults.categoryDifficulty,
        extractedDefaults.suggestedDefaults
      );

      // Create interview with distributions for smart question selection
      const { data: interview, error: createError } = await supabase
        .from('interviews')
        .insert({
          title: locationState.jobTitle,
          job_description: locationState.jobDescription,
          question_count: questionCount,
          question_bank_size: questionBankSize,
          time_limit: timeLimit,
          topic_distribution: topicDistribution,
          difficulty_distribution: overallDifficulty,
          status: 'draft',
          generation_status: 'generating',
          proctoring_enabled: proctoringEnabled,
          proctoring_settings: proctoringSettings,
          creator_id: user.id,
          organization_id: orgMembership?.organization_id || null,
          skill_domain: extractedDefaults.skillDomain,
          question_type_distribution: extractedDefaults.suggestedDefaults as any,
          category_difficulty_distribution: extractedDefaults.categoryDifficulty as any,
          experience_level: extractedDefaults.experienceLevel,
          min_years_experience: extractedDefaults.minYearsExperience
        })
        .select()
        .single();

      if (createError) throw createError;

      // Trigger question generation with per-category difficulty and experience context
      const { error: generateError } = await invokeFunction('generate-questions', {
        body: {
          interviewId: interview.id,
          jobTitle: locationState.jobTitle,
          jobDescription: locationState.jobDescription,
          questionCount: questionBankSize,
          questionBankSize: questionBankSize,
          topics: topicDistribution,
          difficultyDistribution: overallDifficulty,
          categoryDifficultyDistribution: extractedDefaults.categoryDifficulty,
          questionTypeDistribution: extractedDefaults.suggestedDefaults,
          experienceLevel: extractedDefaults.experienceLevel,
          minYearsExperience: extractedDefaults.minYearsExperience
        }
      });

      if (generateError) {
        logger.error('Generation error:', generateError);
        // Update status to failed
        await supabase
          .from('interviews')
          .update({ status: 'failed' })
          .eq('id', interview.id);
        throw generateError;
      }

      toast.success('Interview created! Questions are being generated.');
      navigate(`/partner/recruiting/interview-generation/${interview.id}`);
    } catch (err: any) {
      logger.error('Error creating interview:', err);
      toast.error(err.message || 'Failed to create interview');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCustomize = () => {
    navigate('/partner/recruiting/create-interview', {
      state: {
        ...locationState,
        fromBuilder: true,
        // Preserve client context for manual create flow
        clientKeywords: locationState?.clientKeywords,
        primaryCloud: locationState?.primaryCloud,
        industry: locationState?.industry
      }
    });
  };

  if (!locationState) {
    return null;
  }

  return (
    <div className="container max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Quick Create Interview</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Review AI-recommended settings and create your interview instantly
        </p>
      </div>

      {isExtracting ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Analyzing Job Description...</p>
            <p className="text-muted-foreground">Extracting skills and configuring optimal settings</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium">Analysis Failed</p>
            <p className="text-muted-foreground mb-4">{error}</p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button variant="outline" onClick={extractSkillsAndDefaults} className="min-h-[44px]">
                Try Again
              </Button>
              <Button onClick={handleCustomize} className="min-h-[44px]">
                Configure Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : extractedDefaults && (
        <div className="space-y-6">
          {/* Job Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle>Job Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm">Title</Label>
                <p className="font-medium text-lg">{locationState.jobTitle}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Detected Role Type</Label>
                <Badge variant="secondary" className="ml-2 capitalize">
                  {extractedDefaults.skillDomain.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Experience Level</Label>
                <Badge variant="outline" className="ml-2 capitalize">
                  {extractedDefaults.experienceLevel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Extracted Skills */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle>Interview Topics</CardTitle>
              </div>
              <CardDescription>
                Top skills extracted from the job description (will be used as interview topics)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {extractedDefaults.skills.slice(0, 8).map((skill, index) => (
                  <Badge key={skill} variant={index < 4 ? "default" : "secondary"}>
                    {skill}
                  </Badge>
                ))}
              </div>
              {extractedDefaults.skills.length > 8 && (
                <p className="text-sm text-muted-foreground mt-3">
                  +{extractedDefaults.skills.length - 8} more skills available for customization
                </p>
              )}
            </CardContent>
          </Card>

          {/* Configuration Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <CardTitle>Interview Configuration</CardTitle>
              </div>
              <CardDescription>
                AI-recommended settings based on the role type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Settings */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{questionCount}</p>
                  <p className="text-xs text-muted-foreground">Questions per Interview</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{questionBankSize}</p>
                  <p className="text-xs text-muted-foreground">Question Bank Size</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4" />
                    <p className="text-2xl font-bold">{timeLimit}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Minutes</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-1">
                    <Shield className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">Proctoring</p>
                  <Switch
                    checked={proctoringEnabled}
                    onCheckedChange={setProctoringEnabled}
                    className="mt-1"
                  />
                </div>
              </div>

              <Separator />

              {/* Question Type Distribution */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <Label>Question Type Distribution</Label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 border rounded-lg">
                    <p className="text-lg font-semibold">{extractedDefaults.suggestedDefaults.mcq}%</p>
                    <p className="text-xs text-muted-foreground">MCQ</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-lg font-semibold">{extractedDefaults.suggestedDefaults.scenario}%</p>
                    <p className="text-xs text-muted-foreground">Scenario</p>
                  </div>
                  {extractedDefaults.showCoding && (
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-1">
                        <Code className="h-3 w-3" />
                        <p className="text-lg font-semibold">{extractedDefaults.suggestedDefaults.coding}%</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Coding</p>
                    </div>
                  )}
                  <div className="p-3 border rounded-lg">
                    <p className="text-lg font-semibold">{extractedDefaults.suggestedDefaults.descriptive}%</p>
                    <p className="text-xs text-muted-foreground">Descriptive</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Per-Category Difficulty Distribution */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <Label>Per-Category Difficulty</Label>
                </div>
                <div className="space-y-3">
                  {/* MCQ Difficulty */}
                  {extractedDefaults.suggestedDefaults.mcq > 0 && (
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm font-medium mb-2">MCQ</p>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-950/30 rounded">Easy: {extractedDefaults.categoryDifficulty.mcq.easy}%</span>
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-950/30 rounded">Med: {extractedDefaults.categoryDifficulty.mcq.medium}%</span>
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-950/30 rounded">Hard: {extractedDefaults.categoryDifficulty.mcq.hard}%</span>
                      </div>
                    </div>
                  )}
                  {/* Scenario Difficulty */}
                  {extractedDefaults.suggestedDefaults.scenario > 0 && (
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm font-medium mb-2">Scenario</p>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-950/30 rounded">Easy: {extractedDefaults.categoryDifficulty.scenario.easy}%</span>
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-950/30 rounded">Med: {extractedDefaults.categoryDifficulty.scenario.medium}%</span>
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-950/30 rounded">Hard: {extractedDefaults.categoryDifficulty.scenario.hard}%</span>
                      </div>
                    </div>
                  )}
                  {/* Coding Difficulty */}
                  {extractedDefaults.showCoding && extractedDefaults.suggestedDefaults.coding > 0 && (
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm font-medium mb-2">Coding</p>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-950/30 rounded">Easy: {extractedDefaults.categoryDifficulty.coding.easy}%</span>
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-950/30 rounded">Med: {extractedDefaults.categoryDifficulty.coding.medium}%</span>
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-950/30 rounded">Hard: {extractedDefaults.categoryDifficulty.coding.hard}%</span>
                      </div>
                    </div>
                  )}
                  {/* Descriptive Difficulty */}
                  {extractedDefaults.suggestedDefaults.descriptive > 0 && (
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm font-medium mb-2">Descriptive</p>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-950/30 rounded">Easy: {extractedDefaults.categoryDifficulty.descriptive.easy}%</span>
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-950/30 rounded">Med: {extractedDefaults.categoryDifficulty.descriptive.medium}%</span>
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-950/30 rounded">Hard: {extractedDefaults.categoryDifficulty.descriptive.hard}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {extractedDefaults.showDbSchema && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-sm">Database schema will be auto-generated for coding questions</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button
              size="lg"
              className="flex-1"
              onClick={handleQuickCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating Interview...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Create Interview with These Settings
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleCustomize}
              disabled={isCreating}
            >
              <Settings className="h-5 w-5 mr-2" />
              Customize Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickCreatePreview;
