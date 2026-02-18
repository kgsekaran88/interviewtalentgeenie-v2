# Training Management Guide

## Overview

The Training Management system allows administrators to create AI-powered, role-based training plans for employees. These plans include curated learning materials, structured topics, and practice assessments to validate knowledge.

## Accessing Training Management

**Prerequisites**: You must have the Admin role to access training management features.

1. Click "Admin" in the navigation bar
2. Select "Training Management"
3. Access the Training Management dashboard

## Creating Training Plans with AI

### Step 1: Enter Role Information

1. Navigate to the "Create/Edit Plan" tab
2. Fill in the required information:
   - **Role Name** (Required): e.g., "React Developer", "Data Engineer"
   - **Difficulty Level**: Choose from Beginner, Intermediate, or Advanced
   - **Role Description** (Optional): Provide additional context about the role

### Step 2: Generate Training Plan

1. Click "Generate Training Plan with AI"
2. AI analyzes the role requirements and generates:
   - Comprehensive list of topics
   - Subtopics for each main topic
   - Estimated duration for each topic
   - Curated learning materials (videos, articles, documentation)
   - Material types (video, article, tutorial, documentation)

### Step 3: Review Generated Content

The AI-generated plan displays:
- **Topic Cards**: Each topic with its subtopic and difficulty level
- **Learning Materials**: URLs to quality educational resources
- **Estimated Duration**: Time required to complete each topic
- **Material Descriptions**: Brief overview of each resource

### Step 4: Save the Training Plan

1. Review all generated topics and materials
2. Click "Save Training Plan" to create the plan
3. The plan becomes available for assignment to users

## Editing Existing Training Plans

### Loading a Plan for Editing

1. Navigate to "Existing Training Plans" section
2. Find the plan you want to modify
3. Click the "Edit" button
4. The plan details load into the editor with "Editing Mode" badge

### Making Changes

1. **Modify Basic Information**:
   - Update role name
   - Change difficulty level
   - Edit role description

2. **Regenerate Topics**:
   - Click "Regenerate Topics" to get fresh AI suggestions
   - Review new topics and materials
   - Compare with existing content

3. **Save Changes**:
   - Click "Update Training Plan"
   - Old topics and materials are replaced with new content
   - All assignments remain intact

### Canceling Edit Mode

- Click "Cancel Edit" button in the editing mode banner
- Form resets to create new plan mode
- No changes are saved

## Assigning Training Plans to Users

### Step 1: Navigate to Assign Tab

1. Click on "Assign Users" tab
2. View list of all registered users

### Step 2: Select User and Plan

1. Find the user in the list
2. Click the dropdown next to their name
3. Select a training plan from the list
4. Assignment is created immediately

### Current Assignments View

The "Current Assignments" section shows:
- User name and email
- Assigned training plan
- Assignment date
- Progress percentage
- Current status (assigned, in_progress, completed)

## Managing Training Plans

### Viewing Existing Plans

The "Existing Training Plans" section displays:
- Plan name (role name)
- Difficulty level
- Number of topics
- Action buttons (Edit, Delete)

### Deleting Plans

1. Click the trash icon next to the plan
2. Confirm deletion in the dialog
3. Plan is deactivated (soft delete)
4. Assignments are preserved for historical records

**Note**: Deleting a plan doesn't remove user assignments or progress data.

## Analytics and Progress Tracking

### Viewing Assignment Analytics

Navigate to the "Analytics" tab to see:
- Total number of assignments
- Completion rates
- Average progress across all users
- Most popular training plans
- User engagement metrics

### Individual Progress Tracking

For each user:
- View which topics they've started
- See materials they've marked as complete
- Track assessment scores
- Monitor overall progress percentage

## Best Practices

### Creating Effective Training Plans

1. **Be Specific with Role Names**:
   - Use industry-standard job titles
   - Include seniority level if relevant
   - Be clear about specialization

2. **Provide Detailed Descriptions**:
   - Include key responsibilities
   - List required technologies
   - Mention prerequisites if any

3. **Choose Appropriate Difficulty**:
   - Beginner: New to the role or technology
   - Intermediate: Some experience, need to level up
   - Advanced: Deep expertise required

### Editing Plans Wisely

1. **Review Before Regenerating**:
   - Check current content quality
   - Identify specific areas needing improvement
   - Consider user feedback

2. **Test After Updates**:
   - Assign to yourself first
   - Verify all materials are accessible
   - Check material relevance

3. **Communicate Changes**:
   - Notify users when plans are updated
   - Explain major changes
   - Provide guidance on new content

### Assignment Strategy

1. **Group Assignments**:
   - Assign similar roles together
   - Create cohorts for peer learning
   - Coordinate start dates

2. **Monitor Progress**:
   - Check in regularly
   - Offer support where needed
   - Celebrate completions

3. **Iterate Based on Feedback**:
   - Collect user feedback
   - Update plans based on outcomes
   - Refine difficulty levels

## Learner Experience

### For Users Assigned to Training Plans

Users can access their assigned plans via:
1. "Learning" menu → "My Learning Plan"
2. View all assigned training plans
3. See progress for each plan
4. Access learning materials
5. Mark materials as complete
6. Take practice assessments

### Progress Tracking Features

- **Visual Progress Bars**: See completion percentage
- **Topic Status**: Not started, In Progress, Completed
- **Material Completion**: Checkboxes for each resource
- **Assessment Scores**: Track practice test results

## Troubleshooting

### AI Generation Issues

**Problem**: AI fails to generate topics
- **Solution**: Check internet connection, verify API is working, try again

**Problem**: Generated content is not relevant
- **Solution**: Provide more detailed role description, be more specific with role name

### Assignment Issues

**Problem**: User doesn't see assigned plan
- **Solution**: Verify user has Candidate role (not Guest), check assignment was successful

**Problem**: Progress not updating
- **Solution**: Refresh page, verify user is marking materials complete properly

### Editing Issues

**Problem**: Can't load plan for editing
- **Solution**: Check you have Admin role, verify plan exists and is active

**Problem**: Changes not saving
- **Solution**: Check all required fields filled, verify network connection

## Support

For additional assistance with training management:
- Contact system administrator
- Check technical documentation
- Review user feedback for plan improvements
- Submit feature requests through admin portal

---

**Version**: 1.0  
**Last Updated**: 2025  
**Document Type**: Training Management Guide
