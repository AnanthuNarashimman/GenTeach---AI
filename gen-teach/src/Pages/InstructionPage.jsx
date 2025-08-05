import '../Styles/PageStyles/InstructionPage.css';
import Navbar from '../Components/Navbar.jsx';
import ChatButton from '../Components/ChatButton';
import GalleryButton from '../Components/GalleryButton';
import { useState } from 'react';

function InstructionPage() {
    const [currentStep, setCurrentStep] = useState(0);

    const steps = [
        {
            id: 1,
            title: "Start Your Chat",
            description: "Begin by starting a conversation with GenTeach AI",
            icon: "💬",
            details: "Click on the chat interface to begin your learning journey. The AI will greet you and ask what you'd like to learn about.",
            tip: "Be ready to share your learning interests!"
        },
        {
            id: 2,
            title: "Provide Your Topic",
            description: "Tell the AI what subject you want to learn about",
            icon: "📚",
            details: "Simply type in any topic you're interested in - from 'Machine Learning' to 'Cooking' to 'History of Art'. The AI will understand your request.",
            tip: "Don't worry if your topic is broad - the AI will help you narrow it down!"
        },
        {
            id: 3,
            title: "Choose Subtopic",
            description: "If your topic is broad, select from 5 suggested subtopics",
            icon: "🎯",
            details: "For broad topics, the AI will present 5 focused subtopics. Choose the one that interests you most to get more targeted content.",
            tip: "Pick the subtopic that aligns best with your learning goals"
        },
        {
            id: 4,
            title: "Generate Content",
            description: "Click the 'Generate Content' button to create your materials",
            icon: "⚡",
            details: "Once you've selected your topic/subtopic, hit the generate button. The AI will create a comprehensive script tailored to your chosen subject.",
            tip: "This process takes a few moments - perfect time to grab a coffee!"
        },
        {
            id: 5,
            title: "Review Script & Quiz",
            description: "Get your custom script and 10 interactive quiz questions",
            icon: "📝",
            details: "The AI generates a detailed learning script and 10 quiz questions with answers to test your understanding of the material.",
            tip: "Take notes while reviewing the script for better retention"
        },
        {
            id: 6,
            title: "Choose Media Format",
            description: "Select from 3 options: Audio, Video, or Both",
            icon: "🎬",
            details: "Decide how you want to consume your content. Generate just audio for listening, video for visual learning, or both for the complete experience.",
            tip: "Audio is great for multitasking, video for focused learning!"
        }
    ];

    const mediaOptions = [
        {
            type: "Audio Only",
            icon: "🎧",
            description: "Perfect for learning on-the-go",
            features: ["High-quality TTS narration", "Downloadable MP3", "Background learning friendly"],
            color: "from-blue-500 to-cyan-500"
        },
        {
            type: "Video Only",
            icon: "📹",
            description: "Visual learning experience",
            features: ["Engaging content", "Synchronized with script", "Good quality output"],
            color: "from-purple-500 to-pink-500"
        },
        {
            type: "Both Formats",
            icon: "🎭",
            description: "Complete multimedia package",
            features: ["Audio + Video combo", "Maximum flexibility", "All learning styles covered"],
            color: "from-green-500 to-teal-500"
        }
    ];

    const handleStepClick = (index) => {
        setCurrentStep(index);
    };

    return (
        <>
        <Navbar />
            <div className="instructions-page">
                <div className="instructions-container">
                    {/* Header */}
                    <div className="instructions-header">
                        <h1 className="instructions-title">How to Use GenTeach</h1>
                        <p className="instructions-subtitle">
                            Follow these simple steps to create personalized learning content with AI
                        </p>
                    </div>

                    {/* Step Navigation */}
                    <div className="step-navigation">
                        {steps.map((step, index) => (
                            <div
                                key={step.id}
                                className={`step-nav-item ${currentStep === index ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                                onClick={() => handleStepClick(index)}
                            >
                                <div className="step-nav-icon">{step.icon}</div>
                                <div className="step-nav-number">{step.id}</div>
                                <div className="step-nav-title">{step.title}</div>
                            </div>
                        ))}
                    </div>

                    {/* Step Content */}
                    <div className="step-content">
                        <div className="step-card">
                            <div className="step-header">
                                <div className="step-icon-large">{steps[currentStep].icon}</div>
                                <div className="step-info">
                                    <h2 className="step-title">Step {steps[currentStep].id}: {steps[currentStep].title}</h2>
                                    <p className="step-description">{steps[currentStep].description}</p>
                                </div>
                            </div>

                            <div className="step-details">
                                <div className="step-explanation">
                                    <h3 className="detail-title">What happens in this step?</h3>
                                    <p className="detail-text">{steps[currentStep].details}</p>
                                </div>

                                <div className="step-tip">
                                    <div className="tip-icon">💡</div>
                                    <div className="tip-content">
                                        <h4 className="tip-title">Pro Tip</h4>
                                        <p className="tip-text">{steps[currentStep].tip}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="step-controls">
                            <button
                                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                                disabled={currentStep === 0}
                                className="control-btn prev-btn"
                            >
                                ← Previous
                            </button>

                            <div className="step-indicator">
                                {currentStep + 1} / {steps.length}
                            </div>

                            <button
                                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                                disabled={currentStep === steps.length - 1}
                                className="control-btn next-btn"
                            >
                                Next →
                            </button>
                        </div>
                    </div>

                    {/* Media Options Showcase */}
                    <div className="media-showcase">
                        <h2 className="showcase-title">Choose Your Learning Format</h2>
                        <p className="showcase-subtitle">Select the format that works best for your learning style</p>

                        <div className="media-grid">
                            {mediaOptions.map((option, index) => (
                                <div key={index} className={`media-card bg-gradient-to-br ${option.color}`}>
                                    <div className="media-icon">{option.icon}</div>
                                    <h3 className="media-title">{option.type}</h3>
                                    <p className="media-description">{option.description}</p>
                                    <div className="media-features">
                                        {option.features.map((feature, idx) => (
                                            <div key={idx} className="feature-item">
                                                <span className="feature-check">✓</span>
                                                <span className="feature-text">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Start Section */}
                    <div className="quick-start">
                        <div className="quick-start-content">
                            <h2 className="quick-start-title">Ready to Start Learning?</h2>
                            <p className="quick-start-text">
                                Now that you know how GenTeach works, it's time to create your first piece of content!
                            </p>
                            <button className="start-learning-btn">
                                <span className="btn-icon">🚀</span>
                                Start Learning Now
                            </button>
                        </div>
                        <div className="quick-start-visual">
                            <div className="floating-elements">
                                <div className="float-item">📚</div>
                                <div className="float-item">🎧</div>
                                <div className="float-item">📹</div>
                                <div className="float-item">💡</div>
                                <div className="float-item">🎯</div>
                                <div className="float-item">⚡</div>
                            </div>
                        </div>
                    </div>

                    {/* FAQ Section */}
                    <div className="faq-section">
                        <h2 className="faq-title">Frequently Asked Questions</h2>
                        <div className="faq-grid">
                            <div className="faq-item">
                                <h3 className="faq-question">How long does content generation take?</h3>
                                <p className="faq-answer">Typically 30-60 seconds for scripts, 2-3 minutes for audio, and 3-5 minutes for video content.</p>
                            </div>
                            <div className="faq-item">
                                <h3 className="faq-question">Can I regenerate content if I don't like it?</h3>
                                <p className="faq-answer">Absolutely! You can regenerate any part of your content or try a different subtopic anytime.</p>
                            </div>
                            <div className="faq-item">
                                <h3 className="faq-question">Are there any topic limitations?</h3>
                                <p className="faq-answer">GenTeach works with virtually any educational topic. If a topic is too broad, we'll help you narrow it down.</p>
                            </div>
                            <div className="faq-item">
                                <h3 className="faq-question">Can I download my generated content?</h3>
                                <p className="faq-answer">Yes! All generated content (scripts, audio, video) can be downloaded for offline use.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ChatButton />
            <GalleryButton />
        </>
    )
}

export default InstructionPage
