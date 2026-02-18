import { useOrganization } from '@/contexts/OrganizationContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, LogOut } from 'lucide-react';

export const ImpersonationBanner = () => {
  const { isImpersonating, selectedOrg, exitImpersonationMode } = useOrganization();
  const navigate = useNavigate();

  if (!isImpersonating || !selectedOrg) return null;

  const handleExit = () => {
    exitImpersonationMode();
    navigate('/admin');
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              Viewing as <span className="font-semibold text-primary">{selectedOrg.name}</span>
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExit}
            className="h-8 gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit to Platform Admin
          </Button>
        </div>
      </div>
    </div>
  );
};
