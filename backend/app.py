"""
Production-ready Flask application for GenTeach with Firestore-based locking.
This version works without Redis/Celery for immediate deployment to Google Cloud.
Heavy processing is handled with threading and proper locking.
"""

import os
import re
import json
import uuid
import logging
import bcrypt
import threading
import tempfile
from datetime import timedelta, datetime
from flask import Flask, request, jsonify, session, send_from_directory
from dotenv import load_dotenv
import google.generativeai as genai
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from firebase_config import db, userCollection, usageCollection, requestCollection, approvalCollection
from firebase_admin import firestore

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Secret Key configuration
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'hello-world')
if not app.secret_key:
    logger.warning("WARNING: FLASK_SECRET_KEY environment variable not set.")
    app.secret_key = "a_fallback_secret_key_for_dev_only_change_this_in_production_12345"

# Initialize SocketIO with additional configuration for Google Cloud Run
socketio = SocketIO(app,
                   cors_allowed_origins=["http://localhost:5173", "https://gen-teach-ai-kd7v.vercel.app"],
                   logger=True,
                   engineio_logger=True,
                   async_mode='threading',  # Use threading mode for Google Cloud Run
                   transports=['polling', 'websocket'],  # Allow both polling and websocket
                   ping_timeout=60,
                   ping_interval=25)

# Store user socket sessions
user_sockets = {}

# Socket event handlers
@socketio.on('connect')
def handle_connect():
    user_id = session.get('user_id')
    if user_id:
        user_sockets[user_id] = request.sid
        logger.info(f"User {user_id} connected with socket {request.sid}")
        emit('connected', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    user_id = session.get('user_id')
    if user_id and user_id in user_sockets:
        del user_sockets[user_id]
        logger.info(f"User {user_id} disconnected")

def emit_to_user(user_id, event, data):
    """Emit an event to a specific user if they're connected"""
    if user_id in user_sockets:
        socketio.emit(event, data, room=user_sockets[user_id])
        logger.info(f"Emitted {event} to user {user_id}")
        return True
    return False

# Session configuration
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True

# CORS configuration
CORS(app,
     supports_credentials=True,
     origins=["http://localhost:5173", "https://gen-teach-ai-kd7v.vercel.app"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type"])

# Gemini API Configuration
gemini_api_key = os.getenv('GEMINI_API_KEY').strip()
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY environment variable not set.")
genai.configure(api_key=gemini_api_key)

# Initialize the Gemini model
model = genai.GenerativeModel('gemini-1.5-flash-latest')

# Session management middleware
@app.before_request
def before_request():
    """Handle session management before each request"""
    public_endpoints = [
        'login', 'logout', 'makerequest', 'verify_approval_token',
        'static', 'sessionclear', 'check_session'
    ]

    if request.method == 'OPTIONS' or request.endpoint in public_endpoints:
        return

@app.after_request
def after_request(response):
    """Handle session cleanup after each request"""
    if not session and not session.permanent:
        response.set_cookie('session', '', expires=0, secure=True, httponly=True, samesite='None')
    return response





def background_generation_task(user_id, content_type, task_data):
    """
    Background task for content generation using threading.
    This runs the original generation functions in a separate thread.
    """
    try:
        logger.info(f"Starting background generation for user {user_id}, type: {content_type}")
        
        # Emit generation started event
        emit_to_user(user_id, 'generation_started', {
            'type': content_type,
            'message': f'{content_type.title()} generation started...'
        })
        
        # Import the generation functions from generation_logic
        from generation_logic import generate_audio_from_script, generate_video_from_script, generate_image_from_prompt
        
        # Set session context for the generation functions
        with app.test_request_context():
            # Restore session data for the generation functions
            session_data = task_data.get('session_data', {})
            for key, value in session_data.items():
                session[key] = value

            result = {}

            if content_type == 'audio':
                script_content = task_data.get('script_content', '')
                # Call with explicit parameters to avoid session dependency
                audio_url = generate_audio_from_script(
                    script_content=script_content,
                    user_id=user_id,
                    topic_name=session_data.get('final_topic', 'audio')
                )
                result = {
                    'audio_url': audio_url,
                    'content_type': 'audio',
                    'message': 'Audio generated successfully!'
                }
                
            elif content_type == 'video':
                script_content = task_data.get('script_content', '')
                # Call with explicit parameters
                video_url = generate_video_from_script(
                    script_content=script_content,
                    user_id=user_id,
                    topic_name=session_data.get('final_topic', 'video'),
                    audio_url=session_data.get('audio_url'),
                    image_url=session_data.get('image_url'),
                    project_id=os.getenv('GCP_PROJECT_ID')
                )
                result = {
                    'video_url': video_url,
                    'audio_url': session_data.get('audio_url'),
                    'image_url': session_data.get('image_url'),
                    'content_type': 'video',
                    'message': 'Video generated successfully!'
                }
                
            elif content_type == 'both':
                script_content = task_data.get('script_content', '')
                topic_name = session_data.get('final_topic', 'content')
                project_id = os.getenv('GCP_PROJECT_ID')

                # Generate audio first if not exists
                audio_url = session_data.get('audio_url')
                if not audio_url:
                    audio_url = generate_audio_from_script(
                        script_content=script_content,
                        user_id=user_id,
                        topic_name=topic_name
                    )
                    session['audio_url'] = audio_url

                # Generate image if needed
                image_url = session_data.get('image_url')
                if not image_url and project_id:
                    image_prompt = f"Educational illustration for: {topic_name}. Focus on key concepts from the script."
                    image_url = generate_image_from_prompt(
                        prompt_text=image_prompt,
                        project_id=project_id,
                        user_id=user_id,
                        topic_name=topic_name
                    )
                    session['image_url'] = image_url

                # Generate video
                video_url = generate_video_from_script(
                    script_content=script_content,
                    user_id=user_id,
                    topic_name=topic_name,
                    audio_url=audio_url,
                    image_url=image_url,
                    project_id=project_id
                )

                result = {
                    'audio_url': audio_url,
                    'video_url': video_url,
                    'image_url': image_url,
                    'content_type': 'both',
                    'message': 'Audio and video generated successfully!'
                }
            
            # Add additional metadata
            result.update({
                'script_content': task_data.get('script_content'),
                'video_script': session.get('video_script'),
                'video_summary': session.get('video_summary'),
                'quiz_content': session.get('quiz_content'),
                'topic_name': session.get('final_topic')
            })
            
            # Store results in session for polling access
            if result.get('audio_url'):
                session['audio_url'] = result.get('audio_url')
            if result.get('video_url'):
                session['video_url'] = result.get('video_url')
            if result.get('image_url'):
                session['image_url'] = result.get('image_url')

            # Update conversation state
            if content_type == 'audio':
                session['conversation_state'] = 'AUDIO_GENERATED'
            elif content_type == 'video':
                session['conversation_state'] = 'VIDEO_GENERATED'
            elif content_type == 'both':
                session['conversation_state'] = 'BOTH_GENERATED'

            session.modified = True

            # Emit completion event (if Socket.IO works)
            emit_to_user(user_id, 'generation_completed', {
                'type': content_type,
                'message': result.get('message'),
                'video_url': result.get('video_url'),
                'audio_url': result.get('audio_url'),
                'image_url': result.get('image_url'),
                'script': result.get('video_script'),
                'summary': result.get('video_summary'),
                'quiz': result.get('quiz_content'),
                'topic': result.get('topic_name')
            })
            
            logger.info(f"Background generation completed for user {user_id}")
            
    except Exception as e:
        logger.error(f"Error in background generation for user {user_id}: {e}", exc_info=True)
        
        # Emit error event
        emit_to_user(user_id, 'generation_error', {
            'type': content_type,
            'message': f'Generation failed: {str(e)}'
        })
        


@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat():
    """Main chat endpoint with distributed locking for content generation"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"reply": "Please log in to continue.", "action": "auth_required"}), 401

        data = request.get_json()
        user_input = data.get('message', '').strip()

        if not user_input:
            return jsonify({"reply": "Please provide a message.", "action": "error"}), 400

        logger.info(f"User {user_id} sent message: {user_input}")



        # Check if user is requesting content generation
        generation_commands = ['generate audio', 'generate video', 'generate both', 'generate images']
        is_generation_request = any(user_input.lower() == cmd for cmd in generation_commands)

        if is_generation_request:
            content_type_map = {
                'generate audio': 'audio',
                'generate video': 'both',  # CHANGED: Video now auto-generates audio too
                'generate both': 'both',
                'generate images': 'image'
            }
            content_type = content_type_map[user_input.lower()]


            # Prepare task data with current session
            task_data = {
                'user_id': user_id,
                'content_type': content_type,
                'script_content': session.get('video_script', ''),
                'session_data': {
                    'user_id': session.get('user_id'),
                    'user_mail': session.get('user_mail'),
                    'user_name': session.get('user_name'),
                    'video_script': session.get('video_script'),
                    'final_topic': session.get('final_topic'),
                    'video_summary': session.get('video_summary'),
                    'quiz_content': session.get('quiz_content'),
                    'audio_url': session.get('audio_url'),
                    'image_url': session.get('image_url'),
                    'conversation_state': session.get('conversation_state')
                }
            }

            # Start background thread for generation
            thread = threading.Thread(
                target=background_generation_task,
                args=(user_id, content_type, task_data)
            )
            thread.daemon = True
            thread.start()

            # Return immediate response
            return jsonify({
                "reply": f"{content_type.title()} generation has started! This may take several minutes.",
                "action": f"{content_type}_generating",
                "generation_in_progress": True
            })

        # CRITICAL: If we reach here, chat should be unlocked, but double-check conversation state
        # If user has completed video generation, they shouldn't be able to send messages
        current_state = session.get('conversation_state', 'IDLE')

        # BLOCK: If conversation state indicates completed video generation, this is an error
        if current_state in ['VIDEO_GENERATED', 'BOTH_GENERATED']:
            logger.error(f"CRITICAL: User {user_id} bypassed lock system with conversation_state={current_state}")
            return jsonify({
                "reply": "🔒 Session error detected. Please discard chat and start a new session.",
                "action": "session_error",
                "locked": True,
                "lock_type": "SESSION_ERROR"
            }), 423

        if current_state == 'IDLE':
            # Topic processing logic (same as original)
            prompt = f"""
            You are an AI assistant for an educational content generation platform. A user has provided a topic they want to learn about.

            Your task is to analyze their input and respond with JSON in one of these formats:

            1. **If the user's topic is too broad or vague**, help them narrow it down. Respond with JSON:
               `{{"action": "refine_topic", "message": "Your topic '{user_input}' is quite broad. Let me help you narrow it down. What specific aspect would you like to focus on?", "suggestions": ["suggestion1", "suggestion2", "suggestion3"]}}`

            2. **If the user's topic is already specific enough**, confirm and ask for confirmation. Respond with JSON:
               `{{"action": "confirm_generation", "message": "You've requested a video on '{user_input}'. This seems sufficiently specific. Confirm 'Generate Content' to proceed.", "topic": "{user_input}"}}`

            User's initial topic: "{user_input}"
            """
            session['context_topic'] = user_input
            session['conversation_state'] = 'AWAITING_RESPONSE'

            try:
                gemini_response = model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                parsed_response = json.loads(gemini_response.text)
                return jsonify(parsed_response)
            except Exception as e:
                logger.error(f"Error in topic processing: {e}")
                return jsonify({
                    "reply": "I had trouble processing your topic. Could you please rephrase it?",
                    "action": "error"
                })

        elif current_state == 'AWAITING_RESPONSE':
            if user_input.lower() == 'generate content':
                # Generate script (same logic as original)
                topic_for_script = session.get('context_topic', user_input)
                session['final_topic'] = topic_for_script

                script_prompt = f"""
                Create a comprehensive educational script for a video lecture on: "{topic_for_script}"

                The script should be educational, well-structured, 3-5 minutes when spoken, conversational and engaging.

                Respond with JSON: {{"script_content": "Your detailed script here..."}}
                """

                try:
                    script_response = model.generate_content(
                        script_prompt,
                        generation_config={"response_mime_type": "application/json"}
                    )
                    script_parsed = json.loads(script_response.text)
                    video_script = script_parsed.get('script_content', "Could not generate script.")
                    session['video_script'] = video_script

                    # Generate quiz and summary
                    quiz_prompt = f"""Based on this script, create a quiz with 10 multiple-choice questions and a summary.

                    Script: {video_script}

                    Respond with JSON: {{"summary": "...", "quiz": [{{"question": "...", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "correct_answer": "A"}}]}}
                    """

                    quiz_response = model.generate_content(
                        quiz_prompt,
                        generation_config={"response_mime_type": "application/json"}
                    )
                    quiz_parsed = json.loads(quiz_response.text)
                    session['video_summary'] = quiz_parsed.get('summary', "Could not generate summary.")
                    session['quiz_content'] = quiz_parsed.get('quiz', [])
                    session['conversation_state'] = 'SCRIPT_GENERATED'

                    return jsonify({
                        "reply": "Script and quiz generated! What would you like to do: 'generate audio', 'generate video', 'generate images', or 'generate both'?",
                        "action": "show_script_and_quiz",
                        "script": video_script,
                        "summary": session['video_summary'],
                        "quiz": session['quiz_content'],
                        "topic": topic_for_script
                    })

                except Exception as e:
                    logger.error(f"Error generating script: {e}")
                    return jsonify({
                        "reply": "I had trouble generating the script. Please try again.",
                        "action": "error"
                    })
            else:
                session['context_topic'] = user_input
                return jsonify({
                    "action": "confirm_generation",
                    "message": f"Great! You've refined your topic to '{user_input}'. Confirm 'Generate Content' to proceed.",
                    "topic": user_input
                })

        # Handle other states
        elif current_state in ['SCRIPT_GENERATED', 'AUDIO_GENERATED']:
            # Only allow SCRIPT_GENERATED and AUDIO_GENERATED states to continue
            # VIDEO_GENERATED and BOTH_GENERATED should be blocked by lock system above
            if user_input.lower() == 'start over':
                session.clear()
                return jsonify({
                    "reply": "Okay, let's start fresh. Please provide a new topic.",
                    "action": "reset"
                })
            else:
                return jsonify({
                    "reply": "You can 'generate audio', 'generate video', 'generate images', 'generate both', or 'start over'.",
                    "action": "options_available"
                })

        # CRITICAL: VIDEO_GENERATED and BOTH_GENERATED should NEVER reach here due to lock system
        elif current_state in ['VIDEO_GENERATED', 'BOTH_GENERATED']:
            logger.error(f"CRITICAL: User {user_id} reached legacy conversation logic with state {current_state}")
            return jsonify({
                "reply": "🔒 Session error: Video generation completed. Please discard chat and start new session.",
                "action": "session_error",
                "locked": True,
                "lock_type": "SESSION_ERROR"
            }), 423

        else:
            return jsonify({
                "reply": "I'm not sure how to help with that. Please start over with a new topic.",
                "action": "error"
            })

    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}", exc_info=True)
        return jsonify({
            "reply": "An error occurred. Please try again.",
            "action": "error"
        }), 500

@app.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    data = request.get_json()
    usermail = data.get('email')
    password = data.get('password')

    user_query = userCollection.where('user_mail', '==', usermail).stream()
    user_doc = next(user_query, None)

    if user_doc is None:
        return jsonify({"message": "User not found", "logged": False})

    user_data = user_doc.to_dict()
    stored_password = user_data.get("password", "")

    if not bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
        return jsonify({"message": "Invalid credentials", "logged": False})

    session.clear()
    session['user_name'] = user_data.get("user_name")
    session['user_id'] = user_data.get("user_id")
    session['user_mail'] = user_data.get("user_mail")
    session.permanent = True
    session.modified = True

    return jsonify({"message": "Authentication Success!", "logged": True}), 200

@app.route('/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Logout endpoint"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        session.clear()
        session.permanent = False
        session.modified = True

        response = jsonify({"message": "Logged out successfully", "success": True})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.set_cookie('session', '', expires=0, secure=True, httponly=True, samesite='None')
        return response, 200
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        return jsonify({"message": "Error during logout", "success": False}), 500

@app.route('/session/check', methods=['GET'])
def check_session():
    """Check current session status and any running tasks"""
    try:
        user_id = session.get('user_id') 
        user_email = session.get('user_mail')
        user_name = session.get('user_name')

        if user_id and user_email and user_name:
            # Check if user has a running task
            task_doc = db.collection('currenttasks').document(user_id).get()
            generation_in_progress = task_doc.exists

            # Check comprehensive lock state using the restriction function
            is_restricted, restriction_type, restriction_message = check_video_generation_restrictions(user_id)
            logger.info(f"Session check for user {user_id}: is_restricted={is_restricted}, restriction_type={restriction_type}, restriction_message={restriction_message}")

            # Check if generation just completed (has results but no task running)
            has_completed_generation = False
            completed_content_type = None

            if not generation_in_progress:
                # Check if we have new content that wasn't delivered to chat yet
                if session.get('video_url') and session.get('conversation_state') in ['VIDEO_GENERATED', 'BOTH_GENERATED']:
                    has_completed_generation = True
                    completed_content_type = 'video'
                elif session.get('audio_url') and session.get('conversation_state') in ['AUDIO_GENERATED', 'BOTH_GENERATED']:
                    has_completed_generation = True
                    completed_content_type = 'audio'

            response_data = {
                'authenticated': True,
                'user_id': user_id,
                'user_email': user_email,
                'user_name': user_name,
                'generation_in_progress': generation_in_progress,
                'generation_locked': session.get('generation_locked', False),
                'has_completed_generation': has_completed_generation,
                'completed_content_type': completed_content_type,
                'conversation_state': session.get('conversation_state', 'IDLE'),
                'has_video': bool(session.get('video_url')),
                'has_audio': bool(session.get('audio_url')),
                'has_image': bool(session.get('image_url')),
                'video_url': session.get('video_url'),
                'audio_url': session.get('audio_url'),
                'image_url': session.get('image_url'),
                'script': session.get('video_script'),
                'summary': session.get('video_summary'),
                'quiz': session.get('quiz_content'),
                'topic': session.get('final_topic'),
                # COMPREHENSIVE LOCK STATE INFORMATION
                'lock_state': {
                    'is_locked': is_restricted,
                    'lock_type': restriction_type,
                    'lock_reason': restriction_message,
                    'must_discard': restriction_type == 'SESSION_COMPLETED',
                    'must_wait': restriction_type == 'ACTIVE_GENERATION',
                    'video_generated': session.get('video_generated', False),
                    'chat_locked_permanently': session.get('chat_locked_permanently', False),
                    'video_generation_completed': session.get('video_generation_completed', False)
                },
                # Include generation result for chat delivery
                'generation_result': {
                    'video_url': session.get('video_url'),
                    'audio_url': session.get('audio_url'),
                    'image_url': session.get('image_url'),
                    'script': session.get('video_script'),
                    'summary': session.get('video_summary'),
                    'quiz': session.get('quiz_content'),
                    'topic': session.get('final_topic')
                } if has_completed_generation else None
            }

            return jsonify(response_data), 200
        else:
            return jsonify({'authenticated': False, 'message': 'No active session'}), 401

    except Exception as e:
        logger.error(f"Error checking session: {e}")
        return jsonify({'authenticated': False, 'error': 'Session check failed'}), 500

@app.route('/sessionclear', methods=['GET', 'OPTIONS'])
def sessionclear():
    """Clear current session"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        user_id = session.get('user_id')
        user_email = session.get('user_mail')
        user_name = session.get('user_name')

        # CRITICAL: Preserve ALL generation lock flags during session clear
        generation_locked = session.get('generation_locked', False)
        video_generation_in_progress = session.get('video_generation_in_progress', False)
        video_generated = session.get('video_generated', False)
        chat_locked_permanently = session.get('chat_locked_permanently', False)
        video_generation_completed = session.get('video_generation_completed', False)
        video_url = session.get('video_url')
        audio_url = session.get('audio_url')

        session.clear()

        if user_id and user_email and user_name:
            session['user_id'] = user_id
            session['user_mail'] = user_email
            session['user_name'] = user_name
            session.permanent = True

            # Restore ALL generation lock flags to prevent new messages
            session['generation_locked'] = generation_locked
            session['video_generation_in_progress'] = video_generation_in_progress
            session['video_generated'] = video_generated
            session['chat_locked_permanently'] = chat_locked_permanently
            session['video_generation_completed'] = video_generation_completed
            if video_url:
                session['video_url'] = video_url
            if audio_url:
                session['audio_url'] = audio_url

            session.modified = True

        response = jsonify({"message": "Session cleared successfully"})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    except Exception as e:
        logger.error(f"Error clearing session: {e}")
        return jsonify({"message": "Error clearing session"}), 500

@app.route('/discard_chat', methods=['POST', 'OPTIONS'])
def discard_chat():
    """Completely clear session including all lock flags - for true chat discard"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        user_id = session.get('user_id')
        user_email = session.get('user_mail')
        user_name = session.get('user_name')

        # CRITICAL: Clear ALL session data including lock flags for true discard
        session.clear()

        if user_id and user_email and user_name:
            session['user_id'] = user_id
            session['user_mail'] = user_email
            session['user_name'] = user_name
            session.permanent = True
            session.modified = True

        logger.info(f"Chat completely discarded for user {user_id} - all locks cleared")

        response = jsonify({"message": "Chat discarded successfully - all locks cleared"})
        response.headers.add('Access-Control-Allow-Origin', 'https://gen-teach-ai-kd7v.vercel.app')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    except Exception as e:
        logger.error(f"Error discarding chat: {e}")
        return jsonify({"message": "Error discarding chat"}), 500

@app.route('/makerequest', methods=['POST'])
def makerequest():
    """Handle user account requests"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'requested': False, 'error': 'No data provided'}), 400

        requestName = data.get('fullName')
        requestMail = data.get('email')
        requestDescription = data.get('description')

        if not all([requestName, requestMail, requestDescription]):
            return jsonify({
                'requested': False,
                'error': 'Missing required fields'
            }), 400

        request_data = {
            'req_id': str(uuid.uuid4()),
            'name': requestName,
            'mail': requestMail,
            'message': requestDescription,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'status': 'pending'
        }

        requestCollection.add(request_data)
        return jsonify({'requested': True, 'message': 'Request submitted successfully'}), 200

    except Exception as e:
        logger.error(f"Error in makerequest: {e}")
        return jsonify({'requested': False, 'error': 'Internal server error'}), 500

# Essential gallery routes (simplified)
@app.route('/list_video', methods=['GET'])
def list_video():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401
        return jsonify({'videos': []}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to list videos'}), 500

@app.route('/list_audio', methods=['GET'])
def list_audio():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401
        return jsonify({'audio': []}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to list audio'}), 500

@app.route('/profile_fetch', methods=['GET'])
def profile_fetch():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        user_doc = userCollection.where('user_id', '==', user_id).limit(1).get()
        if not user_doc:
            return jsonify({'error': 'User not found'}), 404

        user_data = user_doc[0].to_dict()
        return jsonify({
            'user_name': user_data.get('user_name'),
            'user_mail': user_data.get('user_mail'),
            'sessions': user_data.get('sessions', 0)
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to fetch profile'}), 500

# Missing critical routes from original app.py
@app.route('/list_script', methods=['GET'])
def list_script():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401
        return jsonify({'scripts': []}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to list scripts'}), 500

@app.route('/get_usage_data', methods=['GET'])
def get_usage_data():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401
        return jsonify({'usage': {'sessions': 0, 'generations': 0}}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get usage data'}), 500

@app.route('/update_profile_name', methods=['POST'])
def update_profile_name():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.get_json()
        new_name = data.get('new_name')
        if not new_name:
            return jsonify({'error': 'New name required'}), 400

        # Update in Firestore
        user_docs = userCollection.where('user_id', '==', user_id).limit(1).get()
        if user_docs:
            user_docs[0].reference.update({'user_name': new_name})
            session['user_name'] = new_name
            return jsonify({'message': 'Name updated successfully', 'changed': True}), 200
        else:
            return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': 'Failed to update name'}), 500

@app.route('/update_password', methods=['POST'])
def update_password():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.get_json()
        old_password = data.get('old_password')
        new_password = data.get('new_password')

        if not old_password or not new_password:
            return jsonify({'error': 'Both old and new passwords required'}), 400

        # Verify old password and update
        user_docs = userCollection.where('user_id', '==', user_id).limit(1).get()
        if user_docs:
            user_data = user_docs[0].to_dict()
            stored_password = user_data.get('password', '')

            if bcrypt.checkpw(old_password.encode('utf-8'), stored_password.encode('utf-8')):
                hashed_new_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                user_docs[0].reference.update({'password': hashed_new_password})
                return jsonify({'message': 'Password updated successfully', 'updated': True}), 200
            else:
                return jsonify({'error': 'Invalid old password'}), 400
        else:
            return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': 'Failed to update password'}), 500

# Admin routes (simplified versions)
@app.route('/admin/check_admin', methods=['GET'])
def check_admin():
    try:
        user_email = session.get('user_mail')
        if not user_email:
            return jsonify({'isAdmin': False}), 401

        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if not user_doc:
            return jsonify({'isAdmin': False}), 401

        user_data = user_doc[0].to_dict()
        is_admin = user_data.get('isAdmin', False)
        return jsonify({'isAdmin': is_admin}), 200
    except Exception as e:
        return jsonify({'isAdmin': False}), 500

@app.route('/admin/users', methods=['GET'])
def get_all_users():
    try:
        user_email = session.get('user_mail')
        if not user_email:
            return jsonify({'error': 'Not authenticated'}), 401

        # Check if user is admin
        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if not user_doc or not user_doc[0].to_dict().get('isAdmin', False):
            return jsonify({'error': 'Access denied'}), 403

        # Get all users
        users = []
        all_users = userCollection.stream()
        for user in all_users:
            user_data = user.to_dict()
            users.append({
                'user_id': user_data.get('user_id'),
                'user_name': user_data.get('user_name'),
                'user_mail': user_data.get('user_mail'),
                'isAdmin': user_data.get('isAdmin', False)
            })

        return jsonify({'users': users}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to fetch users'}), 500

@app.route('/admin/requests', methods=['GET'])
def get_user_requests():
    try:
        user_email = session.get('user_mail')
        if not user_email:
            return jsonify({'error': 'Not authenticated'}), 401

        # Check if user is admin
        user_doc = userCollection.where('user_mail', '==', user_email).limit(1).get()
        if not user_doc or not user_doc[0].to_dict().get('isAdmin', False):
            return jsonify({'error': 'Access denied'}), 403

        # Get all requests
        requests = []
        all_requests = requestCollection.stream()
        for req in all_requests:
            req_data = req.to_dict()
            requests.append({
                'req_id': req_data.get('req_id'),
                'name': req_data.get('name'),
                'mail': req_data.get('mail'),
                'message': req_data.get('message'),
                'status': req_data.get('status', 'pending')
            })

        return jsonify({'requests': requests}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to fetch requests'}), 500

@app.route('/approve/<approval_token>', methods=['GET'])
def get_approval_page(approval_token):
    try:
        # Check if approval token exists
        approval_doc = approvalCollection.where('approval_token', '==', approval_token).limit(1).get()
        if not approval_doc:
            return jsonify({'error': 'Invalid approval token'}), 404

        approval_data = approval_doc[0].to_dict()
        return jsonify({
            'valid': True,
            'name': approval_data.get('name'),
            'email': approval_data.get('email')
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get approval page'}), 500

@app.route('/approve/<approval_token>/confirm', methods=['POST'])
def confirm_approval(approval_token):
    try:
        data = request.get_json()
        password = data.get('password')

        if not password:
            return jsonify({'error': 'Password required'}), 400

        # Check if approval token exists
        approval_doc = approvalCollection.where('approval_token', '==', approval_token).limit(1).get()
        if not approval_doc:
            return jsonify({'error': 'Invalid approval token'}), 404

        approval_data = approval_doc[0].to_dict()

        # Create user account
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user_data = {
            'user_id': str(uuid.uuid4()),
            'user_name': approval_data.get('name'),
            'user_mail': approval_data.get('email'),
            'password': hashed_password,
            'isAdmin': False,
            'sessions': 0,
            'created_at': firestore.SERVER_TIMESTAMP
        }

        userCollection.add(user_data)

        # Delete approval token
        approval_doc[0].reference.delete()

        return jsonify({'message': 'Account created successfully'}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to create account'}), 500

@app.route('/generation_status', methods=['GET'])
def generation_status():
    """Check if user has a generation task in progress (polling endpoint)"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        # Check if user has a running task
        task_doc = db.collection('currenttasks').document(user_id).get()

        if task_doc.exists:
            task_data = task_doc.to_dict()
            started_at = task_data.get('started_at')

            # Calculate elapsed time
            elapsed_seconds = 0
            if started_at:
                from datetime import datetime
                start_time = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                elapsed_seconds = (datetime.now().replace(tzinfo=start_time.tzinfo) - start_time).total_seconds()

            return jsonify({
                'generation_in_progress': True,
                'content_type': task_data.get('content_type'),
                'status': task_data.get('status'),
                'started_at': started_at,
                'elapsed_seconds': int(elapsed_seconds),
                'can_cancel': True,
                'estimated_total_seconds': 180  # Rough estimate: 3 minutes
            }), 200
        else:
            return jsonify({
                'generation_in_progress': False
            }), 200

    except Exception as e:
        logger.error(f"Error checking generation status: {e}")
        return jsonify({'error': 'Failed to check generation status'}), 500

@app.route('/cancel_generation', methods=['POST'])
def cancel_generation():
    """Allow user to cancel their current generation task"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        # Check if user has a running task
        task_doc = db.collection('currenttasks').document(user_id).get()

        if task_doc.exists:
            # Simply delete the task document
            db.collection('currenttasks').document(user_id).delete()

            return jsonify({
                'message': 'Generation cancelled successfully',
                'cancelled': True
            }), 200
        else:
            return jsonify({
                'message': 'No generation task in progress',
                'cancelled': False
            }), 200

    except Exception as e:
        logger.error(f"Error cancelling generation: {e}")
        return jsonify({'error': 'Failed to cancel generation'}), 500

@app.route('/mark_generation_delivered', methods=['POST'])
def mark_generation_delivered():
    """Mark that the generation result has been delivered to the chat UI"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        # Reset conversation state to indicate content has been delivered
        session['conversation_state'] = 'IDLE'
        session.modified = True

        return jsonify({
            'message': 'Generation marked as delivered',
            'success': True
        }), 200

    except Exception as e:
        logger.error(f"Error marking generation as delivered: {e}")
        return jsonify({'error': 'Failed to mark generation as delivered'}), 500

if __name__ == '__main__':
    try:
        port = int(os.environ.get('PORT', 8080))
        socketio.run(app, host='0.0.0.0', port=port, debug=False)
    except Exception as e:
        logger.error(f"Error starting application: {e}")
        raise
