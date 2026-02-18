import { useOrganization } from '@/contexts/OrganizationContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const OrganizationSelector = () => {
  const { selectedOrgId, availableOrgs, setSelectedOrgId, loading } = useOrganization();

  if (loading || availableOrgs.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 border-primary/10 bg-gradient-to-br from-card to-primary/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Organization</p>
            <p className="text-sm font-semibold text-foreground">Select Partner to Manage</p>
          </div>
        </div>
        <Select value={selectedOrgId || 'all'} onValueChange={(value) => setSelectedOrgId(value === 'all' ? null : value)}>
          <SelectTrigger className="w-[280px] h-10 border-primary/20 hover:border-primary/30 focus:ring-primary/20">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>All Organizations</span>
              </div>
            </SelectItem>
            {availableOrgs.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>{org.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
};
