# TalentGeenie Deployment Documentation

## Table of Contents
1. [Deployment Overview](#deployment-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Build Process](#build-process)
5. [Deployment Strategies](#deployment-strategies)
6. [Post-Deployment](#post-deployment)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

## Deployment Overview

TalentGeenie is a modern web application built on Lovable, which provides integrated deployment capabilities through Lovable Cloud (Supabase backend) and Lovable hosting for the frontend.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                    PRODUCTION                        │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │         Frontend (Lovable Hosting)           │  │
│  │  - CDN Distribution                          │  │
│  │  - SSL/TLS Automatic                         │  │
│  │  - Custom Domain Support                     │  │
│  └──────────────┬───────────────────────────────┘  │
│                 │                                    │
│                 │ HTTPS                              │
│                 │                                    │
│  ┌──────────────▼───────────────────────────────┐  │
│  │      Backend (Supabase/Lovable Cloud)       │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  PostgreSQL Database                  │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Edge Functions                       │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Storage Buckets                      │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Authentication                       │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

### Development Environment
- Node.js 18+ or Bun
- npm, yarn, or bun package manager
- Git for version control
- Modern code editor (VS Code recommended)

### Accounts Required
- Lovable account (for development and deployment)
- GitHub account (optional, for code repository)
- Custom domain registrar (optional, for custom domain)

### Access Requirements
- Admin access to Lovable project
- Database access for initial admin role setup
- DNS management (if using custom domain)

## Environment Setup

### Environment Variables

The application uses the following environment variables (automatically managed by Lovable):

```bash
# Supabase Configuration (Auto-generated)
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=[project-id]

# These are automatically set by Lovable Cloud
# DO NOT manually edit these variables
```

**Note**: Environment variables are automatically managed by Lovable. Manual editing is not required or recommended.

### Database Setup

1. **Automatic Migration**
   - All database migrations are automatically applied
   - Migrations are version-controlled in `supabase/migrations/`
   - Schema changes are tracked and applied on deployment

2. **Initial Admin Setup**
   After first deployment, create the first admin user through the application flow:
   
   **Option A: Via Application (Recommended)**
   1. Sign up for a new account through the Auth page
   2. Application automatically assigns 'candidate' role
   3. Run SQL to upgrade to admin:
      ```sql
      -- Replace [user-id] with actual user ID from signup
      INSERT INTO public.user_roles (user_id, role)
      VALUES ('[user-id]', 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
      ```
   
   **Option B: Via SQL Only**
   1. Create user account manually (if needed)
   2. Find user ID from auth.users:
      ```sql
      SELECT id, email FROM auth.users;
      ```
   3. Assign admin role:
      ```sql
      INSERT INTO public.user_roles (user_id, role)
      VALUES ('[user-id]', 'admin');
      ```
   
   **Note**: Role assignment is handled at the application level (Auth.tsx) to avoid modifying Supabase-reserved schemas.

3. **Verify Database Health**
   ```sql
   -- Check all tables are created
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   
   -- Verify RLS is enabled
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE schemaname = 'public' AND rowsecurity = true;
   ```

## Build Process

### Local Build

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview
```

### Build Artifacts

```
dist/
├── index.html                 # Entry point
├── assets/
│   ├── index-[hash].js       # Main JavaScript bundle
│   ├── index-[hash].css      # Compiled styles
│   └── [assets]-[hash].*     # Images, fonts, etc.
└── robots.txt                 # SEO file
```

### Build Optimization

Lovable automatically optimizes builds:
- **Code Splitting**: Routes are lazy-loaded
- **Tree Shaking**: Unused code removed
- **Minification**: JS and CSS compressed
- **Asset Hashing**: Cache-busting for updates
- **CSS Purging**: Unused Tailwind classes removed

## Deployment Strategies

### Option 1: Lovable Automatic Deployment (Recommended)

**Advantages**:
- One-click deployment
- Automatic SSL certificates
- CDN distribution included
- Zero configuration required
- Integrated with Lovable Cloud

**Steps**:
1. Click "Publish" button in Lovable editor
2. Choose deployment options:
   - Production or Staging
   - Custom domain (optional)
3. Wait for build and deployment (typically 2-3 minutes)
4. Access your deployed application

**Deployment URL**:
- Default: `https://[project-name].lovable.app`
- Custom: `https://your-domain.com` (after DNS setup)

### Option 2: Custom Domain Deployment

**Requirements**:
- Registered domain name
- Access to DNS management

**Steps**:

1. **In Lovable Dashboard**:
   - Navigate to Project Settings
   - Go to "Domains" section
   - Click "Add Custom Domain"
   - Enter your domain name

2. **DNS Configuration**:
   
   For root domain (`example.com`):
   ```
   Type: A
   Name: @
   Value: [IP provided by Lovable]
   TTL: 3600
   ```

   For subdomain (`app.example.com`):
   ```
   Type: CNAME
   Name: app
   Value: [CNAME provided by Lovable]
   TTL: 3600
   ```

3. **SSL Certificate**:
   - Automatically provisioned by Lovable
   - Usually takes 10-15 minutes
   - HTTPS enforced automatically

4. **Verify Setup**:
   ```bash
   # Check DNS propagation
   nslookup your-domain.com
   
   # Test HTTPS
   curl -I https://your-domain.com
   ```

### Option 3: Self-Hosted Deployment

If deploying outside Lovable (not recommended):

**Requirements**:
- Static hosting provider (Vercel, Netlify, AWS S3, etc.)
- Build artifacts from `npm run build`

**Example: Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

**Example: Netlify**
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist

# Configure environment variables in Netlify UI
```

**Important**: When self-hosting:
- Manually configure environment variables
- Set up redirect rules for SPA routing
- Configure CORS if needed
- Manage SSL certificates

## Post-Deployment

### Initial Configuration

1. **Create First Admin**
   ```sql
   INSERT INTO public.user_roles (user_id, role) 
   VALUES ('[your-user-id]', 'admin');
   ```

2. **Configure Auth Settings**
   - Navigate to Lovable Cloud dashboard
   - Go to Authentication settings
   - Configure:
     - Email confirmation (disable for testing)
     - Password requirements
     - Session timeout
     - Redirect URLs

3. **Set Up Redirect URLs**
   Add these URLs in Auth settings:
   - `https://your-domain.com/*`
   - `https://[project].lovable.app/*`

4. **Test Core Functionality**
   - Sign up new user
   - Assign roles
   - Create interview
   - Generate questions
   - Share interview link
   - Take interview as candidate
   - View assessment report

### Security Checklist

- [ ] Admin role assigned to appropriate users only
- [ ] Email confirmation configured appropriately
- [ ] RLS policies verified on all tables
- [ ] Storage bucket policies confirmed
- [ ] Edge function authentication reviewed
- [ ] Session timeout configured
- [ ] Password requirements set
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] API keys secured (if any external integrations)

### Performance Verification

```bash
# Check page load speed
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com

# Where curl-format.txt contains:
#   time_namelookup:  %{time_namelookup}\
#   time_connect:  %{time_connect}\
#   time_starttransfer:  %{time_starttransfer}\
#   time_total:  %{time_total}\

```

**Target Metrics**:
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.5s
- Cumulative Layout Shift: < 0.1

## Monitoring & Maintenance

### Health Monitoring

**Database Monitoring**:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Edge Function Logs**:
- Access via Lovable Cloud dashboard
- Filter by function name
- Search for errors or warnings
- Monitor execution times

**Frontend Monitoring**:
- Use browser DevTools Network tab
- Check for failed requests
- Monitor load times
- Verify API responses

### Regular Maintenance Tasks

**Daily**:
- Check error logs
- Monitor user sign-ups
- Review failed interview attempts

**Weekly**:
- Archive old interviews
- Review system usage
- Check database size
- Verify backup status

**Monthly**:
- Security audit (review user roles)
- Performance analysis
- Update dependencies
- Review and optimize slow queries
- Clean up unused data

**Quarterly**:
- Full security review
- Capacity planning
- Feature usage analysis
- Cost optimization review

### Backup Strategy

**Automatic Backups** (Supabase):
- Daily automated backups
- 7-day retention for free tier
- 30-day retention for pro tier
- Point-in-time recovery (pro tier)

**Manual Backups**:
```bash
# Export database schema
pg_dump --schema-only [connection-string] > schema.sql

# Export specific table data
pg_dump --data-only --table=interviews [connection-string] > interviews-data.sql

# Full backup
pg_dump [connection-string] > full-backup.sql
```

**Backup Restoration**:
```bash
# Restore schema
psql [connection-string] < schema.sql

# Restore data
psql [connection-string] < interviews-data.sql
```

### Update Procedure

**For Minor Updates**:
1. Test changes in Lovable development environment
2. Click "Publish" when ready
3. Verify deployment successful
4. Test critical paths
5. Monitor for errors

**For Major Updates**:
1. Create backup
2. Test thoroughly in staging
3. Schedule maintenance window
4. Deploy to production
5. Run migration scripts if needed
6. Verify all functionality
7. Monitor closely for 24 hours

## Troubleshooting

### Common Issues

**Issue: White Screen After Deployment**
```
Symptom: Application shows blank white screen
Cause: JavaScript errors or routing issues

Solution:
1. Check browser console for errors
2. Verify environment variables are set
3. Check if base path is configured correctly
4. Clear browser cache and hard refresh
```

**Issue: Authentication Errors**
```
Symptom: Users can't log in or sign up
Cause: Auth configuration or redirect URL issues

Solution:
1. Verify VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
2. Check redirect URLs in Supabase Auth settings
3. Ensure Site URL matches deployment URL
4. Verify email templates are configured
```

**Issue: Database Connection Failures**
```
Symptom: "Failed to fetch" or timeout errors
Cause: Database connectivity or RLS policy issues

Solution:
1. Check Supabase project status
2. Verify API keys are correct
3. Review RLS policies for the table
4. Check if user has required role
5. Examine database logs in Supabase dashboard
```

**Issue: Edge Function Timeouts**
```
Symptom: AI generation or evaluation fails
Cause: Function timeout or rate limits

Solution:
1. Check Edge Function logs
2. Verify API keys for AI service
3. Reduce question count if timing out
4. Check for rate limiting
5. Retry failed operations
```

**Issue: Slow Performance**
```
Symptom: Pages load slowly
Cause: Various optimization issues

Solution:
1. Enable browser caching
2. Optimize database queries
3. Add indexes on frequently queried columns
4. Use React Query caching effectively
5. Implement code splitting if needed
6. Optimize images and assets
```

### Debug Mode

Enable detailed logging:

```typescript
// In development
if (import.meta.env.DEV) {
  console.log('Debug info:', {
    user,
    session,
    roles,
    // ...other debug info
  });
}
```

### Getting Help

1. **Lovable Documentation**: https://docs.lovable.dev
2. **Lovable Community**: Discord server
3. **Supabase Docs**: https://supabase.com/docs
4. **GitHub Issues**: For bug reports
5. **Support Email**: For critical issues

### Emergency Procedures

**If site is down**:
1. Check Lovable status page
2. Review recent deployments
3. Check error logs
4. Rollback to previous version if needed
5. Contact Lovable support

**If data loss suspected**:
1. Stop all write operations
2. Assess extent of data loss
3. Restore from latest backup
4. Verify data integrity
5. Document incident
6. Implement preventive measures

**If security breach detected**:
1. Immediately revoke compromised credentials
2. Review access logs
3. Change all sensitive keys
4. Audit user access
5. Notify affected users
6. Document and report incident

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Backup created
- [ ] Rollback plan prepared

### Deployment
- [ ] Build successful
- [ ] Deployment completed
- [ ] SSL certificate active
- [ ] DNS propagated (if custom domain)

### Post-Deployment
- [ ] Site accessible
- [ ] Authentication working
- [ ] Database connections healthy
- [ ] Edge functions operational
- [ ] Admin role assigned
- [ ] Critical paths tested
- [ ] Performance acceptable
- [ ] Monitoring active
- [ ] Documentation updated
- [ ] Team notified

---

**Version**: 1.0  
**Last Updated**: 2025  
**Document Type**: Deployment Guide
