# AI Chatbot Guide

## Overview

The TalentGeenie platform includes an intelligent AI-powered chatbot assistant that provides contextual help, answers questions, and guides users through the platform features. The chatbot uses Google Gemini 2.5 Flash for natural language understanding and provides role-specific responses.

## Features

### Role-Based Responses
The chatbot tailors its responses based on the user's role:
- **Platform Admin**: Full system guidance, user management, configuration help
- **Partner Admin**: Organization management, team oversight, billing information
- **HR Recruiter**: Interview creation, candidate evaluation, hiring workflows
- **Interviewer**: Interview management, question design, assessment review
- **Candidate**: Assessment taking, learning resources, progress tracking
- **Guest**: Basic navigation, assessment access, registration help

### Knowledge Base
The chatbot has access to a comprehensive knowledge base that includes:
- Platform features and capabilities
- User guides and tutorials
- Technical documentation
- API references
- Troubleshooting guides
- Best practices
- Custom Q&A pairs added by administrators

### Quick Actions
Users can access common tasks directly from the chatbot:
- Create new interview
- View interviews
- Check notifications
- Access learning resources
- Navigate to key sections

## Using the Chatbot

### Accessing the Chatbot
1. Look for the chat icon in the bottom-right corner of any page
2. Click the icon to open the chat window
3. The chatbot is available on all pages except the authentication pages

### Asking Questions
Simply type your question in natural language:
- "How do I create a new interview?"
- "What's the difference between MCQ and descriptive questions?"
- "How can I share an interview with candidates?"
- "Show me my recent interviews"
- "Help me understand the scoring system"

### Using Quick Actions
Click any of the quick action buttons to:
- Navigate to specific pages
- Perform common tasks
- Access documentation
- Get context-specific help

### Getting Role-Specific Help
The chatbot automatically knows your role and provides relevant information:
- Admins get system management guidance
- Recruiters get hiring workflow help
- Candidates get assessment taking tips
- All users get appropriate feature access information

## Chatbot Management (Platform Admins Only)

### Configuration Settings

Platform administrators can configure the chatbot through the Chatbot Management page:

**AI Model Settings**
- **Model**: Google Gemini 2.5 Flash (default)
- **Temperature**: Controls response creativity (0.0-1.0)
  - Lower = More focused and deterministic
  - Higher = More creative and varied
- **Max Tokens**: Maximum response length (100-2000)

**System Prompt**
- Define the chatbot's behavior and personality
- Set response guidelines and constraints
- Configure role-specific instructions

**Refresh Knowledge**
- Click "Refresh Knowledge" to reload the chatbot's knowledge base
- Updates the bot with latest documentation and custom Q&A pairs
- Recommended after adding new training content

### Usage Statistics
Monitor chatbot performance:
- Total conversations
- Questions answered
- Average satisfaction rating
- Most asked questions
- Topic distribution

### Knowledge Coverage
View which topics are covered in the knowledge base:
- Platform Features: Core functionality guidance
- User Roles: Role-specific help
- Interview Creation: Question design, configuration
- Candidate Management: Evaluation, hiring decisions
- Technical Support: Troubleshooting, errors
- Custom Topics: Administrator-added content

## Chatbot Training (Platform Admins Only)

### Adding Custom Knowledge

Administrators can enhance the chatbot's knowledge through the Chatbot Training page:

**Creating Q&A Pairs**
1. Navigate to Admin > Chatbot Training
2. Click "Add Knowledge Entry"
3. Fill in the details:
   - **Title**: Short, descriptive title
   - **Category**: Organize by topic
   - **Question/Topic**: The query or topic
   - **Answer/Content**: Detailed response
   - **Tags**: Keywords for searchability
   - **Target Role**: Specific roles (or "all" for everyone)
   - **Priority**: Display importance (1-10)
   - **Active Status**: Enable/disable entries

**Managing Entries**
- Search entries by title, content, or tags
- Filter by category or role
- Edit existing entries
- Delete outdated information
- Activate/deactivate entries

### Knowledge Categories

**Platform Features**
- Feature explanations
- Usage guides
- Configuration options
- Integration information

**User Roles**
- Role permissions
- Access levels
- Responsibility descriptions
- Best practices

**Interview Creation**
- Question types
- Difficulty settings
- AI generation
- Proctoring options

**Candidate Management**
- Evaluation criteria
- Scoring system
- Hiring decisions
- Report interpretation

**Technical Support**
- Error messages
- Troubleshooting steps
- Known issues
- Workarounds

**Billing & Subscriptions**
- Plan features
- Usage limits
- Pricing information
- Payment methods

**Custom Topics**
- Organization-specific policies
- Internal procedures
- Custom workflows
- Industry-specific guidance

### Priority System

Priority levels determine response relevance:
- **10 (Critical)**: Essential information, always shown
- **7-9 (High)**: Important topics, frequently referenced
- **4-6 (Medium)**: Standard information, shown when relevant
- **1-3 (Low)**: Supplementary information, shown for specific queries

### Best Practices

**Creating Effective Q&A Pairs**
1. Use clear, specific titles
2. Write comprehensive answers
3. Include examples and use cases
4. Add relevant tags for discoverability
5. Set appropriate priority levels
6. Target specific roles when applicable

**Organizing Knowledge**
1. Use consistent categories
2. Avoid duplicate entries
3. Regular review and updates
4. Remove outdated information
5. Monitor user questions for gaps

**Maintaining Quality**
1. Test new entries after adding
2. Monitor chatbot performance
3. Gather user feedback
4. Update based on common questions
5. Refresh knowledge regularly

## Advanced Features

### Context-Aware Responses
The chatbot understands:
- Current page context
- User's role and permissions
- Recent actions and navigation
- Active sessions and tasks

### Multi-Turn Conversations
- Follow-up questions
- Clarification requests
- Deep dive into topics
- Step-by-step guidance

### Learning Capabilities
The system tracks:
- Common question patterns
- User satisfaction
- Knowledge gaps
- Response effectiveness

## Troubleshooting

### Chatbot Not Responding
1. Check your internet connection
2. Refresh the page
3. Clear browser cache
4. Try logging out and back in
5. Contact support if issue persists

### Incorrect or Unhelpful Responses
1. Rephrase your question
2. Be more specific
3. Use the quick actions instead
4. Check the documentation directly
5. Report issues to administrators

### Missing Knowledge
Platform admins can:
1. Review common unanswered questions
2. Add custom Q&A pairs
3. Update existing entries
4. Refresh the knowledge base
5. Monitor usage statistics

## Privacy and Security

### Data Handling
- Conversations are logged for improvement
- No sensitive data is stored in chat logs
- User queries are encrypted in transit
- Access logs maintained for security

### Role-Based Security
- Chatbot respects user permissions
- Sensitive information only shown to authorized roles
- Admin functions require proper access
- Audit trail for configuration changes

## Tips for Effective Use

1. **Be Specific**: Clear questions get better answers
2. **Use Quick Actions**: Faster for common tasks
3. **Explore Documentation**: Comprehensive guides available
4. **Provide Feedback**: Help improve the chatbot
5. **Check Updates**: New knowledge added regularly

## Future Enhancements

Planned features:
- Voice input and output
- Multi-language support
- Advanced analytics
- Integration with external tools
- Personalized recommendations
- Proactive assistance

## Getting Help

If you need additional assistance:
- Use the chatbot's quick actions
- Access the documentation center
- Contact your platform administrator
- Submit feedback through the platform
- Email support (for critical issues)
