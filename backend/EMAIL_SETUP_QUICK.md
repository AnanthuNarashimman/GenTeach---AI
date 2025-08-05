# Quick Email Setup Guide

## Option 1: Gmail App Password (EASIEST - Recommended)

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Enable 2-Factor Authentication if not already enabled

### Step 2: Generate App Password
1. Go to Google Account → Security
2. Find "App passwords" (under 2-Step Verification)
3. Generate a new app password for "Mail"
4. Copy the 16-character password

### Step 3: Update the Code
In `backend/app.py`, find these lines and update them:

```python
# Update this to your actual Gmail address
sender_email = "your-email@gmail.com"  # Replace with your Gmail
app_password = "your-app-password"     # Replace with your App Password
```

Change to:
```python
sender_email = "your-actual-email@gmail.com"  # Your real Gmail
app_password = "abcd efgh ijkl mnop"          # Your 16-char app password
```

### Step 4: Test
1. Start your Flask app
2. Try approving a user request
3. Check if the email is sent

## Option 2: Gmail API with OAuth 2.0 (Advanced)

If you want to use the Gmail API instead of SMTP:

### Step 1: Enable Gmail API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Gmail API for your project

### Step 2: Create OAuth 2.0 Credentials
1. Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
2. Choose "Web application"
3. Add authorized redirect URIs: `http://localhost:5000/oauth2callback`
4. Download the credentials file

### Step 3: Implement OAuth Flow
You'll need to implement the full OAuth 2.0 flow with:
- Authorization URL generation
- Token exchange
- Token storage and refresh

## Option 3: Use Environment Variables (Production)

For production, use environment variables:

```python
import os

sender_email = os.getenv('GMAIL_SENDER_EMAIL', 'your-email@gmail.com')
app_password = os.getenv('GMAIL_APP_PASSWORD', 'your-app-password')
```

Then set these environment variables:
```bash
export GMAIL_SENDER_EMAIL="your-email@gmail.com"
export GMAIL_APP_PASSWORD="your-app-password"
```

## Testing

After setup, test with:

```bash
cd backend
python test_gmail_setup.py
```

## Troubleshooting

### Common Issues:

1. **"Authentication failed"**
   - Check your Gmail address and app password
   - Make sure 2FA is enabled
   - Verify the app password is correct

2. **"SMTP error"**
   - Check your internet connection
   - Verify Gmail SMTP settings
   - Try using port 465 with SSL instead of 587 with TLS

3. **"Email not received"**
   - Check spam folder
   - Verify recipient email address
   - Check Gmail sending limits

## Quick Test

To test if emails work, you can temporarily add this to your app:

```python
@app.route('/test_email', methods=['GET'])
def test_email():
    result = send_approval_email("test@example.com", "Test User")
    return jsonify({"success": result})
```

Then visit `http://localhost:5000/test_email` to test email sending. 