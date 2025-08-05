import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const Alert = ({ type = 'info', message, dismissible = false, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!isVisible) return null;

  const alertConfig = {
    success: { 
      icon: CheckCircle,
      bgColor: '#10b981', // Solid green background
      borderColor: '#059669',
      textColor: '#ffffff',
      iconColor: '#ffffff'
    },
    error: { 
      icon: AlertCircle,
      bgColor: '#ef4444', // Solid red background
      borderColor: '#dc2626',
      textColor: '#ffffff',
      iconColor: '#ffffff'
    },
    warning: { 
      icon: AlertTriangle,
      bgColor: '#f59e0b', // Solid amber background
      borderColor: '#d97706',
      textColor: '#ffffff',
      iconColor: '#ffffff'
    },
    info: { 
      icon: Info,
      bgColor: '#3b82f6', // Solid blue background
      borderColor: '#2563eb',
      textColor: '#ffffff',
      iconColor: '#ffffff'
    }
  };

  const config = alertConfig[type] || alertConfig.info;
  const IconComponent = config.icon;

  const alertStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    marginBottom: '16px',
    borderRadius: '12px',
    border: `2px solid ${config.borderColor}`,
    backgroundColor: config.bgColor,
    color: config.textColor,
    fontSize: '15px',
    fontWeight: '500',
    zIndex: '10000',
    minWidth: '300px',
    maxWidth: '400px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(10px)',
    animation: 'slideIn 0.3s ease-out',
  };

  const iconStyle = {
    width: '22px',
    height: '22px',
    marginRight: '14px',
    flexShrink: 0,
    color: config.iconColor
  };

  const messageStyle = {
    flex: 1,
    margin: 0,
    lineHeight: '1.4'
  };

  const dismissButtonStyle = {
    marginLeft: '16px',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: config.iconColor,
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(5px)'
  };

  // Add keyframe animation styles to the document head if not already present
  React.useEffect(() => {
    const styleId = 'alert-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div style={alertStyle} role="alert">
      <IconComponent style={iconStyle} />
      <div style={messageStyle}>{message}</div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          style={dismissButtonStyle}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            e.target.style.transform = 'scale(1)';
          }}
          title="Dismiss"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;