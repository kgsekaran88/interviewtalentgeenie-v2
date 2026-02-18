import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationAlertProps {
  type?: "error" | "warning" | "info" | "success";
  message: string;
  className?: string;
}

export const ValidationAlert = ({ 
  type = "error", 
  message,
  className 
}: ValidationAlertProps) => {
  const styles = {
    error: {
      container: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50",
      icon: "text-orange-600 dark:text-orange-400",
      text: "text-orange-800 dark:text-orange-300",
    },
    warning: {
      container: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50",
      icon: "text-amber-600 dark:text-amber-400",
      text: "text-amber-800 dark:text-amber-300",
    },
    info: {
      container: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50",
      icon: "text-blue-600 dark:text-blue-400",
      text: "text-blue-800 dark:text-blue-300",
    },
    success: {
      container: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50",
      icon: "text-emerald-600 dark:text-emerald-400",
      text: "text-emerald-800 dark:text-emerald-300",
    },
  };

  const currentStyle = styles[type];

  const Icon = type === "error" 
    ? AlertCircle 
    : type === "success" 
    ? CheckCircle2 
    : Info;

  return (
    <Alert className={cn(currentStyle.container, className)}>
      <Icon className={cn("h-4 w-4", currentStyle.icon)} />
      <AlertDescription className={cn("text-sm", currentStyle.text)}>
        {message}
      </AlertDescription>
    </Alert>
  );
};
