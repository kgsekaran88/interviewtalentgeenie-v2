import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Download,
  FileText,
  FileJson,
  FileCode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  Search
} from 'lucide-react';
import { type TestReport, type TestIssue } from '@/types/test-templates';
import TestIssueDetail from './TestIssueDetail';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { logger } from '@/lib/logger';

interface ComprehensiveTestReportProps {
  report: TestReport;
  onAutoFix?: (issueId: string) => Promise<void>;
}

const ComprehensiveTestReport: React.FC<ComprehensiveTestReportProps> = ({ report, onAutoFix }) => {
  const [selectedIssue, setSelectedIssue] = useState<TestIssue | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIssues = report.issues.filter(issue => {
    const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
    const matchesSearch = searchQuery === '' || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const issuesBySeverity = {
    critical: report.issues.filter(i => i.severity === 'critical').length,
    high: report.issues.filter(i => i.severity === 'high').length,
    medium: report.issues.filter(i => i.severity === 'medium').length,
    low: report.issues.filter(i => i.severity === 'low').length,
    info: report.issues.filter(i => i.severity === 'info').length,
  };

  const handleAutoFix = async (issueId: string) => {
    const issue = filteredIssues.find(i => i.id === issueId);
    if (!issue) return;

    try {
      const { data, error } = await invokeFunction('auto-fix-issue', {
        body: {
          issueId,
          issueType: issue.category.toLowerCase().replace(' ', '_'),
          context: {
            tableName: issue.affectedComponents?.[0],
            description: issue.description,
          }
        }
      });

      if (error) throw error;

      toast.success(`Auto-fix completed: ${data.fixResult.action}`);
      
      if (data.fixResult.sqlExample) {
        logger.debug('Recommended SQL:', data.fixResult.sqlExample);
      }
    } catch (error: any) {
      logger.error('Auto-fix error:', error);
      toast.error(`Auto-fix failed: ${error.message}`);
    }
  };

  const exportAsPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    // Title
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Comprehensive Test Report', margin, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date(report.timestamp).toLocaleString()}`, margin, yPos);
    doc.text(`Flow: ${report.flowId}`, margin, yPos + 5);
    doc.text(`Execution Time: ${(report.executionTime / 1000).toFixed(2)}s`, margin, yPos + 10);
    
    yPos += 25;

    // Executive Summary
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Executive Summary', margin, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    const summaryData = [
      `Total Tests: ${report.summary.total}`,
      `Passed: ${report.summary.passed} (${report.summary.successRate.toFixed(1)}%)`,
      `Failed: ${report.summary.failed}`,
      `Warnings: ${report.summary.warnings}`,
      `Skipped: ${report.summary.skipped}`,
      '',
      `Critical Issues: ${issuesBySeverity.critical}`,
      `High Priority Issues: ${issuesBySeverity.high}`,
      `Medium Priority Issues: ${issuesBySeverity.medium}`,
      `Low Priority Issues: ${issuesBySeverity.low}`,
    ];

    summaryData.forEach(line => {
      doc.text(line, margin, yPos);
      yPos += 6;
    });

    yPos += 10;

    // Issues Section
    if (report.issues.length > 0) {
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Detailed Issues', margin, yPos);
      yPos += 10;

      report.issues.forEach((issue, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        // Issue Header
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const severityColor: [number, number, number] = issue.severity === 'critical' || issue.severity === 'high' 
          ? [220, 38, 38] : issue.severity === 'medium' 
          ? [234, 179, 8] : [100, 100, 100];
        doc.setTextColor(severityColor[0], severityColor[1], severityColor[2]);
        doc.text(`${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.title}`, margin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        // Description
        const descLines = doc.splitTextToSize(issue.description, pageWidth - 2 * margin);
        descLines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, margin + 5, yPos);
          yPos += 4;
        });
        yPos += 3;

        // Impact
        doc.setFont(undefined, 'bold');
        doc.text('Impact:', margin + 5, yPos);
        yPos += 5;
        doc.setFont(undefined, 'normal');
        const impactLines = doc.splitTextToSize(issue.impact, pageWidth - 2 * margin - 10);
        impactLines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, margin + 10, yPos);
          yPos += 4;
        });
        yPos += 3;

        // Fix Suggestion
        doc.setFont(undefined, 'bold');
        doc.setTextColor(34, 139, 34);
        doc.text('Fix Suggestion:', margin + 5, yPos);
        yPos += 5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        const fixLines = doc.splitTextToSize(issue.fixSuggestion.summary, pageWidth - 2 * margin - 10);
        fixLines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, margin + 10, yPos);
          yPos += 4;
        });
        yPos += 3;

        // Steps
        if (issue.fixSuggestion.steps.length > 0) {
          doc.setFont(undefined, 'bold');
          doc.text('Steps:', margin + 5, yPos);
          yPos += 5;
          doc.setFont(undefined, 'normal');
          issue.fixSuggestion.steps.forEach((step, stepIdx) => {
            const stepLines = doc.splitTextToSize(`${stepIdx + 1}. ${step}`, pageWidth - 2 * margin - 15);
            stepLines.forEach((line: string) => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(line, margin + 10, yPos);
              yPos += 4;
            });
          });
          yPos += 3;
        }

        // Estimated Effort
        doc.setFont(undefined, 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text(`Estimated Effort: ${issue.fixSuggestion.estimatedEffort}`, margin + 5, yPos);
        yPos += 8;

        doc.setTextColor(0, 0, 0);
      });
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Recommendations', margin, yPos);
      yPos += 10;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      report.recommendations.forEach((rec, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        const recLines = doc.splitTextToSize(`${idx + 1}. ${rec}`, pageWidth - 2 * margin - 5);
        recLines.forEach((line: string) => {
          doc.text(line, margin + 5, yPos);
          yPos += 4;
        });
        yPos += 3;
      });
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount} | TalentGeenie Test Report | ${report.flowId}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`test-report-${report.flowId}-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF report downloaded successfully');
  };

  const exportAsJSON = () => {
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${report.flowId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('JSON report downloaded successfully');
  };

  const exportAsHTML = () => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ${report.flowId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .header h1 { margin: 0 0 10px 0; }
    .meta { opacity: 0.9; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; text-transform: uppercase; }
    .summary-card .value { font-size: 32px; font-weight: bold; color: #667eea; }
    .issue { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 4px solid #667eea; }
    .issue.critical, .issue.high { border-left-color: #dc2626; }
    .issue.medium { border-left-color: #eab308; }
    .issue.low { border-left-color: #3b82f6; }
    .issue-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; }
    .issue-title { font-size: 18px; font-weight: bold; margin: 0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .badge.critical, .badge.high { background: #fecaca; color: #dc2626; }
    .badge.medium { background: #fef3c7; color: #eab308; }
    .badge.low { background: #dbeafe; color: #3b82f6; }
    .badge.info { background: #e5e7eb; color: #6b7280; }
    .section { margin: 15px 0; }
    .section-title { font-weight: 600; color: #667eea; margin-bottom: 8px; }
    .steps { list-style: none; padding: 0; }
    .steps li { padding: 10px; background: #f9fafb; margin-bottom: 8px; border-radius: 5px; padding-left: 40px; position: relative; }
    .steps li::before { content: counter(step); counter-increment: step; position: absolute; left: 10px; background: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; }
    .steps { counter-reset: step; }
    .code { background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 5px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 13px; }
    .recommendations { background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; border-radius: 10px; margin-top: 30px; }
    .recommendations h2 { color: #10b981; margin-top: 0; }
    .recommendations ul { margin: 0; padding-left: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Comprehensive Test Report</h1>
    <div class="meta">
      <div>Flow: ${report.flowId}</div>
      <div>Generated: ${new Date(report.timestamp).toLocaleString()}</div>
      <div>Execution Time: ${(report.executionTime / 1000).toFixed(2)}s</div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Total Tests</h3>
      <div class="value">${report.summary.total}</div>
    </div>
    <div class="summary-card">
      <h3>Passed</h3>
      <div class="value" style="color: #10b981;">${report.summary.passed}</div>
    </div>
    <div class="summary-card">
      <h3>Failed</h3>
      <div class="value" style="color: #dc2626;">${report.summary.failed}</div>
    </div>
    <div class="summary-card">
      <h3>Success Rate</h3>
      <div class="value">${report.summary.successRate.toFixed(1)}%</div>
    </div>
  </div>

  <h2>Issues (${report.issues.length})</h2>
  ${report.issues.map(issue => `
    <div class="issue ${issue.severity}">
      <div class="issue-header">
        <h3 class="issue-title">${issue.title}</h3>
        <span class="badge ${issue.severity}">${issue.severity}</span>
      </div>
      <p>${issue.description}</p>
      
      <div class="section">
        <div class="section-title">Impact</div>
        <p>${issue.impact}</p>
      </div>

      <div class="section">
        <div class="section-title">Expected vs Actual Behavior</div>
        <p><strong>Expected:</strong> ${issue.expectedBehavior}</p>
        <p><strong>Actual:</strong> ${issue.actualBehavior}</p>
      </div>

      <div class="section">
        <div class="section-title">Fix Suggestion</div>
        <p>${issue.fixSuggestion.summary}</p>
        <ul class="steps">
          ${issue.fixSuggestion.steps.map(step => `<li>${step}</li>`).join('')}
        </ul>
        ${issue.fixSuggestion.codeExample ? `<div class="code">${issue.fixSuggestion.codeExample}</div>` : ''}
        <p><em>Estimated Effort: ${issue.fixSuggestion.estimatedEffort}</em></p>
      </div>
    </div>
  `).join('')}

  ${report.recommendations.length > 0 ? `
    <div class="recommendations">
      <h2>Recommendations</h2>
      <ul>
        ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${report.flowId}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('HTML report downloaded successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Comprehensive Test Report</CardTitle>
              <CardDescription className="mt-2">
                Flow: {report.flowId} | Generated: {new Date(report.timestamp).toLocaleString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportAsPDF} variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button onClick={exportAsHTML} variant="outline" size="sm">
                <FileCode className="w-4 h-4 mr-2" />
                HTML
              </Button>
              <Button onClick={exportAsJSON} variant="outline" size="sm">
                <FileJson className="w-4 h-4 mr-2" />
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{report.summary.total}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Tests</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-success flex items-center justify-center gap-2">
                <CheckCircle className="w-6 h-6" />
                {report.summary.passed}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Passed</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-destructive flex items-center justify-center gap-2">
                <XCircle className="w-6 h-6" />
                {report.summary.failed}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Failed</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-warning flex items-center justify-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                {report.summary.warnings}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Warnings</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold flex items-center justify-center gap-2">
                {report.summary.successRate >= 80 ? (
                  <TrendingUp className="w-6 h-6 text-success" />
                ) : report.summary.successRate >= 50 ? (
                  <Minus className="w-6 h-6 text-warning" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-destructive" />
                )}
                {report.summary.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">Success Rate</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Test Progress</span>
              <span>{report.summary.passed} / {report.summary.total}</span>
            </div>
            <Progress value={report.summary.successRate} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Issues Section */}
      <Card>
        <CardHeader>
          <CardTitle>Issues ({report.issues.length})</CardTitle>
          <CardDescription>
            Critical: {issuesBySeverity.critical} | High: {issuesBySeverity.high} | Medium: {issuesBySeverity.medium} | Low: {issuesBySeverity.low}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 border rounded-md"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Issues List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {filteredIssues.length > 0 ? (
                filteredIssues.map((issue) => (
                  <div key={issue.id} onClick={() => setSelectedIssue(issue)} className="cursor-pointer">
                    <TestIssueDetail issue={issue} onAutoFix={handleAutoFix} />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No issues found matching your filters
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <Card className="border-success/20 bg-success/5">
          <CardHeader>
            <CardTitle className="text-success">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {report.nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 list-decimal list-inside">
              {report.nextSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComprehensiveTestReport;
