import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { normalizeHiringDecision, getHiringDecisionInfo } from "@/lib/hiringDecisionUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  Columns,
  GripVertical,
  LayoutDashboard,
  BarChart3,
  Table as TableIcon,
  ExternalLink,
  FileText
} from "lucide-react";
import { ReportsDashboard } from "@/components/reports/ReportsDashboard";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { ReportsFilterSidebar, ReportFilters } from "@/components/reports/ReportsFilterSidebar";
import { format, subDays } from "date-fns";
import ExcelJS from "exceljs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ReportColumn {
  id: string;
  label: string;
  category: string;
  accessor: (row: any) => any;
  format?: (value: any) => string;
}

// Status label and color mapping
const getStatusInfo = (status: string) => {
  const statusMap: Record<string, { label: string; color: string }> = {
    'completed': { label: 'Completed', color: 'bg-success/10 text-success' },
    'evaluated': { label: 'Evaluated', color: 'bg-primary/10 text-primary' },
    'submitted': { label: 'Submitted', color: 'bg-primary/10 text-primary' },
    'in_progress': { label: 'In Progress', color: 'bg-warning/10 text-warning' },
    'pending_upload': { label: 'Pending Upload', color: 'bg-warning/10 text-warning' },
    'upload_failed': { label: 'Upload Failed', color: 'bg-destructive/10 text-destructive' },
    'abandoned': { label: 'Abandoned', color: 'bg-muted text-muted-foreground' },
  };
  return statusMap[status] || { label: status, color: 'bg-muted text-muted-foreground' };
};

// Failure reason mapping
const getFailureReason = (row: any) => {
  const status = row.status;
  if (status === 'completed' || status === 'evaluated' || status === 'submitted') {
    return '—';
  }
  if (status === 'upload_failed') {
    return row.failure_reason || 'Video/audio upload failed';
  }
  if (status === 'abandoned') {
    const reasons: string[] = [];
    if (row.time_since_start && row.time_since_start > 3600) {
      reasons.push('Session timeout');
    }
    if (!row.started_at) {
      reasons.push('Never started');
    } else if (!row.submitted_at) {
      reasons.push('Left without submitting');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'Session abandoned';
  }
  if (status === 'in_progress') {
    return 'Still in progress';
  }
  if (status === 'pending_upload') {
    return 'Upload pending';
  }
  return '—';
};

const ALL_COLUMNS: ReportColumn[] = [
  // Candidate Info
  { id: "candidate_name", label: "Candidate Name", category: "Candidate Info", accessor: (r) => r.candidate_name },
  { id: "candidate_email", label: "Email", category: "Candidate Info", accessor: (r) => r.candidate_email },
  { id: "candidate_phone", label: "Phone", category: "Candidate Info", accessor: (r) => r.candidate_phone || "—" },
  
  // Interview Info  
  { id: "interview_title", label: "Interview Title", category: "Interview Info", accessor: (r) => r.interview_title },
  { id: "status", label: "Status", category: "Interview Info", accessor: (r) => r.status },
  { id: "completed_at", label: "Completion Date", category: "Interview Info", accessor: (r) => r.submitted_at, format: (v) => v ? format(new Date(v), "MMM dd, yyyy HH:mm") : "—" },
  { id: "time_taken", label: "Time Taken", category: "Interview Info", accessor: (r) => r.time_taken, format: (v) => v ? `${Math.round(v / 60)} min` : "—" },
  { id: "sent_by", label: "Sent By", category: "Interview Info", accessor: (r) => r.sent_by || "—" },
  { id: "failure_reason", label: "Failure/Abandon Reason", category: "Interview Info", accessor: (r) => getFailureReason(r) },
  
  // Assessment Scores
  { id: "assessment_report", label: "Assessment Report", category: "Assessment", accessor: (r) => r.id },
  { id: "overall_score", label: "Overall Score", category: "Assessment", accessor: (r) => r.overall_score, format: (v) => v != null ? `${v}%` : "—" },
  { id: "hiring_decision", label: "Hiring Decision", category: "Assessment", accessor: (r) => r.hiring_decision, format: (v) => v ? getHiringDecisionInfo(v).label : "—" },
  { id: "technical_score", label: "Technical Score", category: "Assessment", accessor: (r) => r.technical_score, format: (v) => v != null ? `${v}%` : "—" },
  { id: "problem_solving_score", label: "Problem Solving", category: "Assessment", accessor: (r) => r.problem_solving_score, format: (v) => v != null ? `${v}%` : "—" },
  { id: "strengths", label: "Strengths", category: "Assessment", accessor: (r) => r.strengths, format: (v) => Array.isArray(v) ? v.join(", ") : "—" },
  { id: "weaknesses", label: "Weaknesses", category: "Assessment", accessor: (r) => r.weaknesses, format: (v) => Array.isArray(v) ? v.join(", ") : "—" },
  
  // Proctoring & Integrity
  { id: "integrity_score", label: "Integrity Score", category: "Proctoring", accessor: (r) => r.integrity_score, format: (v) => v != null ? `${v}%` : "—" },
  { id: "tab_switches", label: "Tab Switches", category: "Proctoring", accessor: (r) => r.tab_switch_count ?? 0 },
  { id: "copy_attempts", label: "Copy Attempts", category: "Proctoring", accessor: (r) => r.copy_attempt_count ?? 0 },
  { id: "look_away_count", label: "Look Away Count", category: "Proctoring", accessor: (r) => r.look_away_count ?? 0 },
  { id: "multiple_persons", label: "Multiple Persons", category: "Proctoring", accessor: (r) => r.multiple_person_detections ?? 0 },
  { id: "violations_total", label: "Total Violations", category: "Proctoring", accessor: (r) => r.violations_detected ?? 0 },
];

const DEFAULT_COLUMNS = ["candidate_name", "candidate_email", "interview_title", "status", "assessment_report", "completed_at", "overall_score", "hiring_decision", "failure_reason"];

// Draggable table header component
function SortableTableHead({ column }: { column: ReportColumn }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className="whitespace-nowrap select-none"
    >
      <div className="flex items-center gap-1" {...attributes} {...listeners}>
        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
        {column.label}
      </div>
    </TableHead>
  );
}

export default function PartnerReports() {
  const { selectedOrgId, userOrgId } = useOrganization();
  const orgId = selectedOrgId || userOrgId;
  const { errorToast, successToast } = useUserFriendlyToast();
  
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<{ id: string; title: string }[]>([]);
  const [senders, setSenders] = useState<string[]>([]);
  
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMNS);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [columnsOpen, setColumnsOpen] = useState(false);
  
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    dateTo: format(new Date(), "yyyy-MM-dd"),
    interviewId: "all",
    hiringDecision: "all",
    status: "all",
    sentBy: "all",
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle column drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Keep columnOrder in sync when columns are added/removed
  useEffect(() => {
    setColumnOrder(prev => {
      const filtered = prev.filter(id => selectedColumns.includes(id));
      const newCols = selectedColumns.filter(id => !prev.includes(id));
      return [...filtered, ...newCols];
    });
  }, [selectedColumns]);

  // Fetch interviews and senders for filter dropdowns
  useEffect(() => {
    if (!orgId) return;
    
    const fetchDropdownData = async () => {
      const { data: interviewsData } = await supabase
        .from("interviews")
        .select("id, title")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      
      if (interviewsData) {
        setInterviews(interviewsData);
      }

      const { data: membersData } = await supabase
        .from("organization_members")
        .select("profiles(full_name, email)")
        .eq("organization_id", orgId);

      if (membersData) {
        const uniqueSenders = [...new Set(
          membersData
            .map((m: any) => m.profiles?.full_name || m.profiles?.email?.split("@")[0])
            .filter(Boolean)
        )] as string[];
        setSenders(uniqueSenders);
      }
    };

    fetchDropdownData();
  }, [orgId]);

  const fetchReportData = async () => {
    if (!orgId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("interview_attempts")
        .select(`
          id,
          candidate_name,
          candidate_email,
          status,
          time_taken,
          submitted_at,
          started_at,
          created_at,
          interview_id,
          invitation_id,
          interviews!inner(
            id,
            title,
            organization_id
          ),
          assessments(
            overall_score,
            hiring_decision,
            strengths,
            weaknesses
          ),
          candidate_performance_index(
            hiring_recommendation,
            technical_score,
            problem_solving_score,
            integrity_score,
            violations_detected
          ),
          proctoring_sessions(
            integrity_score,
            tab_switch_count,
            copy_attempt_count,
            look_away_count,
            multiple_person_detections
          ),
          interview_invitations!interview_attempts_invitation_id_fkey(
            candidate_phone,
            sent_by
          )
        `)
        .eq("interviews.organization_id", orgId)
        .order("created_at", { ascending: false });

      if (filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      query = query.gte("created_at", `${filters.dateFrom}T00:00:00`)
        .lte("created_at", `${filters.dateTo}T23:59:59`);

      if (filters.interviewId !== "all") {
        query = query.eq("interview_id", filters.interviewId);
      }

      const { data: attemptsData, error } = await query;

      if (error) throw error;

      const senderIds = [...new Set(
        (attemptsData || [])
          .map((a: any) => a.interview_invitations?.sent_by)
          .filter(Boolean)
      )];
      
      let profilesMap = new Map<string, { full_name: string | null; email: string }>();
      if (senderIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", senderIds);
        
        profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      }

      let transformedData = (attemptsData || []).map((attempt: any) => {
        const senderId = attempt.interview_invitations?.sent_by;
        const senderProfile = senderId ? profilesMap.get(senderId) : null;
        
        const assessment = Array.isArray(attempt.assessments) ? attempt.assessments[0] : attempt.assessments;
        const cpi = Array.isArray(attempt.candidate_performance_index) ? attempt.candidate_performance_index[0] : attempt.candidate_performance_index;
        const proctoring = Array.isArray(attempt.proctoring_sessions) ? attempt.proctoring_sessions[0] : attempt.proctoring_sessions;
        
        const timeSinceStart = attempt.started_at 
          ? (new Date().getTime() - new Date(attempt.started_at).getTime()) / 1000 
          : null;
        
        return {
          id: attempt.id,
          candidate_name: attempt.candidate_name,
          candidate_email: attempt.candidate_email,
          candidate_phone: attempt.interview_invitations?.candidate_phone,
          interview_title: attempt.interviews?.title,
          interview_id: attempt.interview_id,
          status: attempt.status,
          submitted_at: attempt.submitted_at,
          started_at: attempt.started_at,
          created_at: attempt.created_at,
          time_taken: attempt.time_taken,
          time_since_start: timeSinceStart,
          sent_by: senderProfile?.full_name || senderProfile?.email?.split("@")[0] || null,
          overall_score: assessment?.overall_score,
          hiring_decision: cpi?.hiring_recommendation || assessment?.hiring_decision,
          strengths: assessment?.strengths,
          weaknesses: assessment?.weaknesses,
          technical_score: cpi?.technical_score,
          problem_solving_score: cpi?.problem_solving_score,
          integrity_score: proctoring?.integrity_score ?? cpi?.integrity_score,
          tab_switch_count: proctoring?.tab_switch_count,
          copy_attempt_count: proctoring?.copy_attempt_count,
          look_away_count: proctoring?.look_away_count,
          multiple_person_detections: proctoring?.multiple_person_detections,
          violations_detected: cpi?.violations_detected,
          has_assessment: !!assessment,
        };
      });

      if (filters.hiringDecision !== "all") {
        transformedData = transformedData.filter(r => 
          normalizeHiringDecision(r.hiring_decision) === filters.hiringDecision
        );
      }
      if (filters.sentBy !== "all") {
        transformedData = transformedData.filter(r => r.sent_by === filters.sentBy);
      }

      setData(transformedData);
    } catch (error: any) {
      console.error("Error fetching report data:", error);
      errorToast("Failed to fetch report data", error.message);
    } finally {
      setLoading(false);
    }
  };

  const activeColumns = useMemo(() => {
    const columnsMap = new Map(ALL_COLUMNS.map(col => [col.id, col]));
    return columnOrder
      .filter(id => selectedColumns.includes(id))
      .map(id => columnsMap.get(id)!)
      .filter(Boolean);
  }, [selectedColumns, columnOrder]);

  const columnsByCategory = useMemo(() => {
    const grouped: Record<string, ReportColumn[]> = {};
    ALL_COLUMNS.forEach(col => {
      if (!grouped[col.category]) grouped[col.category] = [];
      grouped[col.category].push(col);
    });
    return grouped;
  }, []);

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const selectAllColumns = () => setSelectedColumns(ALL_COLUMNS.map(c => c.id));
  const clearAllColumns = () => setSelectedColumns([]);

  const exportToExcel = async () => {
    if (data.length === 0) {
      errorToast("No data to export", "Please generate a report first");
      return;
    }

    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "TalentGeenie";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Completed Candidates Report");

      worksheet.columns = activeColumns.map(col => ({
        header: col.label,
        key: col.id,
        width: col.id === "strengths" || col.id === "weaknesses" ? 40 : 20,
      }));

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      data.forEach(row => {
        const rowData: Record<string, any> = {};
        activeColumns.forEach(col => {
          const value = col.accessor(row);
          rowData[col.id] = col.format ? col.format(value) : value;
        });
        worksheet.addRow(rowData);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `completed-candidates-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      successToast("Export Complete", `Exported ${data.length} records to Excel`);
    } catch (error: any) {
      console.error("Export error:", error);
      errorToast("Export failed", error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Sidebar - Filters */}
      <ReportsFilterSidebar
        filters={filters}
        onFiltersChange={setFilters}
        interviews={interviews}
        senders={senders}
        loading={loading}
        onGenerateReport={fetchReportData}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6" />
                Reports & Analytics
              </h1>
              <p className="text-muted-foreground text-sm">
                Dashboards, charts, and detailed reports for completed candidates
              </p>
            </div>
            {data.length > 0 && (
              <Button variant="outline" onClick={exportToExcel} disabled={exporting}>
                {exporting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export to Excel
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Charts
              </TabsTrigger>
              <TabsTrigger value="detailed" className="flex items-center gap-2">
                <TableIcon className="h-4 w-4" />
                Detailed Report
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="mt-6">
              <ReportsDashboard 
                data={data} 
                dateFrom={filters.dateFrom} 
                dateTo={filters.dateTo}
                loading={loading}
              />
            </TabsContent>

            {/* Charts Tab */}
            <TabsContent value="charts" className="mt-6">
              <ReportsCharts 
                data={data} 
                dateFrom={filters.dateFrom} 
                dateTo={filters.dateTo}
                loading={loading}
              />
            </TabsContent>

            {/* Detailed Report Tab */}
            <TabsContent value="detailed" className="mt-6 space-y-4">
              {/* Column Selection */}
              <Card>
                <Collapsible open={columnsOpen} onOpenChange={setColumnsOpen}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Columns className="h-5 w-5" />
                          <CardTitle className="text-base">Columns</CardTitle>
                          <Badge variant="outline">{selectedColumns.length} selected</Badge>
                        </div>
                        {columnsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      <div className="flex gap-2 mb-4">
                        <Button variant="outline" size="sm" onClick={selectAllColumns}>Select All</Button>
                        <Button variant="outline" size="sm" onClick={clearAllColumns}>Clear All</Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedColumns(DEFAULT_COLUMNS)}>Reset to Default</Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Object.entries(columnsByCategory).map(([category, columns]) => (
                          <div key={category}>
                            <h4 className="font-medium text-sm text-muted-foreground mb-2">{category}</h4>
                            <div className="space-y-2">
                              {columns.map(col => (
                                <div key={col.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={col.id}
                                    checked={selectedColumns.includes(col.id)}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                  />
                                  <Label htmlFor={col.id} className="text-sm cursor-pointer">{col.label}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Results Table */}
              <Card>
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Report Results</CardTitle>
                      <CardDescription>
                        {data.length > 0 
                          ? `Showing ${data.length} candidates` 
                          : "Generate a report to see results"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="space-y-2 p-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : data.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Click "Generate Report" to load data</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <SortableContext
                                items={activeColumns.map(c => c.id)}
                                strategy={horizontalListSortingStrategy}
                              >
                                {activeColumns.map(col => (
                                  <SortableTableHead key={col.id} column={col} />
                                ))}
                              </SortableContext>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.map((row, rowIndex) => (
                              <TableRow key={row.id || rowIndex}>
                                {activeColumns.map(col => {
                                  const value = col.accessor(row);
                                  
                                  if (col.id === "status") {
                                    const statusInfo = getStatusInfo(value);
                                    return (
                                      <TableCell key={col.id}>
                                        <Badge className={statusInfo.color}>
                                          {statusInfo.label}
                                        </Badge>
                                      </TableCell>
                                    );
                                  }
                                  
                                  if (col.id === "assessment_report") {
                                    const hasAssessment = row.has_assessment;
                                    return (
                                      <TableCell key={col.id}>
                                        {hasAssessment ? (
                                          <a
                                            href={`/partner/recruiting/assessment/${row.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-primary hover:underline"
                                          >
                                            View
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                    );
                                  }
                                  
                                  if (col.id === "hiring_decision" && value) {
                                    const info = getHiringDecisionInfo(value);
                                    return (
                                      <TableCell key={col.id}>
                                        <Badge className={info.color}>
                                          {info.label}
                                        </Badge>
                                      </TableCell>
                                    );
                                  }
                                  
                                  return (
                                    <TableCell key={col.id} className="whitespace-nowrap">
                                      {col.format ? col.format(value) : (value ?? "—")}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </DndContext>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
