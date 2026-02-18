import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { logger } from '@/lib/logger';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Shield, CheckCircle } from "lucide-react";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { useProctoringSession } from "@/hooks/useProctoringSession";
import PreInterviewChecks from "@/components/proctoring/PreInterviewChecks";
import { CodeEditor } from "@/components/interview/CodeEditor";

const TakeCertification = () => {
  const { assessmentId: topicId } = useParams(); // Now this is topicId
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      errorToast('Please login to take certification');
      navigate('/auth', { state: { from: `/take-certification/${topicId}` } });
    }
  }, [user, navigate, topicId]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proctoringReady, setProctoringReady] = useState(false);
  const [tempAttemptId, setTempAttemptId] = useState<string>('');
  const [proctoringSessionId, setProctoringSessionId] = useState<string | null>(null);

  // Initialize proctoring session - use temp ID until real attempt is created
  const proctoring = useProctoringSession(tempAttemptId || attemptId || '', 'certification');

  // Fetch topic and config
  const { data: topic, isLoading } = useQuery({
    queryKey: ['certification-topic', topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certification_topics' as any)
        .select('*')
        .eq('id', topicId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as any;
    },
  });

  const { data: configData } = useQuery({
    queryKey: ['certification-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certification_global_config' as any)
        .select('config')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();
      
      if (error) throw error;
      return data as any;
    },
  });

  const config = configData?.config;

  // Questions will be fetched from the attempt after generation
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);

  // Initialize attempt and generate questions after proctoring is ready
  useEffect(() => {
    if (proctoringReady && !attemptId && topic && config && user && proctoringSessionId) {
      initializeAttempt();
    }
  }, [proctoringReady, topic, config, user, proctoringSessionId]);

  const initializeAttempt = async () => {
    if (!user || !topic || !config || !proctoringSessionId) return;

    try {
      toast({ title: "Generating Exam", description: "Creating your personalized exam..." });

      // Create certification attempt first
      const { data: attempt, error: attemptError } = await supabase
        .from('certification_attempts' as any)
        .insert({
          certification_assessment_id: null, // We're not using assessments anymore
          user_id: user.id,
          proctoring_session_id: proctoringSessionId,
          answers: {},
          generated_questions: [], // Will be populated by edge function
        })
        .select()
        .single();

      if (attemptError || !attempt) throw attemptError || new Error('Failed to create attempt');
      
      const newAttemptId = (attempt as any).id;
      setAttemptId(newAttemptId);
      setTempAttemptId(newAttemptId);

      // Generate questions using edge function
      const { data: generationResult, error: generationError } = await invokeFunction(
        'generate-certification-questions',
        {
          body: { topicId: topic.id, attemptId: newAttemptId }
        }
      );

      if (generationError || !generationResult?.success) {
        throw new Error(generationResult?.error || 'Failed to generate questions');
      }

      // Set questions and start timer
      setQuestions(generationResult.questions);
      setQuestionsLoading(false);
      setTimeRemaining(config.exam_settings.time_limit_minutes * 60);
      
      successToast(`Exam ready! ${generationResult.count} questions generated`);
    } catch (error) {
      logger.error('Error initializing attempt:', error);
      errorToast('Failed to start certification');
      navigate('/learning');
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0 || !attemptId) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, attemptId]);

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSubmit = async () => {
    if (!attemptId || !proctoring.sessionId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Finalize proctoring session
      await proctoring.finalizeSession();

      // Calculate time taken
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      // Update attempt with answers
      const { error: updateError } = await supabase
        .from('certification_attempts' as any)
        .update({
          answers,
          time_taken: timeTaken,
          submitted_at: new Date().toISOString(),
          status: 'submitted',
        })
        .eq('id', attemptId);

      if (updateError) throw updateError;

      // Trigger evaluation
      const { error: evalError } = await invokeFunction('evaluate-certification', {
        body: { attemptId },
      });

      if (evalError) throw evalError;

      successToast('Certification submitted successfully!');
      navigate(`/certification-result/${attemptId}`);
    } catch (error) {
      logger.error('Error submitting certification:', error);
      errorToast('Failed to submit certification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!proctoringReady) {
    return (
      <PreInterviewChecks
        attemptId={tempAttemptId || 'temp'}
        attemptType="certification"
        onComplete={async (sessionId, videoStream, screenStream) => {
          // Store the session ID in local state for certification flow
          setProctoringSessionId(sessionId);
          setProctoringReady(true);
        }}
      />
    );
  }

  if (isLoading || !topic || !config) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading certification...</div>
      </div>
    );
  }

  if (questionsLoading || questions.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <div>
                <h3 className="font-semibold text-lg">Generating Your Exam</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Creating {config?.question_generation?.total_questions || 50} unique questions just for you...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4 max-w-4xl">
      {/* Header */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-xl md:text-2xl truncate">{topic.display_name}</CardTitle>
              <CardDescription className="mt-1 sm:mt-2 flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                {topic.provider} Certification
                {user?.email && (
                  <>
                    <span className="text-muted-foreground hidden sm:inline">•</span>
                    <span className="w-full sm:w-auto">Candidate: {user.email}</span>
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <Badge variant="outline" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Proctored</span>
              </Badge>
              <Badge variant="destructive" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                {formatTime(timeRemaining)}
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="mt-3 sm:mt-4" />
          <div className="text-xs sm:text-sm text-muted-foreground mt-2">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
        </CardHeader>
      </Card>

      {/* Eligibility Criteria */}
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <CardTitle className="text-amber-900">Certification Requirements</CardTitle>
              <CardDescription className="text-amber-700">
                To earn this certificate, you must meet ALL criteria:
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-amber-800">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Score at least {config?.exam_settings?.passing_score_percentage || 70}% on the assessment
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Maintain integrity score of {config?.exam_settings?.min_integrity_score || 70}/100 or higher
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              No tab switches (max: {config?.proctoring_settings?.max_tab_switches || 0})
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Max {config?.proctoring_settings?.max_look_aways || 5} look-away warnings
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              No multiple persons detected
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Complete within {config?.exam_settings?.time_limit_minutes || 90} minutes
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary">{currentQuestion.difficulty}</Badge>
            <Badge variant="outline">{currentQuestion.topic}</Badge>
          </div>
          <CardTitle className="text-xl">{currentQuestion.question_text}</CardTitle>
        </CardHeader>

        <CardContent>
          {currentQuestion.question_type === 'mcq' && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id] || ''}
              onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
            >
              {Object.entries(currentQuestion.options as Record<string, string>).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted">
                  <RadioGroupItem value={key} id={`option-${key}`} />
                  <Label htmlFor={`option-${key}`} className="flex-1 cursor-pointer">
                    {key}. {value}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.question_type === 'coding' && (
            <CodeEditor
              questionId={currentQuestion.id}
              questionText={currentQuestion.question_text}
              language="javascript"
              initialCode={answers[currentQuestion.id] || ''}
              onCodeChange={(code) => handleAnswer(currentQuestion.id, code)}
              allowedLanguages={currentQuestion.allowed_languages || null}
            />
          )}

          {currentQuestion.question_type === 'descriptive' && (
            <Textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
              placeholder="Enter your answer here..."
              rows={8}
            />
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-2 p-4 sm:p-6">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="min-h-[44px] text-sm sm:text-base"
          >
            Previous
          </Button>

          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              className="min-h-[44px] text-sm sm:text-base"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 min-h-[44px] text-sm sm:text-base"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default TakeCertification;