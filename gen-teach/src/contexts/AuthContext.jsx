import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // First check session status
      const sessionResponse = await axios.get('https://video-generator-service-lzshkotpba-uc.a.run.app/session/check', {
        withCredentials: true
      });
      
      if (sessionResponse.data.authenticated) {
        // Session is valid, get user profile
        const profileResponse = await axios.get('https://video-generator-service-lzshkotpba-uc.a.run.app/profile_fetch', {
          withCredentials: true
        });
        
        if (profileResponse.status === 200) {
          setIsAuthenticated(true);
          setUser({
            name: profileResponse.data.user_name,
            email: profileResponse.data.user_mail
          });
          
          // Check admin status
          const adminResponse = await axios.get('https://video-generator-service-lzshkotpba-uc.a.run.app/admin/check_admin', {
            withCredentials: true
          });
          
          if (adminResponse.status === 200) {
            setIsAdmin(adminResponse.data.isAdmin);
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setIsAdmin(false);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.log('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await axios.post('https://video-generator-service-lzshkotpba-uc.a.run.app/login', credentials, {
        withCredentials: true
      });
      
      if (response.data.logged) {
        const profileResponse = await axios.get('https://video-generator-service-lzshkotpba-uc.a.run.app/profile_fetch', {
          withCredentials: true
        });
        
        setIsAuthenticated(true);
        setUser({
          name: profileResponse.data.user_name,
          email: profileResponse.data.user_mail
        });
        
        // Check admin status after login
        const adminResponse = await axios.get('https://video-generator-service-lzshkotpba-uc.a.run.app/admin/check_admin', {
          withCredentials: true
        });
        
        if (adminResponse.status === 200) {
          setIsAdmin(adminResponse.data.isAdmin);
        }
        
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.log('Login error:', error);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      const response = await axios.post('https://video-generator-service-lzshkotpba-uc.a.run.app/logout', {}, {
        withCredentials: true
      });
      
      if (response.data.success) {
        console.log('Logout successful');
      } else {
        console.log('Logout failed:', response.data.message);
      }
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      // Always clear local state regardless of backend response
      setIsAuthenticated(false);
      setUser(null);
      setIsAdmin(false);
      
      // Force a fresh auth check to ensure session is cleared
      setTimeout(() => {
        checkAuthStatus();
      }, 100);
    }
  };

  const request = async(details) => {
    try {
      const response = await axios.post('https://video-generator-service-lzshkotpba-uc.a.run.app/makerequest',
        details,
        {withCredentials: true}
      );

      if(response.data.requested) {
        return {success: true, message: response.data.message};
      } else {
        return {success: false, message: response.data.message};
      }
    } catch(err) {
      console.log('Request Error', error);
      return {success: false, message: 'Request failed. Please try again.'};
    }
  }

  const value = {
    isAuthenticated,
    user,
    loading,
    isAdmin,
    login,
    request,
    logout,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 