import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, CheckCircle2, Clock, Zap, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { logger } from "@/lib/logger";

interface InterviewGenerationProgressProps {
  interviewId: string;
  questionBankSize: number;
  onComplete?: () => void;
}

export const InterviewGenerationProgress = ({ 
  interviewId, 
  questionBankSize,
  onComplete 
}: InterviewGenerationProgressProps) => {
  const navigate = useNavigate();
  const { toast, errorToast } = useUserFriendlyToast();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'generating' | 'completed' | 'failed'>('generating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Detect user role based on current path
  const isPartnerRole = window.location.pathname.includes('/partner');
  const basePath = isPartnerRole ? '/partner/recruiting' : '/interviewer';

  // Estimated time based on question bank size (roughly 2 seconds per question in batches)
  const estimatedTime = Math.ceil((questionBankSize / 50) * 20); // 20 seconds per batch

  // Tips to show during generation
  const generationTips = [
    "AI is analyzing your job description to create relevant questions",
    "Questions are being balanced across difficulty levels",
    "Creating a mix of MCQ, scenario-based, coding, and descriptive questions",
    "Each question is tailored to assess specific skills",
    "Questions are being validated for clarity and accuracy",
    "Building a comprehensive question bank for candidate assessment"
  ];

  const [currentTip, setCurrentTip] = useState(0);

  // Rotate tips every 5 seconds
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % generationTips.length);
    }, 5000);

    return () => clearInterval(tipInterval);
  }, []);

  // Track elapsed time
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Poll for status
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout;

    const checkStatus = async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select('generation_status, generation_error')
        .eq('id', interviewId)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        logger.error('Error checking status:', error);
        return;
      }

      if (data.generation_status === 'completed') {
        setStatus('completed');
        setProgress(100);
        if (onComplete) {
          setTimeout(onComplete, 1500);
        }
      } else if (data.generation_status === 'failed') {
        setStatus('failed');
        setErrorMessage(data.generation_error || 'Generation failed');
      } else {
        // Simulate progress based on elapsed time
        const simulatedProgress = Math.min(95, (elapsedTime / estimatedTime) * 100);
        setProgress(simulatedProgress);
      }
    };

    // Check immediately
    checkStatus();

    // Then poll every 3 seconds
    pollInterval = setInterval(checkStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [interviewId, elapsedTime, estimatedTime, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          {status === 'generating' && (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <Sparkles className="h-16 w-16 text-primary animate-pulse" />
                  <div className="absolute inset-0 animate-ping opacity-20">
                    <Sparkles className="h-16 w-16 text-primary" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-3xl">Generating Your Assessment</CardTitle>
              <CardDescription className="text-lg">
                Creating {questionBankSize} high-quality questions tailored to your requirements
              </CardDescription>
            </>
          )}
          {status === 'completed' && (
            <>
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-3xl text-green-600">Generation Complete!</CardTitle>
              <CardDescription className="text-lg">
                Your assessment is ready with {questionBankSize} questions
              </CardDescription>
            </>
          )}
          {status === 'failed' && (
            <>
              <CardTitle className="text-3xl text-destructive">Generation Failed</CardTitle>
              <CardDescription className="text-lg space-y-2">
                <p className="font-medium">{errorMessage}</p>
                {errorMessage?.includes('503') || errorMessage?.includes('overloaded') ? (
                  <p className="text-sm text-muted-foreground">
                    The AI model is currently experiencing high demand. This is temporary - please try again in a few moments.
                  </p>
                ) : errorMessage?.includes('429') || errorMessage?.includes('rate limit') ? (
                  <p className="text-sm text-muted-foreground">
                    Rate limit reached. Please wait a moment and try again.
                  </p>
                ) : errorMessage?.includes('402') || errorMessage?.includes('payment') ? (
                  <p className="text-sm text-muted-foreground">
                    AI usage quota exceeded. Please check your billing settings.
                  </p>
                ) : errorMessage?.includes('JSON') || errorMessage?.includes('parse') ? (
                  <p className="text-sm text-muted-foreground">
                    AI response was incomplete or malformed. This can happen with very large question sets. Try reducing the question bank size or try again.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    An unexpected error occurred. Please try again or contact Support@talentgeenie.com if the issue persists.
                  </p>
                )}
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {status === 'generating' && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>

              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="flex flex-col items-center p-4 rounded-lg bg-primary/5">
                  <Clock className="h-6 w-6 text-primary mb-2" />
                  <span className="text-2xl font-bold">{formatTime(elapsedTime)}</span>
                  <span className="text-xs text-muted-foreground">Elapsed</span>
                </div>
                <div className="flex flex-col items-center p-4 rounded-lg bg-primary/5">
                  <Zap className="h-6 w-6 text-primary mb-2" />
                  <span className="text-2xl font-bold">{questionBankSize}</span>
                  <span className="text-xs text-muted-foreground">Questions</span>
                </div>
                <div className="flex flex-col items-center p-4 rounded-lg bg-primary/5">
                  <Brain className="h-6 w-6 text-primary mb-2" />
                  <span className="text-2xl font-bold">AI</span>
                  <span className="text-xs text-muted-foreground">Powered</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {generationTips[currentTip]}
                  </p>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>This may take a few minutes. Please don't close this page.</p>
                <p className="mt-1">Estimated time: ~{Math.ceil(estimatedTime / 60)} minutes</p>
              </div>
            </>
          )}

          {status === 'completed' && (
            <div className="flex justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate(`${basePath}/interview/${interviewId}`)}
                className="w-full max-w-xs"
              >
                View Assessment
              </Button>
            </div>
          )}

          {status === 'failed' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>Troubleshooting tips:</strong>
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Wait 1-2 minutes before retrying to avoid rate limits</li>
                  <li>Try reducing the question bank size if it's very large</li>
                  <li>Check your internet connection</li>
                  <li>If the issue persists, contact Support@talentgeenie.com</li>
                </ul>
              </div>
              
              <div className="flex justify-center gap-3">
                <Button 
                  variant="outline"
                  onClick={() => navigate(`${basePath}/interviews`)}
                >
                  Go to Dashboard
                </Button>
                <Button 
                  onClick={async () => {
                    try {
                      // Check if generation is already in progress
                      const { data: currentStatus } = await supabase
                        .from('interviews')
                        .select('generation_status')
                        .eq('id', interviewId)
                        .maybeSingle();
                      
                      if (currentStatus?.generation_status === 'generating') {
                        // Generation is already running - just switch to generating UI
                        setStatus('generating');
                        setProgress(0);
                        setErrorMessage(null);
                        setElapsedTime(0);
                        toast({
                          title: "Generation in Progress",
                          description: "Resuming progress tracking for the ongoing generation.",
                        });
                        return;
                      }
                      
                      // Reset UI state
                      setStatus('generating');
                      setProgress(0);
                      setErrorMessage(null);
                      setElapsedTime(0);
                      
                      // Fetch interview details to get all required parameters
                      const { data: interview, error: fetchError } = await supabase
                        .from('interviews')
                        .select('job_description, question_count, difficulty_distribution, question_type_distribution, question_bank_size, topic_distribution, coding_schema')
                        .eq('id', interviewId)
                        .maybeSingle();
                      
                      if (fetchError || !interview) {
                        logger.error('Error fetching interview:', fetchError);
                        setStatus('failed');
                        setErrorMessage('Failed to fetch interview details. Please try from dashboard.');
                        toast({
                          title: "Error",
                          description: "Failed to fetch interview details.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      // Update interview status to generating
                      const { error: updateError } = await supabase
                        .from('interviews')
                        .update({ 
                          generation_status: 'generating',
                          generation_error: null 
                        })
                        .eq('id', interviewId);
                      
                      if (updateError) {
                        logger.error('Error updating interview:', updateError);
                        setStatus('failed');
                        setErrorMessage('Failed to reset interview. Please try from dashboard.');
                        toast({
                          title: "Error",
                          description: "Failed to reset interview status.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      // Trigger regeneration with all required parameters
                      const { error: invokeError } = await invokeFunction('generate-questions', {
                        body: { 
                          interviewId,
                          jobDescription: interview.job_description,
                          questionCount: interview.question_count,
                          difficultyDistribution: interview.difficulty_distribution,
                          questionTypeDistribution: interview.question_type_distribution,
                          questionBankSize: interview.question_bank_size || 100,
                          topics: interview.topic_distribution || {},
                          codingSchema: interview.coding_schema || null,
                          previewMode: false
                        }
                      });
                      
                      if (invokeError) {
                        logger.error('Error invoking generation:', invokeError);
                        setStatus('failed');
                        setErrorMessage(invokeError.message || 'Failed to start generation');
                        toast({
                          title: "Error",
                          description: invokeError.message || 'Failed to start generation',
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      toast({
                        title: "Generation Started",
                        description: "Question generation has been restarted.",
                      });
                    } catch (error: any) {
                      logger.error('Error in retry:', error);
                      setStatus('failed');
                      setErrorMessage(error.message || 'An unexpected error occurred');
                      toast({
                        title: "Error",
                        description: error.message || 'An unexpected error occurred',
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Retry Generation
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
