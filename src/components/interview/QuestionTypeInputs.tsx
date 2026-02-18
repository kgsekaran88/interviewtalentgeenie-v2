import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { QuestionTypeDistribution } from '@/hooks/useInterviewConfiguration';

interface QuestionTypeInputsProps {
  typeDistribution: QuestionTypeDistribution;
  questionCount: number;
  typeTotal: number;
  showCoding?: boolean;
  onTypeChange: (type: keyof QuestionTypeDistribution, value: number, isLast: boolean) => void;
}

export function QuestionTypeInputs({
  typeDistribution,
  questionCount,
  typeTotal,
  showCoding = true,
  onTypeChange,
}: QuestionTypeInputsProps) {
  const typeKeys = showCoding
    ? (['mcq', 'scenario', 'coding', 'descriptive'] as const)
    : (['mcq', 'scenario', 'descriptive'] as const);

  const typeLabels: Record<string, string> = {
    mcq: 'MCQ',
    scenario: 'Scenario',
    coding: 'Coding',
    descriptive: 'Descriptive',
  };

  const typeColors: Record<string, string> = {
    mcq: 'border-blue-500/30 focus:border-blue-500',
    scenario: 'border-purple-500/30 focus:border-purple-500',
    coding: 'border-orange-500/30 focus:border-orange-500',
    descriptive: 'border-teal-500/30 focus:border-teal-500',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-semibold">Questions by Type</Label>
        <span className={`text-xs ${typeTotal !== questionCount ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          Total: {typeTotal} / {questionCount}
          {typeTotal !== questionCount && ' ⚠️'}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {typeKeys.map((type, index) => (
          <div key={type} className="space-y-1">
            <Label htmlFor={`type-${type}`} className="text-xs font-medium">
              {typeLabels[type]}
            </Label>
            <Input
              id={`type-${type}`}
              type="number"
              min={0}
              max={questionCount}
              value={typeDistribution[type]}
              onChange={(e) => onTypeChange(type, parseInt(e.target.value) || 0, index === typeKeys.length - 1)}
              className={`h-9 ${typeColors[type]}`}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Last field auto-adjusts to match total questions
      </p>
    </div>
  );
}
