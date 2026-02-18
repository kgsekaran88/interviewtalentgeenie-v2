import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Award, Eye, XCircle, CheckCircle, AlertTriangle, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';

export default function CertificationAdmin() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any>(null);
  const [globalConfig, setGlobalConfig] = useState<any>(null);
  const [topicForm, setTopicForm] = useState({
    name: '',
    display_name: '',
    description: '',
    category: '',
    provider: 'Platform',
    difficulty_level: 'intermediate',
    passing_score: 70,
    required_questions: 50,
    certificate_validity_days: 365,
    recommended_experience: '',
    syllabus_content: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [{ data: topicsData }, { data: certificatesData }, { data: configData }] = await Promise.all([
        supabase.from('certification_topics' as any).select('*').order('name') as any,
        supabase.from('certificates' as any).select('*, certification_topics:certification_topic_id(*)').order('issued_at', { ascending: false }) as any,
        supabase.from('certification_global_config' as any).select('*').single() as any,
      ]);

      setTopics(topicsData || []);
      setCertificates(certificatesData || []);
      if (configData) {
        setGlobalConfig(configData.config);
      }
    } catch (error) {
      logger.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeCertificate = async (certificateId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('certificates' as any)
        .update({
          is_revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_reason: reason,
        } as any)
        .eq('id', certificateId);

      if (error) throw error;

      toast.success('Certificate revoked successfully');
      fetchData();
    } catch (error) {
      logger.error('Error revoking certificate:', error);
      toast.error('Failed to revoke certificate');
    }
  };

  const handleRestoreCertificate = async (certificateId: string) => {
    try {
      const { error } = await supabase
        .from('certificates' as any)
        .update({
          is_revoked: false,
          revoked_at: null,
          revoked_reason: null,
        } as any)
        .eq('id', certificateId);

      if (error) throw error;

      toast.success('Certificate restored successfully');
      fetchData();
    } catch (error) {
      logger.error('Error restoring certificate:', error);
      toast.error('Failed to restore certificate');
    }
  };

  const generateIdFromDisplayName = (displayName: string): string => {
    const base = displayName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 40);
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${base}-${suffix}`;
  };

  const handleOpenTopicDialog = (topic?: any) => {
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({
        name: topic.name,
        display_name: topic.display_name,
        description: topic.description || '',
        category: topic.category,
        provider: topic.provider,
        difficulty_level: topic.difficulty_level,
        passing_score: topic.passing_score,
        required_questions: topic.required_questions,
        certificate_validity_days: topic.certificate_validity_days,
        recommended_experience: topic.recommended_experience || '',
        syllabus_content: typeof topic.syllabus_topics === 'string' ? topic.syllabus_topics : (Array.isArray(topic.syllabus_topics) ? topic.syllabus_topics.join(', ') : ''),
      });
    } else {
      setEditingTopic(null);
      const config = globalConfig || {};
      setTopicForm({
        name: '',
        display_name: '',
        description: '',
        category: '',
        provider: 'Platform',
        difficulty_level: 'intermediate',
        passing_score: config.exam_settings?.passing_score_percentage || 70,
        required_questions: config.question_generation?.total_questions || 50,
        certificate_validity_days: config.certificate_validity_days || 365,
        recommended_experience: '',
        syllabus_content: '',
      });
    }
    setIsTopicDialogOpen(true);
  };

  const handleSaveTopic = async () => {
    try {
      if (!topicForm.display_name || !topicForm.category || !topicForm.syllabus_content) {
        toast.error('Please fill in all required fields');
        return;
      }

      const dataToSave = {
        ...topicForm,
        name: editingTopic ? topicForm.name : generateIdFromDisplayName(topicForm.display_name),
        syllabus_topics: topicForm.syllabus_content,
      };

      const { syllabus_content, ...finalData } = dataToSave;

      if (editingTopic) {
        const { error } = await supabase
          .from('certification_topics' as any)
          .update(finalData as any)
          .eq('id', editingTopic.id);

        if (error) throw error;
        toast.success('Topic updated successfully');
      } else {
        const { error } = await supabase
          .from('certification_topics' as any)
          .insert([finalData] as any);

        if (error) throw error;
        toast.success('Topic created successfully');
      }

      setIsTopicDialogOpen(false);
      fetchData();
    } catch (error) {
      logger.error('Error saving topic:', error);
      toast.error('Failed to save topic');
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      const { error } = await supabase
        .from('certification_topics' as any)
        .update({ is_active: false } as any)
        .eq('id', topicId);

      if (error) throw error;

      toast.success('Topic deactivated successfully');
      fetchData();
    } catch (error) {
      logger.error('Error deactivating topic:', error);
      toast.error('Failed to deactivate topic');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Certification Management</h1>
              <p className="text-sm text-muted-foreground">Manage certification topics and certificates</p>
            </div>
            <Button onClick={() => navigate('/certification-analytics')} className="min-h-[44px] self-start sm:self-auto">
              View Analytics
            </Button>
          </div>

          <Tabs defaultValue="certificates" className="space-y-4">
            <TabsList className="h-auto grid grid-cols-2 sm:inline-flex">
              <TabsTrigger value="certificates" className="text-xs sm:text-sm min-h-[44px]">Issued Certificates</TabsTrigger>
              <TabsTrigger value="topics" className="text-xs sm:text-sm min-h-[44px]">Certification Topics</TabsTrigger>
            </TabsList>

            <TabsContent value="certificates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Certificates</CardTitle>
                  <CardDescription>View and manage issued certificates</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Certificate #</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Integrity</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {certificates.map((cert: any) => (
                        <TableRow key={cert.id}>
                          <TableCell className="font-mono text-xs">{cert.certificate_number}</TableCell>
                          <TableCell>{cert.user_id.substring(0, 8)}...</TableCell>
                          <TableCell>{(cert as any).certification_topics?.name || 'Unknown'}</TableCell>
                          <TableCell>{cert.score}%</TableCell>
                          <TableCell>{cert.integrity_score}/100</TableCell>
                          <TableCell>{new Date(cert.issued_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {cert.is_revoked ? (
                              <Badge variant="destructive">
                                <XCircle className="w-3 h-3 mr-1" />
                                Revoked
                              </Badge>
                            ) : new Date(cert.expires_at) < new Date() ? (
                              <Badge variant="secondary">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Expired
                              </Badge>
                            ) : (
                              <Badge variant="default">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/verify-certificate?code=${cert.verification_code}`)}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                              {!cert.is_revoked ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Revoke
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Revoke Certificate?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will invalidate the certificate. The holder will no longer be able to verify it.
                                        This action can be reversed.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleRevokeCertificate(cert.id, 'Revoked by admin')}
                                      >
                                        Revoke
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRestoreCertificate(cert.id)}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Restore
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="topics" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Certification Topics</CardTitle>
                      <CardDescription>All available certification paths</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => navigate('/admin/certification-configuration')}>
                        Configuration
                      </Button>
                      <Button onClick={() => handleOpenTopicDialog()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Topic
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {topics.filter(t => t.is_active !== false).map((topic: any) => (
                      <Card key={topic.id} className="flex flex-col">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base line-clamp-1">{topic.display_name}</CardTitle>
                              <CardDescription className="text-xs">{topic.provider} • {topic.category}</CardDescription>
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">{topic.difficulty_level}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3 flex-1 flex flex-col">
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">{topic.description}</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            <Badge variant="outline" className="text-xs">Q: {topic.required_questions}</Badge>
                            <Badge variant="outline" className="text-xs">Pass: {topic.passing_score}%</Badge>
                            <Badge variant="outline" className="text-xs">Valid: {topic.certificate_validity_days}d</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8"
                              onClick={() => handleOpenTopicDialog(topic)}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="flex-1 h-8">
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Deactivate
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate Topic?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will hide the topic from users. Existing certificates will remain valid.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTopic(topic.id)}>
                                    Deactivate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

      {/* Topic Create/Edit Dialog */}
      <Dialog open={isTopicDialogOpen} onOpenChange={setIsTopicDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTopic ? 'Edit Topic' : 'Create Topic'}</DialogTitle>
            <DialogDescription>
              {editingTopic ? 'Update certification topic details' : 'Create a new certification topic'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={topicForm.display_name}
                onChange={(e) => {
                  const displayName = e.target.value;
                  setTopicForm({ 
                    ...topicForm, 
                    display_name: displayName,
                    name: editingTopic ? topicForm.name : generateIdFromDisplayName(displayName)
                  });
                }}
                placeholder="e.g., AWS Solutions Architect"
              />
              {topicForm.display_name && !editingTopic && (
                <p className="text-xs text-muted-foreground mt-1">
                  ID will be: {generateIdFromDisplayName(topicForm.display_name)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={topicForm.description}
                onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                placeholder="Brief description of the certification"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={topicForm.category}
                  onChange={(e) => setTopicForm({ ...topicForm, category: e.target.value })}
                  placeholder="e.g., Cloud, Programming"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={topicForm.provider}
                  onChange={(e) => setTopicForm({ ...topicForm, provider: e.target.value })}
                  placeholder="e.g., AWS, Platform"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="syllabus_content">Syllabus Content *</Label>
              <Textarea
                id="syllabus_content"
                value={topicForm.syllabus_content}
                onChange={(e) => setTopicForm({ ...topicForm, syllabus_content: e.target.value })}
                placeholder="Paste full certification syllabus or description here..."
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                AI will extract topics and generate questions from this content when candidates start the certification.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select
                  value={topicForm.difficulty_level}
                  onValueChange={(value) => setTopicForm({ ...topicForm, difficulty_level: value })}
                >
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
              <div className="space-y-2">
                <Label htmlFor="passing_score">Passing Score (%)</Label>
                <Input
                  id="passing_score"
                  type="number"
                  value={topicForm.passing_score}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">From Configuration</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="required_questions">Questions Count</Label>
                <Input
                  id="required_questions"
                  type="number"
                  value={topicForm.required_questions}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">From Configuration</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validity">Certificate Validity (days)</Label>
                <Input
                  id="validity"
                  type="number"
                  value={topicForm.certificate_validity_days}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">From Configuration</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Recommended Experience</Label>
                <Input
                  id="experience"
                  value={topicForm.recommended_experience}
                  onChange={(e) => setTopicForm({ ...topicForm, recommended_experience: e.target.value })}
                  placeholder="e.g., 2+ years"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTopicDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTopic}>
              {editingTopic ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}