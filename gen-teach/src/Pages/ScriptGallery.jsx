import { useState, useEffect } from "react";
import { Download, FileText, Search, Eye, Trash2 } from 'lucide-react';
import '../Styles/PageStyles/ScriptGallery.css';
import Navbar from "../Components/Navbar";
import BackButton from '../Components/BackButton.jsx';

function ScriptGallery() {
    const [scripts, setScripts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedScript, setSelectedScript] = useState(null);
    const [previewContent, setPreviewContent] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [error, setError] = useState(null);
    const [deletingScript, setDeletingScript] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [scriptToDelete, setScriptToDelete] = useState(null);

    useEffect(() => {
        fetchScripts();
    }, []);

    const fetchScripts = async () => {
        try {
            setError(null);
            console.log('Fetching scripts...');
            const response = await fetch('https://video-generator-service-lzshkotpba-uc.a.run.app/list_script', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData);
                throw new Error(errorData.error || 'Failed to fetch scripts');
            }
            
            const data = await response.json();
            console.log('Fetched scripts:', data);
            setScripts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching scripts:', error);
            setError(error.message);
            setScripts([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredScripts = scripts.filter(script =>
        script.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handlePreview = async (script) => {
        setSelectedScript(script);
        setPreviewLoading(true);
        try {
            console.log('Fetching script content via backend:', script.url);
            
            const response = await fetch('https://video-generator-service-lzshkotpba-uc.a.run.app/get_script_content', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: script.url })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const content = data.content;
            console.log('Script content length:', content.length);
            
            // Clean up the content for better readability
            const cleanContent = content
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            setPreviewContent(cleanContent);
        } catch (error) {
            console.error('Error fetching script content:', error);
            setPreviewContent(`Error loading script content: ${error.message}`);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleDownload = async (script) => {
    try {
            console.log('Downloading script:', script.url);
            
            const response = await fetch('https://video-generator-service-lzshkotpba-uc.a.run.app/download_script', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url: script.url,
                    filename: script.filename 
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
        link.download = script.filename;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
            
            console.log('Script downloaded successfully');
    } catch (error) {
        console.error('Error downloading script:', error);
            alert('Failed to download script file');
    }
};

    const closePreview = () => {
        setSelectedScript(null);
        setPreviewContent('');
    };

    const handleDelete = async (script, e) => {
        e.stopPropagation(); // Prevent triggering other actions
        setScriptToDelete(script);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!scriptToDelete) return;
        
        setDeletingScript(scriptToDelete.filename);
        setShowDeleteConfirm(false);
        
        try {
            console.log('Deleting script:', scriptToDelete.filename);
            
            const response = await fetch('https://video-generator-service-lzshkotpba-uc.a.run.app/delete_script', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url: scriptToDelete.url,
                    filename: scriptToDelete.filename 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            console.log('Script deleted successfully');
            
            // Remove the script from the local state
            setScripts(prevScripts => prevScripts.filter(s => s.filename !== scriptToDelete.filename));
            
            // Close preview if the deleted script was being previewed
            if (selectedScript && selectedScript.filename === scriptToDelete.filename) {
                closePreview();
            }
            
        } catch (error) {
            console.error('Error deleting script:', error);
            alert('Failed to delete script file');
        } finally {
            setDeletingScript(null);
            setScriptToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setScriptToDelete(null);
    };

    if (loading) {
        return (
            <>
            <BackButton />
            <Navbar />
            <div className="script-gallery">
                <div className="loading">Loading scripts...</div>
            </div>
            </>
        );
    }

    return (
        <>
        <BackButton />
        <Navbar />
        <div className="script-gallery">
            <div className="gallery-header">
                <h1 className="gallery-title">Script Gallery</h1>
                <div className="script-count">
                    <span className="count-number">{scripts.length}</span>
                    <span className="count-label">SCRIPTS</span>
                </div>

                <div className="search-container">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search scripts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="scripts-grid">
                {filteredScripts.map((script, index) => (
                    <div key={index} className="script-card">
                        <div className="script-icon">
                            <FileText size={40} />
                        </div>

                        <div className="script-info">
                            <h3 className="script-title">
                                {script.filename.replace('.txt', '')}
                            </h3>
                            <p className="script-type">TXT • Script Content</p>
                        </div>

                        <div className="script-actions">
                            <button
                                className="action-btn preview-btn"
                                onClick={() => handlePreview(script)}
                                title="Preview"
                            >
                                <Eye size={18} />
                            </button>
                            <button
                                className="action-btn download-btn"
                                onClick={() => handleDownload(script)}
                                title="Download"
                            >
                                <Download size={18} />
                            </button>
                            <button
                                className={`action-btn delete-btn ${deletingScript === script.filename ? 'deleting' : ''}`}
                                onClick={(e) => handleDelete(script, e)}
                                title="Delete"
                                disabled={deletingScript === script.filename}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {error && (
                <div className="error-state">
                    <h3>Error Loading Scripts</h3>
                    <p>{error}</p>
                    <button onClick={fetchScripts} className="retry-btn">
                        Retry
                    </button>
                </div>
            )}

            {scripts.length === 0 && !error && (
                <div className="empty-state">
                    <FileText size={64} />
                    <h3>No Scripts Found</h3>
                    <p>No script files are currently available.</p>
                </div>
            )}

            {filteredScripts.length === 0 && scripts.length > 0 && (
                <div className="empty-state">
                    <Search size={64} />
                    <h3>No Results Found</h3>
                    <p>Try adjusting your search terms.</p>
                </div>
            )}

            {selectedScript && (
                <div className="preview-modal" onClick={closePreview}>
                    <div className="preview-content" onClick={(e) => e.stopPropagation()}>
                        <div className="preview-header">
                            <div className="preview-title-section">
                                <h3>{selectedScript.filename.replace('.txt', '')}</h3>
                                <span className="preview-subtitle">Script Preview</span>
                            </div>
                            <button className="close-btn" onClick={closePreview}>×</button>
                        </div>
                        <div className="preview-body">
                            {previewLoading ? (
                                <div className="preview-loading">
                                    <div className="loading-spinner"></div>
                                    <span>Loading script content...</span>
                                </div>
                            ) : (
                                <div className="script-reader">
                                    <div className="reader-content">
                                        {previewContent.split('\n\n').map((paragraph, index) => (
                                            <p key={index} className="script-paragraph">
                                                {paragraph.split('\n').map((line, lineIndex) => (
                                                    <span key={lineIndex}>
                                                        {line}
                                                        {lineIndex < paragraph.split('\n').length - 1 && <br />}
                                                    </span>
                                                ))}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="preview-actions">
                            <div className="reading-stats">
                                <span className="word-count">
                                    {previewContent ? `${previewContent.split(/\s+/).filter(word => word.length > 0).length} words` : ''}
                                </span>
                                <span className="char-count">
                                    {previewContent ? `${previewContent.length} characters` : ''}
                                </span>
                            </div>
                            <button
                                className="download-btn-modal"
                                onClick={() => handleDownload(selectedScript)}
                            >
                                <Download size={16} />
                                Download Script
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && scriptToDelete && (
                <div className="delete-confirm-modal" onClick={cancelDelete}>
                    <div className="delete-confirm-content" onClick={(e) => e.stopPropagation()}>
                        <div className="delete-confirm-header">
                            <h3>Delete Script</h3>
                            <button className="close-btn" onClick={cancelDelete}>×</button>
                        </div>
                        <div className="delete-confirm-body">
                            <p>Are you sure you want to delete <strong>"{scriptToDelete.filename}"</strong>?</p>
                            <p className="delete-warning">This action cannot be undone.</p>
                        </div>
                        <div className="delete-confirm-actions">
                            <button className="cancel-btn" onClick={cancelDelete}>
                                Cancel
                            </button>
                            <button 
                                className="confirm-delete-btn" 
                                onClick={confirmDelete}
                                disabled={deletingScript === scriptToDelete.filename}
                            >
                                {deletingScript === scriptToDelete.filename ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}

export default ScriptGallery
