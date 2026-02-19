import { useEffect, useState, useMemo } from "react";
import { logger } from '@/lib/logger';
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { categoryToOverallDifficulty, CategoryDifficultyDistribution } from "@/lib/roleBasedDefaults";
import { useOrganization } from "@/contexts/OrganizationContext";

import { Plus, FileText, Users, Clock, TrendingUp, Search, LayoutGrid, List, ChevronLeft, ChevronRight, Briefcase, User, Shield, Send, CheckCircle2, ChevronDown, Download, Layers, Grid3X3 } from "lucide-react";
import { generateExcelTemplate, downloadBlob } from "@/lib/interviewTemplateUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper function to calculate actual difficulty from category distribution
const getActualDifficulty = (interview: any) => {
  // If we have category_difficulty_distribution and question_type_distribution, calculate the real difficulty
  if (interview.category_difficulty_distribution && interview.question_type_distribution) {
    const typeDistribution = interview.question_type_distribution;
    const totalQuestions = (typeDistribution.mcq || 0) + (typeDistribution.scenario || 0) + 
                          (typeDistribution.coding || 0) + (typeDistribution.descriptive || 0);
    
    if (totalQuestions > 0) {
      const typeDistributionPercent = {
        mcq: Math.round(((typeDistribution.mcq || 0) / totalQuestions) * 100),
        scenario: Math.round(((typeDistribution.scenario || 0) / totalQuestions) * 100),
        coding: Math.round(((typeDistribution.coding || 0) / totalQuestions) * 100),
        descriptive: Math.round(((typeDistribution.descriptive || 0) / totalQuestions) * 100),
      };
      
      return categoryToOverallDifficulty(
        interview.category_difficulty_distribution as CategoryDifficultyDistribution, 
        typeDistributionPercent
      );
    }
  }
  
  // Fallback to stored difficulty_distribution
  return interview.difficulty_distribution || { easy: 30, medium: 50, hard: 20 };
};

const ITEMS_PER_PAGE_CARDS = 20;
const ITEMS_PER_PAGE_COMPACT = 30;
const ITEMS_PER_PAGE_TABLE = 25;

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, errorToast } = useUserFriendlyToast();
  const { selectedOrgId, isImpersonating } = useOrganization();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New state for view, search, filter, pagination, grouping
  const [viewMode, setViewMode] = useState<'cards' | 'compact' | 'table'>('compact'); // Default to compact for more items
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>(['active', 'draft']); // Default: hide archived
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'creator'>('none');

  // Determine the correct base path based on current location
  const getBasePath = () => {
    if (location.pathname.startsWith('/interviewer')) {
      return '/interviewer';
    } else if (location.pathname.startsWith('/partner')) {
      return '/partner/recruiting';
    }
    return '/partner/recruiting';
  };

  const basePath = getBasePath();

  // Refetch when organization changes (e.g., platform admin switches org view)
  useEffect(() => {
    fetchInterviews();
  }, [selectedOrgId]);

  const fetchInterviews = async () => {
    let query = supabase
      .from("interviews")
      .select(`
        *,
        interview_attempts (id, status),
        interview_invitations (id),
        profiles:creator_id (full_name, email)
      `)
      .order("created_at", { ascending: false });

    // Filter by organization when viewing as a specific org (impersonation or partner user)
    if (selectedOrgId) {
      query = query.eq('organization_id', selectedOrgId);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load interviews",
        variant: "destructive",
      });
    } else {
      // Process data to add computed counts
      const processedData = (data || []).map(interview => ({
        ...interview,
        invitations_count: interview.interview_invitations?.length || 0,
        attempts_count: interview.interview_attempts?.length || 0,
        completed_count: interview.interview_attempts?.filter((a: any) => 
          a.status === 'evaluated' || a.status === 'submitted'
        ).length || 0,
      }));
      setInterviews(processedData);
    }
    setLoading(false);
  };

  // Filtered and paginated interviews
  const filteredInterviews = useMemo(() => {
    let result = interviews;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(i => 
        i.title?.toLowerCase().includes(query) ||
        i.job_description?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter (multi-select)
    if (statusFilters.length > 0 && statusFilters.length < 3) {
      result = result.filter(i => statusFilters.includes(i.status));
    }
    // If all 3 are selected or none selected, show all
    
    return result;
  }, [interviews, searchQuery, statusFilters]);

  const itemsPerPage = useMemo(() => {
    switch (viewMode) {
      case 'compact': return ITEMS_PER_PAGE_COMPACT;
      case 'table': return ITEMS_PER_PAGE_TABLE;
      default: return ITEMS_PER_PAGE_CARDS;
    }
  }, [viewMode]);

  const totalPages = Math.ceil(filteredInterviews.length / itemsPerPage);
  
  const paginatedInterviews = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInterviews.slice(start, start + itemsPerPage);
  }, [filteredInterviews, currentPage, itemsPerPage]);

  // Group interviews by selected grouping
  const groupedInterviews = useMemo(() => {
    if (groupBy === 'none') return null;
    
    const groups: Record<string, any[]> = {};
    paginatedInterviews.forEach(interview => {
      let key = '';
      if (groupBy === 'status') {
        key = interview.status || 'unknown';
      } else if (groupBy === 'creator') {
        key = interview.profiles?.full_name || interview.profiles?.email || 'Unknown';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(interview);
    });
    return groups;
  }, [paginatedInterviews, groupBy]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilters, viewMode]);

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev => {
      if (prev.includes(status)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== status);
      }
      return [...prev, status];
    });
  };

  const getStatusFilterLabel = () => {
    if (statusFilters.length === 3) return 'All Status';
    if (statusFilters.length === 0) return 'Select Status';
    if (statusFilters.length === 2 && statusFilters.includes('active') && statusFilters.includes('draft')) {
      return 'Active & Draft';
    }
    return statusFilters.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/10 text-success border-success/20";
      case "draft": return "bg-warning/10 text-warning border-warning/20";
      case "archived": return "bg-muted text-muted-foreground border-muted";
      default: return "bg-secondary text-secondary-foreground border-secondary/20";
    }
  };

  const handleInterviewClick = (interview: any) => {
    // Approved, pending_review, or needs_changes drafts should go to detail page
    // Only pure drafts (never reviewed) go to edit page
    if (interview.status === 'draft' && 
        interview.questions_status !== 'approved' && 
        interview.questions_status !== 'pending_review' &&
        interview.questions_status !== 'needs_changes') {
      navigate(`${basePath}/create-interview?id=${interview.id}`);
    } else {
      navigate(`${basePath}/interview/${interview.id}`);
    }
  };

  const renderCardView = () => (
    <div className="grid-responsive">
      {paginatedInterviews.map((interview) => (
        <Card 
          key={interview.id}
          className="glass hover-lift cursor-pointer border-border/50 group"
          onClick={() => handleInterviewClick(interview)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                {interview.title}
              </CardTitle>
              <Badge className={`${getStatusColor(interview.status)} whitespace-nowrap text-xs`}>
                {interview.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {/* Compact metrics row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium">{interview.question_count} Qs</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="font-medium">{interview.time_limit || 60} min</span>
                </div>
              </div>
              {interview.proctoring_enabled && (
                <div className="p-1 rounded bg-primary/10" title="Proctoring Enabled">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
            </div>

            {/* New metrics row: Invitations, Completed, Total Attempts */}
            <div className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground" title="Invitations Sent">
                <Send className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-medium">{interview.invitations_count}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground" title="Completed">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span className="font-medium">{interview.completed_count}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground" title="Total Attempts">
                <Users className="w-3.5 h-3.5 text-accent" />
                <span className="font-medium">{interview.attempts_count}</span>
              </div>
            </div>

            {/* Difficulty Distribution - calculated from category distribution for accuracy */}
            {(() => {
              const difficulty = getActualDifficulty(interview);
              return (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Difficulty</span>
                  <div className="flex gap-2">
                    <span className="text-success font-medium">E: {Math.round(difficulty.easy || 0)}%</span>
                    <span className="text-warning font-medium">M: {Math.round(difficulty.medium || 0)}%</span>
                    <span className="text-destructive font-medium">H: {Math.round(difficulty.hard || 0)}%</span>
                  </div>
                </div>
              );
            })()}

            {/* Creator and date footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 truncate">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{interview.profiles?.full_name || interview.profiles?.email || 'Unknown'}</span>
              </div>
              <span className="shrink-0">
                {new Date(interview.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Compact card view - shows essential info in a clean layout matching reference
  const renderCompactCard = (interview: any) => (
    <Card 
      key={interview.id}
      className="bg-card/80 hover:bg-card hover:shadow-md cursor-pointer border border-border/40 rounded-xl transition-all duration-200 group"
      onClick={() => handleInterviewClick(interview)}
    >
      <CardContent className="p-4">
        {/* Title row with status badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-tight flex-1">
            {interview.title}
          </h3>
          <Badge className={`${getStatusColor(interview.status)} text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium`}>
            {interview.status}
          </Badge>
        </div>

        {/* Metrics row - clean horizontal layout */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span>{interview.question_count}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span>{interview.attempts_count}</span>
            </span>
          </div>
          {/* Proctoring indicator */}
          <div className={`w-4 h-4 rounded-full ${interview.proctoring_enabled ? 'bg-primary/30 ring-2 ring-primary/50' : 'bg-muted ring-1 ring-border'}`} />
        </div>

        {/* Date - bottom aligned */}
        <div className="text-xs text-muted-foreground/70 mt-2.5">
          {new Date(interview.created_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderCompactView = () => (
    <div className="grid-compact">
      {paginatedInterviews.map(interview => renderCompactCard(interview))}
    </div>
  );

  const renderTableView = () => (
    <Card className="glass border-border/50">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Questions</TableHead>
            <TableHead className="text-center">Invited</TableHead>
            <TableHead className="text-center">Completed</TableHead>
            <TableHead className="text-center">Attempts</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedInterviews.map((interview) => (
            <TableRow 
              key={interview.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleInterviewClick(interview)}
            >
              <TableCell className="font-medium max-w-[300px]">
                <span className="line-clamp-1">{interview.title}</span>
              </TableCell>
              <TableCell>
                <Badge className={`${getStatusColor(interview.status)} whitespace-nowrap text-xs`}>
                  {interview.status}
                </Badge>
              </TableCell>
              <TableCell className="text-center">{interview.question_count}</TableCell>
              <TableCell className="text-center">{interview.invitations_count}</TableCell>
              <TableCell className="text-center">{interview.completed_count}</TableCell>
              <TableCell className="text-center">{interview.attempts_count}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(interview.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  const renderGroupedContent = () => {
    if (!groupedInterviews) return null;
    
    return (
      <div className="space-y-6">
        {Object.entries(groupedInterviews).map(([groupName, items]) => (
          <div key={groupName} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold capitalize">{groupName}</h3>
              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
            </div>
            {viewMode === 'table' ? (
              <Card className="glass border-border/50">
                <Table>
                  <TableBody>
                    {items.map((interview) => (
                      <TableRow 
                        key={interview.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleInterviewClick(interview)}
                      >
                        <TableCell className="font-medium max-w-[300px]">
                          <span className="line-clamp-1">{interview.title}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(interview.status)} whitespace-nowrap text-xs`}>
                            {interview.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{interview.question_count}</TableCell>
                        <TableCell className="text-center">{interview.attempts_count}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(interview.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : viewMode === 'compact' ? (
              <div className="grid-compact">
                {items.map(interview => renderCompactCard(interview))}
              </div>
            ) : (
              <div className="grid-responsive">
                {items.map((interview) => (
                  <Card 
                    key={interview.id}
                    className="glass hover-lift cursor-pointer border-border/50 group"
                    onClick={() => handleInterviewClick(interview)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                        {interview.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{interview.question_count} Qs</span>
                        <span className="flex items-center gap-1"><Users className="w-4 h-4" />{interview.attempts_count}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (paginatedInterviews.length === 0) {
      return (
        <Card className="glass border-border/50">
          <CardContent className="py-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No interviews found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
          </CardContent>
        </Card>
      );
    }

    if (groupBy !== 'none') {
      return renderGroupedContent();
    }

    switch (viewMode) {
      case 'compact': return renderCompactView();
      case 'table': return renderTableView();
      default: return renderCardView();
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-responsive-lg font-bold gradient-text">
            Interview Management
          </h2>
          <p className="text-muted-foreground">
            Create, manage, and track your AI-powered interviews
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={async () => {
              try {
                const blob = await generateExcelTemplate('Interview Configuration');
                downloadBlob(blob, 'interview-configuration-template.xlsx');
              } catch (error) {
                logger.error('Error downloading template:', error);
              }
            }}
            className="group"
          >
            <Download className="w-4 h-4 mr-2 group-hover:translate-y-0.5 transition-transform" />
            Download Template
          </Button>
          <Button 
            onClick={() => navigate(`${basePath}/jd-builder`)}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all group"
          >
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
            Create Interview
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && interviews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <Card className="glass border-border/50 hover-lift">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold gradient-text">{interviews.length}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Interviews</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50 hover-lift">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7 text-success" />
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold" style={{ background: 'linear-gradient(135deg, hsl(158 64% 52%) 0%, hsl(142 76% 46%) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {interviews.filter(i => i.status === 'active').length}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Active Interviews</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50 hover-lift">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 sm:w-7 sm:h-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-muted-foreground">
                    {interviews.filter(i => i.status === 'archived').length}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Archived</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50 hover-lift">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 sm:w-7 sm:h-7 text-accent" />
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold gradient-text">
                    {interviews.reduce((sum, i) => sum + (i.attempts_count || 0), 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Attempts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading positions...</p>
        </div>
      ) : interviews.length === 0 ? (
        <Card className="glass border-2 border-dashed border-primary/20">
          <CardContent className="py-24 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
              <FileText className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">No interviews yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Create your first AI-powered interview to get started with smarter hiring
            </p>
            <Button 
              onClick={() => navigate(`${basePath}/jd-builder`)}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg group"
            >
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
              Create Interview
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Search, Filter, and View Toggle Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-1 gap-3 w-full sm:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search interviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>
              
              {/* Status Filter - Multi-select with checkboxes */}
              <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[160px] justify-between bg-background/50">
                    <span className="truncate">{getStatusFilterLabel()}</span>
                    <ChevronDown className="w-4 h-4 ml-2 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[160px] p-2 bg-background border shadow-lg z-50" align="start">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer">
                      <Checkbox 
                        checked={statusFilters.includes('active')} 
                        onCheckedChange={() => toggleStatusFilter('active')}
                      />
                      <span className="text-sm">Active</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer">
                      <Checkbox 
                        checked={statusFilters.includes('draft')} 
                        onCheckedChange={() => toggleStatusFilter('draft')}
                      />
                      <span className="text-sm">Draft</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer">
                      <Checkbox 
                        checked={statusFilters.includes('archived')} 
                        onCheckedChange={() => toggleStatusFilter('archived')}
                      />
                      <span className="text-sm">Archived</span>
                    </label>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Group By */}
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <SelectTrigger className="w-[130px] bg-background/50">
                <Layers className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="creator">By Creator</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
              <Button
                variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('compact')}
                className="h-8 px-2"
                title="Compact view - shows more interviews"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="h-8 px-2"
                title="Card view - detailed cards"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8 px-2"
                title="Table view - list format"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            Showing {paginatedInterviews.length} of {filteredInterviews.length} interviews
            {groupBy !== 'none' && ` (grouped by ${groupBy})`}
          </p>

          {/* Content based on view mode */}
          {renderContent()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {totalPages <= 7 ? (
                  Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))
                ) : (
                  <>
                    <Button
                      variant={currentPage === 1 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      className="w-8 h-8 p-0"
                    >
                      1
                    </Button>
                    {currentPage > 3 && <span className="px-1 text-muted-foreground">...</span>}
                    {Array.from({ length: 3 }, (_, i) => currentPage - 1 + i)
                      .filter(p => p > 1 && p < totalPages)
                      .map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      ))
                    }
                    {currentPage < totalPages - 2 && <span className="px-1 text-muted-foreground">...</span>}
                    <Button
                      variant={currentPage === totalPages ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-8 h-8 p-0"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;