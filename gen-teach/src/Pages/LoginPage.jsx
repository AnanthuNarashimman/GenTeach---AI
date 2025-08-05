import '../Styles/PageStyles/LoginPage.css';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, CircleX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

import Request from '../assets/Images/Request.svg';
import Login from '../assets/Images/Login.svg';

function LoginPage() {

    const navigate = useNavigate();
    const { login, request } = useAuth();

    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState('');
    const [showAlert, setShowAlert] = useState(false);

    const [loginData, setLoginData] = useState({
        email: '',
        password: ''
    });

    const [registerData, setRegisterData] = useState({
        fullName: '',
        email: '',
        description: ''
    });

    const handleLoginChange = (e) => {
        const { name, value } = e.target;
        setLoginData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleRegisterChange = (e) => {
        const { name, value } = e.target;
        setRegisterData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const displayAlert = (message, type) => {
        setAlertMessage(message);
        setAlertType(type);
        setShowAlert(true);
        
        
        setTimeout(() => {
            setShowAlert(false);
        }, 3000);
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await login(loginData);
            
            if (result.success) {
                displayAlert(result.message, 'success');
            } else {
                displayAlert(result.message, 'error');
            }
        } catch (err) {
            console.log(err);
            displayAlert('Login failed. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await request(registerData);

            if(result.success) {
                displayAlert(result.message, 'success');
                // Clear form data after successful request
                setRegisterData({
                    fullName: '',
                    email: '',
                    description: ''
                });
            } else {
                displayAlert(result.message, 'error');
            }
        } catch(err) {
            console.log(err);
            displayAlert('Request failed. Please try again.', 'error');
        } finally {
            setIsLoading(false)
        }
    };

    const switchToRegister = () => {
        setIsLogin(false);
        setShowPassword(false);
        setShowConfirmPassword(false);
    };

    const switchToLogin = () => {
        setIsLogin(true);
        setShowPassword(false);
        setShowConfirmPassword(false);
    };

    return (
        <>
            <p className="log-logo">GenTeach</p>

            {/* Alert Messages */}
            {showAlert && (
                <div className={`alertBox ${alertType === 'success' ? 'successMessage' : 'errorMessage'} active`}>
                    <p>{alertMessage}</p>
                    {alertType === 'success' ? (
                        <CircleCheck className='alertIcons' size={17} />
                    ) : (
                        <CircleX className='alertIcons' size={17} />
                    )}
                </div>
            )}

            <div className="auth-page">
                {/* Navigation */}

                <div className="auth-container">
                    <div className="auth-wrapper">
                        {/* Image Section */}
                        <div className={`image-section ${isLogin ? 'login-mode' : 'register-mode'}`}>
                            <div className="image">
                                {isLogin ? (
                                    <>
                                        <img src={Login} alt="" />
                                    </>
                                ) : (
                                    <>
                                        <img src={Request} alt="" />
                                    </>
                                )}
                            </div>

                            {/* Floating Elements */}
                            <div className="floating-elements">
                                <div className="floating-element element-1"></div>
                                <div className="floating-element element-2"></div>
                                <div className="floating-element element-3"></div>
                            </div>
                        </div>

                        {/* Form Section */}
                        <div className="form-section">
                            <div className="form-container">
                                {/* Toggle Buttons */}
                                <div className="toggle-buttons">
                                    <button
                                        className={`toggle-btn ${isLogin ? 'active' : ''}`}
                                        onClick={switchToLogin}
                                    >
                                        <LogIn className="toggle-icon" />
                                        Login
                                    </button>
                                    <button
                                        className={`toggle-btn ${!isLogin ? 'active' : ''}`}
                                        onClick={switchToRegister}
                                    >
                                        <UserPlus className="toggle-icon" />
                                        Register
                                    </button>
                                    <div className={`toggle-slider ${isLogin ? 'login' : 'register'}`}></div>
                                </div>

                                {/* Forms Container */}
                                <div className="forms-container">
                                    {/* Login Form */}
                                    <div className={`form-wrapper ${isLogin ? 'active' : 'inactive'}`}>
                                        <div className="form-header">
                                            <h2>Welcome Back</h2>
                                            <p>Sign in to your GenTeach account</p>
                                        </div>

                                        <form onSubmit={handleLoginSubmit} className="auth-form">
                                            <div className="input-group">
                                                <label htmlFor="login-email">Email Address</label>
                                                <div className="input-wrapper">
                                                    <Mail className="input-icon" />
                                                    <input
                                                        type="email"
                                                        id="login-email"
                                                        name="email"
                                                        value={loginData.email}
                                                        onChange={handleLoginChange}
                                                        placeholder="Enter your email"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="input-group">
                                                <label htmlFor="login-password">Password</label>
                                                <div className="input-wrapper">
                                                    <Lock className="input-icon" />
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        id="login-password"
                                                        name="password"
                                                        value={loginData.password}
                                                        onChange={handleLoginChange}
                                                        placeholder="Enter your password"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        className="password-toggle"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                    >
                                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="form-options">
                                                <label className="checkbox-wrapper">
                                                    <input type="checkbox" />
                                                    <span className="checkmark"></span>
                                                    Remember me
                                                </label>
                                                <a href="#" className="forgot-password">Forgot Password?</a>
                                            </div>

                                            <button type="submit" className="submit-btn" disabled={isLoading}>
                                                {isLoading ? (
                                                    <>
                                                        <div className="spinner"></div>
                                                        Signing In...
                                                    </>
                                                ) : (
                                                    <>
                                                        Sign In
                                                        <ArrowRight className="btn-icon" />
                                                    </>
                                                )}
                                            </button>
                                        </form>

                                        <div className="form-footer">
                                            <p>
                                                Don't have an account?{' '}
                                                <button onClick={switchToRegister} className="switch-btn">
                                                    Sign up here
                                                </button>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Register Form */}
                                    <div className={`form-wrapper ${!isLogin ? 'active' : 'inactive'}`}>
                                        <div className="form-header">
                                            <h2>Request Account</h2>
                                            <p>Join GenTeach and start your learning journey</p>
                                        </div>

                                        <form onSubmit={handleRegisterSubmit} className="auth-form">
                                            <div className="input-group">
                                                <label htmlFor="register-name">Full Name</label>
                                                <div className="input-wrapper">
                                                    <User className="input-icon" />
                                                    <input
                                                        type="text"
                                                        id="register-name"
                                                        name="fullName"
                                                        value={registerData.fullName}
                                                        onChange={handleRegisterChange}
                                                        placeholder="Enter your full name"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="input-group">
                                                <label htmlFor="register-email">Email Address</label>
                                                <div className="input-wrapper">
                                                    <Mail className="input-icon" />
                                                    <input
                                                        type="email"
                                                        id="register-email"
                                                        name="email"
                                                        value={registerData.email}
                                                        onChange={handleRegisterChange}
                                                        placeholder="Enter your email"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="input-group">
                                                <label htmlFor="register-name">What brings you here ?</label>
                                                <div className="input-wrapper">
                                                    <textarea
                                                        type="text"
                                                        id="register-description"
                                                        name="description"
                                                        value={registerData.description}
                                                        onChange={handleRegisterChange}
                                                        placeholder="What made you interested in AI-generated educational videos? What do you hope to create?"
                                                        required
                                                        rows={3}
                                                        draggable="false"
                                                    />
                                                </div>
                                            </div>

                                            <button type="submit" className="submit-btn" disabled={isLoading}>
                                                {isLoading ? (
                                                    <>
                                                        <div className="spinner"></div>
                                                        Request Successful
                                                    </>
                                                ) : (
                                                    <>
                                                        Request Account
                                                        <ArrowRight className="btn-icon" />
                                                    </>
                                                )}
                                            </button>
                                        </form>

                                        <div className="form-footer">
                                            <p>
                                                Already have an account?{' '}
                                                <button onClick={switchToLogin} className="switch-btn">
                                                    Sign in here
                                                </button>
                                            </p>
                                        </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        </>
    )
}

export default LoginPage