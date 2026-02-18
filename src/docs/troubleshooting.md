# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with TalentGeenie.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Authentication Issues](#authentication-issues)
- [Interview Creation Issues](#interview-creation-issues)
- [Interview Taking Issues](#interview-taking-issues)
- [Performance Issues](#performance-issues)
- [Development Issues](#development-issues)
- [Deployment Issues](#deployment-issues)
- [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check Checklist

Run through this checklist first:

1. **Clear Browser Cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Clear cookies and site data

2. **Check Browser Console**
   - Press `F12` to open DevTools
   - Check Console tab for errors
   - Look for red error messages

3. **Check Network Tab**
   - Open DevTools → Network tab
   - Look for failed requests (red status codes)
   - Check if API calls are returning errors

4. **Verify Environment**
   - Check `.env` file exists
   - Verify `VITE_SUPABASE_URL` is set
   - Verify `VITE_SUPABASE_ANON_KEY` is set

## Common Issues

### Issue: White/Blank Screen

**Symptoms:**
- Application shows blank white screen
- No content loads

**Solutions:**

1. **Check Console for Errors**
   ```
   Press F12 → Console tab
   Look for error messages
   ```

2. **Clear Browser Cache**
   ```
   Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   ```

3. **Verify Build**
   ```bash
   # Rebuild the application
   npm run build
   npm run preview
   ```

4. **Check Network Requests**
   - Open Network tab in DevTools
   - Look for failed API requests
   - Verify Supabase connection

### Issue: 404 Not Found

**Symptoms:**
- Page shows "404 Not Found" error
- Navigation doesn't work

**Solutions:**

1. **Check Route Configuration**
   ```typescript
   // Verify route exists in App.tsx
   <Route path="/your-route" element={<YourComponent />} />
   ```

2. **For Production Deployment**
   ```bash
   # Ensure server is configured for SPA routing
   # Add _redirects file (Netlify) or vercel.json (Vercel)
   ```

3. **Clear Browser History**
   - Clear cache and reload
   - Try accessing the route directly

### Issue: API Request Failures

**Symptoms:**
- "Failed to fetch" errors
- Network errors in console
- Data not loading

**Solutions:**

1. **Check Supabase Connection**
   ```typescript
   // Verify .env file
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Check Network Tab**
   - Look for failed requests (red status)
   - Check response errors
   - Verify request headers

3. **Verify RLS Policies**
   - Check if Row Level Security is blocking requests
   - Verify user has proper permissions
   - Test with admin account

4. **Check CORS Settings**
   - Verify Supabase CORS settings
   - Check for CORS errors in console

## Authentication Issues

### Issue: Cannot Sign Up

**Symptoms:**
- Sign up button doesn't work
- Error: "Invalid email or password"
- No confirmation email

**Solutions:**

1. **Verify Email Format**
   - Use valid email address
   - Check for typos

2. **Check Password Requirements**
   - Minimum 6 characters
   - No special requirements by default

3. **Email Confirmation**
   - Check spam folder for confirmation email
   - Auto-confirm is enabled in development
   - For production, verify email settings

4. **Check Console Errors**
   ```
   Look for specific error messages
   Check Supabase auth logs
   ```

### Issue: Cannot Log In

**Symptoms:**
- Correct credentials don't work
- "Invalid credentials" error
- Infinite loading

**Solutions:**

1. **Verify Credentials**
   - Double-check email and password
   - Try password reset if unsure

2. **Clear Session**
   ```javascript
   // Clear browser storage
   localStorage.clear();
   sessionStorage.clear();
   ```

3. **Check Auth State**
   ```typescript
   // Verify AuthContext is working
   const { user } = useAuth();
   console.log('Current user:', user);
   ```

4. **Reset Password**
   - Use "Forgot Password" link
   - Check email for reset link

### Issue: Session Expires Quickly

**Symptoms:**
- Logged out frequently
- Have to re-login often

**Solutions:**

1. **Check Session Configuration**
   - Verify token expiration settings
   - Check Supabase auth settings

2. **Browser Settings**
   - Check if cookies are being blocked
   - Allow third-party cookies for the site

## Interview Creation Issues

### Issue: Cannot Create Interview

**Symptoms:**
- Create button doesn't work
- Form validation errors
- Interview not saving

**Solutions:**

1. **Check Form Validation**
   - All required fields filled?
   - Title and job role required
   - At least 1 question count

2. **Check Console Errors**
   ```javascript
   // Look for validation or API errors
   console.log('Form errors:', errors);
   ```

3. **Verify Permissions**
   - Must be logged in as admin
   - Check user role in database

4. **Check Network Request**
   - Look for failed POST request
   - Check response error message

### Issue: Questions Not Generating

**Symptoms:**
- AI questions fail to generate
- Error: "Failed to generate questions"
- Infinite loading

**Solutions:**

1. **Check Edge Function**
   - Verify `generate-questions` function is deployed
   - Check function logs for errors

2. **Verify Job Description**
   - Provide detailed job description
   - Include required skills

3. **Check AI Configuration**
   - Verify AI model is accessible
   - Check for quota limits

4. **Try Different Settings**
   - Reduce question count
   - Change difficulty distribution
   - Adjust MCQ percentage

## Interview Taking Issues

### Issue: Cannot Access Interview

**Symptoms:**
- Interview link doesn't work
- "Interview not found" error
- Access denied

**Solutions:**

1. **Verify Interview Link**
   - Check URL is complete
   - Try copying link again

2. **Check Interview Status**
   - Interview must be "active"
   - Not expired or deleted

3. **Clear Browser Cache**
   - Hard refresh page
   - Clear cookies

### Issue: Cannot Submit Answers

**Symptoms:**
- Submit button disabled
- Answers not saving
- Error on submission

**Solutions:**

1. **Check All Questions Answered**
   - MCQ: Must select an option
   - Descriptive: Must have text

2. **Check Network Request**
   - Look for failed POST request
   - Check error message

3. **Session Issues**
   - Refresh the page
   - Start interview again if needed

### Issue: Results Not Showing

**Symptoms:**
- Blank results page
- Score shows as 0
- No feedback

**Solutions:**

1. **Check Evaluation Status**
   - Wait for evaluation to complete
   - Check for evaluation errors

2. **Verify Edge Function**
   - Check `evaluate-interview` function
   - Look at function logs

3. **Refresh Results**
   - Reload the page
   - Check interview detail page

## Performance Issues

### Issue: Slow Loading

**Symptoms:**
- Pages take long to load
- Laggy interactions
- Slow API responses

**Solutions:**

1. **Check Network Speed**
   - Test internet connection
   - Try different network

2. **Optimize Browser**
   - Close unnecessary tabs
   - Clear browser cache
   - Disable heavy extensions

3. **Check API Performance**
   - Look at Network tab timing
   - Check for slow queries
   - Verify database indexes

### Issue: High Memory Usage

**Symptoms:**
- Browser becomes slow
- Tab crashes
- Out of memory errors

**Solutions:**

1. **Close Other Tabs**
   - Free up browser memory
   - Restart browser

2. **Check for Memory Leaks**
   - Open DevTools → Performance
   - Record and analyze memory usage

3. **Update Browser**
   - Use latest browser version
   - Try different browser

## Development Issues

### Issue: Build Fails

**Symptoms:**
- `npm run build` fails
- TypeScript errors
- Module not found errors

**Solutions:**

1. **Check TypeScript Errors**
   ```bash
   npm run type-check
   ```

2. **Reinstall Dependencies**
   ```bash
   rm -rf node_modules
   rm package-lock.json
   npm install
   ```

3. **Clear Build Cache**
   ```bash
   rm -rf node_modules/.vite
   npm run build
   ```

### Issue: Hot Reload Not Working

**Symptoms:**
- Changes don't reflect immediately
- Have to manually refresh
- HMR errors in console

**Solutions:**

1. **Restart Dev Server**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Clear Vite Cache**
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

3. **Check File Watcher**
   - Verify file changes are being detected
   - Check file system permissions

### Issue: TypeScript Errors

**Symptoms:**
- Type errors in editor
- Build fails due to types
- `any` type warnings

**Solutions:**

1. **Regenerate Types**
   ```bash
   # Types are auto-generated from Supabase
   # Restart dev server to regenerate
   ```

2. **Check Type Imports**
   ```typescript
   // Verify correct imports
   import type { Database } from '@/integrations/supabase/types';
   ```

3. **Fix Type Errors**
   ```typescript
   // Add proper type annotations
   const data: Interview[] = await response.json();
   ```

## Deployment Issues

### Issue: Deploy Fails

**Symptoms:**
- Build fails on deployment platform
- Deploy stuck at "Building"
- Deployment errors

**Solutions:**

1. **Check Build Locally**
   ```bash
   npm run build
   ```

2. **Verify Environment Variables**
   - Set on deployment platform
   - Match .env.example format
   - No trailing spaces

3. **Check Build Logs**
   - Read error messages
   - Look for missing dependencies
   - Check Node version compatibility

### Issue: Environment Variables Not Working

**Symptoms:**
- API calls fail in production
- Features work locally but not deployed
- Configuration errors

**Solutions:**

1. **Verify Variable Names**
   ```bash
   # Must start with VITE_
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

2. **Set on Platform**
   - Vercel: Project Settings → Environment Variables
   - Netlify: Site Settings → Environment Variables

3. **Rebuild After Changes**
   - Environment variables require rebuild
   - Trigger new deployment

### Issue: Routes Not Working (404)

**Symptoms:**
- Direct URLs show 404
- Refresh breaks app
- Navigation works, direct access doesn't

**Solutions:**

1. **For Netlify**
   ```toml
   # _redirects file
   /*    /index.html   200
   ```

2. **For Vercel**
   ```json
   // vercel.json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/" }]
   }
   ```

3. **For Apache**
   ```apache
   # .htaccess
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

## Getting Help

### Before Asking for Help

1. ✅ Checked this troubleshooting guide
2. ✅ Searched existing issues on GitHub
3. ✅ Checked browser console for errors
4. ✅ Verified environment configuration
5. ✅ Tried basic troubleshooting steps

### How to Report an Issue

Include the following information:

```markdown
**Description:**
Clear description of the issue

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Node Version: 18.17.0
- Deployment: Local / Vercel / Netlify

**Console Errors:**
```
[Paste console errors here]
```

**Screenshots:**
[Attach if relevant]
```

### Contact Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and help
- **Email** - support@talentgeenie.dev

### Emergency Issues

For critical production issues:

1. Check [Status Page](#) for known incidents
2. Review [Security Policy](../SECURITY.md)
3. Contact support immediately
4. Document everything

---

**Last Updated:** 2025-01-10  
**Version:** 1.0

Remember: Most issues can be resolved by clearing cache, checking console errors, and verifying environment configuration. Start with the basics before diving deep into complex debugging.
