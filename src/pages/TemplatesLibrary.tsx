import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { BookTemplate, Plus, Star, Clock, Users, Edit, Trash2, Play, AlertCircle, TrendingUp, Search, Filter, X } from "lucide-react";

export default function TemplatesLibrary() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSeniority, setSelectedSeniority] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const queryClient = useQueryClient();

  // Form state for creating/editing templates
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "technical",
    role_type: "",
    seniority_level: "mid",
    recommended_time_limit: 60,
    question_distribution: { mcq: 40, scenario: 30, coding: 20, descriptive: 10 },
    difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
    tags: [] as string[],
    is_public: false,
  });
  const [tagInput, setTagInput] = useState("");

  // Get user's organization
  const { data: orgData } = useQuery({
    queryKey: ["user-organization"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      return data;
    },
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["interview-templates", selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from("interview_templates")
        .select("*")
        .order("usage_count", { ascending: false });

      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Create template mutation
  const createTemplate = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("interview_templates")
        .insert({
          ...data,
          created_by: user.id,
          organization_id: orgData?.organization_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template created successfully!");
      queryClient.invalidateQueries({ queryKey: ["interview-templates"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from("interview_templates")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["interview-templates"] });
      setEditingTemplate(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });

  // Delete template mutation
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("interview_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["interview-templates"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  // Create interview from template
  const createFromTemplate = useMutation({
    mutationFn: async (params: { templateId: string; title: string; jobDescription: string }) => {
      const { data, error } = await invokeFunction("create-from-template", {
        body: {
          template_id: params.templateId,
          title: params.title,
          job_description: params.jobDescription,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Interview created from template!");
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      if (data?.interview?.id) {
        navigate(`/partner/recruiting/interview/${data.interview.id}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to create interview: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "technical",
      role_type: "",
      seniority_level: "mid",
      recommended_time_limit: 60,
      question_distribution: { mcq: 40, scenario: 30, coding: 20, descriptive: 10 },
      difficulty_distribution: { easy: 30, medium: 50, hard: 20 },
      tags: [],
      is_public: false,
    });
    setTagInput("");
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      category: template.category,
      role_type: template.role_type,
      seniority_level: template.seniority_level,
      recommended_time_limit: template.recommended_time_limit,
      question_distribution: template.question_distribution,
      difficulty_distribution: template.difficulty_distribution,
      tags: template.tags || [],
      is_public: template.is_public,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, ...formData });
    } else {
      createTemplate.mutate(formData);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const filteredTemplates = templates?.filter(
    (t) => {
      const matchesSearch = 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.role_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesSeniority = selectedSeniority === 'all' || t.seniority_level === selectedSeniority;
      
      return matchesSearch && matchesSeniority;
    }
  );

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedSeniority("all");
  };

  const hasActiveFilters = searchQuery || selectedCategory !== "all" || selectedSeniority !== "all";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text flex items-center gap-2 sm:gap-3">
              <BookTemplate className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
              <span className="truncate">Interview Templates</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
              Ready-to-use templates for various roles
            </p>
          </div>
          <Dialog open={createDialogOpen || !!editingTemplate} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) {
              setEditingTemplate(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="lg" className="w-full sm:w-auto min-h-[44px]">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Edit Template" : "Create New Template"}</DialogTitle>
                <DialogDescription>
                  Save your interview configuration as a reusable template
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Basic Information</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Template Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Senior React Developer"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role_type">Role Type *</Label>
                      <Input
                        id="role_type"
                        value={formData.role_type}
                        onChange={(e) => setFormData({ ...formData, role_type: e.target.value })}
                        placeholder="e.g., Frontend Developer"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe this template and when to use it..."
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="behavioral">Behavioral</SelectItem>
                          <SelectItem value="domain-specific">Domain Specific</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="seniority">Seniority Level *</Label>
                      <Select value={formData.seniority_level} onValueChange={(value) => setFormData({ ...formData, seniority_level: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="junior">Junior</SelectItem>
                          <SelectItem value="mid">Mid-level</SelectItem>
                          <SelectItem value="senior">Senior</SelectItem>
                          <SelectItem value="lead">Lead</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time_limit">Time Limit (minutes) *</Label>
                      <Input
                        id="time_limit"
                        type="number"
                        value={formData.recommended_time_limit}
                        onChange={(e) => setFormData({ ...formData, recommended_time_limit: parseInt(e.target.value) })}
                        min={15}
                        max={180}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Question Distribution */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Question Distribution (%)</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Multiple Choice</Label>
                        <span className="text-sm text-muted-foreground">{formData.question_distribution.mcq}%</span>
                      </div>
                      <Slider
                        value={[formData.question_distribution.mcq]}
                        onValueChange={([value]) => setFormData({
                          ...formData,
                          question_distribution: { ...formData.question_distribution, mcq: value }
                        })}
                        max={100}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Scenario-Based</Label>
                        <span className="text-sm text-muted-foreground">{formData.question_distribution.scenario}%</span>
                      </div>
                      <Slider
                        value={[formData.question_distribution.scenario]}
                        onValueChange={([value]) => setFormData({
                          ...formData,
                          question_distribution: { ...formData.question_distribution, scenario: value }
                        })}
                        max={100}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Coding Challenges</Label>
                        <span className="text-sm text-muted-foreground">{formData.question_distribution.coding}%</span>
                      </div>
                      <Slider
                        value={[formData.question_distribution.coding]}
                        onValueChange={([value]) => setFormData({
                          ...formData,
                          question_distribution: { ...formData.question_distribution, coding: value }
                        })}
                        max={100}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Descriptive</Label>
                        <span className="text-sm text-muted-foreground">{formData.question_distribution.descriptive}%</span>
                      </div>
                      <Slider
                        value={[formData.question_distribution.descriptive]}
                        onValueChange={([value]) => setFormData({
                          ...formData,
                          question_distribution: { ...formData.question_distribution, descriptive: value }
                        })}
                        max={100}
                        step={5}
                      />
                    </div>
                  </div>
                  {Object.values(formData.question_distribution).reduce((a, b) => a + b, 0) !== 100 && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Question distribution must total 100%
                    </p>
                  )}
                </div>

                {/* Difficulty Distribution */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Difficulty Distribution (%)</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Easy</Label>
                        <span className="text-sm text-muted-foreground">{formData.difficulty_distribution.easy}%</span>
                      </div>
                      <Slider
                        value={[formData.difficulty_distribution.easy]}
                        onValueChange={([value]) => setFormData({
                          ...formData,
                          difficulty_distribution: { ...formData.difficulty_distribution, easy: value }
                        })}
                        max={100}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Medium</Label>
                        <span className="text-sm text-muted-foreground">{formData.difficulty_distribution.medium}%</span>
                      </div>
                      <Slider
                        value={[formData.difficulty_distribution.medium]}
                        onValueChange={([value]) => setFormData({
                          ...formData,
                          difficulty_distribution: { ...formData.difficulty_distribution, medium: value }
                        })}
                        max={100}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Hard</Label>
                        <span className="text-sm text-muted-foreground">{formData.difficulty_distribution.hard}%</span>
                      </div>
                      <Slider
                        value={[formData.difficulty_distribution.hard]}
                        onValueChange={([value]) => setFormData({
                          ...formData,
                          difficulty_distribution: { ...formData.difficulty_distribution, hard: value }
                        })}
                        max={100}
                        step={5}
                      />
                    </div>
                  </div>
                  {Object.values(formData.difficulty_distribution).reduce((a, b) => a + b, 0) !== 100 && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Difficulty distribution must total 100%
                    </p>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="Add tags (e.g., React, JavaScript)"
                    />
                    <Button type="button" onClick={addTag} variant="outline">
                      Add
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      createTemplate.isPending ||
                      updateTemplate.isPending ||
                      Object.values(formData.question_distribution).reduce((a, b) => a + b, 0) !== 100 ||
                      Object.values(formData.difficulty_distribution).reduce((a, b) => a + b, 0) !== 100
                    }
                  >
                    {(createTemplate.isPending || updateTemplate.isPending) ? "Saving..." : (editingTemplate ? "Update Template" : "Create Template")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <Card className="glass">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by role, name, tags, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={selectedSeniority} onValueChange={setSelectedSeniority}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Seniority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="mid">Mid-level</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {filteredTemplates?.length || 0} of {templates?.length || 0} templates</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Templates Grid */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="glass w-full sm:w-auto grid grid-cols-2 sm:flex h-auto gap-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm min-h-[44px]">All</TabsTrigger>
            <TabsTrigger value="technical" className="text-xs sm:text-sm min-h-[44px]">Technical</TabsTrigger>
            <TabsTrigger value="behavioral" className="text-xs sm:text-sm min-h-[44px]">Behavioral</TabsTrigger>
            <TabsTrigger value="domain-specific" className="text-xs sm:text-sm min-h-[44px]">Domain</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : filteredTemplates && filteredTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="glass hover-lift group">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <CardDescription className="line-clamp-2 mt-1">
                            {template.description || "No description"}
                          </CardDescription>
                        </div>
                        {template.is_public && (
                          <Badge variant="secondary" className="ml-2">
                            Public
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          <BookTemplate className="mr-1 h-3 w-3" />
                          {template.role_type}
                        </Badge>
                        <Badge variant="outline">
                          {template.seniority_level}
                        </Badge>
                        <Badge variant="outline" className="bg-gradient-to-r from-primary/10 to-accent/10">
                          {template.category}
                        </Badge>
                      </div>

                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {template.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {template.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 text-sm pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{template.recommended_time_limit}m</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{template.usage_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-warning" />
                          <span>{template.avg_rating?.toFixed(1) || "N/A"}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button 
                          className="flex-1 min-h-[44px] text-sm"
                          onClick={() => {
                            // Navigate to create-interview with template data pre-filled
                            navigate('/partner/recruiting/create-interview', {
                              state: {
                                fromTemplate: true,
                                templateId: template.id,
                                jobTitle: template.role_type,
                                templateName: template.name,
                                questionDistribution: template.question_distribution,
                                difficultyDistribution: template.difficulty_distribution,
                                timeLimit: template.recommended_time_limit,
                                tags: template.tags,
                                category: template.category,
                                seniorityLevel: template.seniority_level,
                              }
                            });
                          }}
                        >
                          <Play className="mr-1 sm:mr-2 h-4 w-4" />
                          Use Template
                        </Button>

                        {template.organization_id === orgData?.organization_id && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="min-h-[44px] min-w-[44px]"
                              onClick={() => handleEdit(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{template.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteTemplate.mutate(template.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="glass">
                <CardContent className="text-center py-12">
                  <BookTemplate className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium mb-2">No templates found</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    {searchQuery ? "Try a different search term" : "Create your first template to get started"}
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
  );
}
