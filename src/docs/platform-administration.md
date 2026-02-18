# Platform Administration Guide

## Overview

This comprehensive guide covers all aspects of platform administration for TalentGeenie, including user management, organization oversight, system configuration, security, and operational maintenance.

## Table of Contents

1. [Platform Admin Dashboard](#platform-admin-dashboard)
2. [Organization Management](#organization-management)
3. [User Management](#user-management)
4. [Role & Permission Management](#role--permission-management)
5. [Pricing & Subscription Plans](#pricing--subscription-plans)
6. [AI Configuration](#ai-configuration)
7. [Chatbot Management](#chatbot-management)
8. [Testing & Quality Assurance](#testing--quality-assurance)
9. [Analytics & Reporting](#analytics--reporting)
10. [Security & Compliance](#security--compliance)

## Platform Admin Dashboard

### Overview
The Platform Admin Hub provides a centralized control center for managing all aspects of the TalentGeenie platform.

### Key Features
- **System Overview**: Real-time statistics on organizations, users, interviews, and active attempts
- **Quick Actions**: One-click access to common administrative tasks
- **Search**: Find specific sections quickly using the search bar
- **Categorized Sections**: Organized by Core Management, Operations, Insights, Security, and System

### Accessing the Dashboard
1. Log in with a platform admin account
2. Navigate to Admin > Platform Admin Hub
3. Review system statistics and health metrics

## Organization Management

### Creating Organizations

**Partner Onboarding Flow**:
1. Navigate to Partner Management
2. Click "Onboard New Partner"
3. Enter organization details:
   - Organization name
   - Website URL
   - Industry
   - Company size
   - Country
   - Description
   - Contact email
4. Set verification status
5. Approve or pending for review

**Organization Approval Process**:
- Review submitted organization information
- Verify business legitimacy
- Check contact email validity
- Set status: pending_approval → approved → active
- Assign initial subscription plan

### Managing Organizations

**Organization List View**:
- View all organizations with status indicators
- Filter by status (pending, approved, active, suspended)
- Search by name or contact email
- Sort by creation date, name, or status

**Organization Actions**:
- **Edit Details**: Update organization information
- **Manage Subscription**: Assign or modify subscription plans
- **Manage Members**: View and manage organization users
- **View Analytics**: Organization-specific performance metrics
- **Suspend**: Temporarily disable organization access
- **Delete**: Permanently remove organization (with confirmation)

### Organization Settings

**Subscription Management**:
- Assign subscription plans
- Monitor usage limits
- Track billing cycles
- Generate invoices
- Handle plan upgrades/downgrades

**Member Management**:
- View all organization members
- Assign roles within organization
- Invite new members
- Remove members
- Transfer ownership

## User Management

### Unified User Management

**Access**: Admin > User Management

**Features**:
- View all platform users across all organizations
- Search and filter users
- Bulk operations support
- Role assignment and management
- User status control

### Creating Users

**Admin-Created Users**:
1. Click "Create User" button
2. Fill in details:
   - Full name
   - Email address (validated)
   - Password (min 8 characters)
3. User created with auto-confirmed email
4. Assign roles separately

**Self-Registration**:
- Users sign up via registration form
- Email validation enforced
- Initial role assignment based on registration type
- Admin review for partner registrations

### User Actions

**View User Details**:
- Email and profile information
- Join date
- Assigned roles
- Organization memberships
- Activity history

**Assign Roles**:
1. Select user from list
2. Click "Assign Role"
3. Choose role from dropdown
4. Confirm assignment
5. Changes take effect immediately

**Remove Roles**:
- Click trash icon next to role badge
- Confirm removal
- User permissions updated

**Delete Users**:
1. Click delete icon next to user
2. Confirm deletion in dialog
3. User and all associated data removed
4. Action cannot be undone
5. Admins cannot delete themselves

### Bulk Operations

**Bulk Role Assignment**:
- Select multiple users
- Assign common role
- Confirm bulk action

**Bulk User Import**:
- Prepare CSV file with user data
- Upload via import tool
- Validate and preview
- Confirm import

**Bulk User Export**:
- Select users or export all
- Choose export format (CSV, Excel)
- Download user data

## Role & Permission Management

### Standard Roles

**Platform Admin**:
- Full system access
- Manage all organizations
- Manage all users
- Configure system settings
- Access all features

**Partner Admin**:
- Manage their organization
- Invite and manage organization members
- Access organization analytics
- Manage billing and subscriptions
- Create and manage interviews

**HR Recruiter**:
- Create and manage interviews
- View all organization interviews
- Evaluate candidates
- Access organization analytics
- Share interview links

**Interviewer**:
- Create and manage own interviews
- Evaluate candidates for their interviews
- Access limited analytics
- Share interview links

**Candidate**:
- Take interviews via links
- Access learning resources
- View own assessment results
- Track learning progress

**Guest**:
- Link-only access to specific interviews
- Cannot access main platform
- One-time assessment attempts

### Custom Roles

**Creating Custom Roles**:
1. Navigate to Role & Permissions
2. Click "Create Custom Role"
3. Define:
   - Role name
   - Description
   - Permission set
   - Inherits from (base role)
4. Save custom role

**Permission Management**:
- Fine-grained permission control
- Capability-based authorization
- Hierarchical inheritance
- Organization-level isolation

**Assigning Custom Roles**:
1. Go to User Management
2. Select user
3. Assign custom role
4. Set scope (global or organization-specific)

## Pricing & Subscription Plans

### Plan Management

**Creating Plans**:
1. Navigate to Pricing Management
2. Click "Create New Plan"
3. Configure:
   - Plan name
   - Plan type (free, starter, professional, enterprise)
   - Billing period (monthly/annual)
   - Price in cents
   - User limits
   - Interview limits
   - AI usage limits
   - Feature access
4. Activate plan

**Managing Plans**:
- Edit plan details
- Update pricing
- Modify limits
- Enable/disable features
- Archive old plans
- Set plan as featured

### Plan Features

**Configurable Limits**:
- Maximum users per organization
- Maximum interviews per period
- AI usage tokens
- Storage limits
- API rate limits

**Feature Flags**:
- Resume parsing
- Bias detection
- Advanced proctoring
- Custom branding
- API access
- Priority support

### Subscription Management

**Assigning Subscriptions**:
1. Select organization
2. Choose subscription plan
3. Set billing period
4. Activate subscription

**Monitoring Usage**:
- Track interview usage
- Monitor AI consumption
- Check user count
- Review storage usage
- Alert on limit approaches

**Handling Upgrades/Downgrades**:
- Prorate billing adjustments
- Update limits immediately
- Maintain data access
- Notify organization admins

## AI Configuration

### AI Provider Management

**Supported Providers**:
- Google Gemini (2.5 Pro, Flash, Flash Lite)
- OpenAI (GPT-5, GPT-5 Mini, GPT-5 Nano)
- Custom providers via API

**Adding Providers**:
1. Navigate to AI Configuration
2. Click "Add Provider"
3. Configure:
   - Provider name
   - Provider type
   - Base URL
   - Supported models
4. Test connection
5. Activate provider

**Managing Credentials**:
- Encrypted API key storage
- Rate limit configuration
- Usage tracking
- Automatic fallback
- Cost monitoring

### Model Configuration

**Default Model Selection**:
- Set default model per feature
- Configure fallback models
- Set temperature and max tokens
- Define system prompts

**Feature-Specific Models**:
- Question generation: Gemini 2.5 Pro
- Evaluation: GPT-5
- Resume parsing: Gemini Flash
- Chatbot: Gemini 2.5 Flash

### AI Usage Monitoring

**Tracking Metrics**:
- Total requests
- Tokens consumed
- Costs per feature
- Success rates
- Latency statistics

**Cost Management**:
- Set budget alerts
- Track per-organization usage
- Generate cost reports
- Implement usage caps

## Chatbot Management

### Configuration

**Access**: Admin > Chatbot Management

**Settings**:
- AI model selection
- Temperature control (0.0-1.0)
- Max tokens (100-2000)
- System prompt customization

**Refresh Knowledge**:
- Click "Refresh Knowledge" button
- Reloads knowledge base
- Updates custom Q&A pairs
- Refreshes documentation

### Training

**Access**: Admin > Chatbot Training

**Adding Knowledge**:
1. Click "Add Knowledge Entry"
2. Fill in:
   - Title
   - Category
   - Question/Topic
   - Answer/Content
   - Tags
   - Target role
   - Priority (1-10)
3. Activate entry

**Managing Knowledge**:
- Search by title, content, tags
- Filter by category or role
- Edit existing entries
- Delete outdated information
- Activate/deactivate entries

### Monitoring

**Usage Statistics**:
- Total conversations
- Questions answered
- Average satisfaction
- Most asked questions
- Topic distribution

**Knowledge Coverage**:
- Platform features
- User roles
- Interview creation
- Candidate management
- Technical support
- Custom topics

## Testing & Quality Assurance

### Test Management

**Access**: Admin > Test Management

**Test Suites**:
- Authentication tests
- Interview creation tests
- Assessment evaluation tests
- User management tests
- API integration tests
- Security tests

**Running Tests**:
1. Select test suite
2. Click "Run Tests"
3. Monitor progress
4. Review results
5. Export test reports

### Test Data Management

**Seeding Test Data**:
1. Click "Seed Test Data"
2. Specify record count
3. Confirm generation
4. Test data created:
   - Organizations
   - Users
   - Interviews
   - Questions
   - Candidates
   - Attempts

**Cleaning Test Data**:
1. Click "Cleanup Test Data"
2. Review what will be deleted
3. Confirm cleanup
4. Only seed data removed (user data safe)

**Test Data Identification**:
- Organizations named "Test Organization %"
- Email addresses with @test.com domain
- Flagged as test data in database

### Automated Testing

**Test Execution**:
- Scheduled test runs
- Continuous integration
- Regression testing
- Performance testing

**Test Reporting**:
- Pass/fail statistics
- Coverage reports
- Performance metrics
- Error logs

## Analytics & Reporting

### Organization Analytics

**Metrics Tracked**:
- Total interviews created
- Candidates evaluated
- Average CPI scores
- Hiring rate
- Time to hire
- Success rate by role

**Visualization**:
- Line charts for trends
- Bar charts for comparisons
- Pie charts for distribution
- Heat maps for patterns

### Advanced Analytics

**Predictive Analytics**:
- Success prediction models
- Feature importance analysis
- Hiring outcome forecasts
- Candidate scoring predictions

**Comparative Analytics**:
- Interview performance comparison
- Time period comparisons
- Role-based comparisons
- Organization benchmarking

### Custom Reports

**Report Builder**:
1. Select report type
2. Choose metrics
3. Set date range
4. Add filters
5. Generate report
6. Export (PDF, CSV, Excel)

**Scheduled Reports**:
- Weekly summaries
- Monthly analytics
- Quarterly reviews
- Custom schedules

## Security & Compliance

### Security Monitoring

**Access Logs**:
- User login history
- Failed login attempts
- IP address tracking
- Session management

**Audit Trail**:
- All administrative actions
- Data modifications
- Permission changes
- Configuration updates

### Security Events

**Monitoring**:
- Track security events
- Severity classification
- Event types:
  - Authentication failures
  - Unauthorized access
  - Data breaches
  - Configuration changes

**Incident Response**:
1. Detect security event
2. Assess severity
3. Contain threat
4. Investigate root cause
5. Remediate vulnerability
6. Document incident

### Data Retention

**Retention Policies**:
- Configure retention periods
- Auto-delete old data
- Archive historical records
- Maintain compliance

**Data Categories**:
- Interview attempts: 2 years
- Assessments: 7 years
- Audit logs: 10 years
- User data: Until account deletion

### Compliance

**GDPR Compliance**:
- Data subject rights
- Right to access
- Right to deletion
- Data portability
- Consent management

**Data Protection**:
- Encryption at rest
- Encryption in transit
- Access controls
- Regular audits

## Best Practices

### Organization Management
1. Verify organization legitimacy before approval
2. Monitor subscription usage regularly
3. Review member activity
4. Maintain communication with partners
5. Document policy violations

### User Management
1. Enforce strong password policies
2. Regular role audits
3. Prompt access revocation
4. Monitor suspicious activity
5. Maintain user privacy

### System Configuration
1. Regular backups
2. Test configuration changes
3. Document all settings
4. Monitor system health
5. Plan for scalability

### Security
1. Enable MFA for admins
2. Regular security audits
3. Monitor access logs
4. Update security policies
5. Train staff on security

## Troubleshooting

### Common Issues

**Login Problems**:
- Check user status
- Verify email confirmation
- Reset password
- Clear browser cache
- Check account suspension

**Permission Errors**:
- Verify role assignment
- Check RLS policies
- Review custom roles
- Confirm organization membership

**Performance Issues**:
- Monitor database queries
- Check API rate limits
- Review AI usage
- Optimize queries
- Scale infrastructure

### Getting Support

**Internal Resources**:
- Check documentation
- Review audit logs
- Consult knowledge base
- Test in staging environment

**External Support**:
- Contact technical support
- Submit bug reports
- Request feature enhancements
- Escalate critical issues

## Appendices

### Keyboard Shortcuts
- `Ctrl/Cmd + K`: Quick search
- `Ctrl/Cmd + /`: Open command palette
- `Esc`: Close dialogs
- `?`: Show help

### API Rate Limits
- Standard: 100 requests/minute
- Professional: 500 requests/minute
- Enterprise: Custom limits

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Stable internet connection
- JavaScript enabled
- Cookies enabled

### Contact Information
- Technical Support: support@talentgeenie.com
- Platform Admin Help: admin@talentgeenie.com
- Security Issues: security@talentgeenie.com
- Billing Questions: billing@talentgeenie.com
