import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Brain, FileText, HelpCircle, Zap, Target, Video, BookOpen, Wrench, Mail } from 'lucide-react';
import '../Styles/PageStyles/LandingPage.css';

// Comment to retrigger deployment
const LandingPage = () => {
    const [isHovered, setIsHovered] = useState(null);
    const navigate = useNavigate();

    return (
        <div className="landing-container">
            <div className="floating-card mob-card-brand">
                        <span className="brand-text">GenTeach</span>
                    </div>
            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <div className="hero-badge">
                        <Wrench size={16} />
                        <span>Under Development - Still Improving</span>
                    </div>

                    <h1 className="hero-title">
                        Transform Any Topic Into
                        <span className="gradient-text"> Complete Learning Experience</span>
                    </h1>

                    <p className="hero-description">
                        Our AI doesn't just generate content—it asks the right questions to understand exactly what you want to learn,
                        then creates personalized videos, summaries, and quizzes tailored to your needs.
                    </p>

                    <div className="hero-buttons">
                        <button className="btn-primary" onClick={() => {navigate('/auth')}}>
                            <Play size={20} />
                            Give a Try
                        </button>
                    </div>

                    <div className="hero-stats">
                        <div className="stat">
                            <span className="stat-number">Smart</span>
                            <span className="stat-label">Data Driven</span>
                        </div>
                        <div className="stat">
                            <span className="stat-number">Tech</span>
                            <span className="stat-label">AI Powered</span>
                        </div>
                        <div className="stat">
                            <span className="stat-number">Easy</span>
                            <span className="stat-label">User Friendly</span>
                        </div>
                    </div>

                    <hr className="mob-hr" />
                </div>

                <div className="hero-visual">
                    <div className="floating-card card-purple">
                        <Brain size={24} />
                        <span>AI analyzes your topic</span>
                    </div>
                    <div className="floating-card card-yellow">
                        <HelpCircle size={24} />
                        <span>Asks clarifying questions</span>
                    </div>
                    <div className="floating-card card-blue">
                        <Video size={24} />
                        <span>Generates personalized content</span>
                    </div>
                    <div className="floating-card card-green">
                        <FileText size={24} />
                        <span>Creates quiz & summary</span>
                    </div>
                    <div className="floating-card card-brand">
                        <span className="brand-text">GenTeach</span>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="how-it-works">
                <div className="container">
                    <h2 className="section-title">How It Works</h2>
                    <p className="section-subtitle">
                        Unlike traditional content generators, our AI engages in intelligent dialogue to create exactly what you need
                    </p>

                    <div className="process-steps">
                        <div className="step">
                            <div className="step-icon purple">
                                <Target size={32} />
                            </div>
                            <h3>Smart Topic Analysis</h3>
                            <p>Enter any topic and our AI immediately identifies if it's too broad, suggesting focused sub-topics for maximum learning impact.</p>
                        </div>

                        <div className="step">
                            <div className="step-icon yellow">
                                <HelpCircle size={32} />
                            </div>
                            <h3>Interactive Clarification</h3>
                            <p>Through 2-3 intelligent questions, we narrow down exactly what you want to learn, ensuring personalized content every time.</p>
                        </div>

                        <div className="step">
                            <div className="step-icon blue">
                                <Video size={32} />
                            </div>
                            <h3>Dynamic Content Creation</h3>
                            <p>Generate comprehensive video lectures with AI narration, visual slides, detailed summaries, and interactive quizzes.</p>
                        </div>

                        <div className="step">
                            <div className="step-icon green">
                                <BookOpen size={32} />
                            </div>
                            <h3>Complete Learning Package</h3>
                            <p>Receive your personalized video, summary slide for quick review, and quiz to test your understanding—all in minutes.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <div className="container">
                    <h2 className="section-title">Why Choose Our Platform?</h2>

                    <div className="features-grid">
                        <div
                            className="feature-card"
                            onMouseEnter={() => setIsHovered('interactive')}
                            onMouseLeave={() => setIsHovered(null)}
                        >
                            <div className="feature-icon purple">
                                <Brain size={40} />
                            </div>
                            <h3>Interactive AI Dialogue</h3>
                            <p>Our AI doesn't guess—it asks. Get content that matches your exact learning objectives through intelligent clarification.</p>
                            <div className={`feature-glow ${isHovered === 'interactive' ? 'active' : ''}`}></div>
                        </div>

                        <div
                            className="feature-card"
                            onMouseEnter={() => setIsHovered('comprehensive')}
                            onMouseLeave={() => setIsHovered(null)}
                        >
                            <div className="feature-icon blue">
                                <Video size={40} />
                            </div>
                            <h3>Comprehensive Content</h3>
                            <p>Video lectures, visual slides, summaries, and quizzes—everything you need for complete understanding in one package.</p>
                            <div className={`feature-glow ${isHovered === 'comprehensive' ? 'active' : ''}`}></div>
                        </div>

                        <div
                            className="feature-card"
                            onMouseEnter={() => setIsHovered('free')}
                            onMouseLeave={() => setIsHovered(null)}
                        >
                            <div className="feature-icon green">
                                <Zap size={40} />
                            </div>
                            <h3>Free Tier Access</h3>
                            <p>Powered by free-tier APIs including Google Gemini Pro, making advanced AI education accessible to everyone.</p>
                            <div className={`feature-glow ${isHovered === 'free' ? 'active' : ''}`}></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Technology Stack */}
            <section className="tech-section">
                <div className="container">
                    <h2 className="section-title">Powered by Cutting-Edge AI</h2>
                    <div className="tech-grid">
                        <div className="tech-item">
                            <span className="tech-category">Language Models</span>
                            <span className="tech-name">Google Gemini Pro</span>
                        </div>
                        <div className="tech-item">
                            <span className="tech-category">Text-to-Speech</span>
                            <span className="tech-name">Google Cloud TTS</span>
                        </div>
                        <div className="tech-item">
                            <span className="tech-category">Image Generation</span>
                            <span className="tech-name">Stable Diffusion</span>
                        </div>
                        <div className="tech-item">
                            <span className="tech-category">Video Processing</span>
                            <span className="tech-name">MoviePy</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Transform Your Learning?</h2>
                        <p>We're working hard to bring you the future of AI-powered education</p>
                        <button className="btn-primary-large" disabled>
                            <Wrench size={24} />
                            Under Development
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-section">
                            <h4>GenTeach</h4>
                            <p>Transforming topics into comprehensive learning experiences through intelligent AI dialogue.</p>
                        </div>
                        <div className="footer-section">
                            <h5>Features</h5>
                            <ul>
                                <li>Interactive Clarification</li>
                                <li>Video Generation</li>
                                <li>Smart Summaries</li>
                                <li>Interactive Quizzes</li>
                            </ul>
                        </div>
                        <div className="footer-section">
                            <h5>Technology</h5>
                            <ul>
                                <li>Google Gemini Pro</li>
                                <li>Text-to-Speech</li>
                                <li>Image Generation</li>
                                <li>Python Backend</li>
                            </ul>
                        </div>
                        <div className="footer-section">
                            <h5>Contact us</h5>
                            <ul>
                                <li><Mail size={14} /> ananthun420@gmail.com</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;