-- Insert the interview_reminder email template with correct array syntax
INSERT INTO public.email_templates (template_key, subject, html_content, description, available_variables, is_active)
VALUES (
  'interview_reminder',
  'Reminder: Complete Your {{interview_title}} Interview',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #4F46E5;">Friendly Reminder</h2>
    <p>Hi {{candidate_name}},</p>
    <p>This is a friendly reminder that you have a pending interview invitation for <strong>{{interview_title}}</strong> from <strong>{{organization_name}}</strong>.</p>
    <p><strong>Interview Details:</strong></p>
    <ul>
      <li>Questions: {{question_count}}</li>
      <li>Time Limit: {{time_limit}} minutes</li>
    </ul>
    <p>This is reminder {{reminder_number}} of 3. Please complete your interview soon to avoid expiration.</p>
    <p style="margin: 30px 0;">
      <a href="{{share_link}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Interview Now</a>
    </p>
    <p style="color: #666; font-size: 14px;">If you have any questions, please contact the hiring team.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">This reminder was sent automatically. You will receive a maximum of 3 reminders.</p>
  </div>',
  'Automatic reminder for pending interview invitations',
  ARRAY['candidate_name', 'interview_title', 'organization_name', 'question_count', 'time_limit', 'reminder_number', 'share_link'],
  true
)
ON CONFLICT (template_key) WHERE organization_id IS NULL DO UPDATE SET
  html_content = EXCLUDED.html_content,
  subject = EXCLUDED.subject,
  description = EXCLUDED.description,
  available_variables = EXCLUDED.available_variables;

-- Insert notification template for HR when max reminders reached
INSERT INTO public.email_templates (template_key, subject, html_content, description, available_variables, is_active)
VALUES (
  'candidate_unresponsive',
  'Candidate Unresponsive: {{candidate_name}} - {{interview_title}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #DC2626;">Candidate Unresponsive Alert</h2>
    <p>Hi {{recruiter_name}},</p>
    <p>We wanted to let you know that <strong>{{candidate_name}}</strong> ({{candidate_email}}) has not responded to the interview invitation for <strong>{{interview_title}}</strong> after 3 reminder emails.</p>
    <p><strong>Details:</strong></p>
    <ul>
      <li>Invitation sent: {{invitation_date}}</li>
      <li>Reminders sent: 3</li>
      <li>Last reminder: {{last_reminder_date}}</li>
    </ul>
    <p>The invitation has been marked as expired. You may want to follow up directly or consider other candidates.</p>
    <p style="margin: 30px 0;">
      <a href="{{dashboard_url}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a>
    </p>
  </div>',
  'Notification to HR when candidate does not respond after max reminders',
  ARRAY['recruiter_name', 'candidate_name', 'candidate_email', 'interview_title', 'invitation_date', 'last_reminder_date', 'dashboard_url'],
  true
)
ON CONFLICT (template_key) WHERE organization_id IS NULL DO UPDATE SET
  html_content = EXCLUDED.html_content,
  subject = EXCLUDED.subject,
  description = EXCLUDED.description,
  available_variables = EXCLUDED.available_variables;