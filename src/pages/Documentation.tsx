import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from '@/lib/logger';
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { BookOpen, RefreshCw, Plus, Sparkles, RotateCw, X, Save, Eye, Edit3, GitBranch } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { DocumentViewer } from "@/components/DocumentViewer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Import documentation content
import userGuideContent from "@/docs/user-guide.md?raw";
import technicalDocContent from "@/docs/technical-documentation.md?raw";
import architectureDocContent from "@/docs/architecture.md?raw";
import deploymentDocContent from "@/docs/deployment-guide.md?raw";
import selfHostedDeploymentContent from "@/docs/self-hosted-deployment.md?raw";
import apiReferenceContent from "@/docs/api-reference.md?raw";
import faqContent from "@/docs/faq.md?raw";
import sourceCodeContent from "@/docs/source-code.md?raw";
import featuresOverviewContent from "@/docs/features-overview.md?raw";
import roleConsolidationContent from "@/docs/role-consolidation-plan.md?raw";
import chatbotGuideContent from "@/docs/chatbot-guide.md?raw";
import platformAdminContent from "@/docs/platform-administration.md?raw";
import roleBasedFeaturesContent from "@/docs/role-based-features.md?raw";

const Documentation = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customDocs, setCustomDocs] = useState<any[]>([]);
  const [useAI, setUseAI] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [previewMode, setPreviewMode] = useState(true); // true = preview, false = edit
  
  // Form state for new documentation
  const [newDoc, setNewDoc] = useState({
    title: "",
    content: "",
    category: "general",
  });

  useEffect(() => {
    checkAdminAccess();
    fetchCustomDocumentation();
  }, []);

  const fetchCustomDocumentation = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_documentation')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCustomDocs(data || []);
    } catch (error: any) {
      logger.error('Error fetching custom documentation:', error);
      toast({
        title: "Error Loading Custom Documentation",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase.rpc('get_user_roles' as any, { _user_id: user.id });
    if (!roles || !roles.includes('platform_admin')) {
      toast({
        title: "Access Denied",
        description: "You need platform admin privileges to access documentation",
        variant: "destructive",
      });
      navigate("/admin");
      return;
    }

    setLoading(false);
  };

  const handleRefreshDocumentation = async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await invokeFunction('generate-documentation', {
        body: {
          prompt: `Generate comprehensive, detailed, end-to-end documentation for the entire TalentGeenie Platform covering:

1. Complete platform architecture and technical implementation
2. All 8 user roles (platform_admin, partner_admin, hr_recruiter, tech_spoc, interviewer, ta_creator, billing_contact, candidate) with detailed workflows
3. Every feature and functionality available in the platform including:
   - Interview creation and management
   - AI-driven question generation and evaluation
   - Real-time proctoring and integrity monitoring
   - Learning management and certifications
   - Advanced analytics and reporting
   - Partner onboarding and organization management
   - Billing and subscription management
   - ATS integrations
   - API reference and integration guides
4. Step-by-step user guides for each role
5. Security implementation, RLS policies, and data protection
6. Deployment guides (cloud and self-hosted)
7. API documentation with examples
8. Troubleshooting guides and FAQs
9. Development setup and contribution guidelines

Generate very low-level, technical documentation with code examples, database schemas, API endpoints, and detailed workflows. Include all configuration options, environment variables, and advanced features.`
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      // Save the generated documentation to the correct table
      if (data?.content) {
        const { error: insertError } = await supabase
          .from('platform_documentation')
          .insert({
            title: 'Platform Documentation (AI Generated)',
            content: data.content,
            category: 'platform',
            version: new Date().toISOString(),
            status: 'published',
            created_by: session?.user?.id,
          });

        if (insertError) {
          logger.error('Error saving documentation:', insertError);
        }
      }

      toast({
        title: "Documentation Refreshed",
        description: data?.content ? "New documentation generated and saved successfully" : "Documentation generated successfully",
      });

      // Reload custom documentation instead of page reload
      await fetchCustomDocumentation();
    } catch (error: any) {
      logger.error('Documentation refresh error:', error);
      toast({
        title: "Error Refreshing Documentation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateDocumentation = async () => {
    if (!newDoc.title || !newDoc.content) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (useAI) {
      // AI-powered generation with preview
      setIsGenerating(true);
      setCreating(true);
      setGenerationProgress('Analyzing your request...');

      try {
        setGenerationProgress('Selecting relevant code files...');
        
        const { data, error } = await invokeFunction('generate-documentation-from-code', {
          body: {
            title: newDoc.title,
            content: newDoc.content,
            category: newDoc.category
          }
        });

        if (error) throw error;

        if (data?.success && data?.preview) {
          // Show preview instead of saving directly
          setPreviewData(data.data);
          setEditedContent(data.data.content);
          setShowPreview(true);
          setCreateDialogOpen(false);
          toast({
            title: "Documentation Generated",
            description: `Preview ready! Analyzed ${data.filesScanned} file patterns. Review and edit before saving.`,
          });
        }
      } catch (error: any) {
        logger.error('Error generating documentation:', error);
        toast({
          title: "Error Generating Documentation",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsGenerating(false);
        setCreating(false);
        setGenerationProgress('');
      }
    } else {
      // Manual creation
      setCreating(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('platform_documentation')
          .insert({
            title: newDoc.title,
            content: newDoc.content,
            category: newDoc.category,
            created_by: user?.id,
            status: 'published',
            is_ai_generated: false,
          });

        if (error) throw error;

        toast({
          title: "Documentation Created",
          description: "New documentation has been added successfully",
        });

        setCreateDialogOpen(false);
        setNewDoc({ title: "", content: "", category: "general" });
        
        await fetchCustomDocumentation();
      } catch (error: any) {
        toast({
          title: "Error Creating Documentation",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setCreating(false);
      }
    }
  };

  const handleRegenerateDoc = async (doc: any) => {
    if (!doc.is_ai_generated || !doc.generation_prompt) {
      toast({
        title: "Cannot Regenerate",
        description: "This document was not AI-generated or is missing generation instructions",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('Regenerating documentation...');

    try {
      const { data, error } = await invokeFunction('generate-documentation-from-code', {
        body: {
          title: doc.title,
          content: doc.generation_prompt,
          category: doc.category,
          documentId: doc.id
        }
      });

      if (error) throw error;

      if (data?.success && data?.preview) {
        // Show preview for regenerated content
        setPreviewData(data.data);
        setEditedContent(data.data.content);
        setShowPreview(true);
        toast({
          title: "Documentation Regenerated",
          description: `Preview ready! Analyzed ${data.filesScanned} file patterns. Review and edit before saving.`,
        });
      }
    } catch (error: any) {
      logger.error('Error regenerating documentation:', error);
      toast({
        title: "Error Regenerating",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const handleSavePreview = async () => {
    if (!previewData) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (previewData.documentId) {
        // Update existing document
        const { error: updateError } = await supabase
          .from('platform_documentation')
          .update({
            content: editedContent,
            category: previewData.category,
            source_files: previewData.source_files,
            file_hashes: previewData.file_hashes,
            generation_prompt: previewData.generation_prompt,
            is_ai_generated: true,
            last_generated_at: new Date().toISOString(),
            needs_regeneration: false,
          })
          .eq('id', previewData.documentId);

        if (updateError) throw updateError;
        toast({
          title: "Documentation Updated",
          description: "AI-generated documentation has been updated successfully",
        });
      } else {
        // Create new document
        const { error: insertError } = await supabase
          .from('platform_documentation')
          .insert({
            title: previewData.title,
            content: editedContent,
            category: previewData.category,
            source_files: previewData.source_files,
            file_hashes: previewData.file_hashes,
            generation_prompt: previewData.generation_prompt,
            is_ai_generated: true,
            created_by: user?.id,
            status: 'published',
            last_generated_at: new Date().toISOString(),
            needs_regeneration: false,
          });

        if (insertError) throw insertError;
        toast({
          title: "Documentation Created",
          description: "AI-generated documentation has been saved successfully",
        });
      }

      setShowPreview(false);
      setPreviewData(null);
      setEditedContent('');
      setNewDoc({ title: '', content: '', category: 'general' });
      setUseAI(false);
      await fetchCustomDocumentation();
    } catch (error: any) {
      logger.error('Error saving documentation:', error);
      toast({
        title: "Error Saving Documentation",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewData(null);
    setEditedContent('');
  };

  // Map custom docs to match the structure of static docs
  const mappedCustomDocs = customDocs.map((doc) => ({
    title: doc.title,
    description: `Custom documentation - ${doc.category}`,
    category: getCategoryDisplayName(doc.category),
    badgeColor: doc.is_ai_generated 
      ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" 
      : "bg-violet-500/20 text-violet-700 dark:text-violet-300",
    content: doc.content,
    priority: 999, // Low priority so they appear after static docs
    isCustom: true,
    isAIGenerated: doc.is_ai_generated,
    originalDoc: doc, // Keep reference for regeneration
  }));

  // Helper function to get display name for category
  function getCategoryDisplayName(category: string): string {
    const categoryMap: Record<string, string> = {
      general: "Essentials",
      technical: "Technical",
      deployment: "Deployment",
      development: "Development",
      support: "Support",
    };
    return categoryMap[category] || "Essentials";
  }

  const staticDocuments = [
    {
      title: "Getting Started Guide",
      description: "Quick start guide for new users - Learn how to create interviews, share with candidates, and review results",
      category: "Essentials",
      badgeColor: "bg-green-500/20 text-green-700 dark:text-green-300",
      content: userGuideContent,
      priority: 1,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "Features Overview",
      description: "Complete overview of all platform features including AI question generation, proctoring, assessments, and training modules",
      category: "Essentials",
      badgeColor: "bg-primary/20 text-primary",
      content: featuresOverviewContent,
      priority: 2,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "Role-Based Features & Access Control",
      description: "Comprehensive breakdown of all features organized by user role - detailed access levels, capabilities, and permissions for each of the 8 roles",
      category: "Essentials",
      badgeColor: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
      content: roleBasedFeaturesContent,
      priority: 2,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "AI Chatbot Guide",
      description: "Comprehensive guide for using and managing the AI-powered chatbot assistant with role-based responses and custom training",
      category: "Essentials",
      badgeColor: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
      content: chatbotGuideContent,
      priority: 3,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "FAQ & Troubleshooting",
      description: "Common questions, solutions to frequent issues, and troubleshooting tips for smooth operation",
      category: "Support",
      badgeColor: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
      content: faqContent,
      priority: 4,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "Technical Documentation",
      description: "Complete technical reference - Database schema, API endpoints, edge functions, security implementation, and integrations",
      category: "Technical",
      badgeColor: "bg-accent/20 text-accent",
      content: technicalDocContent,
      priority: 4,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "System Architecture",
      description: "Architecture overview - Component structure, data flow, security design, and scalability patterns",
      category: "Technical",
      badgeColor: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
      content: architectureDocContent,
      priority: 5,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "API Reference",
      description: "Complete API documentation with endpoints, database functions, edge functions, authentication, and code examples",
      category: "Development",
      badgeColor: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
      content: apiReferenceContent,
      priority: 6,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "Deployment Guide",
      description: "Comprehensive deployment instructions for Vercel, Netlify, Docker, AWS, Azure, GCP, and self-hosted environments",
      category: "Deployment",
      badgeColor: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
      content: deploymentDocContent,
      priority: 7,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "Self-Hosted Production Setup",
      description: "Advanced guide for production deployments with custom domains, AI API keys, and full infrastructure independence",
      category: "Deployment",
      badgeColor: "bg-red-500/20 text-red-700 dark:text-red-300",
      content: selfHostedDeploymentContent,
      priority: 8,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "Source Code Reference",
      description: "Detailed source code documentation for components, utilities, hooks, and configuration files",
      category: "Development",
      badgeColor: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
      content: sourceCodeContent,
      priority: 9,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "Role Consolidation Plan",
      description: "Strategic plan to consolidate 11 roles into 6 core roles, reducing complexity while maintaining functionality",
      category: "Development",
      badgeColor: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
      content: roleConsolidationContent,
      priority: 10,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    },
    {
      title: "Platform Administration Guide",
      description: "Comprehensive guide for platform administrators covering organization management, user control, system configuration, and security",
      category: "Essentials",
      badgeColor: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
      content: platformAdminContent,
      priority: 11,
      isCustom: false,
      isAIGenerated: false,
      originalDoc: null,
    }
  ];

  // Merge static and custom docs, sort by category and priority
  const documents = [...staticDocuments, ...mappedCustomDocs].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.priority - b.priority;
  });

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading documentation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header with Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">📖 Documentation Center</h1>
                <p className="text-muted-foreground mt-1">
                  Comprehensive documentation organized by category - From getting started to advanced deployment
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => navigate('/admin/architecture')}
                variant="outline"
                className="gap-2"
              >
                <GitBranch className="w-4 h-4" />
                Architecture Diagrams
              </Button>
              
              <Button
                onClick={handleRefreshDocumentation}
                disabled={refreshing}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh All'}
              </Button>
              
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Documentation
              </Button>
            </div>
          </div>
        </div>

        {/* Documentation organized by category */}
        <div className="space-y-8">
          {/* Essentials */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-green-500 rounded"></span>
              Essential Documentation
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter(doc => doc.category === "Essentials")
                .map((doc) => (
                   <div key={doc.title} className="relative group">
                    <div className="absolute -top-2 right-2 z-10 flex items-center gap-2">
                      {doc.isCustom && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
                          {doc.isAIGenerated ? '🤖 AI Generated' : 'Custom'}
                        </span>
                      )}
                      {doc.isAIGenerated && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                          onClick={() => handleRegenerateDoc(doc.originalDoc)}
                          disabled={isGenerating}
                        >
                          <RotateCw className={`h-3 w-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                          Regenerate
                        </Button>
                      )}
                    </div>
                    <DocumentViewer
                      title={doc.title}
                      description={doc.description}
                      category={doc.category}
                      content={doc.content}
                      badgeColor={doc.badgeColor}
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Support */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-purple-500 rounded"></span>
              Help & Support
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter(doc => doc.category === "Support")
                .map((doc) => (
                  <div key={doc.title} className="relative group">
                    <div className="absolute -top-2 right-2 z-10 flex items-center gap-2">
                      {doc.isCustom && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
                          {doc.isAIGenerated ? '🤖 AI Generated' : 'Custom'}
                        </span>
                      )}
                      {doc.isAIGenerated && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                          onClick={() => handleRegenerateDoc(doc.originalDoc)}
                          disabled={isGenerating}
                        >
                          <RotateCw className={`h-3 w-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                          Regenerate
                        </Button>
                      )}
                    </div>
                    <DocumentViewer
                      title={doc.title}
                      description={doc.description}
                      category={doc.category}
                      content={doc.content}
                      badgeColor={doc.badgeColor}
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Technical */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-blue-500 rounded"></span>
              Technical Reference
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter(doc => doc.category === "Technical")
                .map((doc) => (
                  <div key={doc.title} className="relative group">
                    <div className="absolute -top-2 right-2 z-10 flex items-center gap-2">
                      {doc.isCustom && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
                          {doc.isAIGenerated ? '🤖 AI Generated' : 'Custom'}
                        </span>
                      )}
                      {doc.isAIGenerated && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                          onClick={() => handleRegenerateDoc(doc.originalDoc)}
                          disabled={isGenerating}
                        >
                          <RotateCw className={`h-3 w-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                          Regenerate
                        </Button>
                      )}
                    </div>
                    <DocumentViewer
                      title={doc.title}
                      description={doc.description}
                      category={doc.category}
                      content={doc.content}
                      badgeColor={doc.badgeColor}
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Development */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-cyan-500 rounded"></span>
              Development Guides
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter(doc => doc.category === "Development")
                .map((doc) => (
                  <div key={doc.title} className="relative group">
                    <div className="absolute -top-2 right-2 z-10 flex items-center gap-2">
                      {doc.isCustom && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
                          {doc.isAIGenerated ? '🤖 AI Generated' : 'Custom'}
                        </span>
                      )}
                      {doc.isAIGenerated && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                          onClick={() => handleRegenerateDoc(doc.originalDoc)}
                          disabled={isGenerating}
                        >
                          <RotateCw className={`h-3 w-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                          Regenerate
                        </Button>
                      )}
                    </div>
                    <DocumentViewer
                      title={doc.title}
                      description={doc.description}
                      category={doc.category}
                      content={doc.content}
                      badgeColor={doc.badgeColor}
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Deployment */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-orange-500 rounded"></span>
              Deployment & Production
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents
                .filter(doc => doc.category === "Deployment")
                .map((doc) => (
                  <div key={doc.title} className="relative group">
                    <div className="absolute -top-2 right-2 z-10 flex items-center gap-2">
                      {doc.isCustom && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
                          {doc.isAIGenerated ? '🤖 AI Generated' : 'Custom'}
                        </span>
                      )}
                      {doc.isAIGenerated && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                          onClick={() => handleRegenerateDoc(doc.originalDoc)}
                          disabled={isGenerating}
                        >
                          <RotateCw className={`h-3 w-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                          Regenerate
                        </Button>
                      )}
                    </div>
                    <DocumentViewer
                      title={doc.title}
                      description={doc.description}
                      category={doc.category}
                      content={doc.content}
                      badgeColor={doc.badgeColor}
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> All documentation is also available as markdown files in the <code>src/docs/</code> directory of the codebase. 
            You can view, download, and share these documents directly from this page.
          </p>
        </div>
      </div>

      {/* Create Documentation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Documentation</DialogTitle>
            <DialogDescription>
              Add manual documentation or use AI to generate from codebase
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* AI Toggle */}
            <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <input
                type="checkbox"
                id="useAI"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="useAI" className="cursor-pointer flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Use AI to generate documentation from codebase</span>
              </Label>
            </div>

            {useAI && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm space-y-2">
                <p className="font-medium text-blue-700 dark:text-blue-300">🤖 AI Documentation Generator</p>
                <p className="text-muted-foreground">
                  Provide a title and describe what you want documented. AI will analyze the codebase and generate comprehensive documentation.
                </p>
                <p className="text-muted-foreground">
                  <strong>Example:</strong> "Document all interview pages with roles, step-by-step flows, configurations, and database interactions"
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder={useAI ? "e.g., Interview Flow Complete Guide" : "e.g., Advanced Security Configuration"}
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={newDoc.category}
                onValueChange={(value) => setNewDoc({ ...newDoc, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="essentials">Essentials</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="deployment">Deployment</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="content">
                {useAI ? 'Instructions for AI Generator *' : 'Content (Markdown) *'}
              </Label>
              <Textarea
                id="content"
                placeholder={useAI 
                  ? "Describe what you want documented. Be specific about flows, roles, features, configurations, etc.\n\nExample: Document all interview pages with their required roles, step-by-step user flows, configuration options, database interactions, and edge functions called."
                  : "Write your documentation content in Markdown format..."
                }
                value={newDoc.content}
                onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {useAI 
                  ? 'Describe in detail what should be documented. AI will scan relevant code files and generate comprehensive documentation.'
                  : 'Supports full Markdown formatting including headers, lists, code blocks, and links'
                }
              </p>
            </div>

            {isGenerating && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                  <div>
                    <p className="text-sm font-medium">{generationProgress}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This may take 30-60 seconds depending on codebase size
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setUseAI(false);
              }}
              disabled={creating || isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDocumentation}
              disabled={creating || isGenerating}
            >
              {isGenerating ? 'Generating...' : creating ? 'Creating...' : useAI ? '🤖 Generate with AI' : 'Create Documentation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review AI-Generated Documentation</DialogTitle>
            <DialogDescription>
              Review and edit the generated content before saving to the database.
            </DialogDescription>
          </DialogHeader>
          
          {previewData && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <p className="text-sm font-medium mt-1">{previewData.title}</p>
              </div>
              
              <div>
                <Label>Category</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {getCategoryDisplayName(previewData.category)}
                </p>
              </div>

              {previewData.source_files && previewData.source_files.length > 0 && (
                <div>
                  <Label>Source Files Analyzed</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {previewData.source_files.map((file: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {file}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Content</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={previewMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewMode(true)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant={!previewMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewMode(false)}
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>

                {previewMode ? (
                  <div className="mt-2 min-h-[400px] max-h-[600px] overflow-y-auto border rounded-lg p-4 bg-background/50">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{editedContent}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <>
                    <Textarea
                      id="preview-content"
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="mt-2 min-h-[400px] font-mono text-sm"
                      placeholder="Edit the generated documentation..."
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Edit the markdown content. Switch to Preview to see the formatted result.
                    </p>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancelPreview}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePreview}
                  disabled={!editedContent.trim()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Documentation
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documentation;
