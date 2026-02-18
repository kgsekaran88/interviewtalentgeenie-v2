import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AppNavbar } from '@/components/AppNavbar';
import { RoleBreadcrumbs } from '@/components/RoleBreadcrumbs';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';

interface PartnerLayoutProps {
  children?: ReactNode;
}

export const PartnerLayout = ({ children }: PartnerLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <AppNavbar />
      <ImpersonationBanner />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RoleBreadcrumbs />
        {children || <Outlet />}
      </main>
    </div>
  );
};
