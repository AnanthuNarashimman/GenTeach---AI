# Environment Setup for GenTeach Backend

This document explains how to set up the environment variables for the GenTeach backend application.

## Prerequisites

1. Python 3.8 or higher
2. Required Python packages (install via `pip install -r requirements.txt`)
3. Google Cloud Project with necessary APIs enabled
4. Firebase project with Firestore and Storage enabled

## Environment Variables Setup

### 1. Create .env file

Create a `.env` file in the `backend` directory with the following variables:

```env
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Google Cloud Project Configuration
GCP_PROJECT_ID=your_gcp_project_id

# Firebase Configuration
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket

# Flask Configuration
FLASK_SECRET_KEY=your_flask_secret_key

# Service Account Credentials (JSON format)
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"your_project_id",...}

FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"your_firebase_project_id",...}
```

### 2. Required Environment Variables

#### GEMINI_API_KEY
- **Description**: Your Google Gemini API key
- **How to get**: Create a project in Google AI Studio and generate an API key
- **Format**: String

#### GCP_PROJECT_ID
- **Description**: Your Google Cloud Project ID
- **How to get**: From your Google Cloud Console project settings
- **Format**: String (e.g., "my-project-123456")

#### FIREBASE_STORAGE_BUCKET
- **Description**: Your Firebase Storage bucket URL
- **How to get**: From Firebase Console > Storage > Files
- **Format**: String (e.g., "my-project.appspot.com")

#### FLASK_SECRET_KEY
- **Description**: Secret key for Flask sessions
- **How to get**: Generate a random string
- **Format**: String

#### GOOGLE_APPLICATION_CREDENTIALS_JSON
- **Description**: Google Cloud service account credentials for TTS and Vertex AI
- **How to get**: 
  1. Go to Google Cloud Console > IAM & Admin > Service Accounts
  2. Create a new service account or use existing one
  3. Create a new key (JSON format)
  4. Copy the entire JSON content
- **Format**: JSON string (escaped for .env file)

#### FIREBASE_CREDENTIALS_JSON
- **Description**: Firebase Admin SDK service account credentials
- **How to get**:
  1. Go to Firebase Console > Project Settings > Service Accounts
  2. Click "Generate new private key"
  3. Copy the entire JSON content
- **Format**: JSON string (escaped for .env file)

## Security Notes

1. **Never commit the .env file** - It's already in .gitignore
2. **Never commit JSON credential files** - They're also in .gitignore
3. **Use different credentials for development and production**
4. **Rotate API keys regularly**
5. **Limit service account permissions to minimum required**

## Running the Application

1. Ensure all environment variables are set in `.env`
2. Install dependencies: `pip install -r requirements.txt`
3. Run the application: `python app.py`

## Troubleshooting

### Common Issues

1. **"Environment variable not set" errors**
   - Check that all required variables are in your `.env` file
   - Ensure the `.env` file is in the correct location (backend directory)

2. **JSON parsing errors**
   - Ensure JSON credentials are properly escaped in the `.env` file
   - Check that the JSON is valid

3. **Authentication errors**
   - Verify that service account credentials are correct
   - Ensure the service account has the necessary permissions
   - Check that the project IDs match your actual projects

4. **Import errors**
   - Ensure all required packages are installed
   - Check that you're running from the correct directory

### Getting Help

If you encounter issues:
1. Check the application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test your credentials independently
4. Ensure your Google Cloud and Firebase projects are properly configured 