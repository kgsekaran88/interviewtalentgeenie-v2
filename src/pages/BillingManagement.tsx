import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Receipt, Download, CreditCard, TrendingUp, FileText, BarChart3, Calendar, Users, CheckCircle, Send, Eye, Settings2 } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface Invoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  status: string;
  line_items: any;
  usage_details: any;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  organizations?: { name: string };
  organization_subscriptions?: { subscription_plans?: { name: string } };
}

interface UsageData {
  organization_id: string;
  organization_name: string;
  interviews_created: number;
  invitations_sent: number;
  interviews_completed: number;
  interviews: {
    id: string;
    title: string;
    created_at: string;
    invitations: {
      id: string;
      candidate_name: string | null;
      candidate_email: string;
      status: string;
      created_at: string;
      email_sent_at: string | null;
      completed_at: string | null;
    }[];
  }[];
}

interface InvoicePreview {
  organization_name: string;
  plan_name: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  tax_cents: number;
  total_cents: number;
  line_items: { description: string; quantity: number; unit_price_cents: number; total_cents: number; type: string }[];
  usage_details: { interviews_created: number; invitations_sent: number; interviews_completed: number; ai_tokens_used: number };
}

// Available columns for report
const AVAILABLE_COLUMNS = [
  { id: "organization", label: "Organization", default: true },
  { id: "interview_title", label: "Interview Title", default: true },
  { id: "interview_created", label: "Interview Created Date", default: true },
  { id: "candidate_name", label: "Candidate Name", default: true },
  { id: "candidate_email", label: "Candidate Email", default: false },
  { id: "invitation_status", label: "Invitation Status", default: true },
  { id: "invitation_sent", label: "Invitation Sent Date", default: false },
  { id: "completed_at", label: "Completion Date/Time", default: true },
  { id: "interview_id", label: "Interview ID", default: false },
  { id: "invitation_id", label: "Invitation ID", default: false },
];

export default function BillingManagement() {
  const { user } = useAuth();
  const { isPlatformAdmin } = useUserRoles();
  const { errorToast, successToast } = useUserFriendlyToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [mainTab, setMainTab] = useState("invoices");
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedUsageOrg, setSelectedUsageOrg] = useState<string>("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Column selection state
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    AVAILABLE_COLUMNS.filter(c => c.default).map(c => c.id)
  );
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  
  // Custom pricing state
  const [customPricePerInterview, setCustomPricePerInterview] = useState<string>("");
  const [customPricePerInvitation, setCustomPricePerInvitation] = useState<string>("");
  const [customPricePerCompleted, setCustomPricePerCompleted] = useState<string>("5.00");

  useEffect(() => {
    if (!loading && !isPlatformAdmin) {
      errorToast("Access denied: Platform admin only");
      window.location.href = "/";
    }
  }, [isPlatformAdmin, loading]);

  useEffect(() => {
    if (user) {
      fetchOrganizations();
      fetchInvoices();
    }
  }, [user, isPlatformAdmin]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase.from("organizations").select("*");
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error: any) {
      errorToast(error, "Failed to fetch organizations");
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let query = supabase.from("invoices").select(`*, organizations(name), organization_subscriptions(subscription_plans(name))`).order("created_at", { ascending: false });
      if (selectedOrg) query = query.eq("organization_id", selectedOrg);
      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      errorToast(error, "Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageData = async () => {
    try {
      setUsageLoading(true);
      let orgsQuery = supabase.from("organizations").select("id, name");
      if (selectedUsageOrg !== "all") orgsQuery = orgsQuery.eq("id", selectedUsageOrg);
      const { data: orgsData, error: orgsError } = await orgsQuery;
      if (orgsError) throw orgsError;

      const usageResults: UsageData[] = [];
      for (const org of orgsData || []) {
        const { data: interviews } = await supabase.from("interviews").select("id, title, created_at").eq("organization_id", org.id).gte("created_at", dateFrom).lte("created_at", dateTo + "T23:59:59").order("created_at", { ascending: false });
        const interviewIds = (interviews || []).map(i => i.id);
        let invitations: any[] = [];
        if (interviewIds.length > 0) {
          const { data: invData } = await supabase.from("interview_invitations").select("id, interview_id, candidate_name, candidate_email, status, created_at, email_sent_at, completed_at").in("interview_id", interviewIds).order("created_at", { ascending: false });
          invitations = invData || [];
        }
        usageResults.push({
          organization_id: org.id,
          organization_name: org.name,
          interviews_created: interviews?.length || 0,
          invitations_sent: invitations.length,
          interviews_completed: invitations.filter(inv => inv.status === "completed").length,
          interviews: (interviews || []).map(interview => ({ ...interview, invitations: invitations.filter(inv => inv.interview_id === interview.id) }))
        });
      }
      setUsageData(usageResults);
    } catch (error: any) {
      errorToast(error, "Failed to fetch usage data");
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    if (mainTab === "usage" && user) fetchUsageData();
  }, [mainTab, dateFrom, dateTo, selectedUsageOrg, user]);

  // Auto-load organization's default pricing when selected
  useEffect(() => {
    if (selectedUsageOrg && selectedUsageOrg !== "all") {
      const org = organizations.find(o => o.id === selectedUsageOrg) as any;
      if (org) {
        if (org.price_per_interview_cents !== undefined) {
          setCustomPricePerInterview((org.price_per_interview_cents / 100).toFixed(2));
        }
        if (org.price_per_invitation_cents !== undefined) {
          setCustomPricePerInvitation((org.price_per_invitation_cents / 100).toFixed(2));
        }
        if (org.price_per_completed_cents !== undefined) {
          setCustomPricePerCompleted((org.price_per_completed_cents / 100).toFixed(2));
        }
      }
    }
  }, [selectedUsageOrg, organizations]);

  const previewInvoice = async (organizationId: string) => {
    try {
      setPreviewLoading(true);
      const { data, error } = await invokeFunction("generate-invoice", {
        body: { 
          organizationId, 
          periodStart: dateFrom, 
          periodEnd: dateTo, 
          preview: true,
          customPricing: {
            perInterviewCents: customPricePerInterview ? Math.round(parseFloat(customPricePerInterview) * 100) : undefined,
            perInvitationCents: customPricePerInvitation ? Math.round(parseFloat(customPricePerInvitation) * 100) : undefined,
            perCompletedCents: customPricePerCompleted ? Math.round(parseFloat(customPricePerCompleted) * 100) : undefined,
          }
        },
      });
      if (error) throw error;
      setInvoicePreview(data.invoice);
      setPreviewOpen(true);
    } catch (error: any) {
      errorToast(error, "Failed to preview invoice");
    } finally {
      setPreviewLoading(false);
    }
  };

  const generateInvoice = async (organizationId: string) => {
    try {
      setGenerating(true);
      const { error } = await invokeFunction("generate-invoice", { 
        body: { 
          organizationId, 
          periodStart: dateFrom, 
          periodEnd: dateTo,
          customPricing: {
            perInterviewCents: customPricePerInterview ? Math.round(parseFloat(customPricePerInterview) * 100) : undefined,
            perInvitationCents: customPricePerInvitation ? Math.round(parseFloat(customPricePerInvitation) * 100) : undefined,
            perCompletedCents: customPricePerCompleted ? Math.round(parseFloat(customPricePerCompleted) * 100) : undefined,
          }
        } 
      });
      if (error) throw error;
      successToast("Invoice generated successfully");
      setPreviewOpen(false);
      fetchInvoices();
    } catch (error: any) {
      errorToast(error, "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  };

  const markAsPaid = async (invoiceId: string) => {
    try {
      const { error } = await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoiceId);
      if (error) throw error;
      successToast("Invoice marked as paid");
      fetchInvoices();
    } catch (error: any) {
      errorToast(error, "Failed to update invoice");
    }
  };

  const formatCurrency = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { draft: "bg-gray-500", pending: "bg-yellow-500", paid: "bg-green-500", overdue: "bg-red-500", completed: "bg-green-500", sent: "bg-blue-500", expired: "bg-orange-500" };
    return <Badge className={colors[status] || "bg-gray-500"}>{status.toUpperCase()}</Badge>;
  };

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  const openColumnSelector = (format: "csv" | "pdf") => {
    setExportFormat(format);
    setColumnSelectorOpen(true);
  };

  const getColumnValue = (columnId: string, org: UsageData, interview: any, inv?: any): string => {
    switch (columnId) {
      case "organization": return org.organization_name;
      case "interview_title": return interview.title;
      case "interview_created": return format(new Date(interview.created_at), "yyyy-MM-dd HH:mm");
      case "interview_id": return interview.id;
      case "candidate_name": return inv?.candidate_name || "-";
      case "candidate_email": return inv?.candidate_email || "-";
      case "invitation_status": return inv?.status || "-";
      case "invitation_sent": return inv?.email_sent_at ? format(new Date(inv.email_sent_at), "yyyy-MM-dd HH:mm") : "-";
      case "completed_at": return inv?.completed_at ? format(new Date(inv.completed_at), "yyyy-MM-dd HH:mm") : "-";
      case "invitation_id": return inv?.id || "-";
      default: return "-";
    }
  };

  const exportWithSelectedColumns = () => {
    const headers = AVAILABLE_COLUMNS.filter(c => selectedColumns.includes(c.id)).map(c => c.label);
    const rows: string[][] = [];

    usageData.forEach(org => org.interviews.forEach(interview => {
      if (interview.invitations.length === 0) {
        rows.push(selectedColumns.map(colId => getColumnValue(colId, org, interview)));
      } else {
        interview.invitations.forEach(inv => {
          rows.push(selectedColumns.map(colId => getColumnValue(colId, org, interview, inv)));
        });
      }
    }));

    if (exportFormat === "csv") {
      const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `partner-usage-report-${dateFrom}-to-${dateTo}.csv`;
      a.click();
    } else {
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(16);
      doc.text("Partner Usage Report", 20, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`Period: ${dateFrom} to ${dateTo}`, 20, y);
      y += 10;
      doc.text(`Columns: ${headers.join(", ")}`, 20, y);
      y += 10;

      // Print headers
      doc.setFontSize(8);
      const colWidth = (doc.internal.pageSize.width - 40) / Math.min(headers.length, 6);
      headers.slice(0, 6).forEach((h, i) => {
        doc.text(h.substring(0, 15), 20 + (i * colWidth), y);
      });
      y += 6;

      // Print rows
      rows.forEach(row => {
        if (y > 280) { doc.addPage(); y = 20; }
        row.slice(0, 6).forEach((cell, i) => {
          doc.text(cell.substring(0, 18), 20 + (i * colWidth), y);
        });
        y += 4;
      });

      doc.save(`partner-usage-report-${dateFrom}-to-${dateTo}.pdf`);
    }

    setColumnSelectorOpen(false);
    successToast(`${exportFormat.toUpperCase()} exported with ${selectedColumns.length} columns`);
  };

  const totalStats = { 
    interviews: usageData.reduce((s, o) => s + o.interviews_created, 0), 
    invitations: usageData.reduce((s, o) => s + o.invitations_sent, 0), 
    completed: usageData.reduce((s, o) => s + o.interviews_completed, 0) 
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-fade-in p-3 sm:p-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text flex items-center gap-2 sm:gap-3 mb-2">
          <Receipt className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
          <span className="truncate">Platform Billing</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">Manage subscriptions, invoices, and usage</p>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="invoices" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm min-h-[44px]"><FileText className="w-4 h-4" /><span className="hidden xs:inline">Invoices</span></TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm min-h-[44px]"><BarChart3 className="w-4 h-4" /><span className="hidden xs:inline">Usage</span></TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <select className="px-3 py-2 border rounded-md bg-background text-sm min-h-[44px] w-full sm:w-auto" value={selectedOrg || ""} onChange={(e) => { setSelectedOrg(e.target.value || null); fetchInvoices(); }}>
              <option value="">All Organizations</option>
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            {selectedOrg && <Button onClick={() => generateInvoice(selectedOrg)} disabled={generating} className="min-h-[44px]"><Receipt className="w-4 h-4 mr-2" />Generate Invoice</Button>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6"><CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle><TrendingUp className="w-4 h-4 text-green-500" /></CardHeader><CardContent className="p-3 sm:p-6 pt-0"><div className="text-lg sm:text-2xl font-bold">{formatCurrency(invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total_cents, 0))}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6"><CardTitle className="text-xs sm:text-sm font-medium">Outstanding</CardTitle><CreditCard className="w-4 h-4 text-yellow-500" /></CardHeader><CardContent className="p-3 sm:p-6 pt-0"><div className="text-lg sm:text-2xl font-bold">{formatCurrency(invoices.filter(i => ["pending", "overdue"].includes(i.status)).reduce((s, i) => s + i.total_cents, 0))}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6"><CardTitle className="text-xs sm:text-sm font-medium">Invoices</CardTitle><FileText className="w-4 h-4 text-blue-500" /></CardHeader><CardContent className="p-3 sm:p-6 pt-0"><div className="text-lg sm:text-2xl font-bold">{invoices.length}</div></CardContent></Card>
          </div>

          <Card><CardHeader><CardTitle>Invoices</CardTitle></CardHeader><CardContent>
            <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Organization</TableHead><TableHead>Period</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{invoices.map((inv) => <TableRow key={inv.id}><TableCell>{inv.invoice_number}</TableCell><TableCell>{inv.organizations?.name}</TableCell><TableCell>{format(new Date(inv.period_start), "MMM d")} - {format(new Date(inv.period_end), "MMM d, yyyy")}</TableCell><TableCell>{formatCurrency(inv.total_cents)}</TableCell><TableCell>{getStatusBadge(inv.status)}</TableCell><TableCell><div className="flex gap-2">{inv.status === "pending" && <Button size="sm" variant="outline" onClick={() => markAsPaid(inv.id)}>Mark Paid</Button>}<Button size="sm" variant="ghost"><Download className="w-4 h-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />Report Filters</CardTitle></CardHeader><CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2"><Label>From Date</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" /></div>
              <div className="space-y-2"><Label>To Date</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" /></div>
              <div className="space-y-2"><Label>Organization</Label><select className="px-4 py-2 border rounded-md h-10 bg-background" value={selectedUsageOrg} onChange={(e) => setSelectedUsageOrg(e.target.value)}><option value="all">All Partners</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></div>
              <Button variant="outline" onClick={() => openColumnSelector("csv")} disabled={usageLoading || usageData.length === 0}><Settings2 className="w-4 h-4 mr-2" />Export CSV</Button>
              <Button variant="outline" onClick={() => openColumnSelector("pdf")} disabled={usageLoading || usageData.length === 0}><Settings2 className="w-4 h-4 mr-2" />Export PDF</Button>
              {selectedUsageOrg !== "all" && <Button onClick={() => previewInvoice(selectedUsageOrg)} disabled={previewLoading}><Eye className="w-4 h-4 mr-2" />Preview Invoice</Button>}
            </div>
          </CardContent></Card>

          {/* Custom Pricing Section */}
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Usage-Based Pricing (Per Invoice)</CardTitle><CardDescription>Set custom rates for usage-based partners. Leave empty to use default plan pricing.</CardDescription></CardHeader><CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Price per Interview Created ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={customPricePerInterview} onChange={(e) => setCustomPricePerInterview(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Price per Invitation Sent ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={customPricePerInvitation} onChange={(e) => setCustomPricePerInvitation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Price per Completed Interview ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="5.00" value={customPricePerCompleted} onChange={(e) => setCustomPricePerCompleted(e.target.value)} />
              </div>
            </div>
          </CardContent></Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Interviews Created</CardTitle><FileText className="w-4 h-4 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalStats.interviews}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Invitations Sent</CardTitle><Send className="w-4 h-4 text-purple-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalStats.invitations}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle><CheckCircle className="w-4 h-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalStats.completed}</div></CardContent></Card>
          </div>

          {usageLoading ? <Card><CardContent className="py-8 text-center">Loading...</CardContent></Card> : usageData.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No usage data found</CardContent></Card> : usageData.map((org) => (
            <Card key={org.organization_id}><CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />{org.organization_name}</CardTitle>
                  <CardDescription>{org.interviews_created} interviews • {org.invitations_sent} invitations • {org.interviews_completed} completed</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => previewInvoice(org.organization_id)} 
                    disabled={previewLoading}
                  >
                    <Eye className="w-4 h-4 mr-1" />Preview
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setSelectedUsageOrg(org.organization_id);
                      previewInvoice(org.organization_id);
                    }} 
                    disabled={generating || previewLoading}
                  >
                    <Receipt className="w-4 h-4 mr-1" />Generate Invoice
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>{org.interviews.length === 0 ? <p className="text-muted-foreground text-sm">No interviews</p> : org.interviews.map((interview) => (
              <div key={interview.id} className="border rounded-lg p-4 mb-4"><div className="flex justify-between items-start mb-3"><div><h4 className="font-medium">{interview.title}</h4><p className="text-sm text-muted-foreground">Created: {format(new Date(interview.created_at), "MMM d, yyyy HH:mm")}</p></div><Badge variant="outline">{interview.invitations.length} candidates</Badge></div>
              {interview.invitations.length > 0 && <Table><TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Completed</TableHead></TableRow></TableHeader><TableBody>{interview.invitations.map((inv) => <TableRow key={inv.id}><TableCell>{inv.candidate_name || "-"}</TableCell><TableCell className="font-mono text-sm">{inv.candidate_email}</TableCell><TableCell>{getStatusBadge(inv.status)}</TableCell><TableCell>{inv.completed_at ? format(new Date(inv.completed_at), "MMM d, HH:mm") : "-"}</TableCell></TableRow>)}</TableBody></Table>}
              </div>
            ))}</CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Column Selector Dialog */}
      <Dialog open={columnSelectorOpen} onOpenChange={setColumnSelectorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Columns for {exportFormat.toUpperCase()} Export</DialogTitle>
            <DialogDescription>Choose which columns to include in your report</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {AVAILABLE_COLUMNS.map((col) => (
              <div key={col.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={col.id} 
                  checked={selectedColumns.includes(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                />
                <label htmlFor={col.id} className="text-sm cursor-pointer">{col.label}</label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedColumns(AVAILABLE_COLUMNS.filter(c => c.default).map(c => c.id))}>Reset to Default</Button>
            <Button onClick={exportWithSelectedColumns} disabled={selectedColumns.length === 0}>
              <Download className="w-4 h-4 mr-2" />Export {exportFormat.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Invoice Preview</DialogTitle><DialogDescription>Review calculated charges before generating invoice</DialogDescription></DialogHeader>
          {invoicePreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Organization:</span> {invoicePreview.organization_name}</div>
                <div><span className="text-muted-foreground">Plan:</span> {invoicePreview.plan_name}</div>
                <div><span className="text-muted-foreground">Period:</span> {format(new Date(invoicePreview.period_start), "MMM d")} - {format(new Date(invoicePreview.period_end), "MMM d, yyyy")}</div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoicePreview.line_items.map((item, i) => <TableRow key={i}><TableCell>{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{formatCurrency(item.unit_price_cents)}</TableCell><TableCell className="text-right">{formatCurrency(item.total_cents)}</TableCell></TableRow>)}
                  <TableRow><TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell><TableCell className="text-right">{formatCurrency(invoicePreview.amount_cents)}</TableCell></TableRow>
                  <TableRow><TableCell colSpan={3} className="text-right font-medium">Tax (10%)</TableCell><TableCell className="text-right">{formatCurrency(invoicePreview.tax_cents)}</TableCell></TableRow>
                  <TableRow className="font-bold"><TableCell colSpan={3} className="text-right">Total</TableCell><TableCell className="text-right">{formatCurrency(invoicePreview.total_cents)}</TableCell></TableRow>
                </TableBody>
              </Table>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <h4 className="font-medium mb-2">Usage Summary</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>Interviews Created: {invoicePreview.usage_details.interviews_created}</div>
                  <div>Invitations Sent: {invoicePreview.usage_details.invitations_sent}</div>
                  <div>Completed: {invoicePreview.usage_details.interviews_completed}</div>
                  <div>AI Tokens: {invoicePreview.usage_details.ai_tokens_used.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedUsageOrg !== "all" && generateInvoice(selectedUsageOrg)} disabled={generating}>{generating ? "Generating..." : "Generate Invoice"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}