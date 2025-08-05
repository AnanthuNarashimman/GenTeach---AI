import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Trash2, 
  Search, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Crown,
  Activity,
  Mail,
  Calendar,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  Settings
} from 'lucide-react';
import '../Styles/PageStyles/ManageUsersPage.css';
import Navbar from '../Components/Navbar'

const ManageUsersPage = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingUser, setDeletingUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRequests: 0,
    pendingRequests: 0,
    activeAdmins: 0
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    console.log('AuthContext state:', { authLoading, isAdmin, user });
    if (!authLoading) {
      if (isAdmin) {
        console.log('User is admin, fetching data...');
        fetchData();
      } else {
        console.log('User is not admin, showing access denied');
        setError('Access denied. Admin privileges required.');
        setLoading(false);
      }
    }
  }, [isAdmin, authLoading]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, requestsData] = await Promise.all([
        fetchUsers(),
        fetchRequests()
      ]);
      
      // Update stats with the actual fetched data
      updateStats(usersData, requestsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5000/admin/users', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        return data.users; // Return the users data
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users.');
      return [];
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await fetch('http://localhost:5000/admin/requests', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
        return data.requests; 
      } else {
        throw new Error('Failed to fetch requests');
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      setError('Failed to fetch requests.');
      return [];
    }
  };

  const updateStats = (usersList, requestsList) => {
    const totalUsers = usersList.length;
    const totalRequests = requestsList.length;
    const pendingRequests = requestsList.filter(r => r.status === 'pending').length;
    const activeAdmins = usersList.filter(u => u.isAdmin).length;

    setStats({
      totalUsers,
      totalRequests,
      pendingRequests,
      activeAdmins
    });
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [usersData, requestsData] = await Promise.all([
        fetchUsers(),
        fetchRequests()
      ]);
      
      // Update stats with the fresh data
      updateStats(usersData, requestsData);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setDeletingUser(userToDelete.id);
      const response = await fetch('http://localhost:5000/admin/delete_user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId: userToDelete.id })
      });
      
      if (response.ok) {
        const updatedUsers = users.filter(u => u.id !== userToDelete.id);
        setUsers(updatedUsers);
        updateStats(updatedUsers, requests);
        setShowDeleteConfirm(false);
        setUserToDelete(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    } finally {
      setDeletingUser(null);
    }
  };

  const cancelDeleteUser = () => {
    setShowDeleteConfirm(false);
    setUserToDelete(null);
  };


  const handleRejectRequest = async (request) => {
    try {
      setProcessingRequest(request.id);
      const response = await fetch('http://localhost:5000/admin/reject_user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ requestId: request.id })
      });
      
      if (response.ok) {
        const updatedRequests = requests.filter(r => r.id !== request.id);
        setRequests(updatedRequests);
        updateStats(users, updatedRequests);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject user');
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('Failed to reject user');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleApproveRequest = async (request) => {
    try {
      setProcessingRequest(request.id);
      const response = await fetch('http://localhost:5000/admin/approve_user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          requestId: request.id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Open Gmail compose URL in new tab
        if (data.gmail_compose_url) {
          window.open(data.gmail_compose_url, '_blank');
        }
        
        // Update the request status to approved
        const updatedRequests = requests.map(r => 
          r.id === request.id ? { ...r, status: 'approved' } : r
        );
        setRequests(updatedRequests);
        updateStats(users, updatedRequests);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve user');
      }
    } catch (error) {
      console.error('Error approving user:', error);
      alert('Failed to approve user');
    } finally {
      setProcessingRequest(null);
    }
  };

  const getSortedAndFilteredUsers = () => {
    let filtered = users.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort users
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'sessions':
          return b.sessions - a.sessions;
        case 'admin':
          return (b.isAdmin ? 1 : 0) - (a.isAdmin ? 1 : 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getSortedAndFilteredRequests = () => {
    let filtered = requests.filter(request => 
      request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(request => request.status === filterStatus);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return filtered;
  };

  const filteredUsers = getSortedAndFilteredUsers();
  const filteredRequests = getSortedAndFilteredRequests();

  if (authLoading) {
    return (
      <div className="manage-users-page">
        <div className="loading-container">
          <div className="loading-spinner">
            <Shield size={48} className="spinner-icon" />
            <div className="spinner-ring"></div>
          </div>
          <h3>Verifying Admin Access</h3>
          <p>Please wait while we check your permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="manage-users-page">
        <div className="access-denied">
          <div className="access-denied-icon">
            <Shield size={80} color="#ef4444" />
            <div className="access-denied-glow"></div>
          </div>
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
          <div className="access-denied-actions">
            <button onClick={() => navigate('/home')} className="back-btn">
              Go Back
            </button>
            <button onClick={() => navigate('/profile')} className="profile-btn">
              <Settings size={16} />
              Manage Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="manage-users-page">
        <div className="loading-container">
          <div className="loading-spinner">
            <Activity size={48} className="spinner-icon" />
            <div className="spinner-ring"></div>
          </div>
          <h3>Loading Admin Dashboard</h3>
          <p>Fetching user data and requests...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <Navbar />
    <div className="manage-users-page">
      {/* Header Section */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>
              <Crown size={32} className="header-icon" />
              Admin Dashboard
            </h1>
            <p>Manage users and account requests with full administrative control</p>
          </div>
          <div className="header-actions">
            <button 
              className="refresh-btn"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw size={20} className={loading ? 'spinning' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon users-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalUsers}</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon requests-icon">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalRequests}</h3>
            <p>Total Requests</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon pending-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.pendingRequests}</h3>
            <p>Pending Requests</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon admin-icon">
            <Crown size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.activeAdmins}</h3>
            <p>Active Admins</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="tab-container">
          <div className="tab-header">
            <div className="tab-buttons">
              <button 
                className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Users size={20} />
                Users ({users.length})
              </button>
              <button 
                className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                onClick={() => setActiveTab('requests')}
              >
                <AlertTriangle size={20} />
                Requests ({requests.length})
              </button>
            </div>
            
            <div className="controls">
              <div className="search-container">
                <div className="search-box">
                  <Search size={20} />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{width: '500px'}}
                  />
                </div>
              </div>
              
              {activeTab === 'users' && (
                <div className="sort-controls">
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="sort-select"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="sessions">Sort by Sessions</option>
                    <option value="admin">Sort by Admin Status</option>
                  </select>
                </div>
              )}
              
              {activeTab === 'requests' && (
                <div className="filter-controls">
                  <button 
                    className={`filter-btn ${showFilters ? 'active' : ''}`}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter size={16} />
                    Filter
                  </button>
                  {showFilters && (
                    <div className="filter-dropdown">
                      <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="filter-select"
                      >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="users-tab">
              {filteredUsers.length === 0 ? (
                <div className="empty-state">
                  <Users size={64} color="#94a3b8" />
                  <h3>No Users Found</h3>
                  <p>{searchTerm ? 'Try adjusting your search terms' : 'No users have been registered yet'}</p>
                </div>
              ) : (
                <div className="users-grid">
                  {filteredUsers.map((user, index) => (
                    <div key={user.id} className="user-card" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div className="user-info">
                        <div className="user-header">
                          <div className="user-avatar">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="user-details">
                            <h3>{user.name}</h3>
                            <div className="user-badges">
                              {user.isCurrentUser && <span className="current-user">You</span>}
                              {user.isAdmin && <span className="admin-badge">Admin</span>}
                            </div>
                          </div>
                        </div>
                        <div className="user-meta">
                          <div className="user-email">
                            <Mail size={14} />
                            {user.email}
                          </div>
                          <div className="user-sessions">
                            <Activity size={14} />
                            {user.sessions} sessions
                          </div>
                        </div>
                      </div>
                      <div className="user-actions">
                        {!user.isCurrentUser && (
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingUser === user.id}
                            title="Delete User"
                          >
                            {deletingUser === user.id ? (
                              <div className="spinner-small"></div>
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="requests-tab">
              {filteredRequests.length === 0 ? (
                <div className="empty-state">
                  <AlertTriangle size={64} color="#94a3b8" />
                  <h3>No Requests Found</h3>
                  <p>{searchTerm || filterStatus !== 'all' ? 'Try adjusting your search or filter' : 'No pending requests at the moment'}</p>
                </div>
              ) : (
                <div className="requests-grid">
                  {filteredRequests.map((request, index) => (
                    <div key={request.id} className="request-card" style={{ animationDelay: `${index * 0.1}s` }}>
                      <div className="request-info">
                        <div className="request-header">
                          <div className="request-avatar">
                            {request.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="request-details">
                            <h3>{request.name}</h3>
                            <span className={`status-badge ${request.status}`}>
                              {request.status === 'pending' && <Clock size={14} />}
                              {request.status === 'approved' && <CheckCircle size={14} />}
                              {request.status === 'rejected' && <XCircle size={14} />}
                              {request.status}
                            </span>
                          </div>
                        </div>
                        <div className="request-meta">
                          <div className="request-email">
                            <Mail size={14} />
                            {request.email}
                          </div>
                          {request.timestamp && (
                            <div className="request-timestamp">
                              <Calendar size={14} />
                              {new Date(request.timestamp).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {request.message && (
                          <div className="request-message">
                            <p>{request.message}</p>
                          </div>
                        )}
                      </div>
                      {request.status === 'pending' && (
                        <div className="request-actions">
                          <button
                            className="approve-btn"
                            onClick={() => handleApproveRequest(request)}
                            disabled={processingRequest === request.id}
                            title="Approve Request"
                          >
                            {processingRequest === request.id ? (
                              <div className="spinner-small"></div>
                            ) : (
                              <UserCheck size={16} />
                            )}
                            Approve
                          </button>
                          <button
                            className="reject-btn"
                            onClick={() => handleRejectRequest(request)}
                            disabled={processingRequest === request.id}
                            title="Reject Request"
                          >
                            {processingRequest === request.id ? (
                              <div className="spinner-small"></div>
                            ) : (
                              <UserX size={16} />
                            )}
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-confirm-modal">
          <div className="delete-confirm-content">
            <div className="delete-confirm-header">
              <div className="modal-icon">
                <AlertTriangle size={32} color="#ef4444" />
              </div>
              <h3>Delete User</h3>
            </div>
            <div className="delete-confirm-body">
              <p>
                Are you sure you want to delete <strong>{userToDelete?.name}</strong>?
              </p>
              <p>This action cannot be undone. All user data and files will be permanently deleted.</p>
            </div>
            <div className="delete-confirm-actions">
              <button className="cancel-btn" onClick={cancelDeleteUser}>
                Cancel
              </button>
              <button className="confirm-delete-btn" onClick={confirmDeleteUser}>
                <Trash2 size={16} />
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default ManageUsersPage; 