import { Play, Pause, Volume2, VolumeX, Maximize, Calendar, Clock, Search, GalleryHorizontal, Trash2 } from 'lucide-react';
import { LayoutGrid, Grid3x3, FolderOpen, Library } from 'lucide-react';
import { useState, useEffect } from 'react';
import '../Styles/PageStyles/VideoGallery.css';
import BackButton from '../Components/BackButton.jsx';
import axios from 'axios';

import Navbar from '../Components/Navbar.jsx';

function VideoGallery() {
  const [videos, setVideos] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingVideo, setDeletingVideo] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    // Filter videos based on search term
    if (searchTerm.trim() === '') {
      setFilteredVideos(videos);
    } else {
      const filtered = videos.filter(video =>
        formatFileName(video.filename).toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredVideos(filtered);
    }
  }, [videos, searchTerm]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://video-generator-service-lzshkotpba-uc.a.run.app/list_video', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const videoData = await response.json();
      console.log('Raw video data:', videoData);

      // Fix video URLs to point to Flask server
      const fixedVideoData = videoData.map(video => ({
        ...video,
        url: video.url.startsWith('http') ? video.url : `https://video-generator-service-lzshkotpba-uc.a.run.app${video.url}`
      }));

      console.log('Fixed video URLs:', fixedVideoData);
      setVideos(Array.isArray(fixedVideoData) ? fixedVideoData : []);
      setFilteredVideos(Array.isArray(fixedVideoData) ? fixedVideoData : []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setPlayingVideo(video.filename);
  };

  const closeModal = () => {
    setSelectedVideo(null);
    setPlayingVideo(null);
  };

  const formatFileName = (filename) => {
    return filename.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
  };

  const handleDelete = async (video, e) => {
    e.stopPropagation(); // Prevent triggering the video play
    setVideoToDelete(video);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;
    
    setDeletingVideo(videoToDelete.filename);
    setShowDeleteConfirm(false);
    
    try {
      console.log('Deleting video:', videoToDelete.filename);
      
      const response = await fetch('https://video-generator-service-lzshkotpba-uc.a.run.app/delete_video', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: videoToDelete.url,
          filename: videoToDelete.filename 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('Video deleted successfully');
      
      // Remove the video from the local state
      setVideos(prevVideos => prevVideos.filter(v => v.filename !== videoToDelete.filename));
      
      // Close modal if the deleted video was being viewed
      if (selectedVideo && selectedVideo.filename === videoToDelete.filename) {
        closeModal();
      }
      
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video file');
    } finally {
      setDeletingVideo(null);
      setVideoToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setVideoToDelete(null);
  };

  if (loading) {
    return (
      <>
        <BackButton />
        <Navbar />
        <div className="video-gallery">
          <div className="gallery-header">
            <h1 className="gallery-title">Video Gallery</h1>
            <p className="gallery-subtitle">Loading your video collection...</p>
          </div>
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <BackButton />
        <Navbar />
        <div className="video-gallery">
          <div className="gallery-header">
            <h1 className="gallery-title">Video Gallery</h1>
            <p className="gallery-subtitle">Error loading videos</p>
          </div>
          <div className="error-message">
            <p>Failed to load videos: {error}</p>
            <button onClick={fetchVideos} className="retry-btn">Try Again</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <BackButton />
      <Navbar />
      <div className="video-gallery">
        {/* Header */}
        <div className="gallery-header">
          <h1 className="gallery-title">Video Gallery</h1>

          {/* Video Count and Search */}
          <div className="gallery-controls">
            <div className="video-count">
              <span className="count-number">{videos.length}</span>
              <span className="count-label">Videos</span>
            </div>

            <div className="search-container">
              <Search className='searchicon' size={20} color='whitesmoke' />
              <input
                type="text"
                placeholder="Search videos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        {/* Video Grid */}
        {filteredVideos.length === 0 && searchTerm ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Play size={48} />
            </div>
            <h3>No Videos Found</h3>
            <p>No videos match your search "{searchTerm}"</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Play size={48} />
            </div>
            <h3>No Videos Found</h3>
            <p>No video files are currently available in your collection.</p>
          </div>
        ) : (
          <div className="video-grid">
            {filteredVideos.map((video, index) => (
              <div
                key={video.filename}
                className="video-card"
                onClick={() => handleVideoClick(video)}
              >
                <div className="video-thumbnail">
                  <video
                    src={video.url}
                    className="thumbnail-video"
                    muted
                    onMouseEnter={(e) => e.target.play()}
                    onMouseLeave={(e) => {
                      e.target.pause();
                      e.target.currentTime = 0;
                    }}
                  />
                  <div className="video-overlay">
                    <div className="play-button">
                      <Play size={32} />
                    </div>
                  </div>
                </div>
                <div className="video-info">
                  <h3 className="video-title">{formatFileName(video.filename)}</h3>
                  <p className="video-meta">MP4 • Generated Content</p>
                </div>
                <div className="video-actions">
                  <button
                    className={`delete-btn ${deletingVideo === video.filename ? 'deleting' : ''}`}
                    onClick={(e) => handleDelete(video, e)}
                    title="Delete Video"
                    disabled={deletingVideo === video.filename}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Video Modal */}
        {selectedVideo && (
          <div className="video-modal" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{formatFileName(selectedVideo.filename)}</h2>
                <button className="close-btn" onClick={closeModal}>×</button>
              </div>
              <div className="modal-video-container">
                <video
                  src={selectedVideo.url}
                  controls
                  autoPlay
                  className="modal-video"
                  onError={(e) => {
                    console.error('Modal video error:', selectedVideo.url, e);
                    console.error('Error details:', e.target.error);
                  }}
                  onLoadStart={() => console.log('Loading modal video:', selectedVideo.url)}
                />
                <p style={{ color: '#94a3b8', padding: '1rem', fontSize: '0.9rem' }}>
                  Video URL: {selectedVideo.url}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && videoToDelete && (
          <div className="delete-confirm-modal" onClick={cancelDelete}>
            <div className="delete-confirm-content" onClick={(e) => e.stopPropagation()}>
              <div className="delete-confirm-header">
                <h3>Delete Video</h3>
                <button className="close-btn" onClick={cancelDelete}>×</button>
              </div>
              <div className="delete-confirm-body">
                <p>Are you sure you want to delete <strong>"{videoToDelete.filename}"</strong>?</p>
                <p className="delete-warning">This action cannot be undone.</p>
              </div>
              <div className="delete-confirm-actions">
                <button className="cancel-btn" onClick={cancelDelete}>
                  Cancel
                </button>
                <button 
                  className="confirm-delete-btn" 
                  onClick={confirmDelete}
                  disabled={deletingVideo === videoToDelete.filename}
                >
                  {deletingVideo === videoToDelete.filename ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default VideoGallery;
