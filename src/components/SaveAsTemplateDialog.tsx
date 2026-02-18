import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookTemplate, Save, X } from 'lucide-react';

interface SaveAsTemplateDialogProps {
  trigger?: React.ReactNode;
  defaultValues?: {
    name?: string;
    description?: string;
    role_type?: string;
    seniority_level?: string;
    recommended_time_limit?: number;
    question_distribution?: { mcq: number; scenario: number; coding: number; descriptive: number };
    difficulty_distribution?: { easy: number; medium: number; hard: number };
    tags?: string[];
  };
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SaveAsTemplateDialog({ 
  trigger, 
  defaultValues,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: SaveAsTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  
  const [formData, setFormData] = useState({
    name: defaultValues?.name || '',
    description: defaultValues?.description || '',
    category: 'technical',
    role_type: defaultValues?.role_type || '',
    seniority_level: defaultValues?.seniority_level || 'mid',
    recommended_time_limit: defaultValues?.recommended_time_limit || 60,
    question_distribution: defaultValues?.question_distribution || { mcq: 40, scenario: 30, coding: 20, descriptive: 10 },
    difficulty_distribution: defaultValues?.difficulty_distribution || { easy: 30, medium: 50, hard: 20 },
    tags: defaultValues?.tags || [],
    is_public: false,
  });
  const [tagInput, setTagInput] = useState('');

  // Get user's organization
  const { data: orgData } = useQuery({
    queryKey: ['user-organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      return data;
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('interview_templates')
        .insert({
          name: data.name,
          description: data.description,
          category: data.category,
          role_type: data.role_type,
          seniority_level: data.seniority_level,
          recommended_time_limit: data.recommended_time_limit,
          question_distribution: data.question_distribution,
          difficulty_distribution: data.difficulty_distribution,
          tags: data.tags,
          is_public: data.is_public,
          created_by: user.id,
          organization_id: orgData?.organization_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['interview-templates'] });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to save template: ${error.message}`);
    },
  });

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.role_type.trim()) {
      toast.error('Please fill in required fields');
      return;
    }
    createTemplate.mutate(formData);
  };

  // Update form when defaultValues change
  React.useEffect(() => {
    if (defaultValues) {
      setFormData(prev => ({
        ...prev,
        name: defaultValues.name || prev.name,
        description: defaultValues.description || prev.description,
        role_type: defaultValues.role_type || prev.role_type,
        seniority_level: defaultValues.seniority_level || prev.seniority_level,
        recommended_time_limit: defaultValues.recommended_time_limit || prev.recommended_time_limit,
        question_distribution: defaultValues.question_distribution || prev.question_distribution,
        difficulty_distribution: defaultValues.difficulty_distribution || prev.difficulty_distribution,
        tags: defaultValues.tags || prev.tags,
      }));
    }
  }, [defaultValues]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookTemplate className="h-5 w-5" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Save this configuration as a reusable interview template
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Senior React Developer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-type">Role Type *</Label>
              <Input
                id="role-type"
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
              placeholder="Describe when to use this template..."
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
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
              <Label>Seniority</Label>
              <Select value={formData.seniority_level} onValueChange={(v) => setFormData({ ...formData, seniority_level: v })}>
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
              <Label>Time (min)</Label>
              <Input
                type="number"
                value={formData.recommended_time_limit}
                onChange={(e) => setFormData({ ...formData, recommended_time_limit: parseInt(e.target.value) || 60 })}
                min={15}
                max={180}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tags..."
                className="flex-1"
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm">
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTemplate.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {createTemplate.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
