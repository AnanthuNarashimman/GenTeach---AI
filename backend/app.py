import os
import re
import json
import uuid
import logging
import base64
import requests
from datetime import timedelta, datetime
from flask import Flask, request, jsonify, session, send_from_directory
from dotenv import load_dotenv
import google.generativeai as genai
from flask_cors import CORS
from google.cloud import texttospeech
from firebase_config import db, userCollection, usageCollection, requestCollection, approvalCollection
from firebase_admin import firestore
import bcrypt
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart 

from firebase_admin import storage

# For approval system
from urllib.parse import quote_plus

# For image generation dummy fallback
from PIL import Image, ImageDraw, ImageFont
import io

# Vertex AI imports for image generation
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel

# Imports for video generation
from pydub import AudioSegment
import numpy as np

# MoviePy specific imports
from moviepy.video.VideoClip import ColorClip, ImageClip, TextClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from moviepy.audio.io.AudioFileClip import AudioFileClip

# Moviepy configuration
import moviepy.config as mc

# IMPORTANT: SET THE CORRECT PATH TO YOUR MAGICK.EXE HERE
# Example path for ImageMagick 7.x (adjust if yours is different):
# If running on Windows:
# mc.IMAGEMAGICK_BINARY = r"C:\Program Files\ImageMagick-7.1.1-Q16-HDRI\magick.exe"
# If running on Linux/macOS, it might be automatically found if installed and in PATH.
# Otherwise, specify the path to 'magick' executable.
# For example, on Linux:
# mc.IMAGEMAGICK_BINARY = "/usr/bin/magick"
# You might need to install ImageMagick: https://imagemagick.org/script/download.php
# And FFmpeg: https://ffmpeg.org/download.html
# Please ensure both are correctly installed and configured in your system's PATH.
# If you encounter errors, try setting this path explicitly if MoviePy can't find it.


# Loading env variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Secret Key configuration
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'hello-world')
if not app.secret_key:
    logger.warning("WARNING: FLASK_SECRET_KEY environment variable not set. Using a default for development.")
    logger.warning("         Please set FLASK_SECRET_KEY in your .env file for production security.")
    app.secret_key = "a_fallback_secret_key_for_dev_only_change_this_in_production_12345"

# Session configuration - Configure session settings
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)  # Reduced to 24 hours
app.config['SESSION_PERMANENT'] = False  # Don't make all sessions permanent by default

app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevent XSS attacks
# Note: For Gmail API to work, you need to:
# 1. Enable Gmail API in Google Cloud Console
# 2. Create a service account with domain-wide delegation
# 3. Delegate Gmail API access to the service account
# 4. Use a real Gmail address that has granted access to the service account

# Setting up CORS
CORS(app,
     supports_credentials=True,
     origins=["http://localhost:5173", "https://gen-teach-ai-kd7v.vercel.app"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type"])

# Gemini API Configuration
gemini_api_key = os.getenv('GEMINI_API_KEY').strip()
print(gemini_api_key)
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY environment variable not set. Please add it to your .env file.")
genai.configure(api_key=gemini_api_key)

# Initialize the Gemini model
model = genai.GenerativeModel('gemini-1.5-flash-latest')

# Google Cloud TTS setup
def setup_google_credentials():
    """Setup Google Cloud credentials from environment variables"""
    credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
    if not credentials_json:
        raise ValueError("GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set. Please add it to your .env file.")
    
    try:
        # Parse the JSON credentials
        credentials_data = json.loads(credentials_json)
        
        # Create a temporary credentials file
        temp_credentials_path = os.path.join(TEMP_FOLDER, 'google_credentials.json')
        with open(temp_credentials_path, 'w') as f:
            json.dump(credentials_data, f)
        
        # Set the environment variable to point to the temporary file
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = temp_credentials_path
        logger.info(f"Google Cloud credentials set up from environment variables")
        return temp_credentials_path
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON: {e}")
    except Exception as e:
        raise ValueError(f"Error setting up Google Cloud credentials: {e}")


# Defining directory for storing temporary files (only for processing)
TEMP_FOLDER = os.path.join(app.root_path, 'temp')
os.makedirs(TEMP_FOLDER, exist_ok=True)

# Defining directory for custom fonts 
FONTS_FOLDER = os.path.join(app.root_path, 'fonts')
os.makedirs(FONTS_FOLDER, exist_ok=True)

# Defining directory for background patterns
PATTERNS_FOLDER = os.path.join(app.root_path, 'static', 'background')
os.makedirs(PATTERNS_FOLDER, exist_ok=True)

# Setup Google Cloud credentials
google_credentials_path = setup_google_credentials()

# Session management middleware
@app.before_request
def before_request():
    """Handle session management before each request"""
    # List of endpoints that don't require authentication
    public_endpoints = [
        'login', 'register', 'request_account', 'verify_approval_token',
        'static', 'sessionclear'
    ]

    # Skip session checks for OPTIONS requests and public endpoints
    if request.method == 'OPTIONS' or request.endpoint in public_endpoints:
        return

    # For authenticated endpoints, check if user is logged in
    if request.endpoint and 'admin' not in request.endpoint:
        # Only create/maintain session if user is actually logged in
        if 'user_id' not in session and request.endpoint not in ['check_session']:
            # Don't automatically create sessions for unauthenticated users
            pass

@app.after_request
def after_request(response):
    """Handle session cleanup after each request"""
    # If session is empty and not permanent, ensure it's properly cleaned up
    if not session and not session.permanent:
        response.set_cookie('session', '', expires=0, secure=True, httponly=True, samesite='None')
    return response





def upload_to_firebase(local_filepath, destination_folder, filename, user_id):
    """Uploads a file to Firebase Storage, organizing by user ID."""
    try:
        if not user_id:
            logger.error("User ID is required for Firebase upload")
            raise ValueError("User ID is required for file upload")
            
        destination_blob_name = f"users/{user_id}/{destination_folder}/{filename}"

        bucket = storage.bucket()
        blob = bucket.blob(destination_blob_name)
        
        blob.upload_from_filename(local_filepath)
        blob.make_public()
        
        logger.info(f"File {local_filepath} uploaded to {destination_blob_name}.")
        return blob.public_url
    except Exception as e:
        logger.error(f"Error uploading to Firebase: {e}")
        raise
    finally:
        if os.path.exists(local_filepath):
            os.remove(local_filepath)



# Conversation State Management 
# Since Gemini is stateless (Doesn't remember previous chats), it is difficult to manage the state of query. So a set of state variables are create to let gemini know what kind of request it gets.
# States: 'IDLE', 'AWAITING_SUBTOPIC_SELECTION', 'AWAITING_CONFIRMATION','SCRIPT_GENERATED', 'AUDIO_GENERATED', 'VIDEO_GENERATED', 'BOTH_GENERATED', 'IMAGES_GENERATED'


# Route to clear session. Used to clear current state, and other information about currently generated contents from session while discarding a chat, enabling users to start a new fresh chat.
@app.route('/sessionclear', methods=['GET', 'OPTIONS'])
def sessionclear():
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    # Only clear conversation-related session data, keep user authentication
    user_id = session.get('user_id')

    # Clear conversation state
    session['conversation_state'] = "IDLE"
    session['context_topic'] = ''

    # Safely remove session keys if they exist
    session_keys_to_remove = [
        'image_url', 'audio_url', 'video_url', 'video_script',
        'video_summary', 'quiz_content', 'final_topic',
        'suggested_subtopics'
    ]
    for key in session_keys_to_remove:
        if key in session:
            del session[key]

    session.modified = True
    logger.info(f"Conversation session cleared for user: {user_id}")

    response = jsonify({"message": "Session cleared!"})
    response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Note: Static file serving routes removed as files are now stored in Firebase Storage
# Files are accessed directly via Firebase URLs


@app.route('/get_script_content', methods=['POST'])
def get_script_content():
    """Get script content from Firebase Storage."""
    if 'user_id' not in session:
        print("No user ID in session for script content")
        return jsonify({"error": "User not logged in"}), 401
    
    data = request.get_json()
    script_url = data.get('url')
    
    print(f"Fetching script content from URL: {script_url}")
    
    if not script_url:
        print("No script URL provided")
        return jsonify({"error": "Script URL is required"}), 400
    
    try:
        # Download the script content from Firebase URL
        print("Making request to Firebase URL...")
        response = requests.get(script_url, timeout=10)
        print(f"Response status: {response.status_code}")
        
        response.raise_for_status()
        
        content = response.text
        print(f"Content length: {len(content)} characters")
        return jsonify({"content": content})
        
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        logger.error(f"Request error fetching script content: {e}")
        
        # Try fallback method using Firebase Storage directly
        try:
            print("Trying fallback method with Firebase Storage...")
            bucket = storage.bucket()
            
            # Extract blob name from URL
            # URL format: https://storage.googleapis.com/bucket-name/users/user_id/script/filename.txt
            url_parts = script_url.split('/')
            if len(url_parts) >= 4:
                # Find the index after 'users'
                try:
                    users_index = url_parts.index('users')
                    blob_name = '/'.join(url_parts[users_index:])
                    print(f"Extracted blob name: {blob_name}")
                    
                    blob = bucket.blob(blob_name)
                    if blob.exists():
                        content = blob.download_as_text()
                        print(f"Fallback successful, content length: {len(content)}")
                        return jsonify({"content": content})
                    else:
                        print("Blob does not exist")
                except ValueError:
                    print("Could not extract blob name from URL")
            
        except Exception as fallback_error:
            print(f"Fallback method also failed: {fallback_error}")
        
        return jsonify({"error": f"Failed to fetch script content: {str(e)}"}), 500
    except Exception as e:
        print(f"General error: {e}")
        logger.error(f"Error fetching script content: {e}")
        return jsonify({"error": f"Failed to fetch script content: {str(e)}"}), 500

@app.route('/download_script', methods=['POST'])
def download_script():
    """Download script file from Firebase Storage."""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    data = request.get_json()
    script_url = data.get('url')
    
    if not script_url:
        return jsonify({"error": "Script URL is required"}), 400
    
    try:
        # Download the script content from Firebase URL
        response = requests.get(script_url, timeout=10)
        response.raise_for_status()
        
        content = response.text
        
        # Return the content as a downloadable file
        from flask import Response
        return Response(
            content,
            mimetype='text/plain',
            headers={
                'Content-Disposition': f'attachment; filename="{data.get("filename", "script.txt")}"'
            }
        )
        
    except Exception as e:
        logger.error(f"Error downloading script: {e}")
        return jsonify({"error": f"Failed to download script: {str(e)}"}), 500

@app.route('/download_audio', methods=['POST'])
def download_audio():
    """Download audio file from Firebase Storage."""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    data = request.get_json()
    audio_url = data.get('url')
    
    if not audio_url:
        return jsonify({"error": "Audio URL is required"}), 400
    
    try:
        # Download the audio content from Firebase URL
        response = requests.get(audio_url, timeout=30)  # Longer timeout for audio files
        response.raise_for_status()
        
        content = response.content
        
        # Return the content as a downloadable file
        from flask import Response
        return Response(
            content,
            mimetype='audio/mpeg',
            headers={
                'Content-Disposition': f'attachment; filename="{data.get("filename", "audio.mp3")}"'
            }
        )
        
    except Exception as e:
        logger.error(f"Error downloading audio: {e}")
        return jsonify({"error": f"Failed to download audio: {str(e)}"}), 500

@app.route('/delete_script', methods=['POST'])
def delete_script():
    """Delete script file from Firebase Storage."""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    data = request.get_json()
    script_url = data.get('url')
    filename = data.get('filename')
    
    if not script_url or not filename:
        return jsonify({"error": "Script URL and filename are required"}), 400
    
    try:
        bucket = storage.bucket()
        user_id = session.get('user_id')
        blob_name = f"users/{user_id}/script/{filename}"
        
        blob = bucket.blob(blob_name)
        if blob.exists():
            blob.delete()
            logger.info(f"Deleted script file: {filename} for user {user_id}")
            return jsonify({"message": "Script deleted successfully"}), 200
        else:
            return jsonify({"error": "Script file not found"}), 404
        
    except Exception as e:
        logger.error(f"Error deleting script: {e}")
        return jsonify({"error": f"Failed to delete script: {str(e)}"}), 500

@app.route('/delete_audio', methods=['POST'])
def delete_audio():
    """Delete audio file from Firebase Storage."""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    data = request.get_json()
    audio_url = data.get('url')
    filename = data.get('filename')
    
    if not audio_url or not filename:
        return jsonify({"error": "Audio URL and filename are required"}), 400
    
    try:
        bucket = storage.bucket()
        user_id = session.get('user_id')
        blob_name = f"users/{user_id}/audio/{filename}"
        
        blob = bucket.blob(blob_name)
        if blob.exists():
            blob.delete()
            logger.info(f"Deleted audio file: {filename} for user {user_id}")
            return jsonify({"message": "Audio deleted successfully"}), 200
        else:
            return jsonify({"error": "Audio file not found"}), 404
        
    except Exception as e:
        logger.error(f"Error deleting audio: {e}")
        return jsonify({"error": f"Failed to delete audio: {str(e)}"}), 500

@app.route('/delete_video', methods=['POST'])
def delete_video():
    """Delete video file from Firebase Storage."""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    data = request.get_json()
    video_url = data.get('url')
    filename = data.get('filename')
    
    if not video_url or not filename:
        return jsonify({"error": "Video URL and filename are required"}), 400
    
    try:
        bucket = storage.bucket()
        user_id = session.get('user_id')
        blob_name = f"users/{user_id}/video/{filename}"
        
        blob = bucket.blob(blob_name)
        if blob.exists():
            blob.delete()
            logger.info(f"Deleted video file: {filename} for user {user_id}")
            return jsonify({"message": "Video deleted successfully"}), 200
        else:
            return jsonify({"error": "Video file not found"}), 404
        
    except Exception as e:
        logger.error(f"Error deleting video: {e}")
        return jsonify({"error": f"Failed to delete video: {str(e)}"}), 500



@app.route('/get_usage_data', methods=['GET'])
def get_usage_data():
    """Get usage data for the current user from Firebase."""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    user_id = session.get('user_id')
    
    try:
        # Get user document from Firebase
        user_query = userCollection.where('user_id', '==', user_id).stream()
        user_doc = next(user_query, None)
        
        if not user_doc:
            return jsonify({"error": "User not found"}), 404
        
        user_data = user_doc.to_dict()
        total_sessions = user_data.get('sessions', 0)
        
        # Get daily usage data from Firebase
        from datetime import datetime, timedelta
        
        # Create a dictionary to store daily usage
        daily_usage_dict = {}
        
        # Get all usage records for this user
        usage_query = usageCollection.where('user_id', '==', user_id).stream()
        for usage_doc in usage_query:
            usage_data = usage_doc.to_dict()
            date = usage_data.get('date')
            sessions = usage_data.get('sessions', 0)
            if date:
                daily_usage_dict[date] = sessions
        
        # Generate last 30 days data
        usage_data = []
        today = datetime.now()
        
        for i in range(30):
            date = today - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            day_number = date.day
            
            # Get usage for this day, default to 0 if no data
            daily_usage = daily_usage_dict.get(date_str, 0)
            
            usage_data.append({
                'day': str(day_number),
                'usage': daily_usage,
                'date': date_str
            })
        
        # Reverse to show oldest to newest
        usage_data.reverse()
        
        # Calculate statistics
        total_daily_usage = sum([day['usage'] for day in usage_data])
        average_usage = round(total_daily_usage / 30, 1) if total_daily_usage > 0 else 0
        max_usage = max([day['usage'] for day in usage_data]) if usage_data else 0
        
        # Count actual content items
        script_count = 0
        audio_count = 0
        video_count = 0
        total_content = 0
        
        try:
            bucket = storage.bucket()
            # Count scripts
            script_blobs = bucket.list_blobs(prefix=f"users/{user_id}/script/")
            for blob in script_blobs:
                if blob.name.endswith('.txt'):
                    script_count += 1
            
            # Count audio files
            audio_blobs = bucket.list_blobs(prefix=f"users/{user_id}/audio/")
            for blob in audio_blobs:
                if blob.name.endswith('.mp3'):
                    audio_count += 1
            
            # Count video files
            video_blobs = bucket.list_blobs(prefix=f"users/{user_id}/video/")
            for blob in video_blobs:
                if blob.name.endswith('.mp4'):
                    video_count += 1
            
            total_content = script_count + audio_count + video_count
            
        except Exception as e:
            logger.error(f"Error counting content: {e}")
            # Variables are already initialized to 0, so no need to reassign
        
        return jsonify({
            'usage_data': usage_data,
            'total_sessions': total_sessions,
            'average_usage': average_usage,
            'max_usage': max_usage,
            'total_content': total_content,
            'content_breakdown': {
                'scripts': script_count,
                'audio': audio_count,
                'video': video_count
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting usage data: {e}")
        return jsonify({"error": f"Failed to get usage data: {str(e)}"}), 500

# Function to generate audio from a script
# Generates audio from the given script content using Google Cloud TTS.

# 1) Takes "sctipt_content" as argument
# 2) Since the script_content will be a mark down, the function formats the script by removing mark down symbols
# 3) Calls the Google TTS (Text to Speech) API to get audio output
# 4) Generates an unique random uuid and gets it's last 4 digits. Gets the topic given from the session. Combines the topic and the uuid to create a unique identifier name
# 5) Creates a .mp3 file with that unique name
# 6) Writes the audio to that specific mp3 file
# 7) Returns the generated audio file
# 8) If any error occurs corresponding messages will be logged
def generate_audio_from_script(script_content):
    """
    Generates audio from script content, saves it temporarily, uploads it to a
    user-specific folder in Firebase Storage, and returns the public URL.
    """
    logger.info("Starting audio generation...")
    if not script_content:
        logger.error("Script content is empty for audio generation.")
        raise ValueError("Script content cannot be empty for audio generation.")

    user_id = session.get('user_id')
    if not user_id:
        logger.error("User ID not found in session for audio generation.")
        raise ValueError("User must be logged in to generate audio.")

    # Clean the script for TTS by removing Markdown headings
    cleaned_script = re.sub(r'^[#]+\s*', '', script_content, flags=re.MULTILINE)
    cleaned_script = cleaned_script.replace('**', '')
    cleaned_script = cleaned_script.replace('*', '')
    cleaned_script = re.sub(r'\n+', '\n', cleaned_script).strip()
    logger.info(f"Cleaned script snippet for TTS: {cleaned_script[:100]}...")

    # Configure the TTS request
    synthesis_input = texttospeech.SynthesisInput(text=cleaned_script)
    voice = texttospeech.VoiceSelectionParams(language_code="en-US", name="en-US-Wavenet-F")
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    # Call the Google Cloud Text-to-Speech API
    logger.info("Calling Google Cloud Text-to-Speech API...")
    tts_response = texttospeech.TextToSpeechClient().synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)

    # Define the filename for the audio file
    unique_id = uuid.uuid4()
    last_4_uuid_digits = str(unique_id)[-4:]
    topic_name = session.get('final_topic', 'audio')
    audio_filename = f"{topic_name.replace(' ', '_')}({last_4_uuid_digits}).mp3"
    
    # Define the path to save the file temporarily on the local server
    local_audio_filepath = os.path.join(TEMP_FOLDER, audio_filename)

    try:
        # Write the audio content to the temporary local file
        with open(local_audio_filepath, "wb") as out:
            out.write(tts_response.audio_content)
        logger.info(f"Audio file temporarily saved to: {local_audio_filepath}")
        
        # Upload to Firebase Storage
        firebase_url = upload_to_firebase(
            local_filepath=local_audio_filepath,
            destination_folder="audio",
            filename=audio_filename,
            user_id=user_id
        )
        
        logger.info(f"Audio uploaded to Firebase: {firebase_url}")
        return firebase_url
        
    except Exception as e:
        logger.error(f"Error during audio file handling or upload: {e}", exc_info=True)
        raise


# Function to generate image for video
# Generates an image using Vertex AI's Imagen model (imagen-3.0-generate-002) via the vertexai.preview.vision_models client. Includes a fallback to a dummy image if Vertex AI generation fails.

# 1) Takes prompt text as argument
# 2) Creates a random unique uuid4 number and saves the .png file with that digit
# 3) Initializes and configures vertex AI for image generation
# 4) Generates and writes that image in the created file
# 5) Returns the image url
# 6) If no image is git back from the imagen, it creates a simple placeholder image using pillow and saves the image
# 7) If any error occurs, corresponding error will be logged
def generate_image_from_prompt(prompt_text, project_id, location="us-central1"):
    
    logger.info("Starting image generation...")
    
    user_id = session.get('user_id')
    if not user_id:
        logger.error("User ID not found in session for image generation.")
        raise ValueError("User must be logged in to generate images.")
    
    image_filename = f"{uuid.uuid4()}.png"
    local_image_path = os.path.join(TEMP_FOLDER, image_filename)
    logger.info(f"Attempting to generate image for prompt: '{prompt_text}'")

    try:
        # Initialize Vertex AI with project ID and location
        vertexai.init(project=project_id, location=location)
        logger.info(f"Initialized Vertex AI for project {project_id} in {location}")

        # Load the specific Imagen model
        model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-002")
        logger.info("Loaded Imagen 3.0 Generation Model.")

        logger.info(f"Sending image generation request for prompt: '{prompt_text}'")
        # Generate images
        images_response = model.generate_images(
            prompt=prompt_text,
            number_of_images=1, # Generate 1 image as we only use the first one
        )
        logger.info("Received response from image generation.")

        if images_response.images:
            generated_pil_image = images_response.images[0]._pil_image
            if generated_pil_image.mode != 'RGB':
                generated_pil_image = generated_pil_image.convert('RGB')

            generated_pil_image.save(local_image_path, format='PNG')
            logger.info(f"Image generated and saved temporarily at: {local_image_path}")
            
            # Upload to Firebase Storage
            firebase_url = upload_to_firebase(
                local_filepath=local_image_path,
                destination_folder="images",
                filename=image_filename,
                user_id=user_id
            )
            
            logger.info(f"Image uploaded to Firebase: {firebase_url}")
            return firebase_url

        else:
            logger.warning("No images found in Vertex AI Image Generation response.")
            raise Exception("No image predictions received from Vertex AI.")

    except Exception as e:
        logger.error(f"Vertex AI image generation failed: {e}. Falling back to dummy image.", exc_info=True)
        try:
            img = Image.new('RGB', (600, 400), color=(73, 109, 137))
            d = ImageDraw.Draw(img)
            try:
                font = ImageFont.truetype("arial.ttf", 40)
            except IOError:
                font = ImageFont.load_default()

            d.text((50, 50), "Dummy Image", fill=(255, 255, 0), font=font)
            d.text((50, 150), f"Prompt: {prompt_text[:50]}...", fill=(255, 255, 255), font=ImageFont.load_default())
            d.text((50, 250), f"Error: {str(e)[:50]}...", fill=(255, 255, 255), font=ImageFont.load_default())

            img.save(local_image_path)
            logger.info(f"Dummy image created temporarily at: {local_image_path}")
            
            # Upload dummy image to Firebase Storage
            firebase_url = upload_to_firebase(
                local_filepath=local_image_path,
                destination_folder="images",
                filename=image_filename,
                user_id=user_id
            )
            
            logger.info(f"Dummy image uploaded to Firebase: {firebase_url}")
            return firebase_url
            
        except Exception as dummy_e:
            logger.error(f"Failed to create dummy image: {dummy_e}", exc_info=True)
            return None

# Constants for Video Generation 
VIDEO_WIDTH = 1280
VIDEO_HEIGHT = 700
BACKGROUND_COLOR = (20, 20, 70) 


BACKGROUND_PATTERN_IMAGE = os.path.join(app.root_path, 'static', 'background', 'Background.png') 
IMAGE_SIDE = "right" 
TEXT_SIDE = "left"  

FONT_SIZE = 28
FONT_COLOR = "black"
TEXT_PADDING = 60

# Function to get accurate audio duration

# 1) Gets the file path of the audio file whose duration has to be measured
# 2) Returns the duration of the video in seconds
# 3) If any error occurs, corresponding error will be logged
def get_audio_duration(file_path):
    """Gets audio duration in seconds using pydub, which is often more reliable."""
    logger.info(f"Getting audio duration for: {file_path}")
    try:
        audio = AudioSegment.from_file(file_path)
        duration = audio.duration_seconds
        logger.info(f"Audio duration for {file_path}: {duration:.2f} seconds")
        return duration
    except Exception as e:
        logger.error(f"Error getting audio duration with pydub for {file_path}: {e}", exc_info=True)
        return None


# Function for video generation
# Generates a lecture-style video with a background, an image, and synchronized text.

# 1)Takes Audio path, Video path, script path, output path, width, height, background color, image side, text side, font size, font color, font path if exisist, text padding and background image as arguments
# 2) Loads the audio file from the file path
# 3) Calls the "get_audio_generation" function to get the duration of the audio and sets it as the video_duration
# 4) Loads the background image and scales it to the required dimension
# 5) Creates a video clip from a static image array. The image will be displayed as a still frame for the duration
# 6) If the background image can't be found, then a simple background is configured with the colors
# 7) Loads the generated image from the image_path and resizes it to the required size.
# 8) Sets the image X and Y position. If the image is not present, it creates a placeholder image and sets the same position
# 9) Gets the script text from the script path and removes markdowns
# 10) Splits script into paragraph by considering two consecutive new lines
# 11) Calculates Duration for each paragraph
# 12) Composes Video with the background clip, Image and Text clips
# 13) Sets audio for the final video
# 14) Writes the final output video to the "output_path"
# 15) If any error occurs, appropriate Errors will be logged
def generate_lecture_video(audio_path, image_path, script_path, output_path,
                           width, height, bg_color, img_side, txt_side,
                           font_size, font_color, font_path_for_clip, text_padding,
                           background_pattern_image=None):
    
    logger.info(f"*** Starting video generation for {output_path} ***")
    logger.info(f"Received arguments: audio_path={audio_path}, image_path={image_path}, script_path={script_path}")
    logger.info(f"Video dimensions: {width}x{height}, Background: {bg_color}, Image Side: {img_side}, Text Side: {txt_side}")
    logger.info(f"Font size: {font_size}, Font color: {font_color}, Font Path: {font_path_for_clip}, Text Padding: {text_padding}")
    logger.info(f"Background Pattern Image: {background_pattern_image}") # New log line


    # Load Audio Clip and Determine Video Duration
    try:
        logger.info(f"Loading audio clip from: {audio_path}")
        audio_clip = AudioFileClip(audio_path)
        video_duration = get_audio_duration(audio_path)
        if video_duration is None:
            logger.warning("Could not determine audio duration accurately with pydub, falling back to MoviePy's estimate.")
            video_duration = audio_clip.duration
        logger.info(f"Final determined video duration: {video_duration:.2f} seconds")
        if video_duration <= 0:
            logger.error(f"Calculated video duration is non-positive: {video_duration}. Aborting video generation.")
            raise ValueError("Invalid audio duration for video generation.")
    except Exception as e:
        logger.error(f"Error loading audio clip {audio_path}: {e}", exc_info=True)
        raise

    # Create Background Clip
    logger.info("Creating background clip.")
    if background_pattern_image and os.path.exists(background_pattern_image):
        try:
            # Load the pattern image
            pattern_img = Image.open(background_pattern_image)
            # Resize it to fill the video dimensions. Image.LANCZOS for good quality.
            pattern_img_resized = pattern_img.resize((width, height), Image.LANCZOS)
            background_clip = ImageClip(np.array(pattern_img_resized)).set_duration(video_duration)
            logger.info(f"Using background pattern image: {background_pattern_image}")
        except Exception as e:
            logger.error(f"Error loading or resizing background pattern image {background_pattern_image}: {e}. Falling back to color background.", exc_info=True)
            background_clip = ColorClip((width, height), color=bg_color).set_duration(video_duration)
    else:
        background_clip = ColorClip((width, height), color=bg_color).set_duration(video_duration)
        if background_pattern_image: # Was specified but not found
             logger.warning(f"Background pattern image '{background_pattern_image}' not found or invalid. Using solid background color.")


    # Load and Position Image Clip (Using PIL for robust resizing)
    try:
        logger.info(f"Loading image from: {image_path}")
        pil_image = Image.open(image_path)

        target_size = (450, 450)
        logger.info(f"Image original size: {pil_image.size}, Target size set to: {target_size}")


        pil_image.thumbnail(target_size, Image.LANCZOS)
        logger.info(f"Image resized to: {pil_image.size}")

        image_data = np.array(pil_image)
        image_clip = ImageClip(image_data).set_duration(video_duration)

        if img_side == "right":
            image_x_pos = 720.8
            image_y_pos = 110.2
        else: 
            image_x_pos = text_padding

        image_clip = image_clip.set_position((image_x_pos, image_y_pos))
        logger.info(f"Image clip positioned at custom coordinates: ({image_x_pos}, {image_y_pos})")

    except Exception as e:
        logger.error(f"Error loading or positioning image clip {image_path}: {e}", exc_info=True)
        logger.warning("Creating a fallback placeholder image clip.")
        placeholder_width = width // 2 - text_padding * 2
        placeholder_height = height // 2 - text_padding * 2

        if placeholder_width <= 0 or placeholder_height <= 0:
            placeholder_width = 100
            placeholder_height = 100
            logger.warning("Calculated placeholder size was non-positive, defaulting to 100x100.")

        image_clip = ColorClip(size=(placeholder_width, placeholder_height), color=(255,255,255)).set_duration(video_duration)
        if img_side == "right":
            image_x_pos = 690.8
            image_y_pos = 100.2
        else:
            image_x_pos = text_padding
        image_clip = image_clip.set_position((image_x_pos, image_y_pos))
        logger.info("Using a placeholder image clip instead.")


    # Read Script and Create Text Clips
    logger.info(f"Reading script from: {script_path}")
    try:
        with open(script_path, 'r', encoding='utf-8') as f:
            script_raw_text = f.read()

        cleaned_text_lines = []
        for line in script_raw_text.splitlines():
            if line.strip() and not re.match(r'^#+\s', line.strip()):
                cleaned_text_lines.append(line)
            elif not line.strip(): # Keep empty lines for paragraph breaks
                cleaned_text_lines.append(line)

        processed_text = "\n".join(cleaned_text_lines).strip()
        processed_text = re.sub(r'\n{2,}', '\n\n', processed_text) # Normalize multiple newlines to two
        processed_text = processed_text.replace('**', '').replace('*', '') # Remove markdowns
        logger.info(f"Processed script snippet for text clips: {processed_text[:200]}...")

    except Exception as e:
        logger.error(f"Error reading or processing script file {script_path}: {e}", exc_info=True)
        paragraphs = ["Error loading script content. Please check logs."]
    else:
        paragraphs = [p.strip() for p in processed_text.split('\n\n') if p.strip()]
        logger.info(f"Identified {len(paragraphs)} paragraphs for text clips.")

    text_clips = []
    if not paragraphs:
        logger.warning("No content paragraphs found in script after cleaning. Video will have no dynamic text.")
    else:
        total_word_count = sum(len(p.split()) for p in paragraphs)
        logger.info(f"Total words in script: {total_word_count}")

        if total_word_count == 0 and len(paragraphs) > 0:
            logger.warning("Content script contains no words, but has paragraphs. Using equal duration for each paragraph.")
            duration_per_paragraph_fallback = video_duration / len(paragraphs)
        elif total_word_count == 0 and len(paragraphs) == 0:
            logger.warning("No words and no paragraphs in script. No text clips will be generated.")
            duration_per_paragraph_fallback = 0

        current_time = 0
        text_area_width = (width // 2) - (text_padding * 2)
        logger.info(f"Text area width: {text_area_width}")

        for i, para_text in enumerate(paragraphs):
            para_word_count = len(para_text.split())

            if total_word_count > 0:
                paragraph_duration = (para_word_count / total_word_count) * video_duration
            else:
                paragraph_duration = duration_per_paragraph_fallback

            logger.info(f"Paragraph {i+1} ('{para_text[:50]}...') will display for approx. {paragraph_duration:.2f} seconds.")

            final_font_arg = font_path_for_clip if font_path_for_clip is not None else 'DejaVu-Sans'

            try:
                txt_clip = TextClip(
                    para_text,
                    fontsize=font_size,
                    color=font_color,
                    font=final_font_arg,
                    size=(text_area_width, None), # Width fixed, height auto
                    method='caption', # Important for multiline text
                    align='West'
                )
            except Exception as e:
                logger.error(f"Error creating TextClip for paragraph {i+1}: {e}", exc_info=True)
                logger.warning("Creating a fallback TextClip with dummy text for this paragraph.")
                txt_clip = TextClip(
                    "Error loading text for this section.",
                    fontsize=font_size,
                    color="red",
                    font=final_font_arg,
                    size=(text_area_width, None),
                    method='caption',
                    align='West'
                )


            txt_clip = txt_clip.set_duration(paragraph_duration).set_start(current_time)

            if txt_side == "left":
                text_x_pos = text_padding
            else:
                text_x_pos = width - txt_clip.w - text_padding # Calculate dynamic x-pos based on actual clip width

            txt_clip = txt_clip.set_position((text_x_pos, (height - txt_clip.h) / 2))
            logger.info(f"Text clip {i+1} positioned at: ({text_x_pos}, {(height - txt_clip.h) / 2}) for duration {paragraph_duration:.2f}s")


            text_clips.append(txt_clip)
            current_time += paragraph_duration

    # Compose Final Video Clip
    logger.info("Composing final video clip from background, image, and text clips.")
    final_clip = CompositeVideoClip([background_clip, image_clip] + text_clips)
    final_clip = final_clip.set_audio(audio_clip)
    logger.info(f"Final clip duration: {final_clip.duration:.2f} seconds (should match audio duration).")


    # 6. Write the Final Video File
    logger.info(f"Writing final video to {output_path}... ")
    logger.info(f"Note: This process can be CPU intensive and may take some time depending on video length and complexity.")
    try:
        final_clip.write_videofile(
            output_path,
            fps=24,
            codec="libx264",
            audio_codec="aac"
        )
        logger.info("Video generation complete!")
    except Exception as e:
        logger.error(f"Error writing video file: {e}", exc_info=True)
        logger.error("A common reason for this error is FFmpeg not being correctly installed or accessible in your system's PATH.")
        logger.error("Another reason could be ImageMagick not being correctly installed or its path not set in moviepy.config.IMAGEMAGICK_BINARY.")
        raise


def download_from_firebase(firebase_url, local_filepath):
    """Downloads a file from Firebase Storage to a local path."""
    try:
        import requests
        response = requests.get(firebase_url)
        response.raise_for_status()
        
        with open(local_filepath, 'wb') as f:
            f.write(response.content)
        
        logger.info(f"Downloaded file from Firebase to: {local_filepath}")
        return True
    except Exception as e:
        logger.error(f"Error downloading from Firebase: {e}")
        return False

def generate_video_from_script(script_content):
    logger.info("--- Starting generate_video_from_script function ---")


    user_id = session.get('user_id')
    if not user_id:
        logger.error("User ID not found in session for video generation.")
        raise ValueError("User must be logged in to generate video.")
    
    ongoing_generation = session.get('video_generation_in_progress', False)
    if ongoing_generation:
        logger.error("Video generation already in progress for this user.")    
        return False
    
    session["video_generation_in_progress"] = True

    audio_url = session.get('audio_url')
    image_url = session.get('image_url')

    logger.info(f"Audio URL from session: {audio_url}")
    logger.info(f"Image URL from session: {image_url}")

    if not audio_url:
        logger.error("Audio URL not found in session for video generation. Cannot proceed.")
        raise ValueError("Audio content is required for video generation.")

    # Download audio from Firebase to temporary local file
    audio_filename = f"temp_audio_{uuid.uuid4()}.mp3"
    audio_filepath = os.path.join(TEMP_FOLDER, audio_filename)
    
    if not download_from_firebase(audio_url, audio_filepath):
        logger.error(f"Failed to download audio from Firebase: {audio_url}")
        raise FileNotFoundError(f"Could not download audio file from Firebase")

    # Download image from Firebase to temporary local file
    image_filepath = None
    if image_url:
        image_filename = f"temp_image_{uuid.uuid4()}.png"
        image_filepath = os.path.join(TEMP_FOLDER, image_filename)
        
        if not download_from_firebase(image_url, image_filepath):
            logger.warning(f"Failed to download image from Firebase: {image_url}. Will generate new image.")
            image_filepath = None

    # Generate image if not available
    if not image_filepath:
        logger.info("Generating new image for video.")
        confirmed_topic = session.get('final_topic', 'educational video')
        project_id = os.getenv('GCP_PROJECT_ID')
        if not project_id:
            logger.error("GCP_PROJECT_ID environment variable not set. Cannot generate image. Aborting.")
            raise ValueError("GCP_PROJECT_ID not set, and no image available for video.")
        
        image_prompt = f"Educational illustration for: {confirmed_topic}. Focus on key concepts from the script. Minimize or avoid embedded text within the image. If text is present, it should be purely decorative and non-essential. Emphasize visual representation over textual elements."
        new_image_url = generate_image_from_prompt(image_prompt, project_id)
        if not new_image_url:
            logger.error("Failed to generate image for video generation. Aborting.")
            raise ValueError("Failed to generate an image for video generation.")
        
        session['image_url'] = new_image_url
        image_filename = f"temp_image_{uuid.uuid4()}.png"
        image_filepath = os.path.join(TEMP_FOLDER, image_filename)
        
        if not download_from_firebase(new_image_url, image_filepath):
            logger.error("Failed to download newly generated image from Firebase.")
            raise FileNotFoundError("Could not download newly generated image from Firebase")

    # Save script content to a temporary file
    script_filename = f"temp_script_{uuid.uuid4()}.txt"
    script_filepath = os.path.join(TEMP_FOLDER, script_filename)
    try:
        with open(script_filepath, "w", encoding="utf-8") as f:
            f.write(script_content)
        logger.info(f"Script content written to temporary file: {script_filepath}")
    except Exception as e:
        logger.error(f"Error writing temporary script file: {e}", exc_info=True)
        raise

    # Generate video filename
    unique_id = uuid.uuid4()
    last_4_uuid_digits = str(unique_id)[-4:]
    topic_name = session.get('final_topic')
    video_filename = f"{topic_name}({last_4_uuid_digits}).mp4"
    output_video_filepath = os.path.join(TEMP_FOLDER, video_filename)
    logger.info(f"Output video will be saved temporarily to: {output_video_filepath}")
    
    CUSTOM_ROBOT_FONT_PATH = os.path.join(app.root_path, 'fonts', 'RobotFont.ttf') 

    if os.path.exists(CUSTOM_ROBOT_FONT_PATH):
        FONT_PATH_FOR_CLIP = CUSTOM_ROBOT_FONT_PATH
        logger.info(f"Using custom robot font for video text: {FONT_PATH_FOR_CLIP}")
    else:
        logger.warning(f"Custom robot font not found at {CUSTOM_ROBOT_FONT_PATH}. Falling back to generic sans font.")
        FONT_PATH_FOR_CLIP = 'DejaVu-Sans'

    try:
        generate_lecture_video(
            audio_path=audio_filepath,
            image_path=image_filepath,
            script_path=script_filepath,
            output_path=output_video_filepath,
            width=VIDEO_WIDTH,
            height=VIDEO_HEIGHT,
            bg_color=BACKGROUND_COLOR,
            img_side=IMAGE_SIDE,
            txt_side=TEXT_SIDE,
            font_size=FONT_SIZE,
            font_color=FONT_COLOR,
            font_path_for_clip=FONT_PATH_FOR_CLIP,
            text_padding=TEXT_PADDING,
            background_pattern_image=BACKGROUND_PATTERN_IMAGE
        )
        
        # Upload video to Firebase Storage
        firebase_url = upload_to_firebase(
            local_filepath=output_video_filepath,
            destination_folder="video",
            filename=video_filename,
            user_id=user_id
        )
        
        logger.info(f"Video uploaded to Firebase: {firebase_url}")
        return firebase_url
        
    except Exception as e:
        logger.error(f"Error during main video generation call: {e}", exc_info=True)
        raise
    finally:
        # Clean up temporary files
        for temp_file in [script_filepath, audio_filepath, image_filepath, output_video_filepath]:
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)
                logger.info(f"Cleaned up temporary file: {temp_file}")

        session["video_generation_in_progress"] = True
        session.modified = True
        logger.info("--- Finished generate_video_from_script function ---")


# Main route for Chat
# Handles State for chat and requests from the client

# 1) Gets the message as input from the client
# 2) Looks for the chat state in the session. If it is not present there, it is set as "IDLE"
# 3) Looks for the current topic in the session. If it is not present there, it is set as None
# 4) 
@app.route('/chat', methods=['POST'])
def chat():
    if 'user_id' not in session:
        return jsonify({
            "reply": "🔒 Authentication required! Please log in to start chatting with me. I'm here to help you create amazing educational content once you're authenticated.",
            "action": "authentication_required"
        }), 200

    data = request.get_json()
    user_input = data.get('message')
    if not user_input:
        return jsonify({"error": "No message provided"}), 400

    current_state = session.get('conversation_state', 'IDLE')
    context_topic = session.get('context_topic', None)

    logger.info(f"User Input: {user_input}")
    logger.info(f"Current State: {current_state}")
    logger.info(f"Context Topic: {context_topic}")

    response_data = {"reply": "", "action": ""}

    try:
        if current_state == 'IDLE':
            prompt = f"""You are an intelligent educational assistant. Your goal is to help a user create a video lecture, summary, and quiz on a specific topic.
            1.  **If the user's initial topic is broad or ambiguous**, suggest 3-5 specific sub-topics or facets they could focus on. Present these as a clear, numbered list. Respond with JSON:
                `{{'action': 'suggest_subtopics', 'message': 'The topic \\'{user_input}\\' is quite broad. To create a focused video, please choose one of these sub-topics, or provide a more specific request:', 'subtopics': ['Sub-topic 1', 'Sub-topic 2', 'Sub-topic 3']}}`

            2.  **If the user's topic is already specific enough** for a video lecture, confirm your understanding and ask for final confirmation to proceed with content generation. Respond with JSON:
                `{{'action': 'confirm_generation', 'message': 'You\\'ve requested a video on \\'{user_input}\\'. This seems sufficiently specific. Confirm \\'Generate Content\\' to proceed, or provide any further details.', 'topic': '{user_input}'}}`

            **Important:** Always respond *only* with a valid JSON object as described above.

            User's initial topic: "{user_input}"
            """
            session['context_topic'] = user_input
            session['conversation_state'] = 'AWAITING_RESPONSE'

            gemini_response = model.generate_content(
                prompt,
                generation_config={
                    "response_mime_type": "application/json"
                }
            )
            parsed_response = json.loads(gemini_response.text)

            response_action = parsed_response.get('action')
            response_message = parsed_response.get('message')

            if response_action == 'suggest_subtopics':
                sub_topics = parsed_response.get('subtopics', [])
                response_data = {
                    "reply": response_message,
                    "action": "suggest_subtopics",
                    "sub_topics": sub_topics
                }
                session['conversation_state'] = 'AWAITING_SUBTOPIC_SELECTION'
                session['suggested_subtopics'] = sub_topics

            elif response_action == 'confirm_generation':
                confirmed_topic = parsed_response.get('topic')
                response_data = {
                    "reply": response_message,
                    "action": "confirm_generation",
                    "topic": confirmed_topic
                }
                session['conversation_state'] = 'AWAITING_CONFIRMATION'
                session['final_topic'] = confirmed_topic

            else:
                response_data = {"reply": "Sorry, I couldn't understand that. Please try again.", "action": "error"}
                session['conversation_state'] = 'IDLE'

        elif current_state == 'AWAITING_SUBTOPIC_SELECTION':
            selected_topic = user_input

            prompt = f"""You are an intelligent educational assistant. The user has selected or refined their topic to: "{selected_topic}".
            Confirm your understanding and ask for final confirmation to proceed with content generation. Respond with JSON:
            `{{'action': 'confirm_generation', 'message': 'You\\'ve chosen \\'{selected_topic}\\'. Confirm \\'Generate Content\\' to proceed, or provide any further details.', 'topic': '{selected_topic}'}}`

            **Important:** Always respond *only* with a valid JSON object as described above.
            """

            gemini_response = model.generate_content(
                prompt,
                generation_config={
                    "response_mime_type": "application/json"
                }
            )
            parsed_response = json.loads(gemini_response.text)

            if parsed_response.get('action') == 'confirm_generation':
                confirmed_topic = parsed_response.get('topic')
                response_data = {
                    "reply": parsed_response.get('message'),
                    "action": "confirm_generation",
                    "topic": confirmed_topic
                }
                session['conversation_state'] = 'AWAITING_CONFIRMATION'
                session['final_topic'] = confirmed_topic
            else:
                response_data = {"reply": "There was an issue processing your selection. Please try again.", "action": "error"}
                session['conversation_state'] = 'IDLE'

        elif current_state == 'AWAITING_CONFIRMATION':
            if user_input.lower() == 'confirm generate content':
                topic_for_script = session.get('final_topic')
                if not topic_for_script:
                    response_data = {"reply": "Error: No topic found for script generation. Please start fresh.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
                    return jsonify(response_data)

                # --- Generate Script ---
                script_prompt = f"""You are an expert educator. Create a concise video lecture script for a 5-minute video on the topic: "{topic_for_script}".
                The script should be structured into:
                -   An introduction.
                -   2-3 main sections, each with a clear heading.
                -   A conclusion.

                The tone should be engaging and informative, suitable for a general audience.
                Present the script in a clear, easy-to-read format with headings.

                Respond with JSON. The JSON should have a single key 'script_content'
                like this:
                {{
                    "script_content": "## Introduction\\nWelcome to...\\n\\n## Main Section 1: Heading\\nContent...\\n\\n## Main Section 2: Heading\\nContent...\\n\\n## Conclusion\\nIn summary..."
                }}
                """
                logger.info(f"Generating script for: {topic_for_script}")

                try:
                    script_gemini_response = model.generate_content(
                        script_prompt,
                        generation_config={"response_mime_type": "application/json"}
                    )
                    script_parsed_response = json.loads(script_gemini_response.text)
                    video_script = script_parsed_response.get('script_content', "Could not generate script.")
                    session['video_script'] = video_script # Store the script in session

                    # Saving the script to Firebase Storage
                    unique_id = uuid.uuid4()
                    last_4_uuid_digits = str(unique_id)[-4:]
                    topic = session.get('final_topic')
                    script_filename = f"{topic}({last_4_uuid_digits}).txt"
                    script_filepath = os.path.join(TEMP_FOLDER, script_filename)
                    
                    with open(script_filepath, "w", encoding='utf-8') as f:
                        f.write(video_script)
                    
                    # Upload script to Firebase Storage
                    user_id = session.get('user_id')
                    if user_id:
                        print(f"Uploading script for user: {user_id}")
                        firebase_url = upload_to_firebase(
                            local_filepath=script_filepath,
                            destination_folder="script",
                            filename=script_filename,
                            user_id=user_id
                        )
                        print(f"Script uploaded to Firebase: {firebase_url}")
                        logger.info(f"Script uploaded to Firebase: {firebase_url}")
                        
                        # Track daily usage and increment session count
                        try:
                            from datetime import datetime
                            today = datetime.now().strftime('%Y-%m-%d')
                            
                            # Update total sessions in user document
                            user_query = userCollection.where('user_id', '==', user_id).stream()
                            user_doc = next(user_query, None)
                            if user_doc:
                                current_sessions = user_doc.to_dict().get('sessions', 0)
                                userCollection.document(user_doc.id).update({
                                    'sessions': current_sessions + 1
                                })
                                print(f"Updated sessions count for user {user_id}: {current_sessions + 1}")
                            else:
                                print(f"User document not found for user_id: {user_id}")
                            
                            # Track daily usage
                            usage_query = usageCollection.where('user_id', '==', user_id).where('date', '==', today).stream()
                            usage_doc = next(usage_query, None)
                            
                            if usage_doc:
                                # Update existing daily usage
                                current_daily_usage = usage_doc.to_dict().get('sessions', 0)
                                usageCollection.document(usage_doc.id).update({
                                    'sessions': current_daily_usage + 1
                                })
                                print(f"Updated daily usage for {today}: {current_daily_usage + 1}")
                            else:
                                # Create new daily usage record
                                usageCollection.add({
                                    'user_id': user_id,
                                    'date': today,
                                    'sessions': 1
                                })
                                print(f"Created new daily usage record for {today}: 1")
                                
                        except Exception as e:
                            print(f"Error updating usage tracking: {e}")
                            logger.error(f"Error updating usage tracking: {e}")
                    else:
                        print("No user ID found, script not uploaded to Firebase")
                        logger.warning("No user ID found, script not uploaded to Firebase")

                    # --- Generate Quiz and Summary (NEW) ---
                    quiz_summary_prompt = f"""Based on the following video lecture script, create a short quiz with 10 multiple-choice questions. For each question, provide 4 options (A, B, C, D) and clearly indicate the correct answer (e.g., 'A', 'B', 'C', 'D'). Also, provide a concise summary of the script (around 50-70 words).

                    Video Script:
                    ---
                    {video_script}
                    ---

                    Respond with JSON in the following format:
                    {{
                        "summary": "...",
                        "quiz": [
                            {{
                                "question": "...",
                                "options": {{
                                    "A": "...",
                                    "B": "...",
                                    "C": "...",
                                    "D": "..."
                                }},
                                "correct_answer": "A"
                            }}
                        ]
                    }}
                    """
                    logger.info("Generating quiz and summary...")
                    quiz_gemini_response = model.generate_content(
                        quiz_summary_prompt,
                        generation_config={"response_mime_type": "application/json"}
                    )
                    quiz_parsed_response = json.loads(quiz_gemini_response.text)
                    generated_summary = quiz_parsed_response.get('summary', "Could not generate summary.")
                    generated_quiz = quiz_parsed_response.get('quiz', [])

                    session['video_summary'] = generated_summary # Store summary
                    session['quiz_content'] = generated_quiz     # Store quiz

                    response_data = {
                        "reply": "Here's the generated script and quiz! What would you like to do next: 'generate audio', 'generate video', 'generate images', or 'generate both'?",
                        "action": "show_script_and_quiz",
                        "script": video_script,
                        "summary": generated_summary,
                        "quiz": generated_quiz,
                        "topic": topic_for_script
                    }
                    session['conversation_state'] = 'SCRIPT_GENERATED'

                except json.JSONDecodeError as e:
                    logger.error(f"Error: Gemini did not return valid JSON for script/quiz: {e}", exc_info=True)
                    response_data = {"reply": "Failed to generate content: Invalid response from AI. Please try again.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
                except Exception as gen_e:
                    logger.error(f"Error during content generation: {gen_e}", exc_info=True)
                    response_data = {"reply": f"An error occurred while generating content: {gen_e}. Please try again.", "action": "error"}
                    session['conversation_state'] = 'IDLE'

            else:
                response_data = {
                    "reply": "Understood. Please provide a more specific topic or re-enter your original topic to start fresh.",
                    "action": "reset"
                }
                session['conversation_state'] = 'IDLE'

        # --- Handle new actions in SCRIPT_GENERATED state ---
        elif current_state == 'SCRIPT_GENERATED':
            script_to_process = session.get('video_script')
            confirmed_topic = session.get('final_topic')
            project_id = os.getenv('GCP_PROJECT_ID')

            if not script_to_process:
                response_data = {"reply": "Error: No script found to process. Please start fresh.", "action": "error"}
                session['conversation_state'] = 'IDLE'
                return jsonify(response_data)

            audio_url = session.get('audio_url')
            video_url = session.get('video_url')
            image_url = session.get('image_url')
            success_message = ""
            action_type = ""
            next_state = 'SCRIPT_GENERATED'

            try:
                if user_input.lower() == 'generate audio':
                    # Clear previous audio and video URLs to ensure fresh generation
                    session.pop('audio_url', None)
                    session.pop('video_url', None)
                    audio_url = generate_audio_from_script(script_to_process)
                    session['audio_url'] = audio_url
                    success_message = "Audio generated successfully!"
                    action_type = "audio_ready"
                    next_state = 'AUDIO_GENERATED'

                elif user_input.lower() == 'generate video':
                    # Clear previous video URL to ensure fresh generation
                    session.pop('video_url', None)
                    
                    # Before generating video, ensure audio is generated
                    if not audio_url:
                        logger.info("Audio not found in session for video generation. Generating audio first.")
                        audio_url = generate_audio_from_script(script_to_process)
                        session['audio_url'] = audio_url
                        logger.info("Generated audio before video generation.")

                    video_url = generate_video_from_script(script_to_process) # Now calls the full generation
                    if video_url is False:
                        return jsonify({
                            "reply": " Multiple Generation Requests! Please wait till the current generation is completed before starting another.",
                            "action": "video_generation_traffic"
                        }), 200

        
                    session['video_url'] = video_url
                    success_message = "Video generated successfully!"
                    action_type = "video_ready"
                    next_state = 'VIDEO_GENERATED'

                elif user_input.lower() == 'generate images':
                    # Clear previous image URL to ensure fresh generation
                    session.pop('image_url', None)
                    
                    if confirmed_topic and project_id:
                        image_prompt = f"Educational illustration for: {confirmed_topic}. Focus on key concepts from the script. Minimize or avoid embedded text within the image. If text is present, it should be purely decorative and non-essential. Emphasize visual representation over textual elements."
                        image_url = generate_image_from_prompt(image_prompt, project_id)
                        session['image_url'] = image_url
                        success_message = f"Image generated! You can access it at: {image_url}"
                        action_type = "image_ready"
                        next_state = 'IMAGES_GENERATED'
                    else:
                        success_message = "Error: Cannot generate image without a confirmed topic or GCP Project ID. Please start over."
                        action_type = "error"
                        next_state = 'IDLE'


                elif user_input.lower() == 'generate both':
                    logger.info("Generating audio, image, and video for 'generate both' command.")
                    # Clear all previous URLs to ensure fresh generation
                    session.pop('audio_url', None)
                    session.pop('video_url', None)
                    session.pop('image_url', None)
                    
                    # Generate audio
                    audio_url = generate_audio_from_script(script_to_process)
                    session['audio_url'] = audio_url

                    # Generate image first, as video generation uses it
                    if confirmed_topic and project_id:
                        image_prompt = f"Educational illustration for: {confirmed_topic}. Focus on key concepts from the script. Minimize or avoid embedded text within the image. If text is present, it should be purely decorative and non-essential. Emphasize visual representation over textual elements."
                        image_url = generate_image_from_prompt(image_prompt, project_id)
                        session['image_url'] = image_url
                    else:
                        logger.warning("Could not generate image for 'generate both' due to missing topic/project ID. Attempting video generation without it, which will use a fallback image.")

                    # Generate video
                    video_url = generate_video_from_script(script_to_process) # This will handle missing image with fallback
                    session['video_url'] = video_url

                    success_message = "Audio, video, and image generated successfully!"
                    action_type = "all_ready"
                    next_state = 'BOTH_GENERATED'

                elif user_input.lower() == 'start over':
                    session.clear()
                    response_data = {"reply": "Okay, let's start fresh. Please provide a new topic.", "action": "reset"}
                    session['conversation_state'] = 'IDLE'
                    return jsonify(response_data)

                else:
                    response_data = {
                        "reply": "Script and quiz are ready. What would you like to do next: 'generate audio', 'generate video', 'generate images', or 'generate both'?",
                        "action": "show_script_and_quiz",
                        "script": session.get('video_script'),
                        "summary": session.get('video_summary'),
                        "quiz": session.get('quiz_content'),
                        "topic": session.get('final_topic'),
                        "audio_url": audio_url,
                        "video_url": video_url,
                        "image_url": image_url
                    }
                    return jsonify(response_data)

                response_data = {
                    "reply": success_message,
                    "action": action_type,
                    "audio_url": audio_url,
                    "video_url": video_url,
                    "image_url": image_url,
                    "topic": session.get('final_topic'),
                    "script": session.get('video_script'),
                    "summary": session.get('video_summary'),
                    "quiz": session.get('quiz_content')
                }
                session['conversation_state'] = next_state

            except Exception as e:
                logger.error(f"Error during media generation: {e}", exc_info=True)
                response_data = {"reply": f"An error occurred during media generation: {e}. Please try again.", "action": "error"}
                session['conversation_state'] = 'IDLE'

        # --- States for Generated Media ---
        elif current_state == 'AUDIO_GENERATED':
            script_to_process = session.get('video_script')
            confirmed_topic = session.get('final_topic')
            project_id = os.getenv('GCP_PROJECT_ID')
            audio_url = session.get('audio_url')
            image_url = session.get('image_url')

            if user_input.lower() == 'generate video':
                if not script_to_process:
                    response_data = {"reply": "Error: No script found. Please start fresh.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
                    return jsonify(response_data)
                try:
                    # Clear previous video URL to ensure fresh generation
                    session.pop('video_url', None)
                    
                    if not image_url: # Generate image if not already present
                        logger.info("Image not found in session. Generating image before video generation.")
                        if confirmed_topic and project_id:
                            image_prompt = f"Educational illustration for: {confirmed_topic}. Focus on key concepts from the script. Minimize or avoid embedded text within the image. If text is present, it should be purely decorative and non-essential. Emphasize visual representation over textual elements."
                            image_url = generate_image_from_prompt(image_prompt, project_id)
                            session['image_url'] = image_url
                        else:
                            logger.warning("Could not generate image before video due to missing topic/project ID. Video generation will use a fallback image.")

                    video_url = generate_video_from_script(script_to_process)
                    session['video_url'] = video_url
                    response_data.update({
                        "reply": "Video generated successfully!",
                        "action": "video_ready",
                        "video_url": video_url,
                        "audio_url": audio_url,
                        "image_url": image_url
                    })
                    session['conversation_state'] = 'BOTH_GENERATED'
                except Exception as e:
                    logger.error(f"Error during video generation from AUDIO_GENERATED state: {e}", exc_info=True)
                    response_data = {"reply": f"An error occurred: {e}. Please try again.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
            elif user_input.lower() == 'generate images':
                # Clear previous image URL to ensure fresh generation
                session.pop('image_url', None)
                
                if confirmed_topic and project_id:
                    image_prompt = f"Educational illustration for: {confirmed_topic}. Focus on key concepts from the script. Minimize or avoid embedded text within the image. If text is present, it should be purely decorative and non-essential. Emphasize visual representation over textual elements."
                    image_url = generate_image_from_prompt(image_prompt, project_id)
                    session['image_url'] = image_url
                    response_data.update({
                        "reply": f"Image generated! You can access it at: {image_url}",
                        "action": "image_ready",
                        "image_url": image_url,
                        "audio_url": audio_url
                    })
                    session['conversation_state'] = 'BOTH_GENERATED'
                else:
                    response_data = {"reply": "Cannot generate image without a confirmed topic or GCP Project ID. Please start over.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
            elif user_input.lower() == 'start over':
                session.clear()
                response_data = {"reply": "Okay, let's start fresh. Please provide a new topic.", "action": "reset"}
                session['conversation_state'] = 'IDLE'
            else:
                response_data = {
                    "reply": "Audio has been generated. You can now 'generate video', 'generate images', or 'start over'.",
                    "action": "audio_ready",
                    "audio_url": audio_url,
                    "script": session.get('video_script'),
                    "summary": session.get('video_summary'),
                    "quiz": session.get('quiz_content'),
                    "topic": session.get('final_topic'),
                    "image_url": image_url,
                    "video_url": session.get('video_url')
                }

        elif current_state == 'VIDEO_GENERATED':
            script_to_process = session.get('video_script')
            confirmed_topic = session.get('final_topic')
            project_id = os.getenv('GCP_PROJECT_ID')
            audio_url = session.get('audio_url')
            video_url = session.get('video_url')
            image_url = session.get('image_url')

            if user_input.lower() == 'generate audio':
                if not script_to_process:
                    response_data = {"reply": "Error: No script found. Please start fresh.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
                    return jsonify(response_data)
                try:
                    audio_url = generate_audio_from_script(script_to_process)
                    session['audio_url'] = audio_url
                    response_data.update({
                        "reply": "Audio generated successfully!",
                        "action": "audio_ready",
                        "audio_url": audio_url,
                        "video_url": video_url,
                        "image_url": image_url
                    })
                    session['conversation_state'] = 'BOTH_GENERATED'
                except Exception as e:
                    logger.error(f"Error during audio generation from VIDEO_GENERATED state: {e}", exc_info=True)
                    response_data = {"reply": f"An error occurred: {e}. Please try again.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
            elif user_input.lower() == 'generate images':
                # Clear previous image URL to ensure fresh generation
                session.pop('image_url', None)
                
                if confirmed_topic and project_id:
                    image_prompt = f"Educational illustration for: {confirmed_topic}. Focus on key concepts from the script. Minimize or avoid embedded text within the image. If text is present, it should be purely decorative and non-essential. Emphasize visual representation over textual elements."
                    image_url = generate_image_from_prompt(image_prompt, project_id)
                    session['image_url'] = image_url
                    response_data.update({
                        "reply": f"Image generated! You can access it at: {image_url}",
                        "action": "image_ready",
                        "image_url": image_url,
                        "audio_url": audio_url,
                        "video_url": video_url
                    })
                    session['conversation_state'] = 'BOTH_GENERATED'
                else:
                    response_data = {"reply": "Cannot generate image without a confirmed topic or GCP Project ID. Please start over.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
            elif user_input.lower() == 'start over':
                session.clear()
                response_data = {"reply": "Okay, let's start fresh. Please provide a new topic.", "action": "reset"}
                session['conversation_state'] = 'IDLE'
            else:
                 response_data = {
                    "reply": "Video generation has been completed. You can now 'generate audio', 'generate images', or 'start over'.",
                    "action": "video_ready",
                    "video_url": video_url,
                    "script": session.get('video_script'),
                    "summary": session.get('video_summary'),
                    "quiz": session.get('quiz_content'),
                    "topic": session.get('final_topic'),
                    "audio_url": audio_url,
                    "image_url": image_url
                }

        elif current_state == 'IMAGES_GENERATED':
            script_to_process = session.get('video_script')
            confirmed_topic = session.get('final_topic')
            project_id = os.getenv('GCP_PROJECT_ID')
            audio_url = session.get('audio_url')
            video_url = session.get('video_url')
            image_url = session.get('image_url')

            response_data = {
                "reply": "Image has been generated. You can now 'generate audio', 'generate video', or 'start over'.",
                "action": "image_ready",
                "image_url": image_url,
                "script": session.get('video_script'),
                "summary": session.get('video_summary'),
                "quiz": session.get('quiz_content'),
                "topic": session.get('final_topic'),
                "audio_url": audio_url,
                "video_url": video_url
            }
            if user_input.lower() == 'generate audio':
                if not script_to_process:
                    response_data = {"reply": "Error: No script found. Please start fresh.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
                    return jsonify(response_data)
                try:
                    audio_url = generate_audio_from_script(script_to_process)
                    session['audio_url'] = audio_url
                    response_data.update({
                        "reply": "Audio generated successfully!",
                        "action": "audio_ready",
                        "audio_url": audio_url,
                        "video_url": video_url,
                        "image_url": image_url
                    })
                    session['conversation_state'] = 'BOTH_GENERATED'
                except Exception as e:
                    logger.error(f"Error during audio generation from IMAGES_GENERATED state: {e}", exc_info=True)
                    response_data = {"reply": f"An error occurred: {e}. Please try again.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
            elif user_input.lower() == 'generate video':
                if not script_to_process:
                    response_data = {"reply": "Error: No script found. Please start fresh.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
                    return jsonify(response_data)
                try:
                    if not audio_url: # Generate audio if not already present, as video generation uses it
                        logger.info("Audio not found in session. Generating audio before video generation in IMAGES_GENERATED state.")
                        audio_url = generate_audio_from_script(script_to_process)
                        session['audio_url'] = audio_url


                    video_url = generate_video_from_script(script_to_process)
                    session['video_url'] = video_url
                    response_data.update({
                        "reply": "Video generated successfully!",
                        "action": "video_ready",
                        "video_url": video_url,
                        "audio_url": audio_url,
                        "image_url": image_url
                    })
                    session['conversation_state'] = 'BOTH_GENERATED'
                except Exception as e:
                    logger.error(f"Error during video generation from IMAGES_GENERATED state: {e}", exc_info=True)
                    response_data = {"reply": f"An error occurred: {e}. Please try again.", "action": "error"}
                    session['conversation_state'] = 'IDLE'
            elif user_input.lower() == 'start over':
                session.clear()
                response_data = {"reply": "Okay, let's start fresh. Please provide a new topic.", "action": "reset"}
                session['conversation_state'] = 'IDLE'
            # else, just return the current state and prompt again


        elif current_state == 'BOTH_GENERATED':
            script_to_process = session.get('video_script')
            confirmed_topic = session.get('final_topic')
            project_id = os.getenv('GCP_PROJECT_ID')
            audio_url = session.get('audio_url')
            video_url = session.get('video_url')
            image_url = session.get('image_url')
            success_message = ""
            action_type = ""
            next_state = 'BOTH_GENERATED'

            try:
                if user_input.lower() == 'generate audio':
                    logger.info("Re-generating audio from BOTH_GENERATED state.")
                    audio_url = generate_audio_from_script(script_to_process)
                    session['audio_url'] = audio_url
                    success_message = "Audio re-generated successfully!"
                    action_type = "audio_ready"
                elif user_input.lower() == 'generate video':
                    logger.info("Re-generating video from BOTH_GENERATED state.")
                    if not audio_url: # Ensure audio is present before video re-generation
                        logger.warning("Audio not found in session for video re-generation. Attempting to generate it first.")
                        audio_url = generate_audio_from_script(script_to_process)
                        session['audio_url'] = audio_url
                    video_url = generate_video_from_script(script_to_process)
                    session['video_url'] = video_url
                    success_message = "Video re-generated successfully!"
                    action_type = "video_ready"
                elif user_input.lower() == 'generate images':
                    logger.info("Re-generating images from BOTH_GENERATED state.")
                    if confirmed_topic and project_id:
                        image_prompt = f"Educational illustration for: {confirmed_topic}. Focus on key concepts from the script. Minimize or avoid embedded text within the image. If text is present, it should be purely decorative and non-essential. Emphasize visual representation over textual elements."
                        image_url = generate_image_from_prompt(image_prompt, project_id)
                        session['image_url'] = image_url
                        success_message = f"Image re-generated! You can access it at: {image_url}"
                        action_type = "image_ready"
                    else:
                        success_message = "Error: Cannot re-generate image without a confirmed topic or GCP Project ID. Please start over."
                        action_type = "error"
                        next_state = 'IDLE'
                elif user_input.lower() == 'generate both':
                    logger.info("Re-generating audio, image, and video from BOTH_GENERATED state.")
                    audio_url = generate_audio_from_script(script_to_process)
                    session['audio_url'] = audio_url

                    if confirmed_topic and project_id:
                        image_prompt = f"Educational illustration for: {confirmed_topic}. Focus on key concepts from the script. Minimize or avoid embedded text within the image. If text is present, it should be purely decorative and non-essential. Emphasize visual representation over textual elements."
                        image_url = generate_image_from_prompt(image_prompt, project_id)
                        session['image_url'] = image_url
                    else:
                        logger.warning("Could not re-generate image for 'generate both' due to missing topic/project ID. Attempting video generation without it, which will use a fallback image.")

                    video_url = generate_video_from_script(script_to_process)
                    session['video_url'] = video_url

                    success_message = "Audio, video, and image re-generated successfully!"
                    action_type = "all_ready"
                elif user_input.lower() == 'start over':
                    session.clear()
                    response_data = {"reply": "Okay, let's start fresh. Please provide a new topic.", "action": "reset"}
                    session['conversation_state'] = 'IDLE'
                    return jsonify(response_data)
                else:
                    response_data = {
                        "reply": "Audio, video, and image generation complete! What's next? You can 'generate audio', 'generate video', 'generate images', 'generate both', or 'start over'.",
                        "action": "all_ready",
                        "audio_url": session.get('audio_url'),
                        "video_url": session.get('video_url'),
                        "image_url": session.get('image_url'),
                        "script": session.get('video_script'),
                        "summary": session.get('video_summary'),
                        "quiz": session.get('quiz_content'),
                        "topic": session.get('final_topic')
                    }
                    return jsonify(response_data)

                response_data = {
                    "reply": success_message,
                    "action": action_type,
                    "audio_url": session.get('audio_url'),
                    "video_url": session.get('video_url'),
                    "image_url": session.get('image_url'),
                    "topic": session.get('final_topic'),
                    "script": session.get('video_script'),
                    "summary": session.get('video_summary'),
                    "quiz": session.get('quiz_content')
                }
                session['conversation_state'] = next_state

            except Exception as e:
                logger.error(f"Error during media re-generation from BOTH_GENERATED state: {e}", exc_info=True)
                response_data = {"reply": f"An error occurred during media re-generation: {e}. Please try again.", "action": "error"}
                session['conversation_state'] = 'IDLE'

        elif current_state == 'GENERATING_CONTENT':
            response_data = {"reply": "I'm currently working on your request. Please wait a moment.", "action": "in_progress"}

        else:
            response_data = {"reply": "Something went wrong with our conversation state. Let's start fresh. Please provide a topic.", "action": "reset"}
            session['conversation_state'] = 'IDLE'

    except Exception as e:
        logger.error(f"An unexpected error occurred in chat: {e}", exc_info=True)
        response_data = {"reply": "Sorry, an unexpected error occurred. Please try again.", "action": "error"}
        session['conversation_state'] = 'IDLE'

    return jsonify(response_data)

# --- NEW: Routes to list all generated audio and video files ---

@app.route('/list_script', methods=['GET'])
def list_script_files():
    """List script files from Firebase Storage for the current user."""
    if 'user_id' not in session:
        print("No user ID in session")
        logger.warning("No user ID in session for script listing")
        return jsonify({"error": "User not logged in"}), 401
    
    user_id = session.get('user_id')
    print(f"User ID: {user_id}")
    script_files = []
    
    try:
        bucket = storage.bucket()
        prefix = f"users/{user_id}/script/"
        print(f"Searching for blobs with prefix: {prefix}")
        
        blobs = bucket.list_blobs(prefix=prefix)
        
        for blob in blobs:
            print(f"Found blob: {blob.name}")
            if blob.name.endswith('.txt'):
                filename = blob.name.split('/')[-1]
                script_files.append({
                    "filename": filename,
                    "url": blob.public_url
                })
                print(f"Added script file: {filename}")
        
        print(f"Total script files found: {len(script_files)}")
        logger.info(f"Listed {len(script_files)} script files for user {user_id}")
        return jsonify(script_files), 200
        
    except Exception as e:
        print(f"Error in list_script: {e}")
        logger.error(f"Error listing script files: {e}", exc_info=True)
        return jsonify({"error": f"Failed to list script files: {str(e)}"}), 500

@app.route('/list_audio', methods=['GET'])
def list_audio_files():
    """List audio files from Firebase Storage for the current user."""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    user_id = session.get('user_id')
    audio_files = []
    
    try:
        bucket = storage.bucket()
        blobs = bucket.list_blobs(prefix=f"users/{user_id}/audio/")
        
        for blob in blobs:
            if blob.name.endswith('.mp3'):
                filename = blob.name.split('/')[-1]
                audio_files.append({
                    "filename": filename,
                    "url": blob.public_url
                })
        
        logger.info(f"Listed {len(audio_files)} audio files for user {user_id}")
        return jsonify(audio_files), 200
        
    except Exception as e:
        logger.error(f"Error listing audio files: {e}")
        return jsonify({"error": "Failed to list audio files"}), 500

@app.route('/list_video', methods=['GET'])
def list_video_files():
    """List video files from Firebase Storage for the current user."""
    if 'user_id' not in session:
        return jsonify({"error": "User not logged in"}), 401
    
    user_id = session.get('user_id')
    video_files = []
    
    try:
        bucket = storage.bucket()
        blobs = bucket.list_blobs(prefix=f"users/{user_id}/video/")
        
        for blob in blobs:
            if blob.name.endswith('.mp4'):
                filename = blob.name.split('/')[-1]
                video_files.append({
                    "filename": filename,
                    "url": blob.public_url
                })
        
        logger.info(f"Listed {len(video_files)} video files for user {user_id}")
        return jsonify(video_files), 200
        
    except Exception as e:
        logger.error(f"Error listing video files: {e}")
        return jsonify({"error": "Failed to list video files"}), 500

@app.route('/login', methods = ['POST'])
def login():
    data = request.get_json()
    usermail = data.get('email')
    password = data.get('password')

    user_query = userCollection.where('user_mail', '==', usermail).stream()
    user_doc = next(user_query, None)

    if user_doc is None:
        print("User not found")
        return jsonify({"message": "User not found", "logged": False})

    user_data = user_doc.to_dict()

    stored_password = user_data.get("password", "")

    if not bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
        print("Invalid credentials")
        return jsonify({"message": "Invalid credentials", "logged": False})

    print("Login successful")

    # Clear any existing session data first
    session.clear()

    # Set new session data
    session['user_name'] = user_data.get("user_name")
    session['user_id'] = user_data.get("user_id")
    session['user_mail'] = user_data.get("user_mail")
    session.permanent = True  # Only make this specific session permanent
    session.modified = True

    print(f"User logged in with ID: {session.get('user_id')}")

    return jsonify({"message": "Authentication Success!", "logged": True}), 200


@app.route('/profile_fetch', methods=['GET'])
def profile_fetch():
    if "user_id" not in session:
        print("User not logged in")
        return jsonify({"message": "User not logged in!"}), 401
    
    user_name = session.get('user_name')
    user_mail = session.get('user_mail')

    return jsonify({"user_name": user_name, "user_mail": user_mail}), 200

@app.route('/update_profile_name', methods=['POST'])
def update_profile_name():

    if 'user_id' not in session:
        print("User not logged in!")
        return jsonify({"message": "User not logged in!", "changed": False}), 401
 
    user_id = session.get('user_id')
    data = request.get_json()
    new_name = data.get('new_name')

    user_query = userCollection.where('user_id', "==", user_id).stream()
    user_doc = next(user_query, None)

    if user_doc is None:
        print("User not found!")
        return jsonify({"message": "User not found!", "changed": False})

    userCollection.document(user_doc.id).update({
        "user_name": new_name
    })

    return jsonify({"message": "User name updated successfully!","changed": True}), 200


@app.route('/update_password', methods = ['POST'])
def update_password():
    data = request.get_json()

    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if 'user_id'not in session:
        return jsonify({"message": "User not logged in", "updated": False}), 401
        
    if not old_password:
        return jsonify({"message": "Old password required", "updated": False}), 400
    
    user_query = userCollection.where('user_id', "==", session.get('user_id')).stream()
    user_doc = next(user_query, None)

    if user_doc is None:
        return jsonify({"message": "User not found", "updated": False}), 400
    
    user_data = user_doc.to_dict()

    stored_password = user_data.get("password", "").encode('utf-8')

    if not bcrypt.checkpw(old_password.encode('utf-8'), stored_password):
        print("Incorrect")
        return jsonify({"message": "Password Incorrect!", "updated": False}), 400
    
    if not new_password:
        return jsonify({"message": "New Passord required"})
    
    newHashedPassword = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    userCollection.document(user_doc.id).update({"password": newHashedPassword.decode('utf-8')})
    
    print("Password Changed")

    return jsonify({"message": "Success", "updated": True}), 200


@app.route('/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Logout endpoint that clears all session data"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        user_id = session.get('user_id')
        logger.info(f"User {user_id} logging out")

        # Clear all session data
        session.clear()
        session.permanent = False  # Ensure session is not permanent after logout
        session.modified = True

        logger.info("User logged out successfully - session cleared")
        response = jsonify({"message": "Logged out successfully", "success": True})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Credentials', 'true')

        # Set cookie to expire immediately to ensure cleanup
        response.set_cookie('session', '', expires=0, secure=True, httponly=True, samesite='None')

        return response, 200
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        response = jsonify({"message": "Error during logout", "success": False})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 500


@app.route('/session/check', methods=['GET'])
def check_session():
    """Check current session status"""
    try:
        user_id = session.get('user_id')
        user_email = session.get('user_mail')
        user_name = session.get('user_name')

        # Verify that all required session data is present
        if user_id and user_email and user_name:
            # Optionally verify user still exists in database
            try:
                user_query = userCollection.where('user_id', '==', user_id).stream()
                user_doc = next(user_query, None)

                if user_doc is None:
                    session.clear()
                    session.modified = True
                    return jsonify({
                        'authenticated': False,
                        'message': 'User account no longer exists'
                    }), 401

            except Exception as db_error:
                logger.warning(f"Could not verify user in database: {db_error}")
                # Continue with session check even if DB verification fails

            return jsonify({
                'authenticated': True,
                'user_id': user_id,
                'user_email': user_email,
                'user_name': user_name
            }), 200
        else:
            # Clear any partial session data
            if any(session.get(key) for key in ['user_id', 'user_mail', 'user_name']):
                session.clear()
                session.modified = True

            return jsonify({
                'authenticated': False,
                'message': 'No active session'
            }), 401

    except Exception as e:
        logger.error(f"Error checking session: {e}")
        # Clear session on error to prevent issues
        session.clear()
        session.modified = True
        return jsonify({'authenticated': False, 'error': 'Session check failed'}), 500

@app.route('/admin/check_admin', methods=['GET'])
def check_admin():
    """Check if current user is admin"""
    try:
        user_email = session.get('user_mail')
        if not user_email:
            print("No user mail")
            return jsonify({'isAdmin': False}), 401
        
        # Get user document from Firestore
        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        
        if not user_doc:
            return jsonify({'isAdmin': False}), 401
        
        user_data = user_doc[0].to_dict()
        is_admin = user_data.get('isAdmin', False)
        
        return jsonify({'isAdmin': is_admin}), 200
        
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return jsonify({'isAdmin': False}), 500

@app.route('/admin/users', methods=['GET'])
def get_all_users():
    """Get all users (admin only)"""
    try:
        user_email = session.get('user_mail')
        if not user_email:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Check if user is admin
        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if not user_doc:
            return jsonify({'error': 'User not found'}), 401
        
        user_data = user_doc[0].to_dict()
        if not user_data.get('isAdmin', False):
            return jsonify({'error': 'Access denied'}), 403
        
        # Get all users
        users_docs = userCollection.get()
        users = []
        
        for doc in users_docs:
            user_data = doc.to_dict()
            # Don't include password hash
            user_info = {
                'id': doc.id,
                'name': user_data.get('user_name', ''),
                'email': user_data.get('user_mail', ''),
                'sessions': user_data.get('sessions', 0),
                'isAdmin': user_data.get('isAdmin', False),
                'isCurrentUser': user_data.get('user_mail') == user_email
            }
            users.append(user_info)
        
        return jsonify({'users': users}), 200
        
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({'error': 'Failed to fetch users'}), 500

@app.route('/admin/requests', methods=['GET'])
def get_user_requests():
    """Get user account requests (admin only)"""
    try:
        user_email = session.get('user_mail')
        if not user_email:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Check if user is admin
        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if not user_doc:
            return jsonify({'error': 'User not found'}), 401
        
        user_data = user_doc[0].to_dict()
        if not user_data.get('isAdmin', False):
            return jsonify({'error': 'Access denied'}), 403
        
        # Get user requests collection
        
        requests_docs = requestCollection.get()
        requests = []
        
        for doc in requests_docs:
            request_data = doc.to_dict()
            request_info = {
                'id': request_data.get('req_id', ''),
                'name': request_data.get('name', ''),
                'email': request_data.get('mail', ''),
                'message': request_data.get('message', ''),
                'timestamp': request_data.get('timestamp', ''),
                'status': request_data.get('status', 'pending')
            }
            requests.append(request_info)
        
        return jsonify({'requests': requests}), 200
        
    except Exception as e:
        logger.error(f"Error fetching requests: {e}")
        return jsonify({'error': 'Failed to fetch requests'}), 500
        

@app.route('/admin/delete_user', methods=['POST'])
def delete_user():
    """Delete user account (admin only)"""
    try:
        user_email = session.get('user_mail')
        if not user_email:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Check if user is admin
        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if not user_doc:
            return jsonify({'error': 'User not found'}), 401
        
        user_data = user_doc[0].to_dict()
        if not user_data.get('isAdmin', False):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        
        # Get user to delete
        user_to_delete = userCollection.document(user_id).get()
        if not user_to_delete.exists:
            return jsonify({'error': 'User not found'}), 404
        
        user_to_delete_data = user_to_delete.to_dict()
        
        # Prevent admin from deleting themselves
        if user_to_delete_data.get('user_mail') == user_email:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        # Delete user from Firestore
        userCollection.document(user_id).delete()
        
        # Delete user's files from Firebase Storage
        bucket = storage.bucket()
        user_files_prefix = f"users/{user_id}/"
        
        blobs = bucket.list_blobs(prefix=user_files_prefix)
        for blob in blobs:
            blob.delete()
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        return jsonify({'error': 'Failed to delete user'}), 500


@app.route('/makerequest', methods=['POST'])
def makerequest():
    try:
        data = request.get_json()
        
        
        if not data:
            print("No data!!")
            return jsonify({
                'requested': False,
                'error': 'No data provided'
            }), 400
        
        requestName = data.get('fullName')
        requestMail = data.get('email')
        requestDescription = data.get('description')

        print(requestName, requestMail, requestDescription)
        
        
        if not all([requestName, requestMail, requestDescription]):
            print("No all data!!")
            return jsonify({
                'requested': False,
                'error': 'Missing required fields: fullName, email, or description'
            }), 400
        
        requestId = str(uuid.uuid4())  
        
        
        doc_ref = requestCollection.add({
            "req_id": requestId,
            "name": requestName, 
            "mail": requestMail,
            "message": requestDescription,
            "status": "pending",
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        
        print("Success")
        return jsonify({
            'requested': True,
            'message': 'Request submitted successfully',
            'request_id': requestId,
            'document_id': doc_ref[1].id  
        }), 201
        
    except Exception as e:
        print(f"Error in makerequest: {str(e)}")
        
        return jsonify({
            'requested': False,
            'error': 'Failed to submit request',
            'details': str(e)  
        }), 500


@app.route('/admin/approve_user', methods=['POST'])
def approve_user():
    """Approve user request and create approval token (admin only)"""
    try:
        user_email = session.get('user_mail')
        if not user_email:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Check if user is admin
        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if not user_doc:
            return jsonify({'error': 'User not found'}), 401
        
        user_data = user_doc[0].to_dict()
        if not user_data.get('isAdmin', False):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        request_id = data.get('requestId')
        
        if not request_id:
            return jsonify({'error': 'Request ID required'}), 400
        
        # Get the original request
        request_docs = requestCollection.where('req_id', '==', request_id).limit(1).get()
        if not request_docs:
            return jsonify({'error': 'Request not found'}), 404
        
        request_doc = request_docs[0]
        request_info = request_doc.to_dict()
        
        # Generate approval token
        approval_token = str(uuid.uuid4())
        expiry_time = datetime.now() + timedelta(hours=24)
        
        logger.info(f"Generated approval token: {approval_token}")
        logger.info(f"Expiry time: {expiry_time}")
        
        # Create approval record
        approval_data = {
            'approval_token': approval_token,
            'request_id': request_id,
            'request_data': request_info,
            'expiry_time': expiry_time,  # Store as datetime object
            'status': 'pending',
            'created_at': firestore.SERVER_TIMESTAMP
        }
        
        logger.info(f"Approval data to save: {approval_data}")
        
        # Save to Approvals collection
        doc_ref = approvalCollection.add(approval_data)
        logger.info(f"Approval saved with document ID: {doc_ref[1].id}")
        
        # Update request status
        request_doc.reference.update({'status': 'approved'})
        logger.info("Request status updated to approved")
        
        # Generate Gmail compose URL
        activation_link = f"https://gen-teach-ai-kd7v.vercel.app/approve/{approval_token}"
        
        subject = "🎉 Welcome to GenTeach - Your Account Has Been Approved!"
        body = f"""Dear {request_info.get('name', 'New GenTeach User')},

Congratulations! 🎊 Your account request has been approved.

We are absolutely thrilled to have you as an early user of GenTeach - our innovative platform for creating AI-generated educational content including audio, scripts, and videos.

To complete your account setup, please click the activation link below:
{activation_link}

This link will expire in 24 hours for security reasons.

As you embark on this journey with us, we hope you make the best out of GenTeach's powerful features. We trust that you'll use this tool responsibly and ethically to create amazing educational content that benefits learners everywhere.

📋 Important Guidelines:
• Please use GenTeach responsibly and in accordance with our terms of service
• Ensure all generated content is appropriate and educational in nature
• Respect intellectual property rights and content guidelines

🛡️ Your Security & Support:
If you ever feel anything is slightly off, experience any security concerns, or encounter any issues while using GenTeach, please don't hesitate to reach out to us immediately. We're here to help and ensure you have the best possible experience.

Ready to start creating? Complete your account setup and begin transforming education with AI-powered content creation!

Welcome aboard,
The GenTeach Team

---
Support: support@genteach.com
Website: www.genteach.com

This is an automated message. Please do not reply to this email."""
        
        # URL encode the parameters
        encoded_recipient = quote_plus(request_info.get('mail', ''))
        encoded_subject = quote_plus(subject)
        encoded_body = quote_plus(body)
        
        # Construct Gmail compose URL
        gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={encoded_recipient}&su={encoded_subject}&body={encoded_body}"
        
        return jsonify({
            'success': True,
            'message': 'User approved successfully',
            'approval_token': approval_token,
            'gmail_compose_url': gmail_url,
            'expiry_time': expiry_time.isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error approving user: {e}")
        return jsonify({'error': 'Failed to approve user'}), 500


@app.route('/admin/reject_user', methods=['POST'])
def reject_user():
    """Reject user request (admin only)"""
    try:
        user_email = session.get('user_mail')
        if not user_email:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Check if user is admin
        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if not user_doc:
            return jsonify({'error': 'User not found'}), 401
        
        user_data = user_doc[0].to_dict()
        if not user_data.get('isAdmin', False):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        request_id = data.get('requestId')
        
        if not request_id:
            return jsonify({'error': 'Request ID required'}), 400
        
        # Get the original request
        request_docs = requestCollection.where('req_id', '==', request_id).limit(1).get()
        if not request_docs:
            return jsonify({'error': 'Request not found'}), 404
        
        request_doc = request_docs[0]
        request_info = request_doc.to_dict()
        
        # Update request status to rejected
        request_doc.reference.update({'status': 'rejected'})
        
        # Generate rejection email
        subject = "GenTeach Account Request - Update"
        body = f"""Dear {request_info.get('name', 'User')},

Thank you for your interest in GenTeach. After careful review of your account request, we regret to inform you that we are unable to approve your request at this time.

This decision may be based on various factors including:
• Current capacity limitations
• Specific requirements for early access
• Information provided in your request

We appreciate your understanding and hope you'll consider applying again in the future as we expand our platform.

Best regards,
The GenTeach Team

---
Support: support@genteach.com
Website: www.genteach.com

This is an automated message. Please do not reply to this email."""
        
        # URL encode the parameters
        encoded_recipient = quote_plus(request_info.get('mail', ''))
        encoded_subject = quote_plus(subject)
        encoded_body = quote_plus(body)
        
        # Construct Gmail compose URL
        gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={encoded_recipient}&su={encoded_subject}&body={encoded_body}"
        
        return jsonify({
            'success': True,
            'message': 'User rejected successfully',
            'gmail_compose_url': gmail_url
        }), 200
        
    except Exception as e:
        logger.error(f"Error rejecting user: {e}")
        return jsonify({'error': 'Failed to reject user'}), 500


@app.route('/approve/<approval_token>', methods=['GET'])
def get_approval_page(approval_token):
    """Get approval page for a specific token"""
    print(approval_token)
    try:
        print(approval_token)
        logger.info(f"Validating approval token: {approval_token}")
        
        # Find approval record
        approval_docs = approvalCollection.where('approval_token', '==', approval_token).limit(1).get()
        print(approval_docs)
        logger.info(f"Found {len(approval_docs)} approval documents")
        
        if not approval_docs:
            logger.error(f"No approval record found for token: {approval_token}")
            return jsonify({'error': 'Invalid approval token'}), 404
        
        approval_data = approval_docs[0].to_dict()
        logger.info(f"Approval data: {approval_data}")
        
        expiry_time = approval_data.get('expiry_time')
        logger.info(f"Raw expiry time: {expiry_time}, type: {type(expiry_time)}")
        
        # Convert Firebase timestamp to datetime if needed
        if hasattr(expiry_time, 'timestamp'):
            # Handle DatetimeWithNanoseconds object
            if hasattr(expiry_time, 'to_pydatetime'):
                expiry_time = expiry_time.to_pydatetime()
            else:
                # For DatetimeWithNanoseconds, convert directly
                expiry_time = datetime.fromtimestamp(expiry_time.timestamp())
            logger.info(f"Converted expiry time: {expiry_time}")
        
        # Check if token has expired
        if expiry_time and datetime.now() > expiry_time:
            logger.info(f"Token expired: {expiry_time}")
            return jsonify({'error': 'Approval token has expired'}), 410
        
        # Check if already used
        if approval_data.get('status') == 'completed':
            logger.info("Token already used")
            return jsonify({'error': 'Approval token has already been used'}), 409
        
        logger.info("Token validation successful")
        return jsonify({
            'success': True,
            'approval_data': approval_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting approval page: {e}")
        return jsonify({'error': 'Failed to get approval page'}), 500


@app.route('/approve/<approval_token>/confirm', methods=['POST'])
def confirm_approval(approval_token):
    """Confirm approval and create user account"""
    try:
        data = request.get_json()
        password = data.get('password')
        confirm_password = data.get('confirmPassword')
        
        if not password or not confirm_password:
            return jsonify({'error': 'Password and confirmation required'}), 400
        
        if password != confirm_password:
            return jsonify({'error': 'Passwords do not match'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        
        # Find approval record
        approval_docs = approvalCollection.where('approval_token', '==', approval_token).limit(1).get()
        
        if not approval_docs:
            return jsonify({'error': 'Invalid approval token'}), 404
        
        approval_doc = approval_docs[0]
        approval_data = approval_doc.to_dict()
        expiry_time = approval_data.get('expiry_time')
        
        # Convert Firebase timestamp to datetime if needed
        if hasattr(expiry_time, 'timestamp'):
            # Handle DatetimeWithNanoseconds object
            if hasattr(expiry_time, 'to_pydatetime'):
                expiry_time = expiry_time.to_pydatetime()
            else:
                # For DatetimeWithNanoseconds, convert directly
                expiry_time = datetime.fromtimestamp(expiry_time.timestamp())
        
        # Check if token has expired
        if expiry_time and datetime.now() > expiry_time:
            return jsonify({'error': 'Approval token has expired'}), 410
        
        # Check if already used
        if approval_data.get('status') == 'completed':
            return jsonify({'error': 'Approval token has already been used'}), 409
        
        request_data = approval_data.get('request_data', {})
        user_email = request_data.get('mail')
        user_name = request_data.get('name')
        
        # Check if user already exists
        existing_user = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if existing_user:
            return jsonify({'error': 'User account already exists'}), 409
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user account
        user_id = str(uuid.uuid4())
        user_data = {
            'user_id': user_id,
            'user_mail': user_email,
            'user_name': user_name,
            'password': hashed_password,
            'isAdmin': False,
            'sessions': 0,
            'created_at': firestore.SERVER_TIMESTAMP
        }
        
        # Save user to database
        userCollection.document(user_id).set(user_data)
        
        # Mark approval as completed
        approval_doc.reference.update({
            'status': 'completed',
            'completed_at': firestore.SERVER_TIMESTAMP
        })
        
        return jsonify({
            'success': True,
            'message': 'Account created successfully',
            'user_id': user_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error confirming approval: {e}")
        return jsonify({'error': 'Failed to create account'}), 500


   

def cleanup_temp_files():
    """Clean up temporary files on shutdown"""
    try:
        temp_credentials_path = os.path.join(TEMP_FOLDER, 'google_credentials.json')
        if os.path.exists(temp_credentials_path):
            os.remove(temp_credentials_path)
            logger.info("Cleaned up temporary Google credentials file")
    except Exception as e:
        logger.error(f"Error cleaning up temporary files: {e}")

if __name__ == '__main__':
    import os
    
    os.makedirs(TEMP_FOLDER, exist_ok=True) 
    os.makedirs(FONTS_FOLDER, exist_ok=True) 
    os.makedirs(PATTERNS_FOLDER, exist_ok=True)

    try:
        port = int(os.environ.get('PORT', 8080))
        app.run(host='0.0.0.0', port=port, debug=False)
    finally:
        cleanup_temp_files()
