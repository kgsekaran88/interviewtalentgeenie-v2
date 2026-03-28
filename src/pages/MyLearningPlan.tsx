import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { BookOpen, PlayCircle, ExternalLink, CheckCircle, Clock, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/AppLayout";
import { logger } from "@/lib/logger";

const MyLearningPlan = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("user_training_assignments")
        .select(`
          *,
          training_plans(*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAssignments(data || []);
      if (data && data.length > 0) {
        loadPlanDetails(data[0].training_plan_id);
      }
    } catch (error: any) {
      logger.error("Error fetching assignments:", error);
      toast({
        title: "Error",
        description: "Failed to load learning plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPlanDetails = async (planId: string) => {
    try {
      const { data: plan } = await supabase
        .from("training_plans")
        .select("*")
        .eq("id", planId)
        .single();

      setSelectedPlan(plan);

      const { data: topicsData } = await supabase
        .from("training_topics")
        .select(`
          *,
          learning_materials(*)
        `)
        .eq("training_plan_id", planId)
        .order("order_index");

      setTopics(topicsData || []);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progressData } = await supabase
          .from("user_topic_progress")
          .select("*")
          .eq("user_id", user.id)
          .in("training_topic_id", topicsData?.map((t) => t.id) || []);

        setProgress(progressData || []);
      }
    } catch (error) {
      logger.error("Error loading plan details:", error);
    }
  };

  const getTopicProgress = (topicId: string) => {
    return progress.find((p) => p.training_topic_id === topicId);
  };

  const handleStartAssessment = (topicId: string) => {
    navigate("/learning", {
      state: { topicId, mode: "practice" },
    });
  };

  const handleMarkMaterialComplete = async (topicId: string, materialId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const topicProgress = getTopicProgress(topicId);
      const topic = topics.find((t) => t.id === topicId);
      const totalMaterials = topic?.learning_materials?.length || 0;

      if (topicProgress) {
        const newCompleted = Math.min(topicProgress.materials_completed + 1, totalMaterials);
        const { error } = await supabase
          .from("user_topic_progress")
          .update({
            materials_completed: newCompleted,
            status: newCompleted === totalMaterials ? "completed" : "in_progress",
            last_accessed_at: new Date().toISOString(),
          })
          .eq("id", topicProgress.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_topic_progress")
          .insert({
            user_id: user.id,
            training_topic_id: topicId,
            materials_completed: 1,
            total_materials: totalMaterials,
            status: "in_progress",
            last_accessed_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // Refresh progress
      if (selectedPlan) {
        loadPlanDetails(selectedPlan.id);
      }

      toast({
        title: "Progress Updated",
        description: "Material marked as complete",
      });
    } catch (error: any) {
      logger.error("Error updating progress:", error);
      toast({
        title: "Error",
        description: "Failed to update progress",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading your learning plan...</p>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>No Learning Plans Assigned</CardTitle>
            <CardDescription>
              Contact your administrator to get assigned a training plan
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/learning-dashboard')}
            className="self-start min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
          <h1 className="text-xl sm:text-3xl font-bold">My Learning Plan</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Track your progress and access learning materials</p>
        </div>
      </div>

      {assignments.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Assigned Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {assignments.map((assignment) => (
                <Button
                  key={assignment.id}
                  variant={selectedPlan?.id === assignment.training_plan_id ? "default" : "outline"}
                  onClick={() => loadPlanDetails(assignment.training_plan_id)}
                >
                  {assignment.training_plans?.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedPlan && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{selectedPlan.name}</CardTitle>
                  <CardDescription className="mt-2">
                    {selectedPlan.description}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {selectedPlan.difficulty_level}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-primary">{topics.length}</p>
                  <p className="text-sm text-muted-foreground">Topics</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-accent">
                    {progress.filter((p) => p.status === "completed").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    {topics.length > 0
                      ? Math.round(
                          (progress.filter((p) => p.status === "completed").length / topics.length) * 100
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-muted-foreground">Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {topics.map((topic, idx) => {
              const topicProgress = getTopicProgress(topic.id);
              const completionPercentage = topicProgress
                ? (topicProgress.materials_completed / (topic.learning_materials?.length || 1)) * 100
                : 0;

              return (
                <Card key={topic.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-muted-foreground">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <CardTitle>{topic.name}</CardTitle>
                          {topicProgress?.status === "completed" && (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                        {topic.description && (
                          <CardDescription className="mt-1">{topic.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        {topic.is_required && <Badge variant="outline">Required</Badge>}
                        <Badge variant="secondary">
                          <Clock className="w-3 h-3 mr-1" />
                          {topic.estimated_duration_minutes ? `${Math.round(topic.estimated_duration_minutes / 60)}h` : 'N/A'}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={completionPercentage} className="mt-4" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {topic.learning_materials && topic.learning_materials.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Learning Materials</h4>
                        <div className="space-y-2">
                          {topic.learning_materials.map((material: any) => (
                            <div
                              key={material.id}
                              className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <Badge variant="outline" className="text-xs">
                                {material.material_type}
                              </Badge>
                              <div className="flex-1">
                                <a
                                  href={material.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium hover:underline flex items-center gap-1 mb-1"
                                >
                                  {material.title}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <p className="text-sm text-muted-foreground">{material.description}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarkMaterialComplete(topic.id, material.id)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={() => handleStartAssessment(topic.id)}
                      className="w-full"
                      variant="outline"
                    >
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Start Practice Assessment
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
      </div>
    </AppLayout>
  );
};

export default MyLearningPlan;
