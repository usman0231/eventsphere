import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, animate, useMotionValue } from 'framer-motion';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement, Filler,
} from 'chart.js';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import api from '../../utils/api';
import { downloadCSV, dateStamp } from '../../utils/export';
import AdminCharts from '../../components/AdminCharts';
import { useAuth } from '../../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement, Filler);

const statusColor = { draft:'#888', published:'#7b2ff7', ongoing:'#00d4ff', completed:'#00ff88', cancelled:'#ff006e' };

function CountUp({ value }) {
  const mv = useMotionValue(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const controls = animate(mv, target, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setN(Math.round(v)),
    });
    return controls.stop;
  }, [value, mv]);
  return <>{n.toLocaleString('en-US')}</>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const isAdmin = role === 'admin';
  const isOrganizer = role === 'organizer';
  const isExhibitor = role === 'exhibitor';

  const [analytics, setAnalytics] = useState(null);
  const [myExpos, setMyExpos] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      if (isAdmin || isOrganizer) {
        const analyticsRes = await api.get('/api/analytics/dashboard');
        setAnalytics(analyticsRes.data.data);
      }
      if (isOrganizer) {
        const exposRes = await api.get('/api/expos/my/organized');
        setMyExpos(exposRes.data.data);
      }
      if (isExhibitor) {
        const appsRes = await api.get('/api/exhibitors/my');
        setMyApplications(appsRes.data.data);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ── Admin exports ──
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('EventSphere Analytics Report', 14, 20);
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    if (analytics) {
      doc.autoTable({
        startY: 40,
        head: [['Metric', 'Value']],
        body: [
          ['Total Expos', analytics.totalExpos],
          ['Total Users', analytics.totalUsers],
          ['Total Booths', analytics.totalBooths],
          ['Total Applications', analytics.totalApplications],
        ],
        theme: 'grid',
        headStyles: { fillColor: [123, 47, 247] },
      });
    }
    doc.save(`eventsphere-report-${dateStamp()}.pdf`);
  };

  const exportUsersCSV = async () => {
    try {
      const { data } = await api.get('/api/auth/users');
      const users = data.data || [];
      if (!users.length) { toast.info('No users to export'); return; }
      downloadCSV(`users-${dateStamp()}`, users, [
        { label: 'Name', accessor: 'name' },
        { label: 'Email', accessor: 'email' },
        { label: 'Role', accessor: 'role' },
        { label: 'Company', accessor: 'company' },
        { label: 'Joined', accessor: u => dayjs(u.createdAt).format('YYYY-MM-DD') },
      ]);
      toast.success(`Exported ${users.length} users`);
    } catch (err) {
      toast.error('Failed to export users');
    }
  };

  const exportExposCSV = async () => {
    try {
      const { data } = await api.get('/api/expos?limit=1000');
      const expos = data.data || [];
      if (!expos.length) { toast.info('No expos to export'); return; }
      downloadCSV(`expos-${dateStamp()}`, expos, [
        { label: 'Title', accessor: 'title' },
        { label: 'Status', accessor: 'status' },
        { label: 'Category', accessor: 'category' },
        { label: 'Start', accessor: e => dayjs(e.startDate).format('YYYY-MM-DD') },
        { label: 'End', accessor: e => dayjs(e.endDate).format('YYYY-MM-DD') },
        { label: 'Venue', accessor: e => e.location?.venue || '' },
        { label: 'City', accessor: e => e.location?.city || '' },
        { label: 'Entry Fee', accessor: e => e.entryFee || 0 },
        { label: 'Max Attendees', accessor: 'maxAttendees' },
        { label: 'Organizer', accessor: e => e.organizer?.name || '' },
      ]);
      toast.success(`Exported ${expos.length} expos`);
    } catch (err) {
      toast.error('Failed to export expos');
    }
  };

  // ── Organizer chart configs (ported from the old dashboard) ──
  const boothChartData = analytics?.boothStats ? {
    labels: analytics.boothStats.map(b => b._id),
    datasets: [{ data: analytics.boothStats.map(b => b.count), backgroundColor: ['#00d4ff','#ffb300','#7b2ff7','#ff006e'], borderWidth: 0 }],
  } : null;

  const userChartData = analytics?.userRoles ? {
    labels: analytics.userRoles.map(r => r._id),
    datasets: [{ label:'Users', data: analytics.userRoles.map(r => r.count), backgroundColor: ['rgba(123,47,247,0.8)','rgba(255,0,110,0.8)','rgba(0,212,255,0.8)','rgba(255,107,53,0.8)'], borderRadius: 8, borderWidth: 0 }],
  } : null;

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color:'rgba(240,240,255,0.7)', font:{ family:'DM Sans' } } } },
    scales: { x: { ticks:{ color:'rgba(240,240,255,0.5)' }, grid:{ color:'rgba(255,255,255,0.05)' } }, y: { ticks:{ color:'rgba(240,240,255,0.5)' }, grid:{ color:'rgba(255,255,255,0.05)' }, beginAtZero:true } },
  };
  const doughnutOptions = {
    responsive: true,
    plugins: { legend: { position:'bottom', labels:{ color:'rgba(240,240,255,0.7)', font:{ family:'DM Sans' }, padding:16 } } },
  };

  return (
    <div className="admin-page">
      <div className="admin-orb admin-orb-1" />
      <div className="admin-orb admin-orb-2" />
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <p className="admin-tag">{isAdmin ? 'Administration' : 'Dashboard'}</p>
            <h1 className="admin-title">
              {isAdmin ? 'Dashboard' : <>Welcome back, {user?.name} 👋</>}
            </h1>
            <p className="admin-subtitle">
              {isAdmin ? 'System overview and platform management' : "Here's what's happening with your events today."}
            </p>
          </div>
          <div className="admin-export-group">
            {isAdmin && <button className="admin-export-btn" onClick={exportPDF} disabled={loading} title="Analytics PDF report">📄 PDF</button>}
            {isAdmin && <button className="admin-export-btn" onClick={exportUsersCSV} disabled={loading} title="Export all users">👥 Users CSV</button>}
            {isAdmin && <button className="admin-export-btn" onClick={exportExposCSV} disabled={loading} title="Export all expos">🎪 Expos CSV</button>}
            {isOrganizer && <button className="admin-export-btn" onClick={() => navigate('/expos/create')}>+ Create Expo</button>}
          </div>
        </div>

        {loading ? (
          <div className="admin-loading">Loading data...</div>
        ) : (
          <>
            {/* ── ADMIN: platform-wide overview ── */}
            {isAdmin && analytics && (
              <>
                <div className="admin-stats-grid">
                  {[
                    { icon:'🎪', label:'Total Expos', value:analytics.totalExpos, color:'#7b2ff7' },
                    { icon:'👥', label:'Total Users', value:analytics.totalUsers, color:'#ff006e' },
                    { icon:'🏪', label:'Total Booths', value:analytics.totalBooths, color:'#00d4ff' },
                    { icon:'📋', label:'Applications', value:analytics.totalApplications, color:'#ff6b35' },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      className="admin-stat-card"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="admin-stat-icon" style={{ background:`${stat.color}18`, border:`1px solid ${stat.color}35`, color:stat.color }}>{stat.icon}</div>
                      <div>
                        <div className="admin-stat-value" style={{ color:stat.color }}><CountUp value={stat.value} /></div>
                        <div className="admin-stat-label">{stat.label}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="admin-overview">
                  <div className="admin-section-title">Recent Expos</div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr><th>Title</th><th>Organizer</th><th>Status</th><th>Created</th></tr>
                      </thead>
                      <tbody>
                        {analytics.recentExpos?.map(expo => (
                          <tr key={expo._id}>
                            <td className="admin-td-title">{expo.title}</td>
                            <td>{expo.organizer?.name || 'N/A'}</td>
                            <td><span className="admin-status-badge">{expo.status}</span></td>
                            <td>{dayjs(expo.createdAt).format('MMM D, YYYY')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <AdminCharts
                    booths={analytics.boothStats || []}
                    roles={analytics.userRoles || []}
                    applications={analytics.applicationStats || []}
                  />
                </div>
              </>
            )}

            {/* ── ORGANIZER: their events overview (ported from old dashboard) ── */}
            {isOrganizer && analytics && (
              <>
                <div className="dash-stats-grid">
                  {[
                    { icon:'🎪', label:'Total Expos', value:analytics.totalExpos, color:'#7b2ff7' },
                    { icon:'🎟️', label:'Check-Ins', value:analytics.totalAttendance || 0, color:'#00ff88' },
                    { icon:'🏪', label:'Total Booths', value:analytics.totalBooths, color:'#00d4ff' },
                    { icon:'📋', label:'Applications', value:analytics.totalApplications, color:'#ff6b35' },
                    { icon:'💰', label:'Revenue', value:`$${(analytics.totalRevenue || 0).toLocaleString()}`, color:'#ffb300' },
                  ].map(stat => (
                    <div key={stat.label} className="dash-stat-card">
                      <div className="dash-stat-icon" style={{ background:`${stat.color}20`, border:`1px solid ${stat.color}40` }}>{stat.icon}</div>
                      <div>
                        <div className="dash-stat-value" style={{ color:stat.color }}>{stat.value}</div>
                        <div className="dash-stat-label">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {analytics.attendanceOverTime?.length > 0 && (
                  <div className="dash-chart-card dash-chart-wide">
                    <h3 className="dash-card-title">📈 Check-Ins (Last 14 Days)</h3>
                    <Line
                      data={{
                        labels: analytics.attendanceOverTime.map(d => dayjs(d._id).format('MMM D')),
                        datasets: [{
                          label: 'Check-ins',
                          data: analytics.attendanceOverTime.map(d => d.count),
                          borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.15)',
                          tension: 0.35, fill: true, pointBackgroundColor: '#00ff88', pointRadius: 4,
                        }],
                      }}
                      options={chartOptions}
                    />
                  </div>
                )}

                <div className="dash-charts-grid">
                  {boothChartData && (
                    <div className="dash-chart-card">
                      <h3 className="dash-card-title">Booth Status</h3>
                      <Doughnut data={boothChartData} options={doughnutOptions} />
                    </div>
                  )}
                  {userChartData && (
                    <div className="dash-chart-card">
                      <h3 className="dash-card-title">Users by Role</h3>
                      <Bar data={userChartData} options={chartOptions} />
                    </div>
                  )}
                  {analytics.peakHours?.length > 0 && (
                    <div className="dash-chart-card">
                      <h3 className="dash-card-title">⏰ Peak Check-In Hours</h3>
                      <Bar
                        data={{
                          labels: analytics.peakHours.map(h => `${h._id}:00`),
                          datasets: [{ label: 'Check-ins', data: analytics.peakHours.map(h => h.count), backgroundColor: 'rgba(0,212,255,0.65)', borderRadius: 6 }],
                        }}
                        options={chartOptions}
                      />
                    </div>
                  )}
                </div>

                {analytics.topExpos?.length > 0 && (
                  <div className="dash-chart-card dash-chart-wide" style={{ marginTop: 24 }}>
                    <h3 className="dash-card-title">🏆 Top Expos by Attendance</h3>
                    <div className="dash-top-list">
                      {analytics.topExpos.map((e, i) => (
                        <div key={e._id} className="dash-top-row">
                          <span className="dash-top-rank">#{i+1}</span>
                          <span className="dash-top-name">{e.title}</span>
                          <span className="dash-top-meta">{e.attendees} check-ins{e.entryFee > 0 ? ` · $${e.revenue.toLocaleString()} revenue` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h2 className="dash-section-title">My Expos</h2>
                <div className="dash-expos-grid">
                  {myExpos.length === 0 ? (
                    <div className="dash-empty">
                      <span>🎪</span>
                      <p>No expos yet. Create your first one!</p>
                      <button className="dash-btn-primary" onClick={() => navigate('/expos/create')}>Create Expo</button>
                    </div>
                  ) : myExpos.map(expo => (
                    <div key={expo._id} className="dash-expo-card" onClick={() => navigate(`/expos/${expo._id}`)}>
                      <div className="dash-expo-status" style={{ background:`${statusColor[expo.status]}20`, color:statusColor[expo.status], borderColor:`${statusColor[expo.status]}40` }}>{expo.status}</div>
                      <h4 className="dash-expo-title">{expo.title}</h4>
                      <p className="dash-expo-meta">📅 {dayjs(expo.startDate).format('MMM D, YYYY')}</p>
                      <p className="dash-expo-meta">📍 {expo.location?.venue}</p>
                      <div className="dash-expo-actions">
                        <button onClick={e => { e.stopPropagation(); navigate(`/expos/${expo._id}/booths`); }} className="dash-expo-btn">Booths</button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/expos/${expo._id}/sessions`); }} className="dash-expo-btn">Sessions</button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/expos/${expo._id}/sponsors`); }} className="dash-expo-btn">Sponsors</button>
                        <button onClick={e => { e.stopPropagation(); navigate(`/expos/${expo._id}/edit`); }} className="dash-expo-btn">Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── EXHIBITOR: their applications (ported from old dashboard) ── */}
            {isExhibitor && (
              <>
                <h2 className="dash-section-title">My Applications</h2>
                {myApplications.length === 0 ? (
                  <div className="dash-empty-full">
                    <span className="dash-empty-icon">🏪</span>
                    <h3>No Applications Yet</h3>
                    <p>Apply for an expo to start showcasing your products</p>
                    <button className="dash-btn-primary" onClick={() => navigate('/expos')}>Browse Expos</button>
                  </div>
                ) : (
                  <div className="dash-expos-grid">
                    {myApplications.map(app => (
                      <div key={app._id} className="dash-expo-card">
                        <div className="dash-expo-status" style={{ background: app.status==='approved'?'rgba(0,255,136,0.15)':app.status==='rejected'?'rgba(255,0,110,0.15)':'rgba(255,179,0,0.15)', color: app.status==='approved'?'#00ff88':app.status==='rejected'?'#ff006e':'#ffb300', borderColor: app.status==='approved'?'rgba(0,255,136,0.3)':app.status==='rejected'?'rgba(255,0,110,0.3)':'rgba(255,179,0,0.3)' }}>{app.status}</div>
                        <h4 className="dash-expo-title">{app.expo?.title}</h4>
                        <p className="dash-expo-meta">{app.companyName}</p>
                        {app.assignedBooth && <p className="dash-expo-meta" style={{color:'#00d4ff'}}>🏪 Booth: {app.assignedBooth.boothNumber}</p>}
                        {app.rejectionReason && <p className="dash-expo-meta" style={{color:'#ff80ab'}}>Reason: {app.rejectionReason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── ATTENDEE: explore CTA (ported from old dashboard) ── */}
            {role === 'attendee' && (
              <div className="dash-attendee">
                <div className="dash-attendee-icon">🎟️</div>
                <h2 className="dash-attendee-title">Explore Upcoming Expos</h2>
                <p className="dash-attendee-sub">Discover exhibitions, register for sessions, and connect with exhibitors</p>
                <button className="dash-btn-primary" onClick={() => navigate('/expos')}>Browse Expos →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
