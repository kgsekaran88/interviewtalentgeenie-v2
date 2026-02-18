# TalentGeenie - Frequently Asked Questions (FAQ)

## General Questions

### What is TalentGeenie?

TalentGeenie is an AI-powered interview management platform that helps organizations create, distribute, and evaluate technical interviews. It uses advanced AI to generate relevant questions based on job descriptions and provides detailed candidate assessments with hiring recommendations.

### Who can use TalentGeenie?

TalentGeenie is designed for:
- **Hiring Teams**: HR professionals and recruiters
- **Technical Interviewers**: Engineers and technical leads
- **Administrators**: System admins managing users and access
- **Candidates**: Job applicants (no account needed)

### What makes TalentGeenie different?

- **AI-Powered**: Automatic question generation and evaluation
- **Customizable**: Control difficulty, topics, question types
- **Secure**: Role-based access with enterprise-grade security
- **Fast**: Create complete interviews in minutes
- **Detailed Reports**: Comprehensive candidate assessments with PDF export
- **Easy for Candidates**: No account required, just a link

## Interview Creation

### How do I create an interview?

1. Log in to your account
2. Click "Create Interview" from the dashboard
3. Enter interview title and full job description
4. AI automatically extracts 10-15 relevant skills from your inputs
5. Click suggested skills to add them or enter custom skills
6. Configure settings (questions count, time limit, MCQ percentage)
7. Set difficulty distribution (easy, medium, hard)
8. Click "Create Interview with AI"

The AI will generate all questions automatically based on your configuration.

### How long does it take to create an interview?

Typically 10-30 seconds for the AI to generate questions, depending on:
- Number of questions requested
- Complexity of job description
- Current system load

### Can I preview questions before sharing?

Yes! From the interview detail page:
1. Click "Preview Questions"
2. Review all questions, options, and difficulty levels
3. You cannot edit individual questions currently

### How many questions can I create?

You can create 5-100 questions per interview. We recommend:
- **Quick Screen**: 5-10 questions
- **Standard Interview**: 10-20 questions
- **Comprehensive Assessment**: 20-50 questions
- **Full Technical Evaluation**: 50-100 questions

### What is MCQ percentage?

This controls the ratio of multiple-choice questions (MCQ) vs descriptive questions:
- **70% MCQ** (default): Good balance, faster evaluation
- **100% MCQ**: Quick screening, automated scoring
- **0% MCQ**: In-depth assessment, detailed answers
- **50% MCQ**: Balanced approach

MCQ questions are distributed more toward easy and medium difficulty, while descriptive questions appear more in medium and hard difficulty.

### Can I edit questions after creation?

Currently, you cannot edit individual questions. To modify an interview:
1. Create a new interview with adjusted parameters
2. The AI will generate new questions
3. Delete the old interview if no longer needed

### What skills should I include?

The AI automatically suggests 10-15 relevant skills based on your job title and description, including:
- **Technical Skills**: Programming languages (Python, Java, JavaScript), frameworks (React, Angular, Django), databases (SQL, PostgreSQL, MongoDB)
- **Cloud & Tools**: AWS, Azure, GCP, Docker, Kubernetes
- **Soft Skills**: Communication, leadership, problem-solving
- **Methodologies**: Agile, DevOps, CI/CD

Simply click suggested skills to add them, or type custom skills with autocomplete. Assign percentage weights based on importance.

## Sharing Interviews

### How do I share an interview?

1. Open the interview details page
2. Click "Activate & Generate Link" (if draft)
3. Click "Copy Share Link"
4. Share the link via email or messaging
5. Candidates click the link to start

No candidate account is required!

### Can I customize the interview link?

No, interview links are auto-generated for security. They contain a unique random token that ensures:
- Only active interviews are accessible
- Links can't be guessed
- You control activation

### How do I deactivate an interview?

From interview details page:
- Click "Archive" to deactivate
- Archived interviews don't accept new attempts
- Existing attempts remain accessible

### Can I reactivate an archived interview?

Currently no. If you need to reuse an interview:
1. Note the configuration
2. Create a new interview with same settings
3. AI will generate fresh questions

## Taking Interviews (Candidates)

### Do candidates need to create an account?

No! Candidates only need:
- The interview share link
- Their name and email address
- A web browser

### Can candidates pause an interview?

Yes, with limitations:
- Answers are auto-saved as you type
- You can navigate between questions
- **BUT**: Timer keeps running (if enabled)
- Cannot close browser and resume later
- Must complete in one session

### What happens if time runs out?

If a time limit is set:
- Timer countdown is displayed at the top
- Warning shown when time is low
- Interview auto-submits when timer reaches zero
- Partial answers are submitted

### Can candidates take the same interview twice?

No. Each candidate (identified by email) can only attempt each interview once. This ensures:
- Fair evaluation
- Prevents practice runs
- Maintains assessment integrity

### What happens if a candidate has technical issues?

Contact the person who shared the interview link. They can:
- Verify the interview is active
- Check if already attempted
- Create a new interview for retry (if appropriate)
- View error logs (admin only)

### Can candidates review answers before submitting?

Yes! Candidates can:
- Navigate back and forth between questions
- Change answers at any time before submitting
- See progress (answered vs unanswered)
- **Warning**: Cannot change after submission

## Evaluation and Results

### How is the interview evaluated?

After submission:
1. Staff member clicks "View Report" for the attempt
2. AI analyzes all answers against correct responses
3. AI generates:
   - Overall score (0-100%)
   - Hiring decision
   - Topic-wise scores
   - Strengths and weaknesses
   - Detailed analysis

Evaluation typically takes 10-30 seconds.

### What are the hiring decision categories?

- **Strong Hire** (>90%): Exceptional candidate, highly recommended
- **Hire** (70-90%): Good candidate, recommended for next round
- **Consider** (50-70%): Average, requires further evaluation
- **Reject** (<50%): Not recommended for this position

These are AI recommendations; final decisions are up to you.

### Can I re-evaluate an interview?

Currently no. The assessment is generated once and stored. The AI evaluation is consistent for the same answers.

### How accurate is the AI evaluation?

The AI evaluation:
- Compares answers to correct responses
- Considers partial credit for descriptive answers
- Analyzes explanation quality
- Evaluates technical depth
- Provides objective scoring

**However**: Always use AI evaluation as ONE INPUT in your hiring decision, not the sole factor.

### Can candidates see their results?

No. Results are only visible to:
- Interview creator
- Users with HR role
- Users with Admin role

Candidates see only a thank you message after submission.

### How do I download a report?

From the assessment report page:
- Click "Download PDF" for formatted report
- Click "Download Text" for plain text version
- Both include complete assessment details

## User Management

### What user roles are available?

- **Admin**: Full system access, user management, all features
- **HR**: Create interviews, view all results, manage candidates
- **Interviewer**: Create interviews, view own interviews only
- **Candidate**: No account, access via link only

### How do I add new users?

Admin only:
1. Go to User Management
2. Enter user email and full name
3. Select role (Admin, HR, or Interviewer)
4. Click "Create User"
5. User receives credentials

### Can I change a user's role?

Currently no. To change roles:
1. Remove the old role assignment
2. Create a new role assignment
(Note: This requires admin privileges)

### How do I remove a user?

Currently you cannot delete users, but you can:
- Remove their role assignments
- They will lose access to role-specific features
- Their created interviews remain

## Technical Questions

### What browsers are supported?

**Recommended**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Mobile**: Works on mobile browsers but desktop recommended for best experience.

### Is my data secure?

Yes! Security measures include:
- Encryption at rest and in transit (HTTPS)
- Row-level security on all data
- Role-based access control
- Session management
- Regular security audits
- No answer leakage to candidates

### Where is my data stored?

Data is stored in Supabase (PostgreSQL) with:
- Automatic daily backups
- Point-in-time recovery capability
- Enterprise-grade infrastructure
- Geographic redundancy

### Can I export my data?

Yes, via:
- PDF reports (assessments)
- Markdown documents (documentation)
- Database export (admin, via Supabase dashboard)

### How are AI credits charged?

AI usage is billed through Lovable AI:
- Free tier includes limited usage
- Pay-as-you-go for additional usage
- Charges per API call (question generation, evaluation)
- View usage in Lovable Cloud dashboard

Currently all Gemini models are free until October 13, 2025.

## Troubleshooting

### Interview link doesn't work

Check:
- Interview is in "Active" status (not draft or archived)
- Link was copied completely
- No typos in the URL
- Interview hasn't been deleted

### Cannot create interview

Verify:
- You have appropriate role (HR, Interviewer, or Admin)
- All required fields filled
- Difficulty percentages total 100%
- Job description is not empty
- You're logged in

### Questions not generating

Possible causes:
- Network connectivity issues
- AI service rate limit exceeded
- AI credits exhausted
- Job description too vague

Try:
- Wait a moment and retry
- Check your AI credit balance
- Provide more detailed job description

### Cannot view report

Ensure:
- Interview has been submitted
- Evaluation has been triggered
- You have permission (creator, HR, or admin)
- Assessment exists in database

### Timer not working correctly

- Timer starts immediately when interview begins
- Cannot pause once started
- Auto-submits at zero
- Do not refresh page during interview

### Answers not saving

Answers are auto-saved. If you're concerned:
- Check network connectivity
- Don't close browser tab
- Complete in one session
- Submit when finished

## Best Practices

### For Interview Creators

- Include complete, detailed job descriptions
- Start with 10-20 questions for new roles
- Set realistic time limits (1-2 min per question)
- Balance MCQ and descriptive appropriately
- Test with a sample candidate first

### For Candidates

- Find a quiet environment
- Ensure stable internet connection
- Read questions carefully
- Manage time wisely
- Provide detailed explanations for descriptive questions
- Review before submitting

### For Evaluators

- Review entire report, not just score
- Consider topic-wise performance
- Read detailed analysis
- Cross-reference with job requirements
- Use as one input in hiring decision
- Schedule follow-up interviews for strong candidates

## Support

### How do I get help?

1. Check this FAQ
2. Review user guide documentation
3. Contact your system administrator
4. Check technical documentation (admins)

### Feature Requests

To request features:
- Contact your system administrator
- They can file requests with the development team

### Reporting Bugs

Report issues to your administrator with:
- Description of the problem
- Steps to reproduce
- Browser and operating system
- Screenshots if applicable
- Any error messages

## Updates and Maintenance

### How often is the system updated?

Updates are deployed as needed for:
- New features
- Bug fixes
- Security patches
- Performance improvements

Users are notified of major updates.

### Will my data be affected by updates?

No. Updates are designed to:
- Preserve all existing data
- Maintain backward compatibility
- Not disrupt active interviews

### Is there scheduled downtime?

Typically no planned downtime. Updates are deployed with zero-downtime strategies. Any necessary maintenance is announced in advance.

## Pricing and Plans

### Is TalentGeenie free?

TalentGeenie includes:
- **Free**: Core platform features
- **Free**: All Gemini AI models (until Oct 13, 2025)
- **Paid**: AI usage beyond free tier
- **Paid**: Advanced Supabase features

Contact administrator for organizational pricing.

### What happens if I run out of AI credits?

- Receive 402 error when attempting AI operations
- Cannot generate new questions
- Cannot evaluate new interviews
- Existing data remains accessible
- Add credits to resume

### Can I use my own OpenAI key?

Not currently. The system uses Lovable AI Gateway which:
- Manages API keys securely
- Provides multiple model options
- Handles rate limiting
- Tracks usage

## Compliance

### Is TalentGeenie GDPR compliant?

The platform is designed with GDPR principles:
- Data minimization
- Purpose limitation
- Access controls
- User data deletion capabilities
- Audit logging

Consult with legal team for specific requirements.

### Can I delete candidate data?

Admins can delete:
- Interview attempts
- Associated assessments
- Audit logs (if configured)

Database-level deletion available via admin access.

### How long is data retained?

Default retention:
- Interviews: Indefinitely until deleted
- Attempts: Indefinitely until deleted
- Assessments: Indefinitely until deleted
- Audit logs: Configure based on needs

Configure retention policies per requirements.

---

**Still have questions?**
Contact your system administrator for additional support.
