import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import CctvList from './pages/CctvList';
import CctvStream from './pages/CctvStream';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

const NAV_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  padding: '0 24px',
  height: 56,
  background: '#0a0d14',
  borderBottom: '1px solid #1e2130',
  position: 'sticky',
  top: 0,
  zIndex: 100,
};

function Nav() {
  const loc = useLocation();
  const linkStyle = (path) => ({
    color: loc.pathname.startsWith(path) ? '#4299e1' : '#94a3b8',
    fontWeight: 600,
    fontSize: 14,
  });
  return (
    <nav style={NAV_STYLE}>
      <span style={{ fontWeight: 800, fontSize: 18, color: '#4299e1', marginRight: 16 }}>
        🔭 Argos
      </span>
      <Link to="/" style={linkStyle('/')}>CCTV 목록</Link>
      <Link to="/admin/dashboard" style={linkStyle('/admin')}>관제 대시보드</Link>
      <div style={{ flex: 1 }} />
      <Link to="/admin/login" style={{ fontSize: 13, color: '#718096' }}>관리자</Link>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<CctvList />} />
        <Route path="/cctv/:id" element={<CctvStream />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
