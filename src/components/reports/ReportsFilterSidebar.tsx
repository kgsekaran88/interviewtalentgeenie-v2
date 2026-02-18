import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar,
  Search,
  X,
  RefreshCw,
  Filter
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  interviewId: string;
  hiringDecision: string;
  status: string;
  sentBy: string;
}

interface ReportsFilterSidebarProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  interviews: { id: string; title: string }[];
  senders: string[];
  loading: boolean;
  onGenerateReport: () => void;
}

const PRESET_DATE_RANGES = [
  { label: "Last 7 Days", getValue: () => ({ from: format(subDays(new Date(), 7), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last 30 Days", getValue: () => ({ from: format(subDays(new Date(), 30), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
  { label: "This Month", getValue: () => ({ from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: format(endOfMonth(new Date()), "yyyy-MM-dd") }) },
  { label: "Last Month", getValue: () => ({ from: format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), to: format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") }) },
  { label: "Last 3 Months", getValue: () => ({ from: format(subMonths(new Date(), 3), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") }) },
];

export function ReportsFilterSidebar({
  filters,
  onFiltersChange,
  interviews,
  senders,
  loading,
  onGenerateReport,
}: ReportsFilterSidebarProps) {
  const applyPresetDateRange = (preset: typeof PRESET_DATE_RANGES[0]) => {
    const { from, to } = preset.getValue();
    onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
  };

  const clearFilters = () => {
    onFiltersChange({
      dateFrom: format(subDays(new Date(), 7), "yyyy-MM-dd"),
      dateTo: format(new Date(), "yyyy-MM-dd"),
      interviewId: "all",
      hiringDecision: "all",
      status: "all",
      sentBy: "all",
    });
  };

  const hasActiveFilters = filters.interviewId !== "all" || 
    filters.hiringDecision !== "all" || 
    filters.status !== "all" ||
    filters.sentBy !== "all";

  return (
    <div className="w-72 border-r bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Filters</h2>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-auto">Active</Badge>
          )}
        </div>
      </div>

      {/* Scrollable Filter Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Date Range */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Date Range
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_DATE_RANGES.map(preset => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => applyPresetDateRange(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  className="h-9"
                  value={filters.dateFrom}
                  onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dateTo" className="text-xs text-muted-foreground">To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  className="h-9"
                  value={filters.dateTo}
                  onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Interview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Interview</Label>
            <Select 
              value={filters.interviewId} 
              onValueChange={(v) => onFiltersChange({ ...filters, interviewId: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Interviews" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interviews</SelectItem>
                {interviews.map(interview => (
                  <SelectItem key={interview.id} value={interview.id}>
                    {interview.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Select 
              value={filters.status} 
              onValueChange={(v) => onFiltersChange({ ...filters, status: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="evaluated">Evaluated</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending_upload">Pending Upload</SelectItem>
                <SelectItem value="upload_failed">Upload Failed</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hiring Decision */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hiring Decision</Label>
            <Select 
              value={filters.hiringDecision} 
              onValueChange={(v) => onFiltersChange({ ...filters, hiringDecision: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Decisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decisions</SelectItem>
                <SelectItem value="strongly_recommend">Strong Hire</SelectItem>
                <SelectItem value="recommend">Hire</SelectItem>
                <SelectItem value="consider">Consider</SelectItem>
                <SelectItem value="not_recommended">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sent By */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sent By</Label>
            <Select 
              value={filters.sentBy} 
              onValueChange={(v) => onFiltersChange({ ...filters, sentBy: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Senders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Senders</SelectItem>
                {senders.map(sender => (
                  <SelectItem key={sender} value={sender}>{sender}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 border-t space-y-2">
        <Button onClick={onGenerateReport} disabled={loading} className="w-full">
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Generate Report
        </Button>
        {hasActiveFilters && (
          <Button variant="outline" onClick={clearFilters} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
