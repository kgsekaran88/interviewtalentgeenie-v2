import { useState } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { supabase } from '@/integrations/supabase/client';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { FileText, Wand2, Save, Eye, Loader2, History, Download, Sparkles, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import DocumentVersionHistory from '@/components/DocumentVersionHistory';

type DocumentStatus = 'draft' | 'review' | 'published';

export default function DocumentationGenerator() {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [status, setStatus] = useState<DocumentStatus>('draft');
  const [savedDocs, setSavedDocs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const { toast, errorToast, successToast } = useUserFriendlyToast();

  const generateDocumentation = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter what documentation you want to generate.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await invokeFunction('generate-documentation', {
        body: { prompt }
      });

      if (error) throw error;

      setGeneratedContent(data.content);
      setStatus('review');
      toast({
        title: "Documentation Generated",
        description: "Review the content and save when ready."
      });
    } catch (error) {
      logger.error('Generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate documentation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const improveFormat = async () => {
    if (!generatedContent.trim()) {
      toast({
        title: "No Content",
        description: "Generate content first before improving format.",
        variant: "destructive"
      });
      return;
    }

    setIsImproving(true);
    try {
      const { data, error } = await invokeFunction('improve-documentation-format', {
        body: { content: generatedContent }
      });

      if (error) throw error;

      setGeneratedContent(data.content);
      toast({
        title: "Format Improved",
        description: "Documentation formatting has been enhanced."
      });
    } catch (error) {
      logger.error('Format improvement error:', error);
      toast({
        title: "Improvement Failed",
        description: "Failed to improve formatting.",
        variant: "destructive"
      });
    } finally {
      setIsImproving(false);
    }
  };

  const exportAsMarkdown = () => {
    if (!generatedContent) {
      toast({
        title: "No Content",
        description: "Generate content first to export.",
        variant: "destructive"
      });
      return;
    }

    const blob = new Blob([generatedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "Document exported as Markdown."
    });
  };

  const exportAsPDF = () => {
    if (!generatedContent) {
      toast({
        title: "No Content",
        description: "Generate content first to export.",
        variant: "destructive"
      });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;
    
    // Add title
    doc.setFontSize(16);
    doc.text(title || 'Documentation', margin, 20);
    
    // Add content
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(generatedContent, maxWidth);
    doc.text(lines, margin, 35);
    
    doc.save(`${title || 'document'}.pdf`);

    toast({
      title: "Exported",
      description: "Document exported as PDF."
    });
  };

  const saveDocumentation = async () => {
    if (!title.trim() || !generatedContent.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a title and generate content first.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (currentDocId) {
        // Update existing document with versioning
        const { data: existingDoc } = await supabase
          .from('platform_documentation')
          .select('version_number')
          .eq('id', currentDocId)
          .single();

        const newVersion = (existingDoc?.version_number || 1) + 1;

        // Save current version to history
        await supabase
          .from('platform_documentation_versions')
          .insert({
            document_id: currentDocId,
            version_number: newVersion - 1,
            title,
            content: generatedContent,
            category: category || 'general',
            created_by: user.id
          });

        // Update main document
        const { error: updateError } = await supabase
          .from('platform_documentation')
          .update({
            title,
            content: generatedContent,
            category: category || 'general',
            version_number: newVersion
          })
          .eq('id', currentDocId);

        if (updateError) throw updateError;
      } else {
        // Create new document
        const { data: newDoc, error } = await supabase
          .from('platform_documentation')
          .insert({
            title,
            content: generatedContent,
            category: category || 'general',
            status: 'published',
            created_by: user.id,
            prompt_used: prompt,
            version_number: 1
          })
          .select()
          .single();

        if (error) throw error;
        setCurrentDocId(newDoc.id);
      }

      toast({
        title: "Documentation Saved",
        description: "Document has been saved to the docs section."
      });

      // Refresh history
      fetchSavedDocs();
    } catch (error) {
      logger.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save documentation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchSavedDocs = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_documentation')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSavedDocs(data || []);
    } catch (error) {
      logger.error('Fetch docs error:', error);
    }
  };

  const loadDocument = (doc: any) => {
    setTitle(doc.title);
    setCategory(doc.category);
    setPrompt(doc.prompt_used || '');
    setGeneratedContent(doc.content);
    setStatus('review');
    setCurrentDocId(doc.id);
    setShowHistory(false);
  };

  const handleRestoreVersion = (content: string, versionTitle: string, versionCategory: string) => {
    setGeneratedContent(content);
    setTitle(versionTitle);
    setCategory(versionCategory);
    setStatus('review');
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Documentation Generator</h1>
          <p className="text-sm text-muted-foreground mt-1 sm:mt-2">
            AI-powered documentation creation for the platform
          </p>
        </div>
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={fetchSavedDocs} className="min-h-[44px] self-start sm:self-auto">
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle>Documentation History</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {savedDocs.map((doc) => (
                  <Card key={doc.id} className="cursor-pointer hover:bg-accent" onClick={() => loadDocument(doc)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{doc.title}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {doc.category} • {new Date(doc.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {doc.status}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Generation Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Generate Documentation
            </CardTitle>
            <CardDescription>
              Describe what documentation you need and AI will generate it
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Document Title</Label>
              <Input
                id="title"
                placeholder="e.g., User Guide for Proctoring System"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., User Guide, API Reference, Admin Guide"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">What documentation do you need?</Label>
              <Textarea
                id="prompt"
                placeholder="e.g., Create a comprehensive guide explaining how to set up and use the proctoring system, including pre-interview checks, real-time monitoring, and reviewing violations..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>

            <Button
              onClick={generateDocumentation}
              disabled={isGenerating || !prompt.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Documentation
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview & Review
                </CardTitle>
                <CardDescription>
                  Review generated content before saving
                </CardDescription>
              </div>
              <Badge variant={status === 'draft' ? 'secondary' : status === 'review' ? 'default' : 'outline'} className={status === 'published' ? 'bg-green-500 text-white' : ''}>
                {status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {generatedContent ? (
              <div className="space-y-4">
                <ScrollArea className="h-[400px] border rounded-lg p-4 bg-background/50">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{generatedContent}</ReactMarkdown>
                  </div>
                </ScrollArea>

                <div className="space-y-2">
                  <Label htmlFor="edit-content">Edit Content (Optional)</Label>
                  <Textarea
                    id="edit-content"
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={improveFormat}
                    disabled={isImproving}
                  >
                    {isImproving ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Improving...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-2" />
                        Improve Format
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportAsMarkdown}
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Export MD
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportAsPDF}
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Export PDF
                  </Button>
                  {currentDocId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowVersionHistory(true)}
                    >
                      <Clock className="h-3 w-3 mr-2" />
                      Versions
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={saveDocumentation}
                    disabled={isSaving || !title.trim()}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save to Docs
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGeneratedContent('');
                      setStatus('draft');
                      setCurrentDocId(null);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <FileText className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm">No content generated yet</p>
                <p className="text-xs mt-1">Enter a prompt and generate documentation to preview</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentVersionHistory
        documentId={currentDocId}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        onRestoreVersion={handleRestoreVersion}
      />
    </div>
  );
}
