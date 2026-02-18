# ATS Webhook Integration - Migration Guide

## Overview

This guide helps ATS integration partners migrate to the new secure webhook signature verification system. The new system uses HMAC-SHA256 signatures with timestamp binding to prevent replay attacks and ensure webhook authenticity.

---

## What Changed?

### Before (Insecure)
- Webhooks accepted without verification
- No replay attack protection
- Vulnerable to spoofing

### After (Secure)
- HMAC-SHA256 signature required
- Timestamp validation (5-minute window)
- Replay attack prevention via request ID tracking
- Constant-time signature comparison

---

## Migration Timeline

- **Deadline**: February 15, 2025
- **Grace Period**: Old webhooks will be rejected after deadline
- **Support**: Contact support@talentgeenie.com

---

## Step 1: Obtain Your Webhook Secret

Contact your TalentGeenie account manager or retrieve from the partner dashboard:

1. Log in to TalentGeenie Partner Portal
2. Navigate to **Integrations** → **ATS Settings**
3. Copy your **Webhook Secret** (keep this secure!)

Example:
```
webhook_secret: sk_live_abc123def456ghi789jkl012mno345pqr
```

**Security**: Never commit this secret to version control!

---

## Step 2: Generate HMAC-SHA256 Signature

### Signature Format

```
Signature = HMAC-SHA256(webhook_secret, "{timestamp}.{json_body}")
```

### Required Headers

```http
POST /functions/v1/ats-webhook HTTP/1.1
Content-Type: application/json
x-webhook-signature: <computed_signature>
x-webhook-timestamp: <unix_timestamp>

{
  "integrationId": "your-integration-id",
  "event": "candidate.created",
  "candidate": { ... }
}
```

---

## Step 3: Implementation Examples

### Node.js (Express)

```javascript
const crypto = require('crypto');
const axios = require('axios');

// Your webhook secret from TalentGeenie
const WEBHOOK_SECRET = process.env.TALENTGEENIE_WEBHOOK_SECRET;
const WEBHOOK_URL = 'https://vtztavcqjmirktkjdprm.supabase.co/functions/v1/ats-webhook';

function sendWebhook(payload) {
  // Generate timestamp (current time in seconds)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Convert payload to JSON string
  const jsonBody = JSON.stringify(payload);
  
  // Create signed payload: "{timestamp}.{json_body}"
  const signedPayload = `${timestamp}.${jsonBody}`;
  
  // Compute HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');
  
  // Send webhook with signature headers
  return axios.post(WEBHOOK_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp
    }
  });
}

// Example usage
const candidateData = {
  integrationId: 'your-integration-id-uuid',
  event: 'candidate.created',
  requestId: 'unique-request-id-123', // For replay protection
  candidate: {
    id: 'candidate_ext_001',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '+1234567890',
    resume_url: 'https://example.com/resumes/jane-doe.pdf',
    skills: ['JavaScript', 'React', 'Node.js'],
    experience_years: 5,
    current_position: 'Senior Frontend Developer',
    current_company: 'Tech Corp',
    education: [
      {
        degree: 'B.Sc. Computer Science',
        institution: 'University of Example',
        year: 2018
      }
    ],
    source: 'LinkedIn',
    applied_position: 'Lead Frontend Engineer',
    status: 'screening'
  }
};

sendWebhook(candidateData)
  .then(response => {
    console.log('Webhook sent successfully:', response.data);
  })
  .catch(error => {
    console.error('Webhook failed:', error.response?.data || error.message);
  });
```

---

### Python (Requests)

```python
import hmac
import hashlib
import time
import json
import requests

# Your webhook secret from TalentGeenie
WEBHOOK_SECRET = "sk_live_abc123def456ghi789jkl012mno345pqr"
WEBHOOK_URL = "https://vtztavcqjmirktkjdprm.supabase.co/functions/v1/ats-webhook"

def send_webhook(payload):
    # Generate timestamp (current time in seconds)
    timestamp = str(int(time.time()))
    
    # Convert payload to JSON string
    json_body = json.dumps(payload, separators=(',', ':'))
    
    # Create signed payload: "{timestamp}.{json_body}"
    signed_payload = f"{timestamp}.{json_body}"
    
    # Compute HMAC-SHA256 signature
    signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Send webhook with signature headers
    headers = {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
        'x-webhook-timestamp': timestamp
    }
    
    response = requests.post(WEBHOOK_URL, json=payload, headers=headers)
    return response

# Example usage
candidate_data = {
    "integrationId": "your-integration-id-uuid",
    "event": "candidate.created",
    "requestId": "unique-request-id-123",
    "candidate": {
        "id": "candidate_ext_001",
        "name": "Jane Doe",
        "email": "jane.doe@example.com",
        "phone": "+1234567890",
        "resume_url": "https://example.com/resumes/jane-doe.pdf",
        "skills": ["JavaScript", "React", "Node.js"],
        "experience_years": 5,
        "current_position": "Senior Frontend Developer",
        "current_company": "Tech Corp",
        "education": [
            {
                "degree": "B.Sc. Computer Science",
                "institution": "University of Example",
                "year": 2018
            }
        ],
        "source": "LinkedIn",
        "applied_position": "Lead Frontend Engineer",
        "status": "screening"
    }
}

try:
    response = send_webhook(candidate_data)
    print(f"Webhook sent successfully: {response.json()}")
except Exception as e:
    print(f"Webhook failed: {str(e)}")
```

---

### PHP (cURL)

```php
<?php

// Your webhook secret from TalentGeenie
define('WEBHOOK_SECRET', 'sk_live_abc123def456ghi789jkl012mno345pqr');
define('WEBHOOK_URL', 'https://vtztavcqjmirktkjdprm.supabase.co/functions/v1/ats-webhook');

function sendWebhook($payload) {
    // Generate timestamp (current time in seconds)
    $timestamp = time();
    
    // Convert payload to JSON string
    $jsonBody = json_encode($payload, JSON_UNESCAPED_SLASHES);
    
    // Create signed payload: "{timestamp}.{json_body}"
    $signedPayload = $timestamp . '.' . $jsonBody;
    
    // Compute HMAC-SHA256 signature
    $signature = hash_hmac('sha256', $signedPayload, WEBHOOK_SECRET);
    
    // Send webhook with signature headers
    $ch = curl_init(WEBHOOK_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $jsonBody,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-webhook-signature: ' . $signature,
            'x-webhook-timestamp: ' . $timestamp
        ],
        CURLOPT_RETURNTRANSFER => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'status' => $httpCode,
        'response' => json_decode($response, true)
    ];
}

// Example usage
$candidateData = [
    'integrationId' => 'your-integration-id-uuid',
    'event' => 'candidate.created',
    'requestId' => 'unique-request-id-123',
    'candidate' => [
        'id' => 'candidate_ext_001',
        'name' => 'Jane Doe',
        'email' => 'jane.doe@example.com',
        'phone' => '+1234567890',
        'resume_url' => 'https://example.com/resumes/jane-doe.pdf',
        'skills' => ['JavaScript', 'React', 'Node.js'],
        'experience_years' => 5,
        'current_position' => 'Senior Frontend Developer',
        'current_company' => 'Tech Corp',
        'education' => [
            [
                'degree' => 'B.Sc. Computer Science',
                'institution' => 'University of Example',
                'year' => 2018
            ]
        ],
        'source' => 'LinkedIn',
        'applied_position' => 'Lead Frontend Engineer',
        'status' => 'screening'
    ]
];

$result = sendWebhook($candidateData);
if ($result['status'] === 200) {
    echo "Webhook sent successfully\n";
} else {
    echo "Webhook failed: " . json_encode($result['response']) . "\n";
}
?>
```

---

### Ruby (Net::HTTP)

```ruby
require 'net/http'
require 'json'
require 'openssl'
require 'time'

# Your webhook secret from TalentGeenie
WEBHOOK_SECRET = 'sk_live_abc123def456ghi789jkl012mno345pqr'
WEBHOOK_URL = 'https://vtztavcqjmirktkjdprm.supabase.co/functions/v1/ats-webhook'

def send_webhook(payload)
  # Generate timestamp (current time in seconds)
  timestamp = Time.now.to_i.to_s
  
  # Convert payload to JSON string
  json_body = JSON.generate(payload)
  
  # Create signed payload: "{timestamp}.{json_body}"
  signed_payload = "#{timestamp}.#{json_body}"
  
  # Compute HMAC-SHA256 signature
  signature = OpenSSL::HMAC.hexdigest('SHA256', WEBHOOK_SECRET, signed_payload)
  
  # Send webhook with signature headers
  uri = URI(WEBHOOK_URL)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  
  request = Net::HTTP::Post.new(uri.path)
  request['Content-Type'] = 'application/json'
  request['x-webhook-signature'] = signature
  request['x-webhook-timestamp'] = timestamp
  request.body = json_body
  
  response = http.request(request)
  response
end

# Example usage
candidate_data = {
  integrationId: 'your-integration-id-uuid',
  event: 'candidate.created',
  requestId: 'unique-request-id-123',
  candidate: {
    id: 'candidate_ext_001',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '+1234567890',
    resume_url: 'https://example.com/resumes/jane-doe.pdf',
    skills: ['JavaScript', 'React', 'Node.js'],
    experience_years: 5,
    current_position: 'Senior Frontend Developer',
    current_company: 'Tech Corp',
    education: [
      {
        degree: 'B.Sc. Computer Science',
        institution: 'University of Example',
        year: 2018
      }
    ],
    source: 'LinkedIn',
    applied_position: 'Lead Frontend Engineer',
    status: 'screening'
  }
}

response = send_webhook(candidate_data)
if response.code == '200'
  puts "Webhook sent successfully: #{response.body}"
else
  puts "Webhook failed: #{response.code} - #{response.body}"
end
```

---

### Java (Apache HttpClient)

```java
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import com.google.gson.Gson;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class WebhookSender {
    private static final String WEBHOOK_SECRET = "sk_live_abc123def456ghi789jkl012mno345pqr";
    private static final String WEBHOOK_URL = "https://vtztavcqjmirktkjdprm.supabase.co/functions/v1/ats-webhook";
    
    public static void sendWebhook(Map<String, Object> payload) throws Exception {
        // Generate timestamp
        String timestamp = String.valueOf(System.currentTimeMillis() / 1000);
        
        // Convert payload to JSON
        Gson gson = new Gson();
        String jsonBody = gson.toJson(payload);
        
        // Create signed payload
        String signedPayload = timestamp + "." + jsonBody;
        
        // Compute HMAC-SHA256 signature
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(
            WEBHOOK_SECRET.getBytes(StandardCharsets.UTF_8), 
            "HmacSHA256"
        );
        mac.init(secretKey);
        byte[] hmacBytes = mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8));
        
        // Convert to hex
        StringBuilder signature = new StringBuilder();
        for (byte b : hmacBytes) {
            signature.append(String.format("%02x", b));
        }
        
        // Send webhook
        CloseableHttpClient client = HttpClients.createDefault();
        HttpPost post = new HttpPost(WEBHOOK_URL);
        post.setHeader("Content-Type", "application/json");
        post.setHeader("x-webhook-signature", signature.toString());
        post.setHeader("x-webhook-timestamp", timestamp);
        post.setEntity(new StringEntity(jsonBody));
        
        var response = client.execute(post);
        System.out.println("Response: " + EntityUtils.toString(response.getEntity()));
    }
    
    public static void main(String[] args) {
        try {
            Map<String, Object> candidate = new HashMap<>();
            candidate.put("id", "candidate_ext_001");
            candidate.put("name", "Jane Doe");
            candidate.put("email", "jane.doe@example.com");
            candidate.put("skills", Arrays.asList("JavaScript", "React", "Node.js"));
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("integrationId", "your-integration-id-uuid");
            payload.put("event", "candidate.created");
            payload.put("requestId", "unique-request-id-123");
            payload.put("candidate", candidate);
            
            sendWebhook(payload);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

---

## Step 4: Testing Your Implementation

### Test Webhook Endpoint

Use our test endpoint to verify your signature implementation:

```bash
curl -X POST https://vtztavcqjmirktkjdprm.supabase.co/functions/v1/ats-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: YOUR_COMPUTED_SIGNATURE" \
  -H "x-webhook-timestamp: CURRENT_TIMESTAMP" \
  -d '{
    "integrationId": "test-integration-id",
    "event": "candidate.created",
    "requestId": "test-request-123",
    "candidate": {
      "id": "test_001",
      "name": "Test Candidate",
      "email": "test@example.com"
    }
  }'
```

### Expected Responses

**Success (200)**:
```json
{
  "success": true,
  "message": "Candidate synced successfully",
  "candidate": { ... }
}
```

**Invalid Signature (401)**:
```json
{
  "error": "Invalid webhook signature"
}
```

**Missing Timestamp (401)**:
```json
{
  "error": "Missing webhook timestamp"
}
```

**Timestamp Too Old (401)**:
```json
{
  "error": "Request timestamp invalid - must be within 5 minutes"
}
```

**Duplicate Request (409)**:
```json
{
  "error": "Duplicate request - already processed"
}
```

---

## Common Issues & Troubleshooting

### Issue 1: Signature Mismatch

**Symptoms**: Getting 401 "Invalid webhook signature"

**Causes**:
- Incorrect secret
- Wrong timestamp format
- JSON formatting differences (whitespace, key order)

**Solution**:
```javascript
// Ensure consistent JSON serialization
const jsonBody = JSON.stringify(payload); // No extra spaces
const signedPayload = `${timestamp}.${jsonBody}`;
```

### Issue 2: Timestamp Validation Failing

**Symptoms**: "Request timestamp invalid"

**Causes**:
- Server time drift
- Using milliseconds instead of seconds
- Timezone issues

**Solution**:
```javascript
// Use seconds, not milliseconds
const timestamp = Math.floor(Date.now() / 1000); // Correct
// NOT: Date.now() (milliseconds)
```

### Issue 3: Duplicate Request Errors

**Symptoms**: 409 "Duplicate request - already processed"

**Cause**: Using same requestId multiple times

**Solution**: Generate unique requestId for each webhook:
```javascript
const requestId = `${Date.now()}_${Math.random().toString(36)}`;
```

---

## Security Best Practices

1. **Never Log Webhook Secrets**: Avoid logging the secret in production
2. **Use Environment Variables**: Store secret in env vars, not code
3. **Validate Timestamp**: Always check timestamp is recent (within 5 min)
4. **Unique Request IDs**: Use UUID or timestamp-based IDs
5. **HTTPS Only**: Never send webhooks over HTTP
6. **Rotate Secrets**: Rotate webhook secrets every 90 days

---

## Support & Contact

### Technical Support
- Email: dev-support@talentgeenie.com
- Slack: #ats-integrations
- Documentation: https://docs.talentgeenie.com/ats-webhooks

### Account Management
- Email: partnerships@talentgeenie.com
- Phone: +1 (555) 123-4567

---

## Migration Checklist

- [ ] Retrieved webhook secret from partner portal
- [ ] Updated code to generate HMAC-SHA256 signatures
- [ ] Added timestamp header generation
- [ ] Implemented requestId for replay protection
- [ ] Tested with test endpoint
- [ ] Verified all webhook events work correctly
- [ ] Deployed to production
- [ ] Notified TalentGeenie of migration completion

---

**Last Updated**: January 11, 2025  
**Document Version**: 2.0
