import { Button } from "@/components/ui/button";
import { Flag, Download, XCircle } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onFlagAll: () => void;
  onExportPDF: () => void;
  onClearFlags: () => void;
  onClearSelection: () => void;
}

export default function BulkActionsBar({
  selectedCount,
  onFlagAll,
  onExportPDF,
  onClearFlags,
  onClearSelection
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-4 z-50">
      <span className="font-semibold">{selectedCount} selected</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onFlagAll}>
          <Flag className="w-4 h-4 mr-2" />
          Flag All
        </Button>
        <Button size="sm" variant="secondary" onClick={onExportPDF}>
          <Download className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={onClearFlags}>
          <XCircle className="w-4 h-4 mr-2" />
          Clear Flags
        </Button>
        <Button size="sm" variant="outline" onClick={onClearSelection}>
          Cancel
        </Button>
      </div>
    </div>
  );
}