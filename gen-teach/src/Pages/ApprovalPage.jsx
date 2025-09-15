import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield, 
  Eye, 
  EyeOff,
  AlertTriangle,
  Mail,
  User,
  Lock,
  ArrowRight
} from 'lucide-react';
import '../Styles/PageStyles/ApprovalPage.css';


// Comment to trigger deployment
const ApprovalPage = () => {
  const { approvalToken } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvalData, setApprovalData] = useState(null);
  const [step, setStep] = useState('loading'); // loading, valid, expired, completed, confirm
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (approvalToken) {
      console.log(approvalToken)
      validateApprovalToken();
    } else {
      console.log("No approval token")
    }
  }, [approvalToken]);

  const validateApprovalToken = async () => {
  try {
    setLoading(true);
    const response = await axios.get(`https://video-generator-service-lzshkotpba-uc.a.run.app/approve/${approvalToken}`, {
      withCredentials: true
    });
    
    console.log(response.data)
    setApprovalData(response.data.approval_data);
    setStep('valid');
    
  } catch (error) {
    console.log(error)
    console.error('Error validating approval token:', error);
    
    if (error.response) {
      const errorData = error.response.data;
      
      if (error.response.status === 410) {
        setStep('expired');
      } else if (error.response.status === 409) {
        setStep('completed');
      } else {
        setError(errorData.error || 'Invalid approval token');
        setStep('error');
      }
    } else if (error.request) {
      setError('Network error - please check your connection');
      setStep('error');
    } else {
      setError('Failed to validate approval token');
      setStep('error');
    }
  } finally {
    setLoading(false);
  }
};


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setSubmitError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setSubmitError('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 6) {
      setSubmitError('Password must be at least 6 characters long');
      return;
    }
    
    try {
      setSubmitting(true);
      const response = await fetch(`https://video-generator-service-lzshkotpba-uc.a.run.app/approve/${approvalToken}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: formData.password,
          confirmPassword: formData.confirmPassword
        })
      });
      
      if (response.ok) {
        setStep('success');
      } else {
        const errorData = await response.json();
        setSubmitError(errorData.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Error creating account:', error);
      setSubmitError('Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="approval-page">
        <div className="loading-container">
          <div className="loading-spinner">
            <Shield size={48} className="spinner-icon" />
            <div className="spinner-ring"></div>
          </div>
          <h3>Validating Approval Token</h3>
          <p>Please wait while we verify your approval...</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="approval-page">
        <div className="error-container">
          <div className="error-icon">
            <XCircle size={80} color="#ef4444" />
            <div className="error-glow"></div>
          </div>
          <h2>Invalid Approval Token</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="approval-page">
        <div className="expired-container">
          <div className="expired-icon">
            <Clock size={80} color="#f59e0b" />
            <div className="expired-glow"></div>
          </div>
          <h2>Approval Token Expired</h2>
          <p>This approval link has expired. Please contact the administrator for a new approval link.</p>
        </div>
      </div>
    );
  }

  if (step === 'completed') {
    return (
      <div className="approval-page">
        <div className="completed-container">
          <div className="completed-icon">
            <CheckCircle size={80} color="#10b981" />
            <div className="completed-glow"></div>
          </div>
          <h2>Account Already Created</h2>
          <p>This approval token has already been used to create an account. You can now log in with your credentials.</p>
          <div className="completed-actions">
            <button onClick={() => navigate('/auth')} className="login-btn">
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="approval-page">
        <div className="success-container">
          <div className="success-icon">
            <CheckCircle size={80} color="#10b981" />
            <div className="success-glow"></div>
          </div>
          <h2>Account Created Successfully!</h2>
          <p>Welcome to GenTeach! Your account has been created successfully. You can now log in and start creating amazing educational content.</p>
          <div className="success-actions">
            <button onClick={() => navigate('/login')} className="login-btn">
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'valid') {
    const requestData = approvalData?.request_data || {};
    
    return (
      <div className="approval-page">
        <div className="approval-container">
          <div className="approval-header">
            <div className="approval-icon">
              <Shield size={64} color="#3b82f6" />
              <div className="approval-glow"></div>
            </div>
            <h1>Complete Your Account Setup</h1>
            <p>Welcome to GenTeach! Please set up your password to complete your account creation.</p>
          </div>

          <div className="user-info-card">
            <div className="user-info-header">
              <div className="user-avatar">
                <User size={24} />
              </div>
              <div className="user-details">
                <h3>{requestData.name}</h3>
                <div className="user-email">
                  <Mail size={16} />
                  {requestData.mail}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="approval-form">
            <div className="form-group">
              <label htmlFor="password">
                <Lock size={16} />
                Password
              </label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                <Lock size={16} />
                Confirm Password
              </label>
              <div className="password-input">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {submitError && (
              <div className="error-message">
                <AlertTriangle size={16} />
                {submitError}
              </div>
            )}

            <button 
              type="submit" 
              className="submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="spinner-small"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="approval-footer">
            <p>By creating your account, you agree to our terms of service and privacy policy.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ApprovalPage; 