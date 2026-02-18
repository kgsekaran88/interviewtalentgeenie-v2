import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Save, Loader2, Mail, Eye, RotateCcw, FileText, Code, 
  CheckCircle2, Info, Edit3, Bold, Italic, Link2, List, ListOrdered,
  Type, Palette, Sparkles, Wand2
} from 'lucide-react';

interface EmailTemplate {
  id: string;
  template_key: string;
  organization_id: string | null;
  subject: string;
  html_content: string;
  description: string | null;
  available_variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailTemplateEditorProps {
  organizationId?: string | null;
}

const TEMPLATE_LABELS: Record<string, string> = {
  interview_invitation: 'Interview Invitation',
  password_setup: 'Password Setup / Account Activation',
  assessment_ready: 'Assessment Report Ready',
  partner_application_submitted: 'Partner Application Submitted',
  partner_application_approved: 'Partner Application Approved',
  partner_application_rejected: 'Partner Application Rejected',
  certificate_issued: 'Certificate Issued',
  plan_limit_warning: 'Plan Limit Warning',
  test_email: 'Test Email',
};

export default function EmailTemplateEditor({ organizationId = null }: EmailTemplateEditorProps) {
  const { toast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, { subject: string; html_content: string }>>({});
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [activeEditorTab, setActiveEditorTab] = useState<Record<string, string>>({});
  const visualEditorRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  
  // AI Enhancement state
  const [enhanceTemplateId, setEnhanceTemplateId] = useState<string | null>(null);
  const [enhanceInstructions, setEnhanceInstructions] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  useEffect(() => {
    fetchTemplates();
  }, [organizationId]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      // Fetch platform-wide templates (organization_id is null)
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .is('organization_id', null)
        .order('template_key');

      if (error) throw error;

      setTemplates(data || []);
      
      // Initialize edited templates state
      const edited: Record<string, { subject: string; html_content: string }> = {};
      data?.forEach(t => {
        edited[t.id] = { subject: t.subject, html_content: t.html_content };
      });
      setEditedTemplates(edited);
    } catch (error) {
      logger.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (template: EmailTemplate) => {
    const edited = editedTemplates[template.id];
    if (!edited) return;

    try {
      setSaving(template.id);

      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: edited.subject,
          html_content: edited.html_content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', template.id);

      if (error) throw error;

      // Update local state
      setTemplates(prev => prev.map(t => 
        t.id === template.id 
          ? { ...t, subject: edited.subject, html_content: edited.html_content }
          : t
      ));

      toast({
        title: 'Template Saved',
        description: `${TEMPLATE_LABELS[template.template_key] || template.template_key} template has been updated.`,
      });
    } catch (error) {
      logger.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleResetTemplate = (template: EmailTemplate) => {
    setEditedTemplates(prev => ({
      ...prev,
      [template.id]: { subject: template.subject, html_content: template.html_content }
    }));
    toast({
      title: 'Reset',
      description: 'Changes have been discarded.',
    });
  };

  const handlePreview = (template: EmailTemplate) => {
    const edited = editedTemplates[template.id];
    if (!edited) return;

    // Replace placeholders with sample data for preview
    let html = edited.html_content;
    const sampleData: Record<string, string> = {
      '{{organization_name}}': 'Acme Corporation',
      '{{candidate_name}}': 'John Doe',
      '{{interview_title}}': 'Senior Software Engineer',
      '{{question_count}}': '15',
      '{{time_limit}}': '60',
      '{{share_link}}': 'https://example.com/interview/abc123',
      '{{platform_name}}': 'TalentGeenie',
      '{{user_name}}': 'Jane Smith',
      '{{setup_url}}': 'https://example.com/setup/xyz789',
      '{{expiry_hours}}': '24',
      '{{recipient_name}}': 'HR Manager',
      '{{overall_score}}': '85',
      '{{recommendation}}': 'Strongly Recommend',
      '{{report_url}}': 'https://example.com/report/123',
      '{{contact_email}}': 'Support@talentgeenie.com',
      '{{industry}}': 'Technology',
      '{{company_size}}': '100-500',
      '{{plan_name}}': 'Enterprise',
      '{{review_url}}': 'https://example.com/review',
      '{{applicant_name}}': 'Mike Johnson',
      '{{dashboard_url}}': 'https://example.com/dashboard',
      '{{rejection_reason}}': 'Incomplete documentation',
      '{{certification_name}}': 'AWS Solutions Architect',
      '{{certificate_number}}': 'CERT-2024-001',
      '{{score}}': '92',
      '{{issued_date}}': 'December 23, 2024',
      '{{expiry_date}}': 'December 23, 2026',
      '{{verification_code}}': 'ABC123XYZ',
      '{{certificate_url}}': 'https://example.com/cert/123',
      '{{usage_percent}}': '85',
      '{{interviews_used}}': '85',
      '{{interviews_limit}}': '100',
      '{{users_used}}': '45',
      '{{users_limit}}': '50',
      '{{billing_url}}': 'https://example.com/billing',
      '{{sent_at}}': new Date().toLocaleString(),
    };

    // Handle conditional blocks (simplified)
    html = html.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
      return sampleData[`{{${variable}}}`] ? content : '';
    });

    // Replace all placeholders
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    setPreviewHtml(html);
    setPreviewTemplate(template);
  };

  const hasChanges = (template: EmailTemplate) => {
    const edited = editedTemplates[template.id];
    return edited && (
      edited.subject !== template.subject || 
      edited.html_content !== template.html_content
    );
  };

  // Visual editor functions
  const initVisualEditor = useCallback((templateId: string, htmlContent: string) => {
    const iframe = visualEditorRefs.current[templateId];
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Create editable document with styling
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            padding: 20px;
            margin: 0;
            max-width: 100%;
          }
          h1, h2, h3, h4 { color: #667eea; }
          a { color: #667eea; }
          ul, ol { padding-left: 20px; }
          img { max-width: 100%; height: auto; }
          [contenteditable]:focus { outline: 2px solid #667eea; outline-offset: 2px; }
          .variable-highlight { 
            background-color: #e8f0fe; 
            padding: 2px 4px; 
            border-radius: 3px; 
            font-family: monospace;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body contenteditable="true">${htmlContent}</body>
      </html>
    `);
    doc.close();

    // Listen for changes
    doc.body.addEventListener('input', () => {
      const newContent = doc.body.innerHTML;
      setEditedTemplates(prev => ({
        ...prev,
        [templateId]: { ...prev[templateId], html_content: newContent }
      }));
    });
  }, []);

  const applyFormatting = (templateId: string, command: string, value?: string) => {
    const iframe = visualEditorRefs.current[templateId];
    if (!iframe?.contentDocument) return;
    
    iframe.contentDocument.execCommand(command, false, value);
    iframe.contentWindow?.focus();
    
    // Update state with new content
    const newContent = iframe.contentDocument.body.innerHTML;
    setEditedTemplates(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], html_content: newContent }
    }));
  };

  const insertVariable = (templateId: string, variable: string) => {
    const iframe = visualEditorRefs.current[templateId];
    if (!iframe?.contentDocument) return;
    
    const selection = iframe.contentWindow?.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const variableNode = iframe.contentDocument.createElement('span');
      variableNode.className = 'variable-highlight';
      variableNode.textContent = `{{${variable}}}`;
      range.deleteContents();
      range.insertNode(variableNode);
      
      // Move cursor after the inserted variable
      range.setStartAfter(variableNode);
      range.setEndAfter(variableNode);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      iframe.contentDocument.execCommand('insertText', false, `{{${variable}}}`);
    }
    
    iframe.contentWindow?.focus();
    
    // Update state with new content
    const newContent = iframe.contentDocument.body.innerHTML;
    setEditedTemplates(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], html_content: newContent }
    }));
  };

  const syncFromVisualToHtml = (templateId: string) => {
    const iframe = visualEditorRefs.current[templateId];
    if (!iframe?.contentDocument) return;
    
    const bodyContent = iframe.contentDocument.body.innerHTML;
    setEditedTemplates(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], html_content: bodyContent }
    }));
  };

  const handleEditorTabChange = (templateId: string, tab: string) => {
    // Sync content when switching tabs
    if (activeEditorTab[templateId] === 'visual' && tab === 'html') {
      syncFromVisualToHtml(templateId);
    }
    
    setActiveEditorTab(prev => ({ ...prev, [templateId]: tab }));
    
    // Initialize visual editor when switching to it
    if (tab === 'visual') {
      setTimeout(() => {
        const content = editedTemplates[templateId]?.html_content || '';
        initVisualEditor(templateId, content);
      }, 100);
    }
  };

  const handleEnhanceWithAI = async () => {
    if (!enhanceTemplateId || !enhanceInstructions.trim()) return;
    
    const template = templates.find(t => t.id === enhanceTemplateId);
    const currentContent = editedTemplates[enhanceTemplateId]?.html_content;
    
    if (!template || !currentContent) return;
    
    try {
      setEnhancing(true);
      
      const { data, error } = await invokeFunction('enhance-email-content', {
        body: {
          htmlContent: currentContent,
          instructions: enhanceInstructions,
          templateVariables: template.available_variables,
        },
      });

      if (error) throw error;

      if (data.enhancedContent) {
        setEditedTemplates(prev => ({
          ...prev,
          [enhanceTemplateId]: { ...prev[enhanceTemplateId], html_content: data.enhancedContent }
        }));
        
        // Reinitialize visual editor if active
        if (activeEditorTab[enhanceTemplateId] === 'visual') {
          setTimeout(() => {
            initVisualEditor(enhanceTemplateId, data.enhancedContent);
          }, 100);
        }
        
        toast({
          title: 'Content Enhanced',
          description: 'The email content has been updated with AI suggestions.',
        });
      }
      
      setEnhanceTemplateId(null);
      setEnhanceInstructions('');
    } catch (error: any) {
      logger.error('Error enhancing content:', error);
      toast({
        title: 'Enhancement Failed',
        description: error.message || 'Failed to enhance content with AI',
        variant: 'destructive',
      });
    } finally {
      setEnhancing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Email Templates</h2>
        <Badge variant="secondary" className="ml-2">
          {templates.length} templates
        </Badge>
      </div>

      <div className="bg-muted/30 p-4 rounded-lg border mb-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Template Variables</p>
            <p className="text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{'{{variable_name}}'}</code> to insert dynamic content. 
              Available variables are shown for each template below.
            </p>
          </div>
        </div>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {templates.map((template) => (
          <AccordionItem 
            key={template.id} 
            value={template.id}
            className="border rounded-lg px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">
                  {TEMPLATE_LABELS[template.template_key] || template.template_key}
                </span>
                {hasChanges(template) && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    Unsaved changes
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="space-y-4">
                {template.description && (
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                )}

                {/* Available Variables */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground">Variables:</span>
                  {template.available_variables?.map((variable) => (
                    <Badge key={variable} variant="outline" className="text-xs font-mono">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>

                {/* Subject Line */}
                <div className="space-y-2">
                  <Label htmlFor={`subject-${template.id}`}>Email Subject</Label>
                  <Input
                    id={`subject-${template.id}`}
                    value={editedTemplates[template.id]?.subject || ''}
                    onChange={(e) => setEditedTemplates(prev => ({
                      ...prev,
                      [template.id]: { ...prev[template.id], subject: e.target.value }
                    }))}
                    placeholder="Email subject line..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Email Content</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEnhanceTemplateId(template.id)}
                        className="text-primary"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        Enhance with AI
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(template)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </div>
                  <Tabs 
                    value={activeEditorTab[template.id] || 'visual'} 
                    onValueChange={(tab) => handleEditorTabChange(template.id, tab)}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="visual" className="flex items-center gap-1">
                        <Edit3 className="w-3 h-3" />
                        Visual Editor
                      </TabsTrigger>
                      <TabsTrigger value="html" className="flex items-center gap-1">
                        <Code className="w-3 h-3" />
                        HTML Source
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="visual" className="space-y-2">
                      {/* Formatting Toolbar */}
                      <div className="flex flex-wrap items-center gap-1 p-2 border rounded-lg bg-muted/30">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyFormatting(template.id, 'bold')}
                          title="Bold"
                        >
                          <Bold className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyFormatting(template.id, 'italic')}
                          title="Italic"
                        >
                          <Italic className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyFormatting(template.id, 'insertUnorderedList')}
                          title="Bullet List"
                        >
                          <List className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyFormatting(template.id, 'insertOrderedList')}
                          title="Numbered List"
                        >
                          <ListOrdered className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const url = prompt('Enter URL:');
                            if (url) applyFormatting(template.id, 'createLink', url);
                          }}
                          title="Insert Link"
                        >
                          <Link2 className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <select
                          className="h-8 px-2 text-sm border rounded bg-background"
                          onChange={(e) => {
                            if (e.target.value) applyFormatting(template.id, 'formatBlock', e.target.value);
                            e.target.value = '';
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>Heading</option>
                          <option value="h1">Heading 1</option>
                          <option value="h2">Heading 2</option>
                          <option value="h3">Heading 3</option>
                          <option value="p">Paragraph</option>
                        </select>
                        <div className="w-px h-6 bg-border mx-1" />
                        <select
                          className="h-8 px-2 text-sm border rounded bg-background"
                          onChange={(e) => {
                            if (e.target.value) insertVariable(template.id, e.target.value);
                            e.target.value = '';
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>Insert Variable</option>
                          {template.available_variables?.map((v) => (
                            <option key={v} value={v}>{`{{${v}}}`}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Visual Editor iframe */}
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <iframe
                          ref={(el) => {
                            visualEditorRefs.current[template.id] = el;
                            if (el && (activeEditorTab[template.id] === 'visual' || !activeEditorTab[template.id])) {
                              setTimeout(() => {
                                initVisualEditor(template.id, editedTemplates[template.id]?.html_content || '');
                              }, 50);
                            }
                          }}
                          className="w-full min-h-[400px] border-0"
                          title={`Visual Editor for ${template.template_key}`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Click inside the editor to edit content directly. Use the toolbar for formatting.
                      </p>
                    </TabsContent>
                    
                    <TabsContent value="html">
                      <Textarea
                        id={`content-${template.id}`}
                        value={editedTemplates[template.id]?.html_content || ''}
                        onChange={(e) => setEditedTemplates(prev => ({
                          ...prev,
                          [template.id]: { ...prev[template.id], html_content: e.target.value }
                        }))}
                        className="font-mono text-sm min-h-[400px]"
                        placeholder="HTML email content..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Edit raw HTML directly. Changes will sync with the visual editor.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResetTemplate(template)}
                    disabled={!hasChanges(template) || saving === template.id}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveTemplate(template)}
                    disabled={!hasChanges(template) || saving === template.id}
                  >
                    {saving === template.id ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-1" /> Save Template</>
                    )}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No email templates found.</p>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Email Preview: {previewTemplate && TEMPLATE_LABELS[previewTemplate.template_key]}
            </DialogTitle>
            <DialogDescription>
              Preview with sample data. Actual values will be replaced when sending.
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="p-3 bg-muted border-b">
              <div className="text-sm">
                <span className="text-muted-foreground">Subject: </span>
                <span className="font-medium">
                  {previewTemplate && editedTemplates[previewTemplate.id]?.subject
                    ?.replace(/\{\{organization_name\}\}/g, 'Acme Corporation')
                    ?.replace(/\{\{candidate_name\}\}/g, 'John Doe')
                    ?.replace(/\{\{interview_title\}\}/g, 'Senior Software Engineer')
                    ?.replace(/\{\{platform_name\}\}/g, 'TalentGeenie')
                    ?.replace(/\{\{certification_name\}\}/g, 'AWS Solutions Architect')
                    ?.replace(/\{\{usage_percent\}\}/g, '85')
                  }
                </span>
              </div>
            </div>
            <ScrollArea className="h-[500px]">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[500px] border-0"
                title="Email Preview"
              />
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Enhance Dialog */}
      <Dialog open={!!enhanceTemplateId} onOpenChange={() => { setEnhanceTemplateId(null); setEnhanceInstructions(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Enhance with AI
            </DialogTitle>
            <DialogDescription>
              Describe how you'd like to improve this email template. AI will enhance the content while preserving all template variables.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enhance-instructions">Enhancement Instructions</Label>
              <Textarea
                id="enhance-instructions"
                value={enhanceInstructions}
                onChange={(e) => setEnhanceInstructions(e.target.value)}
                placeholder="e.g., Make the tone more professional, add a friendly greeting, make it more concise, add urgency..."
                className="min-h-[120px]"
              />
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> Be specific about what you want. Examples:
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <li>• "Make the tone more welcoming and friendly"</li>
                <li>• "Add a call-to-action button section"</li>
                <li>• "Make it shorter and more concise"</li>
                <li>• "Add professional formatting with headers"</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setEnhanceTemplateId(null); setEnhanceInstructions(''); }}
                disabled={enhancing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEnhanceWithAI}
                disabled={!enhanceInstructions.trim() || enhancing}
              >
                {enhancing ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enhancing...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-1" /> Enhance Content</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
