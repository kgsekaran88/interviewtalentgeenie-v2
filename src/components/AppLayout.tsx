import { ReactNode } from "react";
import { AppNavbar } from "@/components/AppNavbar";
import { RoleBreadcrumbs } from "@/components/RoleBreadcrumbs";
import { Chatbot } from "@/components/Chatbot";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <AppNavbar />
      <main className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <RoleBreadcrumbs />
        {children}
      </main>
      <Chatbot />
    </div>
  );
};
