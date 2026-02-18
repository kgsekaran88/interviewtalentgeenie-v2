# TalentGeenie - AI-Powered Interview Platform

<div align="center">

![TalentGeenie](https://img.shields.io/badge/TalentGeenie-AI%20Powered-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20iOS%20%7C%20Android-lightgrey)

**Transform Your Hiring Process with AI-Generated Interviews and Instant Assessments**

[Features](#features) • [Quick Start](#quick-start) • [Deployment](#deployment) • [Documentation](#documentation)

</div>

---

## 🎯 Overview

TalentGeenie is a comprehensive, AI-powered interview platform that revolutionizes technical recruiting. Generate tailored interview questions from job descriptions, share interviews with candidates, and receive instant AI-powered assessment reports with hiring recommendations.

### Key Highlights

- 🤖 **AI Question Generation**: Automatically generate 5-100 questions from job descriptions
- 📊 **Instant Assessment**: AI evaluates responses and provides detailed reports
- 🎯 **Smart Customization**: Control difficulty levels and topic distribution
- 📱 **Multi-Platform**: Deploy on web, iOS, and Android
- 🔒 **Secure & Private**: Row-level security, authenticated access
- ☁️ **Cloud-Ready**: Deploy anywhere - laptop, server, or cloud

---

## ✨ Features

### For Recruiters

#### 1. **Intelligent Interview Creation**
- Parse job descriptions automatically
- Define mandatory and good-to-have skills
- Customize question count (5-100 questions)
- Control difficulty distribution:
  - Easy (foundational knowledge)
  - Medium (practical application)
  - Hard (advanced problem-solving)
- Topic-wise question allocation (e.g., 40% SQL, 30% Python, 20% Data Engineering, 10% DevOps)

#### 2. **Interview Management**
- Create, edit, and archive interviews
- Generate shareable interview links
- Preview questions before publishing
- Track candidate attempts in real-time
- View interview statistics

#### 3. **AI-Powered Assessment**
After candidates submit interviews, get instant reports with:
- **Overall Score** (0-100%)
- **Hiring Decision**:
  - 🟢 Strong Hire (>90%) - Exceptional candidate
  - 🔵 Hire (70-90%) - Strong candidate
  - 🟡 Consider (50-70%) - Requires further evaluation
  - 🔴 Reject (<50%) - Not recommended
- **Skill-wise Breakdown**: Performance by topic
- **Strengths**: Key areas of excellence
- **Weaknesses**: Areas needing improvement
- **Detailed Analysis**: Comprehensive AI assessment

### For Candidates

#### 1. **User-Friendly Interview Experience**
- Clean, intuitive interface
- One question at a time
- Multiple choice and text responses
- Timer tracking
- Progress indicator
- Save and resume capability

#### 2. **Instant Feedback**
- Submission confirmation
- Time taken summary
- Professional completion page

### For Administrators

#### 1. **User Management** (Coming Soon)
- Role-based access control (Admin/Recruiter/Candidate)
- User permissions management
- Activity audit trail

#### 2. **Global Analytics** (Coming Soon)
- Interview success rates
- Average scores by role
- Time-to-completion metrics
- Hiring decision distribution

---

## 🚀 Quick Start

### Option 1: Use Lovable (Fastest)

1. This project is already deployed on Lovable with backend configured
2. Click "Publish" to make it live
3. Share the URL with your team
4. Start creating interviews!

### Option 2: Run Locally

```bash
# Clone the repository
git clone <YOUR_GITHUB_URL>
cd talentgeenie

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:8080
```

### Option 3: Deploy on Your Server

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions on:
- Self-hosted deployment
- Cloud deployment (AWS, Azure, GCP)
- Mobile deployment (iOS/Android)
- Docker deployment

---

## 📋 System Requirements

### Minimum Requirements
- **Node.js**: 18+
- **RAM**: 2GB
- **Storage**: 5GB
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+

### For Mobile Development
- **iOS**: Mac with Xcode 14+
- **Android**: Android Studio 2022+

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Router** - Navigation
- **TanStack Query** - Data fetching

### Backend (Lovable Cloud)
- **Supabase** - Database & authentication
- **PostgreSQL** - Relational database
- **Row Level Security** - Data protection
- **Edge Functions** - Serverless APIs

### AI Integration
- **Lovable AI Gateway** - AI model access
- **Google Gemini 2.5 Flash** - Question generation & assessment
- **Structured Output** - Consistent AI responses

### Mobile
- **Capacitor** - Native app wrapper
- **iOS & Android** - Native platforms

---

## 📖 User Guide

### Creating Your First Interview

1. **Sign Up/Login**
   - Visit the app URL
   - Create an account or sign in
   - Verify your email (if required)

2. **Create Interview**
   - Click "Create Interview" from dashboard
   - Enter interview title (e.g., "Senior Data Engineer - Snowflake")
   
3. **Add Job Description**
   - Paste complete job description
   - Include responsibilities and requirements
   - List mandatory skills (SQL, Python, Snowflake)
   - List nice-to-have skills (CI/CD, Kubernetes)

4. **Select Key Skills (AI-Powered)**
   - AI automatically extracts 10-15 relevant skills as you type
   - Skills include:
     - Technical skills (languages, frameworks, tools)
     - Soft skills (communication, leadership)
     - Domain expertise (industry knowledge)
     - Methodologies (Agile, DevOps, CI/CD)
   - Click suggested skills to add them instantly
   - Adjust skill percentages with sliders
   - Add custom skills with autocomplete support

5. **Customize Questions**
   - Select number of questions (5-100)
   - Set difficulty distribution:
     - Drag sliders for easy/medium/hard percentages
     - Ensure total equals 100%
   - Add topic distribution (optional):
     - Enter topic name (e.g., "SQL")
     - Set percentage (e.g., 40%)
     - Repeat for all topics

6. **Generate & Preview**
   - Click "Create Interview with AI"
   - Wait for AI to generate questions
   - Preview questions before publishing

7. **Activate & Share**
   - Click "Activate & Generate Link"
   - Copy the shareable interview link
   - Send to candidates via email/chat

### Conducting Interviews

1. **Candidate Accesses Link**
   - Candidate opens the interview link
   - Enters name and email
   - Clicks "Start Interview"

2. **Live Monitoring** (Recommended)
   - Recruiter initiates video call (Zoom/Teams/Meet)
   - Candidate shares screen during interview
   - Ensures transparency and authenticity

3. **Candidate Takes Interview**
   - Answers questions one by one
   - Timer tracks time taken
   - Can use Previous/Next to navigate
   - Submits when complete

### Reviewing Results

1. **View Attempts**
   - Go to interview detail page
   - See all candidate attempts
   - Filter by status (submitted/evaluated)

2. **AI Assessment**
   - AI automatically evaluates after submission
   - Click "View Report" for any candidate
   - Review detailed assessment

3. **Make Decision**
   - Strong Hire: Schedule next round immediately
   - Hire: Proceed with standard process
   - Consider: Additional interviews/tests
   - Reject: Send polite rejection

4. **Download Report**
   - Click "Download Report" on assessment page
   - Save for records or HR system

---

## 🔐 Security & Privacy

### Data Protection
- **Row Level Security (RLS)**: Users only access their own data
- **Authentication Required**: All interviews require login
- **Encrypted Connections**: HTTPS/TLS for all traffic
- **Secure Tokens**: JWT-based authentication

### Interview Security
- **Unique Share Links**: Each interview has unique token
- **Active Status Check**: Links only work for active interviews
- **Time Tracking**: Monitor interview duration
- **Screen Sharing**: Recommended for authenticity

### Compliance
- **GDPR Ready**: Data export and deletion
- **SOC 2 Type II**: Supabase compliance (if using Supabase)
- **Data Residency**: Choose your region
- **Audit Logs**: Track all actions (coming soon)

---

## 🎨 Customization

### Branding (Coming Soon)
- Upload company logo
- Custom color schemes
- Custom email templates
- White-label option

### Question Templates (Coming Soon)
- Save frequently used question sets
- Share templates within organization
- Import/export questions
- Community template marketplace

### Integration Options
- **Supabase REST API**: Programmatic access
- **Webhooks**: Real-time notifications (coming soon)
- **ATS Integration**: Export to HR systems (coming soon)

---

## 📊 Analytics & Reporting

### Interview Metrics
- Total interviews created
- Total candidates assessed
- Average completion time
- Drop-off rates

### Hiring Insights
- Score distribution by role
- Success rate by interviewer
- Time-to-hire metrics
- Skills gap analysis

### Export Options
- Download assessment reports (TXT)
- Export candidate data (CSV) - coming soon
- Generate PDF reports - coming soon

---

## 🚢 Deployment Options

### 1. Lovable Cloud (Recommended)
**Pros:**
- Zero setup required
- Backend pre-configured
- Auto-scaling
- Free tier available

**Best For:** Quick deployment, small to medium teams

### 2. Self-Hosted
**Pros:**
- Full control
- Run on your infrastructure
- No external dependencies
- Cost-effective for large scale

**Best For:** Large enterprises, privacy-sensitive industries

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### 3. Mobile Apps
**iOS App:**
- Deploy to App Store
- Native performance
- Offline capability

**Android App:**
- Deploy to Google Play
- Cross-device compatibility
- Progressive Web App option

See [DEPLOYMENT.md](./DEPLOYMENT.md) for mobile deployment guide.

---

## 🧪 Testing

### Manual Testing Checklist

**Interview Creation:**
- [ ] Create interview with various question counts
- [ ] Test difficulty distribution validation
- [ ] Verify topic distribution
- [ ] Preview generated questions
- [ ] Activate and generate share link

**Candidate Experience:**
- [ ] Access interview via share link
- [ ] Complete interview with different answer types
- [ ] Test navigation (Previous/Next)
- [ ] Submit interview
- [ ] Verify completion page

**Assessment:**
- [ ] View generated assessment report
- [ ] Verify hiring decision accuracy
- [ ] Check skill-wise breakdown
- [ ] Download report

### Automated Testing (Coming Soon)
- Unit tests for components
- Integration tests for flows
- E2E tests with Playwright
- API tests for edge functions

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Use semantic commit messages
- Add tests for new features
- Update documentation
- Ensure all tests pass

---

## 📞 Support

### Get Help
- **Documentation**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Lovable Docs**: https://docs.lovable.dev
- **Supabase Docs**: https://supabase.com/docs

### Report Issues
- Create an issue in the repository
- Include detailed description
- Add screenshots if applicable
- Specify environment (web/iOS/Android)

---

## 🗺️ Roadmap

### Q1 2025
- [x] Core interview creation
- [x] AI question generation
- [x] Candidate interface
- [x] AI assessment reports
- [x] Mobile support (iOS/Android)

### Q2 2025
- [ ] Admin dashboard
- [ ] Role management
- [ ] Question templates
- [ ] Custom branding
- [ ] PDF report generation

### Q3 2025
- [ ] ATS integration
- [ ] Webhooks
- [ ] Advanced analytics
- [ ] Team collaboration
- [ ] API documentation

### Q4 2025
- [ ] Video interview integration
- [ ] Code editor for technical questions
- [ ] Live coding assessment
- [ ] Interview scheduling
- [ ] Calendar integration

---

## 💝 Acknowledgments

Built with amazing open-source technologies:
- [Lovable](https://lovable.dev) - AI-powered development platform
- [Supabase](https://supabase.com) - Backend infrastructure
- [React](https://react.dev) - UI framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - Component library
- [Capacitor](https://capacitorjs.com) - Mobile wrapper

Special thanks to the AI models powering the platform:
- Google Gemini 2.5 for intelligent question generation and assessment

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🌟 Show Your Support

If TalentGeenie helps improve your hiring process, please:
- ⭐ Star this repository
- 🐦 Share on social media
- 📝 Write about your experience
- 🤝 Contribute to the project

---

<div align="center">

**Made with ❤️ by the TalentGeenie Team**

[Website](#) • [Documentation](./DEPLOYMENT.md) • [Support](#support)

</div>