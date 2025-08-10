import LandingPage from "./Pages/LandingPage";
import LoginPage from "./Pages/LoginPage";
import ChatPage from "./Pages/ChatPage";
import HomePage from "./Pages/HomePage";
import UsagePage from "./Pages/UsagePage";
import ProfilePage from "./Pages/ProfilePage";
import InstructionPage from "./Pages/InstructionPage";
import ContactPage from "./Pages/ContactPage";
import VideoGallery from "./Pages/VideoGallery";
import AudioGallery from "./Pages/AudioGallery";
import CollectionPage from "./Pages/CollectionPage";
import ScriptGallery from "./Pages/ScriptGallery";
import ManageUsersPage from "./Pages/ManageUsersPage";
import ApprovalPage from "./Pages/ApprovalPage";
import ProtectedRoute from "./Components/ProtectedRoute";
import ProtectedAdminRoute from "./Components/ProtectedAdminRoute";
import PublicRoute from "./Components/PublicRoute";
import { AuthProvider } from "./contexts/AuthContext";
import './App.css';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes - Only accessible when NOT authenticated */}
          <Route path="/" element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } />
          <Route path="/auth" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />

          {/* Approval Route - Public access for account setup */}
          <Route path="/approve/:approvalToken" element={<ApprovalPage />} />

          {/* Protected Routes - Only accessible when authenticated */}
          <Route path="/chat" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />
          <Route path="/home" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/usage" element={
            <ProtectedRoute>
              <UsagePage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/instruction" element={
            <ProtectedRoute>
              <InstructionPage />
            </ProtectedRoute>
          } />
          <Route path="/contact" element={
            <ProtectedRoute>
              <ContactPage />
            </ProtectedRoute>
          } />
          <Route path="/video-gallery" element={
            <ProtectedRoute>
              <VideoGallery />
            </ProtectedRoute>
          } />
          <Route path="/audio-gallery" element={
            <ProtectedRoute>
              <AudioGallery />
            </ProtectedRoute>
          } />
          <Route path="/script-gallery" element={
            <ProtectedRoute>
              <ScriptGallery />
            </ProtectedRoute>
          } />
          <Route path="/collection" element={
            <ProtectedRoute>
              <CollectionPage />
            </ProtectedRoute>
          } />
          <Route path="/manage-users" element={
            <ProtectedAdminRoute>
              <ManageUsersPage />
            </ProtectedAdminRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
