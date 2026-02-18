import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { exportMigrationPlanToPDF } from '@/lib/migrationPlanPdfExport';
import { toast } from 'sonner';

export function MigrationPlanExport() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMigrationPlanToPDF();
      if (result.success) {
        toast.success(`PDF exported: ${result.fileName}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">AWS Migration Plan</h2>
            <p className="text-sm text-muted-foreground">
              Detailed project plan for TalentGeenie platform migration
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 border-t border-b">
          <div>
            <p className="text-sm text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-bold">2,012</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Story Points</p>
            <p className="text-2xl font-bold">503 SP</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Timeline</p>
            <p className="text-lg font-medium">17-23 weeks</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Team Size</p>
            <p className="text-lg font-medium">8-10 developers</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-medium">Document includes:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>122 database tables migration plan</li>
            <li>101 edge functions migration to Lambda/ECS</li>
            <li>89 frontend pages migration details</li>
            <li>7 migration phases with task-level estimates</li>
            <li>Risk assessment and mitigation strategies</li>
            <li>AWS cost estimates ($500-1,050/month)</li>
          </ul>
        </div>

        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="w-full"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
