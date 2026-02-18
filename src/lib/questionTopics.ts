/**
 * Common question topics for interview configuration
 * Used for topic-specific question rules
 */

export const COMMON_TOPICS = [
  // Programming Languages
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C#',
  'C++',
  'Go',
  'Rust',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  
  // Databases
  'SQL',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'DynamoDB',
  
  // Frontend
  'React',
  'Vue',
  'Angular',
  'HTML/CSS',
  'Next.js',
  'Tailwind CSS',
  
  // Backend
  'Node.js',
  'Express',
  'Django',
  'Spring Boot',
  'FastAPI',
  'GraphQL',
  'REST API',
  
  // Cloud & DevOps
  'AWS',
  'Azure',
  'GCP',
  'Docker',
  'Kubernetes',
  'CI/CD',
  'Terraform',
  
  // Data
  'Data Structures',
  'Algorithms',
  'Machine Learning',
  'Data Analysis',
  'ETL',
  
  // Concepts
  'System Design',
  'Microservices',
  'Security',
  'Testing',
  'Performance',
  'OOP',
  'Functional Programming',
] as const;

export type QuestionTopic = typeof COMMON_TOPICS[number];

/**
 * Group topics by category for better UI organization
 */
export const TOPIC_CATEGORIES = {
  'Programming Languages': [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin'
  ],
  'Databases': [
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB'
  ],
  'Frontend': [
    'React', 'Vue', 'Angular', 'HTML/CSS', 'Next.js', 'Tailwind CSS'
  ],
  'Backend': [
    'Node.js', 'Express', 'Django', 'Spring Boot', 'FastAPI', 'GraphQL', 'REST API'
  ],
  'Cloud & DevOps': [
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform'
  ],
  'Data & Algorithms': [
    'Data Structures', 'Algorithms', 'Machine Learning', 'Data Analysis', 'ETL'
  ],
  'Concepts': [
    'System Design', 'Microservices', 'Security', 'Testing', 'Performance', 'OOP', 'Functional Programming'
  ],
} as const;
