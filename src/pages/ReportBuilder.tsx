import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileText, Download, Calendar } from "lucide-react";


export default function ReportBuilder() {
  const [reportType, setReportType] = useState("performance");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const availableMetrics = [
    { value: "avg_score", label: "Average Score" },
    { value: "hire_rate", label: "Hire Rate" },
    { value: "avg_cpi", label: "Average CPI" },
    { value: "technical_avg", label: "Technical Score Average" },
    { value: "problem_solving_avg", label: "Problem Solving Average" },
    { value: "time_to_hire", label: "Time to Hire" },
    { value: "candidate_count", label: "Total Candidates" },
  ];

  // Fetch report templates
  const { data: templates } = useQuery({
    queryKey: ["report-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch generated reports
  const { data: generatedReports } = useQuery({
    queryKey: ["generated-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Create report template
  const createTemplate = useMutation({
    mutationFn: async (template: any) => {
      const { data, error } = await supabase
        .from("report_templates")
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Report template created!");
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
    },
  });

  // Generate report
  const generateReport = useMutation({
    mutationFn: async (params: {
      template_id: string;
      organization_id: string;
      period_start: string;
      period_end: string;
    }) => {
      const { data, error } = await invokeFunction("generate-custom-report", {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Report generated successfully!");
      queryClient.invalidateQueries({ queryKey: ["generated-reports"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate report: ${error.message}`);
    },
  });

  const handleCreateTemplate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    createTemplate.mutate({
      name: formData.get("name"),
      description: formData.get("description"),
      report_type: reportType,
      metrics: selectedMetrics,
      filters: {},
      visualization_config: {
        charts: [
          { type: "trend", enabled: true },
          { type: "distribution", enabled: true },
        ],
      },
    });
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Custom Report Builder</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Create and generate custom analytics reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Create Template Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Report Template</CardTitle>
            <CardDescription>Define metrics and visualizations for your report</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <Label>Report Name</Label>
                <Input name="name" placeholder="Monthly Performance Report" required />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea name="description" placeholder="Describe this report..." rows={3} />
              </div>

              <div>
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="hiring-funnel">Hiring Funnel</SelectItem>
                    <SelectItem value="diversity">Diversity</SelectItem>
                    <SelectItem value="roi">ROI Analysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Metrics to Include</Label>
                <div className="space-y-2 mt-2">
                  {availableMetrics.map((metric) => (
                    <div key={metric.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={metric.value}
                        checked={selectedMetrics.includes(metric.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedMetrics([...selectedMetrics, metric.value]);
                          } else {
                            setSelectedMetrics(selectedMetrics.filter((m) => m !== metric.value));
                          }
                        }}
                      />
                      <label htmlFor={metric.value} className="text-sm cursor-pointer">
                        {metric.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full min-h-[44px]" disabled={createTemplate.isPending}>
                {createTemplate.isPending ? "Creating..." : "Create Template"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Saved Templates */}
        <Card>
          <CardHeader>
            <CardTitle>Saved Templates</CardTitle>
            <CardDescription>Your custom report templates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {templates?.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm sm:text-base truncate">{template.name}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {template.metrics.length} metrics
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="min-h-[44px] self-start sm:self-auto shrink-0"
                    onClick={() => {
                      // Generate report from this template
                      const orgId = "org-1"; // Would come from user context
                      const now = new Date();
                      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

                      generateReport.mutate({
                        template_id: template.id,
                        organization_id: orgId,
                        period_start: monthAgo.toISOString(),
                        period_end: now.toISOString(),
                      });
                    }}
                    disabled={generateReport.isPending}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate
                  </Button>
                </div>
              ))}

              {(!templates || templates.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No templates created yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generated Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {generatedReports?.map((report) => (
              <div
                key={report.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                    <h4 className="font-medium text-sm sm:text-base truncate">Report #{report.id.slice(0, 8)}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(report.period_start).toLocaleDateString()} -{" "}
                      {new Date(report.period_end).toLocaleDateString()}
                    </span>
                    <span>Status: {report.status}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="min-h-[44px] self-start sm:self-auto shrink-0">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            ))}

            {(!generatedReports || generatedReports.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                No reports generated yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
  );
}