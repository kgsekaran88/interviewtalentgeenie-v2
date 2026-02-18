# Changelog

All notable changes to TalentGeenie are documented in this file.

## [Latest] - December 2025

### 📱 Mobile & Accessibility Enhancements

#### Comprehensive Mobile Responsiveness Sweep
- **Touch-Friendly UI**: All interactive elements now have minimum 44px touch targets
- **Responsive Headers**: All page headers now stack vertically on mobile with proper spacing
- **Responsive Tables**: Added horizontal scroll wrappers for data tables on small screens
- **Responsive Grids**: All stat cards and content grids now adapt from multi-column to single-column on mobile
- **Responsive Tabs**: Tab lists now scroll horizontally on mobile with auto-sizing
- **Responsive Forms**: All form layouts optimized for mobile input
- **Responsive Navigation**: Sidebar and navigation properly collapse on mobile

#### Pages Updated for Mobile/Tablet Accessibility
- AIConfiguration, AdvancedAnalytics, AssessmentReport
- BillingManagement, CertificationAdmin, CertificationConfiguration
- ChatbotManagement, CreateInterview, Dashboard
- DeploymentHistory, Documentation, DocumentationGenerator
- EmailConfiguration, InterviewDetail, InterviewOperationLogs
- Landing, LearningDashboard, OrganizationManagement
- PartnerApplicationsReview, PerformanceBenchmark, PlanManagement
- PlatformAdminHub, Pricing, ProctoringDashboard, ProctoringSettings
- PromotionManagement, QuestionRepository, ReportBuilder
- RoleAssignment, RolePermissionsManagement, Settings
- TemplatesLibrary, TestingHub, UnifiedDashboard, UnifiedUserManagement

---

## [Previous] - October 2025

### ✨ New Features

#### AI-Powered Key Skills Extraction
- **Dynamic Skill Suggestions**: Interview creation now features intelligent skill extraction
  - AI analyzes both Interview Title and Job Description in real-time
  - Generates 10-15 comprehensive, role-specific skills automatically
  - Includes technical skills, soft skills, tools, and methodologies
  - Skills update dynamically as you type (1-second debounce)
- **One-Click Addition**: Click any suggested skill to add it to your interview
- **Smart Autocomplete**: Type to filter from 47+ predefined technical keywords
- **Renamed Interface**: "Topic Distribution" is now "Key Skills" for clarity
- **Optimized Layout**: Key Skills section moved after Job Description for better workflow

### 🔒 Security Enhancements

#### Critical Security Fixes
- **PII Protection**: Candidate email and name are now immutable after interview attempt creation
- **Assessment Ownership**: Added proper ownership verification to learning assessment attempts
- **Feedback Access Control**: Restricted assessment feedback to owners only (removed public access)
- **Session Validation**: Enhanced session token validation with PII change prevention

#### RLS Policy Improvements
- Updated `interview_attempts` policies with WITH CHECK constraints preventing PII modification
- Enhanced `learning_assessment_attempts` policies with ownership verification
- Restricted `learning_assessment_feedback` to owners and admins only
- All policies now use SECURITY DEFINER functions for safer recursive checks

### ✨ Feature Improvements

#### Interview Creation
- **Precise MCQ Distribution**: MCQ percentage (0-100%) now works exactly as specified
  - 100% MCQ generates only multiple choice questions
  - 0% MCQ generates only descriptive questions
  - Mixed percentages distribute proportionally across all difficulty levels
- **Better AI Instructions**: Clearer prompts ensure exact question type and difficulty distribution

#### Evaluation System
- **Strict MCQ Scoring**: Multiple choice questions now scored as exact match (100% or 0%)
- **Point-Based System**: 
  - Easy questions: 10 points
  - Medium questions: 15 points
  - Hard questions: 20 points
- **Descriptive Evaluation**: Holistic scoring based on correctness (40%), completeness (30%), clarity (30%)
- **Clear Thresholds**: 
  - Strong Hire: 85-100%
  - Hire: 70-84%
  - Consider: 50-69%
  - Reject: 0-49%

#### Candidate Experience
- **Simplified Access**: Candidates now only need name and email (no account required)
- **Secure Functions**: New `create_interview_attempt()` function handles validation and token generation
- **Better Error Messages**: User-friendly error messages for duplicate attempts and invalid interviews
- **One Attempt Per Email**: Built-in duplicate prevention at the function level

### 🐛 Bug Fixes
- Fixed inconsistent scoring across different answer combinations
- Fixed MCQ distribution not respecting user settings
- Fixed evaluation prompt being too generic
- Fixed session token validation edge cases

### 📚 Documentation Updates
- Updated README.md with latest features and security improvements
- Enhanced SECURITY.md with critical fixes and PII protection details
- Updated user-guide.md with MCQ distribution and scoring information
- Enhanced technical-documentation.md with new functions and evaluation logic
- Created CHANGELOG.md to track all changes

---

## Previous Updates - 2025

### Error Message Sanitization
- Implemented comprehensive error handling to prevent information disclosure
- Technical database errors now masked with user-friendly messages
- Context-aware error messages for different operations
- Added `src/lib/error-handler.ts` utility

### User Management Enhancements
- Admins can now view all user profiles (not just their own)
- Added user creation and deletion capabilities for admins
- Improved role assignment workflow
- Better separation of viewing vs editing permissions

### Anonymous Interview Access
- Candidates can access interviews via share links
- Secure RPC functions prevent data exposure
- Session-based authentication for attempts
- Email validation and duplicate prevention

---

## Future Roadmap

### Planned Features
- [ ] Interview templates library
- [ ] PDF export for assessment reports
- [ ] Email notifications for candidate submissions
- [ ] Real-time progress tracking
- [ ] Advanced analytics dashboard
- [ ] Calendar integration for interview scheduling
- [ ] Video interview support
- [ ] Multi-language support

### Under Consideration
- Bulk candidate management
- Interview question bank
- Custom scoring algorithms
- Integration with ATS systems
- Mobile app for candidates
- Interview analytics and insights

---

## Version History

**Current Version**: 2.1 (December 2025)
- Comprehensive mobile responsiveness sweep
- Touch-friendly UI across all pages
- Accessibility improvements (WCAG compliance)
- Responsive tables, grids, and navigation

**Previous Version**: 2.0 (October 2025)
- Major security enhancements
- Improved evaluation system
- Enhanced candidate experience

**Version 1.5**: (Early 2025)
- Initial release with core features
- Basic security implementation
- AI-powered question generation

---

For detailed security information, see [SECURITY.md](SECURITY.md)  
For user instructions, see [User Guide](src/docs/user-guide.md)  
For technical details, see [Technical Documentation](src/docs/technical-documentation.md)
