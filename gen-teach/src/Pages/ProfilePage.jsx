import '../Styles/PageStyles/ProfilePage.css';
import Navbar from '../Components/Navbar';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, EyeOff, LogOut } from 'lucide-react';
import Alert from '../Components/Alert';
import { useAuth } from '../contexts/AuthContext';

function ProfilePage() {
  // Alert state for displaying notifications
  const [alert, setAlert] = useState(null);
  const { logout } = useAuth();

  useEffect(() => {
    fetchProfile();
  }, [])

  const [userProfile, setUserProfile] = useState({
    username: 'fetching...',
    email: 'fetching...',
    profilePicture: null,
    totalSessions: 0,
    streak: 0,
    totalContent: 0
  });

  const [editName, setEditName] = useState(userProfile.username)

  const pofileFetched = useState(false);

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function fetchProfile() {
    try {
      // Fetch user profile data
      const profileResponse = await axios.get("https://video-generator-service-lzshkotpba-uc.a.run.app/profile_fetch",
        { withCredentials: true }
      )
      console.log(profileResponse);
      const user_name = profileResponse.data.user_name;
      const user_mail = profileResponse.data.user_mail;
      
      // Fetch usage data for real statistics
      const usageResponse = await axios.get("https://video-generator-service-lzshkotpba-uc.a.run.app/get_usage_data",
        { withCredentials: true }
      )
      console.log(usageResponse);
      
      const usageData = usageResponse.data;
      const totalSessions = usageData.total_sessions || 0;
      const averageUsage = usageData.average_usage || 0;
      const totalContent = usageData.total_content || 0;
      
      // Calculate streak (consecutive days with usage)
      const usageDataArray = usageData.usage_data || [];
      let streak = 0;
      let currentStreak = 0;
      
      for (let i = usageDataArray.length - 1; i >= 0; i--) {
        if (usageDataArray[i].usage > 0) {
          currentStreak++;
          streak = Math.max(streak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      
      setUserProfile(prevProfile => ({
        ...prevProfile,
        username: user_name,
        email: user_mail,
        totalSessions: totalSessions,
        streak: streak,
        totalContent: totalContent
      }))
      setEditName(user_name)

    } catch (err) {
      console.log(err);
      setAlert({ type: "error", message: "Failed to fetch profile data. Please refresh the page or login again." });
    }
  }

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleNameEdit = async () => {
    if (isEditingName) {
      if (userProfile.username != editName) {
        try {
          const response = await axios.post('https://video-generator-service-lzshkotpba-uc.a.run.app/update_profile_name',
            { "new_name": editName },
            { withCredentials: true }
          )
          console.log(response);
          if(response.data.changed) {
            setAlert({ type: "success", message: "Profile updated successfully!" });
            setUserProfile(prevProfile => ({
              ...prevProfile,
              username: editName
            }));
          } else {
            setAlert({ type: "info", message: "No changes were made to your profile." });
          }
        } catch (err) {
          console.log(err);
          setAlert({ type: "error", message: "Failed to update profile. Please try again." });
          // Reset the edit name to original value on error
          setEditName(userProfile.username);
        }
      }
      setIsEditingName(false);
    } else {
      setIsEditingName(true);
    }
  };

  const handlePasswordEdit = async() => {
    if (isEditingPassword) {
      // Validate passwords match
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setAlert({ type: "error", message: "New passwords do not match" });
        return;
      }

      // Validate all fields are filled
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        setAlert({ type: "warning", message: "Please fill in all password fields" });
        return;
      }

      
      if (passwordData.newPassword.length < 6) {
        setAlert({ type: "warning", message: "New password must be at least 6 characters long" });
        return;
      }

      try {
        const response = await axios.post('https://video-generator-service-lzshkotpba-uc.a.run.app/update_password', {
          "old_password": passwordData.currentPassword,
          "new_password": passwordData.newPassword
        },
          { withCredentials: true }
        )
        console.log(response);
        
        if (response.data.updated) {
          setAlert({ type: "success", message: "Password updated successfully!" });
          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
          setIsEditingPassword(false);
          setShowCurrentPassword(false);
          setShowNewPassword(false);
          setShowConfirmPassword(false);
        } else {
          setAlert({ type: "error", message: response.data.message || "Failed to update password" });
        }
      } catch(err) {
        console.log(err);
        if (err.response && err.response.data && err.response.data.message) {
          setAlert({ type: "error", message: err.response.data.message });
        } else {
          setAlert({ type: "error", message: "Failed to update password. Please try again." });
        }
      }
    } else {
      setIsEditingPassword(true)
    }
  }

  const handlePasswordCancel = () => {
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setIsEditingPassword(false);
    // Reset password visibility states
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    // Clear any existing alerts
    setAlert(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAlert({ type: "success", message: "Logged out successfully! Redirecting to login..." });
      // Navigation will be handled by the AuthContext
    } catch (err) {
      console.log(err);
      setAlert({ type: "error", message: "Failed to logout. Please try again." });
    }
  };

  const getInitials = (name) => {
    return name.split('_').map(part => part[0].toUpperCase()).join('');
  };

  return (
    <>
      <Navbar />
      {/* Alert component - will only show when alert state is not null */}
      {alert && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 10000 }}>
          <Alert 
            type={alert.type} 
            message={alert.message} 
            dismissible={true}
            onDismiss={() => setAlert(null)}
          />
        </div>
      )}
      
      <div className="profile-page">
        <div className="profile-container">
          {/* Profile Header */}
          <div className="profile-header">
            <div className="profile-avatar-section">
              <div className="profile-avatar">
                {userProfile.profilePicture ? (
                  <img src={userProfile.profilePicture} alt="Profile" />
                ) : (
                  <div className="avatar-placeholder">
                    {getInitials(userProfile.username)}
                  </div>
                )}
                <div className="avatar-status"></div>
              </div>
              <div className="profile-info">
                <h1 className="profile-title">My Profile</h1>
                <p className="profile-subtitle">Manage your account settings and preferences</p>
              </div>
            </div>
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-number">{userProfile.totalSessions}</span>
                <span className="stat-label">Total Sessions</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{userProfile.streak}</span>
                <span className="stat-label">Day Streak</span>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="profile-content">
            {/* Account Information */}
            <div className="profile-section">
              <div className="section-header">
                <h2 className="section-title">Account Information</h2>
                <div className="section-icon">👤</div>
              </div>

              <div className="profile-fields">
                {/* Username Field */}
                <div className="field-group">
                  <label className="field-label">Username</label>
                  <div className="field-container">
                    {isEditingName ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="field-input editing"
                        autoFocus
                      />
                    ) : (
                      <div className="field-display">
                        <span className="field-value">{userProfile.username}</span>
                      </div>
                    )}
                    <button
                      onClick={() => { handleNameEdit() }}
                      className={`edit-btn ${isEditingName ? 'save-btn' : ''}`}
                    >
                      {isEditingName ? (
                        <>
                          <span className="btn-icon">✓</span>
                          Save
                        </>
                      ) : (
                        <>
                          <span className="btn-icon">✏️</span>
                          Edit
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Email Field */}
                <div className="field-group">
                  <label className="field-label">Email Address</label>
                  <div className="field-container">
                    <div className="field-display">
                      <span className="field-value">{userProfile.email}</span>
                      <span className="field-badge">Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="profile-section">
              <div className="section-header">
                <h2 className="section-title">Security</h2>
                <div className="section-icon">🔒</div>
              </div>

              <div className="security-content">
                {!isEditingPassword ? (
                  <div className="password-section">
                    <div className="password-info">
                      <h3 className="password-title">Password</h3>
                      <p className="password-desc">Keep your account secure with a strong password</p>
                    </div>
                    <button onClick={handlePasswordEdit} className="edit-btn">
                      <span className="btn-icon">🔑</span>
                      Change Password
                    </button>
                  </div>
                ) : (
                  <div className="password-form">
                    <div className="form-group">
                      <label className="form-label">Current Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          className="form-input"
                          placeholder="Enter your current password"
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666'
                          }}
                        >
                          {showCurrentPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="form-input"
                          placeholder="Enter new password"
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666'
                          }}
                        >
                          {showNewPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="form-input"
                          placeholder="Confirm new password"
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666'
                          }}
                        >
                          {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-actions">
                      <button onClick={handlePasswordCancel} className="cancel-btn">
                        Cancel
                      </button>
                      <button onClick={handlePasswordEdit} className="save-btn">
                        Update Password
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Overview */}
            <div className="profile-section">
              <div className="section-header">
                <h2 className="section-title">Activity Overview</h2>
                <div className="section-icon">📈</div>
              </div>

              <div className="activity-grid">
                <div className="activity-card">
                  <div className="activity-icon">🎯</div>
                  <div className="activity-content">
                    <h4 className="activity-title">Learning Streak</h4>
                    <p className="activity-value">{userProfile.streak} days</p>
                    <p className="activity-desc">
                      {userProfile.streak > 0 
                        ? "Keep it up! You're on fire!" 
                        : "Start your learning streak today!"
                      }
                    </p>
                  </div>
                </div>

                <div className="activity-card">
                  <div className="activity-icon">📚</div>
                  <div className="activity-content">
                    <h4 className="activity-title">Total Content</h4>
                    <p className="activity-value">{userProfile.totalContent} items</p>
                    <p className="activity-desc">Videos, quizzes, and scripts</p>
                  </div>
                </div>

                <div className="activity-card">
                  <div className="activity-icon">📊</div>
                  <div className="activity-content">
                    <h4 className="activity-title">Total Sessions</h4>
                    <p className="activity-value">{userProfile.totalSessions} sessions</p>
                    <p className="activity-desc">All time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Logout Section */}
            <div className="profile-section logout-section">
              <div className="section-header">
                <h2 className="section-title">Account Actions</h2>
                <div className="section-icon">⚙️</div>
              </div>

              <div className="logout-content">
                <div className="logout-info">
                  <h3 className="logout-title">Sign Out</h3>
                  <p className="logout-desc">Sign out of your account and clear all session data</p>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default ProfilePage