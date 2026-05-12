import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import CctvList from './pages/CctvList';
import CctvStream from './pages/CctvStream';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function PrivateRoute({ children }) {
  return localStorage.getItem('adminToken') ? children : <Navigate to="/admin/login" replace />;
}

function Navbar() {
  const { pathname } = useLocation();
  const token = localStorage.getItem('adminToken');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const tabs = [
    { label: '실시간 모니터링', path: '/' },
    { label: '관제 대시보드', path: '/admin/dashboard', auth: true },
  ];

  return (
    <header className="nav-header">
      {/* 로고 */}
      <div className="nav-logo">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg,#10b981,#059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14"/>
            <rect x="3" y="8" width="12" height="8" rx="2"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.2, color: '#0f172a' }}>ITS 교통관제</div>
          <div className="nav-logo-sub" style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>Smart City Traffic Control</div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <nav className="nav-tabs">
        {tabs.filter(t => !t.auth || token).map(tab => {
          const active = pathname === tab.path || (tab.path !== '/' && pathname.startsWith(tab.path));
          return (
            <Link
              key={tab.path}
              to={tab.path}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
                color: active ? '#10b981' : '#64748b',
                background: active ? '#f0fdf4' : 'transparent',
                borderBottom: active ? '2px solid #10b981' : '2px solid transparent',
                textDecoration: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* 우측: 시계 + 계정 */}
      <div className="nav-right">
        <div className="nav-clock">
          <div className="nav-date">{dateStr}</div>
          <div style={{ fontWeight: 600, color: '#475569' }}>{timeStr}</div>
        </div>
        {token ? (
          <button
            onClick={() => { localStorage.removeItem('adminToken'); window.location.href = '/'; }}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#f1f5f9', border: '1px solid #e2e8f0',
              cursor: 'pointer', fontSize: '0.75rem', color: '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            title="로그아웃"
          >
            👤
          </button>
        ) : (
          <Link to="/admin/login" className="btn btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            관리자 로그인
          </Link>
        )}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{
      background: '#1e293b', color: '#94a3b8',
      padding: '40px 40px 32px', marginTop: 'auto',
    }}>
      <div className="footer-grid">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 24, height: 24, background: '#10b981', borderRadius: 6 }} />
            <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>ITS 교통관제</span>
          </div>
          <p style={{ fontSize: '0.8rem', lineHeight: 1.7 }}>
            스마트 시티 ITS 실시간 교통 모니터링 시스템.<br />
            경부고속도로 CCTV 영상 기반 AI 감지.
          </p>
        </div>
        {[
          { title: '서비스', items: ['실시간 모니터링', '관제 대시보드'] },
          { title: '지원', items: ['시스템 가이드', 'FAQ'] },
          { title: '정보', items: ['공지사항', '이용약관'] },
        ].map(col => (
          <div key={col.title}>
            <h5 style={{ color: 'white', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
              {col.title}
            </h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.items.map(item => (
                <li key={item} style={{ fontSize: '0.82rem', cursor: 'pointer' }}
                  onMouseEnter={e => e.target.style.color = 'white'}
                  onMouseLeave={e => e.target.style.color = '#94a3b8'}
                >{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<CctvList />} />
          <Route path="/cctv/:id" element={<CctvStream />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
    </BrowserRouter>
  );
}
