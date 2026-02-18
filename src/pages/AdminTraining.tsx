import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Users, BarChart3, Sparkles, Trash2, ExternalLink, Plus, Pencil, X, FlaskConical, ChevronDown, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";

// Unit type badge colors and icons
const unitTypeConfig: Record<string, { color: string; icon: string }> = {
  introduction: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: "📖" },
  concept: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: "💡" },
  tutorial: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: "🎯" },
  lab: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: "🔬" },
  assessment: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: "✅" },
  summary: { color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400", icon: "📋" },
};

// Expandable Unit Card Component
const UnitCard = ({ unit }: { unit: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = unitTypeConfig[unit.unit_type] || unitTypeConfig.concept;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 text-sm p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors border border-transparent hover:border-border">
          <div className="flex items-center gap-2 flex-1">
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-base">{config.icon}</span>
            <Badge className={`text-xs capitalize shrink-0 ${config.color} border-0`}>
              {unit.unit_type}
            </Badge>
            <span className="flex-1 font-medium">{unit.unit_title}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{unit.duration_minutes} min</span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-6 p-4 bg-card border rounded-lg">
          {unit.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                  p: ({ children }) => <p className="text-sm text-muted-foreground mb-2">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside text-sm space-y-1 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside text-sm space-y-1 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                  code: ({ children, className }) => {
                    const isBlock = className?.includes('language-');
                    if (isBlock) {
                      return <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs my-2"><code>{children}</code></pre>;
                    }
                    return <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>;
                  },
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  blockquote: ({ children }) => <blockquote className="border-l-2 border-primary pl-3 italic text-sm">{children}</blockquote>,
                }}
              >
                {unit.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {unit.content_description || "Content will be generated when you save this plan."}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};


const AdminTraining = () => {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [trainingPlans, setTrainingPlans] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form states
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState("intermediate");
  const [generatedTopics, setGeneratedTopics] = useState<any[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  
  // Material editing states
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null);
  const [materialForm, setMaterialForm] = useState({
    title: "",
    url: "",
    material_type: "documentation",
    description: ""
  });

  useEffect(() => {
    fetchTrainingPlans();
    fetchUsers();
    fetchAssignments();
  }, []);

  const fetchTrainingPlans = async () => {
    const { data, error } = await supabase
      .from("training_plans")
      .select("*, training_topics(count)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching training plans:", error);
      return;
    }
    setTrainingPlans(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");

    if (error) {
      logger.error("Error fetching users:", error);
      return;
    }
    setUsers(data || []);
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from("user_training_assignments")
      .select(`
        *,
        profiles(full_name, email),
        training_plans(role_name)
      `)
      .order("assigned_at", { ascending: false });

    if (error) {
      logger.error("Error fetching assignments:", error);
      return;
    }
    setAssignments(data || []);
  };

  const handleGeneratePlan = async () => {
    if (!roleName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a role name",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await invokeFunction("generate-training-plan", {
        body: {
          roleName,
          roleDescription,
          difficultyLevel,
        },
      });

      logger.debug("Training plan response:", JSON.stringify(data, null, 2));

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Generation Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      // Handle different possible response structures
      const topics = data?.plan?.topics || data?.topics || [];
      const learningPathMetadata = data?.plan?.learning_path_metadata || data?.plan?.learning_path || null;
      
      if (topics.length === 0) {
        toast({
          title: "No Topics Generated",
          description: "The AI did not return any topics. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setGeneratedTopics(topics);
      
      // Calculate total XP and duration from modules
      const totalXP = topics.reduce((sum: number, t: any) => sum + (t.xp_points || 0), 0);
      const totalUnits = topics.reduce((sum: number, t: any) => sum + (t.units?.length || 0), 0);
      
      toast({
        title: "Learning Path Generated",
        description: `Generated ${topics.length} modules${totalUnits > 0 ? ` with ${totalUnits} units` : ''}${totalXP > 0 ? ` (${totalXP} XP total)` : ''}. Review and save below.`,
      });
    } catch (error: any) {
      logger.error("Error generating plan:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate training plan",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    if (!roleName.trim() || generatedTopics.length === 0) {
      toast({
        title: "Cannot Save",
        description: "Generate a plan first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingPlanId) {
        // Update existing plan
        const { error: planError } = await supabase
          .from("training_plans")
          .update({
            role_name: roleName,
            role_description: roleDescription,
            difficulty_level: difficultyLevel,
          })
          .eq("id", editingPlanId);

        if (planError) throw planError;

        // Delete existing topics and materials for this plan
        const { error: deleteTopicsError } = await supabase
          .from("training_topics")
          .delete()
          .eq("training_plan_id", editingPlanId);

        if (deleteTopicsError) throw deleteTopicsError;

        // Insert new topics and materials
        for (let i = 0; i < generatedTopics.length; i++) {
          const topic = generatedTopics[i];
          
          const { data: createdTopic, error: topicError } = await supabase
            .from("training_topics")
            .insert({
              training_plan_id: editingPlanId,
              topic_name: topic.topic_name,
              subtopic: topic.subtopic,
              difficulty_level: topic.difficulty_level,
              estimated_duration: topic.estimated_duration,
              order_index: i,
            })
            .select()
            .single();

          if (topicError) throw topicError;

          // Add materials
          if (topic.materials && topic.materials.length > 0) {
            const materials = topic.materials.map((m: any, idx: number) => ({
              training_topic_id: createdTopic.id,
              title: m.title,
              url: m.url,
              material_type: m.material_type,
              description: m.description,
              order_index: idx,
            }));

            const { error: materialsError } = await supabase
              .from("learning_materials")
              .insert(materials);

            if (materialsError) throw materialsError;
          }
        }

        toast({
          title: "Training Plan Updated",
          description: "Plan updated successfully",
        });
      } else {
        // Create new training plan
        const { data: plan, error: planError } = await supabase
          .from("training_plans")
          .insert({
            role_name: roleName,
            role_description: roleDescription,
            difficulty_level: difficultyLevel,
            created_by: user.id,
            is_active: true,
          })
          .select()
          .single();

        if (planError) throw planError;

        // Create topics and materials
        for (let i = 0; i < generatedTopics.length; i++) {
          const topic = generatedTopics[i];
          
          const { data: createdTopic, error: topicError } = await supabase
            .from("training_topics")
            .insert({
              training_plan_id: plan.id,
              topic_name: topic.topic_name,
              subtopic: topic.subtopic,
              difficulty_level: topic.difficulty_level,
              estimated_duration: topic.estimated_duration,
              order_index: i,
            })
            .select()
            .single();

          if (topicError) throw topicError;

          // Add materials
          if (topic.materials && topic.materials.length > 0) {
            const materials = topic.materials.map((m: any, idx: number) => ({
              training_topic_id: createdTopic.id,
              title: m.title,
              url: m.url,
              material_type: m.material_type,
              description: m.description,
              order_index: idx,
            }));

            const { error: materialsError } = await supabase
              .from("learning_materials")
              .insert(materials);

            if (materialsError) throw materialsError;
          }
        }

        toast({
          title: "Training Plan Created",
          description: "Plan saved successfully",
        });
      }

      // Reset form
      setRoleName("");
      setRoleDescription("");
      setGeneratedTopics([]);
      setEditingPlanId(null);
      fetchTrainingPlans();
    } catch (error: any) {
      logger.error("Error saving plan:", error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save training plan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = async (planId: string) => {
    try {
      // Fetch plan details
      const { data: plan, error: planError } = await supabase
        .from("training_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError) throw planError;

      // Fetch topics with materials
      const { data: topics, error: topicsError } = await supabase
        .from("training_topics")
        .select("*, learning_materials(*)")
        .eq("training_plan_id", planId)
        .order("order_index");

      if (topicsError) throw topicsError;

      // Set form data
      setRoleName(plan.role_name);
      setRoleDescription(plan.role_description || "");
      setDifficultyLevel(plan.difficulty_level);
      setEditingPlanId(planId);
      
      // Format topics for editing
      const formattedTopics = topics.map((topic: any) => ({
        topic_name: topic.topic_name,
        subtopic: topic.subtopic,
        difficulty_level: topic.difficulty_level,
        estimated_duration: topic.estimated_duration,
        materials: topic.learning_materials.map((m: any) => ({
          title: m.title,
          url: m.url,
          material_type: m.material_type,
          description: m.description,
        })),
      }));

      setGeneratedTopics(formattedTopics);

      toast({
        title: "Plan Loaded",
        description: "You can now edit the training plan",
      });
    } catch (error: any) {
      logger.error("Error loading plan:", error);
      toast({
        title: "Load Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      const { error } = await supabase
        .from("training_plans")
        .update({ is_active: false })
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "Plan Deleted",
        description: "Training plan removed successfully",
      });
      fetchTrainingPlans();
    } catch (error: any) {
      logger.error("Error deleting plan:", error);
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setDeleteConfirm(null);
  };

  const handleAssignPlan = async (userId: string, planId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_training_assignments")
        .insert({
          user_id: userId,
          training_plan_id: planId,
          assigned_by: user.id,
          status: "assigned",
        });

      if (error) throw error;

      toast({
        title: "Plan Assigned",
        description: "Training plan assigned to user successfully",
      });
      fetchAssignments();
    } catch (error: any) {
      logger.error("Error assigning plan:", error);
      toast({
        title: "Assignment Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Material management functions
  const openAddMaterialDialog = (topicIndex: number) => {
    setEditingTopicIndex(topicIndex);
    setEditingMaterialIndex(null);
    setMaterialForm({ title: "", url: "", material_type: "documentation", description: "" });
    setMaterialDialogOpen(true);
  };

  const openEditMaterialDialog = (topicIndex: number, materialIndex: number) => {
    const material = generatedTopics[topicIndex].materials[materialIndex];
    setEditingTopicIndex(topicIndex);
    setEditingMaterialIndex(materialIndex);
    setMaterialForm({
      title: material.title,
      url: material.url,
      material_type: material.material_type,
      description: material.description || ""
    });
    setMaterialDialogOpen(true);
  };

  const handleSaveMaterial = () => {
    if (!materialForm.title || !materialForm.url) {
      toast({
        title: "Missing Information",
        description: "Title and URL are required",
        variant: "destructive"
      });
      return;
    }

    const updatedTopics = [...generatedTopics];
    if (editingMaterialIndex !== null && editingTopicIndex !== null) {
      // Edit existing
      updatedTopics[editingTopicIndex].materials[editingMaterialIndex] = { ...materialForm };
    } else if (editingTopicIndex !== null) {
      // Add new
      if (!updatedTopics[editingTopicIndex].materials) {
        updatedTopics[editingTopicIndex].materials = [];
      }
      updatedTopics[editingTopicIndex].materials.push({ ...materialForm });
    }
    
    setGeneratedTopics(updatedTopics);
    setMaterialDialogOpen(false);
    toast({ title: "Material Saved", description: "Learning material has been saved" });
  };

  const handleDeleteMaterial = (topicIndex: number, materialIndex: number) => {
    const updatedTopics = [...generatedTopics];
    updatedTopics[topicIndex].materials.splice(materialIndex, 1);
    setGeneratedTopics(updatedTopics);
    toast({ title: "Material Removed", description: "Learning material has been removed" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Training Management</h1>
            <p className="text-muted-foreground">Create and manage role-based training plans</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">
            <BookOpen className="w-4 h-4 mr-2" />
            Create/Edit Plan
          </TabsTrigger>
          <TabsTrigger value="assign">
            <Users className="w-4 h-4 mr-2" />
            Assign Users
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{editingPlanId ? "Edit Training Plan" : "Generate Training Plan with AI"}</CardTitle>
              <CardDescription>
                {editingPlanId 
                  ? "Modify the training plan details and regenerate topics if needed"
                  : "Enter a role name and let AI generate a comprehensive training plan"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingPlanId && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md">
                  <Badge>Editing Mode</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingPlanId(null);
                      setRoleName("");
                      setRoleDescription("");
                      setGeneratedTopics([]);
                    }}
                  >
                    Cancel Edit
                  </Button>
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Role Name *</Label>
                  <Input
                    id="roleName"
                    placeholder="e.g., React Developer, Data Engineer"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select value={difficultyLevel} onValueChange={setDifficultyLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleDescription">Role Description (Optional)</Label>
                <Textarea
                  id="roleDescription"
                  placeholder="Describe the role and key responsibilities..."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <Button
                onClick={handleGeneratePlan}
                disabled={generating || !roleName}
                className="w-full"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {generating ? "Generating..." : editingPlanId ? "Regenerate Topics" : "Generate Training Plan with AI"}
              </Button>

              {generatedTopics.length > 0 && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Generated Topics ({generatedTopics.length})</h3>
                    <Button onClick={handleSavePlan} disabled={loading}>
                      {loading ? "Saving..." : editingPlanId ? "Update Training Plan" : "Save Training Plan"}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {generatedTopics.map((topic, idx) => (
                      <Card key={idx}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{topic.topic_name}</CardTitle>
                              {topic.subtopic && (
                                <CardDescription>{topic.subtopic}</CardDescription>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline">{topic.difficulty_level}</Badge>
                              <Badge variant="secondary">{topic.estimated_duration}h</Badge>
                              {topic.xp_points && (
                                <Badge className="bg-amber-500/20 text-amber-700">{topic.xp_points} XP</Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Units Section (Microsoft Learn-style) with expandable content */}
                            {topic.units && topic.units.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-3">Learning Units:</p>
                                <div className="space-y-2">
                                  {topic.units.map((unit: any, uIdx: number) => (
                                    <UnitCard key={uIdx} unit={unit} />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Learning Materials Section */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium">Learning Materials:</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAddMaterialDialog(idx)}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Material
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {topic.materials && topic.materials.filter((m: any) => m.material_type !== 'lab').map((material: any, mIdx: number) => {
                                  const actualIdx = topic.materials.findIndex((m: any) => m === material);
                                  return (
                                    <div key={mIdx} className="flex items-start gap-2 text-sm p-2 bg-muted rounded group">
                                      <Badge variant="outline" className="text-xs shrink-0">{material.material_type}</Badge>
                                      <div className="flex-1 min-w-0">
                                        <a
                                          href={material.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-medium hover:underline flex items-center gap-1"
                                        >
                                          <span className="truncate">{material.title}</span>
                                          <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                        <p className="text-muted-foreground text-xs truncate">{material.description}</p>
                                      </div>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => openEditMaterialDialog(idx, actualIdx)}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-destructive"
                                          onClick={() => handleDeleteMaterial(idx, actualIdx)}
                                        >
                                          <X className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {(!topic.materials || topic.materials.filter((m: any) => m.material_type !== 'lab').length === 0) && (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    No learning materials yet.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Lab Exercises Section */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <FlaskConical className="w-4 h-4 text-primary" />
                                <p className="text-sm font-medium">Lab Exercises:</p>
                              </div>
                              <div className="space-y-3">
                                {topic.materials && topic.materials.filter((m: any) => m.material_type === 'lab').map((lab: any, labIdx: number) => {
                                  const actualIdx = topic.materials.findIndex((m: any) => m === lab);
                                  return (
                                    <div key={labIdx} className="p-3 bg-primary/5 border border-primary/20 rounded-lg group">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge className="bg-primary/20 text-primary text-xs">Lab</Badge>
                                            <a
                                              href={lab.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="font-medium hover:underline flex items-center gap-1 text-sm"
                                            >
                                              {lab.title}
                                              <ExternalLink className="w-3 h-3 shrink-0" />
                                            </a>
                                          </div>
                                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lab.description}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => openEditMaterialDialog(idx, actualIdx)}
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive"
                                            onClick={() => handleDeleteMaterial(idx, actualIdx)}
                                          >
                                            <X className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {(!topic.materials || topic.materials.filter((m: any) => m.material_type === 'lab').length === 0) && (
                                  <p className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded">
                                    No lab exercises yet. Add a hands-on lab for practical learning.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Knowledge Check Section */}
                            {topic.knowledge_check && (
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <BookOpen className="w-4 h-4 text-blue-600" />
                                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Knowledge Check</p>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Questions:</span>
                                    <span className="ml-1 font-medium">{topic.knowledge_check.questions_count}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Passing Score:</span>
                                    <span className="ml-1 font-medium">{topic.knowledge_check.passing_score}%</span>
                                  </div>
                                  {topic.knowledge_check.topics_covered && (
                                    <div className="col-span-3">
                                      <span className="text-muted-foreground">Topics: </span>
                                      <span className="text-xs">{topic.knowledge_check.topics_covered.join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Training Plans</CardTitle>
              <CardDescription>Manage your created training plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trainingPlans.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No training plans created yet</p>
                ) : (
                  trainingPlans.map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-semibold">{plan.role_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {plan.difficulty_level} • {plan.training_topics?.[0]?.count || 0} topics
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPlan(plan.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(plan.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assign" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Training Plans</CardTitle>
              <CardDescription>Assign training plans to users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">{user.full_name}</h4>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Select onValueChange={(planId) => handleAssignPlan(user.id, planId)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Assign plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {trainingPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.role_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assignments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No assignments yet</p>
                ) : (
                  assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold">{assignment.profiles?.full_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {assignment.training_plans?.role_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <Progress value={assignment.progress_percentage} />
                        </div>
                        <Badge>{assignment.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Training Analytics</CardTitle>
              <CardDescription>Overview of training progress and completion</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{trainingPlans.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{assignments.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">
                      {assignments.length > 0
                        ? Math.round(
                            assignments.reduce((sum, a) => sum + a.progress_percentage, 0) /
                              assignments.length
                          )
                        : 0}
                      %
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training plan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDeletePlan(deleteConfirm)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Material Add/Edit Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMaterialIndex !== null ? "Edit Learning Material" : "Add Learning Material"}
            </DialogTitle>
            <DialogDescription>
              Add custom learning content from official sources like Microsoft Learn, Databricks Academy, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="material-title">Title *</Label>
              <Input
                id="material-title"
                placeholder="e.g., Introduction to Power BI"
                value={materialForm.title}
                onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-url">URL *</Label>
              <Input
                id="material-url"
                placeholder="https://learn.microsoft.com/..."
                value={materialForm.url}
                onChange={(e) => setMaterialForm({ ...materialForm, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-type">Material Type</Label>
              <Select 
                value={materialForm.material_type} 
                onValueChange={(v) => setMaterialForm({ ...materialForm, material_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="repository">Repository</SelectItem>
                  <SelectItem value="tutorial">Tutorial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-description">Description</Label>
              <Textarea
                id="material-description"
                placeholder="Brief description of the learning material..."
                value={materialForm.description}
                onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMaterial}>
              {editingMaterialIndex !== null ? "Update" : "Add"} Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
  );
};

export default AdminTraining;
