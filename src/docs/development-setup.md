# Development Setup Guide

Complete guide for setting up your TalentGeenie development environment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Development Tools](#development-tools)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **Git**
   - Download from [git-scm.com](https://git-scm.com/)
   - Verify installation:
     ```bash
     git --version
     ```

3. **Code Editor**
   - Recommended: [VS Code](https://code.visualstudio.com/)
   - Alternative: Any editor with TypeScript support

4. **Package Manager**
   - npm (comes with Node.js)
   - OR [bun](https://bun.sh/) for faster installs

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

## Initial Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/talentgeenie.git

# Navigate to project directory
cd talentgeenie
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# OR using bun (faster)
bun install
```

### 3. Environment Configuration

The project uses Lovable Cloud, so environment variables are pre-configured:

```bash
# .env file (auto-configured)
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

**Note:** You should NOT need to manually configure these. They are automatically set when using Lovable Cloud.

### 4. Start Development Server

```bash
# Start the dev server
npm run dev

# Server will start at http://localhost:5173
```

## Project Structure

### Directory Layout

```
talentgeenie/
├── public/                 # Static assets
│   ├── robots.txt         # SEO configuration
│   └── favicon.ico        # Site icon
├── src/
│   ├── components/        # Reusable React components
│   │   ├── ui/           # UI library components (shadcn)
│   │   └── *             # Feature components
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── hooks/            # Custom React hooks
│   ├── integrations/     # Third-party integrations
│   │   └── supabase/    # Supabase client & types
│   ├── lib/             # Utility functions
│   ├── pages/           # Page components
│   ├── docs/            # Documentation markdown
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── supabase/
│   ├── functions/       # Edge functions
│   │   ├── generate-questions/
│   │   ├── evaluate-interview/
│   │   ├── generate-training-plan/
│   │   ├── evaluate-learning-assessment/
│   │   └── generate-learning-questions/
│   ├── migrations/      # Database migrations (auto-generated)
│   └── config.toml      # Supabase configuration
├── .env                 # Environment variables (auto-configured)
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── tailwind.config.ts   # Tailwind config
├── vite.config.ts       # Vite config
└── README.md           # Project documentation
```

### Key Files

#### `src/main.tsx`
Entry point for the React application.

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

#### `src/App.tsx`
Main application component with routing.

#### `src/contexts/AuthContext.tsx`
Authentication context provider using Supabase Auth.

#### `src/integrations/supabase/client.ts`
Supabase client configuration (auto-generated, do not edit).

## Development Workflow

### Daily Development

1. **Pull Latest Changes**
   ```bash
   git pull origin main
   ```

2. **Start Dev Server**
   ```bash
   npm run dev
   ```

3. **Make Changes**
   - Edit files in `src/`
   - See changes instantly via HMR (Hot Module Replacement)

4. **Test Changes**
   - Test in browser
   - Check console for errors
   - Verify responsive design

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: your changes"
   git push
   ```

### Available Scripts

```bash
# Development server with HMR
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code (if configured)
npm run lint
```

### Creating New Components

1. **Create Component File**
   ```bash
   # Example: Create a new Interview component
   touch src/components/InterviewCard.tsx
   ```

2. **Component Template**
   ```typescript
   import React from 'react';
   
   interface InterviewCardProps {
     title: string;
     description: string;
   }
   
   export const InterviewCard: React.FC<InterviewCardProps> = ({ 
     title, 
     description 
   }) => {
     return (
       <div className="p-4 border rounded-lg">
         <h3 className="text-lg font-semibold">{title}</h3>
         <p className="text-muted-foreground">{description}</p>
       </div>
     );
   };
   ```

3. **Import and Use**
   ```typescript
   import { InterviewCard } from '@/components/InterviewCard';
   
   <InterviewCard 
     title="React Developer" 
     description="Interview for React position"
   />
   ```

### Working with Supabase

#### Querying Data

```typescript
import { supabase } from '@/integrations/supabase/client';

// Fetch data
const { data, error } = await supabase
  .from('interviews')
  .select('*')
  .order('created_at', { ascending: false });

// Insert data
const { data, error } = await supabase
  .from('interviews')
  .insert([{ title: 'React Developer', status: 'draft' }]);

// Update data
const { data, error } = await supabase
  .from('interviews')
  .update({ status: 'active' })
  .eq('id', interviewId);

// Delete data
const { data, error } = await supabase
  .from('interviews')
  .delete()
  .eq('id', interviewId);
```

#### Using Edge Functions

```typescript
// Call edge function
const { data, error } = await supabase.functions.invoke('generate-questions', {
  body: {
    jobDescription: 'React developer with 3+ years experience',
    questionCount: 10,
    mcqPercentage: 50
  }
});
```

## Environment Configuration

### Environment Variables

```bash
# .env (auto-configured by Lovable Cloud)
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Using Environment Variables

```typescript
// Access environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Type-safe environment variables
declare module 'vite' {
  interface ImportMetaEnv {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
  }
}
```

## Database Setup

### Schema Overview

The database includes these main tables:

- `profiles` - User profiles and roles
- `interviews` - Interview definitions
- `questions` - Interview questions
- `interview_attempts` - Interview submissions
- `question_responses` - Individual question answers
- `learning_topics` - Learning assessment topics
- `learning_resources` - Training materials

### Database Migrations

Migrations are auto-generated and stored in `supabase/migrations/`.

**Do not manually edit migration files.**

To view current schema:
- Use Supabase Dashboard (via Lovable Cloud)
- Or check migration files

## Development Tools

### Browser DevTools

**Console** - View logs and errors
```javascript
console.log('Debug info:', data);
console.error('Error:', error);
```

**Network** - Monitor API calls
- Check request/response
- Verify headers
- Debug failed requests

**React DevTools** - Inspect components
- View component tree
- Check props and state
- Profile performance

### VS Code Tips

**Keyboard Shortcuts:**
- `Ctrl+P` - Quick file open
- `Ctrl+Shift+P` - Command palette
- `F2` - Rename symbol
- `F12` - Go to definition

**Snippets:**
```typescript
// Type 'rfc' for React functional component
// Type 'useh' for useState hook
// Type 'usee' for useEffect hook
```

### Git Best Practices

```bash
# Create feature branch
git checkout -b feature/new-feature

# Commit with clear messages
git commit -m "feat: add interview timer"

# Push to remote
git push origin feature/new-feature

# Create pull request on GitHub
```

## Best Practices

### Code Style

1. **Use TypeScript**
   - Define interfaces for all data
   - Avoid `any` type
   - Use proper type annotations

2. **Component Structure**
   - One component per file
   - Use functional components
   - Props at the top
   - Logic before return
   - Return JSX at the end

3. **Naming Conventions**
   - PascalCase for components
   - camelCase for functions/variables
   - UPPER_CASE for constants
   - kebab-case for files

4. **Import Order**
   ```typescript
   // 1. React imports
   import React, { useState } from 'react';
   
   // 2. Third-party imports
   import { useNavigate } from 'react-router-dom';
   
   // 3. Internal imports
   import { Button } from '@/components/ui/button';
   import { supabase } from '@/integrations/supabase/client';
   
   // 4. Types
   import type { Interview } from '@/types';
   ```

### Performance Tips

1. **Code Splitting**
   ```typescript
   // Lazy load routes
   const Dashboard = React.lazy(() => import('./pages/Dashboard'));
   ```

2. **Memoization**
   ```typescript
   // Memo expensive components
   const MemoizedComponent = React.memo(ExpensiveComponent);
   
   // Use useMemo for expensive calculations
   const result = useMemo(() => expensiveCalculation(data), [data]);
   ```

3. **Optimize Images**
   - Use appropriate formats (WebP)
   - Compress images
   - Lazy load images

### Security Best Practices

1. **Never commit secrets**
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Validate user input**
   ```typescript
   // Use zod for validation
   const schema = z.object({
     email: z.string().email(),
     password: z.string().min(6)
   });
   ```

3. **Sanitize data**
   - Don't render user input directly
   - Use proper escaping
   - Validate on backend too

## Troubleshooting

### Common Issues

**Issue: Port already in use**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or change port
npm run dev -- --port 3000
```

**Issue: Module not found**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

**Issue: Types not updating**
```bash
# Restart dev server
# Types are auto-generated by Lovable Cloud
```

**Issue: Changes not reflecting**
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Getting Help

1. Check [Troubleshooting Guide](./troubleshooting.md)
2. Search existing GitHub issues
3. Ask in GitHub Discussions
4. Check browser console for errors

## Next Steps

- Read [Contributing Guide](./contributing.md)
- Review [Technical Documentation](./technical-documentation.md)
- Check [User Guide](./user-guide.md)
- Explore [API Reference](./api-reference.md)

---

**Last Updated:** 2025-01-10  
**Version:** 1.0

Happy coding! 🚀
