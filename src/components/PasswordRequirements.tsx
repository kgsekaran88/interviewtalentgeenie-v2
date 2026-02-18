import { Check, X, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordRequirementsProps {
  password: string;
}

const calculateStrength = (password: string): { level: number; label: string; color: string } => {
  if (!password) return { level: 0, label: "None", color: "bg-muted" };
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++; // Special chars bonus
  if (password.length >= 12) strength++; // Length bonus

  if (strength <= 2) return { level: 1, label: "Weak", color: "bg-red-500" };
  if (strength <= 4) return { level: 2, label: "Medium", color: "bg-amber-500" };
  return { level: 3, label: "Strong", color: "bg-emerald-500" };
};

export const PasswordRequirements = ({ password }: PasswordRequirementsProps) => {
  const requirements: PasswordRequirement[] = [
    {
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      label: "One uppercase letter (A-Z)",
      met: /[A-Z]/.test(password),
    },
    {
      label: "One lowercase letter (a-z)",
      met: /[a-z]/.test(password),
    },
    {
      label: "One number (0-9)",
      met: /[0-9]/.test(password),
    },
  ];

  const strength = calculateStrength(password);
  const allMet = requirements.every(req => req.met);

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      {/* Strength Meter */}
      {password && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Password Strength:
              </span>
            </div>
            <span className={cn(
              "text-xs font-semibold",
              strength.level === 1 && "text-red-600 dark:text-red-400",
              strength.level === 2 && "text-amber-600 dark:text-amber-400",
              strength.level === 3 && "text-emerald-600 dark:text-emerald-400"
            )}>
              {strength.label}
            </span>
          </div>
          <div className="flex gap-1 h-1.5">
            {[1, 2, 3].map((level) => (
              <div
                key={level}
                className={cn(
                  "flex-1 rounded-full transition-all duration-300",
                  level <= strength.level ? strength.color : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      <div className="space-y-1.5 pt-2 border-t border-border/30">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Requirements:
        </p>
        {requirements.map((req, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              req.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}
          >
            {req.met ? (
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
