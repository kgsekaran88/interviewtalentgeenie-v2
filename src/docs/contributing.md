# Contributing to TalentGeenie

Thank you for your interest in contributing to TalentGeenie! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and professional in all interactions.

### Expected Behavior

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun package manager
- Git
- A GitHub account
- Basic knowledge of React, TypeScript, and Supabase

### Setting Up Your Development Environment

1. **Fork the Repository**
   ```bash
   # Visit https://github.com/yourusername/talentgeenie and click "Fork"
   ```

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/yourusername/talentgeenie.git
   cd talentgeenie
   ```

3. **Install Dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

4. **Set Up Environment Variables**
   ```bash
   # The .env file is pre-configured with Lovable Cloud
   # Verify it contains:
   # VITE_SUPABASE_URL
   # VITE_SUPABASE_ANON_KEY
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branching Strategy

We use a simplified Git workflow:

- `main` - Production-ready code
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates

### Creating a New Branch

```bash
# For a new feature
git checkout -b feature/add-interview-timer

# For a bug fix
git checkout -b fix/evaluation-score-calculation

# For documentation
git checkout -b docs/update-api-guide
```

### Making Changes

1. **Write Clear, Concise Code**
   - Follow the coding standards below
   - Keep functions small and focused
   - Use meaningful variable and function names

2. **Test Your Changes**
   - Test manually in the browser
   - Verify all edge cases
   - Check responsive design
   - Test authentication flows

3. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: Add interview timer feature"
   ```

### Commit Message Guidelines

We follow the Conventional Commits specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```
feat: Add timer functionality to interviews
fix: Resolve score calculation bug in MCQ evaluation
docs: Update API documentation for interview endpoints
refactor: Simplify interview creation logic
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define interfaces for all data structures
- Avoid `any` types - use proper typing
- Use type inference where possible

**Example:**
```typescript
// Good
interface Interview {
  id: string;
  title: string;
  questions: Question[];
}

// Bad
const interview: any = { ... };
```

### React Components

- Use functional components with hooks
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks
- Use proper prop typing

**Example:**
```typescript
// Good
interface InterviewCardProps {
  interview: Interview;
  onSelect: (id: string) => void;
}

export const InterviewCard: React.FC<InterviewCardProps> = ({ interview, onSelect }) => {
  return (
    <Card onClick={() => onSelect(interview.id)}>
      <CardHeader>{interview.title}</CardHeader>
    </Card>
  );
};
```

### Styling

- Use Tailwind CSS semantic tokens from `index.css`
- Never use direct colors (e.g., `text-white`, `bg-black`)
- Use design system variables
- Ensure dark mode compatibility

**Example:**
```tsx
// Good
<div className="bg-primary text-primary-foreground">

// Bad
<div className="bg-blue-500 text-white">
```

### File Structure

- One component per file
- Use index.ts for barrel exports
- Keep related files together
- Follow existing project structure

```
src/
├── components/
│   ├── InterviewCard/
│   │   ├── InterviewCard.tsx
│   │   ├── InterviewCard.test.tsx
│   │   └── index.ts
```

## Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, verify:

- ✅ Feature works as expected
- ✅ No console errors
- ✅ Responsive on mobile, tablet, desktop
- ✅ Works in light and dark mode
- ✅ Authentication flows work correctly
- ✅ Data persists correctly
- ✅ Error states are handled
- ✅ Loading states are shown

### Testing User Flows

Test these critical paths:

1. **Authentication**
   - Sign up with email
   - Sign in with email
   - Password reset
   - Sign out

2. **Interview Creation**
   - Create interview with different settings
   - Edit interview
   - Delete interview

3. **Interview Taking**
   - Take interview as anonymous user
   - Submit answers
   - View results

4. **Admin Functions**
   - View all interviews
   - View submissions
   - Manage users

## Submitting Changes

### Before You Submit

1. **Test thoroughly** using the checklist above
2. **Update documentation** if you changed functionality
3. **Check for console errors** and warnings
4. **Verify code formatting** is consistent

### Creating a Pull Request

1. **Push Your Branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR on GitHub**
   - Go to your fork on GitHub
   - Click "Compare & pull request"
   - Fill in the PR template

3. **PR Description Should Include:**
   - **What** changed
   - **Why** it changed
   - **How** to test it
   - **Screenshots** (for UI changes)

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing Done
- [ ] Tested locally
- [ ] Tested all user flows
- [ ] Checked responsive design
- [ ] Verified dark mode

## Screenshots (if applicable)
[Add screenshots here]

## Additional Notes
Any additional context
```

## Code Review Process

### What to Expect

- PRs are typically reviewed within 2-3 days
- You may be asked to make changes
- Be responsive to feedback
- Once approved, your PR will be merged

### Review Criteria

Reviewers will check:

- Code quality and readability
- Adherence to coding standards
- Proper error handling
- Security considerations
- Performance implications
- Test coverage

## Areas to Contribute

### Good First Issues

Look for issues tagged with `good-first-issue`:

- Documentation improvements
- UI/UX enhancements
- Bug fixes
- Test coverage

### High Priority Areas

- **Accessibility** - Improve keyboard navigation, screen reader support
- **Performance** - Optimize bundle size, improve load times
- **Testing** - Add unit and integration tests
- **Documentation** - Keep docs up to date

### Feature Requests

Before implementing a new feature:

1. Check if an issue exists
2. If not, create an issue to discuss it
3. Wait for approval before starting work
4. This prevents duplicate work and ensures alignment

## Development Tips

### Useful Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Lint code
npm run lint
```

### Debugging

- Use browser DevTools
- Check Network tab for API calls
- Use React DevTools extension
- Check Supabase logs for backend issues

### Common Issues

**Issue: Changes not reflecting**
```bash
# Clear cache and restart
rm -rf node_modules/.vite
npm run dev
```

**Issue: TypeScript errors**
```bash
# Regenerate types
npm run type-check
```

**Issue: Supabase connection**
- Verify .env file has correct values
- Check network tab for failed requests
- Verify RLS policies in Supabase

## Getting Help

### Resources

- [Project Documentation](./technical-documentation.md)
- [User Guide](./user-guide.md)
- [Architecture Overview](./architecture.md)
- [API Reference](./api-reference.md)

### Contact

- **Issues** - GitHub Issues for bugs and features
- **Discussions** - GitHub Discussions for questions
- **Email** - contact@talentgeenie.dev for sensitive issues

## Recognition

Contributors will be:

- Listed in the CONTRIBUTORS.md file
- Mentioned in release notes
- Credited in the about page

Thank you for contributing to TalentGeenie! 🚀

---

**Last Updated:** 2025-01-10  
**Version:** 1.0
