import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QuestionTypeDistribution } from '@/lib/roleBasedDefaults';

// Category difficulty now uses question counts, not percentages
export interface CategoryDifficultyCount {
  easy: number;
  medium: number;
  hard: number;
}

export interface CategoryDifficultyDistributionCounts {
  mcq: CategoryDifficultyCount;
  scenario: CategoryDifficultyCount;
  coding: CategoryDifficultyCount;
  descriptive: CategoryDifficultyCount;
}

interface CategoryDifficultyInputsProps {
  categoryDifficulty: CategoryDifficultyDistributionCounts;
  typeDistribution: QuestionTypeDistribution;
  showCoding?: boolean;
  onChange: (category: keyof CategoryDifficultyDistributionCounts, difficulty: 'easy' | 'medium' | 'hard', value: number) => void;
}

const categoryColors: Record<string, string> = {
  mcq: 'border-blue-500/30',
  scenario: 'border-purple-500/30',
  coding: 'border-orange-500/30',
  descriptive: 'border-teal-500/30',
};

const categoryLabels: Record<string, string> = {
  mcq: 'MCQ',
  scenario: 'Scenario',
  coding: 'Coding',
  descriptive: 'Descriptive',
};

export function CategoryDifficultyInputs({
  categoryDifficulty,
  typeDistribution,
  showCoding = true,
  onChange,
}: CategoryDifficultyInputsProps) {
  const categories = showCoding
    ? (['mcq', 'scenario', 'coding', 'descriptive'] as const)
    : (['mcq', 'scenario', 'descriptive'] as const);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="font-semibold">Per-Category Difficulty</Label>
        <span className="text-xs text-muted-foreground">
          Enter question counts for each difficulty
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium">Category</th>
              <th className="text-center py-2 px-2 font-medium text-green-600">Easy</th>
              <th className="text-center py-2 px-2 font-medium text-amber-600">Medium</th>
              <th className="text-center py-2 px-2 font-medium text-red-600">Hard</th>
              <th className="text-center py-2 pl-4 font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const diff = categoryDifficulty[category];
              const total = diff.easy + diff.medium + diff.hard;
              const expected = typeDistribution[category];
              const isValid = total === expected;
              
              // Skip if no questions for this category
              if (expected === 0) return null;
              
              return (
                <tr key={category} className={`border-b ${categoryColors[category]}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{categoryLabels[category]}</span>
                      {!isValid && (
                        <Badge variant="outline" className="text-destructive text-xs">
                          {total}/{expected}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <Input
                      type="number"
                      min={0}
                      max={expected}
                      value={diff.easy}
                      onChange={(e) => onChange(category, 'easy', parseInt(e.target.value) || 0)}
                      className="h-8 w-16 text-center text-xs mx-auto"
                    />
                  </td>
                  <td className="py-3 px-2">
                    <Input
                      type="number"
                      min={0}
                      max={expected}
                      value={diff.medium}
                      onChange={(e) => onChange(category, 'medium', parseInt(e.target.value) || 0)}
                      className="h-8 w-16 text-center text-xs mx-auto"
                    />
                  </td>
                  <td className="py-3 px-2">
                    <Input
                      type="number"
                      min={0}
                      max={expected}
                      value={diff.hard}
                      onChange={(e) => onChange(category, 'hard', parseInt(e.target.value) || 0)}
                      className="h-8 w-16 text-center text-xs mx-auto"
                    />
                  </td>
                  <td className="py-3 pl-4 text-center">
                    <Badge variant={isValid ? "secondary" : "outline"} className={`font-mono ${!isValid ? 'text-destructive' : ''}`}>
                      {total}/{expected}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Enter the number of questions for each difficulty level. Total must match category count.
      </p>
    </div>
  );
}
