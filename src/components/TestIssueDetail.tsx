import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Wrench,
  Code,
  BookOpen,
  Clock,
  Layers,
  GitBranch,
  ArrowRight,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { type TestIssue } from '@/types/test-templates';
import { toast } from 'sonner';

interface TestIssueDetailProps {
  issue: TestIssue;
  onAutoFix?: (issueId: string) => Promise<void>;
}

const TestIssueDetail: React.FC<TestIssueDetailProps> = ({ issue, onAutoFix }) => {
  const [isFixing, setIsFixing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const getSeverityIcon = (severity: TestIssue['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'high': return <AlertCircle className="w-5 h-5 text-destructive" />;
      case 'medium': return <AlertCircle className="w-5 h-5 text-warning" />;
      case 'low': return <Info className="w-5 h-5 text-blue-500" />;
      case 'info': return <Info className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: TestIssue['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'medium': return 'bg-warning/10 text-warning border-warning/20';
      case 'low': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'info': return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const handleAutoFix = async () => {
    if (!onAutoFix) return;
    
    setIsFixing(true);
    try {
      await onAutoFix(issue.id);
      toast.success('Issue fixed successfully! Review the fix and verify the solution.');
    } catch (error: any) {
      toast.error(`Auto-fix failed: ${error.message}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {getSeverityIcon(issue.severity)}
            <div className="flex-1">
              <CardTitle className="text-lg">{issue.title}</CardTitle>
              <CardDescription className="mt-1">{issue.testName}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getSeverityColor(issue.severity)}>
              {issue.severity.toUpperCase()}
            </Badge>
            <Badge variant="outline">{issue.category}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Description */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Issue Description
          </h3>
          <p className="text-sm text-muted-foreground">{issue.description}</p>
        </div>

        {/* Impact */}
        <Alert variant={issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Impact</AlertTitle>
          <AlertDescription>{issue.impact}</AlertDescription>
        </Alert>

        <Separator />

        {/* Tabs for Details */}
        <Tabs defaultValue="behavior" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="fix">Fix</TabsTrigger>
            <TabsTrigger value="reproduce">Reproduce</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* Behavior Tab */}
          <TabsContent value="behavior" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    Actual Behavior
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{issue.actualBehavior}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-success">
                    <CheckCircle className="w-4 h-4" />
                    Expected Behavior
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{issue.expectedBehavior}</p>
                </CardContent>
              </Card>
            </div>

            {issue.evidence && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Evidence</h4>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                  {issue.evidence}
                </pre>
              </div>
            )}
          </TabsContent>

          {/* Fix Tab */}
          <TabsContent value="fix" className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Fix Suggestion
                </h3>
                <p className="text-sm text-muted-foreground">{issue.fixSuggestion.summary}</p>
              </div>
              {issue.autoFixAvailable && onAutoFix && (
                <Button 
                  onClick={handleAutoFix}
                  disabled={isFixing}
                  size="sm"
                  className="ml-4"
                >
                  {isFixing ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Fixing...
                    </>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4 mr-2" />
                      Auto-Fix
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Fix Steps */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Steps to Fix</h4>
              <div className="space-y-2">
                {issue.fixSuggestion.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {idx + 1}
                    </div>
                    <p className="text-sm flex-1">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Example */}
            {issue.fixSuggestion.codeExample && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Code Example
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(issue.fixSuggestion.codeExample!, 'Code')}
                  >
                    {copied === 'Code' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="h-60">
                  <pre className="text-xs bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto">
                    <code>{issue.fixSuggestion.codeExample}</code>
                  </pre>
                </ScrollArea>
              </div>
            )}

            {/* Documentation Links */}
            {issue.fixSuggestion.documentationLinks && issue.fixSuggestion.documentationLinks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Documentation
                </h4>
                <div className="space-y-2">
                  {issue.fixSuggestion.documentationLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline p-2 bg-muted/50 rounded"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Estimated Effort */}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Estimated Effort</AlertTitle>
              <AlertDescription>{issue.fixSuggestion.estimatedEffort}</AlertDescription>
            </Alert>
          </TabsContent>

          {/* Reproduce Tab */}
          <TabsContent value="reproduce" className="space-y-4">
            {issue.reproductionSteps && issue.reproductionSteps.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  Reproduction Steps
                </h3>
                <div className="space-y-2">
                  {issue.reproductionSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>No reproduction steps available for this issue.</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-3">
              <div className="flex justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Test Name:</span>
                <span className="text-sm">{issue.testName}</span>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Flow ID:</span>
                <span className="text-sm font-mono">{issue.flowId}</span>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Category:</span>
                <Badge variant="outline">{issue.category}</Badge>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Severity:</span>
                <Badge className={getSeverityColor(issue.severity)}>{issue.severity}</Badge>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Auto-Fix Available:</span>
                <Badge variant={issue.autoFixAvailable ? 'default' : 'secondary'}>
                  {issue.autoFixAvailable ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded">
                <span className="text-sm font-medium">Timestamp:</span>
                <span className="text-sm">{new Date(issue.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {issue.affectedComponents && issue.affectedComponents.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Affected Components
                </h4>
                <div className="flex flex-wrap gap-2">
                  {issue.affectedComponents.map((component, idx) => (
                    <Badge key={idx} variant="outline">
                      {component}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TestIssueDetail;
