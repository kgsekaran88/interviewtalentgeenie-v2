import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-caller.ts";

import { corsHeaders } from "../_shared/cors.ts";

// Mapping of technology keywords to stable main portal URLs
const OFFICIAL_LEARNING_PORTALS: Record<string, { name: string; url: string; description: string }> = {
  // Microsoft Products
  'power bi': { name: 'Microsoft Learn - Power BI', url: 'https://learn.microsoft.com/en-us/power-bi/', description: 'Official Power BI documentation and learning paths' },
  'powerbi': { name: 'Microsoft Learn - Power BI', url: 'https://learn.microsoft.com/en-us/power-bi/', description: 'Official Power BI documentation and learning paths' },
  'azure': { name: 'Microsoft Learn - Azure', url: 'https://learn.microsoft.com/en-us/azure/', description: 'Official Azure documentation and training' },
  'microsoft': { name: 'Microsoft Learn', url: 'https://learn.microsoft.com/', description: 'Official Microsoft learning platform' },
  '.net': { name: 'Microsoft Learn - .NET', url: 'https://learn.microsoft.com/en-us/dotnet/', description: 'Official .NET documentation' },
  'c#': { name: 'Microsoft Learn - C#', url: 'https://learn.microsoft.com/en-us/dotnet/csharp/', description: 'Official C# documentation' },
  'sql server': { name: 'Microsoft Learn - SQL Server', url: 'https://learn.microsoft.com/en-us/sql/', description: 'Official SQL Server documentation' },
  
  // Cloud Platforms
  'aws': { name: 'AWS Training and Certification', url: 'https://aws.amazon.com/training/', description: 'Official AWS training portal' },
  'amazon web services': { name: 'AWS Training and Certification', url: 'https://aws.amazon.com/training/', description: 'Official AWS training portal' },
  'gcp': { name: 'Google Cloud Training', url: 'https://cloud.google.com/training', description: 'Official Google Cloud training' },
  'google cloud': { name: 'Google Cloud Training', url: 'https://cloud.google.com/training', description: 'Official Google Cloud training' },
  
  // Data Platforms
  'databricks': { name: 'Databricks Academy', url: 'https://www.databricks.com/learn', description: 'Official Databricks learning platform' },
  'snowflake': { name: 'Snowflake University', url: 'https://learn.snowflake.com/', description: 'Official Snowflake training' },
  'tableau': { name: 'Tableau Learning', url: 'https://www.tableau.com/learn', description: 'Official Tableau learning resources' },
  
  // Programming Languages
  'python': { name: 'Python Documentation', url: 'https://docs.python.org/3/', description: 'Official Python documentation and tutorials' },
  'javascript': { name: 'MDN Web Docs - JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', description: 'Mozilla JavaScript documentation' },
  'typescript': { name: 'TypeScript Documentation', url: 'https://www.typescriptlang.org/docs/', description: 'Official TypeScript documentation' },
  'java': { name: 'Oracle Java Tutorials', url: 'https://dev.java/learn/', description: 'Official Java learning resources' },
  'go': { name: 'Go Documentation', url: 'https://go.dev/doc/', description: 'Official Go documentation' },
  'rust': { name: 'Rust Documentation', url: 'https://doc.rust-lang.org/', description: 'Official Rust documentation' },
  
  // Frameworks
  'react': { name: 'React Documentation', url: 'https://react.dev/', description: 'Official React documentation' },
  'angular': { name: 'Angular Documentation', url: 'https://angular.io/docs', description: 'Official Angular documentation' },
  'vue': { name: 'Vue.js Documentation', url: 'https://vuejs.org/guide/', description: 'Official Vue.js documentation' },
  'node': { name: 'Node.js Documentation', url: 'https://nodejs.org/en/learn', description: 'Official Node.js learning resources' },
  'nodejs': { name: 'Node.js Documentation', url: 'https://nodejs.org/en/learn', description: 'Official Node.js learning resources' },
  
  // Databases
  'postgresql': { name: 'PostgreSQL Documentation', url: 'https://www.postgresql.org/docs/', description: 'Official PostgreSQL documentation' },
  'postgres': { name: 'PostgreSQL Documentation', url: 'https://www.postgresql.org/docs/', description: 'Official PostgreSQL documentation' },
  'mongodb': { name: 'MongoDB University', url: 'https://learn.mongodb.com/', description: 'Official MongoDB learning platform' },
  'mysql': { name: 'MySQL Documentation', url: 'https://dev.mysql.com/doc/', description: 'Official MySQL documentation' },
  'redis': { name: 'Redis Documentation', url: 'https://redis.io/docs/', description: 'Official Redis documentation' },
  
  // DevOps & Infrastructure
  'docker': { name: 'Docker Documentation', url: 'https://docs.docker.com/', description: 'Official Docker documentation' },
  'kubernetes': { name: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/', description: 'Official Kubernetes documentation' },
  'k8s': { name: 'Kubernetes Documentation', url: 'https://kubernetes.io/docs/', description: 'Official Kubernetes documentation' },
  'terraform': { name: 'Terraform Documentation', url: 'https://developer.hashicorp.com/terraform/docs', description: 'Official Terraform documentation' },
  'git': { name: 'Git Documentation', url: 'https://git-scm.com/doc', description: 'Official Git documentation' },
  'linux': { name: 'Linux Documentation', url: 'https://www.kernel.org/doc/', description: 'Official Linux kernel documentation' },
  
  // Data Engineering
  'spark': { name: 'Apache Spark Documentation', url: 'https://spark.apache.org/docs/latest/', description: 'Official Apache Spark documentation' },
  'kafka': { name: 'Apache Kafka Documentation', url: 'https://kafka.apache.org/documentation/', description: 'Official Apache Kafka documentation' },
  'airflow': { name: 'Apache Airflow Documentation', url: 'https://airflow.apache.org/docs/', description: 'Official Apache Airflow documentation' },
  
  // CRM & Enterprise
  'salesforce': { name: 'Salesforce Trailhead', url: 'https://trailhead.salesforce.com/', description: 'Official Salesforce learning platform' },
  'servicenow': { name: 'ServiceNow Now Learning', url: 'https://nowlearning.servicenow.com/', description: 'Official ServiceNow learning platform' },
  'sap': { name: 'SAP Learning', url: 'https://learning.sap.com/', description: 'Official SAP learning platform' },
  
  // Machine Learning
  'machine learning': { name: 'Google ML Crash Course', url: 'https://developers.google.com/machine-learning', description: 'Google Machine Learning resources' },
  'ml': { name: 'Google ML Crash Course', url: 'https://developers.google.com/machine-learning', description: 'Google Machine Learning resources' },
  'tensorflow': { name: 'TensorFlow Documentation', url: 'https://www.tensorflow.org/learn', description: 'Official TensorFlow learning resources' },
  'pytorch': { name: 'PyTorch Documentation', url: 'https://pytorch.org/tutorials/', description: 'Official PyTorch tutorials' },
  
  // Web Development
  'html': { name: 'MDN Web Docs - HTML', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', description: 'Mozilla HTML documentation' },
  'css': { name: 'MDN Web Docs - CSS', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS', description: 'Mozilla CSS documentation' },
  'web': { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', description: 'Mozilla Web documentation' },
  
  // Default/General
  'data': { name: 'Google Data Analytics', url: 'https://grow.google/certificates/data-analytics/', description: 'Google Data Analytics Certificate' },
  'sql': { name: 'PostgreSQL Documentation', url: 'https://www.postgresql.org/docs/', description: 'PostgreSQL SQL documentation' },
  'api': { name: 'MDN Web APIs', url: 'https://developer.mozilla.org/en-US/docs/Web/API', description: 'Web API documentation' },
};

// Free book resources mapping
const FREE_BOOKS: Record<string, { name: string; url: string; description: string }> = {
  'python': { name: 'Automate the Boring Stuff with Python', url: 'https://automatetheboringstuff.com/', description: 'Free comprehensive Python programming book' },
  'javascript': { name: 'Eloquent JavaScript', url: 'https://eloquentjavascript.net/', description: 'Free modern JavaScript book' },
  'git': { name: 'Pro Git', url: 'https://git-scm.com/book/en/v2', description: 'Free official Git book' },
  'go': { name: 'Go by Example', url: 'https://gobyexample.com/', description: 'Hands-on introduction to Go' },
  'linux': { name: 'The Linux Command Line', url: 'https://linuxcommand.org/tlcl.php', description: 'Free comprehensive Linux book' },
  'sql': { name: 'SQL Tutorial', url: 'https://sqlzoo.net/', description: 'Interactive SQL learning' },
  'data science': { name: 'Python Data Science Handbook', url: 'https://jakevdp.github.io/PythonDataScienceHandbook/', description: 'Free data science with Python' },
  'machine learning': { name: 'Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', description: 'Free Google ML course' },
  'react': { name: 'React Documentation', url: 'https://react.dev/learn', description: 'Official React learning guide' },
  'typescript': { name: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/', description: 'Official TypeScript guide' },
};

// Find the best matching official portal for a topic
function findOfficialPortal(topicName: string, subtopic: string = ''): { name: string; url: string; description: string } | null {
  const searchText = `${topicName} ${subtopic}`.toLowerCase();
  
  // Try to find exact or partial match
  for (const [keyword, portal] of Object.entries(OFFICIAL_LEARNING_PORTALS)) {
    if (searchText.includes(keyword.toLowerCase())) {
      return portal;
    }
  }
  
  return null;
}

// Find the best matching free book for a topic
function findFreeBook(topicName: string, subtopic: string = ''): { name: string; url: string; description: string } | null {
  const searchText = `${topicName} ${subtopic}`.toLowerCase();
  
  for (const [keyword, book] of Object.entries(FREE_BOOKS)) {
    if (searchText.includes(keyword.toLowerCase())) {
      return book;
    }
  }
  
  return null;
}

// Replace AI-generated URLs with stable official portal URLs
function stabilizeUrls(topic: any): any {
  if (!topic.materials || !Array.isArray(topic.materials)) {
    return topic;
  }
  
  const portal = findOfficialPortal(topic.topic_name || '', topic.subtopic || '');
  const book = findFreeBook(topic.topic_name || '', topic.subtopic || '');
  
  const stabilizedMaterials = topic.materials.map((material: any) => {
    // For labs, keep the description but use a stable portal URL
    if (material.material_type === 'lab') {
      const labPortal = portal || { 
        name: 'Official Documentation', 
        url: 'https://learn.microsoft.com/', 
        description: 'Official learning platform' 
      };
      return {
        ...material,
        url: labPortal.url,
        title: material.title || `${topic.topic_name} - Hands-on Lab`
      };
    }
    
    // For books, use the free book mapping
    if (material.material_type === 'book') {
      if (book) {
        return {
          ...material,
          url: book.url,
          title: material.title || book.name,
          description: material.description || book.description
        };
      }
      // Keep original book URL if no mapping found
      return material;
    }
    
    // For documentation and other materials, use the official portal URL
    if (portal) {
      return {
        ...material,
        url: portal.url,
        title: material.title || portal.name
      };
    }
    
    // Fallback: keep original if no portal found
    return material;
  });
  
  // If no materials have valid URLs, add the official portal as a resource
  if (stabilizedMaterials.length === 0 && portal) {
    stabilizedMaterials.push({
      title: portal.name,
      url: portal.url,
      material_type: 'documentation',
      description: portal.description
    });
  }
  
  return {
    ...topic,
    materials: stabilizedMaterials
  };
}

// Process topic materials - replace with stable official portal URLs
function processTopicMaterials(topic: any): any {
  // First stabilize URLs to use official portals
  const stabilizedTopic = stabilizeUrls(topic);
  
  console.log(`Topic "${topic.topic_name}": ${stabilizedTopic.materials?.length || 0} materials with stable URLs`);
  
  return stabilizedTopic;
}

// Clean and repair malformed JSON from AI responses
function cleanJsonResponse(content: string): string {
  try {
    // First try to extract JSON object
    let jsonStr = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    // Fix common JSON issues
    // 1. Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    // 2. Fix unescaped quotes in strings (common in descriptions)
    // This is tricky - we need to be careful not to break valid JSON
    // Replace problematic patterns like "text with "quotes" inside"
    jsonStr = jsonStr.replace(/"([^"]*)":\s*"([^"]*)"/g, (match, key, value) => {
      // Escape any unescaped quotes within the value
      const escapedValue = value.replace(/(?<!\\)"/g, '\\"');
      return `"${key}": "${escapedValue}"`;
    });
    
    // 3. Fix newlines in strings
    jsonStr = jsonStr.replace(/\n/g, '\\n');
    jsonStr = jsonStr.replace(/\r/g, '\\r');
    jsonStr = jsonStr.replace(/\t/g, '\\t');
    
    return jsonStr;
  } catch (e) {
    console.error("JSON cleaning failed:", e);
    return content;
  }
}

// Extract JSON from markdown code blocks if present
function extractFromCodeBlock(content: string): string {
  // Check for ```json ... ``` or ``` ... ``` blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return content;
}

// Attempt to parse JSON with multiple strategies
function parseJsonSafely(content: string): any {
  // First, extract from code blocks if present
  const extracted = extractFromCodeBlock(content);
  console.log("Extracted content length:", extracted.length);
  
  // Strategy 1: Direct parse of extracted content
  try {
    const jsonMatch = extracted.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.log("Strategy 1 (direct parse) failed:", e instanceof Error ? e.message : 'Unknown');
  }
  
  // Strategy 2: Clean and parse
  try {
    const cleaned = cleanJsonResponse(extracted);
    return JSON.parse(cleaned);
  } catch (e) {
    console.log("Strategy 2 (cleaned parse) failed:", e instanceof Error ? e.message : 'Unknown');
  }
  
  // Strategy 3: Extract topics array manually
  try {
    const topicsMatch = extracted.match(/"topics"\s*:\s*\[([\s\S]*?)\](?=\s*})/);
    if (topicsMatch) {
      // Try to parse individual topic objects
      const topicsContent = topicsMatch[1];
      const topicObjects: any[] = [];
      
      // Match individual topic objects
      const objectMatches = topicsContent.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      for (const match of objectMatches) {
        try {
          const cleaned = cleanJsonResponse(match[0]);
          topicObjects.push(JSON.parse(cleaned));
        } catch {
          // Skip malformed topics
          console.log("Skipping malformed topic object");
        }
      }
      
      if (topicObjects.length > 0) {
        console.log(`Strategy 3 recovered ${topicObjects.length} topics`);
        return { topics: topicObjects };
      }
    }
  } catch (e) {
    console.log("Strategy 3 (manual extraction) failed:", e instanceof Error ? e.message : 'Unknown');
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roleName, roleDescription, difficultyLevel } = await req.json();
    
    if (!roleName) {
      return new Response(
        JSON.stringify({ error: "Role name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Official learning source mappings for various technologies
    const officialSources = `
MANDATORY OFFICIAL LEARNING SOURCES (use ONLY these URLs):

DOCUMENTATION & COURSES:
- Azure/Microsoft: learn.microsoft.com
- Power BI: learn.microsoft.com/power-bi
- Databricks: academy.databricks.com
- Snowflake: learn.snowflake.com
- AWS: aws.amazon.com/training, skillbuilder.aws
- Google Cloud: cloud.google.com/training
- Python: docs.python.org, realpython.com
- JavaScript/Web: developer.mozilla.org
- React: react.dev
- Node.js: nodejs.org/en/learn
- SQL/PostgreSQL: postgresql.org/docs
- MongoDB: learn.mongodb.com
- Docker: docs.docker.com
- Kubernetes: kubernetes.io/docs
- Terraform: developer.hashicorp.com/terraform
- Git: git-scm.com/doc
- Salesforce: trailhead.salesforce.com
- SAP: learning.sap.com
- ServiceNow: nowlearning.servicenow.com

OFFICIAL VIDEO CHANNELS (YouTube):
- Microsoft: youtube.com/@MicrosoftDeveloper, youtube.com/@MicrosoftAzure
- AWS: youtube.com/@amazonwebservices
- Google Cloud: youtube.com/@googlecloudtech
- Databricks: youtube.com/@Databricks
- freeCodeCamp: youtube.com/@freecodecamp
- Traversy Media: youtube.com/@TraversyMedia
- Fireship: youtube.com/@Fireship
- TechWorld with Nana: youtube.com/@TechWorldwithNana

FREE BOOKS & READING (use these official/free sources):
- O'Reilly Free Trials: oreilly.com (free trial available)
- Python: "Automate the Boring Stuff" - automatetheboringstuff.com (FREE)
- Python: "Think Python" - greenteapress.com/thinkpython (FREE)
- JavaScript: "Eloquent JavaScript" - eloquentjavascript.net (FREE)
- JavaScript: "You Don't Know JS" - github.com/getify/You-Dont-Know-JS (FREE)
- Go: "Go by Example" - gobyexample.com (FREE)
- Git: "Pro Git" - git-scm.com/book (FREE)
- Linux: "Linux Command Line" - linuxcommand.org (FREE)
- SQL: "SQL Tutorial" - sqlzoo.net (FREE)
- Data Science: "Python Data Science Handbook" - jakevdp.github.io/PythonDataScienceHandbook (FREE)
- Machine Learning: "Hands-On ML" concepts - google.com/machine-learning (FREE)
- Official Documentation PDFs and guides from vendor sites`;

    const labEnvironments = `
FREE LAB ENVIRONMENTS (MUST use these for hands-on exercises):
- Power BI: Power BI Desktop (free download) + Power BI Service (free account)
- Azure: Azure Sandbox (Microsoft Learn) or Azure Free Account ($200 credits)
- Databricks: Databricks Community Edition (FREE, unlimited)
- Snowflake: 30-day free trial with $400 credits
- AWS: AWS Free Tier (12 months) + AWS Skill Builder labs
- GCP: Google Cloud Free Tier + Qwiklabs free labs
- SQL: PostgreSQL local install, SQLite, db-fiddle.com, sqlzoo.net
- Python: Google Colab (FREE), Jupyter, replit.com, Kaggle notebooks
- Docker: Docker Desktop (free for personal), Play with Docker
- Kubernetes: minikube, kind, Play with Kubernetes (free)
- Terraform: Free CLI with any cloud free tier
- Salesforce: Salesforce Developer Edition (FREE forever)
- ServiceNow: Personal Developer Instance (FREE)
- MongoDB: MongoDB Atlas free tier (512MB)
- Tableau: Tableau Public (FREE)`;

    const prompt = `Generate a COMPREHENSIVE Learning Path (like Microsoft Learn) for: "${roleName}".
${roleDescription ? `Role Description: ${roleDescription}` : ''}
Target Difficulty: ${difficultyLevel || 'intermediate'}

${officialSources}

${labEnvironments}

Create a structured LEARNING PATH with this format:

**LEARNING PATH METADATA:**
- title: Clear learning path title
- description: 2-3 sentence overview
- total_duration_minutes: Total time to complete
- level: beginner/intermediate/advanced
- prerequisites: Array of required prior knowledge
- skills_gained: Array of skills learner will acquire
- target_roles: Array of job roles this applies to

**MODULES (4-5 modules):** Each module contains:
1. **module_name**: Clear module title (e.g., "Describe Cloud Computing")
2. **module_description**: 1-2 sentence description
3. **duration_minutes**: Total module time
4. **xp_points**: Achievement points (100-500 per module)

5. **units** array (4-6 units per module):
   Each unit has:
   - unit_title: Specific unit name
   - unit_type: "introduction" | "concept" | "tutorial" | "lab" | "assessment" | "summary"
   - duration_minutes: Time for this unit (2-15 mins)
   - content_description: Brief description of what's covered
   - content: FULL READABLE LEARNING CONTENT (100-300 words) with:
     * Clear explanations of concepts
     * Real-world examples
     * Code snippets where applicable (in markdown code blocks)
     * Key points/takeaways
     * Tips or best practices

6. **materials** array with resources:
   - DOCUMENTATION (material_type: "documentation") - Official learning resource
   - VIDEO (material_type: "video") - YouTube/platform video with duration
   - BOOK (material_type: "book") - FREE book/reading resource
   - LAB (material_type: "lab") - Hands-on exercise with:
     * Prerequisites (tools/accounts)
     * Step-by-step instructions (5-7 steps)
     * Expected outcome
     * Estimated time

7. **knowledge_check**: Object with:
   - questions_count: Number of assessment questions (3-5)
   - passing_score: Percentage to pass (e.g., 80)
   - topics_covered: Array of topics tested

CRITICAL RULES:
- Structure like Microsoft Learn learning paths
- Each module has 4-6 units with time estimates
- Include knowledge_check for each module
- Labs must use FREE environments
- All URLs from official sources only
- Return valid JSON, no markdown wrapping`;

    const systemPrompt = `You are an expert training curriculum designer creating COMPREHENSIVE learning paths like Microsoft Learn.

STRUCTURE YOUR OUTPUT LIKE MICROSOFT LEARN:
- Learning Path with metadata (title, description, duration, prerequisites)
- Modules (4-5) with units, XP points, and knowledge checks
- Each module has materials: documentation, video, book, lab

LEARNING PATH FORMAT:
{
  "learning_path": {
    "title": "Path title",
    "description": "Overview",
    "total_duration_minutes": 180,
    "level": "beginner|intermediate|advanced",
    "prerequisites": ["Prerequisite 1"],
    "skills_gained": ["Skill 1"],
    "target_roles": ["Role 1"]
  },
  "modules": [...]
}

MODULE FORMAT - Each module has:
- module_name, module_description
- duration_minutes, xp_points (100-500)
- units array with 4-6 units (intro, concepts, lab, assessment, summary)
- materials array (documentation, video, book, lab)
- knowledge_check object

UNIT TYPES (each with FULL content field):
- introduction: Opening overview (2-3 min) - Explain what learner will discover, why it matters
- concept: Theory/explanation (3-5 min) - Deep dive with examples, code snippets, diagrams description
- tutorial: Guided walkthrough (5-10 min) - Step-by-step instructions with explanations
- lab: Hands-on exercise (15-30 min) - Detailed lab with prerequisites, steps, expected outcomes
- assessment: Knowledge check (5-10 min) - Practice questions with explanations
- summary: Module recap (2-3 min) - Key takeaways, next steps

CONTENT FIELD IS CRITICAL - Each unit.content MUST contain:
- 100-300 words of actual learning material
- Markdown formatting (headers, bullets, code blocks)
- Real examples and explanations
- NOT just descriptions - actual readable educational content

LAB DESCRIPTION FORMAT:
**PREREQUISITES:** List tools/accounts
**STEPS:** 1. Step one 2. Step two...
**OUTCOME:** What to achieve
**TIME:** 30-60 mins

URL RULES: Only use official portal URLs you're certain exist.`;

    const fullPrompt = `${systemPrompt}\n\n${prompt}\n\nReturn ONLY valid JSON with this structure:
{
  "learning_path": {
    "title": "Learning Path Title",
    "description": "2-3 sentence overview",
    "total_duration_minutes": 180,
    "level": "intermediate",
    "prerequisites": ["Basic IT concepts"],
    "skills_gained": ["Skill 1", "Skill 2"],
    "target_roles": ["Developer", "Administrator"]
  },
  "modules": [
    {
      "module_name": "Module Title",
      "module_description": "Brief description",
      "duration_minutes": 45,
      "xp_points": 300,
      "units": [
        {"unit_title": "Introduction", "unit_type": "introduction", "duration_minutes": 3, "content_description": "Overview", "content": "Welcome to this module. Learning objectives and why it matters..."},
        {"unit_title": "Core Concepts", "unit_type": "concept", "duration_minutes": 8, "content_description": "Theory", "content": "Detailed explanation with examples and key points..."},
        {"unit_title": "Hands-on Lab", "unit_type": "lab", "duration_minutes": 20, "content_description": "Practice", "content": "Prerequisites, step-by-step instructions, expected outcome..."},
        {"unit_title": "Knowledge Check", "unit_type": "assessment", "duration_minutes": 5, "content_description": "Quiz", "content": "Test questions to validate understanding..."},
        {"unit_title": "Summary", "unit_type": "summary", "duration_minutes": 2, "content_description": "Recap", "content": "Key takeaways and next steps..."}
      ],
      "materials": [
        {"title": "Official Docs", "url": "https://...", "material_type": "documentation", "description": "Description"},
        {"title": "Video Tutorial", "url": "https://youtube.com/...", "material_type": "video", "description": "20 min video"},
        {"title": "Free Book", "url": "https://...", "material_type": "book", "description": "Comprehensive guide"},
        {"title": "Lab Exercise", "url": "https://...", "material_type": "lab", "description": "**PREREQUISITES:**\\n- Tool\\n\\n**STEPS:**\\n1. Step 1\\n2. Step 2\\n\\n**OUTCOME:** Result\\n\\n**TIME:** 30 mins"}
      ],
      "knowledge_check": {
        "questions_count": 5,
        "passing_score": 80,
        "topics_covered": ["Topic 1", "Topic 2"]
      }
    }
  ]
}

Generate 4-5 modules. Each module MUST have units, materials (doc, video, book, lab), and knowledge_check.`;
    
    // Use unified AI calling pattern with automatic token logging
    console.log("Generating training plan with unified AI caller");
    const content = await callAI({
      featureName: 'training_plan_generation',
      prompt: `${prompt}\n\nReturn ONLY valid JSON. No markdown, no code blocks. Start with { and end with }`,
      systemPrompt: systemPrompt,
    });
    
    console.log("Raw AI response length:", content.length);
    let trainingPlan = parseJsonSafely(content);
    
    if (!trainingPlan) {
      console.log("Failed to parse JSON from AI response");
      throw new Error("No training plan generated");
    }

    console.log("Raw training plan structure:", JSON.stringify(trainingPlan, null, 2));
    
    // Handle different possible structures from AI
    // New Microsoft Learn-style structure
    if (trainingPlan.learning_path && trainingPlan.modules) {
      console.log("Detected Microsoft Learn-style structure with learning_path and modules");
      // Convert modules to topics format for backward compatibility
      trainingPlan.topics = trainingPlan.modules.map((module: any) => ({
        topic_name: module.module_name,
        subtopic: module.module_description || '',
        difficulty_level: trainingPlan.learning_path.level || 'intermediate',
        estimated_duration: Math.round((module.duration_minutes || 60) / 60),
        materials: module.materials || [],
        // Preserve new fields
        units: module.units,
        knowledge_check: module.knowledge_check,
        xp_points: module.xp_points
      }));
      // Preserve learning_path metadata
      trainingPlan.learning_path_metadata = trainingPlan.learning_path;
    } else if (!trainingPlan.topics && trainingPlan.modules) {
      // Just modules without learning_path
      trainingPlan.topics = trainingPlan.modules.map((module: any) => ({
        topic_name: module.module_name || module.name,
        subtopic: module.module_description || module.description || '',
        difficulty_level: module.difficulty_level || 'intermediate',
        estimated_duration: Math.round((module.duration_minutes || 60) / 60),
        materials: module.materials || [],
        units: module.units,
        knowledge_check: module.knowledge_check,
        xp_points: module.xp_points
      }));
    } else if (!trainingPlan.topics && Array.isArray(trainingPlan)) {
      // AI returned array directly
      trainingPlan = { topics: trainingPlan };
    } else if (!trainingPlan.topics && trainingPlan.plan?.topics) {
      // Nested plan structure
      trainingPlan = trainingPlan.plan;
    } else if (!trainingPlan.topics && trainingPlan.training_plan) {
      // AI returned training_plan instead of topics
      trainingPlan = { topics: trainingPlan.training_plan };
    }
    
    // Normalize topic structure - merge learning_resources and lab_exercises into materials
    if (trainingPlan.topics && Array.isArray(trainingPlan.topics)) {
      trainingPlan.topics = trainingPlan.topics.map((topic: any) => {
        // If topic has learning_resources or lab_exercises instead of materials, merge them
        if (!topic.materials && (topic.learning_resources || topic.lab_exercises)) {
          const materials = [
            ...(topic.learning_resources || []),
            ...(topic.lab_exercises || [])
          ];
          return {
            ...topic,
            topic_name: topic.topic_name || topic.module_name,
            subtopic: topic.subtopic || topic.module_description,
            difficulty_level: topic.difficulty_level,
            estimated_duration: topic.estimated_duration || topic.estimated_duration_hours,
            materials
          };
        }
        return topic;
      });
    }
    
    if (!trainingPlan.topics || !Array.isArray(trainingPlan.topics) || trainingPlan.topics.length === 0) {
      console.error("Invalid training plan structure:", trainingPlan);
      throw new Error("AI returned invalid training plan structure - no topics/modules found");
    }
    
    console.log(`Training plan has ${trainingPlan.topics.length} topics/modules`);

    // Replace AI-generated URLs with stable official portal URLs
    console.log("Stabilizing URLs to use official learning portals...");
    if (trainingPlan.topics && Array.isArray(trainingPlan.topics)) {
      trainingPlan.topics = trainingPlan.topics.map(processTopicMaterials);
      
      // Log summary
      const totalMaterials = trainingPlan.topics.reduce((sum: number, t: any) => sum + (t.materials?.length || 0), 0);
      const totalUnits = trainingPlan.topics.reduce((sum: number, t: any) => sum + (t.units?.length || 0), 0);
      console.log(`URL stabilization complete. Total materials: ${totalMaterials}, Total units: ${totalUnits}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        plan: trainingPlan
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in generate-training-plan:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate training plan"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
