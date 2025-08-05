import '../Styles/PageStyles/ContactPage.css';
import { Star, Send, MessageCircle, Mail, Phone, MapPin } from 'lucide-react';
import { useState } from 'react';
import Navbar from '../Components/Navbar.jsx';
import ChatButton from '../Components/ChatButton';
import GalleryButton from '../Components/GalleryButton';


function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        messageType: 'suggestion',
        message: '',
        rating: 0
    });

    const [hoveredStar, setHoveredStar] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleStarClick = (rating) => {
        setFormData(prev => ({
            ...prev,
            rating
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Create mailto link with form data
        const subject = `GenTeach ${formData.messageType.charAt(0).toUpperCase() + formData.messageType.slice(1)} - ${formData.name}`;
        const body = `
Name: ${formData.name}
Email: ${formData.email}
Type: ${formData.messageType.charAt(0).toUpperCase() + formData.messageType.slice(1)}
Rating: ${formData.rating}/5 stars

Message:
${formData.message}
    `;

        const mailtoLink = `mailto:flashprojects@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        // Open email client
        window.location.href = mailtoLink;

        // Simulate form submission
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmitted(true);
            // Reset form after 3 seconds
            setTimeout(() => {
                setSubmitted(false);
                setFormData({
                    name: '',
                    email: '',
                    messageType: 'suggestion',
                    message: '',
                    rating: 0
                });
            }, 3000);
        }, 1000);
    };

    return (
        <>
            <Navbar />
            <div className="contact-page">
                {/* Navigation */}

                <div className="container">
                    {/* Page Header */}
                    <div className="page-header">
                        <h1 className="page-title">Get in Touch</h1>
                        <p className="page-subtitle">
                            We'd love to hear your feedback! Share your suggestions, recommendations,
                            or let us know about any issues you've encountered.
                        </p>
                    </div>

                    {/* Contact Grid */}
                    <div className="contact-grid">
                        {/* Contact Form */}
                        <div className="contact-form">
                            <div className="form-header">
                                <MessageCircle className="form-icon" />
                                <h2>Send us a Message</h2>
                            </div>

                            {submitted ? (
                                <div className="success-message">
                                    <div className="success-icon">✓</div>
                                    <h3>Thank you for your feedback!</h3>
                                    <p>Your message has been sent successfully. We'll get back to you soon.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit}>
                                    <div className="form-group">
                                        <label htmlFor="name">Your Name</label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Enter your full name"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="email">Email Address</label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="your.email@example.com"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="messageType">Message Type</label>
                                        <select
                                            id="messageType"
                                            name="messageType"
                                            value={formData.messageType}
                                            onChange={handleInputChange}
                                        >
                                            <option value="suggestion">Suggestion</option>
                                            <option value="recommendation">Recommendation</option>
                                            <option value="complaint">Complaint</option>
                                            <option value="general">General Inquiry</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Rate Your Experience</label>
                                        <div className="star-rating">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={`star ${star <= (hoveredStar || formData.rating) ? 'filled' : ''}`}
                                                    onClick={() => handleStarClick(star)}
                                                    onMouseEnter={() => setHoveredStar(star)}
                                                    onMouseLeave={() => setHoveredStar(0)}
                                                />
                                            ))}
                                            <span className="rating-text">
                                                {formData.rating ? `${formData.rating}/5 stars` : 'Click to rate'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="message">Your Message</label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            value={formData.message}
                                            onChange={handleInputChange}
                                            required
                                            rows="5"
                                            placeholder="Tell us what's on your mind..."
                                        />
                                    </div>

                                    <button type="submit" className="submit-btn" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <div className="spinner"></div>
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="btn-icon" />
                                                Send Message
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* Contact Info */}
                        <div className="contact-info">
                            <div className="info-header">
                                <h2>Contact Information</h2>
                                <p>Feel free to reach out to us directly</p>
                            </div>

                            <div className="info-items">
                                <div className="info-item">
                                    <Mail className="info-icon" />
                                    <div>
                                        <h3>Email</h3>
                                        <p>flashprojects@gmail.com</p>
                                    </div>
                                </div>

                                <div className="info-item">
                                    <MessageCircle className="info-icon" />
                                    <div>
                                        <h3>Support</h3>
                                        <p>Quick Support</p>
                                    </div>
                                </div>

                                <div className="info-item">
                                    <MapPin className="info-icon" />
                                    <div>
                                        <h3>Response Time</h3>
                                        <p>Usually within 24 hours</p>
                                    </div>
                                </div>
                            </div>

                            <div className="feedback-stats">
                                <h3>Feedback Categories</h3>
                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <div className="stat-number">85%</div>
                                        <div className="stat-label">Suggestions</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-number">10%</div>
                                        <div className="stat-label">Bug Reports</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-number">5%</div>
                                        <div className="stat-label">Complaints</div>
                                    </div>
                                </div>
                            </div>

                            <div className="cta-section">
                                <h3>Quick Tips</h3>
                                <ul>
                                    <li>Be specific about the issue or suggestion</li>
                                    <li>Include steps to reproduce any problems</li>
                                    <li>Rate your overall experience with GenTeach</li>
                                    <li>We read every message personally</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <GalleryButton />
            <ChatButton />
        </>
    )
}

export default ContactPage
