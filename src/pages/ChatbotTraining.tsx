import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  X,
  Search,
  BookOpen,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type KnowledgeEntry = {
  id: string;
  title: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  role_specific: string[];
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = [
  'interview_management',
  'proctoring',
  'ai_features',
  'reports',
  'roles_permissions',
  'candidate_workflow',
  'integrations',
  'billing',
  'security',
  'troubleshooting',
];

const ROLES = [
  { value: 'all', label: 'All Roles' },
  { value: 'platform_admin', label: 'Platform Admin' },
  { value: 'partner_admin', label: 'Partner Admin' },
  { value: 'hr_recruiter', label: 'HR Recruiter' },
  { value: 'technical_spoc', label: 'Technical SPOC' },
  { value: 'candidate', label: 'Candidate' },
];

export default function ChatbotTraining() {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    question: '',
    answer: '',
    category: 'interview_management',
    tags: '',
    role_specific: [] as string[],
    is_active: true,
    priority: 5,
  });
  const [isEnhancing, setIsEnhancing] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chatbot_knowledge')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load knowledge entries.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const entryData = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      if (editingEntry) {
        const { error } = await supabase
          .from('chatbot_knowledge')
          .update(entryData)
          .eq('id', editingEntry.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Knowledge entry updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from('chatbot_knowledge')
          .insert(entryData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Knowledge entry created successfully.",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadEntries();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save knowledge entry.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const { error } = await supabase
        .from('chatbot_knowledge')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Knowledge entry deleted successfully.",
      });

      loadEntries();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete knowledge entry.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      tags: entry.tags.join(', '),
      role_specific: entry.role_specific,
      is_active: entry.is_active,
      priority: entry.priority,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormData({
      title: '',
      question: '',
      answer: '',
      category: 'interview_management',
      tags: '',
      role_specific: [],
      is_active: true,
      priority: 5,
    });
  };

  const handleRoleToggle = (role: string) => {
    setFormData(prev => ({
      ...prev,
      role_specific: prev.role_specific.includes(role)
        ? prev.role_specific.filter(r => r !== role)
        : [...prev.role_specific, role],
    }));
  };

  const handleEnhanceWithAI = async () => {
    if (!formData.question && !formData.answer) {
      toast({
        title: "Nothing to enhance",
        description: "Please add a question or answer first.",
        variant: "destructive",
      });
      return;
    }

    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-content-with-ai', {
        body: {
          content: formData.answer || formData.question,
          contentType: 'chatbot_knowledge',
          title: formData.title,
          context: {
            question: formData.question,
            answer: formData.answer,
            category: formData.category,
          }
        }
      });

      if (error) throw error;

      if (data?.success && data?.enhanced) {
        setFormData(prev => ({
          ...prev,
          title: data.enhanced.title || prev.title,
          question: data.enhanced.question || prev.question,
          answer: data.enhanced.answer || prev.answer,
        }));
        
        toast({
          title: "Enhanced!",
          description: "Content has been improved with AI.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Enhancement failed",
        description: error.message || "Failed to enhance content with AI.",
        variant: "destructive",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = searchQuery === '' || 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
    const matchesRole = filterRole === 'all' || 
      entry.role_specific.length === 0 || 
      entry.role_specific.includes(filterRole);

    return matchesSearch && matchesCategory && matchesRole;
  });

  return (
    <div className="container mx-auto py-4 sm:py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
            <BookOpen className="h-6 w-6 sm:h-10 sm:w-10 text-primary" />
            Chatbot Knowledge Base
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage custom Q&A pairs and knowledge articles for role-specific responses
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="min-h-[44px] w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Knowledge
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="pt-4 sm:pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search knowledge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger>
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Entries */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading knowledge base...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No knowledge entries found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || filterCategory || filterRole 
                ? 'Try adjusting your filters' 
                : 'Get started by adding your first knowledge entry'}
            </p>
            {!searchQuery && !filterCategory && !filterRole && (
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Entry
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                      {!entry.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      <Badge variant="outline">Priority: {entry.priority}</Badge>
                    </div>
                    <CardDescription className="text-sm">
                      <strong>Q:</strong> {entry.question}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  <strong>A:</strong> {entry.answer}
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge>{entry.category.replace(/_/g, ' ')}</Badge>
                  {entry.role_specific.length > 0 ? (
                    entry.role_specific.map(role => (
                      <Badge key={role} variant="secondary">{role}</Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">All Roles</Badge>
                  )}
                  {entry.tags.map(tag => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit' : 'Add'} Knowledge Entry</DialogTitle>
            <DialogDescription>
              Create or update a custom Q&A pair for the chatbot knowledge base
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="E.g., Create Interview - Admin"
              />
            </div>

            <div>
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                value={formData.question}
                onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                placeholder="What question should this answer?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="answer">Answer</Label>
              <Textarea
                id="answer"
                value={formData.answer}
                onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                placeholder="Provide a comprehensive answer..."
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority (0-10)</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="interview, setup, beginner"
              />
            </div>

            <div>
              <Label>Specific Roles (leave empty for all roles)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ROLES.filter(r => r.value).map(role => (
                  <div key={role.value} className="flex items-center space-x-2">
                    <Switch
                      checked={formData.role_specific.includes(role.value)}
                      onCheckedChange={() => handleRoleToggle(role.value)}
                    />
                    <span className="text-sm">{role.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="secondary" 
              onClick={handleEnhanceWithAI}
              disabled={isEnhancing || (!formData.question && !formData.answer)}
              className="gap-2"
            >
              {isEnhancing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                {editingEntry ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
