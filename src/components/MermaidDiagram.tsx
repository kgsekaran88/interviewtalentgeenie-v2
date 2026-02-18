import { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Download, Copy, Check, Maximize2, Minimize2, RefreshCw, Edit3, X, FileText, Sparkles } from 'lucide-react';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import jsPDF from 'jspdf';

interface MermaidDiagramProps {
  code: string;
  title?: string;
  description?: string;
  className?: string;
  showControls?: boolean;
  onCodeChange?: (newCode: string) => void;
  // New props for AI update functionality
  documentId?: string;
  section?: string;
  diagramType?: string;
  onAIUpdate?: (documentId: string, newCode: string) => void;
  isUpdatingWithAI?: boolean;
}

export const MermaidDiagram = ({ 
  code, 
  title, 
  description, 
  className = '',
  showControls = true,
  onCodeChange,
  documentId,
  section,
  diagramType,
  onAIUpdate,
  isUpdatingWithAI = false
}: MermaidDiagramProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const { toast, successToast } = useUserFriendlyToast();

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) {
        setError('No diagram code provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Dynamically import mermaid
        const mermaid = (await import('mermaid')).default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
          },
          sequence: {
            useMaxWidth: true,
            showSequenceNumbers: true,
          },
          er: {
            useMaxWidth: true,
          },
        });

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
      } catch (err: any) {
        logger.error('Mermaid rendering error:', err);
        setError(err.message || 'Failed to render diagram');
      } finally {
        setLoading(false);
      }
    };

    renderDiagram();
  }, [code]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Mermaid code copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to copy code', variant: 'destructive' });
    }
  };

  const handleDownloadSVG = () => {
    if (!svg) return;
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title?.replace(/\s+/g, '-').toLowerCase() || 'diagram'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: 'Downloaded!', description: 'SVG file saved' });
  };

  const handleDownloadPNG = async () => {
    if (!svg) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx?.scale(2, 2);
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${title?.replace(/\s+/g, '-').toLowerCase() || 'diagram'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({ title: 'Downloaded!', description: 'PNG file saved' });
          }
        }, 'image/png');
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to export PNG', variant: 'destructive' });
    }
  };

  const handleDownloadPDF = async () => {
    if (!svg) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx?.scale(2, 2);
        ctx?.drawImage(img, 0, 0);
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.width + 40, img.height + 80]
        });
        
        // Add title if present
        if (title) {
          pdf.setFontSize(16);
          pdf.text(title, 20, 30);
        }
        
        // Add diagram
        pdf.addImage(imgData, 'PNG', 20, title ? 50 : 20, img.width, img.height);
        
        // Add description as footer if present
        if (description) {
          pdf.setFontSize(10);
          pdf.setTextColor(128);
          pdf.text(description, 20, img.height + (title ? 65 : 35));
        }
        
        pdf.save(`${title?.replace(/\s+/g, '-').toLowerCase() || 'diagram'}.pdf`);
        toast({ title: 'Downloaded!', description: 'PDF file saved' });
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to export PDF', variant: 'destructive' });
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedCode(code);
    }
    setIsEditing(!isEditing);
  };

  const handleApplyChanges = () => {
    if (onCodeChange) {
      onCodeChange(editedCode);
    }
    setIsEditing(false);
    toast({ title: 'Applied!', description: 'Diagram code updated' });
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Rendering diagram...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 border-destructive/50 ${className}`}>
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to render diagram</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <pre className="mt-4 p-4 bg-muted rounded-lg text-xs text-left overflow-auto max-h-48">
            {code}
          </pre>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${expanded ? 'fixed inset-4 z-50' : ''} ${className}`}>
      {(title || showControls) && (
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div>
            {title && <h3 className="font-semibold">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {showControls && (
            <div className="flex items-center gap-1">
              {/* Update with AI button - only show if documentId is provided */}
              {documentId && onAIUpdate && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onAIUpdate(documentId, code)}
                  disabled={isUpdatingWithAI}
                  title="Update diagram with AI"
                  className="gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Sparkles className={`w-4 h-4 ${isUpdatingWithAI ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline text-xs font-medium">
                    {isUpdatingWithAI ? 'Updating...' : 'Update with AI'}
                  </span>
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleEditToggle}
                title={isEditing ? 'Cancel edit' : 'Edit diagram'}
              >
                {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCopyCode}
                title="Copy Mermaid code"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDownloadSVG}
                title="Download SVG"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDownloadPDF}
                title="Download PDF"
              >
                <FileText className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Minimize' : 'Expand'}
              >
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>
      )}
      {isEditing ? (
        <div className="p-4 space-y-3">
          <Textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            className="font-mono text-sm min-h-[200px]"
            placeholder="Enter Mermaid diagram code..."
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleEditToggle}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApplyChanges} disabled={!onCodeChange}>
              Apply Changes
            </Button>
          </div>
        </div>
      ) : (
        <div 
          ref={containerRef}
          className={`p-6 overflow-auto bg-background ${expanded ? 'h-[calc(100%-60px)]' : ''}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {expanded && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm -z-10"
          onClick={() => setExpanded(false)}
        />
      )}
    </Card>
  );
};
