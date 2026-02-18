import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Download, Upload, FileSpreadsheet, AlertCircle, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { InterviewConfigTemplate } from '@/hooks/useInterviewConfiguration';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { 
  generateExcelTemplate, 
  parseExcelTemplate, 
  downloadBlob 
} from '@/lib/interviewTemplateUtils';

interface ExportTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport?: (name: string) => void;
}

export function ExportTemplateDialog({ open, onOpenChange, onExport }: ExportTemplateDialogProps) {
  const { toast } = useUserFriendlyToast();
  const [templateName, setTemplateName] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!templateName.trim()) return;
    
    setExporting(true);
    try {
      const blob = await generateExcelTemplate(templateName.trim());
      const filename = `interview-config-${templateName.trim().replace(/\s+/g, '-').toLowerCase()}.xlsx`;
      
      downloadBlob(blob, filename);
      
      toast({
        title: 'Template Downloaded',
        description: `Excel template "${templateName}" has been downloaded.`,
      });
      
      onExport?.(templateName.trim());
      setTemplateName('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to generate template. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Configuration
          </DialogTitle>
          <DialogDescription>
            Download an Excel template with all interview settings. Fill it out offline and upload to configure interviews.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="templateName">Template Name</Label>
            <Input
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Senior Frontend Interview"
            />
          </div>
          
          <Button 
            className="w-full h-14 gap-3"
            onClick={handleExport}
            disabled={!templateName.trim() || exporting}
          >
            {exporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" />
            )}
            <span>Download Excel Template (.xlsx)</span>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ImportTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (template: InterviewConfigTemplate, enhanceWithAI: boolean) => void;
}

export function ImportTemplateDialog({ open, onOpenChange, onImport }: ImportTemplateDialogProps) {
  const { toast } = useUserFriendlyToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<InterviewConfigTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [enhanceWithAI, setEnhanceWithAI] = useState(true);

  // Compute validation errors
  const getValidationErrors = (): string[] => {
    if (!previewTemplate) return [];
    
    const config = previewTemplate.config;
    const dist = config.questionTypeDistribution;
    const typeTotal = dist.mcq + dist.scenario + dist.coding + dist.descriptive;
    const questionCount = config.questionCount;
    const errors: string[] = [];
    
    if (!config.jobTitle?.trim()) {
      errors.push('Job Title is required');
    }
    if (!config.jobDescription?.trim() || config.jobDescription.trim().length < 50) {
      errors.push('Job Description is required (min 50 characters)');
    }
    if ((!config.skills || config.skills.length === 0) && !enhanceWithAI) {
      errors.push('At least one skill is required (or enable AI Enhancement)');
    }
    if (questionCount < 5 || questionCount > 100) {
      errors.push(`Question count must be 5-100 (got ${questionCount})`);
    }
    if (typeTotal !== questionCount) {
      errors.push(`Type distribution (${typeTotal}) must equal question count (${questionCount})`);
    }
    
    const topics = config.topics || {};
    if (Object.keys(topics).length === 0 && (!config.skills || config.skills.length === 0) && !enhanceWithAI) {
      errors.push('Topics are required (or enable AI Enhancement)');
    }
    
    return errors;
  };
  
  const validationErrors = getValidationErrors();
  const canImport = previewTemplate && validationErrors.length === 0;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setParsing(true);

    try {
      let template: InterviewConfigTemplate;
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        template = await parseExcelTemplate(file);
      } else if (file.name.endsWith('.json')) {
        const text = await file.text();
        template = JSON.parse(text) as InterviewConfigTemplate;
      } else {
        throw new Error('Unsupported file format. Please use Excel (.xlsx) format.');
      }

      if (!template.config || !template.config.questionTypeDistribution) {
        throw new Error('Invalid template format');
      }

      setPreviewTemplate(template);
    } catch (err: any) {
      setError(err.message || 'Invalid template file. Please select a valid Excel file.');
      setPreviewTemplate(null);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = () => {
    if (previewTemplate) {
      onImport(previewTemplate, enhanceWithAI);
      toast({
        title: enhanceWithAI ? 'Template Imported - AI Enhancement Starting' : 'Template Imported',
        description: enhanceWithAI 
          ? `Configuration "${previewTemplate.name}" applied. AI will enhance the job description and skills.`
          : `Configuration "${previewTemplate.name}" has been applied.`,
      });
      onOpenChange(false);
      setSelectedFile(null);
      setPreviewTemplate(null);
      setEnhanceWithAI(true);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedFile(null);
    setPreviewTemplate(null);
    setError(null);
    setEnhanceWithAI(true);
  };

  const hasJobDetails = previewTemplate?.config?.jobTitle || previewTemplate?.config?.jobDescription;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Configuration
          </DialogTitle>
          <DialogDescription>
            Upload an Excel configuration file to pre-fill interview settings and generate questions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Template File</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
              >
                {parsing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                )}
                {selectedFile ? selectedFile.name : 'Choose Excel file...'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Supported format: Excel (.xlsx)
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {previewTemplate && (
            <>
              {/* Comprehensive Validation */}
              {(() => {
                const config = previewTemplate.config;
                const dist = config.questionTypeDistribution;
                const typeTotal = dist.mcq + dist.scenario + dist.coding + dist.descriptive;
                const questionCount = config.questionCount;
                
                // Collect all validation issues
                const errors: string[] = [];
                const warnings: string[] = [];
                
                // Required field checks (errors - block import)
                if (!config.jobTitle?.trim()) {
                  errors.push('Job Title is required');
                }
                if (!config.jobDescription?.trim() || config.jobDescription.trim().length < 50) {
                  errors.push('Job Description is required (min 50 characters)');
                }
                if (!config.skills || config.skills.length === 0) {
                  if (!enhanceWithAI) {
                    errors.push('At least one skill is required (or enable AI Enhancement)');
                  } else {
                    warnings.push('No skills defined - AI will extract from job description');
                  }
                }
                
                // Question count validation
                if (questionCount < 5 || questionCount > 100) {
                  errors.push(`Question count must be 5-100 (got ${questionCount})`);
                }
                
                // Type distribution must match question count
                if (typeTotal !== questionCount) {
                  errors.push(`Type distribution (${typeTotal}) must equal question count (${questionCount})`);
                }
                
                // Topics validation
                const topics = config.topics || {};
                const topicTotal = Object.values(topics).reduce((sum, pct) => sum + pct, 0);
                if (Object.keys(topics).length === 0) {
                  if (!enhanceWithAI && config.skills && config.skills.length > 0) {
                    warnings.push('No topics defined - skills will be used as topics');
                  } else if (!enhanceWithAI) {
                    errors.push('Topics are required (or enable AI Enhancement)');
                  }
                } else if (topicTotal !== 100) {
                  warnings.push(`Topic weights total ${topicTotal}% (should be 100%)`);
                }
                
                // Difficulty validation (warnings only)
                const categories = ['mcq', 'scenario', 'coding', 'descriptive'] as const;
                const catDiff = config.categoryDifficultyDistribution;
                if (catDiff) {
                  categories.forEach(cat => {
                    if (dist[cat] > 0) {
                      const total = catDiff[cat].easy + catDiff[cat].medium + catDiff[cat].hard;
                      if (total !== 100) {
                        warnings.push(`${cat.toUpperCase()} difficulty totals ${total}% (should be 100%)`);
                      }
                    }
                  });
                }
                
                // Time limit validation
                if (config.timeLimit !== null && (config.timeLimit < 0 || config.timeLimit > 180)) {
                  warnings.push(`Time limit should be 0-180 minutes (got ${config.timeLimit})`);
                }
                
                const hasErrors = errors.length > 0;
                const hasWarnings = warnings.length > 0;
                
                if (hasErrors || hasWarnings) {
                  return (
                    <div className="space-y-2">
                      {hasErrors && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            <strong>Missing Required Fields:</strong>
                            <ul className="list-disc ml-4 mt-1 space-y-0.5">
                              {errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                      {hasWarnings && (
                        <Alert className="border-amber-500/50 bg-amber-500/10">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                            <strong>Warnings:</strong>
                            <ul className="list-disc ml-4 mt-1 space-y-0.5">
                              {warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                            <p className="mt-1 text-xs">These can be adjusted after import.</p>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                }
                
                // All valid - show success
                return (
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-sm text-green-700 dark:text-green-400">
                      ✓ Template is valid and ready to import
                    </AlertDescription>
                  </Alert>
                );
              })()}

              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <h4 className="font-medium">Template Preview</h4>
                
                {/* Job Details */}
                {hasJobDetails && (
                  <div className="space-y-1 pb-2 border-b">
                    {previewTemplate.config.jobTitle && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Job Title:</span>{' '}
                        <span className="font-medium">{previewTemplate.config.jobTitle}</span>
                      </p>
                    )}
                    {previewTemplate.config.jobDescription && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Job Description:</span>{' '}
                        <span className="text-xs">{previewTemplate.config.jobDescription.slice(0, 100)}...</span>
                      </p>
                    )}
                    {previewTemplate.config.skills && previewTemplate.config.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">Skills:</span>
                        {previewTemplate.config.skills.slice(0, 5).map((skill, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {skill}
                          </span>
                        ))}
                        {previewTemplate.config.skills.length > 5 && (
                          <span className="text-xs text-muted-foreground">+{previewTemplate.config.skills.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Interview Settings */}
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Name:</span> {previewTemplate.name}</p>
                  <p><span className="text-muted-foreground">Questions:</span> {previewTemplate.config.questionCount}</p>
                  <p><span className="text-muted-foreground">Bank Size:</span> {previewTemplate.config.questionBankSize}</p>
                  <p><span className="text-muted-foreground">Time Limit:</span> {previewTemplate.config.timeLimit || 'No limit'} min</p>
                  {previewTemplate.config.skillDomain && (
                    <p><span className="text-muted-foreground">Domain:</span> {previewTemplate.config.skillDomain}</p>
                  )}
                </div>

                {/* Question Types */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300">
                    MCQ: {previewTemplate.config.questionTypeDistribution.mcq}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">
                    Scenario: {previewTemplate.config.questionTypeDistribution.scenario}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-700 dark:text-orange-300">
                    Coding: {previewTemplate.config.questionTypeDistribution.coding}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-teal-500/20 text-teal-700 dark:text-teal-300">
                    Descriptive: {previewTemplate.config.questionTypeDistribution.descriptive}
                  </span>
                </div>

                {Object.keys(previewTemplate.config.topics || {}).length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Topics:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(previewTemplate.config.topics).map(([topic, pct]) => (
                        <span key={topic} className="text-xs px-2 py-0.5 rounded bg-muted">
                          {topic}: {pct}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Enhancement Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Wand2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor="enhance-ai" className="font-medium cursor-pointer">
                      Enhance with AI
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Improve job description, extract skills, suggest topics
                    </p>
                  </div>
                </div>
                <Switch
                  id="enhance-ai"
                  checked={enhanceWithAI}
                  onCheckedChange={setEnhanceWithAI}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {validationErrors.length > 0 && (
            <p className="text-xs text-destructive mr-auto">
              Fix {validationErrors.length} error(s) to import
            </p>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            {enhanceWithAI ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Import & Enhance
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import & Apply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateActionsProps {
  onExportClick: () => void;
  onImportClick: () => void;
}

export function TemplateActions({ onExportClick, onImportClick }: TemplateActionsProps) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onImportClick}>
        <Upload className="h-4 w-4 mr-2" />
        Upload Configuration
      </Button>
      <Button variant="outline" size="sm" onClick={onExportClick}>
        <Download className="h-4 w-4 mr-2" />
        Download Configuration
      </Button>
    </div>
  );
}
