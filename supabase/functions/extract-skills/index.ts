import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { getAIConfig, logAIUsage } from "../_shared/config.ts";
import { corsHeaders } from '../_shared/cors.ts';

// Token estimation helper (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}


// Skill domain detection rules
const SKILL_DOMAIN_RULES = {
  database: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra', 'Oracle', 'Database', 'ETL', 'Data Engineering', 'Data Warehouse', 'Data Lake', 'SQL Server', 'NoSQL', 'Data Modeling'],
  backend: ['Node.js', 'Python', 'Java', 'Go', 'C#', '.NET', 'Ruby', 'PHP', 'Rust', 'Kotlin', 'Spring', 'Django', 'FastAPI', 'Express', 'NestJS', 'Microservices', 'REST API', 'GraphQL'],
  frontend: ['React', 'Vue', 'Angular', 'HTML', 'CSS', 'JavaScript', 'TypeScript', 'Next.js', 'Tailwind', 'Redux', 'Svelte', 'Webpack', 'Vite', 'Responsive Design', 'UI/UX'],
  devops: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Linux', 'Ansible', 'Prometheus', 'Grafana', 'Infrastructure', 'Cloud'],
  mobile: ['React Native', 'Flutter', 'iOS', 'Swift', 'Android', 'Kotlin', 'Ionic', 'Xamarin', 'Mobile'],
  data_science: ['Machine Learning', 'TensorFlow', 'PyTorch', 'Data Analysis', 'Pandas', 'Scikit-learn', 'Deep Learning', 'NLP', 'Computer Vision', 'AI', 'Statistics', 'R'],
  non_technical: ['HR', 'Marketing', 'Sales', 'Finance', 'Operations', 'Customer Support', 'Project Management', 'Business Development', 'Administration', 'Accounting']
};

// Category difficulty distribution type
interface CategoryDifficulty {
  easy: number;
  medium: number;
  hard: number;
}

interface CategoryDifficultyDistribution {
  mcq: CategoryDifficulty;
  scenario: CategoryDifficulty;
  coding: CategoryDifficulty;
  descriptive: CategoryDifficulty;
}

// Senior category difficulty - harder scenarios, balanced coding
const SENIOR_CATEGORY_DIFFICULTY: CategoryDifficultyDistribution = {
  mcq: { easy: 20, medium: 50, hard: 30 },
  scenario: { easy: 10, medium: 40, hard: 50 },
  coding: { easy: 20, medium: 40, hard: 40 },
  descriptive: { easy: 10, medium: 40, hard: 50 }
};

// Mid category difficulty - balanced
const MID_CATEGORY_DIFFICULTY: CategoryDifficultyDistribution = {
  mcq: { easy: 30, medium: 50, hard: 20 },
  scenario: { easy: 25, medium: 50, hard: 25 },
  coding: { easy: 25, medium: 50, hard: 25 },
  descriptive: { easy: 25, medium: 50, hard: 25 }
};

// Junior category difficulty - more easy/medium, less hard
const JUNIOR_CATEGORY_DIFFICULTY: CategoryDifficultyDistribution = {
  mcq: { easy: 40, medium: 45, hard: 15 },
  scenario: { easy: 40, medium: 45, hard: 15 },
  coding: { easy: 35, medium: 50, hard: 15 },
  descriptive: { easy: 40, medium: 45, hard: 15 }
};

// Senior patterns for experience level detection
const SENIOR_PATTERNS = [
  'senior', 'sr.', 'sr ', 'lead', 'principal', 'staff', 'architect',
  'director', 'head', 'vp', 'manager', 'chief', 'cto', 'ceo', 'cfo',
  'distinguished', 'fellow', 'expert', 'specialist'
];

const JUNIOR_PATTERNS = [
  'junior', 'jr.', 'jr ', 'intern', 'trainee', 'associate', 'entry',
  'graduate', 'fresher', 'apprentice', 'beginner'
];

function detectExperienceLevel(jobTitle: string): 'senior' | 'mid' | 'junior' {
  const titleLower = jobTitle.toLowerCase();
  
  for (const pattern of SENIOR_PATTERNS) {
    if (titleLower.includes(pattern)) {
      return 'senior';
    }
  }
  
  for (const pattern of JUNIOR_PATTERNS) {
    if (titleLower.includes(pattern)) {
      return 'junior';
    }
  }
  
  return 'mid';
}

// Extract minimum years of experience from job description
function extractYearsOfExperience(jobDescription: string): number | null {
  if (!jobDescription) return null;
  
  const textLower = jobDescription.toLowerCase();
  
  // Common patterns for years of experience
  const patterns = [
    /(\d+)\+?\s*(?:to\s*\d+)?\s*years?\s*(?:of\s*)?(?:experience|exp)/i,
    /(?:minimum|min|at\s*least)\s*(\d+)\s*years?/i,
    /(\d+)\s*-\s*\d+\s*years?\s*(?:of\s*)?(?:experience|exp)/i,
    /experience[:\s]*(\d+)\+?\s*years?/i,
    /(\d+)\+?\s*yrs?\s*(?:of\s*)?(?:experience|exp)/i,
  ];
  
  for (const pattern of patterns) {
    const match = textLower.match(pattern);
    if (match && match[1]) {
      const years = parseInt(match[1], 10);
      if (years >= 0 && years <= 30) {
        return years;
      }
    }
  }
  
  return null;
}

// Determine experience level from years if not detected from title
function getExperienceLevelFromYears(years: number): 'senior' | 'mid' | 'junior' {
  if (years >= 7) return 'senior';
  if (years >= 3) return 'mid';
  return 'junior';
}

function detectSkillDomain(skills: string[], jobTitle: string): { 
  skillDomain: string; 
  showCoding: boolean; 
  showDbSchema: boolean;
  suggestedDefaults: { mcq: number; scenario: number; coding: number; descriptive: number };
  categoryDifficulty: CategoryDifficultyDistribution;
} {
  const skillsLower = skills.map(s => s.toLowerCase());
  const experienceLevel = detectExperienceLevel(jobTitle);
  
  const domainScores: Record<string, number> = {
    database: 0,
    backend: 0,
    frontend: 0,
    devops: 0,
    mobile: 0,
    data_science: 0,
    non_technical: 0
  };

  // Score each domain based on matching skills
  for (const [domain, keywords] of Object.entries(SKILL_DOMAIN_RULES)) {
    for (const keyword of keywords) {
      if (skillsLower.some(s => s.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(s))) {
        domainScores[domain]++;
      }
    }
  }

  // Find the primary domain (highest score)
  let primaryDomain = 'backend'; // default
  let maxScore = 0;
  for (const [domain, score] of Object.entries(domainScores)) {
    if (score > maxScore) {
      maxScore = score;
      primaryDomain = domain;
    }
  }

  // Check for fullstack (both frontend and backend significant)
  if (domainScores.frontend >= 2 && domainScores.backend >= 2) {
    primaryDomain = 'fullstack';
  }

  // Determine what to show based on domain
  let showCoding = true;
  let showDbSchema = false;
  
  // Base defaults by domain
  let suggestedDefaults = { mcq: 40, scenario: 30, coding: 20, descriptive: 10 };

  switch (primaryDomain) {
    case 'database':
      showCoding = true;
      showDbSchema = true;
      suggestedDefaults = { mcq: 30, scenario: 20, coding: 40, descriptive: 10 };
      break;
    case 'backend':
      showCoding = true;
      showDbSchema = false;
      suggestedDefaults = { mcq: 35, scenario: 25, coding: 30, descriptive: 10 };
      break;
    case 'frontend':
      showCoding = true;
      showDbSchema = false;
      suggestedDefaults = { mcq: 40, scenario: 30, coding: 20, descriptive: 10 };
      break;
    case 'fullstack':
      showCoding = true;
      showDbSchema = true;
      suggestedDefaults = { mcq: 35, scenario: 25, coding: 30, descriptive: 10 };
      break;
    case 'devops':
      showCoding = true;
      showDbSchema = false;
      suggestedDefaults = { mcq: 40, scenario: 35, coding: 15, descriptive: 10 };
      break;
    case 'mobile':
      showCoding = true;
      showDbSchema = false;
      suggestedDefaults = { mcq: 40, scenario: 25, coding: 25, descriptive: 10 };
      break;
    case 'data_science':
      showCoding = true;
      showDbSchema = true;
      suggestedDefaults = { mcq: 35, scenario: 25, coding: 30, descriptive: 10 };
      break;
    case 'non_technical':
      showCoding = false;
      showDbSchema = false;
      suggestedDefaults = { mcq: 50, scenario: 30, coding: 0, descriptive: 20 };
      break;
  }

  // Apply experience level adjustments
  if (experienceLevel === 'senior') {
    // Seniors: less coding, more scenario and descriptive
    suggestedDefaults = {
      mcq: 25,
      scenario: 40,
      coding: showCoding ? 10 : 0,
      descriptive: 25
    };
  } else if (experienceLevel === 'junior') {
    // Juniors: more coding and MCQ, less scenario/descriptive
    suggestedDefaults = {
      mcq: 40,
      scenario: 15,
      coding: showCoding ? 35 : 0,
      descriptive: 10
    };
  }

  // Get category difficulty based on experience level
  let categoryDifficulty: CategoryDifficultyDistribution;
  switch (experienceLevel) {
    case 'senior':
      categoryDifficulty = SENIOR_CATEGORY_DIFFICULTY;
      break;
    case 'junior':
      categoryDifficulty = JUNIOR_CATEGORY_DIFFICULTY;
      break;
    default:
      categoryDifficulty = MID_CATEGORY_DIFFICULTY;
  }

  console.log(`Detected skill domain: ${primaryDomain}, experience: ${experienceLevel}`, { domainScores, showCoding, showDbSchema, suggestedDefaults });

  return {
    skillDomain: primaryDomain,
    showCoding,
    showDbSchema,
    suggestedDefaults,
    categoryDifficulty
  };
}

// Use AI Gateway
async function extractWithGatewayAI(prompt: string) {
  const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
  
  if (!AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is not configured');
  }

  console.log('Using AI Gateway...');
  
  const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
  const response = await fetch(AI_GATEWAY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash-lite', // Cost-optimized: simple extraction task
      messages: [
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAIProvider(prompt: string, providerConfig: any, attempt: number = 1): Promise<string> {
  const apiKey = providerConfig.apiKey;
  const model = providerConfig.model || 'gemini-2.5-flash';
  const baseUrl = providerConfig.baseUrl;
  
  const response = await fetch(`${baseUrl}/v1/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI Provider error (attempt ${attempt}):`, response.status, errorText);
    throw new Error(`API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
    throw new Error("Invalid AI response structure");
  }
  
  return data.candidates[0].content.parts[0].text;
}

serve(async (req) => {
  const logger = createLogger('extract-skills');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info('Skill extraction request started');
    
    // SECURITY FIX: Use authenticateRequest for proper role checking with service role
    const authHeader = req.headers.get('Authorization');
    const { authenticateRequest } = await import('../_shared/auth-utils.ts');
    
    // Roles: partner_admin and hr_recruiter can extract skills (part of interview creation)
    const { user, supabase, error: authError } = await authenticateRequest(
      authHeader,
      ['partner_admin', 'hr_recruiter']
    );
    
    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError });
      return new Response(JSON.stringify({ error: authError || 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info('User authorized for skill extraction', { userId: user.id });

    const { jobTitle, jobDescription } = await req.json();
    
    if (!jobTitle || jobTitle.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Job title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const prompt = `You are an expert HR and technical skills analyst with comprehensive knowledge of job markets and industry requirements. 

Given a job title and job description, analyze the role thoroughly and identify 10-15 key skills required for success in this position.

CRITICAL INSTRUCTIONS:
- Return ONLY the skills as a JSON array of strings
- Draw from your comprehensive knowledge of the industry and role requirements
- Include a mix of:
  * Core technical skills specific to the role
  * Tools and technologies commonly used
  * Soft skills and competencies
  * Industry-standard certifications or methodologies
- If job description is provided, extract skills mentioned AND supplement with additional relevant skills based on your knowledge
- Skills should be specific, industry-standard terms
- Prioritize most critical skills first
- No explanations, just the JSON array

Examples:
Job Title: "Data Analyst" 
Job Description: "Analyze business data and create reports..."
→ ["SQL", "Python", "Excel", "Power BI", "Tableau", "Data Cleaning", "Statistics", "Data Visualization", "ETL", "Database Design", "Business Intelligence", "Critical Thinking", "Communication"]

Job Title: "Senior Frontend Developer"
Job Description: "Build scalable web applications..."
→ ["React", "TypeScript", "JavaScript", "HTML5", "CSS3", "Redux", "REST APIs", "GraphQL", "Git", "Webpack", "Testing (Jest)", "Responsive Design", "Performance Optimization", "Agile"]

Return format: ["Skill 1", "Skill 2", "Skill 3", ...]

Job Title: ${jobTitle}${jobDescription ? `\n\nJob Description: ${jobDescription}` : ''}`;

    let content: string | null = null;
    let usedFallback = false;
    // Organization context not available for skill extraction - it's a generic utility

    const startTime = Date.now();
    const requestTokens = estimateTokens(prompt);
    
    // Try to load AI configuration
    try {
      const aiConfig = await getAIConfig('skill_extraction');
      
      // If we have configured AI provider with API key, use it (one try only)
      if (aiConfig?.primaryProvider?.apiKey) {
        console.log('Using configured AI provider');
        try {
          content = await callAIProvider(prompt, aiConfig.primaryProvider, 1);
          const latencyMs = Date.now() - startTime;
          const responseTokens = estimateTokens(content || '');
          
          await logAIUsage({
            featureName: 'skill_extraction',
            success: true,
            providerId: aiConfig.primaryProvider.type,
            modelUsed: aiConfig.primaryProvider.model,
            requestTokens,
            responseTokens,
            latencyMs,
          });
          console.log(`[skill_extraction] Success (${latencyMs}ms, ~${requestTokens + responseTokens} tokens)`);
        } catch (error) {
          console.error('Configured provider failed:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const latencyMs = Date.now() - startTime;
          
          await logAIUsage({
            featureName: 'skill_extraction',
            success: false,
            providerId: aiConfig.primaryProvider.type,
            modelUsed: aiConfig.primaryProvider.model,
            requestTokens,
            latencyMs,
            errorMessage: errorMessage,
          });
          
          // Don't throw - allow fallback to AI Gateway
        }
      }
    } catch (configError) {
      console.log('No AI configuration found or configured provider failed');
    }

    // If no configured provider or not yet successful, use AI Gateway
    if (!content) {
      console.log('Using AI Gateway');
      const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
      
      if (!AI_GATEWAY_API_KEY) {
        throw new Error('No AI provider available. Please configure an AI provider in settings.');
      }
      
      content = await extractWithGatewayAI(prompt);
      usedFallback = true;
      const latencyMs = Date.now() - startTime;
      const responseTokens = estimateTokens(content || '');
      
      await logAIUsage({
        featureName: 'skill_extraction',
        success: true,
        modelUsed: 'gemini-2.5-flash',
        fallbackUsed: true,
        requestTokens,
        responseTokens,
        latencyMs,
      });
      console.log(`[skill_extraction] AI Gateway success (${latencyMs}ms, ~${requestTokens + responseTokens} tokens)`);
    }

    if (!content) {
      throw new Error("Failed to get response from AI service");
    }
    
    console.log('AI Response received:', content);
    
    // Extract JSON array from response
    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) {
      throw new Error("Failed to extract skills array from AI response");
    }
    
    const skills = JSON.parse(jsonMatch[0]);
    
    // Validate skills array
    if (!Array.isArray(skills) || !skills.every(s => typeof s === 'string')) {
      throw new Error("Invalid skills format from AI");
    }
    
    console.log(`Extracted ${skills.length} skills`);
    
    // Detect skill domain based on extracted skills
    const domainInfo = detectSkillDomain(skills, jobTitle);
    
    // Extract years of experience from job description
    const minYearsExperience = extractYearsOfExperience(jobDescription || '');
    
    // Determine experience level - prefer title detection, fallback to years
    let experienceLevel = detectExperienceLevel(jobTitle);
    
    // If title detection returned 'mid' (default), check if years suggest otherwise
    if (experienceLevel === 'mid' && minYearsExperience !== null) {
      experienceLevel = getExperienceLevelFromYears(minYearsExperience);
    }
    
    console.log(`Experience detection: title="${jobTitle}" -> ${experienceLevel}, years=${minYearsExperience}`);
    
    return new Response(JSON.stringify({ 
      skills,
      usedFallback,
      skillDomain: domainInfo.skillDomain,
      showCoding: domainInfo.showCoding,
      showDbSchema: domainInfo.showDbSchema,
      suggestedDefaults: domainInfo.suggestedDefaults,
      categoryDifficulty: domainInfo.categoryDifficulty,
      experienceLevel,
      minYearsExperience
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error('Error in extract-skills:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
