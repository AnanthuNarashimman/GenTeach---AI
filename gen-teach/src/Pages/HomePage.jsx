import '../Styles/PageStyles/HomePage.css';
import AiLearn from '../assets/Images/AI learn.svg';
import Navbar from '../Components/Navbar.jsx';
import CollectionCard from '../Components/CollectionCard.jsx';
import ChatButton from '../Components/ChatButton.jsx';
import GalleryButton from '../Components/GalleryButton.jsx';
import { Mail } from 'lucide-react';

function HomePage() {
    return (
        <>
            <Navbar />
            <div className="chat-action-card action-card">
                <div className="textarea">
                    <h1>Start Your Learning Journey</h1>
                    <p>Dive into personalized AI-powered education. Simply tell us what you want to learn, and we'll create custom scripts, engaging audio content, interactive videos, and comprehensive quizzes tailored just for you.</p>
                    <button className="start-chat">Start Learning</button>
                </div>
                <div className="imgarea">
                    <img src={AiLearn} alt="" />
                </div>
            </div>

            <h1 className="collection-head">Collections</h1>
            <div className="collection-card-area">
                <CollectionCard />
            </div>

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
            <ChatButton />
            <GalleryButton />
        </>
    )
}

export default HomePage
