import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkillAutocompleteInputProps {
  label: string;
  description?: string;
  selectedSkills: string[];
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  suggestions: string[];
  placeholder?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}

const SkillAutocompleteInput: React.FC<SkillAutocompleteInputProps> = ({
  label,
  description,
  selectedSkills,
  onAddSkill,
  onRemoveSkill,
  suggestions,
  placeholder = "Type to search skills...",
  variant = 'primary',
  className
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input and exclude already selected
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    
    const search = inputValue.toLowerCase().trim();
    return suggestions
      .filter(skill => 
        skill.toLowerCase().includes(search) && 
        !selectedSkills.includes(skill)
      )
      .slice(0, 8); // Limit to 8 suggestions
  }, [inputValue, suggestions, selectedSkills]);

  // Check if input matches a custom skill (not in suggestions)
  const canAddCustomSkill = useMemo(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return false;
    // Allow custom skills that aren't already selected
    return !selectedSkills.some(s => s.toLowerCase() === trimmed.toLowerCase());
  }, [inputValue, selectedSkills]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
    setHighlightedIndex(-1);
  };

  const handleAddSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      onAddSkill(trimmed);
      setInputValue('');
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        handleAddSkill(filteredSuggestions[highlightedIndex]);
      } else if (canAddCustomSkill) {
        handleAddSkill(inputValue);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIndex = canAddCustomSkill ? filteredSuggestions.length : filteredSuggestions.length - 1;
      setHighlightedIndex(prev => Math.min(prev + 1, maxIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const badgeVariant = variant === 'primary' ? 'default' : 'secondary';

  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Selected Skills */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedSkills.map(skill => (
            <Badge 
              key={skill} 
              variant={badgeVariant}
              className="py-1 px-2 gap-1"
            >
              {skill}
              <X 
                className="h-3 w-3 cursor-pointer hover:opacity-70" 
                onClick={() => onRemoveSkill(skill)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Input with autocomplete */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full"
        />

        {/* Suggestions dropdown */}
        {showSuggestions && (filteredSuggestions.length > 0 || canAddCustomSkill) && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-60 overflow-y-auto"
          >
            {/* Matching suggestions */}
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={cn(
                  "px-3 py-2 cursor-pointer text-sm flex items-center gap-2",
                  highlightedIndex === index 
                    ? "bg-accent text-accent-foreground" 
                    : "hover:bg-muted"
                )}
                onClick={() => handleAddSkill(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <Plus className="h-3 w-3 text-muted-foreground" />
                {suggestion}
              </div>
            ))}

            {/* Custom skill option */}
            {canAddCustomSkill && (
              <div
                className={cn(
                  "px-3 py-2 cursor-pointer text-sm flex items-center gap-2 border-t border-border",
                  highlightedIndex === filteredSuggestions.length 
                    ? "bg-accent text-accent-foreground" 
                    : "hover:bg-muted"
                )}
                onClick={() => handleAddSkill(inputValue)}
                onMouseEnter={() => setHighlightedIndex(filteredSuggestions.length)}
              >
                <Plus className="h-3 w-3 text-primary" />
                <span className="text-primary">Add "{inputValue.trim()}"</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillAutocompleteInput;
