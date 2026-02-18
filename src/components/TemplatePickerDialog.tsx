import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookTemplate, Search, Clock, Users, Star, ArrowRight, Filter } from 'lucide-react';

interface TemplatePickerDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectTemplate?: (template: any) => void;
  navigateToBuilder?: boolean; // If true, navigate to JD builder with template pre-filled
}

export function TemplatePickerDialog({ 
  trigger, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  onSelectTemplate,
  navigateToBuilder = true
}: TemplatePickerDialogProps) {
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [seniorityFilter, setSeniorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['interview-templates-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interview_templates')
        .select('*')
        .order('usage_count', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Filter templates
  const filteredTemplates = templates?.filter((t) => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.role_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSeniority = seniorityFilter === 'all' || t.seniority_level === seniorityFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    
    return matchesSearch && matchesSeniority && matchesCategory;
  });

  const handleSelectTemplate = (template: any) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
    
    if (navigateToBuilder) {
      // Navigate to JD builder with template data pre-filled
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
          // Pass cloud/domain context if available from template metadata
          primaryCloud: template.primary_cloud || null,
          industry: template.industry || template.category || null,
        }
      });
    }
    
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookTemplate className="h-5 w-5" />
            Choose a Template
          </DialogTitle>
          <DialogDescription>
            Select a pre-configured template to quickly create an interview
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by role, name, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={seniorityFilter} onValueChange={setSeniorityFilter}>
              <SelectTrigger className="w-[130px]">
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="behavioral">Behavioral</SelectItem>
                <SelectItem value="domain-specific">Domain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Templates Grid */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredTemplates && filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <Card 
                  key={template.id} 
                  className="group cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base group-hover:text-primary transition-colors">
                          {template.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-xs mt-1">
                          {template.description || template.role_type}
                        </CardDescription>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Badge variant="outline" className="text-xs">
                        {template.seniority_level}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                      {template.tags?.slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs bg-muted/50">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {template.recommended_time_limit}m
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {template.usage_count || 0} uses
                      </span>
                      {template.avg_rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-warning" />
                          {template.avg_rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <BookTemplate className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No templates found</p>
              <p className="text-xs">Try adjusting your filters</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
