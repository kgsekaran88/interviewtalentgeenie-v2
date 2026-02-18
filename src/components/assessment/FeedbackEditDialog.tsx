import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Sparkles, Wand2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FeedbackSection = 'strengths' | 'weaknesses' | 'detailed_analysis';

interface FeedbackEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: FeedbackSection;
  assessmentId: string;
  currentContent: string | string[];
  context?: {
    candidateName?: string;
    interviewTitle?: string;
    overallScore?: number;
    topicScores?: Record<string, number>;
  };
  onUpdate: (section: FeedbackSection, newContent: string | string[]) => void;
}

const sectionLabels: Record<FeedbackSection, string> = {
  strengths: 'Key Strengths',
  weaknesses: 'Areas for Improvement',
  detailed_analysis: 'Detailed Analysis',
};

const sectionDescriptions: Record<FeedbackSection, string> = {
  strengths: 'Positive attributes and accomplishments of the candidate',
  weaknesses: 'Areas where the candidate can grow (limited to 2 items)',
  detailed_analysis: 'Comprehensive analysis of the candidate\'s performance',
};

const presetInstructions: Record<FeedbackSection, string[]> = {
  strengths: [
    'Make it more specific with examples',
    'Focus on leadership qualities',
    'Highlight technical competencies',
    'Emphasize communication skills',
  ],
  weaknesses: [
    'Make it more encouraging and growth-focused',
    'Focus on development opportunities only',
    'Frame as learning areas, not criticisms',
    'Keep only the most important growth area',
  ],
  detailed_analysis: [
    'Make the tone more positive and encouraging',
    'Reduce negative points to just one mention',
    'Highlight achievements more prominently',
    'Add a stronger positive conclusion',
  ],
};

export function FeedbackEditDialog({
  open,
  onOpenChange,
  section,
  assessmentId,
  currentContent,
  context,
  onUpdate,
}: FeedbackEditDialogProps) {
  const [instruction, setInstruction] = useState('');
  const [mode, setMode] = useState<'regenerate' | 'refine'>('refine');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!instruction.trim()) {
      toast.error('Please enter an instruction');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('refine-assessment-feedback', {
        body: {
          assessmentId,
          section,
          instruction: instruction.trim(),
          currentContent,
          mode,
          context,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success && data?.content) {
        onUpdate(section, data.content);
        toast.success(`${sectionLabels[section]} updated successfully`);
        onOpenChange(false);
        setInstruction('');
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (err: any) {
      console.error('Error refining feedback:', err);
      toast.error(err.message || 'Failed to update feedback');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    setInstruction(preset);
  };

  const currentContentDisplay = Array.isArray(currentContent)
    ? currentContent.map((item, i) => `${i + 1}. ${item}`).join('\n')
    : currentContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Edit {sectionLabels[section]}
          </DialogTitle>
          <DialogDescription>
            {sectionDescriptions[section]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Content Preview */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Current Content:</Label>
            <div className="p-3 rounded-lg bg-muted/50 text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
              {currentContentDisplay}
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <Label>Edit Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(value) => setMode(value as 'regenerate' | 'refine')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="refine" id="refine" />
                <Label htmlFor="refine" className="flex items-center gap-1 cursor-pointer">
                  <Wand2 className="h-4 w-4" />
                  Refine existing
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="regenerate" id="regenerate" />
                <Label htmlFor="regenerate" className="flex items-center gap-1 cursor-pointer">
                  <RefreshCw className="h-4 w-4" />
                  Regenerate completely
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Quick Instructions:</Label>
            <div className="flex flex-wrap gap-2">
              {presetInstructions[section].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={instruction === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className="text-xs"
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Instruction */}
          <div className="space-y-2">
            <Label htmlFor="instruction">Your Instruction</Label>
            <Textarea
              id="instruction"
              placeholder="Tell the AI how to modify this section... e.g., 'Make the tone more encouraging' or 'Focus on technical skills'"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              The AI will {mode === 'refine' ? 'adjust the existing content' : 'create new content from scratch'} based on your instruction
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !instruction.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Apply Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
