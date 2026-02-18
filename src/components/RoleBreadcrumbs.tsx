import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useRoleBreadcrumbs } from "@/hooks/useRoleBreadcrumbs";
import { Home } from "lucide-react";

export const RoleBreadcrumbs = () => {
  const { breadcrumbs, currentPath } = useRoleBreadcrumbs();

  // Don't show breadcrumbs on landing page or auth pages
  if (currentPath === "/" || currentPath.startsWith("/auth")) {
    return null;
  }

  // Don't show if only home breadcrumb
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="mb-6 animate-fade-in">
      <Breadcrumb>
        <BreadcrumbList className="flex-wrap gap-1.5 text-sm">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const Icon = crumb.icon;

            return (
              <div key={crumb.path} className="flex items-center gap-1.5">
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="flex items-center gap-2 font-semibold text-foreground px-2 py-1 rounded-md bg-muted/50">
                      {Icon && <Icon className="w-4 h-4 text-primary" />}
                      <span>{crumb.label}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        to={crumb.path}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 px-2 py-1 rounded-md hover:bg-muted/30 hover:scale-105"
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        <span>{crumb.label}</span>
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && (
                  <BreadcrumbSeparator className="[&>svg]:w-4 [&>svg]:h-4 text-muted-foreground/50" />
                )}
              </div>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
