import { Play, Pause, Search, Music, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Download, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import '../Styles/PageStyles/AudioGallery.css';

import Navbar from '../Components/Navbar.jsx';
import BackButton from '../Components/BackButton.jsx';

function AudioGallery() {
  const [audios, setAudios] = useState([]);
  const [filteredAudios, setFilteredAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingAudio, setDownloadingAudio] = useState(null);
  const [deletingAudio, setDeletingAudio] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [audioToDelete, setAudioToDelete] = useState(null);

  // Bottom player states
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isRepeated, setIsRepeated] = useState(false);
  
  const audioRef = useRef(null);

  useEffect(() => {
    fetchAudios();
  }, []);

  useEffect(() => {
    // Filter audios based on search term
    if (searchTerm.trim() === '') {
      setFilteredAudios(audios);
    } else {
      const filtered = audios.filter(audio =>
        formatFileName(audio.filename).toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAudios(filtered);
    }
  }, [audios, searchTerm]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      if (isRepeated) {
        audio.currentTime = 0;
        audio.play();
      } else {
        handleNext();
      }
    };
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleLoadedData = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleCanPlay = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isRepeated, currentAudio]);

  const fetchAudios = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/list_audio', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const audioData = await response.json();
      console.log('Raw audio data:', audioData);
      
      // Fix audio URLs - your backend returns URLs with /static/video/ but files are in audio folder
      const fixedAudioData = audioData.map(audio => ({
        ...audio,
        // Replace /static/video/ with /static/audio/ to match your AUDIO_FOLDER
        url: audio.url.replace('/static/video/', '/static/audio/')
      }));
      
      console.log('Fixed audio URLs:', fixedAudioData);
      setAudios(Array.isArray(fixedAudioData) ? fixedAudioData : []);
      setFilteredAudios(Array.isArray(fixedAudioData) ? fixedAudioData : []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAudioClick = (audio) => {
    setCurrentAudio(audio);
    if (audioRef.current) {
      audioRef.current.src = audio.url;
      audioRef.current.load();
      // Reset states
      setCurrentTime(0);
      setDuration(0);
      // Auto play the selected audio
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(err => {
            console.error('Error playing audio:', err);
            setIsPlaying(false);
          });
        }
      }, 100);
    }
  };

  const formatFileName = (filename) => {
    return filename.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
  };

  const handleDownload = async (audio, e) => {
    e.stopPropagation(); // Prevent triggering the audio play
    setDownloadingAudio(audio.filename);
    
    try {
      console.log('Downloading audio:', audio.url);
      
      const response = await fetch('http://localhost:5000/download_audio', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: audio.url,
          filename: audio.filename 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = audio.filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Audio downloaded successfully');
      
      // Show success state briefly
      setTimeout(() => {
        setDownloadingAudio(null);
      }, 1000);
      
    } catch (error) {
      console.error('Error downloading audio:', error);
      alert('Failed to download audio file');
      setDownloadingAudio(null);
    }
  };

  const handleDelete = async (audio, e) => {
    e.stopPropagation(); // Prevent triggering the audio play
    setAudioToDelete(audio);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!audioToDelete) return;
    
    setDeletingAudio(audioToDelete.filename);
    setShowDeleteConfirm(false);
    
    try {
      console.log('Deleting audio:', audioToDelete.filename);
      
      const response = await fetch('http://localhost:5000/delete_audio', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: audioToDelete.url,
          filename: audioToDelete.filename 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('Audio deleted successfully');
      
      // Remove the audio from the local state
      setAudios(prevAudios => prevAudios.filter(a => a.filename !== audioToDelete.filename));
      
      // Stop playing if the deleted audio was currently playing
      if (currentAudio && currentAudio.filename === audioToDelete.filename) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
        setCurrentAudio(null);
        setCurrentTime(0);
        setDuration(0);
      }
      
    } catch (error) {
      console.error('Error deleting audio:', error);
      alert('Failed to delete audio file');
    } finally {
      setDeletingAudio(null);
      setAudioToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setAudioToDelete(null);
  };

  // Bottom player functions
  const togglePlayPause = () => {
    if (!audioRef.current || !currentAudio) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Error playing audio:', err);
        setIsPlaying(false);
      });
    }
  };

  const handleNext = () => {
    if (!currentAudio || audios.length === 0) return;
    
    const currentIndex = audios.findIndex(audio => audio.filename === currentAudio.filename);
    let nextIndex;
    
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * audios.length);
    } else {
      nextIndex = (currentIndex + 1) % audios.length;
    }
    
    const nextAudio = audios[nextIndex];
    setCurrentAudio(nextAudio);
    if (audioRef.current) {
      audioRef.current.src = nextAudio.url;
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(0);
      if (isPlaying) {
        setTimeout(() => {
          audioRef.current.play().catch(err => {
            console.error('Error playing next audio:', err);
            setIsPlaying(false);
          });
        }, 100);
      }
    }
  };

  const handlePrevious = () => {
    if (!currentAudio || audios.length === 0) return;
    
    const currentIndex = audios.findIndex(audio => audio.filename === currentAudio.filename);
    const prevIndex = currentIndex === 0 ? audios.length - 1 : currentIndex - 1;
    
    const prevAudio = audios[prevIndex];
    setCurrentAudio(prevAudio);
    if (audioRef.current) {
      audioRef.current.src = prevAudio.url;
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(0);
      if (isPlaying) {
        setTimeout(() => {
          audioRef.current.play().catch(err => {
            console.error('Error playing previous audio:', err);
            setIsPlaying(false);
          });
        }, 100);
      }
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const formatTime = (time) => {
    if (isNaN(time) || time === 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <>
        <BackButton />
        <Navbar />
        <div className="audio-gallery">
          <div className="gallery-header">
            <h1 className="gallery-title">Audio Gallery</h1>
            <p className="gallery-subtitle">Loading your audio collection...</p>
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
        <div className="audio-gallery">
          <div className="gallery-header">
            <h1 className="gallery-title">Audio Gallery</h1>
            <p className="gallery-subtitle">Error loading audios</p>
          </div>
          <div className="error-message">
            <p>Failed to load audios: {error}</p>
            <button onClick={fetchAudios} className="retry-btn">Try Again</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    <BackButton />
      <Navbar />
      <div className="audio-gallery">
        {/* Header */}
        <div className="gallery-header">
          <h1 className="gallery-title">Audio Gallery</h1>
          
          {/* Audio Count and Search */}
          <div className="gallery-controls">
            <div className="audio-count">
              <span className="count-number">{audios.length}</span>
              <span className="count-label">Audios</span>
            </div>
            
            <div className="search-container">
              <Search className='searchicon' size={20} color='whitesmoke'/>
              <input
                type="text"
                placeholder="Search audios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        {/* Audio Grid */}
        {filteredAudios.length === 0 && searchTerm ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Music size={48} />
            </div>
            <h3>No Audios Found</h3>
            <p>No audios match your search "{searchTerm}"</p>
          </div>
        ) : audios.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Music size={48} />
            </div>
            <h3>No Audios Found</h3>
            <p>No audio files are currently available in your collection.</p>
          </div>
        ) : (
          <div className="audio-grid">
            {filteredAudios.map((audio, index) => (
              <div 
                key={audio.filename} 
                className={`audio-card ${currentAudio?.filename === audio.filename ? 'playing' : ''}`}
                onClick={() => handleAudioClick(audio)}
              >
                <div className="audio-thumbnail">
                  <div className="audio-icon">
                    <Music size={40} />
                  </div>
                  <div className="audio-overlay">
                    <div className="play-button">
                      <Play size={32} />
                    </div>
                  </div>
                </div>
                <div className="audio-info">
                  <h3 className="audio-title">{formatFileName(audio.filename)}</h3>
                  <p className="audio-meta">MP3 • Audio Content</p>
                </div>
                <div className="audio-actions">
                  <button
                    className={`download-btn ${downloadingAudio === audio.filename ? 'loading' : ''}`}
                    onClick={(e) => handleDownload(audio, e)}
                    title="Download Audio"
                    disabled={downloadingAudio === audio.filename}
                  >
                    <Download size={18} />
                  </button>
                  <button
                    className={`delete-btn ${deletingAudio === audio.filename ? 'deleting' : ''}`}
                    onClick={(e) => handleDelete(audio, e)}
                    title="Delete Audio"
                    disabled={deletingAudio === audio.filename}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Audio Player */}
      {currentAudio && (
        <div className="bottom-player">
          <audio 
            ref={audioRef}
            src={currentAudio.url}
            preload="metadata"
            onError={(e) => {
              console.error('Bottom player audio error:', currentAudio.url, e);
              console.error('Error details:', e.target.error);
            }}
            onLoadStart={() => console.log('Loading bottom player audio:', currentAudio.url)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          <div className="player-content">
            {/* Track Info */}
            <div className="track-info">
              <div className="track-icon">
                <Music size={20} />
              </div>
              <div className="track-details">
                <div className="track-name">{formatFileName(currentAudio.filename)}</div>
                <div className="track-artist">Audio Content</div>
              </div>
            </div>

            {/* Player Controls */}
            <div className="player-controls">
              <div className="control-buttons">
                <button 
                  className={`control-btn ${isShuffled ? 'active' : ''}`}
                  onClick={() => setIsShuffled(!isShuffled)}
                >
                  <Shuffle size={16} />
                </button>
                
                <button className="control-btn" onClick={handlePrevious}>
                  <SkipBack size={18} />
                </button>
                
                <button className="play-pause-btn" onClick={togglePlayPause}>
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                
                <button className="control-btn" onClick={handleNext}>
                  <SkipForward size={18} />
                </button>
                
                <button 
                  className={`control-btn ${isRepeated ? 'active' : ''}`}
                  onClick={() => setIsRepeated(!isRepeated)}
                >
                  <Repeat size={16} />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="progress-container">
                <span className="time-display">{formatTime(currentTime)}</span>
                <div className="progress-bar" onClick={handleSeek}>
                  <div 
                    className="progress-fill"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="time-display">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Volume Control */}
            <div className="volume-control">
              <Volume2 size={18} />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && audioToDelete && (
        <div className="delete-confirm-modal" onClick={cancelDelete}>
          <div className="delete-confirm-content" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <h3>Delete Audio</h3>
              <button className="close-btn" onClick={cancelDelete}>×</button>
            </div>
            <div className="delete-confirm-body">
              <p>Are you sure you want to delete <strong>"{audioToDelete.filename}"</strong>?</p>
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="delete-confirm-actions">
              <button className="cancel-btn" onClick={cancelDelete}>
                Cancel
              </button>
              <button 
                className="confirm-delete-btn" 
                onClick={confirmDelete}
                disabled={deletingAudio === audioToDelete.filename}
              >
                {deletingAudio === audioToDelete.filename ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AudioGallery;