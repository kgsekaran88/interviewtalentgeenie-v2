import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, FileText, FileDown, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { exportToPDF, exportToWord } from "@/lib/documentExport";
import { supabase } from "@/integrations/supabase/client";

interface DocumentViewerProps {
  title: string;
  description: string;
  category: string;
  content: string;
  badgeColor: string;
  isCustom?: boolean;
  onContentUpdate?: (newContent: string) => void;
}

export const DocumentViewer = ({ title, description, category, content, badgeColor, isCustom, onContentUpdate }: DocumentViewerProps) => {
  const [showViewer, setShowViewer] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedContent, setEnhancedContent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState(content);
  const { toast, errorToast, successToast } = useUserFriendlyToast();

  const downloadMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: "Markdown file downloaded successfully",
    });
  };

  const handleDownloadPDF = async () => {
    try {
      await exportToPDF(title, content, category);
      toast({
        title: "PDF Downloaded",
        description: "Documentation exported as PDF successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export documentation as PDF",
        variant: "destructive",
      });
    }
  };

  const handleDownloadWord = async () => {
    try {
      await exportToWord(title, content, category);
      toast({
        title: "Word Document Downloaded",
        description: "Documentation exported as Word document successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export documentation as Word document",
        variant: "destructive",
      });
    }
  };

  const handleEnhanceWithAI = async () => {
    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-content-with-ai', {
        body: {
          content: enhancedContent || content,
          contentType: 'documentation',
          title: title,
        }
      });

      if (error) throw error;

      if (data?.success && data?.enhanced) {
        setEnhancedContent(data.enhanced);
        setEditableContent(data.enhanced);
        toast({
          title: "Enhanced!",
          description: "Documentation has been improved with AI.",
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

  const handleSaveEnhanced = () => {
    if (onContentUpdate && editableContent) {
      onContentUpdate(editableContent);
      setEnhancedContent(null);
      setIsEditing(false);
      toast({
        title: "Saved",
        description: "Enhanced content has been saved.",
      });
    }
  };

  const displayContent = enhancedContent || content;

  // Convert markdown to richly formatted text for display
  const formatContent = (md: string) => {
    const lines = md.split('\n');
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeLanguage = '';

    return lines.map((line, idx) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.slice(3) || 'plaintext';
          codeBlockContent = [];
          return null;
        } else {
          inCodeBlock = false;
          const content = codeBlockContent.join('\n');
          codeBlockContent = [];
          return (
            <div key={idx} className="my-4 rounded-lg overflow-hidden border border-primary/20 shadow-sm">
              <div className="bg-gradient-to-r from-primary to-accent px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-mono text-primary-foreground uppercase tracking-wider">{codeLanguage}</span>
                <span className="text-xs text-primary-foreground/80">Code</span>
              </div>
              <pre className="bg-muted/50 p-4 overflow-x-auto">
                <code className="text-sm font-mono text-foreground">{content}</code>
              </pre>
            </div>
          );
        }
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return null;
      }

      // Headers with styling
      if (line.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-4xl font-bold mt-8 mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {line.slice(2)}
          </h1>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-3xl font-bold mt-6 mb-3 text-accent border-b-2 border-accent/30 pb-2">
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-2xl font-semibold mt-5 mb-2 text-success flex items-center gap-2">
            <span className="w-1 h-6 bg-success rounded-full"></span>
            {line.slice(4)}
          </h3>
        );
      }
      if (line.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-xl font-semibold mt-4 mb-2 text-warning flex items-center gap-2">
            <span className="w-1 h-5 bg-warning rounded-full"></span>
            {line.slice(5)}
          </h4>
        );
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-4 border-warning bg-warning/10 pl-4 py-2 my-3 italic text-muted-foreground rounded-r-lg">
            {line.slice(2)}
          </blockquote>
        );
      }

      // Bullet lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const content = line.slice(2);
        const isBold = content.startsWith('**') && content.includes('**');
        return (
          <li key={idx} className="ml-6 my-2 flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></span>
            <span className={isBold ? "font-semibold text-foreground" : "text-muted-foreground"}>
              {isBold ? content.replace(/\*\*/g, '') : content}
            </span>
          </li>
        );
      }

      // Numbered lists
      if (/^\d+\./.test(line)) {
        return (
          <li key={idx} className="ml-8 my-2 list-decimal text-muted-foreground marker:text-primary marker:font-bold">
            {line.replace(/^\d+\.\s*/, '')}
          </li>
        );
      }

      // Inline code
      if (line.includes('`') && !line.startsWith('```')) {
        const parts = line.split('`');
        return (
          <p key={idx} className="my-2 text-foreground leading-relaxed">
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <code key={i} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-mono border border-primary/20">
                  {part}
                </code>
              ) : (
                part
              )
            )}
          </p>
        );
      }

      // Bold text
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={idx} className="my-2 text-foreground leading-relaxed">
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <strong key={i} className="font-bold text-primary">
                  {part}
                </strong>
              ) : (
                part
              )
            )}
          </p>
        );
      }

      // Empty lines
      if (line.trim() === '') {
        return <div key={idx} className="h-2"></div>;
      }

      // Regular text
      return (
        <p key={idx} className="my-2 text-muted-foreground leading-relaxed">
          {line}
        </p>
      );
    }).filter(Boolean);
  };

  return (
    <>
      <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/50">
        <CardHeader className="bg-gradient-to-br from-background to-primary/5">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {title}
                </span>
              </CardTitle>
              <CardDescription className="mt-2 text-base">{description}</CardDescription>
            </div>
            <Badge className={`${badgeColor} text-sm font-semibold px-3 py-1`}>{category}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              onClick={() => setShowViewer(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-primary/30 hover:bg-primary/10"
              onClick={handleDownloadPDF}
              title="Download as PDF"
            >
              <FileText className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-blue-500/30 hover:bg-blue-500/10"
              onClick={handleDownloadWord}
              title="Download as Word"
            >
              <FileDown className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-accent/30 hover:bg-accent/10"
              onClick={downloadMarkdown}
              title="Download as Markdown"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showViewer} onOpenChange={(open) => {
        setShowViewer(open);
        if (!open) {
          setIsEditing(false);
          setEnhancedContent(null);
          setEditableContent(content);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] bg-gradient-to-br from-background via-background to-primary/5">
          <DialogHeader className="border-b border-primary/20 pb-4">
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {title}
              </span>
              {enhancedContent && (
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 ml-2">
                  ✨ Enhanced
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-base pt-2">{description}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            {isEditing ? (
              <Textarea
                value={editableContent}
                onChange={(e) => setEditableContent(e.target.value)}
                className="min-h-[60vh] font-mono text-sm"
                placeholder="Edit documentation content..."
              />
            ) : (
              <div className="px-2 py-4">
                {formatContent(displayContent)}
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-between gap-2 pt-4 border-t border-primary/20">
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={handleEnhanceWithAI}
                disabled={isEnhancing}
                className="gap-2"
              >
                {isEnhancing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
              </Button>
              {isCustom && onContentUpdate && (
                <>
                  {isEditing ? (
                    <Button 
                      variant="outline"
                      onClick={handleSaveEnhanced}
                      className="border-green-500/30 hover:bg-green-500/10"
                    >
                      Save Changes
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="border-blue-500/30 hover:bg-blue-500/10"
                    >
                      Edit
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleDownloadPDF}
                className="border-primary/30 hover:bg-primary/10"
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDownloadWord}
                className="border-blue-500/30 hover:bg-blue-500/10"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Word
              </Button>
              <Button 
                variant="outline" 
                onClick={downloadMarkdown}
                className="border-accent/30 hover:bg-accent/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Markdown
              </Button>
              <Button 
                onClick={() => setShowViewer(false)}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
