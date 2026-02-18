import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, BookOpen, Clock, Target, Zap, Brain } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const PracticeAssessmentConfiguration = () => {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [questionCount, setQuestionCount] = useState("10");
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [difficulty, setDifficulty] = useState("mixed");

  const { data: topic, isLoading } = useQuery({
    queryKey: ['training-topic', topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_topics' as any)
        .select('*')
        .eq('id', topicId)
        .single();
      
      if (error) throw error;
      return data as any;
    },
  });

  const { data: userProgress } = useQuery({
    queryKey: ['user-topic-progress', user?.id, topicId],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_topic_progress' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('training_topic_id', topicId)
        .maybeSingle();
      
      if (error) throw error;
      return data as any;
    },
    enabled: !!user && !!topicId,
  });

  const handleStartAssessment = async () => {
    if (!user) {
      toast.error('Please login to start assessment');
      navigate('/auth');
      return;
    }

    try {
      // Create a new learning assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from('learning_assessments' as any)
        .insert({
          training_topic_id: topicId,
          user_id: user.id,
          question_count: parseInt(questionCount),
          mode: mode,
          difficulty_level: difficulty,
          status: 'pending',
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      toast.success('Assessment configured successfully');
      navigate(`/learning-progress/${(assessment as any).id}`);
    } catch (error) {
      logger.error('Error creating assessment:', error);
      toast.error('Failed to create assessment');
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <div className="text-center">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  if (!topic) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <div className="text-center">Topic not found</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-6 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/learning')}
          className="mb-4 sm:mb-6 gap-2 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Learning Hub
        </Button>

        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold">Configure Practice Assessment</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            Customize your practice session for {topic.name}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Configuration Form */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Number of Questions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Number of Questions
                </CardTitle>
                <CardDescription>
                  Choose how many questions you want to practice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={questionCount} onValueChange={setQuestionCount}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="10" id="q10" />
                      <Label htmlFor="q10" className="cursor-pointer">10 Questions (~15 min)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="20" id="q20" />
                      <Label htmlFor="q20" className="cursor-pointer">20 Questions (~30 min)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="30" id="q30" />
                      <Label htmlFor="q30" className="cursor-pointer">30 Questions (~45 min)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="50" id="q50" />
                      <Label htmlFor="q50" className="cursor-pointer">50 Questions (~75 min)</Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Assessment Mode */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Assessment Mode
                </CardTitle>
                <CardDescription>
                  Select your preferred practice mode
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={mode} onValueChange={(value: any) => setMode(value)}>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                      <RadioGroupItem value="practice" id="practice" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="practice" className="cursor-pointer font-semibold">
                          Practice Mode
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Immediate feedback after each question. Perfect for learning and improvement.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                      <RadioGroupItem value="exam" id="exam" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="exam" className="cursor-pointer font-semibold">
                          Exam Mode
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          All feedback at the end. Simulates real exam conditions.
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Difficulty Level */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Difficulty Level
                </CardTitle>
                <CardDescription>
                  Choose the difficulty of questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed (Recommended)</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Start Button */}
            <Button 
              onClick={handleStartAssessment}
              className="w-full"
              size="lg"
            >
              Start Assessment
            </Button>
          </div>

          {/* Topic Info Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{topic.name}</CardTitle>
                <CardDescription>{topic.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Badge variant="outline" className="capitalize">
                    {topic.category}
                  </Badge>
                </div>

                {topic.skills && topic.skills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Skills Covered:</p>
                    <div className="flex flex-wrap gap-1">
                      {topic.skills.slice(0, 5).map((skill: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {topic.skills.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{topic.skills.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {userProgress && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Your Progress:</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {userProgress.best_score && (
                        <div className="flex justify-between">
                          <span>Best Score:</span>
                          <span className="font-semibold text-foreground">{userProgress.best_score}%</span>
                        </div>
                      )}
                      {userProgress.materials_completed > 0 && (
                        <div className="flex justify-between">
                          <span>Completed:</span>
                          <span className="font-semibold text-foreground">
                            {userProgress.materials_completed}/{userProgress.total_materials}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Quick Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                <p>• Start with Practice Mode to learn concepts</p>
                <p>• Use Exam Mode to test your readiness</p>
                <p>• Mixed difficulty helps build confidence</p>
                <p>• Review feedback to improve weak areas</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default PracticeAssessmentConfiguration;
