import React, { useState, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  FileText, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Check, 
  X, 
  RefreshCw,
  Loader2,
  Briefcase,
  Code,
  Users,
  Building,
  Target,
  Pencil,
  ChevronsUpDown,
  Search,
  Settings,
  BookTemplate,
  Save
} from 'lucide-react';
import { TemplatePickerDialog } from '@/components/TemplatePickerDialog';
import SkillAutocompleteInput from '@/components/jd-builder/SkillAutocompleteInput';
import { SaveAsTemplateDialog } from '@/components/SaveAsTemplateDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getEdgeFunctionErrorMessageAsync } from '@/lib/edgeFunctionErrors';
import { getUserFriendlyError } from '@/lib/userFriendlyErrors';
import { invokeFunction } from '@/lib/supabaseFunctions';

// Comprehensive skill categories with role-specific skills
const SKILL_CATEGORIES: Record<string, string[]> = {
  'Frontend': ['React', 'Vue.js', 'Angular', 'TypeScript', 'JavaScript', 'HTML/CSS', 'Next.js', 'Tailwind CSS', 'Redux', 'GraphQL', 'Svelte', 'Webpack', 'Vite', 'Sass/SCSS', 'Material UI', 'Storybook'],
  'Backend': ['Node.js', 'Python', 'Java', 'Go', 'C#', '.NET', 'Ruby', 'PHP', 'Rust', 'Kotlin', 'Spring Boot', 'Django', 'FastAPI', 'Express.js', 'NestJS', 'Flask'],
  'Database': ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra', 'Oracle', 'SQL Server', 'MariaDB', 'Neo4j', 'CouchDB', 'InfluxDB', 'TimescaleDB'],
  'Data Engineering': ['Snowflake', 'Databricks', 'Apache Airflow', 'dbt', 'Apache Kafka', 'Apache Spark', 'Apache Flink', 'Fivetran', 'Delta Lake', 'Apache Beam', 'Redshift', 'BigQuery', 'Presto', 'Hive', 'Dagster', 'Prefect', 'Luigi', 'AWS Glue', 'Azure Data Factory', 'Kinesis', 'Pulsar'],
  'Cloud & DevOps': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Linux', 'Ansible', 'Prometheus', 'Grafana', 'ArgoCD', 'Helm', 'CloudFormation', 'Pulumi'],
  'Mobile': ['React Native', 'Flutter', 'iOS/Swift', 'Android/Kotlin', 'Ionic', 'Xamarin', 'SwiftUI', 'Jetpack Compose', 'Expo', 'Capacitor'],
  'Data Science & AI': ['Machine Learning', 'TensorFlow', 'PyTorch', 'Data Analysis', 'Pandas', 'Scikit-learn', 'NumPy', 'Jupyter', 'R', 'Matplotlib', 'Seaborn', 'Computer Vision', 'NLP', 'Deep Learning', 'MLOps', 'Kubeflow', 'MLflow', 'Hugging Face', 'LangChain', 'OpenAI API'],
  'Security': ['OWASP', 'Penetration Testing', 'Security Auditing', 'IAM', 'OAuth/OIDC', 'Encryption', 'Vault', 'SIEM', 'SOC', 'Compliance (SOC2/HIPAA)', 'Zero Trust', 'WAF', 'Network Security'],
  'QA & Testing': ['Selenium', 'Cypress', 'Jest', 'Playwright', 'Appium', 'JUnit', 'pytest', 'TestNG', 'Postman', 'K6', 'JMeter', 'Test Automation', 'BDD/Cucumber', 'API Testing'],
  'Architecture & Design': ['System Design', 'Microservices', 'Event-Driven Architecture', 'Domain-Driven Design', 'API Design', 'CQRS', 'Saga Pattern', 'Service Mesh', 'Enterprise Architecture', 'TOGAF', 'Solution Architecture'],
  'Tools & Practices': ['Git', 'Agile/Scrum', 'REST APIs', 'Performance Optimization', 'Code Review', 'Technical Documentation', 'Jira', 'Confluence', 'Slack', 'Figma']
};

// Mapping of job titles to relevant skill categories
const JOB_SKILL_MAPPING: Record<string, string[]> = {
  // Engineering
  'Software Engineer': ['Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Frontend Developer': ['Frontend', 'Tools & Practices'],
  'Backend Developer': ['Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Full Stack Developer': ['Frontend', 'Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Mobile Developer': ['Mobile', 'Backend', 'Tools & Practices'],
  'iOS Developer': ['Mobile', 'Tools & Practices'],
  'Android Developer': ['Mobile', 'Tools & Practices'],
  'React Developer': ['Frontend', 'Tools & Practices'],
  'Node.js Developer': ['Backend', 'Database', 'Tools & Practices'],
  'Python Developer': ['Backend', 'Database', 'Data Science & AI', 'Tools & Practices'],
  'Java Developer': ['Backend', 'Database', 'Tools & Practices'],
  'Go Developer': ['Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Rust Developer': ['Backend', 'Tools & Practices'],
  '.NET Developer': ['Backend', 'Database', 'Tools & Practices'],
  'Ruby on Rails Developer': ['Backend', 'Database', 'Frontend', 'Tools & Practices'],
  'PHP Developer': ['Backend', 'Database', 'Frontend', 'Tools & Practices'],
  'Embedded Systems Engineer': ['Backend', 'Tools & Practices'],
  'Firmware Engineer': ['Backend', 'Tools & Practices'],
  'Game Developer': ['Frontend', 'Backend', 'Tools & Practices'],
  
  // Data & AI
  'Data Engineer': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'AWS Data Engineer': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Azure Data Engineer': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'GCP Data Engineer': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Snowflake Data Engineer': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Databricks Data Engineer': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Data Science & AI', 'Tools & Practices'],
  'ETL Developer': ['Data Engineering', 'Database', 'Backend', 'Tools & Practices'],
  'Data Pipeline Engineer': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Analytics Engineer': ['Data Engineering', 'Database', 'Tools & Practices'],
  'Data Scientist': ['Data Science & AI', 'Data Engineering', 'Database', 'Tools & Practices'],
  'Machine Learning Engineer': ['Data Science & AI', 'Data Engineering', 'Cloud & DevOps', 'Backend', 'Tools & Practices'],
  'AI Engineer': ['Data Science & AI', 'Backend', 'Cloud & DevOps', 'Tools & Practices'],
  'LLM Engineer': ['Data Science & AI', 'Backend', 'Cloud & DevOps', 'Tools & Practices'],
  'Prompt Engineer': ['Data Science & AI', 'Tools & Practices'],
  'Data Analyst': ['Data Science & AI', 'Database', 'Tools & Practices'],
  'Business Intelligence Analyst': ['Data Engineering', 'Database', 'Tools & Practices'],
  'BI Developer': ['Data Engineering', 'Database', 'Tools & Practices'],
  'NLP Engineer': ['Data Science & AI', 'Backend', 'Tools & Practices'],
  'Computer Vision Engineer': ['Data Science & AI', 'Backend', 'Tools & Practices'],
  'MLOps Engineer': ['Data Science & AI', 'Cloud & DevOps', 'Data Engineering', 'Tools & Practices'],
  'AI Research Scientist': ['Data Science & AI', 'Tools & Practices'],
  
  // DevOps & Infrastructure
  'DevOps Engineer': ['Cloud & DevOps', 'Backend', 'Database', 'Tools & Practices'],
  'Site Reliability Engineer': ['Cloud & DevOps', 'Backend', 'Database', 'Tools & Practices'],
  'Platform Engineer': ['Cloud & DevOps', 'Backend', 'Database', 'Tools & Practices'],
  'Cloud Engineer': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
  'Infrastructure Engineer': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
  'Systems Administrator': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
  'Network Engineer': ['Cloud & DevOps', 'Security', 'Tools & Practices'],
  'Database Administrator': ['Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Release Engineer': ['Cloud & DevOps', 'Tools & Practices'],
  'Build Engineer': ['Cloud & DevOps', 'Tools & Practices'],
  
  // Security
  'Security Engineer': ['Security', 'Cloud & DevOps', 'Backend', 'Tools & Practices'],
  'Cybersecurity Analyst': ['Security', 'Cloud & DevOps', 'Tools & Practices'],
  'Penetration Tester': ['Security', 'Backend', 'Tools & Practices'],
  'Security Architect': ['Security', 'Architecture & Design', 'Cloud & DevOps', 'Tools & Practices'],
  'Application Security Engineer': ['Security', 'Backend', 'Frontend', 'Tools & Practices'],
  'Security Operations Engineer': ['Security', 'Cloud & DevOps', 'Tools & Practices'],
  'Cloud Security Engineer': ['Security', 'Cloud & DevOps', 'Tools & Practices'],
  
  // QA
  'QA Engineer': ['QA & Testing', 'Tools & Practices'],
  'QA Automation Engineer': ['QA & Testing', 'Backend', 'Frontend', 'Tools & Practices'],
  'SDET': ['QA & Testing', 'Backend', 'Frontend', 'Tools & Practices'],
  'Performance Test Engineer': ['QA & Testing', 'Cloud & DevOps', 'Tools & Practices'],
  'QA Lead': ['QA & Testing', 'Tools & Practices'],
  'Test Architect': ['QA & Testing', 'Architecture & Design', 'Tools & Practices'],
  
  // Leadership & Architecture - Show all categories for broad roles
  'Tech Lead': ['Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Architecture & Design', 'Tools & Practices'],
  'Engineering Manager': ['Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Architecture & Design', 'Tools & Practices'],
  'VP of Engineering': ['Architecture & Design', 'Cloud & DevOps', 'Tools & Practices'],
  'CTO': ['Architecture & Design', 'Cloud & DevOps', 'Tools & Practices'],
  'Solutions Architect': ['Architecture & Design', 'Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Data Engineering', 'Security', 'Tools & Practices'],
  'Enterprise Architect': ['Architecture & Design', 'Cloud & DevOps', 'Security', 'Tools & Practices'],
  'Cloud Architect': ['Cloud & DevOps', 'Architecture & Design', 'Security', 'Tools & Practices'],
  'System Architect': ['Architecture & Design', 'Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Data Architect': ['Data Engineering', 'Database', 'Architecture & Design', 'Cloud & DevOps', 'Tools & Practices'],
  'Software Architect': ['Architecture & Design', 'Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Principal Engineer': ['Architecture & Design', 'Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Staff Engineer': ['Architecture & Design', 'Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Distinguished Engineer': ['Architecture & Design', 'Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Technical Director': ['Architecture & Design', 'Cloud & DevOps', 'Tools & Practices'],
  'Director of Engineering': ['Architecture & Design', 'Cloud & DevOps', 'Tools & Practices'],
  
  // Product & Design
  'Product Manager': ['Tools & Practices'],
  'Technical Product Manager': ['Backend', 'Frontend', 'Architecture & Design', 'Tools & Practices'],
  'UX Designer': ['Frontend', 'Tools & Practices'],
  'UI Designer': ['Frontend', 'Tools & Practices'],
  'UX Researcher': ['Tools & Practices'],
  'Design Lead': ['Frontend', 'Tools & Practices'],
  
  // Specialized
  'Blockchain Developer': ['Backend', 'Security', 'Tools & Practices'],
  'Smart Contract Developer': ['Backend', 'Security', 'Tools & Practices'],
  'Web3 Developer': ['Backend', 'Frontend', 'Security', 'Tools & Practices'],
  'AR/VR Developer': ['Frontend', 'Mobile', 'Tools & Practices'],
  'Graphics Programmer': ['Frontend', 'Backend', 'Tools & Practices'],
  'Compiler Engineer': ['Backend', 'Tools & Practices'],
  'Robotics Engineer': ['Backend', 'Data Science & AI', 'Tools & Practices'],
  'IoT Engineer': ['Backend', 'Cloud & DevOps', 'Mobile', 'Tools & Practices'],
  
  // Other
  'Technical Writer': ['Tools & Practices'],
  'Developer Advocate': ['Backend', 'Frontend', 'Cloud & DevOps', 'Tools & Practices'],
  'Solutions Engineer': ['Backend', 'Frontend', 'Cloud & DevOps', 'Architecture & Design', 'Tools & Practices'],
  'Integration Engineer': ['Backend', 'Cloud & DevOps', 'Tools & Practices'],
  'Support Engineer': ['Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
  'Other': Object.keys(SKILL_CATEGORIES) // Show all categories for "Other"
};

// Role-based responsibility templates
const RESPONSIBILITY_TEMPLATES: Record<string, string[]> = {
  'Software Engineer': [
    'Design and implement scalable software solutions',
    'Write clean, maintainable, and well-tested code',
    'Participate in code reviews and provide constructive feedback',
    'Collaborate with cross-functional teams to define requirements',
    'Debug and resolve production issues',
    'Document technical specifications and architecture decisions',
    'Optimize application performance and scalability'
  ],
  'Frontend Developer': [
    'Build responsive and accessible user interfaces',
    'Implement pixel-perfect designs from mockups',
    'Optimize frontend performance and load times',
    'Write unit and integration tests for UI components',
    'Collaborate with designers and backend developers',
    'Maintain and improve existing frontend codebase',
    'Stay updated with latest frontend technologies'
  ],
  'Backend Developer': [
    'Design and develop RESTful APIs and microservices',
    'Implement database schemas and optimize queries',
    'Build secure and scalable backend systems',
    'Write comprehensive API documentation',
    'Implement caching strategies and performance optimizations',
    'Monitor and troubleshoot production systems',
    'Collaborate on system architecture decisions'
  ],
  'Full Stack Developer': [
    'Develop end-to-end features across frontend and backend',
    'Design database schemas and API contracts',
    'Build responsive user interfaces with modern frameworks',
    'Implement authentication and authorization systems',
    'Deploy and maintain applications in cloud environments',
    'Write tests across the full stack',
    'Participate in architectural discussions and decisions'
  ],
  'DevOps Engineer': [
    'Design and maintain CI/CD pipelines',
    'Manage cloud infrastructure using IaC tools',
    'Monitor system performance and reliability',
    'Implement security best practices and compliance',
    'Automate deployment and operational processes',
    'Troubleshoot infrastructure and deployment issues',
    'Collaborate with development teams on deployment strategies'
  ],
  'Data Engineer': [
    'Design and build data pipelines and ETL processes',
    'Manage data warehouses and data lakes',
    'Optimize data storage and query performance',
    'Implement data quality and governance practices',
    'Collaborate with data scientists and analysts',
    'Monitor and maintain data infrastructure',
    'Document data models and pipeline architecture'
  ],
  'Tech Lead': [
    'Lead technical architecture and design decisions',
    'Mentor and guide team members on best practices',
    'Conduct code reviews and ensure code quality',
    'Coordinate with stakeholders on technical requirements',
    'Drive technical roadmap and prioritization',
    'Identify and mitigate technical risks',
    'Foster a culture of continuous improvement'
  ],
  'Other': [
    'Develop and maintain software applications',
    'Collaborate with team members and stakeholders',
    'Participate in agile ceremonies and planning',
    'Write documentation and technical specifications',
    'Troubleshoot and resolve technical issues'
  ]
};

// Comprehensive job titles organized by category
const JOB_TITLES_BY_CATEGORY: Record<string, { title: string; minLevel: string }[]> = {
  'Engineering': [
    { title: 'Software Engineer', minLevel: 'intern' },
    { title: 'Frontend Developer', minLevel: 'intern' },
    { title: 'Backend Developer', minLevel: 'intern' },
    { title: 'Full Stack Developer', minLevel: 'intern' },
    { title: 'Mobile Developer', minLevel: 'intern' },
    { title: 'iOS Developer', minLevel: 'intern' },
    { title: 'Android Developer', minLevel: 'intern' },
    { title: 'React Developer', minLevel: 'intern' },
    { title: 'Node.js Developer', minLevel: 'intern' },
    { title: 'Python Developer', minLevel: 'intern' },
    { title: 'Java Developer', minLevel: 'intern' },
    { title: 'Go Developer', minLevel: 'intern' },
    { title: 'Rust Developer', minLevel: 'intern' },
    { title: '.NET Developer', minLevel: 'intern' },
    { title: 'Ruby on Rails Developer', minLevel: 'intern' },
    { title: 'PHP Developer', minLevel: 'intern' },
    { title: 'Embedded Systems Engineer', minLevel: 'junior' },
    { title: 'Firmware Engineer', minLevel: 'junior' },
    { title: 'Game Developer', minLevel: 'intern' },
  ],
  'Data & AI': [
    { title: 'Data Engineer', minLevel: 'junior' },
    { title: 'AWS Data Engineer', minLevel: 'junior' },
    { title: 'Azure Data Engineer', minLevel: 'junior' },
    { title: 'GCP Data Engineer', minLevel: 'junior' },
    { title: 'Snowflake Data Engineer', minLevel: 'junior' },
    { title: 'Databricks Data Engineer', minLevel: 'mid' },
    { title: 'ETL Developer', minLevel: 'junior' },
    { title: 'Data Pipeline Engineer', minLevel: 'mid' },
    { title: 'Analytics Engineer', minLevel: 'junior' },
    { title: 'Data Scientist', minLevel: 'junior' },
    { title: 'Machine Learning Engineer', minLevel: 'mid' },
    { title: 'AI Engineer', minLevel: 'mid' },
    { title: 'LLM Engineer', minLevel: 'mid' },
    { title: 'Prompt Engineer', minLevel: 'junior' },
    { title: 'Data Analyst', minLevel: 'intern' },
    { title: 'Business Intelligence Analyst', minLevel: 'junior' },
    { title: 'BI Developer', minLevel: 'junior' },
    { title: 'NLP Engineer', minLevel: 'mid' },
    { title: 'Computer Vision Engineer', minLevel: 'mid' },
    { title: 'MLOps Engineer', minLevel: 'mid' },
    { title: 'AI Research Scientist', minLevel: 'senior' },
  ],
  'DevOps & Infrastructure': [
    { title: 'DevOps Engineer', minLevel: 'junior' },
    { title: 'Site Reliability Engineer', minLevel: 'mid' },
    { title: 'Platform Engineer', minLevel: 'mid' },
    { title: 'Cloud Engineer', minLevel: 'junior' },
    { title: 'Infrastructure Engineer', minLevel: 'junior' },
    { title: 'Systems Administrator', minLevel: 'junior' },
    { title: 'Network Engineer', minLevel: 'junior' },
    { title: 'Database Administrator', minLevel: 'mid' },
    { title: 'Release Engineer', minLevel: 'junior' },
    { title: 'Build Engineer', minLevel: 'junior' },
  ],
  'Security': [
    { title: 'Security Engineer', minLevel: 'mid' },
    { title: 'Cybersecurity Analyst', minLevel: 'junior' },
    { title: 'Penetration Tester', minLevel: 'mid' },
    { title: 'Security Architect', minLevel: 'senior' },
    { title: 'Application Security Engineer', minLevel: 'mid' },
    { title: 'Security Operations Engineer', minLevel: 'mid' },
    { title: 'Cloud Security Engineer', minLevel: 'mid' },
  ],
  'Quality Assurance': [
    { title: 'QA Engineer', minLevel: 'intern' },
    { title: 'QA Automation Engineer', minLevel: 'junior' },
    { title: 'SDET', minLevel: 'junior' },
    { title: 'Performance Test Engineer', minLevel: 'mid' },
    { title: 'QA Lead', minLevel: 'senior' },
    { title: 'Test Architect', minLevel: 'senior' },
  ],
  'Leadership & Architecture': [
    { title: 'Tech Lead', minLevel: 'senior' },
    { title: 'Engineering Manager', minLevel: 'senior' },
    { title: 'VP of Engineering', minLevel: 'principal' },
    { title: 'CTO', minLevel: 'principal' },
    { title: 'Solutions Architect', minLevel: 'senior' },
    { title: 'Enterprise Architect', minLevel: 'lead' },
    { title: 'Cloud Architect', minLevel: 'senior' },
    { title: 'System Architect', minLevel: 'senior' },
    { title: 'Data Architect', minLevel: 'senior' },
    { title: 'Software Architect', minLevel: 'senior' },
    { title: 'Principal Engineer', minLevel: 'principal' },
    { title: 'Staff Engineer', minLevel: 'lead' },
    { title: 'Distinguished Engineer', minLevel: 'principal' },
    { title: 'Technical Director', minLevel: 'lead' },
    { title: 'Director of Engineering', minLevel: 'lead' },
  ],
  'Product & Design': [
    { title: 'Product Manager', minLevel: 'mid' },
    { title: 'Technical Product Manager', minLevel: 'mid' },
    { title: 'UX Designer', minLevel: 'intern' },
    { title: 'UI Designer', minLevel: 'intern' },
    { title: 'UX Researcher', minLevel: 'junior' },
    { title: 'Design Lead', minLevel: 'senior' },
  ],
  'Specialized': [
    { title: 'Blockchain Developer', minLevel: 'mid' },
    { title: 'Smart Contract Developer', minLevel: 'mid' },
    { title: 'Web3 Developer', minLevel: 'mid' },
    { title: 'AR/VR Developer', minLevel: 'mid' },
    { title: 'Graphics Programmer', minLevel: 'mid' },
    { title: 'Compiler Engineer', minLevel: 'senior' },
    { title: 'Robotics Engineer', minLevel: 'mid' },
    { title: 'IoT Engineer', minLevel: 'junior' },
  ],
  'Other': [
    { title: 'Technical Writer', minLevel: 'junior' },
    { title: 'Developer Advocate', minLevel: 'mid' },
    { title: 'Solutions Engineer', minLevel: 'mid' },
    { title: 'Integration Engineer', minLevel: 'junior' },
    { title: 'Support Engineer', minLevel: 'intern' },
    { title: 'Other', minLevel: 'intern' },
  ]
};

// Flatten job titles for search
const ALL_JOB_TITLES = Object.entries(JOB_TITLES_BY_CATEGORY).flatMap(([category, titles]) =>
  titles.map(t => ({ ...t, category }))
);

// Experience level order for filtering
const EXPERIENCE_LEVEL_ORDER = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal'];

// Experience levels
const EXPERIENCE_LEVELS = [
  { value: 'intern', label: 'Intern (0-1 years)' },
  { value: 'junior', label: 'Junior (1-3 years)' },
  { value: 'mid', label: 'Mid-Level (3-5 years)' },
  { value: 'senior', label: 'Senior (5-8 years)' },
  { value: 'lead', label: 'Lead/Staff (8-12 years)' },
  { value: 'principal', label: 'Principal/Architect (12+ years)' }
];

// Industries
const INDUSTRIES = [
  'Technology/SaaS', 'Fintech', 'Banking & Financial Services', 'Insurance', 
  'Healthcare', 'Pharmaceuticals', 'E-commerce', 'Retail', 'EdTech', 
  'Gaming', 'Media/Entertainment', 'Enterprise Software', 'Startup', 'Consulting',
  'Telecommunications', 'Manufacturing', 'Automotive', 'Aerospace & Defense',
  'Logistics & Supply Chain', 'Real Estate', 'Travel & Hospitality', 
  'Energy & Utilities', 'Government/Public Sector', 'Non-Profit', 'Other'
];

// Work environments
const WORK_ENVIRONMENTS = [
  { value: 'remote', label: 'Fully Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' }
];

// Team structures
const TEAM_STRUCTURES = [
  { value: 'solo', label: 'Individual Contributor' },
  { value: 'small', label: 'Small Team (2-5)' },
  { value: 'medium', label: 'Medium Team (6-15)' },
  { value: 'large', label: 'Large Team (15+)' },
  { value: 'lead', label: 'Team Lead / Manager' }
];

// Soft skills
const SOFT_SKILLS = [
  'Communication', 'Problem Solving', 'Leadership', 'Teamwork', 
  'Time Management', 'Adaptability', 'Critical Thinking', 'Creativity',
  'Attention to Detail', 'Mentoring'
];

// Common challenges
const COMMON_CHALLENGES = [
  'High-traffic/scalable systems',
  'Legacy code modernization',
  'Greenfield development',
  'Real-time data processing',
  'Security-critical applications',
  'Multi-tenant architecture',
  'International/multi-region deployment',
  'Strict compliance requirements (HIPAA, PCI, etc.)',
  'Rapid iteration and deployment',
  'Cross-functional collaboration'
];

type WizardStep = 'decision' | 'paste_jd' | 'basic' | 'skills' | 'responsibilities' | 'additional' | 'preview';

interface JDFormData {
  jobTitle: string;
  customJobTitle: string;
  experienceLevel: string;
  industry: string;
  primaryCloud: string;
  primaryLanguage: string;
  clientKeywords: string;
  primarySkills: string[];
  secondarySkills: string[];
  responsibilities: string[];
  workEnvironment: string;
  teamStructure: string;
  softSkills: string[];
  challenges: string[];
  customChallenge: string;
}

interface AISuggestions {
  primarySkills: string[];
  secondarySkills: string[];
  responsibilities: string[];
  challenges: string[];
  preSelectedChallenges: string[];
  inferredContext?: {
    cloud?: string;
    primaryLanguage?: string;
    domain?: string;
  };
}

const JDBuilderWizard: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [step, setStep] = useState<WizardStep>('decision');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedJD, setGeneratedJD] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedJD, setEditedJD] = useState('');
  const [isLoadingAISuggestions, setIsLoadingAISuggestions] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<AISuggestions | null>(null);
  const [formData, setFormData] = useState<JDFormData>({
    jobTitle: '',
    customJobTitle: '',
    experienceLevel: '',
    industry: '',
    primaryCloud: '',
    primaryLanguage: '',
    clientKeywords: '',
    primarySkills: [],
    secondarySkills: [],
    responsibilities: [],
    workEnvironment: '',
    teamStructure: '',
    softSkills: [],
    challenges: [],
    customChallenge: ''
  });

  // State for paste JD flow
  const [pastedJD, setPastedJD] = useState('');
  const [pastedJobTitle, setPastedJobTitle] = useState('');
  const [isEnhancingJD, setIsEnhancingJD] = useState(false);

  // Enhance JD with AI
  const handleEnhanceJD = async () => {
    if (!pastedJD.trim()) {
      toast.error('Please enter a job description first');
      return;
    }

    setIsEnhancingJD(true);
    try {
      const { data, error } = await invokeFunction('enhance-job-description', {
        body: { 
          jobDescription: pastedJD,
          jobTitle: pastedJobTitle || undefined
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.enhancedDescription) {
        setPastedJD(data.enhancedDescription);
        toast.success('Job description enhanced successfully!');
      }
    } catch (error: any) {
      logger.error('Error enhancing JD:', error);
      toast.error(error.message || 'Failed to enhance job description');
    } finally {
      setIsEnhancingJD(false);
    }
  };

  // Fetch AI suggestions for skills
  const fetchAISkillSuggestions = async () => {
    const jobTitle = getEffectiveJobTitle();
    if (!jobTitle || !formData.experienceLevel || !formData.industry) return;
    
    setIsLoadingAISuggestions(true);
    try {
      // Parse client keywords to pre-populate as primary skills
      const clientKeywordSkills = formData.clientKeywords
        ? formData.clientKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
        : [];

      const { data, error } = await invokeFunction('suggest-jd-content', {
        body: {
          type: 'skills',
          jobTitle,
          experienceLevel: formData.experienceLevel,
          industry: formData.industry,
          primaryCloud: formData.primaryCloud || undefined,
          primaryLanguage: formData.primaryLanguage || undefined,
          clientKeywords: formData.clientKeywords || undefined
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAISuggestions(prev => ({
        ...prev,
        primarySkills: data.primarySkills || [],
        secondarySkills: data.secondarySkills || [],
        inferredContext: data.inferredContext,
        responsibilities: prev?.responsibilities || [],
        challenges: prev?.challenges || [],
        preSelectedChallenges: prev?.preSelectedChallenges || []
      }));

      // Pre-populate with client keywords first, then add AI suggestions
      const aiPrimary = data.primarySkills?.slice(0, 6) || [];
      const combinedPrimary = [
        ...clientKeywordSkills,
        ...aiPrimary.filter((s: string) => !clientKeywordSkills.some(k => k.toLowerCase() === s.toLowerCase()))
      ].slice(0, 8); // Cap at 8 primary skills
      
      setFormData(prev => ({
        ...prev,
        primarySkills: combinedPrimary,
        secondarySkills: data.secondarySkills?.slice(0, 4) || []
      }));

      toast.success('AI suggestions loaded! Review and adjust as needed.');
    } catch (error: any) {
      logger.error('Error fetching AI suggestions:', error);
      toast.error('Failed to load AI suggestions. Using default skills.');
    } finally {
      setIsLoadingAISuggestions(false);
    }
  };

  // Fetch AI suggestions for responsibilities
  const fetchAIResponsibilitySuggestions = async () => {
    const jobTitle = getEffectiveJobTitle();
    if (!jobTitle) return;
    
    setIsLoadingAISuggestions(true);
    try {
      const { data, error } = await invokeFunction('suggest-jd-content', {
        body: {
          type: 'responsibilities',
          jobTitle,
          experienceLevel: formData.experienceLevel,
          industry: formData.industry,
          selectedSkills: [...formData.primarySkills, ...formData.secondarySkills]
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAISuggestions(prev => ({
        ...prev,
        primarySkills: prev?.primarySkills || [],
        secondarySkills: prev?.secondarySkills || [],
        responsibilities: data.responsibilities || [],
        challenges: prev?.challenges || [],
        preSelectedChallenges: prev?.preSelectedChallenges || []
      }));

      // Auto-select first 4 responsibilities
      setFormData(prev => ({
        ...prev,
        responsibilities: data.responsibilities?.slice(0, 4) || []
      }));

    } catch (error: any) {
      logger.error('Error fetching responsibility suggestions:', error);
    } finally {
      setIsLoadingAISuggestions(false);
    }
  };

  // Fetch AI suggestions for challenges
  const fetchAIChallengeSuggestions = async () => {
    const jobTitle = getEffectiveJobTitle();
    if (!jobTitle) return;
    
    try {
      const { data, error } = await invokeFunction('suggest-jd-content', {
        body: {
          type: 'challenges',
          jobTitle,
          experienceLevel: formData.experienceLevel,
          industry: formData.industry,
          selectedSkills: [...formData.primarySkills, ...formData.secondarySkills]
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAISuggestions(prev => ({
        ...prev,
        primarySkills: prev?.primarySkills || [],
        secondarySkills: prev?.secondarySkills || [],
        responsibilities: prev?.responsibilities || [],
        challenges: data.challenges || [],
        preSelectedChallenges: data.preSelected || []
      }));

      // Auto-select pre-selected challenges
      if (data.preSelected?.length > 0) {
        setFormData(prev => ({
          ...prev,
          challenges: data.preSelected
        }));
      }

    } catch (error: any) {
      logger.error('Error fetching challenge suggestions:', error);
    }
  };

  const handleSkillToggle = (skill: string, isPrimary: boolean) => {
    const field = isPrimary ? 'primarySkills' : 'secondarySkills';
    const otherField = isPrimary ? 'secondarySkills' : 'primarySkills';
    
    setFormData(prev => {
      const currentList = prev[field];
      const otherList = prev[otherField];
      
      if (currentList.includes(skill)) {
        return { ...prev, [field]: currentList.filter(s => s !== skill) };
      } else {
        // Remove from other list if present
        return {
          ...prev,
          [field]: [...currentList, skill],
          [otherField]: otherList.filter(s => s !== skill)
        };
      }
    });
  };

  const handleResponsibilityToggle = (responsibility: string) => {
    setFormData(prev => ({
      ...prev,
      responsibilities: prev.responsibilities.includes(responsibility)
        ? prev.responsibilities.filter(r => r !== responsibility)
        : [...prev.responsibilities, responsibility]
    }));
  };

  const handleSoftSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      softSkills: prev.softSkills.includes(skill)
        ? prev.softSkills.filter(s => s !== skill)
        : [...prev.softSkills, skill]
    }));
  };

  const handleChallengeToggle = (challenge: string) => {
    setFormData(prev => ({
      ...prev,
      challenges: prev.challenges.includes(challenge)
        ? prev.challenges.filter(c => c !== challenge)
        : [...prev.challenges, challenge]
    }));
  };

  const getEffectiveJobTitle = () => {
    return formData.jobTitle === 'Other' ? formData.customJobTitle : formData.jobTitle;
  };

  const getResponsibilityOptions = () => {
    const title = getEffectiveJobTitle();
    // Try to match with predefined templates
    for (const [key, responsibilities] of Object.entries(RESPONSIBILITY_TEMPLATES)) {
      if (title.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(title.toLowerCase())) {
        return responsibilities;
      }
    }
    // Default to generic if no match
    return RESPONSIBILITY_TEMPLATES['Software Engineer'];
  };

  const canProceedFromStep = (currentStep: WizardStep): boolean => {
    switch (currentStep) {
      case 'basic':
        return !!(getEffectiveJobTitle() && formData.experienceLevel && formData.industry);
      case 'skills':
        return formData.primarySkills.length >= 2;
      case 'responsibilities':
        return formData.responsibilities.length >= 3;
      case 'additional':
        return true; // Optional fields
      default:
        return true;
    }
  };

  const generateJD = async () => {
    setIsGenerating(true);

    try {
      const { data, error } = await invokeFunction('generate-job-description', {
        body: {
          jobTitle: getEffectiveJobTitle(),
          experienceLevel: formData.experienceLevel,
          industry: formData.industry,
          requiredSkills: formData.primarySkills,
          niceToHaveSkills: formData.secondarySkills,
          responsibilities: formData.responsibilities,
          workEnvironment: formData.workEnvironment,
          teamStructure: formData.teamStructure,
          softSkills: formData.softSkills,
          challenges: formData.challenges.concat(formData.customChallenge ? [formData.customChallenge] : [])
        }
      });

      if (error) {
        // Check for auth errors
        if (error.name === 'AuthError') {
          toast.error(getUserFriendlyError('AUTH_SESSION_EXPIRED'));
          navigate('/auth');
          return;
        }
        throw error;
      }

      setGeneratedJD(data.jobDescription);
      setEditedJD(data.jobDescription);
      setStep('preview');
    } catch (error: any) {
      logger.error('Error generating JD:', error);

      const raw = await getEdgeFunctionErrorMessageAsync(error, 'Failed to generate job description.');
      const lower = raw.toLowerCase();
      const message = (lower.includes('missing authorization') || lower.includes('authorization header'))
        ? getUserFriendlyError('AUTH_SESSION_EXPIRED')
        : getUserFriendlyError(raw, raw);

      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Detect skill domain from selected skills
  const detectSkillDomain = (): { skillDomain: string; showCoding: boolean; showDbSchema: boolean } => {
    const skills = [...formData.primarySkills, ...formData.secondarySkills];
    const skillsLower = skills.map(s => s.toLowerCase());
    
    const domainRules = {
      database: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'oracle', 'sql server', 'sql'],
      backend: ['node.js', 'python', 'java', 'go', 'c#', '.net', 'ruby', 'php', 'rust', 'kotlin'],
      frontend: ['react', 'vue', 'angular', 'html', 'css', 'javascript', 'typescript', 'next.js', 'tailwind', 'redux'],
      devops: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins', 'github actions', 'linux'],
      mobile: ['react native', 'flutter', 'ios', 'swift', 'android', 'kotlin', 'ionic', 'xamarin'],
      data_science: ['machine learning', 'tensorflow', 'pytorch', 'data analysis', 'pandas', 'scikit-learn', 'spark']
    };

    const scores: Record<string, number> = { database: 0, backend: 0, frontend: 0, devops: 0, mobile: 0, data_science: 0 };
    
    for (const [domain, keywords] of Object.entries(domainRules)) {
      for (const keyword of keywords) {
        if (skillsLower.some(s => s.includes(keyword) || keyword.includes(s))) {
          scores[domain]++;
        }
      }
    }

    let primaryDomain = 'backend';
    let maxScore = 0;
    for (const [domain, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryDomain = domain;
      }
    }

    // Check for fullstack
    if (scores.frontend >= 2 && scores.backend >= 2) {
      primaryDomain = 'fullstack';
    }

    // Non-technical check
    const jobTitle = getEffectiveJobTitle().toLowerCase();
    const nonTechTitles = ['hr', 'marketing', 'sales', 'finance', 'operations', 'customer', 'business', 'manager', 'admin'];
    if (nonTechTitles.some(t => jobTitle.includes(t)) && maxScore < 2) {
      primaryDomain = 'non_technical';
    }

    const showCoding = !['non_technical'].includes(primaryDomain);
    const showDbSchema = ['database', 'fullstack', 'data_science'].includes(primaryDomain);

    return { skillDomain: primaryDomain, showCoding, showDbSchema };
  };

  const getNavigationState = () => {
    const finalJD = isEditing ? editedJD : generatedJD;
    const domainInfo = detectSkillDomain();
    
    // Collect selected skills for auto-population
    const allSelectedSkills = [
      ...formData.primarySkills,
      ...formData.secondarySkills
    ];
    
    return {
      jobDescription: finalJD,
      jobTitle: getEffectiveJobTitle(),
      skillDomain: domainInfo.skillDomain,
      showCoding: domainInfo.showCoding,
      showDbSchema: domainInfo.showDbSchema,
      fromBuilder: true,
      experienceLevel: formData.experienceLevel,
      selectedSkills: allSelectedSkills,
      // Pass client context for interview creation
      clientKeywords: formData.clientKeywords,
      primaryCloud: formData.primaryCloud,
      industry: formData.industry
    };
  };

  const handleQuickCreate = () => {
    navigate('/partner/recruiting/quick-create', { state: getNavigationState() });
  };

  const handleCustomize = () => {
    navigate('/partner/recruiting/create-interview', { state: getNavigationState() });
  };

  const handleHasJD = () => {
    setStep('paste_jd');
  };

  // Get navigation state for pasted JD flow
  const getPastedJDNavigationState = () => {
    return {
      jobDescription: pastedJD,
      jobTitle: pastedJobTitle,
      fromBuilder: true,
      // These will be extracted by extract-skills in QuickCreatePreview
      skillDomain: undefined,
      showCoding: undefined,
      showDbSchema: undefined
    };
  };

  const handlePastedQuickCreate = () => {
    navigate('/partner/recruiting/quick-create', { state: getPastedJDNavigationState() });
  };

  const handlePastedCustomize = () => {
    navigate('/partner/recruiting/create-interview', { state: getPastedJDNavigationState() });
  };

  const renderPasteJDStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-xl font-semibold">Paste Your Job Description</h2>
        <p className="text-muted-foreground">
          We'll analyze your JD to suggest optimal interview settings
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job Title *</Label>
          <Input
            id="jobTitle"
            placeholder="e.g., Senior Software Engineer"
            value={pastedJobTitle}
            onChange={(e) => setPastedJobTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pastedJD">Job Description *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEnhanceJD}
              disabled={isEnhancingJD || !pastedJD.trim()}
              className="gap-2"
            >
              {isEnhancingJD ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Enhance with AI
                </>
              )}
            </Button>
          </div>
          <Textarea
            id="pastedJD"
            placeholder="Paste your complete job description here..."
            value={pastedJD}
            onChange={(e) => setPastedJD(e.target.value)}
            className="min-h-[300px]"
          />
        </div>
      </div>
    </div>
  );

  const renderDecisionStep = () => (
    <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] space-y-6 sm:space-y-8 px-2">
      <div className="text-center space-y-3 sm:space-y-4">
        <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-primary mx-auto" />
        <h2 className="text-xl sm:text-2xl font-bold">Create Interview</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md">
          Choose how you'd like to create your interview
        </p>
      </div>
      
      <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-md">
        <Button 
          size="lg" 
          onClick={handleHasJD}
          className="min-h-[52px] justify-start px-6"
          variant="outline"
        >
          <Check className="h-5 w-5 mr-3 shrink-0" />
          <div className="text-left">
            <div className="font-medium">I have a Job Description</div>
            <div className="text-xs text-muted-foreground font-normal">Paste existing JD to generate questions</div>
          </div>
        </Button>
        
        <Button 
          size="lg" 
          onClick={() => setStep('basic')}
          className="min-h-[52px] justify-start px-6"
          variant="outline"
        >
          <Sparkles className="h-5 w-5 mr-3 shrink-0" />
          <div className="text-left">
            <div className="font-medium">Build from Scratch</div>
            <div className="text-xs text-muted-foreground font-normal">AI-guided wizard to create JD and interview</div>
          </div>
        </Button>
        
        <TemplatePickerDialog
          trigger={
            <Button 
              size="lg" 
              className="min-h-[52px] justify-start px-6"
            >
              <BookTemplate className="h-5 w-5 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Start from Template</div>
                <div className="text-xs opacity-80 font-normal">Use pre-configured interview settings</div>
              </div>
            </Button>
          }
        />
      </div>
    </div>
  );

  const [jobTitleOpen, setJobTitleOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  
  // Template save state - tracks if JD config has been saved
  const [savedJDConfigSnapshot, setSavedJDConfigSnapshot] = useState<string | null>(null);
  
  // Create config snapshot for JD builder
  const currentJDConfigSnapshot = JSON.stringify({
    jobTitle: getEffectiveJobTitle(),
    experienceLevel: formData.experienceLevel,
    primarySkills: formData.primarySkills.slice(0, 5),
  });
  
  // Check if template save should be disabled
  const isJDTemplateSaveDisabled = !getEffectiveJobTitle() || (savedJDConfigSnapshot !== null && savedJDConfigSnapshot === currentJDConfigSnapshot);
  
  // Handler for when JD template is saved
  const handleJDTemplateSaved = () => {
    setSavedJDConfigSnapshot(currentJDConfigSnapshot);
  };

  // Get minimum experience level for selected job title
  const getMinExperienceLevel = (): string => {
    if (!formData.jobTitle || formData.jobTitle === 'Other') return 'intern';
    const jobInfo = ALL_JOB_TITLES.find(j => j.title === formData.jobTitle);
    return jobInfo?.minLevel || 'intern';
  };

  // Filter experience levels based on selected job title
  const filteredExperienceLevels = useMemo(() => {
    const minLevel = getMinExperienceLevel();
    const minIndex = EXPERIENCE_LEVEL_ORDER.indexOf(minLevel);
    return EXPERIENCE_LEVELS.filter(level => 
      EXPERIENCE_LEVEL_ORDER.indexOf(level.value) >= minIndex
    );
  }, [formData.jobTitle]);

  // Reset experience level if it's below the minimum for the selected job
  const handleJobTitleChange = (title: string) => {
    const jobInfo = ALL_JOB_TITLES.find(j => j.title === title);
    const minLevel = jobInfo?.minLevel || 'intern';
    const minIndex = EXPERIENCE_LEVEL_ORDER.indexOf(minLevel);
    const currentIndex = EXPERIENCE_LEVEL_ORDER.indexOf(formData.experienceLevel);
    
    setFormData(prev => ({
      ...prev,
      jobTitle: title,
      // Reset experience level if current is below minimum
      experienceLevel: currentIndex < minIndex ? '' : prev.experienceLevel
    }));
    setJobTitleOpen(false);
  };

  const renderBasicStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Job Title <span className="text-destructive">*</span>
        </Label>
        <Popover open={jobTitleOpen} onOpenChange={setJobTitleOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={jobTitleOpen}
              className="w-full justify-between font-normal"
            >
              {formData.jobTitle || "Search and select job title..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full min-w-[400px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search job titles..." />
              <CommandList>
                <CommandEmpty>No job title found. Select "Other" to enter custom.</CommandEmpty>
                {Object.entries(JOB_TITLES_BY_CATEGORY).map(([category, titles]) => (
                  <CommandGroup key={category} heading={category}>
                    {titles.map(({ title }) => (
                      <CommandItem
                        key={title}
                        value={title}
                        onSelect={() => handleJobTitleChange(title)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.jobTitle === title ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {title}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {formData.jobTitle === 'Other' && (
          <Input 
            placeholder="Enter custom job title"
            value={formData.customJobTitle}
            onChange={(e) => setFormData(prev => ({ ...prev, customJobTitle: e.target.value }))}
            className="mt-2"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Experience Level <span className="text-destructive">*</span>
        </Label>
        <Select 
          value={formData.experienceLevel} 
          onValueChange={(v) => setFormData(prev => ({ ...prev, experienceLevel: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select experience level" />
          </SelectTrigger>
          <SelectContent>
            {filteredExperienceLevels.map(level => (
              <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formData.jobTitle && filteredExperienceLevels.length < EXPERIENCE_LEVELS.length && (
          <p className="text-xs text-muted-foreground">
            Experience levels filtered based on selected role requirements
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Building className="h-4 w-4" />
          Industry/Domain <span className="text-destructive">*</span>
        </Label>
        <Select value={formData.industry} onValueChange={(v) => setFormData(prev => ({ ...prev, industry: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map(industry => (
              <SelectItem key={industry} value={industry}>{industry}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tech Context Section - helps AI suggest better skills */}
      <div className="pt-4 border-t">
        <p className="text-sm font-medium mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Tech Context <span className="text-xs text-muted-foreground font-normal">(optional - helps AI suggest better skills)</span>
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Primary Cloud</Label>
            <Select value={formData.primaryCloud} onValueChange={(v) => setFormData(prev => ({ ...prev, primaryCloud: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select cloud (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="azure">Azure</SelectItem>
                <SelectItem value="gcp">GCP</SelectItem>
                <SelectItem value="multi-cloud">Multi-cloud</SelectItem>
                <SelectItem value="on-prem">On-premise</SelectItem>
                <SelectItem value="none">Not applicable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Primary Language</Label>
            <Select value={formData.primaryLanguage} onValueChange={(v) => setFormData(prev => ({ ...prev, primaryLanguage: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select language (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="javascript">JavaScript/TypeScript</SelectItem>
                <SelectItem value="csharp">C# / .NET</SelectItem>
                <SelectItem value="go">Go</SelectItem>
                <SelectItem value="rust">Rust</SelectItem>
                <SelectItem value="ruby">Ruby</SelectItem>
                <SelectItem value="php">PHP</SelectItem>
                <SelectItem value="scala">Scala</SelectItem>
                <SelectItem value="kotlin">Kotlin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <Label className="text-sm">Client Keywords</Label>
          <Input
            placeholder="e.g., Snowflake, PySpark, Airflow, Spring Boot..."
            value={formData.clientKeywords}
            onChange={(e) => setFormData(prev => ({ ...prev, clientKeywords: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Paste keywords from client - AI will prioritize these in skill suggestions
          </p>
        </div>
      </div>
    </div>
  );

  // Smart detection of skill categories based on custom job title keywords
  const detectSkillCategoriesFromTitle = (title: string): string[] => {
    const titleLower = title.toLowerCase();
    const detectedCategories = new Set<string>();
    
    // Keyword to category mapping
    const keywordMappings: Record<string, string[]> = {
      // Data Engineering keywords
      'data engineer': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'etl': ['Data Engineering', 'Database', 'Backend', 'Tools & Practices'],
      'pipeline': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'snowflake': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'databricks': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Data Science & AI', 'Tools & Practices'],
      'airflow': ['Data Engineering', 'Cloud & DevOps', 'Tools & Practices'],
      'spark': ['Data Engineering', 'Data Science & AI', 'Tools & Practices'],
      'kafka': ['Data Engineering', 'Backend', 'Cloud & DevOps', 'Tools & Practices'],
      'dbt': ['Data Engineering', 'Database', 'Tools & Practices'],
      'analytics': ['Data Engineering', 'Database', 'Data Science & AI', 'Tools & Practices'],
      'warehouse': ['Data Engineering', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'bi ': ['Data Engineering', 'Database', 'Tools & Practices'],
      'business intelligence': ['Data Engineering', 'Database', 'Tools & Practices'],
      
      // Cloud keywords
      'aws': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
      'azure': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
      'gcp': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
      'google cloud': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
      'cloud': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
      'devops': ['Cloud & DevOps', 'Backend', 'Tools & Practices'],
      'sre': ['Cloud & DevOps', 'Backend', 'Database', 'Tools & Practices'],
      'site reliability': ['Cloud & DevOps', 'Backend', 'Database', 'Tools & Practices'],
      'platform': ['Cloud & DevOps', 'Backend', 'Database', 'Tools & Practices'],
      'infrastructure': ['Cloud & DevOps', 'Database', 'Tools & Practices'],
      'kubernetes': ['Cloud & DevOps', 'Backend', 'Tools & Practices'],
      'docker': ['Cloud & DevOps', 'Backend', 'Tools & Practices'],
      'terraform': ['Cloud & DevOps', 'Tools & Practices'],
      
      // AI/ML keywords
      'machine learning': ['Data Science & AI', 'Data Engineering', 'Backend', 'Tools & Practices'],
      'ml ': ['Data Science & AI', 'Data Engineering', 'Backend', 'Tools & Practices'],
      'mlops': ['Data Science & AI', 'Cloud & DevOps', 'Data Engineering', 'Tools & Practices'],
      'ai ': ['Data Science & AI', 'Backend', 'Cloud & DevOps', 'Tools & Practices'],
      'artificial intelligence': ['Data Science & AI', 'Backend', 'Cloud & DevOps', 'Tools & Practices'],
      'deep learning': ['Data Science & AI', 'Backend', 'Tools & Practices'],
      'nlp': ['Data Science & AI', 'Backend', 'Tools & Practices'],
      'natural language': ['Data Science & AI', 'Backend', 'Tools & Practices'],
      'computer vision': ['Data Science & AI', 'Backend', 'Tools & Practices'],
      'llm': ['Data Science & AI', 'Backend', 'Cloud & DevOps', 'Tools & Practices'],
      'prompt': ['Data Science & AI', 'Tools & Practices'],
      'generative ai': ['Data Science & AI', 'Backend', 'Cloud & DevOps', 'Tools & Practices'],
      'data scientist': ['Data Science & AI', 'Data Engineering', 'Database', 'Tools & Practices'],
      'data science': ['Data Science & AI', 'Data Engineering', 'Database', 'Tools & Practices'],
      
      // Frontend keywords
      'frontend': ['Frontend', 'Tools & Practices'],
      'front-end': ['Frontend', 'Tools & Practices'],
      'front end': ['Frontend', 'Tools & Practices'],
      'react': ['Frontend', 'Tools & Practices'],
      'angular': ['Frontend', 'Tools & Practices'],
      'vue': ['Frontend', 'Tools & Practices'],
      'ui ': ['Frontend', 'Tools & Practices'],
      'ux ': ['Frontend', 'Tools & Practices'],
      'web developer': ['Frontend', 'Backend', 'Tools & Practices'],
      
      // Backend keywords
      'backend': ['Backend', 'Database', 'Tools & Practices'],
      'back-end': ['Backend', 'Database', 'Tools & Practices'],
      'back end': ['Backend', 'Database', 'Tools & Practices'],
      'api ': ['Backend', 'Database', 'Tools & Practices'],
      'node': ['Backend', 'Database', 'Tools & Practices'],
      'python': ['Backend', 'Database', 'Data Science & AI', 'Tools & Practices'],
      'java ': ['Backend', 'Database', 'Tools & Practices'],
      'golang': ['Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      ' go ': ['Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'rust': ['Backend', 'Tools & Practices'],
      '.net': ['Backend', 'Database', 'Tools & Practices'],
      'php': ['Backend', 'Database', 'Frontend', 'Tools & Practices'],
      'ruby': ['Backend', 'Database', 'Frontend', 'Tools & Practices'],
      
      // Full stack
      'fullstack': ['Frontend', 'Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'full-stack': ['Frontend', 'Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'full stack': ['Frontend', 'Backend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      
      // Mobile keywords
      'mobile': ['Mobile', 'Backend', 'Tools & Practices'],
      'ios': ['Mobile', 'Tools & Practices'],
      'android': ['Mobile', 'Tools & Practices'],
      'react native': ['Mobile', 'Frontend', 'Tools & Practices'],
      'flutter': ['Mobile', 'Tools & Practices'],
      'swift': ['Mobile', 'Tools & Practices'],
      'kotlin': ['Mobile', 'Backend', 'Tools & Practices'],
      
      // Database keywords
      'database': ['Database', 'Backend', 'Tools & Practices'],
      'dba': ['Database', 'Cloud & DevOps', 'Tools & Practices'],
      'sql': ['Database', 'Backend', 'Tools & Practices'],
      'postgres': ['Database', 'Backend', 'Tools & Practices'],
      'mysql': ['Database', 'Backend', 'Tools & Practices'],
      'mongodb': ['Database', 'Backend', 'Tools & Practices'],
      'redis': ['Database', 'Backend', 'Tools & Practices'],
      
      // Security keywords
      'security': ['Security', 'Cloud & DevOps', 'Backend', 'Tools & Practices'],
      'cybersecurity': ['Security', 'Cloud & DevOps', 'Tools & Practices'],
      'penetration': ['Security', 'Backend', 'Tools & Practices'],
      'pentest': ['Security', 'Backend', 'Tools & Practices'],
      'devsecops': ['Security', 'Cloud & DevOps', 'Backend', 'Tools & Practices'],
      
      // QA keywords
      'qa ': ['QA & Testing', 'Tools & Practices'],
      'quality': ['QA & Testing', 'Tools & Practices'],
      'test ': ['QA & Testing', 'Tools & Practices'],
      'testing': ['QA & Testing', 'Tools & Practices'],
      'automation': ['QA & Testing', 'Backend', 'Tools & Practices'],
      'sdet': ['QA & Testing', 'Backend', 'Frontend', 'Tools & Practices'],
      
      // Architecture keywords
      'architect': ['Architecture & Design', 'Backend', 'Cloud & DevOps', 'Tools & Practices'],
      'system design': ['Architecture & Design', 'Backend', 'Database', 'Tools & Practices'],
      'principal': ['Architecture & Design', 'Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'staff': ['Architecture & Design', 'Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Tools & Practices'],
      'lead': ['Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Architecture & Design', 'Tools & Practices'],
      'manager': ['Architecture & Design', 'Tools & Practices'],
    };
    
    // Check each keyword against the title
    for (const [keyword, categories] of Object.entries(keywordMappings)) {
      if (titleLower.includes(keyword)) {
        categories.forEach(cat => detectedCategories.add(cat));
      }
    }
    
    // If no categories detected, show a sensible default set (not all)
    if (detectedCategories.size === 0) {
      // Default to common software engineering categories
      return ['Backend', 'Frontend', 'Database', 'Cloud & DevOps', 'Tools & Practices'];
    }
    
    return Array.from(detectedCategories);
  };

  // Get relevant skill categories based on selected job title
  const getRelevantSkillCategories = (): string[] => {
    const jobTitle = getEffectiveJobTitle();
    if (!jobTitle) return Object.keys(SKILL_CATEGORIES);
    
    // If it's a known job title, use the predefined mapping
    if (JOB_SKILL_MAPPING[jobTitle] && jobTitle !== 'Other') {
      return JOB_SKILL_MAPPING[jobTitle];
    }
    
    // For "Other" or custom titles, use smart detection
    if (formData.jobTitle === 'Other' && formData.customJobTitle) {
      return detectSkillCategoriesFromTitle(formData.customJobTitle);
    }
    
    // Fallback: try to detect from the job title text
    return detectSkillCategoriesFromTitle(jobTitle);
  };

  const renderSkillsStep = () => {
    const relevantCategories = getRelevantSkillCategories();
    const filteredSkillCategories = Object.entries(SKILL_CATEGORIES)
      .filter(([category]) => relevantCategories.includes(category));

    // Combine AI suggestions with static skills for autocomplete suggestions
    const aiPrimarySkills = aiSuggestions?.primarySkills || [];
    const aiSecondarySkills = aiSuggestions?.secondarySkills || [];
    const allAISuggestedSkills = [...aiPrimarySkills, ...aiSecondarySkills];
    
    // Build all available skills for autocomplete (AI + category-based)
    const allCategorySkills = filteredSkillCategories.flatMap(([_, skills]) => skills);
    const allAvailableSkills = [...new Set([...allAISuggestedSkills, ...allCategorySkills])];

    const handleAddPrimarySkill = (skill: string) => {
      // Remove from secondary if present, add to primary
      setFormData(prev => ({
        ...prev,
        primarySkills: [...prev.primarySkills, skill],
        secondarySkills: prev.secondarySkills.filter(s => s !== skill)
      }));
    };

    const handleRemovePrimarySkill = (skill: string) => {
      setFormData(prev => ({
        ...prev,
        primarySkills: prev.primarySkills.filter(s => s !== skill)
      }));
    };

    const handleAddSecondarySkill = (skill: string) => {
      // Remove from primary if present, add to secondary
      setFormData(prev => ({
        ...prev,
        secondarySkills: [...prev.secondarySkills, skill],
        primarySkills: prev.primarySkills.filter(s => s !== skill)
      }));
    };

    const handleRemoveSecondarySkill = (skill: string) => {
      setFormData(prev => ({
        ...prev,
        secondarySkills: prev.secondarySkills.filter(s => s !== skill)
      }));
    };

    return (
      <div className="space-y-6">
        {isLoadingAISuggestions ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">AI is analyzing the role and suggesting skills...</p>
          </div>
        ) : (
          <>
            {/* AI Context Info */}
            {aiSuggestions?.inferredContext && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Detected Context
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {aiSuggestions.inferredContext.cloud && aiSuggestions.inferredContext.cloud !== 'None' && (
                    <Badge variant="outline">Cloud: {aiSuggestions.inferredContext.cloud}</Badge>
                  )}
                  {aiSuggestions.inferredContext.primaryLanguage && (
                    <Badge variant="outline">Language: {aiSuggestions.inferredContext.primaryLanguage}</Badge>
                  )}
                  {aiSuggestions.inferredContext.domain && (
                    <Badge variant="outline">Domain: {aiSuggestions.inferredContext.domain}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* AI Suggested Skills Section - Quick selection */}
            {allAISuggestedSkills.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">AI Suggested Skills</h4>
                  <span className="text-xs text-muted-foreground">(click to quick-add)</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Suggested Primary Skills (must-have)</p>
                    <div className="flex flex-wrap gap-2">
                      {aiPrimarySkills.map(skill => {
                        const isPrimary = formData.primarySkills.includes(skill);
                        const isSecondary = formData.secondarySkills.includes(skill);
                        const isSelected = isPrimary || isSecondary;
                        
                        return (
                          <Badge
                            key={skill}
                            variant={isPrimary ? 'default' : isSecondary ? 'secondary' : 'outline'}
                            className={cn(
                              "cursor-pointer hover:opacity-80 transition-opacity py-1.5 px-3",
                              isSelected && "opacity-50"
                            )}
                            onClick={() => {
                              if (!isSelected) {
                                handleAddPrimarySkill(skill);
                              }
                            }}
                          >
                            {skill}
                            {isPrimary && <Check className="h-3 w-3 ml-1" />}
                            {isSecondary && <span className="text-xs ml-1">(sec)</span>}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Suggested Secondary Skills (nice-to-have)</p>
                    <div className="flex flex-wrap gap-2">
                      {aiSecondarySkills.map(skill => {
                        const isPrimary = formData.primarySkills.includes(skill);
                        const isSecondary = formData.secondarySkills.includes(skill);
                        const isSelected = isPrimary || isSecondary;
                        
                        return (
                          <Badge
                            key={skill}
                            variant={isPrimary ? 'default' : isSecondary ? 'secondary' : 'outline'}
                            className={cn(
                              "cursor-pointer hover:opacity-80 transition-opacity py-1.5 px-3",
                              isSelected && "opacity-50"
                            )}
                            onClick={() => {
                              if (!isSelected) {
                                handleAddSecondarySkill(skill);
                              }
                            }}
                          >
                            {skill}
                            {isSecondary && <Check className="h-3 w-3 ml-1" />}
                            {isPrimary && <span className="text-xs ml-1">(pri)</span>}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            {allAISuggestedSkills.length > 0 && (
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or add skills manually</span>
                </div>
              </div>
            )}

            {/* Two autocomplete inputs for primary and secondary skills */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkillAutocompleteInput
                label="Primary Skills (must-have)"
                description="Skills that are essential for this role"
                selectedSkills={formData.primarySkills}
                onAddSkill={handleAddPrimarySkill}
                onRemoveSkill={handleRemovePrimarySkill}
                suggestions={allAvailableSkills.filter(s => !formData.secondarySkills.includes(s))}
                placeholder="Type to search or add skills..."
                variant="primary"
              />
              
              <SkillAutocompleteInput
                label="Secondary Skills (nice-to-have)"
                description="Skills that would be beneficial but not required"
                selectedSkills={formData.secondarySkills}
                onAddSkill={handleAddSecondarySkill}
                onRemoveSkill={handleRemoveSecondarySkill}
                suggestions={allAvailableSkills.filter(s => !formData.primarySkills.includes(s))}
                placeholder="Type to search or add skills..."
                variant="secondary"
              />
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <div>
                <span className="text-sm font-medium">Primary: </span>
                <span className="text-sm text-primary">{formData.primarySkills.length} selected</span>
                {formData.primarySkills.length < 2 && (
                  <span className="text-sm text-destructive ml-2">(minimum 2)</span>
                )}
              </div>
              <div>
                <span className="text-sm font-medium">Secondary: </span>
                <span className="text-sm text-muted-foreground">{formData.secondarySkills.length} selected</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderResponsibilitiesStep = () => {
    // Use AI suggestions if available, otherwise fall back to static templates
    const aiResponsibilities = aiSuggestions?.responsibilities || [];
    const staticOptions = getResponsibilityOptions();
    const options = aiResponsibilities.length > 0 ? aiResponsibilities : staticOptions;
    
    return (
      <div className="space-y-6">
        {isLoadingAISuggestions ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">AI is generating responsibilities based on your selected skills...</p>
          </div>
        ) : (
          <>
            {aiResponsibilities.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Sparkles className="h-4 w-4" />
                <span>AI-generated responsibilities based on selected skills</span>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              Select at least 3 key responsibilities for this role:
            </p>
            
            <div className="space-y-3">
              {options.map((responsibility, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.responsibilities.includes(responsibility)
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleResponsibilityToggle(responsibility)}
                >
                  <Checkbox
                    checked={formData.responsibilities.includes(responsibility)}
                    onCheckedChange={() => handleResponsibilityToggle(responsibility)}
                  />
                  <span className="text-sm">{responsibility}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <span className="text-sm font-medium">Selected: </span>
              <span className={`text-sm ${formData.responsibilities.length >= 3 ? 'text-primary' : 'text-destructive'}`}>
                {formData.responsibilities.length} / 3 minimum
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderAdditionalStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Work Environment</Label>
          <Select value={formData.workEnvironment} onValueChange={(v) => setFormData(prev => ({ ...prev, workEnvironment: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select (optional)" />
            </SelectTrigger>
            <SelectContent>
              {WORK_ENVIRONMENTS.map(env => (
                <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Team Structure</Label>
          <Select value={formData.teamStructure} onValueChange={(v) => setFormData(prev => ({ ...prev, teamStructure: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select (optional)" />
            </SelectTrigger>
            <SelectContent>
              {TEAM_STRUCTURES.map(struct => (
                <SelectItem key={struct.value} value={struct.value}>{struct.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Soft Skills (select any that apply)
        </Label>
        <div className="flex flex-wrap gap-2">
          {SOFT_SKILLS.map(skill => (
            <Badge
              key={skill}
              variant={formData.softSkills.includes(skill) ? 'default' : 'outline'}
              className="cursor-pointer hover:opacity-80 transition-opacity py-1.5 px-3"
              onClick={() => handleSoftSkillToggle(skill)}
            >
              {skill}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          Specific Challenges
          {aiSuggestions?.challenges && aiSuggestions.challenges.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-primary font-normal">
              <Sparkles className="h-3 w-3" /> AI suggested
            </span>
          )}
        </Label>
        
        {/* AI Suggested Challenges */}
        {aiSuggestions?.challenges && aiSuggestions.challenges.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-2">Suggested for this role:</p>
            <div className="flex flex-wrap gap-2">
              {aiSuggestions.challenges.map(challenge => (
                <Badge
                  key={challenge}
                  variant={formData.challenges.includes(challenge) ? 'default' : 'outline'}
                  className="cursor-pointer hover:opacity-80 transition-opacity py-1.5 px-3"
                  onClick={() => handleChallengeToggle(challenge)}
                >
                  {challenge}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Static Challenges */}
        <div className="flex flex-wrap gap-2">
          {COMMON_CHALLENGES.filter(c => !aiSuggestions?.challenges?.includes(c)).map(challenge => (
            <Badge
              key={challenge}
              variant={formData.challenges.includes(challenge) ? 'default' : 'outline'}
              className="cursor-pointer hover:opacity-80 transition-opacity py-1.5 px-3"
              onClick={() => handleChallengeToggle(challenge)}
            >
              {challenge}
            </Badge>
          ))}
        </div>
        <Input
          placeholder="Add custom challenge (optional)"
          value={formData.customChallenge}
          onChange={(e) => setFormData(prev => ({ ...prev, customChallenge: e.target.value }))}
          className="mt-2"
        />
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Generated Job Description</h3>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isEditing) {
                setGeneratedJD(editedJD);
              } else {
                setEditedJD(generatedJD);
              }
              setIsEditing(!isEditing);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {isEditing ? 'Save' : 'Edit'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={generateJD}
            disabled={isGenerating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
          <SaveAsTemplateDialog
            open={saveTemplateOpen}
            onOpenChange={setSaveTemplateOpen}
            defaultValues={{
              name: getEffectiveJobTitle() + ' Interview',
              role_type: getEffectiveJobTitle(),
              seniority_level: formData.experienceLevel === 'intern' ? 'junior' : 
                              formData.experienceLevel === 'entry' ? 'junior' :
                              formData.experienceLevel === 'mid' ? 'mid' :
                              formData.experienceLevel === 'senior' ? 'senior' : 
                              formData.experienceLevel === 'lead' ? 'lead' : 'mid',
              tags: formData.primarySkills.slice(0, 5),
            }}
            onSuccess={handleJDTemplateSaved}
            trigger={
              <Button variant="secondary" size="sm" disabled={isJDTemplateSaveDisabled}>
                <Save className="h-4 w-4 mr-2" />
                {savedJDConfigSnapshot !== null && savedJDConfigSnapshot === currentJDConfigSnapshot 
                  ? 'Template Saved' 
                  : 'Save as Template'}
              </Button>
            }
          />
        </div>
      </div>

      {isEditing ? (
        <Textarea
          value={editedJD}
          onChange={(e) => setEditedJD(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
        />
      ) : (
        <ScrollArea className="h-[400px] border rounded-lg p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold mt-4 mb-2 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-medium mt-3 mb-1">{children}</h3>,
                p: ({ children }) => <p className="mb-3 text-muted-foreground leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                hr: () => <hr className="my-4 border-border" />,
              }}
            >
              {generatedJD}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      )}
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 'decision':
        return renderDecisionStep();
      case 'paste_jd':
        return renderPasteJDStep();
      case 'basic':
        return renderBasicStep();
      case 'skills':
        return renderSkillsStep();
      case 'responsibilities':
        return renderResponsibilitiesStep();
      case 'additional':
        return renderAdditionalStep();
      case 'preview':
        return renderPreviewStep();
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'decision':
        return 'Create Interview';
      case 'paste_jd':
        return 'Paste Job Description';
      case 'basic':
        return 'Step 1: Basic Information';
      case 'skills':
        return 'Step 2: Required Skills';
      case 'responsibilities':
        return 'Step 3: Key Responsibilities';
      case 'additional':
        return 'Step 4: Additional Details';
      case 'preview':
        return 'Review Job Description';
      default:
        return '';
    }
  };

  const getNextStep = (): WizardStep | null => {
    const steps: WizardStep[] = ['basic', 'skills', 'responsibilities', 'additional'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      return steps[currentIndex + 1];
    }
    return null;
  };

  const getPrevStep = (): WizardStep | null => {
    if (step === 'paste_jd') return 'decision';
    const steps: WizardStep[] = ['decision', 'basic', 'skills', 'responsibilities', 'additional', 'preview'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      return steps[currentIndex - 1];
    }
    return null;
  };

  const canProceedFromPasteJD = () => {
    return pastedJobTitle.trim().length > 0 && pastedJD.trim().length > 50;
  };

  const stepNumber = ['basic', 'skills', 'responsibilities', 'additional'].indexOf(step) + 1;

  return (
    <div className="container max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-4">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
            <span className="truncate">{getStepTitle()}</span>
          </CardTitle>
          {step !== 'decision' && step !== 'preview' && step !== 'paste_jd' && (
            <CardDescription>
              Step {stepNumber} of 4
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all" 
                  style={{ width: `${(stepNumber / 4) * 100}%` }}
                />
              </div>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {renderStepContent()}

          {step !== 'decision' && (
            <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  const prev = getPrevStep();
                  if (prev) setStep(prev);
                }}
                className="min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {step === 'preview' ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button variant="outline" onClick={handleCustomize} className="min-h-[44px]">
                    <Settings className="h-4 w-4 mr-2" />
                    Customize
                  </Button>
                  <Button onClick={handleQuickCreate} className="min-h-[44px]">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Quick Create
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              ) : step === 'paste_jd' ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button variant="outline" onClick={handlePastedCustomize} disabled={!canProceedFromPasteJD()} className="min-h-[44px]">
                    <Settings className="h-4 w-4 mr-2" />
                    Customize
                  </Button>
                  <Button onClick={handlePastedQuickCreate} disabled={!canProceedFromPasteJD()} className="min-h-[44px]">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Quick Create
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              ) : step === 'additional' ? (
                <Button 
                  onClick={generateJD}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Job Description
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={async () => {
                    const next = getNextStep();
                    if (next) {
                      // Trigger AI suggestions when moving to specific steps
                      if (step === 'basic' && next === 'skills') {
                        setStep(next);
                        fetchAISkillSuggestions();
                      } else if (step === 'skills' && next === 'responsibilities') {
                        setStep(next);
                        fetchAIResponsibilitySuggestions();
                      } else if (step === 'responsibilities' && next === 'additional') {
                        setStep(next);
                        fetchAIChallengeSuggestions();
                      } else {
                        setStep(next);
                      }
                    }
                  }}
                  disabled={!canProceedFromStep(step) || isLoadingAISuggestions}
                >
                  {isLoadingAISuggestions ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading AI Suggestions...
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JDBuilderWizard;
