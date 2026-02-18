import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InvitationFiltersState {
  candidate: string;
  email: string;
  status: string;
  sentBy: string;
  emailed: string;
}

interface InvitationFiltersProps {
  filters: InvitationFiltersState;
  onFiltersChange: (filters: InvitationFiltersState) => void;
  statusOptions: string[];
  sentByOptions: string[];
}

export const InvitationFilters = ({
  filters,
  onFiltersChange,
  statusOptions,
  sentByOptions,
}: InvitationFiltersProps) => {
  const hasActiveFilters = Object.values(filters).some((v) => v !== "" && v !== "all");

  const clearFilters = () => {
    onFiltersChange({
      candidate: "",
      email: "",
      status: "all",
      sentBy: "all",
      emailed: "all",
    });
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Filter invitations</p>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.sentBy}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, sentBy: value })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Sent By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Senders</SelectItem>
            {sentByOptions.map((sender) => (
              <SelectItem key={sender} value={sender}>
                {sender}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.emailed}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, emailed: value })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Emailed" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="not_sent">Not Sent</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export const defaultInvitationFilters: InvitationFiltersState = {
  candidate: "",
  email: "",
  status: "all",
  sentBy: "all",
  emailed: "all",
};

interface InvitationForFilter {
  candidate_name: string;
  candidate_email: string;
  first_name?: string;
  last_name?: string;
  status: string;
  email_sent: boolean;
  sender_profile?: {
    id?: string;
    full_name?: string;
    email?: string;
  } | null;
}

export const filterInvitations = <T extends InvitationForFilter>(
  invitations: T[],
  filters: InvitationFiltersState
): T[] => {
  return invitations.filter((invitation) => {
    const displayName = invitation.first_name && invitation.last_name
      ? `${invitation.first_name} ${invitation.last_name}`
      : invitation.candidate_name;

    const candidateMatch =
      !filters.candidate ||
      displayName.toLowerCase().includes(filters.candidate.toLowerCase()) ||
      (invitation.first_name && invitation.first_name.toLowerCase().includes(filters.candidate.toLowerCase())) ||
      (invitation.last_name && invitation.last_name.toLowerCase().includes(filters.candidate.toLowerCase()));

    const emailMatch =
      !filters.email ||
      invitation.candidate_email
        ?.toLowerCase()
        .includes(filters.email.toLowerCase());

    // Map status filter to actual status values
    const statusMatch = (() => {
      if (filters.status === "all" || filters.status === "") return true;
      if (filters.status === "pending") return invitation.status === "pending" && !invitation.email_sent;
      if (filters.status === "invited") return invitation.status === "pending" && invitation.email_sent;
      return invitation.status === filters.status;
    })();

    const senderName = invitation.sender_profile?.full_name || 
      invitation.sender_profile?.email?.split('@')[0] || '';
    const sentByMatch =
      filters.sentBy === "all" ||
      filters.sentBy === "" ||
      senderName === filters.sentBy;

    const emailedMatch = (() => {
      if (filters.emailed === "all" || filters.emailed === "") return true;
      if (filters.emailed === "sent") return invitation.email_sent === true;
      if (filters.emailed === "not_sent") return invitation.email_sent === false;
      return true;
    })();

    return candidateMatch && emailMatch && statusMatch && sentByMatch && emailedMatch;
  });
};
