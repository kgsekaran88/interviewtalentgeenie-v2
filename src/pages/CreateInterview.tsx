import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Sparkles, Loader2, X, Shield, ChevronDown, ChevronUp, Plus, Trash2, AlertTriangle, ListChecks, Download, Upload, Save, BookTemplate } from "lucide-react";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { QuestionTypeDistribution, InterviewConfigTemplate } from "@/hooks/useInterviewConfiguration";
import { ExportTemplateDialog, ImportTemplateDialog, TemplateActions } from "@/components/interview/InterviewConfigTemplate";
import { QuestionTypeInputs } from "@/components/interview/QuestionTypeInputs";
import { createInterviewSchema } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAutoRecovery } from "@/hooks/useAutoRecovery";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  getDefaultCategoryDifficulty, 
  CategoryDifficultyDistribution,
  categoryToOverallDifficulty,
  getSmartCodingDifficulty,
  calculateCodingQuestionCounts,
  detectExperienceLevel,
  getRoleBasedConfig,
  percentsToCounts,
  countsToPercents
} from "@/lib/roleBasedDefaults";
import { CategoryDifficultyInputs } from '@/components/interview/CategoryDifficultyInputs';
import { Alert, AlertDescription } from "@/components/ui/alert";

// Type for required question rules (exported for reuse)
export interface RequiredQuestionRule {
  id: string;
  type: 'mcq' | 'descriptive' | 'scenario' | 'coding';
  difficulty: 'easy' | 'medium' | 'hard';
  min: number;
  topic?: string; // Optional: specific topic like "SQL", "JavaScript"
}

const CreateInterview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { updateProgress } = useOnboarding();
  useAutoRecovery();
  
  // Edit mode state
  const editInterviewId = searchParams.get('id');
  const isReconfigureMode = searchParams.get('reconfigure') === 'true';
  const isEditMode = !!editInterviewId;
  
  // Check for pre-filled data from JD wizard or template
  const locationState = location.state as { 
    jobDescription?: string; 
    jobTitle?: string;
    skillDomain?: string;
    showCoding?: boolean;
    showDbSchema?: boolean;
    fromBuilder?: boolean;
    experienceLevel?: string;
    selectedSkills?: string[];
    // Client context from JD Builder
    clientKeywords?: string;
    primaryCloud?: string;
    industry?: string;
    // Template-related fields
    fromTemplate?: boolean;
    templateId?: string;
    templateName?: string;
    questionDistribution?: { mcq: number; scenario: number; coding: number; descriptive: number };
    difficultyDistribution?: { easy: number; medium: number; hard: number };
    timeLimit?: number;
    questionBankSize?: number;
    tags?: string[];
    category?: string;
    seniorityLevel?: string;
  } | null;
  
  // Derive initial values from template if available
  const getInitialTypeDistribution = (): QuestionTypeDistribution => {
    if (locationState?.fromTemplate && locationState?.questionDistribution) {
      // Template distribution is in percentages, we'll convert to counts after questionCount is set
      const dist = locationState.questionDistribution;
      return {
        mcq: Math.round((dist.mcq / 100) * 10),
        scenario: Math.round((dist.scenario / 100) * 10),
        coding: Math.round((dist.coding / 100) * 10),
        descriptive: Math.round((dist.descriptive / 100) * 10),
      };
    }
    return {
      mcq: 4,
      scenario: 3,
      coding: locationState?.showCoding === false ? 0 : 2,
      descriptive: locationState?.showCoding === false ? 3 : 1,
    };
  };
  
  const [loading, setLoading] = useState(false);
  const [fetchingInterview, setFetchingInterview] = useState(isEditMode);
  const [title, setTitle] = useState(locationState?.jobTitle || locationState?.templateName || "");
  const [jobDescription, setJobDescription] = useState(locationState?.jobDescription || "");
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState<number | null>(locationState?.timeLimit || 30);
  // Question type distribution as absolute counts
  const [typeDistribution, setTypeDistribution] = useState<QuestionTypeDistribution>(getInitialTypeDistribution());
  const [topics, setTopics] = useState<{ [key: string]: number }>({});
  
  // Template dialog states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [extractingSkills, setExtractingSkills] = useState(false);
  const [skillExtractionStatus, setSkillExtractionStatus] = useState<string>("Analyzing role requirements...");
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [questionBankSize, setQuestionBankSize] = useState(locationState?.questionBankSize || 200); // Default to 200 on initial load
  const [codingSchema, setCodingSchema] = useState<Record<string, any>>({});
  const [schemaDomain, setSchemaDomain] = useState("");
  const [generatingSchema, setGeneratingSchema] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  
  // Template save state - tracks if config has been saved and detects changes
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState<string | null>(null);
  
  // Skill domain detection state
  const [skillDomain, setSkillDomain] = useState<string | null>(locationState?.skillDomain || null);
  const [showCoding, setShowCoding] = useState<boolean>(locationState?.showCoding !== false);
  const [showDbSchema, setShowDbSchema] = useState<boolean>(locationState?.showDbSchema === true);
  
  // Experience level state - for question generation context
  const [detectedExperienceLevel, setDetectedExperienceLevel] = useState<string | null>(
    locationState?.experienceLevel || locationState?.seniorityLevel || null
  );
  const [detectedMinYears, setDetectedMinYears] = useState<number | null>(null);

  // Per-category difficulty state - auto-populated based on role
  const [categoryDifficulty, setCategoryDifficulty] = useState<CategoryDifficultyDistribution>(
    getDefaultCategoryDifficulty()
  );
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);
  
  // Auto-populate difficulty when job title changes
  const updateDifficultyFromRole = (jobTitle: string) => {
    if (!jobTitle.trim()) return;
    const experienceLevel = detectExperienceLevel(jobTitle);
    const roleConfig = getRoleBasedConfig(experienceLevel);
    setCategoryDifficulty(roleConfig.categoryDifficulty);
    // Also update detected experience level
    if (!detectedExperienceLevel) {
      setDetectedExperienceLevel(experienceLevel);
    }
  };

  // Required question rules state
  const [requiredRules, setRequiredRules] = useState<RequiredQuestionRule[]>([]);
  const [newRuleType, setNewRuleType] = useState<'mcq' | 'descriptive' | 'scenario' | 'coding'>('coding');
  const [newRuleDifficulty, setNewRuleDifficulty] = useState<'easy' | 'medium' | 'hard'>('hard');
  const [newRuleMin, setNewRuleMin] = useState(1);
  const [newRuleTopic, setNewRuleTopic] = useState<string>('');

  // Computed percent values for backward compatibility with existing logic
  const mcqPercent = questionCount > 0 ? Math.round((typeDistribution.mcq / questionCount) * 100) : 0;
  const scenarioPercent = questionCount > 0 ? Math.round((typeDistribution.scenario / questionCount) * 100) : 0;
  const codingPercent = questionCount > 0 ? Math.round((typeDistribution.coding / questionCount) * 100) : 0;
  const descriptivePercent = questionCount > 0 ? Math.round((typeDistribution.descriptive / questionCount) * 100) : 0;

  // Helper to set type counts from percentages (for backward compat)
  const setMcqPercent = (pct: number) => setTypeDistribution(prev => ({ ...prev, mcq: Math.round((pct / 100) * questionCount) }));
  const setScenarioPercent = (pct: number) => setTypeDistribution(prev => ({ ...prev, scenario: Math.round((pct / 100) * questionCount) }));
  const setCodingPercent = (pct: number) => setTypeDistribution(prev => ({ ...prev, coding: Math.round((pct / 100) * questionCount) }));
  const setDescriptivePercent = (pct: number) => setTypeDistribution(prev => ({ ...prev, descriptive: Math.round((pct / 100) * questionCount) }));

  // Type total for validation
  const typeTotal = typeDistribution.mcq + typeDistribution.scenario + typeDistribution.coding + typeDistribution.descriptive;

  // Create a config snapshot string for comparison
  const currentConfigSnapshot = JSON.stringify({
    title,
    timeLimit,
    mcqPercent,
    scenarioPercent,
    codingPercent,
    descriptivePercent,
    extractedSkills: extractedSkills.slice(0, 5),
  });

  // Determine if save button should be disabled (saved and no changes)
  const isTemplateSaveDisabled = !title.trim() || (savedConfigSnapshot !== null && savedConfigSnapshot === currentConfigSnapshot);

  // Handler for when template is successfully saved
  const handleTemplateSaved = () => {
    setSavedConfigSnapshot(currentConfigSnapshot);
  };

  // Handle type count change with auto-adjustment of last field
  const handleTypeCountChange = (type: keyof QuestionTypeDistribution, value: number, isLast: boolean) => {
    const typeKeys = showCoding 
      ? ['mcq', 'scenario', 'coding', 'descriptive'] as const
      : ['mcq', 'scenario', 'descriptive'] as const;
    
    setTypeDistribution(prev => {
      const newDistribution = { ...prev, [type]: Math.max(0, value) };
      
      if (!isLast) {
        // Auto-adjust last field
        const lastKey = typeKeys[typeKeys.length - 1];
        const otherTotal = typeKeys
          .filter(k => k !== lastKey)
          .reduce((sum, k) => sum + (newDistribution[k] || 0), 0);
        const remaining = Math.max(0, questionCount - otherTotal);
        newDistribution[lastKey] = remaining;
      }
      
      return newDistribution;
    });
  };

  // Handle template export
  const handleExportTemplate = (templateName: string) => {
    // Export categoryDifficulty as counts (matching Excel format)
    const categoryDifficultyCounts = percentsToCounts(categoryDifficulty, typeDistribution);
    
    const template: InterviewConfigTemplate = {
      version: '1.0',
      name: templateName,
      createdAt: new Date().toISOString(),
      config: {
        jobTitle: title,
        jobDescription,
        skills: extractedSkills,
        questionCount,
        questionBankSize,
        timeLimit,
        skillDomain,
        questionTypeDistribution: typeDistribution,
        categoryDifficultyDistribution: categoryDifficultyCounts,
        topics,
        requiredQuestionRules: requiredRules.map(({ id, ...rest }) => rest),
        proctoringEnabled,
      },
    };
    
    // Download as JSON
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-config-${templateName.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Template Exported',
      description: `Configuration "${templateName}" has been downloaded.`,
    });
  };

  // Handle template import with optional AI enhancement
  const handleImportTemplate = async (template: InterviewConfigTemplate, enhanceWithAI: boolean = false) => {
    const { config } = template;
    
    // Apply job details
    if (config.jobTitle) {
      setTitle(config.jobTitle);
      // Auto-populate difficulty based on detected role from job title
      updateDifficultyFromRole(config.jobTitle);
    }
    if (config.jobDescription) setJobDescription(config.jobDescription);
    
    // Apply skills - always populate
    if (config.skills && config.skills.length > 0) {
      setExtractedSkills(config.skills);
      // If no explicit topics, auto-add skills as topics with equal distribution
      if (!config.topics || Object.keys(config.topics).length === 0) {
        const topSkills = config.skills.slice(0, 8);
        const equalPercent = Math.floor(100 / topSkills.length);
        const remainder = 100 - (equalPercent * topSkills.length);
        const autoTopics: { [key: string]: number } = {};
        topSkills.forEach((skill, index) => {
          autoTopics[skill] = equalPercent + (index === 0 ? remainder : 0);
        });
        setTopics(autoTopics);
      }
    }
    
    // Apply interview settings
    setQuestionCount(config.questionCount);
    setQuestionBankSize(config.questionBankSize);
    if (config.timeLimit !== undefined) setTimeLimit(config.timeLimit);
    if (config.skillDomain) {
      setSkillDomain(config.skillDomain);
      setShowCoding(!['non_technical'].includes(config.skillDomain));
      setShowDbSchema(['database', 'fullstack', 'data_science'].includes(config.skillDomain));
    }
    setTypeDistribution(config.questionTypeDistribution);
    
    // Apply difficulty - detect if template uses counts or percentages
    if (config.categoryDifficultyDistribution) {
      const distrib = config.categoryDifficultyDistribution;
      // Check if this is the old percentage format (values add to 100) or new count format
      const mcqTotal = distrib.mcq.easy + distrib.mcq.medium + distrib.mcq.hard;
      const isPercentageFormat = mcqTotal === 100 || 
        (distrib.scenario.easy + distrib.scenario.medium + distrib.scenario.hard === 100);
      
      if (isPercentageFormat) {
        // Old format - use directly
        setCategoryDifficulty(distrib);
      } else {
        // New count format - convert to percentages
        setCategoryDifficulty(countsToPercents(distrib, config.questionTypeDistribution));
      }
    }
    
    // Apply topics from template (overrides auto-generated from skills)
    if (config.topics && Object.keys(config.topics).length > 0) {
      setTopics(config.topics);
    }
    
    if (config.requiredQuestionRules) {
      setRequiredRules(config.requiredQuestionRules.map((r, i) => ({ ...r, id: `imported-${i}` })));
    }
    if (config.proctoringEnabled !== undefined) setProctoringEnabled(config.proctoringEnabled);

    // AI Enhancement - extract and enhance skills from job description
    if (enhanceWithAI && config.jobDescription) {
      setExtractingSkills(true);
      setSkillExtractionStatus("Enhancing with AI...");

      try {
        const { data, error } = await invokeFunction('extract-skills', {
          body: { 
            jobTitle: config.jobTitle || title,
            jobDescription: config.jobDescription 
          },
        });

        if (error) throw error;

        // Update with AI-extracted skills
        if (data.skills && data.skills.length > 0) {
          setExtractedSkills(data.skills);
          const topSkills = data.skills.slice(0, 8);
          const equalPercent = Math.floor(100 / topSkills.length);
          const remainder = 100 - (equalPercent * topSkills.length);
          const autoTopics: { [key: string]: number } = {};
          topSkills.forEach((skill: string, index: number) => {
            autoTopics[skill] = equalPercent + (index === 0 ? remainder : 0);
          });
          setTopics(autoTopics);
        }

        // Update skill domain and defaults from AI
        if (data.skillDomain) {
          setSkillDomain(data.skillDomain);
          setShowCoding(data.showCoding !== false);
          setShowDbSchema(data.showDbSchema === true);
          
          if (data.suggestedDefaults) {
            setMcqPercent(data.suggestedDefaults.mcq);
            setScenarioPercent(data.suggestedDefaults.scenario);
            setCodingPercent(data.suggestedDefaults.coding);
            setDescriptivePercent(data.suggestedDefaults.descriptive);
          }
        }
        
        // Update experience level from AI extraction
        if (data.experienceLevel) {
          setDetectedExperienceLevel(data.experienceLevel);
        }
        if (data.minYearsExperience !== undefined && data.minYearsExperience !== null) {
          setDetectedMinYears(data.minYearsExperience);
        }

        toast({
          title: "AI Enhancement Complete",
          description: `Extracted ${data.skills?.length || 0} skills and optimized settings for ${data.skillDomain || 'technical'} role.`,
        });
      } catch (error: any) {
        logger.error("Error enhancing with AI:", error);
        toast({
          title: "AI Enhancement Failed",
          description: "Template imported but AI enhancement failed. You can manually extract skills.",
          variant: "destructive",
        });
      } finally {
        setExtractingSkills(false);
      }
    }
  };

  // Fetch interview data when in edit mode
  useEffect(() => {
    if (isEditMode && editInterviewId) {
      fetchInterviewData(editInterviewId);
    }
  }, [editInterviewId, isEditMode]);

  // Auto-populate fields when JD comes from builder
  useEffect(() => {
    const autoPopulateFromBuilder = async () => {
      if (!locationState?.fromBuilder || !locationState?.jobDescription || isEditMode) {
        return;
      }

      // Check if skills were passed from JD Builder - use them directly
      if (locationState.selectedSkills && locationState.selectedSkills.length > 0) {
        logger.info('Using skills from JD Builder instead of re-extracting', { 
          skillCount: locationState.selectedSkills.length 
        });
        
        setSkillExtractionStatus("Using skills from JD Builder...");
        setExtractingSkills(true);

        try {
          // Use the skills from JD Builder
          const selectedSkills = locationState.selectedSkills;
          setExtractedSkills(selectedSkills);
          
          // Auto-add selected skills as topics
          const topSkills = selectedSkills.slice(0, 8);
          const equalPercent = Math.floor(100 / topSkills.length);
          const remainder = 100 - (equalPercent * topSkills.length);
          
          const autoTopics: { [key: string]: number } = {};
          topSkills.forEach((skill: string, index: number) => {
            autoTopics[skill] = equalPercent + (index === 0 ? remainder : 0);
          });
          setTopics(autoTopics);
          
          // Use domain info from navigation state if available
          if (locationState.skillDomain) {
            setSkillDomain(locationState.skillDomain);
          }
          if (locationState.showCoding !== undefined) {
            setShowCoding(locationState.showCoding);
          }
          if (locationState.showDbSchema !== undefined) {
            setShowDbSchema(locationState.showDbSchema);
          }

          setSkillExtractionStatus("Skills loaded from JD Builder!");
          toast({
            title: "Skills Loaded",
            description: `Using ${selectedSkills.length} skills selected in JD Builder.`,
          });
        } finally {
          setExtractingSkills(false);
        }
        return;
      }

      // No skills from JD Builder - extract fresh (for pasted JD flow)
      setExtractingSkills(true);
      setSkillExtractionStatus("Auto-extracting skills from generated JD...");

      try {
        const { data, error } = await invokeFunction('extract-skills', {
          body: { 
            jobTitle: locationState.jobTitle || "Role",
            jobDescription: locationState.jobDescription 
          },
        });

        if (error) throw error;

        // Set extracted skills
        setExtractedSkills(data.skills || []);
        
        // Auto-add extracted skills as topics
        if (data.skills && data.skills.length > 0) {
          const topSkills = data.skills.slice(0, 8); // Top 8 skills as topics
          const equalPercent = Math.floor(100 / topSkills.length);
          const remainder = 100 - (equalPercent * topSkills.length);
          
          const autoTopics: { [key: string]: number } = {};
          topSkills.forEach((skill: string, index: number) => {
            autoTopics[skill] = equalPercent + (index === 0 ? remainder : 0);
          });
          setTopics(autoTopics);
        }
        
        // Update skill domain and defaults
        if (data.skillDomain) {
          setSkillDomain(data.skillDomain);
          setShowCoding(data.showCoding !== false);
          setShowDbSchema(data.showDbSchema === true);
          
          if (data.suggestedDefaults) {
            setMcqPercent(data.suggestedDefaults.mcq);
            setScenarioPercent(data.suggestedDefaults.scenario);
            setCodingPercent(data.suggestedDefaults.coding);
            setDescriptivePercent(data.suggestedDefaults.descriptive);
          }
        }

        setSkillExtractionStatus("Skills extracted successfully!");
        toast({
          title: "Fields Auto-Populated",
          description: `Extracted ${data.skills?.length || 0} skills and configured settings for ${data.skillDomain || 'technical'} role.`,
        });
      } catch (error: any) {
        logger.error("Error auto-extracting skills:", error);
        setSkillExtractionStatus("Auto-extraction failed");
        toast({
          title: "Auto-Population Notice",
          description: "Could not auto-extract skills. You can manually extract them below.",
          variant: "default",
        });
      } finally {
        setExtractingSkills(false);
      }
    };

    autoPopulateFromBuilder();
  }, [locationState?.fromBuilder]);

  // Initialize from template
  useEffect(() => {
    if (locationState?.fromTemplate && !isEditMode) {
      // Apply template settings
      if (locationState.templateName) {
        setTitle(locationState.templateName);
      }
      if (locationState.timeLimit) {
        setTimeLimit(locationState.timeLimit);
      }
      if (locationState.tags && locationState.tags.length > 0) {
        // Add tags as extracted skills
        setExtractedSkills(locationState.tags);
        // Auto-add tags as topics with equal distribution
        const equalPercent = Math.floor(100 / locationState.tags.length);
        const remainder = 100 - (equalPercent * locationState.tags.length);
        const autoTopics: { [key: string]: number } = {};
        locationState.tags.forEach((tag, index) => {
          autoTopics[tag] = equalPercent + (index === 0 ? remainder : 0);
        });
        setTopics(autoTopics);
      }
      
      toast({
        title: "Template Loaded",
        description: `Using "${locationState.templateName}" template. Add job description and customize as needed.`,
      });
    }
  }, [locationState?.fromTemplate]);
  useEffect(() => {
    const isValid = 
      title.trim().length > 0 &&
      jobDescription.trim().length > 0 &&
      questionCount > 0 &&
      Object.keys(topics).length > 0;
    setIsFormValid(isValid);
  }, [title, jobDescription, questionCount, topics]);

  // Auto-adjust coding difficulty based on question count (no easy for <= 20 questions)
  useEffect(() => {
    const smartCodingDifficulty = getSmartCodingDifficulty(questionCount);
    
    // Only auto-adjust if coding difficulty is not already set correctly
    if (categoryDifficulty.coding.easy !== smartCodingDifficulty.easy) {
      setCategoryDifficulty(prev => ({
        ...prev,
        coding: smartCodingDifficulty
      }));
    }
  }, [questionCount]);

  // No auto-save - interview is only saved when user clicks Generate Questions

  const fetchInterviewData = async (interviewId: string) => {
    setFetchingInterview(true);
    try {
      const { data: interview, error: interviewError } = await supabase
        .from("interviews")
        .select("*")
        .eq("id", interviewId)
        .maybeSingle();

      if (interviewError) throw interviewError;

      if (!interview) {
        toast({
          title: "Error",
          description: "Interview not found",
          variant: "destructive",
        });
        navigate('/partner/recruiting/dashboard');
        return;
      }

      // Block editing if questions are approved or pending review
      // Allow reconfiguration if reconfigure=true AND status is needs_changes
      const canReconfigure = isReconfigureMode && interview.questions_status === 'needs_changes';
      
      if (!canReconfigure && (
          interview.questions_status === 'approved' || 
          interview.questions_status === 'pending_review' ||
          interview.questions_status === 'needs_changes')) {
        toast({
          title: "Edit Not Allowed",
          description: interview.questions_status === 'approved' 
            ? "This interview has approved questions. View it in the detail page instead."
            : interview.questions_status === 'pending_review'
            ? "This interview is pending Tech SPOC review. Editing would reset the review process."
            : "This interview needs changes. Use the 'Reconfigure & Regenerate' button from the detail page.",
          variant: "default",
        });
        // Redirect to detail page instead
        const basePath = location.pathname.startsWith('/interviewer') ? '/interviewer' : '/partner/recruiting';
        navigate(`${basePath}/interview/${interviewId}`);
        return;
      }

      // Show info toast when in reconfigure mode
      if (canReconfigure) {
        toast({
          title: "Reconfigure Mode",
          description: "You can update the configuration and regenerate questions. Previous questions will be replaced.",
        });
      }

      // Pre-fill form fields
      setTitle(interview.title || "");
      setJobDescription(interview.job_description || "");
      setQuestionCount(interview.question_count || 10);
      setTimeLimit(interview.time_limit);
      setProctoringEnabled(interview.proctoring_enabled || false);
      setQuestionBankSize(interview.question_bank_size || 100);

      // Set coding schema if exists
      if (interview.coding_schema && typeof interview.coding_schema === 'object') {
        setCodingSchema(interview.coding_schema as Record<string, any>);
      }

      // Set topics from topic_distribution
      if (interview.topic_distribution && typeof interview.topic_distribution === 'object') {
        setTopics(interview.topic_distribution as { [key: string]: number });
      }

      // Note: difficulty_distribution is now derived from category_difficulty_distribution

      // Set question type distribution if exists
      if (interview.question_type_distribution && typeof interview.question_type_distribution === 'object') {
        const typeDist = interview.question_type_distribution as any;
        if (typeDist.mcq !== undefined) setMcqPercent(typeDist.mcq);
        if (typeDist.scenario !== undefined) setScenarioPercent(typeDist.scenario);
        if (typeDist.coding !== undefined) setCodingPercent(typeDist.coding);
        if (typeDist.descriptive !== undefined) setDescriptivePercent(typeDist.descriptive);
      }

      // Set per-category difficulty distribution if exists
      if (interview.category_difficulty_distribution && typeof interview.category_difficulty_distribution === 'object') {
        setCategoryDifficulty(interview.category_difficulty_distribution as unknown as CategoryDifficultyDistribution);
      }

      // Set required question rules if exists
      if (interview.required_question_rules && Array.isArray(interview.required_question_rules)) {
        const rulesWithIds = (interview.required_question_rules as unknown as Array<Omit<RequiredQuestionRule, 'id'>>).map(r => ({
          ...r,
          id: crypto.randomUUID(),
        }));
        setRequiredRules(rulesWithIds as RequiredQuestionRule[]);
      }

      // Set extracted skills if exists
      if (interview.extracted_skills && Array.isArray(interview.extracted_skills)) {
        setExtractedSkills(interview.extracted_skills);
      }

    } catch (error: any) {
      logger.error("Error fetching interview:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load interview",
        variant: "destructive",
      });
      navigate('/partner/recruiting/dashboard');
    } finally {
      setFetchingInterview(false);
    }
  };

  const handleExtractSkills = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Error",
        description: "Please enter a job description first",
        variant: "destructive",
      });
      return;
    }

    setExtractingSkills(true);
    setSkillExtractionStatus("Analyzing role requirements...");

    try {
      setSkillExtractionStatus("Extracting skills from job description...");
      const { data, error } = await invokeFunction('extract-skills', {
        body: { 
          jobTitle: title || "Role",
          jobDescription 
        },
      });

      if (error) throw error;

      setExtractedSkills(data.skills || []);
      setSkillExtractionStatus("Skills extracted successfully!");
      
      // Update skill domain detection from AI response
      if (data.skillDomain) {
        setSkillDomain(data.skillDomain);
        setShowCoding(data.showCoding !== false);
        setShowDbSchema(data.showDbSchema === true);
        
        // Auto-adjust percentages based on domain
        if (data.suggestedDefaults) {
          setMcqPercent(data.suggestedDefaults.mcq);
          setScenarioPercent(data.suggestedDefaults.scenario);
          setCodingPercent(data.suggestedDefaults.coding);
          setDescriptivePercent(data.suggestedDefaults.descriptive);
        }
      }

      toast({
        title: "Skills Extracted!",
        description: `Found ${data.skills.length} skills. Detected role type: ${data.skillDomain || 'technical'}`,
      });
    } catch (error: any) {
      logger.error("Error extracting skills:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to extract skills",
        variant: "destructive",
      });
    } finally {
      setExtractingSkills(false);
    }
  };

  const handleGenerateSchema = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Error",
        description: "Please enter a job description first",
        variant: "destructive",
      });
      return;
    }

    if (!schemaDomain.trim()) {
      toast({
        title: "Error",
        description: "Please enter a business domain (e.g., e-commerce, healthcare)",
        variant: "destructive",
      });
      return;
    }

    setGeneratingSchema(true);

    try {
      const { data, error } = await invokeFunction('generate-schema', {
        body: { 
          jobDescription,
          domain: schemaDomain 
        },
      });

      if (error) throw error;

      if (data?.schema) {
        setCodingSchema(data.schema);
        toast({
          title: "Schema Generated!",
          description: "Database schema created successfully",
        });
      }
    } catch (error: any) {
      logger.error("Error generating schema:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate schema",
        variant: "destructive",
      });
    } finally {
      setGeneratingSchema(false);
    }
  };

  const handleAddTopic = (topic?: string) => {
    const topicToAdd = topic || topicInput.trim();
    if (topicToAdd && !topics[topicToAdd]) {
      const currentTopicCount = Object.keys(topics).length;
      
      if (currentTopicCount === 0) {
        setTopics({ [topicToAdd]: 100 });
      } else {
        const newTopicCount = currentTopicCount + 1;
        const equalPercent = Math.floor(100 / newTopicCount);
        const remainder = 100 - (equalPercent * newTopicCount);
        
        const redistributedTopics: { [key: string]: number } = {};
        const topicKeys = Object.keys(topics);
        
        topicKeys.forEach((key, index) => {
          redistributedTopics[key] = equalPercent + (index === 0 ? remainder : 0);
        });
        redistributedTopics[topicToAdd] = equalPercent;
        
        setTopics(redistributedTopics);
      }
      
      setTopicInput("");
    }
  };

  const handleRemoveTopic = (topicToRemove: string) => {
    const remainingTopics = Object.keys(topics).filter(t => t !== topicToRemove);
    
    if (remainingTopics.length === 0) {
      setTopics({});
      return;
    }

    const equalPercent = Math.floor(100 / remainingTopics.length);
    const remainder = 100 - (equalPercent * remainingTopics.length);
    
    const redistributedTopics: { [key: string]: number } = {};
    remainingTopics.forEach((key, index) => {
      redistributedTopics[key] = equalPercent + (index === 0 ? remainder : 0);
    });
    
    setTopics(redistributedTopics);
  };

  // Handler to add a required question rule
  const handleAddRule = () => {
    // Check if same rule already exists (type + difficulty + topic combination)
    const exists = requiredRules.some(
      r => r.type === newRuleType && r.difficulty === newRuleDifficulty && (r.topic || '') === newRuleTopic
    );
    if (exists) {
      const topicText = newRuleTopic ? ` in ${newRuleTopic}` : '';
      toast({
        title: "Rule already exists",
        description: `A rule for ${newRuleDifficulty} ${newRuleType} questions${topicText} already exists.`,
        variant: "destructive",
      });
      return;
    }
    
    setRequiredRules(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: newRuleType,
        difficulty: newRuleDifficulty,
        min: newRuleMin,
        ...(newRuleTopic ? { topic: newRuleTopic } : {}),
      },
    ]);
    // Reset topic after adding
    setNewRuleTopic('');
  };

  // Handler to remove a required question rule
  const handleRemoveRule = (ruleId: string) => {
    setRequiredRules(prev => prev.filter(r => r.id !== ruleId));
  };

  // Calculate if rules can be satisfied with current configuration
  const getRulesWarnings = (): string[] => {
    const warnings: string[] = [];
    const typePercent: Record<string, number> = {
      mcq: mcqPercent,
      descriptive: descriptivePercent,
      scenario: scenarioPercent,
      coding: showCoding ? codingPercent : 0,
    };

    for (const rule of requiredRules) {
      // Calculate expected questions of this type
      const expectedTypeCount = Math.round((typePercent[rule.type] / 100) * questionCount);
      // Calculate expected questions at this difficulty within the type
      const diffPercent = categoryDifficulty[rule.type as keyof CategoryDifficultyDistribution]?.[rule.difficulty] || 33;
      const expectedDiffCount = Math.round((diffPercent / 100) * expectedTypeCount);
      
      const topicText = rule.topic ? ` in ${rule.topic}` : '';
      if (expectedDiffCount < rule.min) {
        warnings.push(
          `Rule "${rule.min} ${rule.difficulty} ${rule.type}${topicText}" may not be satisfied (expected ~${expectedDiffCount} questions)`
        );
      }
      
      // Additional warning for topic-specific rules - depends on question bank having that topic
      if (rule.topic) {
        const topicInSkills = extractedSkills.some(s => 
          s.toLowerCase().includes(rule.topic!.toLowerCase()) || 
          rule.topic!.toLowerCase().includes(s.toLowerCase())
        );
        if (!topicInSkills && Object.keys(topics).length > 0) {
          warnings.push(
            `Topic "${rule.topic}" not found in extracted skills - ensure questions cover this topic`
          );
        }
      }
    }
    return warnings;
  };

  // Interview is only saved when user clicks Generate Questions (no auto-save)

  const handleGenerateQuestions = async () => {
    setLoading(true);
    try {
      // Calculate overall difficulty from per-category difficulty for backward compatibility
      // typeDistributionPercent is for the edge function, state typeDistribution has absolute counts
      const typeDistributionPercent = {
        mcq: mcqPercent,
        scenario: scenarioPercent,
        coding: codingPercent,
        descriptive: descriptivePercent,
      };
      const difficultyDistribution = categoryToOverallDifficulty(categoryDifficulty, typeDistributionPercent);

      const topicDistribution = topics;

      // Validation
      const validationResult = createInterviewSchema.safeParse({
        title,
        jobDescription,
        questionCount,
        timeLimit,
        difficultyDistribution,
        topicDistribution,
      });

      if (!validationResult.success) {
        toast({
          title: "Validation Error",
          description: validationResult.error.issues.map(e => e.message).join(", "),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to create an interview",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Get user's organization membership
      const { data: orgMembership, error: orgError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (orgError) {
        toast({
          title: "Error",
          description: "Failed to fetch organization membership",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!orgMembership) {
        toast({
          title: "Error",
          description: "You must be part of an organization to create interviews",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const proctoringSettings = proctoringEnabled ? {
        camera: true,
        screen: true,
        voice: true,
        tab_switching: true
      } : null;

      const interviewId = (isEditMode && editInterviewId)
        ? editInterviewId
        : crypto.randomUUID();
      
      // If editing existing interview
      if (isEditMode && editInterviewId) {
        
        const { error: updateError } = await supabase
          .from("interviews")
          .update({
            title,
            job_description: jobDescription,
            question_count: questionCount,
            time_limit: timeLimit,
            proctoring_enabled: proctoringEnabled,
            proctoring_settings: proctoringSettings,
            coding_schema: Object.keys(codingSchema).length > 0 ? codingSchema : null,
            question_bank_size: questionBankSize,
            question_type_distribution: typeDistribution as any,
            category_difficulty_distribution: categoryDifficulty as any,
            required_question_rules: requiredRules.map(({ id, ...rest }) => rest) as any,
            extracted_skills: extractedSkills.length > 0 ? extractedSkills : null,
            topic_distribution: Object.keys(topics).length > 0 ? topics : null,
          })
          .eq('id', editInterviewId);

        if (updateError) throw updateError;

        toast({
          title: "Success",
          description: "Interview updated! Now generating questions...",
        });
      } else {
        // Create new interview draft (set id client-side so we don't depend on RETURNING + RLS)
        
        const { error: interviewError } = await supabase
          .from("interviews")
          .insert({
            id: interviewId,
            creator_id: user.id,
            title,
            job_description: jobDescription,
            question_count: questionCount,
            time_limit: timeLimit,
            organization_id: orgMembership.organization_id,
            status: 'draft',
            proctoring_enabled: proctoringEnabled,
            proctoring_settings: proctoringSettings,
            coding_schema: Object.keys(codingSchema).length > 0 ? codingSchema : null,
            question_bank_size: questionBankSize,
            question_type_distribution: typeDistribution as any,
            category_difficulty_distribution: categoryDifficulty as any,
            required_question_rules: requiredRules.map(({ id, ...rest }) => rest) as any,
            extracted_skills: extractedSkills.length > 0 ? extractedSkills : null,
            topic_distribution: Object.keys(topics).length > 0 ? topics : null,
          });

        if (interviewError) throw interviewError;

        toast({
          title: "Success",
          description: "Interview draft created! Now generating questions...",
        });
      }

      const { error: generateError } = await invokeFunction('generate-questions', {
        body: {
          interviewId,
          jobDescription,
          topics,
          questionCount: questionCount,
          questionBankSize: questionBankSize,
          questionTypeDistribution: typeDistributionPercent,
          difficultyDistribution,
          categoryDifficultyDistribution: categoryDifficulty,
          requiredQuestionRules: requiredRules.map(({ id, ...rest }) => rest),
        },
      });

      if (generateError) {
        throw generateError;
      }

      // Get base path from current location
      const basePath = location.pathname.startsWith('/interviewer') ? '/interviewer' : '/partner/recruiting';

      // Navigate to generation progress page
      navigate(`${basePath}/interview-generation/${interviewId}`);
    } catch (error: any) {
      logger.error("Error generating questions:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate questions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInterview = async () => {
    // Validate basic fields
    if (!title.trim() || title.trim().length < 5) {
      toast({
        title: "Validation Error",
        description: "Title must be at least 5 characters",
        variant: "destructive",
      });
      return;
    }

    if (!jobDescription.trim() || jobDescription.trim().length < 50) {
      toast({
        title: "Validation Error",
        description: "Job description must be at least 50 characters",
        variant: "destructive",
      });
      return;
    }

    if (questionCount < 5 || questionCount > 100) {
      toast({
        title: "Validation Error",
        description: "Question count must be between 5 and 100",
        variant: "destructive",
      });
      return;
    }

    if (timeLimit !== null && (isNaN(timeLimit) || timeLimit < 0 || timeLimit > 180)) {
      toast({
        title: "Validation Error",
        description: "Time limit must be a valid number between 0 and 180 minutes",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to create an interview",
          variant: "destructive",
        });
        return;
      }

      // Check if user is platform_admin (they can operate without org membership)
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

      // Platform admins can proceed without org membership, others need it
      if (!orgMembership && !isPlatformAdmin) {
        toast({
          title: "Error",
          description: "You must be a member of an organization to create interviews",
          variant: "destructive",
        });
        return;
      }

      const totalTypePercent = mcqPercent + scenarioPercent + codingPercent + descriptivePercent;

      if (totalTypePercent !== 100) {
        toast({
          title: "Validation Error",
          description: "Question type percentages must add up to 100%",
          variant: "destructive",
        });
        return;
      }

      const totalTopicPercent = Object.values(topics).reduce((sum, percent) => sum + percent, 0);
      if (totalTopicPercent !== 100) {
        toast({
          title: "Validation Error",
          description: "Topic percentages must add up to 100%",
          variant: "destructive",
        });
        return;
      }

      const proctoringSettings = {
        camera_required: proctoringEnabled,
        screen_recording: proctoringEnabled,
        face_detection: proctoringEnabled,
        voice_detection: proctoringEnabled,
        tab_switch_detection: proctoringEnabled,
        copy_paste_detection: proctoringEnabled,
        multiple_person_detection: proctoringEnabled,
        eye_gaze_tracking: proctoringEnabled,
      };

      let interview;
      
      // Convert absolute counts to percentages for difficulty calculation
      const typeDistributionPercent = {
        mcq: Math.round((typeDistribution.mcq / questionCount) * 100),
        scenario: Math.round((typeDistribution.scenario / questionCount) * 100),
        coding: Math.round((typeDistribution.coding / questionCount) * 100),
        descriptive: Math.round((typeDistribution.descriptive / questionCount) * 100),
      };

      // Calculate overall difficulty from per-category difficulty
      const difficultyDistribution = categoryToOverallDifficulty(categoryDifficulty, typeDistributionPercent);

      if (isEditMode && editInterviewId) {
        // Update existing interview
        const { data: updatedInterview, error: updateError } = await supabase
          .from("interviews")
          .update({
            title,
            job_description: jobDescription,
            question_count: questionCount,
            time_limit: timeLimit,
            proctoring_enabled: proctoringEnabled,
            proctoring_settings: proctoringSettings,
            coding_schema: Object.keys(codingSchema).length > 0 ? codingSchema : null,
            question_bank_size: questionBankSize,
            question_type_distribution: { mcq: typeDistribution.mcq, scenario: typeDistribution.scenario, coding: typeDistribution.coding, descriptive: typeDistribution.descriptive } as any,
            difficulty_distribution: difficultyDistribution as any,
            category_difficulty_distribution: categoryDifficulty as any,
            required_question_rules: requiredRules.map(({ id, ...rest }) => rest) as any,
            extracted_skills: extractedSkills.length > 0 ? extractedSkills : null,
          })
          .eq("id", editInterviewId)
          .select()
          .single();

        if (updateError) throw updateError;
        interview = updatedInterview;

        toast({
          title: "Success",
          description: "Interview draft updated successfully!",
        });
      } else {
        // Create new interview
        const { data: newInterview, error: interviewError } = await supabase
          .from("interviews")
          .insert({
            title,
            job_description: jobDescription,
            question_count: questionCount,
            time_limit: timeLimit,
            creator_id: user.id,
            organization_id: orgMembership.organization_id,
            status: 'draft',
            proctoring_enabled: proctoringEnabled,
            proctoring_settings: proctoringSettings,
            coding_schema: Object.keys(codingSchema).length > 0 ? codingSchema : null,
            question_bank_size: questionBankSize,
            question_type_distribution: { mcq: typeDistribution.mcq, scenario: typeDistribution.scenario, coding: typeDistribution.coding, descriptive: typeDistribution.descriptive } as any,
            difficulty_distribution: difficultyDistribution as any,
            category_difficulty_distribution: categoryDifficulty as any,
            required_question_rules: requiredRules.map(({ id, ...rest }) => rest) as any,
            extracted_skills: extractedSkills.length > 0 ? extractedSkills : null,
            experience_level: detectedExperienceLevel,
            min_years_experience: detectedMinYears,
          })
          .select()
          .single();

        if (interviewError) throw interviewError;
        interview = newInterview;

        toast({
          title: "Success",
          description: "Interview draft created! Now generating questions...",
        });
      }

      // Use the already calculated typeDistributionPercent and difficultyDistribution for generate-questions

      const { error: generateError } = await invokeFunction('generate-questions', {
        body: {
          interviewId: interview.id,
          jobDescription,
          topics,
          questionCount: questionCount,
          questionBankSize: questionBankSize,
          questionTypeDistribution: typeDistributionPercent,
          difficultyDistribution,
          categoryDifficultyDistribution: categoryDifficulty,
          requiredQuestionRules: requiredRules.map(({ id, ...rest }) => rest),
          experienceLevel: detectedExperienceLevel,
          minYearsExperience: detectedMinYears,
        },
      });

      if (generateError) {
        throw generateError;
      }

      // Get base path from current location
      const basePath = location.pathname.startsWith('/interviewer') ? '/interviewer' : '/partner/recruiting';
      
      // Navigate to progress page
      navigate(`${basePath}/interview-progress/${interview.id}`);
    } catch (error: any) {
      logger.error("Error creating interview:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save interview",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-4 sm:py-8">
      <div className="container max-w-4xl mx-auto px-3 sm:px-4">
        {fetchingInterview ? (
          <Card className="border-2">
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-lg font-medium">Loading interview data...</p>
                <p className="text-sm text-muted-foreground mt-2">Please wait</p>
              </div>
            </CardContent>
          </Card>
        ) : (
        <Card className="border-2">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-xl sm:text-3xl font-bold">
                      {isEditMode ? 'Edit Interview Draft' : 'Create Interview'}
                    </CardTitle>
                    {locationState?.fromTemplate && (
                      <Badge variant="secondary" className="text-xs">
                        From Template
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm">
                    {locationState?.fromTemplate
                      ? `Using "${locationState.templateName}" template - customize as needed`
                      : isEditMode 
                        ? 'Update your interview configuration and activate when ready' 
                        : 'Configure your AI-powered technical interview'}
                  </CardDescription>
                </div>
                <TemplateActions 
                  onExportClick={() => setExportDialogOpen(true)} 
                  onImportClick={() => setImportDialogOpen(true)} 
                />
              </div>
            </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-6">
              {/* Interview Details */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Interview Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      updateDifficultyFromRole(e.target.value);
                    }}
                    placeholder="e.g., Senior Frontend Developer Interview"
                  />
                </div>

                <div>
                  <Label htmlFor="jobDescription">Job Description</Label>
                  <Textarea
                    id="jobDescription"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the complete job description here..."
                    rows={8}
                  />
                  <Button
                    type="button"
                    onClick={handleExtractSkills}
                    disabled={extractingSkills || !jobDescription.trim()}
                    className="mt-2"
                    variant="outline"
                  >
                    {extractingSkills ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {skillExtractionStatus}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Extract Skills with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Topics */}
              <div className="space-y-4">
                <Label>Topics & Skills</Label>
                
                {/* Show extracted skills as clickable badges */}
                {extractedSkills.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Extracted Skills (click to add):
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {extractedSkills.map((skill) => (
                        <Badge
                          key={skill}
                          variant={topics[skill] !== undefined ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleAddTopic(skill)}
                        >
                          {skill}
                          {topics[skill] !== undefined && <span className="ml-1">✓</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTopic()}
                    placeholder="Add a topic or skill"
                  />
                  <Button type="button" onClick={() => handleAddTopic()} variant="outline">
                    Add
                  </Button>
                </div>
                
                {/* Display selected topics with sliders */}
                {Object.keys(topics).length > 0 && (
                  <>
                    <div className="space-y-4 mt-4">
                      {Object.entries(topics).map(([topic, percent]) => (
                        <div key={topic} className="space-y-2 p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between">
                            <Label className="font-medium">{topic}</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold min-w-[45px] text-right">{percent}%</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRemoveTopic(topic)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <Slider
                            value={[percent]}
                            onValueChange={([v]) => {
                              const newTopics = { ...topics, [topic]: v };
                              setTopics(newTopics);
                            }}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Total: {Object.values(topics).reduce((a, b) => a + b, 0)}% 
                      {Object.values(topics).reduce((a, b) => a + b, 0) !== 100 && (
                        <span className="text-warning ml-2">⚠️ Should total 100%</span>
                      )}
                    </p>
                  </>
                )}
              </div>

              {/* Question Configuration */}
              <div className="space-y-4 p-3 sm:p-4 rounded-lg border bg-muted/20">
                <Label className="text-sm sm:text-base font-semibold">Question Configuration</Label>
                
                <div>
                  <Label>Number of Questions per Interview</Label>
                  <Select
                    value={questionCount.toString()}
                    onValueChange={(value) => {
                      const newCount = parseInt(value);
                      const oldCount = questionCount;
                      setQuestionCount(newCount);
                      
                      // Proportionally scale type distribution to match new question count
                      if (oldCount > 0 && newCount !== oldCount) {
                        setTypeDistribution(prev => {
                          const ratio = newCount / oldCount;
                          const scaled = {
                            mcq: Math.round(prev.mcq * ratio),
                            scenario: Math.round(prev.scenario * ratio),
                            coding: Math.round(prev.coding * ratio),
                            descriptive: Math.round(prev.descriptive * ratio),
                          };
                          // Adjust to match exactly (due to rounding)
                          const total = scaled.mcq + scaled.scenario + scaled.coding + scaled.descriptive;
                          if (total !== newCount) {
                            scaled.mcq += newCount - total; // Adjust MCQ to balance
                          }
                          return scaled;
                        });
                      }
                      
                      // Auto-adjust question bank size if needed
                      if (newCount > questionBankSize) {
                        setQuestionBankSize(Math.min(newCount * 10, 500));
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select number of questions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="15">15 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                      <SelectItem value="25">25 Questions</SelectItem>
                      <SelectItem value="30">30 Questions</SelectItem>
                      <SelectItem value="40">40 Questions</SelectItem>
                      <SelectItem value="50">50 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    How many questions each candidate will answer
                  </p>
                </div>

                <div>
                  <Label>Question Bank Size</Label>
                  <Select
                    value={questionBankSize.toString()}
                    onValueChange={(value) => {
                      const newSize = parseInt(value);
                      setQuestionBankSize(newSize);
                      // Auto-adjust question count if bank size is smaller
                      if (questionCount > newSize) {
                        setQuestionCount(newSize);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select question bank size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 Questions</SelectItem>
                      <SelectItem value="100">100 Questions</SelectItem>
                      <SelectItem value="150">150 Questions</SelectItem>
                      <SelectItem value="200">200 Questions (Recommended)</SelectItem>
                      <SelectItem value="250">250 Questions</SelectItem>
                      <SelectItem value="300">300 Questions</SelectItem>
                      <SelectItem value="400">400 Questions</SelectItem>
                      <SelectItem value="500">500 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total questions generated. Larger bank enables unique questions per candidate.
                    {questionBankSize > 200 && (
                      <span className="block text-yellow-600 dark:text-yellow-500 mt-1">
                        ⚠️ Large question banks (200+) may take longer and occasionally fail. Consider using 100-200 for optimal reliability.
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <Label>Time Limit (minutes)</Label>
                  <Input
                    type="number"
                    value={timeLimit === null ? "" : timeLimit}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      setTimeLimit(value === "" ? null : parseInt(value));
                    }}
                    placeholder="No limit"
                  />
                </div>
              </div>

              {/* Skill Domain Detection Badge */}
              {skillDomain && (
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Detected Role Type</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="capitalize">
                        {skillDomain.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {showCoding ? 'Coding questions enabled' : 'No coding questions'}
                        {showDbSchema && ' • DB Schema enabled'}
                      </span>
                    </div>
                  </div>
                  <Select 
                    value={skillDomain} 
                    onValueChange={(value) => {
                      setSkillDomain(value);
                      setShowCoding(!['non_technical'].includes(value));
                      setShowDbSchema(['database', 'fullstack', 'data_science'].includes(value));
                      if (value === 'non_technical') {
                        setCodingPercent(0);
                        setMcqPercent(50);
                        setScenarioPercent(30);
                        setDescriptivePercent(20);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="backend">Backend</SelectItem>
                      <SelectItem value="frontend">Frontend</SelectItem>
                      <SelectItem value="fullstack">Full Stack</SelectItem>
                      <SelectItem value="devops">DevOps</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="data_science">Data Science</SelectItem>
                      <SelectItem value="non_technical">Non-Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Question Types - Number Inputs */}
              <div className="space-y-4 p-3 sm:p-4 rounded-lg border bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-sm sm:text-base font-semibold">Question Type Distribution</Label>
                </div>
                <QuestionTypeInputs
                  typeDistribution={typeDistribution}
                  questionCount={questionCount}
                  typeTotal={typeTotal}
                  showCoding={showCoding}
                  onTypeChange={handleTypeCountChange}
                />
                {showCoding && typeDistribution.coding > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const counts = calculateCodingQuestionCounts(questionCount, codingPercent, categoryDifficulty.coding);
                      return `→ ${counts.total} coding questions: ${counts.medium} medium, ${counts.hard} hard${questionCount > 20 && counts.easy > 0 ? `, ${counts.easy} easy` : ''}`;
                    })()}
                  </p>
                )}
              </div>

              {/* Advanced Options - Per-Category Difficulty Distribution */}
              <Collapsible 
                open={advancedOptionsOpen} 
                onOpenChange={setAdvancedOptionsOpen}
                className="rounded-lg border bg-muted/20"
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/30 transition-colors rounded-lg">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${advancedOptionsOpen ? 'rotate-180' : ''}`} />
                    <span className="font-semibold">Advanced Options</span>
                    <Badge variant="secondary" className="text-xs font-normal">Difficulty Distribution</Badge>
                    {title && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {detectExperienceLevel(title)}-level defaults
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {advancedOptionsOpen ? 'Click to collapse' : 'Click to customize difficulty'}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Difficulty is auto-populated based on job title seniority. Override below if needed.
                    {title && (
                      <span className="ml-1 text-primary">
                        Detected: <strong className="capitalize">{detectExperienceLevel(title)}</strong> level
                      </span>
                    )}
                  </p>
                  
                  <CategoryDifficultyInputs
                    categoryDifficulty={percentsToCounts(categoryDifficulty, typeDistribution)}
                    typeDistribution={typeDistribution}
                    showCoding={showCoding}
                    onChange={(category, difficulty, value) => {
                      // Update the count directly, then convert back to percentages for storage
                      const currentCounts = percentsToCounts(categoryDifficulty, typeDistribution);
                      const newCounts = {
                        ...currentCounts,
                        [category]: { ...currentCounts[category], [difficulty]: value }
                      };
                      setCategoryDifficulty(countsToPercents(newCounts, typeDistribution));
                    }}
                  />
                  
                  {questionCount <= 20 && categoryDifficulty.coding.easy > 0 && typeDistribution.coding > 0 && (
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
                        Easy coding questions are auto-disabled for ≤20 questions. They will be set to 0.
                      </AlertDescription>
                    </Alert>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Required Question Rules (Optional) - Collapsible */}
              <Collapsible className="rounded-lg border bg-muted/20">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/30 transition-colors rounded-lg">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    <span className="font-semibold">Required Question Rules</span>
                    <Badge variant="secondary" className="text-xs font-normal">Optional</Badge>
                    {requiredRules.length > 0 && (
                      <Badge variant="outline" className="ml-2">{requiredRules.length} rule(s)</Badge>
                    )}
                    {getRulesWarnings().length > 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-500">
                        {getRulesWarnings().length} warning(s)
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Define minimum requirements (e.g., "At least 1 hard coding question"). Best-effort enforcement. 
                    Skip this section to use percentage-based distribution only.
                  </p>

                  {/* Existing rules */}
                  {requiredRules.length > 0 && (
                    <div className="space-y-2">
                      {requiredRules.map((rule) => (
                        <div 
                          key={rule.id} 
                          className="flex items-center justify-between p-3 rounded-lg border bg-background"
                        >
                          <span className="text-sm font-medium">
                            At least <span className="text-primary">{rule.min}</span>{' '}
                            <span className="capitalize">{rule.difficulty}</span>{' '}
                            <span className="uppercase">{rule.type}</span>
                            {rule.topic && (
                              <span className="text-muted-foreground"> in <Badge variant="outline" className="ml-1 text-xs">{rule.topic}</Badge></span>
                            )}
                            {' '}question{rule.min > 1 ? 's' : ''}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleRemoveRule(rule.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {getRulesWarnings().length > 0 && (
                    <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
                        {getRulesWarnings().map((warning, i) => (
                          <div key={i}>{warning}</div>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Add new rule */}
                  <div className="flex flex-wrap gap-2 items-end p-3 rounded-lg border bg-muted/30">
                    <div className="flex-1 min-w-[100px]">
                      <Label className="text-xs">Type</Label>
                      <Select value={newRuleType} onValueChange={(v) => setNewRuleType(v as any)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">MCQ</SelectItem>
                          <SelectItem value="descriptive">Descriptive</SelectItem>
                          <SelectItem value="scenario">Scenario</SelectItem>
                          {showCoding && <SelectItem value="coding">Coding</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <Label className="text-xs">Difficulty</Label>
                      <Select value={newRuleDifficulty} onValueChange={(v) => setNewRuleDifficulty(v as any)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs">Topic (Optional)</Label>
                      <Select 
                        value={newRuleTopic || "__any__"} 
                        onValueChange={(v) => setNewRuleTopic(v === "__any__" ? "" : v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Any topic" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__any__">Any topic</SelectItem>
                          {/* Show only extracted skills from job description */}
                          {extractedSkills.map(skill => (
                            <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-[80px]">
                      <Label className="text-xs">Min Count</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        max={questionCount}
                        value={newRuleMin}
                        onChange={(e) => setNewRuleMin(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-9"
                      />
                    </div>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={handleAddRule}
                      className="h-9"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Rule
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Coding Questions Schema (Optional) - Only shown for database/fullstack/data roles */}
              {showDbSchema && (
              <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-base font-semibold">Coding Questions Database Schema (Optional)</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Generate a database schema for SQL coding questions, or define your own.
                  </p>
                  
                  {/* Domain Input + Generate Button */}
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <Input
                        placeholder="Business domain (e.g., e-commerce, healthcare, HR)"
                        value={schemaDomain}
                        onChange={(e) => setSchemaDomain(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleGenerateSchema}
                      disabled={generatingSchema || !jobDescription.trim()}
                      variant="secondary"
                      className="shrink-0"
                    >
                      {generatingSchema ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Schema
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Schema JSON Textarea */}
                  <Textarea
                    placeholder='Example: {"users": {"description": "User accounts table", "columns": ["id", "name", "email"]}, "orders": {"description": "Customer orders", "columns": ["id", "user_id", "amount"]}}'
                    value={Object.keys(codingSchema).length > 0 ? JSON.stringify(codingSchema, null, 2) : ""}
                    onChange={(e) => {
                      try {
                        const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                        setCodingSchema(parsed);
                      } catch (err) {
                        // Invalid JSON, ignore
                      }
                    }}
                    rows={8}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    AI will use configured provider from AI Configuration, or AI Gateway as fallback
                  </p>
                </div>
              </div>
              )}

              {/* Proctoring */}
              <div className="flex items-center space-x-2 p-4 rounded-lg border bg-muted/20">
                <Checkbox
                  id="proctoring"
                  checked={proctoringEnabled}
                  onCheckedChange={(checked) => setProctoringEnabled(checked as boolean)}
                />
                <Label htmlFor="proctoring" className="cursor-pointer">
                  Enable AI Proctoring (camera, screen, voice monitoring)
                </Label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <SaveAsTemplateDialog
                  defaultValues={{
                    name: title ? `${title} Template` : '',
                    role_type: title || '',
                    seniority_level: 'mid',
                    recommended_time_limit: timeLimit || 60,
                    question_distribution: {
                      mcq: mcqPercent,
                      scenario: scenarioPercent,
                      coding: codingPercent,
                      descriptive: descriptivePercent,
                    },
                    tags: extractedSkills.slice(0, 5),
                  }}
                  onSuccess={handleTemplateSaved}
                  trigger={
                    <Button
                      variant="outline"
                      className="sm:flex-1"
                      size="lg"
                      disabled={isTemplateSaveDisabled}
                    >
                      <BookTemplate className="h-5 w-5 mr-2" />
                      {savedConfigSnapshot !== null && savedConfigSnapshot === currentConfigSnapshot 
                        ? 'Template Saved' 
                        : 'Save as Template'}
                    </Button>
                  }
                />
                <Button
                  onClick={handleGenerateQuestions}
                  disabled={loading || fetchingInterview || !isFormValid}
                  className="sm:flex-[2]"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate Questions
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
      
      {/* Template Dialogs */}
      <ExportTemplateDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExportTemplate}
      />
      <ImportTemplateDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImportTemplate}
      />
    </div>
  );
};

export default CreateInterview;
