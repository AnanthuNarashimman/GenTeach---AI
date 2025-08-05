# Gmail API Setup Guide for GenTeach

This guide will help you set up Gmail API for sending approval emails in the GenTeach application.

## Prerequisites

1. Google Cloud Project with billing enabled
2. Gmail account (for sending emails)
3. Domain-wide delegation setup (if using Google Workspace)

## Step 1: Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Library"
4. Search for "Gmail API"
5. Click on "Gmail API" and click "Enable"

## Step 2: Create Service Account

1. In Google Cloud Console, go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the details:
   - Name: `genteach-gmail-service`
   - Description: `Service account for GenTeach email functionality`
4. Click "Create and Continue"
5. Skip role assignment (we'll add specific permissions)
6. Click "Done"

## Step 3: Create and Download Service Account Key

1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Download the key file
6. Rename it to `client_secret_86334301735-5espsrctt3rvnao0veeg38b93gaf1l0a.apps.googleusercontent.com.json`
7. Place it in the `backend/` directory

## Step 4: Configure Domain-Wide Delegation (Recommended)

### For Google Workspace Users:

1. In Google Cloud Console, go to your service account
2. Copy the "Client ID" (not the email)
3. In your Google Workspace Admin Console:
   - Go to "Security" > "API Controls"
   - Click "Manage Domain Wide Delegation"
   - Add new API client
   - Client ID: [Your Service Account Client ID]
   - OAuth Scopes: `https://www.googleapis.com/auth/gmail.send`
4. Save the configuration

### For Regular Gmail Users:

You'll need to use OAuth 2.0 flow instead. See alternative setup below.

## Step 5: Update Configuration

1. Open `backend/app.py`
2. Update the `SENDER_EMAIL` variable to use a real Gmail address:
   ```python
   SENDER_EMAIL = 'your-email@gmail.com'  # Replace with your Gmail address
   ```

## Step 6: Test the Setup

Run the test script to verify your setup:

```bash
cd backend
python test_gmail_setup.py
```

## Alternative Setup: OAuth 2.0 Flow

If you don't have Google Workspace, you can use OAuth 2.0:

1. Create OAuth 2.0 credentials instead of service account
2. Download the client configuration file
3. Use the OAuth flow for authentication

## Troubleshooting

### Common Issues:

1. **"Gmail API not enabled"**
   - Enable Gmail API in Google Cloud Console

2. **"Service account doesn't have Gmail API permissions"**
   - Ensure domain-wide delegation is configured
   - Check that the OAuth scopes are correct

3. **"Using service account email instead of real Gmail address"**
   - Update `SENDER_EMAIL` to use a real Gmail address
   - Ensure the Gmail account has granted access to the service account

4. **"Authentication failed"**
   - Check that the service account key file is valid
   - Verify the file path is correct

### Testing Email Functionality:

1. Start your Flask application
2. Go to the admin panel
3. Try to approve a user request
4. Check the logs for any errors
5. Verify that the email was sent

## Security Notes

- Keep your service account key secure
- Add the key file to `.gitignore`
- Use environment variables for sensitive data in production
- Regularly rotate service account keys

## Production Considerations

1. Use environment variables for configuration
2. Implement proper error handling and retry logic
3. Add email templates for different scenarios
4. Implement email queuing for high-volume scenarios
5. Add monitoring and logging for email delivery

## Support

If you encounter issues:

1. Check the application logs for detailed error messages
2. Run the test script to diagnose setup issues
3. Verify all prerequisites are met
4. Test with a simple email first before integrating with the application 