import React from 'react';

interface FormattedQuestionTextProps {
  text: string;
  className?: string;
}

/**
 * Formats long question text into readable sections
 * - Detects scenarios, requirements, and actual questions
 * - Breaks paragraphs at logical points
 * - Highlights key terms and phrases
 */
const FormattedQuestionText: React.FC<FormattedQuestionTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Helper to split text into logical sections
  const formatText = (input: string): React.ReactNode[] => {
    const sections: React.ReactNode[] = [];
    
    // Patterns that indicate different sections
    const questionIndicators = [
      'Which pattern', 'What is', 'What are', 'How would', 'How do', 'How can',
      'Why is', 'Why does', 'When should', 'When would',
      'Which of the following', 'Which approach', 'Which method', 'Which technique',
      'What would', 'What could', 'Explain', 'Describe', 'Compare', 'Contrast',
      'Identify', 'Define', 'List', 'Name', 'Select', 'Choose'
    ];
    
    const scenarioIndicators = [
      'You are', 'Your program', 'Your team', 'Your company', 'Your application',
      'Consider a', 'Consider the', 'Imagine', 'Suppose', 'Given',
      'A company', 'An organization', 'A team', 'A system', 'A project',
      'In this scenario', 'In this situation'
    ];
    
    const requirementIndicators = [
      'A key challenge', 'The requirement', 'The goal', 'The objective',
      'The constraint', 'The limitation', 'You need to', 'You must',
      'The system must', 'The application should', 'It is required'
    ];

    // First, check if text contains multiple sentences that can be logically separated
    const sentences = input.match(/[^.!?]+[.!?]+/g) || [input];
    
    if (sentences.length === 1) {
      // Short question, just return as-is with possible keyword highlighting
      return [<span key="single" className="leading-relaxed">{highlightKeywords(input)}</span>];
    }

    let currentSection: { type: 'scenario' | 'requirement' | 'question' | 'context'; text: string }[] = [];
    
    sentences.forEach((sentence, index) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;
      
      let sectionType: 'scenario' | 'requirement' | 'question' | 'context' = 'context';
      
      // Determine section type
      if (scenarioIndicators.some(ind => trimmed.toLowerCase().startsWith(ind.toLowerCase()))) {
        sectionType = 'scenario';
      } else if (requirementIndicators.some(ind => trimmed.toLowerCase().includes(ind.toLowerCase()))) {
        sectionType = 'requirement';
      } else if (questionIndicators.some(ind => trimmed.includes(ind))) {
        sectionType = 'question';
      }
      
      currentSection.push({ type: sectionType, text: trimmed });
    });

    // Group consecutive sentences of the same type
    const groupedSections: { type: string; sentences: string[] }[] = [];
    let currentGroup: { type: string; sentences: string[] } | null = null;

    currentSection.forEach(item => {
      if (!currentGroup || currentGroup.type !== item.type) {
        if (currentGroup) {
          groupedSections.push(currentGroup);
        }
        currentGroup = { type: item.type, sentences: [item.text] };
      } else {
        currentGroup.sentences.push(item.text);
      }
    });
    if (currentGroup) {
      groupedSections.push(currentGroup);
    }

    // Render each group with appropriate styling
    groupedSections.forEach((group, index) => {
      const combinedText = group.sentences.join(' ');
      
      if (group.type === 'scenario') {
        sections.push(
          <div key={`scenario-${index}`} className="mb-3 pb-3 border-b border-border/50">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide block mb-1.5">
              📋 Scenario
            </span>
            <p className="text-foreground/90 leading-relaxed">
              {highlightKeywords(combinedText)}
            </p>
          </div>
        );
      } else if (group.type === 'requirement') {
        sections.push(
          <div key={`req-${index}`} className="mb-3 pb-3 border-b border-border/50">
            <span className="text-xs font-semibold text-warning uppercase tracking-wide block mb-1.5">
              ⚡ Key Challenge
            </span>
            <p className="text-foreground/90 leading-relaxed">
              {highlightKeywords(combinedText)}
            </p>
          </div>
        );
      } else if (group.type === 'question') {
        sections.push(
          <div key={`question-${index}`} className="mb-2 bg-primary/5 p-3 rounded-lg border border-primary/20">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide block mb-1.5">
              ❓ Question
            </span>
            <p className="text-foreground font-medium leading-relaxed">
              {highlightKeywords(combinedText)}
            </p>
          </div>
        );
      } else {
        sections.push(
          <p key={`context-${index}`} className="mb-2 text-foreground/90 leading-relaxed">
            {highlightKeywords(combinedText)}
          </p>
        );
      }
    });

    return sections;
  };

  // Highlight important technical keywords with bold (no color)
  const highlightKeywords = (text: string): React.ReactNode => {
    // Technical terms to highlight
    const keywords = [
      'microservices', 'database', 'API', 'REST', 'GraphQL', 'SQL', 'NoSQL',
      'scalability', 'performance', 'security', 'authentication', 'authorization',
      'cache', 'caching', 'load balancing', 'distributed', 'consistency',
      'transaction', 'ACID', 'CAP theorem', 'eventual consistency',
      'Saga pattern', 'CQRS', 'event sourcing', 'message broker', 'Kafka',
      'Docker', 'Kubernetes', 'CI/CD', 'DevOps', 'AWS', 'Azure', 'GCP',
      'React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'Spring Boot',
      'machine learning', 'AI', 'algorithm', 'data structure',
      'monolithic', 'architecture', 'design pattern', 'best practice'
    ];

    // Create regex pattern for keywords (case insensitive)
    const pattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
    
    const parts = text.split(pattern);
    
    return parts.map((part, index) => {
      const isKeyword = keywords.some(kw => kw.toLowerCase() === part.toLowerCase());
      if (isKeyword) {
        return (
          <span key={index} className="font-bold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {formatText(text)}
    </div>
  );
};

export default FormattedQuestionText;
