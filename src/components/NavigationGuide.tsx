import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Settings, ArrowRight, Menu } from "lucide-react";

export const NavigationGuide = () => {
  const navigate = useNavigate();

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Settings className="h-5 w-5 text-primary" />
      <AlertTitle className="text-lg font-semibold mb-3">Finding Test Management & Admin Features</AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm">
            <strong>Step 1:</strong> Look for the <Menu className="w-4 h-4 inline mx-1" /> menu icon on the left side of your screen
          </p>
          <p className="text-sm">
            <strong>Step 2:</strong> In the sidebar, find the <strong>"Admin"</strong> section (collapsible)
          </p>
          <p className="text-sm">
            <strong>Step 3:</strong> Inside Admin, you'll find:
          </p>
          <ul className="list-disc list-inside text-sm ml-4 space-y-1">
            <li><strong>Test Management</strong> - Run automated tests</li>
            <li><strong>Testing Hub</strong> - Comprehensive testing dashboard</li>
            <li><strong>Automated Tests</strong> - Test suite management</li>
            <li><strong>Performance Benchmark</strong> - Performance monitoring</li>
            <li>And many other admin tools...</li>
          </ul>
        </div>
        <div className="flex gap-2 mt-4">
          <Button 
            onClick={() => navigate('/admin/testing-hub')}
            className="gap-2"
            size="sm"
          >
            Go to Test Management
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => navigate('/testing-hub')}
            variant="outline"
            size="sm"
          >
            Go to Testing Hub
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};