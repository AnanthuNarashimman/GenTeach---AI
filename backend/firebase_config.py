import firebase_admin
import json
import os
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def setup_firebase_credentials():
    """Setup Firebase credentials from environment variables"""
    credentials_json = os.getenv('FIREBASE_CREDENTIALS_JSON')
    if not credentials_json:
        raise ValueError("FIREBASE_CREDENTIALS_JSON environment variable not set. Please add it to your .env file.")
    
    try:
        # Parse the JSON credentials
        credentials_data = json.loads(credentials_json)
        
        # Create credentials object from dictionary
        cred = credentials.Certificate(credentials_data)
        
        # Get storage bucket from environment
        storage_bucket = os.getenv('FIREBASE_STORAGE_BUCKET')
        if not storage_bucket:
            raise ValueError("FIREBASE_STORAGE_BUCKET environment variable not set. Please add it to your .env file.")
        
        # Initialize Firebase app
        firebase_admin.initialize_app(cred, {
            'storageBucket': storage_bucket
        })
        
        return True
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in FIREBASE_CREDENTIALS_JSON: {e}")
    except Exception as e:
        raise ValueError(f"Error setting up Firebase credentials: {e}")

# Setup Firebase credentials
setup_firebase_credentials()

# Firestore database reference
db = firestore.client()

userCollection = db.collection('userCredentials')
usageCollection = db.collection('userUsage')
requestCollection = db.collection('userRequests')
approvalCollection = db.collection('Approvals')