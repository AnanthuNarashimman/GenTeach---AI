import '../Styles/ComponentStyles/Navbar.css';
import { User, Shield } from 'lucide-react';
import { useNavigate, useLocation } from "react-router-dom";
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAdmin } = useAuth();

  function toggleMobileMenu() {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  }

  // Function to check if the current path matches the nav item
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      <div className="ham-button" onClick={toggleMobileMenu}>
        <Menu size={24} color='white' />
      </div>
      
      <div className="navbar">
        <ul className="nav-items">
          <p className="logo">GenTeach</p>
          <li onClick={() => { navigate('/home') }}>
            <a href="" className={isActive('/home') ? 'active' : ''}>Home</a>
          </li>
          <li onClick={() => { navigate('/usage') }}>
            <a href="" className={isActive('/usage') ? 'active' : ''}>Usage</a>
          </li>
          <li onClick={() => { navigate('/instruction') }}>
            <a href="" className={isActive('/instruction') ? 'active' : ''}>Instructions</a>
          </li>
          <li onClick={() => { navigate('/contact') }}>
            <a href="" className={isActive('/contact') ? 'active' : ''}>Contact</a>
          </li>
          {isAdmin && (
            <li onClick={() => { navigate('/manage-users') }}>
              <a href="" className={isActive('/manage-users') ? 'active' : ''}>
                <Shield size={20} />
                Admin
              </a>
            </li>
          )}
          <div className="profile" onClick={() => { navigate('/profile') }}>
            <User size={24} color='white' />
          </div>
        </ul>
      </div>

      <ul className={`mob-nav ${isMobileMenuOpen ? 'active' : ''}`}>
        <li onClick={() => { navigate('/home'); setIsMobileMenuOpen(false); }}>
          <a href="" className={isActive('/home') ? 'active' : ''}>Home</a>
        </li>
        <li onClick={() => { navigate('/usage'); setIsMobileMenuOpen(false); }}>
          <a href="" className={isActive('/usage') ? 'active' : ''}>Usage</a>
        </li>
        <li onClick={() => { navigate('/instruction'); setIsMobileMenuOpen(false); }}>
          <a href="" className={isActive('/instruction') ? 'active' : ''}>Instructions</a>
        </li>
        <li onClick={() => { navigate('/contact'); setIsMobileMenuOpen(false); }}>
          <a href="" className={isActive('/contact') ? 'active' : ''}>Contact</a>
        </li>
        {isAdmin && (
          <li onClick={() => { navigate('/manage-users'); setIsMobileMenuOpen(false); }}>
            <a href="" className={isActive('/manage-users') ? 'active' : ''}>
              <Shield size={20} />
              Admin
            </a>
          </li>
        )}
      </ul>
    </>
  )
}

export default Navbar