import { useState, useEffect } from 'react';
import '../Styles/PageStyles/UsagePage.css';
import Navbar from '../Components/Navbar';
import ChatButton from '../Components/ChatButton';
import GalleryButton from '../Components/GalleryButton'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function UsagePage() {
    const [usageData, setUsageData] = useState([]);
    const [stats, setStats] = useState({
        totalSessions: 0,
        averageUsage: 0,
        maxUsage: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentMonth, setCurrentMonth] = useState('');

    useEffect(() => {
        fetchUsageData();
        setCurrentMonth(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    }, []);

    const fetchUsageData = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/get_usage_data', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch usage data');
            }

            const data = await response.json();
            setUsageData(data.usage_data || []);
            setStats({
                totalSessions: data.total_sessions || 0,
                averageUsage: data.average_usage || 0,
                maxUsage: data.max_usage || 0
            });
        } catch (error) {
            console.error('Error fetching usage data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-label">{`Day ${label}`}</p>
                    <p className="tooltip-value">
                        <span className="tooltip-dot"></span>
                        {`Usage: ${payload[0].value} sessions`}
                    </p>
                </div>
            );
        }
        return null;
    };


    if (loading) {
        return (
            <>
            <Navbar />
            <div className="usage-page">
                <div className="usage-container">
                    <div className="usage-header">
                        <h1 className="usage-title">Usage Analytics</h1>
                        <p className="usage-subtitle">Loading your usage data...</p>
                    </div>
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                    </div>
                </div>
            </div>
            <ChatButton />
            <GalleryButton />
            </>
        );
    }

    if (error) {
        return (
            <>
            <Navbar />
            <div className="usage-page">
                <div className="usage-container">
                    <div className="usage-header">
                        <h1 className="usage-title">Usage Analytics</h1>
                        <p className="usage-subtitle">Error loading usage data</p>
                    </div>
                    <div className="error-message">
                        <p>{error}</p>
                        <button onClick={fetchUsageData} className="retry-btn">Try Again</button>
                    </div>
                </div>
            </div>
            <ChatButton />
            <GalleryButton />
            </>
        );
    }

    return (
        <>
        <Navbar />
        <div className="usage-page">
            <div className="usage-container">
                {/* Header Section */}
                <div className="usage-header">
                    <h1 className="usage-title">Usage Analytics</h1>
                    <p className="usage-subtitle">
                        Track your learning progress and content generation patterns
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-content">
                            <h3 className="stat-value">{stats.totalSessions}</h3>
                            <p className="stat-label">Total Sessions</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">📈</div>
                        <div className="stat-content">
                            <h3 className="stat-value">{stats.averageUsage}</h3>
                            <p className="stat-label">Daily Average</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">🚀</div>
                        <div className="stat-content">
                            <h3 className="stat-value">{stats.maxUsage}</h3>
                            <p className="stat-label">Peak Day</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">📅</div>
                        <div className="stat-content">
                            <h3 className="stat-value">30</h3>
                            <p className="stat-label">Days Tracked</p>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="chart-section">
                    <div className="chart-header">
                        <h2 className="chart-title">Daily Usage - {currentMonth}</h2>
                        <div className="chart-legend">
                            <span className="legend-item">
                                <span className="legend-dot"></span>
                                Sessions per day
                            </span>
                        </div>
                    </div>

                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart
                                data={usageData}
                                margin={{
                                    top: 20,
                                    right: 30,
                                    left: 20,
                                    bottom: 20,
                                }}
                                barCategoryGap="20%"
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                                <XAxis
                                    dataKey="day"
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar
                                    dataKey="usage"
                                    fill="url(#barGradient)"
                                    radius={[4, 4, 0, 0]}
                                />
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8B5CF6" />
                                        <stop offset="100%" stopColor="#06B6D4" />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="usage-insights">
                    <h3 className="insights-title">Usage Insights</h3>
                    <div className="insights-grid">
                        <div className="insight-item">
                            <div className="insight-icon">💡</div>
                            <div className="insight-content">
                                <h4>Learning Activity</h4>
                                <p>
                                    {stats.totalSessions > 0 
                                        ? `You've completed ${stats.totalSessions} learning sessions in the last 30 days.`
                                        : "Start your learning journey by creating your first script!"
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="insight-item">
                            <div className="insight-icon">⭐</div>
                            <div className="insight-content">
                                <h4>Daily Progress</h4>
                                <p>
                                    {stats.averageUsage > 0 
                                        ? `Your average of ${stats.averageUsage} sessions per day shows consistent learning engagement.`
                                        : "Create your first script to see your learning progress!"
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <ChatButton />
        <GalleryButton />
        </>
    )
}

export default UsagePage
