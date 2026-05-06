import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import CctvList from './pages/CctvList';
import CctvStream from './pages/CctvStream';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ToastNotification from './components/ToastNotification';

/* ── Private Route ── */
function PrivateRoute({ children }) {
  const token = localStorage.getItem('adminToken');
  return token ? children : <Navigate to="/admin/login" replace />;
}

/* ── Navbar ── */
function Navbar() {
  const token = localStorage.getItem('adminToken');

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#grad)" />
            <path d="M6 20 L14 8 L22 20" stroke="white" strokeWidth="2.5" strokeLinejoin="round" fill="none"/>
            <circle cx="14" cy="15" r="2.5" fill="white"/>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#3b82f6"/>
                <stop offset="1" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
          <span>TunnelGuard</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            📹 CCTV 목록
          </Link>
          {token ? (
            <>
              <Link to="/admin/dashboard" className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                🖥 관제 대시보드
              </Link>
              <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                로그아웃
              </button>
            </>
          ) : (
            <Link to="/admin/login" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              관리자 로그인
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ── App ── */
export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <ToastNotification />
      <Routes>
        <Route path="/" element={<CctvList />} />
        <Route path="/cctv/:id" element={<CctvStream />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
