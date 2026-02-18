import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getHiringDecisionInfo } from "@/lib/hiringDecisionUtils";

export interface AttemptFiltersState {
  candidate: string;
  email: string;
  status: string;
  decision: string;
}

interface AttemptFiltersProps {
  filters: AttemptFiltersState;
  onFiltersChange: (filters: AttemptFiltersState) => void;
  statusOptions: string[];
  decisionOptions: string[];
}

export const AttemptFilters = ({
  filters,
  onFiltersChange,
  statusOptions,
  decisionOptions,
}: AttemptFiltersProps) => {
  const hasActiveFilters = Object.values(filters).some((v) => v !== "" && v !== "all");

  const clearFilters = () => {
    onFiltersChange({
      candidate: "",
      email: "",
      status: "all",
      decision: "all",
    });
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Filter attempts</p>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 px-2 text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Clear filters
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search candidate..."
            value={filters.candidate}
            onChange={(e) =>
              onFiltersChange({ ...filters, candidate: e.target.value })
            }
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search email..."
            value={filters.email}
            onChange={(e) =>
              onFiltersChange({ ...filters, email: e.target.value })
            }
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.decision}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, decision: value })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Decision" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            {decisionOptions.map((decision) => (
              <SelectItem key={decision} value={decision}>
                {getHiringDecisionInfo(decision).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export const defaultFilters: AttemptFiltersState = {
  candidate: "",
  email: "",
  status: "all",
  decision: "all",
};

export const filterAttempts = (
  attempts: any[],
  filters: AttemptFiltersState
): any[] => {
  return attempts.filter((attempt) => {
    const candidateMatch =
      !filters.candidate ||
      attempt.candidate_name
        ?.toLowerCase()
        .includes(filters.candidate.toLowerCase());

    const emailMatch =
      !filters.email ||
      attempt.candidate_email
        ?.toLowerCase()
        .includes(filters.email.toLowerCase());

    const statusMatch =
      filters.status === "all" || filters.status === "" || attempt.status === filters.status;

    // Use CPI hiring_recommendation as source of truth, fallback to assessments
    const cpi = Array.isArray(attempt.candidate_performance_index) ? attempt.candidate_performance_index[0] : attempt.candidate_performance_index;
    const attemptDecision = cpi?.hiring_recommendation || attempt.assessments?.hiring_decision;
    const decisionMatch =
      filters.decision === "all" ||
      filters.decision === "" ||
      attemptDecision === filters.decision;

    return candidateMatch && emailMatch && statusMatch && decisionMatch;
  });
};
