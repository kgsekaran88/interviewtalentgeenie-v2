import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { useUserRoles } from '@/hooks/useUserRoles';
import { MermaidDiagram } from '@/components/MermaidDiagram';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, 
  Clock, 
  FileCode, 
  GitBranch, 
  Database, 
  Shield, 
  Users, 
  Workflow,
  ArrowLeft,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ArchitectureDocument {
  id: string;
  section: string;
  diagram_type: string;
  title: string;
  description: string | null;
  mermaid_code: string;
  analyzed_files: string[];
  last_generated_at: string;
  needs_refresh: boolean;
  display_order: number;
}

interface DocsStatus {
  total_docs: number;
  last_refresh: string | null;
  docs_needing_refresh: number;
  has_file_changes?: number;
}

const sectionConfig: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  system_overview: { 
    label: 'System Overview', 
    icon: FileCode,
    description: 'High-level architecture and component interactions'
  },
  role_hierarchy: { 
    label: 'Role Hierarchy', 
    icon: Users,
    description: 'User roles, permissions, and access control structure'
  },
  page_flows: { 
    label: 'Page Flows', 
    icon: GitBranch,
    description: 'Navigation flows and page interactions by role'
  },
  feature_flows: { 
    label: 'Feature Flows', 
    icon: Workflow,
    description: 'Detailed feature implementation and data flows'
  },
  database: { 
    label: 'Database Schema', 
    icon: Database,
    description: 'Entity relationships and data models'
  },
  auth_flows: { 
    label: 'Authentication', 
    icon: Shield,
    description: 'Authentication and authorization flows'
  },
};

export default function ArchitectureDocs() {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { isPlatformAdmin, loading: rolesLoading } = useUserRoles();
  
  const [documents, setDocuments] = useState<ArchitectureDocument[]>([]);
  const [status, setStatus] = useState<DocsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [activeSection, setActiveSection] = useState('system_overview');
  const [updatingDiagramId, setUpdatingDiagramId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchStatus();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('architecture_documents')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      logger.error('Error fetching architecture docs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load architecture documentation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('check_architecture_docs_status');
      if (error) throw error;
      if (data) {
        // RPC returns jsonb directly, not an array
        setStatus(data as unknown as DocsStatus);
      }
    } catch (error: any) {
      logger.error('Error fetching status:', error);
    }
  };

  const handleRefreshAll = async () => {
    if (!isPlatformAdmin) {
      toast({
        title: 'Permission Denied',
        description: 'Only platform admins can refresh documentation',
        variant: 'destructive',
      });
      return;
    }

    setRefreshing(true);
    try {
      const { data, error } = await invokeFunction('generate-architecture-docs', {
        body: { refreshAll: true },
      });

      if (error) throw error;

      toast({
        title: 'Documentation Refreshed',
        description: `Successfully regenerated ${data?.documentsUpdated || 'all'} architecture diagrams`,
      });

      await fetchDocuments();
      await fetchStatus();
    } catch (error: any) {
      logger.error('Error refreshing docs:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh documentation',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const checkForChanges = async () => {
    setChecking(true);
    try {
      const { data, error } = await invokeFunction('check-file-changes');

      if (error) throw error;

      await fetchStatus();

      if (data?.changes_detected) {
        toast({
          title: 'Changes Detected',
          description: data.message,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Up to Date',
          description: 'No code changes detected. Documentation is current.',
        });
      }
    } catch (error: any) {
      logger.error('Error checking changes:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to check for changes',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  // Handle AI update for a single diagram
  const handleAIUpdate = async (documentId: string, currentCode: string) => {
    if (!isPlatformAdmin) {
      toast({
        title: 'Permission Denied',
        description: 'Only platform admins can update diagrams with AI',
        variant: 'destructive',
      });
      return;
    }

    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;

    setUpdatingDiagramId(documentId);
    try {
      const { data, error } = await invokeFunction('update-architecture-diagram', {
        body: {
          documentId,
          section: doc.section,
          title: doc.title,
          diagramType: doc.diagram_type,
          currentCode,
        },
      });

      if (error) throw error;

      if (data?.success && data?.updatedCode) {
        // Update local state with new code
        setDocuments(prev => prev.map(d => 
          d.id === documentId 
            ? { ...d, mermaid_code: data.updatedCode, last_generated_at: new Date().toISOString() } 
            : d
        ));
        
        successToast('Diagram Updated', `"${doc.title}" has been updated with accurate platform information`);
      } else {
        throw new Error(data?.error || 'Failed to update diagram');
      }
    } catch (error: any) {
      logger.error('Error updating diagram with AI:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update diagram with AI',
        variant: 'destructive',
      });
    } finally {
      setUpdatingDiagramId(null);
    }
  };

  const groupedDocuments = documents.reduce((acc, doc) => {
    if (!acc[doc.section]) {
      acc[doc.section] = [];
    }
    acc[doc.section].push(doc);
    return acc;
  }, {} as Record<string, ArchitectureDocument[]>);

  const sections = Object.keys(sectionConfig).filter(section => groupedDocuments[section]?.length > 0);

  if (loading || rolesLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-20 w-full" />
          <div className="grid gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">Architecture Documentation</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              System architecture, flows, and technical diagrams
            </p>
          </div>
        </div>
        
        {isPlatformAdmin && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline"
              onClick={checkForChanges} 
              disabled={checking}
              className="gap-2 min-h-[44px]"
            >
              <GitBranch className={`w-4 h-4 ${checking ? 'animate-pulse' : ''}`} />
              {checking ? 'Checking...' : 'Check for Changes'}
            </Button>
            <Button 
              onClick={handleRefreshAll} 
              disabled={refreshing}
              className="gap-2 min-h-[44px]"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh All Diagrams'}
            </Button>
          </div>
        )}
      </div>

      {/* Status Card */}
      <Card className="mb-8">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-primary" />
              <span className="text-sm">
                <strong>{status?.total_docs || documents.length}</strong> diagrams
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Last updated:{' '}
                {status?.last_refresh 
                  ? formatDistanceToNow(new Date(status.last_refresh), { addSuffix: true })
                  : 'Never'}
              </span>
            </div>

            {status?.docs_needing_refresh && status.docs_needing_refresh > 0 ? (
              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                <AlertTriangle className="w-3 h-3" />
                {status.docs_needing_refresh} need refresh
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                <CheckCircle className="w-3 h-3" />
                Up to date
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4 sm:space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 sm:gap-2 bg-muted/50 p-1 sm:p-2">
          {sections.map(section => {
            const config = sectionConfig[section];
            const Icon = config?.icon || FileCode;
            return (
              <TabsTrigger 
                key={section} 
                value={section}
                className="gap-1 sm:gap-2 data-[state=active]:bg-background min-h-[44px] text-xs sm:text-sm px-2 sm:px-3"
              >
                <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{config?.label || section}</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {groupedDocuments[section]?.length || 0}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {sections.map(section => {
          const config = sectionConfig[section];
          const sectionDocs = groupedDocuments[section] || [];
          
          return (
            <TabsContent key={section} value={section} className="space-y-6">
              {config && (
                <div className="flex items-center gap-3 mb-4">
                  <config.icon className="w-6 h-6 text-primary" />
                  <div>
                    <h2 className="text-xl font-semibold">{config.label}</h2>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                </div>
              )}
              
              <div className="grid gap-6">
                {sectionDocs.map(doc => (
                  <div key={doc.id} className="space-y-2">
                    <MermaidDiagram
                      code={doc.mermaid_code}
                      title={doc.title}
                      description={doc.description || undefined}
                      showControls={true}
                      documentId={isPlatformAdmin ? doc.id : undefined}
                      section={doc.section}
                      diagramType={doc.diagram_type}
                      onAIUpdate={isPlatformAdmin ? handleAIUpdate : undefined}
                      isUpdatingWithAI={updatingDiagramId === doc.id}
                      onCodeChange={async (newCode) => {
                        const { error } = await supabase
                          .from('architecture_documents')
                          .update({ mermaid_code: newCode, updated_at: new Date().toISOString() })
                          .eq('id', doc.id);
                        if (!error) {
                          setDocuments(prev => prev.map(d => 
                            d.id === doc.id ? { ...d, mermaid_code: newCode } : d
                          ));
                        }
                      }}
                    />
                    {doc.analyzed_files?.length > 0 && (
                      <p className="text-xs text-muted-foreground px-2">
                        Based on: {doc.analyzed_files.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {documents.length === 0 && (
        <Card className="p-12 text-center">
          <FileCode className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Architecture Documentation</h3>
          <p className="text-muted-foreground mb-4">
            Architecture diagrams haven't been generated yet.
          </p>
          {isPlatformAdmin && (
            <Button onClick={handleRefreshAll} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Generate Documentation
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
