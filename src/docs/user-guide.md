# TalentGeenie User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [User Roles](#user-roles)
3. [Creating Interviews](#creating-interviews)
4. [Managing Interviews](#managing-interviews)
5. [Sharing Interviews](#sharing-interviews)
6. [Viewing Results](#viewing-results)
7. [User Management](#user-management)

## Getting Started

### Registration and Login
1. Navigate to the TalentGeenie homepage
2. Click "Get Started Free" or "Sign In"
3. Enter your email and password
4. For new users, click "Sign up" to create an account
5. Email confirmation is automatic for testing environments

### Navigation
After logging in, you can navigate the application using:
- **Home Button**: Returns to the landing page
- **TalentGeenie Logo**: Clicking the logo also takes you to the home page
- **Interview Management**: Access interview management and assessments
- **Create Interview**: Quick access from the navigation bar or landing page CTA
- **Learning**: Access practice assessments and training plans
- **Admin Menu**: Create interviews, manage users, training, documentation (role-based access)
- **Profile**: View and update your account settings

### Landing Page
The landing page provides a clean, simple introduction to TalentGeenie:

**For Unauthenticated Users**:
- Hero section with platform overview
- 4 key feature cards (AI Generation, Custom Difficulty, Instant Assessment, Easy Sharing)
- Call-to-action buttons (Get Started Free / Sign In)

**For Authenticated Users**:
- Same clean layout with "Create Interview" button in hero section that navigates to interview creation
- Quick access via navigation bar (My Interviews / Create Interview buttons)

### Error Handling
The application provides user-friendly error messages for all operations:
- **Authentication errors**: Clear messages for invalid credentials, duplicate accounts, password requirements
- **Permission errors**: Helpful messages when access is denied due to RLS policies
- **Validation errors**: Specific guidance on what needs to be corrected
- **Technical error masking**: Complex database or system errors are translated into user-friendly language
- **No raw data exposure**: Error messages never display raw JSON objects, arrays, or database details

### First Login
Upon first login, you'll be directed to the Interview Management page where you can:
- View all your interviews
- Create new interviews
- Access your profile
- View assessments (based on your role)

## User Roles

TalentGeenie implements a comprehensive role-based access control system:

### Admin
- **Full system access**
- Manage users and assign roles
- Create, view, edit, and delete all interviews
- View all assessment reports
- Access user management page
- Upload and manage documentation
- Manage training plans and materials

### HR
- View all interviews and assessments across the organization
- Create new interviews
- Share interview links with candidates
- View detailed assessment reports
- Cannot manage user roles

### Interviewer
- Create and manage their own interviews
- Share interview links with candidates
- View assessments for their interviews only
- Cannot access other users' interviews

### Contributor
- Read-only access to interviews
- Can view interview details and questions
- Cannot create, edit, or delete interviews
- Useful for training or review purposes

### Candidate
- Registered users who can access the full platform
- Access Interview Management page to view interviews and assessments
- Take assessments via share links
- View practice assessments and learning materials
- Track learning progress

### Guest
- **Limited access role** for assessment takers
- Automatically assigned when registering via assessment links
- Must register with name and valid email address to take assessments
- Can only access assessments via share links
- No access to Interview Management page or other platform features
- Cannot create or manage any content
- Each user can only attempt an assessment once per email address

## Creating Interviews

**Access Control**: Only users with Admin, HR, or Interviewer roles can create interviews.

### Step-by-Step Process

1. **Navigate to Create Interview**
   - Click "Admin" in the navigation bar, then "Create Interview"
   - Or click "Create Interview" button in the Interview Management page
   - Or use the "Create Interview" CTA on the landing page
   - Note: This option only appears for users with Admin, HR, or Interviewer roles

2. **Enter Interview Details**
   - **Title**: Give your interview a descriptive name (e.g., "Senior Data Engineer - Snowflake")
   - **Job Description**: Paste the complete job description including:
     - Required skills
     - Nice-to-have skills
     - Responsibilities
     - Experience level
   
3. **Add Key Skills (AI-Powered)**
   - **Automatic Extraction**: As you enter the title and job description, AI automatically extracts 10-15 relevant skills
   - **Smart Suggestions**: AI analyzes your inputs to suggest:
     - Technical skills (programming languages, frameworks, tools)
     - Soft skills (leadership, communication, problem-solving)
     - Domain expertise (industry-specific knowledge)
     - Methodologies (Agile, DevOps, CI/CD)
   - **One-Click Addition**: Click any AI-suggested skill badge to add it to your interview
   - **Manual Entry**: You can also type custom skills with autocomplete from 47+ technical keywords
   - **Flexible Distribution**: Adjust skill percentages using sliders to focus on priority areas
   - **Real-Time Updates**: Skills refresh automatically when you modify title or job description

4. **Configure Questions**
   - **Number of Questions**: Use the slider to select 5-100 questions (default: 10)
   - **MCQ Percentage**: Set percentage of multiple choice questions (0-100%)
     - 100% MCQ: All questions are multiple choice
     - 0% MCQ: All questions are descriptive
     - Mixed: MCQs and descriptive distributed proportionally across difficulties
   - **Time Limit**: Set time limit in minutes (0 for no limit)
     - Interview auto-submits when time expires
     - Countdown timer visible to candidates

5. **Set Difficulty Distribution**
   - **Easy**: Foundational knowledge questions (default: 30%)
   - **Medium**: Practical application questions (default: 50%)
   - **Hard**: Advanced problem-solving questions (default: 20%)
   - Total must equal 100%
   - MCQs and descriptive questions distributed proportionally within each difficulty

6. **Generate Interview**
   - Click "Create Interview with AI"
   - AI generates questions based on your exact specifications:
     - Respects MCQ percentage precisely (e.g., 100% MCQ generates only MCQs)
     - Distributes questions across difficulty levels as specified
     - Matches topic focus from job description
   - Questions are automatically saved

### Question Types
- **Multiple Choice (MCQ)**: Candidates select from 4 predefined options
  - Scored as exact match: correct answer = 100%, wrong answer = 0%
  - No partial credit
- **Descriptive**: Candidates type detailed answers
  - Evaluated holistically by AI
  - Scored on correctness (40%), completeness (30%), clarity (30%)
  - Compared against reference answer
- Questions distributed according to your MCQ percentage and difficulty settings

## Managing Interviews

### Interview States

1. **Draft**
   - Newly created interview
   - Not accessible to candidates
   - Can be edited or deleted
   - Questions can be previewed

2. **Active**
   - Interview is live and shareable
   - Candidates can access via share link
   - Cannot be edited (prevents invalidating results)
   - Can be archived

3. **Archived**
   - No longer active
   - Candidates cannot access
   - Historical data preserved
   - Can be deleted

### Interview Actions

**Activate & Generate Link**
- Available for draft interviews
- Automatically generates unique share link
- Changes status to "Active"

**Copy Share Link**
- Available for active interviews
- Copies link to clipboard
- Share via email, chat, or applicant tracking system

**Preview Questions**
- View all questions before activation
- See difficulty levels and topics
- Review question distribution

**Archive**
- Deactivate interview
- Prevents new candidate attempts
- Preserves existing results

**Delete**
- Permanently removes interview
- Deletes all associated questions
- Removes all attempts and assessments
- **Cannot be undone** - confirmation required

## Sharing Interviews

### Best Practices

1. **Before Sharing**
   - Preview questions to ensure quality
   - Verify difficulty distribution
   - Check time limit settings
   - Test the link yourself

2. **Sharing the Link**
   - Copy link using "Copy Share Link" button
   - Send via your preferred communication channel
   - Include clear instructions for candidates
   - Specify deadline for completion

3. **Candidate Instructions to Include**
   ```
   Subject: Interview Assessment - [Position Name]
   
   Hello [Candidate Name],
   
   Thank you for your interest in [Position]. Please complete the following assessment:
   
   Link: [Interview Link]
   
    Details:
    - Number of Questions: [X]
    - Time Limit: [X minutes / No limit]
    - Estimated Time: [X minutes]
    
    Instructions:
    1. Click the link to access the assessment
    2. Register with your name and email address
    3. Click "Start Interview" when ready
    4. Answer all questions to the best of your ability
    5. Review your answers before final submission
    6. You can only take this assessment once
    
    Please complete by: [Deadline]
   
   Good luck!
   ```

### Candidate Experience

1. **Registration & Accessing the Interview**
   - Candidate clicks share link
   - **Simple Registration**: System prompts for name and email (no account creation)
   - Email validation ensures valid email format
   - One attempt per email address (duplicate prevention)
   - Shows interview details (question count, time limit)
   - Clicks "Start Interview" to begin
   - Secure session token generated for attempt tracking

2. **Taking the Interview**
   - Questions displayed one at a time
   - Progress bar shows completion status
   - Timer shows elapsed time (or countdown if time limit set)
   - Can navigate between questions using Previous/Next
   - All questions accessible until submission
   - Each candidate can only attempt once per email address

3. **Submitting the Interview**
   - Must answer all questions (or can skip)
   - Final question shows "Submit Interview" button
   - Auto-submits when time expires (if time limit set)
   - Confirmation page displayed after submission
   - AI evaluation begins automatically

## Viewing Results

### Interview Overview

From Interview Detail page, you can see:
- Total number of attempts
- Evaluated vs pending attempts
- Questions preview
- Interview statistics

### Candidate Attempts Table

View all candidates who attempted the interview:
- **Candidate Name**: Full name provided
- **Email**: Contact information
- **Status**: 
  - `in_progress`: Candidate started but not submitted
  - `submitted`: Awaiting AI evaluation
  - `evaluated`: Assessment complete
- **Score**: Overall percentage score
- **Decision**: Hiring recommendation
- **Date**: When attempt was created

### Assessment Reports

Click "View Report" for evaluated attempts to see:

1. **Candidate Information**
   - Name and email
   - Interview title
   - Time taken
   - Submission date

2. **Overall Assessment**
   - **Score**: Percentage out of 100 (calculated from point system)
   - **Point System**:
     - Easy questions: 10 points each
     - Medium questions: 15 points each
     - Hard questions: 20 points each
     - MCQs: Exact match scoring (100% or 0% per question)
     - Descriptive: Holistic evaluation (0-100% per question)
   - **Hiring Decision**: 
     - `strong_hire`: 85-100% (Exceptional candidate)
     - `hire`: 70-84% (Recommended for hiring)
     - `consider`: 50-69% (Borderline, needs discussion)
     - `reject`: 0-49% (Not recommended)
   - **Decision Color Coding**: Visual indicators for quick scanning

3. **Topic-wise Performance**
   - Score breakdown by topic
   - Visual progress bars
   - Strengths and weaknesses identified

4. **Strengths**
   - Bulleted list of candidate's strong areas
   - Specific examples from answers
   - Positive observations

5. **Weaknesses**
   - Areas for improvement
   - Knowledge gaps identified
   - Concerns highlighted

6. **Detailed Analysis**
   - Comprehensive AI-generated report
   - Question-by-question evaluation
   - Reasoning for hiring decision
   - Recommendations for next steps

7. **Download Report**
   - Click "Download Report" to save PDF
   - Share with hiring team
   - Archive for compliance

## User Management

### Accessing User Management (Admin Only)

**Prerequisites**: You must have the Admin role to access this page.

1. Click "Users" in navigation bar
2. View all registered users with their profiles
3. See current role assignments for each user
4. Access role descriptions and permissions

**What Admins Can See**:
- Complete list of all registered users (not just their own profile)
- User email addresses
- User join dates
- All assigned roles for each user
- Role descriptions and permissions

### Creating New Users (Admin Only)

Admins can create new user accounts directly:

1. Click "Create User" button in User Management page
2. Enter user details:
   - **Full Name**: User's complete name
   - **Email**: Valid email address (format validated)
   - **Password**: Minimum 8 characters
3. Click "Create User" to confirm
4. User account is created with email auto-confirmed
5. Assign roles to the new user as needed

**Important Notes**:
- Email must be a valid format
- Password requirements enforced
- Email auto-confirmation enabled for seamless access
- New users must be assigned roles separately after creation

### Deleting Users (Admin Only)

Admins can permanently remove user accounts:

1. Find user in the user list
2. Click the trash icon next to user name
3. Confirm deletion in the dialog
4. User and all associated data are permanently removed

**Security Notes**:
- Admins cannot delete their own account
- All user data including roles and profiles are removed
- This action cannot be undone
- Use with caution

### Assigning Roles

1. Click "Assign Role" button
2. Select user from dropdown (shows all registered users)
3. Choose role:
   - **Admin**: Full system access, user management
   - **HR**: View all interviews, create new ones
   - **Interviewer**: Create and manage own interviews
   - **Contributor**: Read-only access
   - **Candidate**: Full platform access including Interview Management page
   - **Guest**: Link-only access to assessments, no Interview Management page access
4. Review role description
5. Click "Assign Role" to confirm

**Important Notes**:
- Users can have multiple roles
- Duplicate role assignments are prevented
- Only admins can assign and remove roles
- Changes take effect immediately
- Guest role is automatically assigned when users register via assessment links
- Candidates can be manually promoted from Guest to Candidate for full access

### Removing Roles

1. Find user in the list
2. Locate role badge
3. Click trash icon next to role
4. Role removed immediately
5. User permissions updated

### Role Management Best Practices

- **Start Conservative**: Begin with Contributor role
- **Promote Gradually**: Increase permissions as needed
- **Audit Regularly**: Review role assignments quarterly
- **Document Changes**: Keep record of who assigned roles
- **Remove Promptly**: Revoke access when team members leave

## Tips and Best Practices

### For Creating Effective Interviews

1. **Job Description Quality**
   - Be specific and detailed
   - Include all required and preferred skills
   - Mention experience level expectations
   - AI generates better questions from detailed descriptions

2. **Question Distribution**
   - Balance difficulty levels realistically
   - Don't overload with hard questions
   - Include easy questions for confidence building
   - Medium questions should be the bulk
   - Set MCQ percentage based on role requirements:
     - Technical screening: 70-100% MCQ
     - Senior positions: 30-50% MCQ (more descriptive)
     - Mixed assessment: 50-70% MCQ

3. **Time Limits**
   - Consider 1-2 minutes per question
   - Add buffer time for review
   - Test yourself first
   - Consider candidate experience level

4. **Key Skills Selection**
   - **Use AI Suggestions**: Start with AI-extracted skills for comprehensive coverage
   - **Focus on Must-Haves**: Select 3-7 core skills critical to the role
   - **Weight Appropriately**: Assign higher percentages to critical skills
   - **Balance Breadth vs Depth**: Don't spread questions too thin across too many skills
   - **Review Suggestions**: AI provides role-appropriate skills but review for your specific needs

### For Evaluating Candidates

1. **Review Holistically**
   - Don't rely solely on score
   - Read the detailed analysis
   - Consider strengths and weaknesses
   - Look at topic-wise breakdown

2. **Context Matters**
   - Consider the role's requirements
   - Junior vs senior expectations differ
   - Some topics may be learnable
   - Cultural fit isn't captured

3. **Use as One Data Point**
   - Combine with resume review
   - Consider coding tests if applicable
   - Conduct follow-up interviews
   - Check references

### For System Administration

1. **Security**
   - Assign Admin role sparingly
   - Review permissions regularly
   - Monitor user activity
   - Keep contact information updated

2. **Data Management**
   - Archive old interviews regularly
   - Delete unnecessary draft interviews
   - Back up important assessments
   - Maintain candidate privacy

3. **Quality Control**
   - Review interview questions periodically
   - Update job descriptions as roles evolve
   - Gather feedback from hiring managers
   - Refine difficulty distributions

## Troubleshooting

### Common Issues

**Can't Create Interview**
- Verify you have Interviewer, HR, or Admin role
- Check your internet connection
- Try refreshing the page
- Contact administrator if issue persists

**Share Link Not Working**
- Ensure interview is activated
- Verify link was copied completely
- Check if interview was archived
- Generate new link if needed

**Assessment Not Generated**
- Wait 1-2 minutes after submission
- Refresh the interview detail page
- Check candidate completed all questions
- Contact support if delayed >5 minutes

**Can't Access Certain Features**
- Verify your user role and permissions
- Contact administrator to request role change
- Ensure you're logged in
- Clear browser cache and retry

## Support and Feedback

For additional assistance:
- Contact your system administrator
- Check technical documentation for advanced features
- Submit feedback for feature requests
- Report bugs through admin portal

---

**Version**: 1.0  
**Last Updated**: 2025  
**Document Type**: User Guide
