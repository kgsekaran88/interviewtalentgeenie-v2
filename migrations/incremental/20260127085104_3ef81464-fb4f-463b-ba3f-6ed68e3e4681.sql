-- Update the interview_invitation email template to use proper {{else}} logic
-- This fixes the issue where both is_reminder and is_initial content would render

UPDATE email_templates
SET 
  subject = '{{#if is_reminder}}Reminder {{reminder_number}}: {{else}}{{/if}}Interview Invitation - {{interview_title}}',
  html_content = '<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{#if is_reminder}}Reminder: {{else}}{{/if}}Interview Assessment Invitation</title>
</head>
<body>
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
<tbody><tr><td align="center" style="padding: 40px 10px;">
<table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #dddddd; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
<tbody><tr><td align="center" bgcolor="#4F46E5" style="padding: 30px 40px;">
<h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">{{#if is_reminder}}Friendly Reminder{{else}}Interview Assessment Invitation{{/if}}</h1>
</td></tr>
<tr><td style="padding: 40px 40px 30px 40px;">

{{#if is_reminder}}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fff3cd; border-radius: 8px; margin: 0 0 20px 0; border: 1px solid #ffc107;">
<tbody><tr><td style="padding: 15px;">
<p style="margin: 0; font-size: 14px; color: #856404;"><strong>⏰ Reminder {{reminder_number}} of 3:</strong> You have a pending interview invitation. Please complete it soon to avoid expiration.</p>
</td></tr>
</tbody></table>
{{/if}}

<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">Dear {{candidate_name}},</p>
<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">{{#if is_reminder}}This is a friendly reminder that you have a pending interview assessment{{else}}We are pleased to invite you to complete an interview assessment{{/if}}{{#if organization_name}} for the position with <strong>{{organization_name}}</strong>{{/if}}. This assessment provides you with a valuable opportunity to demonstrate your qualifications and experience directly relevant to the role.</p>
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #e8f5e9; border-radius: 8px; margin: 20px 0; border: 1px solid #c8e6c9;">
<tbody><tr><td style="padding: 20px;">
<p style="margin: 0 0 10px 0; font-size: 15px; color: #2e7d32;"><strong>Opportunity:</strong> {{interview_title}}</p>
<p style="margin: 0 0 10px 0; font-size: 15px; color: #2e7d32; white-space: nowrap;"><strong>Questions:</strong> {{question_count}} thoughtfully curated questions</p>
{{#if time_limit}}<p style="margin: 0; font-size: 15px; color: #2e7d32; white-space: nowrap;"><strong>⏳ Allotted Time:</strong> {{time_limit}} minutes</p>{{/if}}
</td></tr>
</tbody></table>

<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">To ensure a smooth and successful assessment experience, please review the following critical details carefully:</p>

<p style="margin: 0 0 10px 0; font-size: 17px; line-height: 24px; color: #4F46E5; font-weight: bold;">Essential Prerequisites &amp; Guidelines:</p>
<ul style="margin: 0 0 20px 20px; padding: 0; font-size: 15px; line-height: 22px; color: #333333;">
    <li style="margin-bottom: 12px;"><strong style="color: #666666;">Stable Internet Connection:</strong> A reliable and strong internet connection is absolutely crucial for uninterrupted participation and to prevent any technical disruptions during your assessment.</li>
    <li style="margin-bottom: 12px;"><strong style="color: #666666;">Quiet and Neat Environment:</strong> Please find a distraction-free space where you can concentrate fully. A clean and uncluttered background is also important for the proctoring process.</li>
    <li style="margin-bottom: 12px;"><strong style="color: #666666;">Webcam &amp; Microphone:</strong> A fully functional external or built-in webcam and microphone are MANDATORY. These will be used for identity verification and continuous proctoring throughout the assessment. Please test them beforehand.</li>
    <li style="margin-bottom: 12px;"><strong style="color: #666666;">Screen Sharing:</strong> You will be required to share your entire computer screen throughout the assessment. This is a critical component of our proctoring system to ensure a fair testing environment.</li>
    <li style="margin-bottom: 12px;"><strong style="color: #666666;">Recommended Browser:</strong> For the best experience, please use the latest stable version of Google Chrome or Mozilla Firefox. Ensure your browser is updated before starting the assessment.</li>
    <li style="margin-bottom: 12px;"><strong style="color: #666666;">Mobile Phones:</strong> Using a mobile phone for the assessment is strictly NOT recommended. Desktop or laptop devices provide the best experience.</li>
    <li style="margin-bottom: 12px;"><strong style="color: #666666;">Dedicated Tab/Window:</strong> Please ensure this assessment is opened in a dedicated browser tab or window. Switching tabs or applications during the test may be flagged by the proctoring system.</li>
</ul>

<p style="margin: 0 0 10px 0; font-size: 17px; line-height: 24px; color: #d84315; font-weight: bold;">⚠️ Important Warnings:</p>
<ul style="margin: 0 0 20px 20px; padding: 0; font-size: 15px; line-height: 22px; color: #333333;">
    <li style="margin-bottom: 12px; color: #d84315;"><strong>No Tab Switching:</strong> Do not switch to other browser tabs or applications during the assessment. This may trigger proctoring alerts.</li>
    <li style="margin-bottom: 12px; color: #d84315;"><strong>Stay Visible:</strong> Keep your face clearly visible in the webcam throughout the entire assessment.</li>
    <li style="margin-bottom: 12px; color: #d84315;"><strong>No External Help:</strong> Using external resources, notes, or assistance from others is strictly prohibited.</li>
</ul>

<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tbody><tr><td align="center" style="padding: 30px 0;">
<a href="{{share_link}}" style="display: inline-block; padding: 16px 32px; background-color: #4F46E5; color: #ffffff; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 8px;">🚀 Start Your Assessment</a>
</td></tr>
</tbody></table>

<p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #666666;">If you have any questions about the assessment or encounter technical difficulties, please contact the hiring team or our support.</p>

<p style="margin: 0; font-size: 14px; line-height: 22px; color: #333333;">Best of luck with your assessment!</p>
<p style="margin: 10px 0 0 0; font-size: 14px; line-height: 22px; color: #333333;">The {{#if organization_name}}{{organization_name}}{{else}}TalentGeenie{{/if}} Team</p>

</td></tr>
<tr><td style="padding: 20px 40px; background-color: #f8f9fa; border-top: 1px solid #eeeeee;">
<p style="margin: 0; font-size: 12px; line-height: 18px; color: #999999; text-align: center;">
This email was sent by {{#if organization_name}}{{organization_name}} via {{/if}}TalentGeenie.<br>
{{#if is_reminder}}You will receive up to 3 reminders for pending interviews.{{/if}}
</p>
</td></tr>
</tbody></table>
</td></tr>
</tbody></table>
</body>
</html>',
  updated_at = now()
WHERE template_key = 'interview_invitation' 
  AND organization_id IS NULL 
  AND is_active = true;