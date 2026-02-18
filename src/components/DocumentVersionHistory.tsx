import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { History, GitCompare, Loader2, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger } from '@/lib/logger';

interface Version {
  id: string;
  version_number: number;
  title: string;
  content: string;
  category: string;
  changes_summary: string | null;
  created_at: string;
}

interface DocumentVersionHistoryProps {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreVersion: (content: string, title: string, category: string) => void;
}

export default function DocumentVersionHistory({
  documentId,
  open,
  onOpenChange,
  onRestoreVersion
}: DocumentVersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<[Version | null, Version | null]>([null, null]);
  const { toast, errorToast, successToast } = useUserFriendlyToast();

  useEffect(() => {
    if (open && documentId) {
      fetchVersions();
    }
  }, [open, documentId]);

  const fetchVersions = async () => {
    if (!documentId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_documentation_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      logger.error('Fetch versions error:', error);
      toast({
        title: "Failed to Load Versions",
        description: "Could not fetch version history.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = (version: Version, position: 0 | 1) => {
    const newSelection: [Version | null, Version | null] = [...selectedVersions];
    newSelection[position] = version;
    setSelectedVersions(newSelection);
  };

  const handleRestore = (version: Version) => {
    onRestoreVersion(version.content, version.title, version.category);
    toast({
      title: "Version Restored",
      description: `Restored to version ${version.version_number}`
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="history">Version History</TabsTrigger>
              <TabsTrigger value="compare" disabled={!selectedVersions[0] || !selectedVersions[1]}>
                Compare Versions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {versions.map((version) => (
                    <Card key={version.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              Version {version.version_number}
                              {version.version_number === versions[0]?.version_number && (
                                <Badge variant="default">Latest</Badge>
                              )}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {new Date(version.created_at).toLocaleString()}
                            </p>
                            {version.changes_summary && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {version.changes_summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompare(version, 0)}
                          >
                            <GitCompare className="h-3 w-3 mr-1" />
                            Compare A
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompare(version, 1)}
                          >
                            <GitCompare className="h-3 w-3 mr-1" />
                            Compare B
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRestore(version)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Restore
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="compare">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">
                    Version {selectedVersions[0]?.version_number}
                  </h3>
                  <ScrollArea className="h-[450px] border rounded-lg p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{selectedVersions[0]?.content || ''}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">
                    Version {selectedVersions[1]?.version_number}
                  </h3>
                  <ScrollArea className="h-[450px] border rounded-lg p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{selectedVersions[1]?.content || ''}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
