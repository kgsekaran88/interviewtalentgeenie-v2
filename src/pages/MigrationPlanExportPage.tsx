import { MigrationPlanExport } from '@/components/docs/MigrationPlanExport';

export default function MigrationPlanExportPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Project Documentation</h1>
          <p className="text-muted-foreground mt-2">
            Download migration planning documents
          </p>
        </div>
        <MigrationPlanExport />
      </div>
    </div>
  );
}
