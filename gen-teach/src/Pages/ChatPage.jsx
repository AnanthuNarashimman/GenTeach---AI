import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Play, Download, Copy, FileText, Video, Music, Eye, ChevronLeft, X } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import '../Styles/PageStyles/ChatPage.css';

function ChatPage() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [quizStates, setQuizStates] = useState({});
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [isDiscarding, setIsDiscarding] = useState(false); // Track if chat is being discarded
    const messagesEndRef = useRef(null);

    async function sendMessage(messageText = inputText) {
        // Don't send messages if chat is being discarded
        if (isDiscarding) {
            console.log('Chat is being discarded, ignoring message send');
            return;
        }

        try {
            const response = await axios.post('https://video-generator-service-lzshkotpba-uc.a.run.app/chat', {'message': messageText},
                {withCredentials: true}
            );
            console.log(response.data);
            
            // Handle the bot response
            if (response.data) {
                const botResponse = {
                    id: Date.now() + 1,
                    text: response.data.reply,
                    sender: 'bot',
                    timestamp: new Date(),
                    action: response.data.action,
                    sub_topics: response.data.sub_topics || null,
                    topic: response.data.topic || null,
                    script: response.data.script || null,
                    summary: response.data.summary || null,
                    quiz: response.data.quiz || null,
                    audio_url: response.data.audio_url || null,
                    video_url: response.data.video_url || null
                };
                
                console.log('Bot response action:', botResponse.action);
                
                // Stop typing immediately for generation actions
                if (botResponse.action && (
                    botResponse.action.includes('generating') ||
                    botResponse.action.includes('_ready') ||
                    botResponse.action === 'audio_ready' ||
                    botResponse.action === 'video_ready' ||
                    botResponse.action === 'all_ready'
                )) {
                    console.log('Setting isTyping to false for generation action');
                    setIsTyping(false);
                }
                
                // Replace generating message with final response if it exists
                setMessages(prev => {
                    const updatedMessages = [...prev];
                    const generatingIndex = updatedMessages.findIndex(msg =>
                        msg.action === 'audio_generating' ||
                        msg.action === 'video_generating' ||
                        msg.action === 'both_generating'
                    );

                    console.log('Looking for generating message, found at index:', generatingIndex);
                    console.log('Current messages:', updatedMessages.map(m => ({ id: m.id, action: m.action })));

                    if (generatingIndex !== -1) {
                        // Add a minimum delay before replacing the generating message
                        setTimeout(() => {
                            // Check if chat is being discarded before updating
                            if (isDiscarding) {
                                console.log('Chat is being discarded, skipping message replacement');
                                return;
                            }

                            console.log('Replacing generating message with final response after delay');
                            setMessages(currentMessages => {
                                // Double-check if discarding during state update
                                if (isDiscarding) {
                                    console.log('Chat discarded during message update, keeping current state');
                                    return currentMessages;
                                }

                                const newMessages = [...currentMessages];
                                const newGeneratingIndex = newMessages.findIndex(msg =>
                                    msg.action === 'audio_generating' ||
                                    msg.action === 'video_generating' ||
                                    msg.action === 'both_generating'
                                );
                                if (newGeneratingIndex !== -1) {
                                    newMessages[newGeneratingIndex] = botResponse;
                                } else {
                                    // If generating message was removed (e.g., by discard), just add the response
                                    console.log('Generating message no longer exists, adding response as new message');
                                    newMessages.push(botResponse);
                                }
                                return newMessages;
                            });
                        }, 2000); // Minimum 2 seconds display time for generating state
                    } else {
                        // Add new message if no generating message found
                        console.log('No generating message found, adding new message');
                        updatedMessages.push(botResponse);
                    }

                    return updatedMessages;
                });
                
                // Initialize quiz state for this message if it has a quiz
                if (botResponse.quiz && botResponse.quiz.length > 0) {
                    setQuizStates(prev => ({
                        ...prev,
                        [botResponse.id]: {
                            selectedAnswers: {},
                            showAnswers: false
                        }
                    }));
                }
                
                // Only set typing to false for non-generation actions
                if (!botResponse.action || (!botResponse.action.includes('generating') && 
                    botResponse.action !== 'audio_ready' && 
                    botResponse.action !== 'video_ready' && 
                    botResponse.action !== 'all_ready')) {
                    console.log('Setting isTyping to false for non-generation action');
                    setIsTyping(false);
                }
            }
        } catch(err) {
            console.log(err);
            // Show error message to user
            const errorResponse = {
                id: Date.now() + 1,
                text: "Sorry, something went wrong. Please try again.",
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorResponse]);
            setIsTyping(false);
        }
    }

    // Default welcome message
    const defaultMessage = {
        id: 1,
        text: "Hey! What do you want to learn today? 🚀",
        sender: 'bot',
        timestamp: new Date()
    };

    // Load messages from localStorage on component mount
    useEffect(() => {
        const loadMessages = () => {
            try {
                const storedMessages = localStorage.getItem('chatMessages');
                const storedQuizStates = localStorage.getItem('quizStates');
                
                if (storedMessages) {
                    const parsedMessages = JSON.parse(storedMessages);
                    const messagesWithDates = parsedMessages.map(msg => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }));
                    setMessages(messagesWithDates);
                    
                    // Load quiz states if available
                    if (storedQuizStates) {
                        setQuizStates(JSON.parse(storedQuizStates));
                    }
                } else {
                    setMessages([{ ...defaultMessage, timestamp: new Date() }]);
                }
            } catch (error) {
                console.error('Error loading messages from localStorage:', error);
                setMessages([{ ...defaultMessage, timestamp: new Date() }]);
            }
        };

        loadMessages();
    }, []);

    // Save messages to localStorage whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            try {
                const messagesToStore = messages.map(msg => ({
                    ...msg,
                    timestamp: msg.timestamp.toISOString()
                }));
                localStorage.setItem('chatMessages', JSON.stringify(messagesToStore));
            } catch (error) {
                console.error('Error saving messages to localStorage:', error);
            }
        }
    }, [messages]);

    // Save quiz states to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('quizStates', JSON.stringify(quizStates));
        } catch (error) {
            console.error('Error saving quiz states to localStorage:', error);
        }
    }, [quizStates]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle quiz option selection
    const handleQuizOptionClick = (messageId, questionIndex, selectedOption, correctAnswer) => {
        setQuizStates(prev => ({
            ...prev,
            [messageId]: {
                ...prev[messageId],
                selectedAnswers: {
                    ...prev[messageId]?.selectedAnswers,
                    [questionIndex]: selectedOption
                }
            }
        }));
    };

    // Handle show answers toggle
    const handleShowAnswers = (messageId) => {
        setQuizStates(prev => ({
            ...prev,
            [messageId]: {
                ...prev[messageId],
                showAnswers: !prev[messageId]?.showAnswers
            }
        }));
    };

    // Handle subtopic selection
    const handleSubTopicClick = (subtopic) => {
        const newUserMessage = {
            id: Date.now(),
            text: subtopic,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newUserMessage]);
        setIsTyping(true);
        sendMessage(subtopic);
    };

    // Handle confirm generation click
    const handleConfirmGeneration = () => {
        const confirmMessage = "Confirm Generate Content";
        
        const newUserMessage = {
            id: Date.now(),
            text: confirmMessage,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newUserMessage]);
        setIsTyping(true);
        sendMessage(confirmMessage);
    };

    // Handle media generation actions
    const handleMediaGeneration = (action) => {
        const actionMessages = {
            'generate audio': 'Generate Audio',
            'generate video': 'Generate Video',
            'generate both': 'Generate Both'
        };

        const newUserMessage = {
            id: Date.now(),
            text: actionMessages[action],
            sender: 'user',
            timestamp: new Date()
        };

        // Add user message
        setMessages(prev => [...prev, newUserMessage]);
        
        // Add immediate generating message
        const generatingAction = action === 'generate audio' ? 'audio_generating' : 
                               action === 'generate video' ? 'video_generating' : 
                               'both_generating';
        
        const generatingText = action === 'generate audio' ? 
            'Audio is being generated. This takes less than a minute.' :
            action === 'generate video' ? 
            'Video is being generated. This may take less than 15 minutes.' :
            'Audio and video are being generated. This may take some time.';
        
        const generatingMessage = {
            id: Date.now() + 1,
            text: generatingText,
            sender: 'bot',
            timestamp: new Date(),
            action: generatingAction
        };
        
        console.log('Adding generating message with action:', generatingAction);
        setMessages(prev => [...prev, generatingMessage]);
        setIsTyping(false); // Stop typing since we have a generating message
        
        // Add a small delay before sending the request to make the generating state visible
        setTimeout(() => {
            console.log('Sending request for:', action);
            sendMessage(action);
        }, 500); // Increased delay to make generating state more visible
    };

    const handleSendMessage = () => {
        if (inputText.trim() === '') return;

        const newUserMessage = {
            id: Date.now(),
            text: inputText,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        setIsTyping(true);

        sendMessage();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const formatTime = (timestamp) => {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleCloseChat = () => {
        setShowCloseModal(true);
    };

    const handleDiscardChat = async () => {
        try {
            console.log('Starting chat discard process...');

            // Set discarding flag to prevent new messages
            setIsDiscarding(true);

            // First clear backend session to ensure proper state reset
            try {
                await axios.get('https://video-generator-service-lzshkotpba-uc.a.run.app/sessionclear', {
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 5000 // 5 second timeout
                });
                console.log('Backend session cleared successfully');
            } catch (backendError) {
                console.log('Backend session clear failed (continuing anyway):', backendError.message);
                // Continue with frontend cleanup even if backend fails
            }

            // Clear all frontend state
            localStorage.removeItem('chatMessages');
            localStorage.removeItem('quizStates');

            // Reset all component state to initial values
            setMessages([{ ...defaultMessage, timestamp: new Date() }]);
            setQuizStates({});
            setIsTyping(false); // Reset typing state
            setInputText(''); // Clear input text
            setShowCloseModal(false);
            setIsDiscarding(false); // Reset discarding flag

            console.log('Frontend state cleared successfully');

            // Navigate to home after cleanup is complete
            navigate('/home');
        } catch (error) {
            console.error('Error during chat discard:', error);

            // Even if there's an error, ensure frontend state is cleared
            localStorage.removeItem('chatMessages');
            localStorage.removeItem('quizStates');
            setMessages([{ ...defaultMessage, timestamp: new Date() }]);
            setQuizStates({});
            setIsTyping(false);
            setInputText('');
            setShowCloseModal(false);
            setIsDiscarding(false); // Reset discarding flag

            // Still navigate to prevent user from being stuck
            navigate('/home');
        }
    };

    const handleCloseWithoutDiscarding = () => {
        setShowCloseModal(false);
        navigate(-1);
    };

    const handleCancelClose = () => {
        setShowCloseModal(false);
    };

    // Render quiz component with interactive features
    const renderQuiz = (quiz, messageId) => {
        if (!quiz || quiz.length === 0) return null;

        const quizState = quizStates[messageId] || { selectedAnswers: {}, showAnswers: false };

        return (
            <div className="quiz-container">
                <div className="quiz-header">
                    <h4>📝 Quick Quiz</h4>
                </div>
                <div className="quiz-questions">
                    {quiz.map((question, questionIndex) => (
                        <div key={questionIndex} className="quiz-question">
                            <h5 className="question-text">
                                {questionIndex + 1}. {question.question}
                            </h5>
                            <div className="quiz-options">
                                {Object.entries(question.options).map(([key, value]) => {
                                    const isSelected = quizState.selectedAnswers[questionIndex] === key;
                                    const isCorrect = key === question.correct_answer;
                                    const showResult = quizState.showAnswers || isSelected;
                                    
                                    let optionClass = 'quiz-option';
                                    if (showResult && isSelected) {
                                        optionClass += isCorrect ? ' selected-correct' : ' selected-incorrect';
                                    } else if (quizState.showAnswers && isCorrect) {
                                        optionClass += ' correct-answer-revealed';
                                    } else if (isSelected) {
                                        optionClass += ' selected';
                                    }

                                    return (
                                        <div 
                                            key={key} 
                                            className={optionClass}
                                            onClick={() => !quizState.showAnswers && handleQuizOptionClick(messageId, questionIndex, key, question.correct_answer)}
                                            style={{ cursor: quizState.showAnswers ? 'default' : 'pointer' }}
                                        >
                                            <span className="option-key">{key}.</span>
                                            <span className="option-text">{value}</span>
                                            {showResult && isSelected && (
                                                <span className="result-indicator">
                                                    {isCorrect ? '✓' : '✗'}
                                                </span>
                                            )}
                                            {quizState.showAnswers && isCorrect && !isSelected && (
                                                <span className="correct-indicator">✓</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="quiz-actions">
                    <button 
                        className="show-answers-button"
                        onClick={() => handleShowAnswers(messageId)}
                    >
                        <Eye size={16} />
                        {quizState.showAnswers ? 'Hide Answers' : 'Show Answers'}
                    </button>
                </div>
            </div>
        );
    };

    // Render message content based on action type
    const renderMessageContent = (message) => {
        if (message.sender === 'user') {
            return <div className="message-bubble">{message.text}</div>;
        }

        // Bot message rendering based on action
        switch (message.action) {
            case 'suggest_subtopics':
                return (
                    <div className="message-bubble">
                        <div className="bot-message-text">{message.text}</div>
                        {message.sub_topics && message.sub_topics.length > 0 && (
                            <div className="subtopics-container">
                                {message.sub_topics.map((subtopic, index) => (
                                    <button
                                        key={index}
                                        className="subtopic-button"
                                        onClick={() => handleSubTopicClick(subtopic)}
                                    >
                                        {subtopic}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'confirm_generation':
                return (
                    <div className="message-bubble">
                        <div className="bot-message-text">{message.text}</div>
                        <div className="confirmation-container">
                            <button
                                className="confirm-button"
                                onClick={handleConfirmGeneration}
                            >
                                Generate Content
                            </button>
                        </div>
                    </div>
                );

            case 'show_script_and_quiz':
                return (
                    <div className="message-bubble">
                        <div className="bot-message-text">{message.text}</div>
                        
                        {/* Summary Section */}
                        {message.summary && (
                            <div className="summary-container">
                                <div className="summary-header">
                                    <h4>📋 Summary</h4>
                                </div>
                                <div className="summary-content">
                                    <p>{message.summary}</p>
                                </div>
                            </div>
                        )}

                        {/* Script Section */}
                        {message.script && (
                            <div className="script-container">
                                <div className="script-header">
                                    <h4>📝 Video Script: {message.topic}</h4>
                                </div>
                                <div className="script-content">
                                    <div className="script-text">
                                        {message.script.split('\n').map((line, index) => {
                                            if (line.startsWith('## ')) {
                                                return (
                                                    <h3 key={index} className="script-section-header">
                                                        {line.replace('## ', '')}
                                                    </h3>
                                                );
                                            } else if (line.startsWith('# ')) {
                                                return (
                                                    <h2 key={index} className="script-main-header">
                                                        {line.replace('# ', '')}
                                                    </h2>
                                                );
                                            } else if (line.trim() === '') {
                                                return <br key={index} />;
                                            } else {
                                                return (
                                                    <p key={index} className="script-paragraph">
                                                        {line}
                                                    </p>
                                                );
                                            }
                                        })}
                                    </div>
                                </div>
                                <div className="script-actions">
                                    <button 
                                        className="script-action-button copy-button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(message.script);
                                            const btn = document.querySelector('.copy-button');
                                            const originalText = btn.innerHTML;
                                            btn.innerHTML = '<span>✓ Copied!</span>';
                                            setTimeout(() => btn.innerHTML = originalText, 2000);
                                        }}
                                    >
                                        <Copy size={16} />
                                        Copy Script
                                    </button>
                                    <button 
                                        className="script-action-button download-button"
                                        onClick={() => {
                                            const element = document.createElement('a');
                                            const file = new Blob([message.script], {type: 'text/plain'});
                                            element.href = URL.createObjectURL(file);
                                            element.download = `${message.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_script.txt`;
                                            document.body.appendChild(element);
                                            element.click();
                                            document.body.removeChild(element);
                                        }}
                                    >
                                        <Download size={16} />
                                        Download
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Quiz Section */}
                        {renderQuiz(message.quiz, message.id)}

                        {/* Media Generation Options */}
                        <div className="media-generation-container">
                            <div className="media-generation-header">
                                <h4>🎬 Next Steps</h4>
                                <p>What would you like to generate?</p>
                            </div>
                            <div className="media-generation-buttons">
                                <button
                                    className="media-generation-button audio-button"
                                    onClick={() => handleMediaGeneration('generate audio')}
                                >
                                    <Music size={18} />
                                    Generate Audio
                                </button>
                                <button
                                    className="media-generation-button video-button"
                                    onClick={() => handleMediaGeneration('generate video')}
                                >
                                    <Video size={18} />
                                    Generate Video
                                </button>
                                <button
                                    className="media-generation-button both-button"
                                    onClick={() => handleMediaGeneration('generate both')}
                                >
                                    <FileText size={18} />
                                    Generate Both
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'audio_ready':
            case 'video_ready':
            case 'all_ready':
                return (
                    <div className="message-bubble">
                        <div className="bot-message-text">{message.text}</div>
                        
                        {/* Media Content */}
                        <div className="media-content-container">
                            {/* Audio Generation Loading */}
                            {message.action === 'audio_generating' && (
                                <div className="audio-player-container">
                                    <div className="media-header">
                                        <Music size={16} />
                                        <span>Generated Audio (Processing...)</span>
                                    </div>
                                    <div className="video-processing">
                                        <div className="processing-indicator">
                                            <div className="loading-block">
                                                <span>Audio is being generated</span>
                                                <p>This takes less than a minute</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Video Generation Loading */}
                            {message.action === 'video_generating' && (
                                <div className="video-player-container">
                                    <div className="media-header">
                                        <Video size={16} />
                                        <span>Generated Video (Processing...)</span>
                                    </div>
                                    <div className="video-processing">
                                        <div className="processing-indicator">
                                            <div className="loading-block">
                                                <span>Video is being generated</span>
                                                <p>This may take less than 15 minutes</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Both Generation Loading */}
                            {message.action === 'both_generating' && (
                                <>
                                    <div className="audio-player-container">
                                        <div className="media-header">
                                            <Music size={16} />
                                            <span>Generated Audio (Processing...)</span>
                                        </div>
                                        <div className="video-processing">
                                            <div className="processing-indicator">
                                                <div className="loading-block">
                                                    <span>Audio is being generated</span>
                                                    <p>This takes less than a minute</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="video-player-container">
                                        <div className="media-header">
                                            <Video size={16} />
                                            <span>Generated Video (Processing...)</span>
                                        </div>
                                        <div className="video-processing">
                                            <div className="processing-indicator">
                                                <div className="loading-block">
                                                    <span>Video is being generated</span>
                                                    <p>This may take less than 15 minutes</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {message.audio_url && (
                                <div className="audio-player-container">
                                    <div className="media-header">
                                        <Music size={16} />
                                        <span>Generated Audio</span>
                                    </div>
                                    <audio controls className="audio-player">
                                        <source src={message.audio_url} type="audio/mpeg" />
                                        Your browser does not support the audio element.
                                    </audio>
                                    <button 
                                        className="download-media-button"
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = `http://localhost:5000${message.audio_url}`;
                                            link.download = `${message.topic}_audio.mp3`;
                                            link.click();
                                        }}
                                    >
                                        <Download size={14} />
                                        Download Audio
                                    </button>
                                </div>
                            )}

                            {message.video_url && (
                                <div className="video-player-container">
                                    <div className="media-header">
                                        <Video size={16} />
                                        <span>Generated Video</span>
                                    </div>
                                    <video controls className="video-player">
                                        <source src={message.video_url} type="video/mp4" />
                                        Your browser does not support the video element.
                                    </video>
                                    <button 
                                        className="download-media-button"
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = `http://localhost:5000${message.video_url}`;
                                            link.download = `${message.topic}_video.mp4`;
                                            link.click();
                                        }}
                                    >
                                        <Download size={14} />
                                        Download Video
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Show additional options if not both generated */}
                        {(message.action === 'audio_ready' || message.action === 'video_ready') && (
                            <div className="additional-actions">
                                <p>You can also:</p>
                                <div className="additional-buttons">
                                    {message.action === 'audio_ready' && (
                                        <button
                                            className="additional-action-button"
                                            onClick={() => handleMediaGeneration('generate video')}
                                        >
                                            <Video size={16} />
                                            Generate Video
                                        </button>
                                    )}
                                    {message.action === 'video_ready' && (
                                        <button
                                            className="additional-action-button"
                                            onClick={() => handleMediaGeneration('generate audio')}
                                        >
                                            <Music size={16} />
                                            Generate Audio
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );

            default:
                return <div className="message-bubble">{message.text}</div>;
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <div className="chat-header-content">
                    <div className="genteach-logo">
                        <span className="logo-text">GenTeach</span>
                    </div>
                    <div className="chat-status">
                        <div className="status-indicator"></div>
                        <span>AI Learning Assistant</span>
                    </div>
                    <button 
                        className="close-chat-button" 
                        onClick={handleCloseChat}
                        title="Close Chat"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            <div className="chat-messages">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
                    >
                        <div className="message-avatar">
                            {message.sender === 'user' ? (
                                <User size={20} />
                            ) : (
                                <Bot size={20} />
                            )}
                        </div>
                        <div className="message-content">
                            {renderMessageContent(message)}
                            <div className="message-time">
                                {formatTime(message.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}

                {(() => {
                    const hasGeneratingAction = messages.some(msg => 
                        msg.action === 'audio_generating' || 
                        msg.action === 'video_generating' || 
                        msg.action === 'both_generating' ||
                        msg.action === 'audio_ready' ||
                        msg.action === 'video_ready' ||
                        msg.action === 'all_ready'
                    );
                    return isTyping && !hasGeneratingAction;
                })() && (
                    <div className="message bot-message">
                        <div className="message-avatar">
                            <Bot size={20} />
                        </div>
                        <div className="message-content">
                            <div className="message-bubble typing-indicator">
                                <div className="typing-dots">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                <div className="chat-input-wrapper">
                    <textarea
                        className="chat-input"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask me anything about learning..."
                        rows="2"
                    />
                    <button
                        className="send-button"
                        onClick={handleSendMessage}
                        disabled={inputText.trim() === ''}
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>

            {/* Close Chat Modal */}
            {showCloseModal && (
                <div className="modal-overlay">
                    <div className="close-modal">
                        <div className="close-modal-header">
                            <h3>Close Chat Session</h3>
                        </div>
                        <div className="close-modal-content">
                            <p>What would you like to do with your current chat?</p>
                        </div>
                        <div className="close-modal-actions">
                            <button 
                                className="cancel-button"
                                onClick={handleCancelClose}
                            >
                                Cancel
                            </button>
                            <button 
                                className="close-without-discarding-button cancel-button"
                                onClick={handleCloseWithoutDiscarding}
                            >
                                Close without discarding
                            </button>
                            <button 
                                className="discard-button"
                                onClick={handleDiscardChat}
                            >
                                Discard Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatPage