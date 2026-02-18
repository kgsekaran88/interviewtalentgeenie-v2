import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { Loader2, Plus, Search, CheckCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  topic: string;
  difficulty: string;
  options?: any;
  correct_answer?: string;
  explanation?: string;
  tags?: string[];
  created_by: string;
  organization_id?: string;
  is_approved: boolean;
  created_at: string;
};

export default function QuestionRepository() {
  const { user } = useAuth();
  const { isTechSPOC, hasAnyRole } = useUserRoles();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTopic, setFilterTopic] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // All supported programming languages
  const ALL_LANGUAGES = ['java', 'javascript', 'typescript', 'python', 'sql', 'go', 'cpp', 'csharp', 'ruby', 'rust', 'kotlin', 'swift', 'php'];
  
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    question_type: 'mcq',
    topic: '',
    difficulty: 'medium',
    options: '',
    correct_answer: '',
    explanation: '',
    tags: '',
    allowed_languages: ALL_LANGUAGES,
  });

  useEffect(() => {
    fetchQuestions();
  }, [user]);

  const fetchQuestions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('question_repository' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestions((data || []) as unknown as Question[]);
    } catch (error: any) {
      logger.error('Error fetching questions:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async () => {
    if (!user || !newQuestion.question_text || !newQuestion.topic) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const questionData: any = {
        question_text: newQuestion.question_text,
        question_type: newQuestion.question_type,
        topic: newQuestion.topic,
        difficulty: newQuestion.difficulty,
        explanation: newQuestion.explanation || null,
        tags: newQuestion.tags ? newQuestion.tags.split(',').map(t => t.trim()) : [],
        created_by: user.id,
        is_approved: false,
      };

      if (newQuestion.question_type === 'mcq' && newQuestion.options) {
        try {
          questionData.options = JSON.parse(newQuestion.options);
        } catch (e) {
          toast({
            title: 'Invalid JSON',
            description: 'Options must be valid JSON format',
            variant: 'destructive',
          });
          return;
        }
      }

      if (newQuestion.correct_answer) {
        questionData.correct_answer = newQuestion.correct_answer;
      }

      const { error } = await supabase
        .from('question_repository' as any)
        .insert(questionData);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Question created and submitted for review',
      });

      setShowCreateDialog(false);
      setNewQuestion({
        question_text: '',
        question_type: 'mcq',
        topic: '',
        difficulty: 'medium',
        options: '',
        correct_answer: '',
        explanation: '',
        tags: '',
        allowed_languages: ALL_LANGUAGES,
      });
      fetchQuestions();
    } catch (error: any) {
      logger.error('Error creating question:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (questionId: string) => {
    if (!hasAnyRole(['platform_admin', 'tech_spoc'])) return;

    try {
      const { error } = await supabase
        .from('question_repository' as any)
        .update({ is_approved: true })
        .eq('id', questionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Question approved',
      });

      fetchQuestions();
    } catch (error: any) {
      logger.error('Error approving question:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.topic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = filterTopic === 'all' || q.topic === filterTopic;
    const matchesDifficulty = filterDifficulty === 'all' || q.difficulty === filterDifficulty;
    return matchesSearch && matchesTopic && matchesDifficulty;
  });

  const topics = Array.from(new Set(questions.map(q => q.topic)));

  if (!hasAnyRole(['platform_admin', 'tech_spoc', 'hr_recruiter'])) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">You don't have permission to access the question repository.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">Question Repository</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Centralized question bank for interviews</p>
          </div>
          
          {(isTechSPOC || hasAnyRole(['platform_admin'])) && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="self-start sm:self-auto min-h-[44px]">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Question
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto mx-2 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">Create New Question</DialogTitle>
                  <DialogDescription className="text-sm">
                    Add a new question to the repository. It will be submitted for Technical SPOC approval.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="question_text">Question Text *</Label>
                    <Textarea
                      id="question_text"
                      value={newQuestion.question_text}
                      onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                      placeholder="Enter the question..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="question_type">Question Type *</Label>
                      <Select
                        value={newQuestion.question_type}
                        onValueChange={(value) => setNewQuestion({ ...newQuestion, question_type: value })}
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple Choice</SelectItem>
                          <SelectItem value="coding">Coding</SelectItem>
                          <SelectItem value="descriptive">Descriptive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="difficulty">Difficulty *</Label>
                      <Select
                        value={newQuestion.difficulty}
                        onValueChange={(value) => setNewQuestion({ ...newQuestion, difficulty: value })}
                      >
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic *</Label>
                    <Input
                      id="topic"
                      value={newQuestion.topic}
                      onChange={(e) => setNewQuestion({ ...newQuestion, topic: e.target.value })}
                      placeholder="e.g., JavaScript, React, Data Structures"
                      className="min-h-[44px]"
                    />
                  </div>

                  {newQuestion.question_type === 'mcq' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="options">Options (JSON format) *</Label>
                        <Textarea
                          id="options"
                          value={newQuestion.options}
                          onChange={(e) => setNewQuestion({ ...newQuestion, options: e.target.value })}
                          placeholder='{"A": "Option 1", "B": "Option 2", "C": "Option 3", "D": "Option 4"}'
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="correct_answer">Correct Answer *</Label>
                        <Input
                          id="correct_answer"
                          value={newQuestion.correct_answer}
                          onChange={(e) => setNewQuestion({ ...newQuestion, correct_answer: e.target.value })}
                          placeholder="A"
                          className="min-h-[44px]"
                        />
                      </div>
                    </>
                  )}

                  {newQuestion.question_type === 'coding' && (
                    <div className="space-y-2">
                      <Label htmlFor="allowed_languages">Allowed Languages (comma-separated)</Label>
                      <Input
                        id="allowed_languages"
                        value={newQuestion.allowed_languages.join(', ')}
                        onChange={(e) => setNewQuestion({ 
                          ...newQuestion, 
                          allowed_languages: e.target.value.split(',').map(l => l.trim().toLowerCase()).filter(Boolean)
                        })}
                        placeholder="java, javascript, typescript, python, sql, go, cpp, csharp, ruby, rust, kotlin, swift, php"
                        className="min-h-[44px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Supported: java, javascript, typescript, python, sql, go, cpp (C++), csharp (C#), ruby, rust, kotlin, swift, php
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="explanation">Explanation</Label>
                    <Textarea
                      id="explanation"
                      value={newQuestion.explanation}
                      onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                      placeholder="Optional explanation..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={newQuestion.tags}
                      onChange={(e) => setNewQuestion({ ...newQuestion, tags: e.target.value })}
                      placeholder="frontend, react, hooks"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="min-h-[44px]">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateQuestion} className="min-h-[44px]">
                    Submit for Review
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="search" className="text-sm">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search questions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 min-h-[44px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-topic" className="text-sm">Topic</Label>
                <Select value={filterTopic} onValueChange={setFilterTopic}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics.map(topic => (
                      <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2 md:col-span-1">
                <Label htmlFor="filter-difficulty" className="text-sm">Difficulty</Label>
                <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredQuestions.length === 0 ? (
              <Card>
                <CardContent className="py-8 sm:py-12 text-center">
                  <p className="text-sm sm:text-base text-muted-foreground">No questions found. Create your first question to get started!</p>
                </CardContent>
              </Card>
            ) : (
              filteredQuestions.map((question) => (
                <Card key={question.id}>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <CardTitle className="text-sm sm:text-lg leading-relaxed">{question.question_text}</CardTitle>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{question.question_type}</Badge>
                          <Badge variant="outline" className="text-xs">{question.topic}</Badge>
                          <Badge variant="outline" className="text-xs">{question.difficulty}</Badge>
                          {question.is_approved ? (
                            <Badge className="bg-green-500 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {hasAnyRole(['platform_admin', 'tech_spoc']) && !question.is_approved && (
                        <Button size="sm" onClick={() => handleApprove(question.id)} className="self-start min-h-[40px]">
                          Approve
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  {question.explanation && (
                    <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">{question.explanation}</p>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
    </div>
  );
}
