import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Slider import removed - using number inputs instead
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, RefreshCw, Shuffle, Clock, CheckCircle2, Settings, Save, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  topic: string;
  options?: unknown;
  correct_answer?: string;
}

interface SampleInterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  questionCount: number;
  questionBankSize: number;
  questionTypeDistribution?: Record<string, number>;
  difficultyDistribution?: Record<string, number>;
  timeLimit?: number;
  onConfigSaved?: () => void;
  isApproved?: boolean; // When true, configuration is read-only
}

interface RequiredQuestionRule {
  type: string;
  topic: string;
  difficulty: string;
  min: number;
}

// Helper to select questions matching distribution AND required rules
// Required rules are a SUBSET of the type distribution, not in addition to it
function selectQuestionsWithDistribution(
  allQuestions: Question[],
  targetCount: number,
  typeDistribution: Record<string, number>,
  difficultyDistribution: Record<string, number>,
  requiredRules: RequiredQuestionRule[] = []
): Question[] {
  const selected: Question[] = [];
  const used = new Set<string>();
  
  // Track how many questions of each type were selected from required rules
  const selectedByType: Record<string, number> = {};

  // FIRST: Fulfill required question rules (these count towards type quotas)
  for (const rule of requiredRules) {
    const matchingQuestions = allQuestions.filter(
      q => q.question_type === rule.type &&
           q.topic?.toLowerCase() === rule.topic?.toLowerCase() &&
           q.difficulty === rule.difficulty &&
           !used.has(q.id)
    );

    const shuffled = [...matchingQuestions].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, rule.min);

    for (const q of picked) {
      selected.push(q);
      used.add(q.id);
      // Track that this type got a question from rules
      selectedByType[q.question_type] = (selectedByType[q.question_type] || 0) + 1;
    }
  }

  // Calculate REMAINING slots per type after required rules
  // Required rules fulfill part of the type quota, not add to it
  const remainingByType: Record<string, number> = {};
  for (const [type, configuredCount] of Object.entries(typeDistribution)) {
    const alreadySelected = selectedByType[type] || 0;
    remainingByType[type] = Math.max(0, configuredCount - alreadySelected);
  }

  // For each question type, fill remaining slots respecting difficulty distribution
  for (const [type, remainingCount] of Object.entries(remainingByType)) {
    if (remainingCount <= 0) continue;

    const typeQuestions = allQuestions.filter(
      q => q.question_type === type && !used.has(q.id)
    );

    // Calculate difficulty counts for this type's remaining slots
    const diffTotal = Object.values(difficultyDistribution).reduce((a, b) => a + b, 0);
    const diffCounts: Record<string, number> = {};
    for (const [diff, pct] of Object.entries(difficultyDistribution)) {
      diffCounts[diff] = Math.round((pct / diffTotal) * remainingCount);
    }

    // Adjust for rounding errors
    const totalDiffCounts = Object.values(diffCounts).reduce((a, b) => a + b, 0);
    if (totalDiffCounts < remainingCount) {
      diffCounts['medium'] = (diffCounts['medium'] || 0) + (remainingCount - totalDiffCounts);
    } else if (totalDiffCounts > remainingCount) {
      // Reduce from the largest bucket
      const largest = Object.entries(diffCounts).sort((a, b) => b[1] - a[1])[0];
      if (largest) diffCounts[largest[0]] -= (totalDiffCounts - remainingCount);
    }

    // Select questions for each difficulty
    for (const [diff, diffCount] of Object.entries(diffCounts)) {
      if (diffCount <= 0) continue;

      const diffQuestions = typeQuestions.filter(
        q => q.difficulty === diff && !used.has(q.id)
      );

      // Shuffle and pick
      const shuffled = [...diffQuestions].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, diffCount);

      for (const q of picked) {
        selected.push(q);
        used.add(q.id);
      }
    }

    // If we couldn't fill all slots with exact difficulty matches, fill with any remaining of this type
    const currentTypeCount = selected.filter(s => s.question_type === type).length;
    const targetTypeCount = (typeDistribution[type] || 0);
    if (currentTypeCount < targetTypeCount) {
      const remaining = typeQuestions.filter(q => !used.has(q.id));
      const shuffled = [...remaining].sort(() => Math.random() - 0.5);
      const needed = targetTypeCount - currentTypeCount;
      const picked = shuffled.slice(0, needed);
      for (const q of picked) {
        selected.push(q);
        used.add(q.id);
      }
    }
  }

  // If we still need more questions (distribution couldn't be satisfied), fill randomly
  if (selected.length < targetCount) {
    const remaining = allQuestions.filter(q => !used.has(q.id));
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    const needed = targetCount - selected.length;
    const picked = shuffled.slice(0, needed);
    for (const q of picked) {
      selected.push(q);
      used.add(q.id);
    }
  }

  // Sort by question type order: MCQ → Descriptive → Scenario → Coding
  const typeOrder: Record<string, number> = { mcq: 0, descriptive: 1, scenario: 2, coding: 3 };
  return selected.sort((a, b) => (typeOrder[a.question_type] ?? 4) - (typeOrder[b.question_type] ?? 4));
}

export function SampleInterviewModal({
  open,
  onOpenChange,
  interviewId,
  questionCount: initialQuestionCount,
  questionBankSize,
  questionTypeDistribution: initialTypeDistribution,
  difficultyDistribution: initialDifficultyDistribution,
  timeLimit: initialTimeLimit = 60,
  onConfigSaved,
  isApproved = false,
}: SampleInterviewModalProps) {
  const { toast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampleQuestions, setSampleQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [requiredRules, setRequiredRules] = useState<RequiredQuestionRule[]>([]);
  const [sampleNumber, setSampleNumber] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Check if distribution is missing (error state)
  const hasDistributionError = !initialTypeDistribution || !initialDifficultyDistribution;
  
  // Editable configuration state - use empty objects as fallback to prevent crashes
  const [questionCount, setQuestionCount] = useState(initialQuestionCount);
  const [timeLimit, setTimeLimit] = useState(initialTimeLimit);
  const [typeDistribution, setTypeDistribution] = useState<Record<string, number>>(
    initialTypeDistribution || { mcq: 0, scenario: 0, coding: 0, descriptive: 0 }
  );
  const [difficultyDistribution, setDifficultyDistribution] = useState<Record<string, number>>(
    initialDifficultyDistribution || { easy: 0, medium: 0, hard: 0 }
  );

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuestionCount(initialQuestionCount);
      setTimeLimit(initialTimeLimit);
      setTypeDistribution(initialTypeDistribution || { mcq: 0, scenario: 0, coding: 0, descriptive: 0 });
      setDifficultyDistribution(initialDifficultyDistribution || { easy: 0, medium: 0, hard: 0 });
      setHasChanges(false);
      setSampleNumber(1);
      fetchQuestionsAndGenerateSample();
    }
  }, [open, interviewId]);

  // Track changes
  useEffect(() => {
    const typeChanged = JSON.stringify(typeDistribution) !== JSON.stringify(initialTypeDistribution);
    const diffChanged = JSON.stringify(difficultyDistribution) !== JSON.stringify(initialDifficultyDistribution);
    const countChanged = questionCount !== initialQuestionCount;
    const timeLimitChanged = timeLimit !== initialTimeLimit;
    setHasChanges(typeChanged || diffChanged || countChanged || timeLimitChanged);
  }, [questionCount, timeLimit, typeDistribution, difficultyDistribution, initialQuestionCount, initialTimeLimit, initialTypeDistribution, initialDifficultyDistribution]);

  const fetchQuestionsAndGenerateSample = async () => {
    setLoading(true);
    try {
      // Fetch both questions and interview required_question_rules in parallel
      const [questionsResult, interviewResult] = await Promise.all([
        supabase
          .from("questions")
          .select("id, question_text, question_type, difficulty, topic, options, correct_answer")
          .eq("interview_id", interviewId),
        supabase
          .from("interviews")
          .select("required_question_rules")
          .eq("id", interviewId)
          .single()
      ]);

      if (questionsResult.error) throw questionsResult.error;

      const questions = questionsResult.data || [];
      setAllQuestions(questions);

      // Parse required_question_rules
      const rules: RequiredQuestionRule[] = [];
      if (interviewResult.data?.required_question_rules) {
        const rawRules = interviewResult.data.required_question_rules as any[];
        for (const rule of rawRules) {
          if (rule.type && rule.topic && rule.difficulty && rule.min) {
            rules.push({
              type: rule.type,
              topic: rule.topic,
              difficulty: rule.difficulty,
              min: Number(rule.min)
            });
          }
        }
      }
      setRequiredRules(rules);

      if (questions.length === 0) {
        toast({
          title: "No Questions",
          description: "This interview has no questions in the bank yet.",
          variant: "destructive",
        });
        return;
      }

      generateSample(questions, rules);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch questions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSample = (questions: Question[] = allQuestions, rules: RequiredQuestionRule[] = requiredRules) => {
    if (questions.length === 0) return;

    const sample = selectQuestionsWithDistribution(
      questions,
      Math.min(questionCount, questions.length),
      typeDistribution,
      difficultyDistribution,
      rules
    );

    setSampleQuestions(sample);
    setSampleNumber(prev => prev + 1);
  };

  const handleRegenerate = () => {
    generateSample();
    toast({
      title: "New Sample Generated",
      description: `Sample #${sampleNumber} created with ${Math.min(questionCount, allQuestions.length)} questions.`,
    });
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("interviews")
        .update({
          question_count: questionCount,
          time_limit: timeLimit,
          question_type_distribution: typeDistribution,
          difficulty_distribution: difficultyDistribution,
        })
        .eq("id", interviewId);

      if (error) throw error;

      toast({
        title: "Configuration Saved",
        description: "Interview settings updated. Future candidates will receive questions based on this configuration.",
      });

      setHasChanges(false);
      onConfigSaved?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Keys for iteration (fixed order)
  const typeKeys = Object.keys(typeDistribution);
  const diffKeys = Object.keys(difficultyDistribution);

  // Calculate totals for number inputs
  const typeDistributionTotal = Object.values(typeDistribution).reduce((a, b) => a + b, 0);
  const difficultyDistributionTotal = Object.values(difficultyDistribution).reduce((a, b) => a + b, 0);

  // Handle type count change with auto-adjustment of last field
  const handleTypeCountChange = (type: string, value: number, isLast: boolean) => {
    const newDistribution = { ...typeDistribution, [type]: value };
    
    if (!isLast) {
      // Auto-adjust last field to fill remaining
      const lastKey = typeKeys[typeKeys.length - 1];
      const otherTotal = Object.entries(newDistribution)
        .filter(([k]) => k !== lastKey)
        .reduce((sum, [, v]) => sum + v, 0);
      const remaining = Math.max(0, questionCount - otherTotal);
      newDistribution[lastKey] = remaining;
    }
    
    setTypeDistribution(newDistribution);
  };

  // Handle difficulty count change with auto-adjustment of last field
  const handleDifficultyCountChange = (diff: string, value: number, isLast: boolean) => {
    const newDistribution = { ...difficultyDistribution, [diff]: value };
    
    if (!isLast) {
      // Auto-adjust last field to fill remaining
      const lastKey = diffKeys[diffKeys.length - 1];
      const otherTotal = Object.entries(newDistribution)
        .filter(([k]) => k !== lastKey)
        .reduce((sum, [, v]) => sum + v, 0);
      const remaining = Math.max(0, questionCount - otherTotal);
      newDistribution[lastKey] = remaining;
    }
    
    setDifficultyDistribution(newDistribution);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'hard':
        return 'bg-red-500/20 text-red-700 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mcq':
        return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'scenario':
        return 'bg-purple-500/20 text-purple-700 border-purple-500/30';
      case 'coding':
        return 'bg-orange-500/20 text-orange-700 border-orange-500/30';
      case 'descriptive':
        return 'bg-teal-500/20 text-teal-700 border-teal-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Calculate distribution summary for preview
  const distributionSummary = {
    types: {} as Record<string, number>,
    difficulties: {} as Record<string, number>,
  };
  
  sampleQuestions.forEach(q => {
    distributionSummary.types[q.question_type] = (distributionSummary.types[q.question_type] || 0) + 1;
    distributionSummary.difficulties[q.difficulty] = (distributionSummary.difficulties[q.difficulty] || 0) + 1;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90svh] sm:h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            Sample Interview Preview
            <Badge variant="outline" className="ml-2">
              Sample #{sampleNumber - 1 || 1}
            </Badge>
            {isApproved && (
              <Badge variant="default" className="ml-2 bg-green-500/20 text-green-700">
                Approved
              </Badge>
            )}
            {hasChanges && !isApproved && (
              <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-700">
                Unsaved Changes
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isApproved 
              ? "This interview configuration is approved and cannot be modified."
              : "Preview what candidates will see. Adjust the configuration below and save to apply to future invites."
            }
          </DialogDescription>
        </DialogHeader>

        {/* Distribution Error Alert */}
        {hasDistributionError && (
          <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive">
            <p className="font-medium">Configuration Error</p>
            <p className="text-sm">Question type or difficulty distribution is not set for this interview. Please configure it during interview creation.</p>
          </div>
        )}

        {/* Configuration Panel */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Interview Configuration
              </span>
              {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid gap-6 p-4 border rounded-lg bg-muted/30">
              {/* Approved Notice */}
              {isApproved && (
                <div className="p-3 border border-green-500/30 rounded-lg bg-green-500/10 text-green-700 text-sm">
                  <p className="font-medium">Configuration Locked</p>
                  <p>This interview is approved. Configuration cannot be modified.</p>
                </div>
              )}
              
              {/* Basic Settings Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="questionCount">Questions per Interview</Label>
                  <Input
                    id="questionCount"
                    type="number"
                    min={1}
                    max={questionBankSize}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(1, Math.min(questionBankSize, parseInt(e.target.value) || 1)))}
                    disabled={isApproved}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max: {questionBankSize} (bank size)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    min={5}
                    max={300}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Math.max(5, Math.min(300, parseInt(e.target.value) || 60)))}
                    disabled={isApproved}
                  />
                </div>
              </div>

              {/* Question Type Distribution - Number Inputs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Questions by Type</Label>
                  <span className={`text-xs ${typeDistributionTotal > allQuestions.length ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    Per Interview: {typeDistributionTotal} / Bank: {allQuestions.length}
                    {typeDistributionTotal <= allQuestions.length && ' ✓'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {typeKeys.map((type, index) => (
                    <div key={type} className="space-y-1">
                      <Label htmlFor={`type-${type}`} className="text-xs capitalize">{type}</Label>
                      <Input
                        id={`type-${type}`}
                        type="number"
                        min={0}
                        max={questionCount}
                        value={typeDistribution[type] || 0}
                        onChange={(e) => handleTypeCountChange(type, parseInt(e.target.value) || 0, index === typeKeys.length - 1)}
                        className="h-9"
                        disabled={isApproved}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Difficulty Distribution - Number Inputs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Questions by Difficulty</Label>
                  <span className={`text-xs ${difficultyDistributionTotal > allQuestions.length ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    Per Interview: {difficultyDistributionTotal} / Bank: {allQuestions.length}
                    {difficultyDistributionTotal <= allQuestions.length && ' ✓'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {diffKeys.map((diff, index) => (
                    <div key={diff} className="space-y-1">
                      <Label htmlFor={`diff-${diff}`} className="text-xs capitalize">{diff}</Label>
                      <Input
                        id={`diff-${diff}`}
                        type="number"
                        min={0}
                        max={questionCount}
                        value={difficultyDistribution[diff] || 0}
                        onChange={(e) => handleDifficultyCountChange(diff, parseInt(e.target.value) || 0, index === diffKeys.length - 1)}
                        className="h-9"
                        disabled={isApproved}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Apply & Save Button - Hidden when approved */}
              {!isApproved && (
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Preview with New Config
                  </Button>
                  <Button size="sm" onClick={handleSaveConfig} disabled={saving || !hasChanges}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save for Future Candidates
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Summary Stats */}
        <div className="flex flex-wrap gap-4 py-3 border-b">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Time Limit:</span>
            <span className="font-medium">{timeLimit} min</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Questions:</span>
            <span className="font-medium">{sampleQuestions.length}</span>
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-muted-foreground">Types:</span>
            {Object.entries(distributionSummary.types).map(([type, count]) => (
              <Badge key={type} variant="outline" className={getTypeColor(type)}>
                {type}: {count}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-muted-foreground">Difficulty:</span>
            {Object.entries(distributionSummary.difficulties).map(([diff, count]) => (
              <Badge key={diff} variant="outline" className={getDifficultyColor(diff)}>
                {diff}: {count}
              </Badge>
            ))}
          </div>
        </div>

        {/* Questions List */}
        <ScrollArea className="flex-1 min-h-0 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sampleQuestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No questions available. Generate questions first.
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {sampleQuestions.map((q, index) => (
                <Card key={q.id} className="border-l-4" style={{ borderLeftColor: `hsl(var(--${q.question_type === 'mcq' ? 'primary' : q.question_type === 'coding' ? 'destructive' : 'secondary'}))` }}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className={getTypeColor(q.question_type)}>
                            {q.question_type}
                          </Badge>
                          <Badge variant="outline" className={getDifficultyColor(q.difficulty)}>
                            {q.difficulty}
                          </Badge>
                          {q.topic && (
                            <Badge variant="outline" className="text-xs">
                              {q.topic}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium line-clamp-3">{q.question_text}</p>
                        
                        {/* Show options for MCQ */}
                        {q.question_type === 'mcq' && q.options && Array.isArray(q.options) && (
                          <div className="mt-2 space-y-1">
                            {(q.options as string[]).map((opt: string, optIdx: number) => (
                              <div 
                                key={optIdx} 
                                className={`text-xs px-2 py-1 rounded ${opt === q.correct_answer ? 'bg-green-500/20 text-green-700 font-medium' : 'bg-muted text-muted-foreground'}`}
                              >
                                {String.fromCharCode(65 + optIdx)}. {opt}
                                {opt === q.correct_answer && ' ✓'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Each candidate receives a unique random selection from the question bank.
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleRegenerate} disabled={loading || allQuestions.length === 0}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Generate Another Sample
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
