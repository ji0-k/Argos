import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../utils/api';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('아이디와 비밀번호를 모두 입력하세요.');
      return;
    }
    try {
      setLoading(true);
      const res = await adminApi.login(username, password);
      localStorage.setItem('adminToken', res.data.token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '72px', height: '72px',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: 'var(--shadow-glow-blue)',
            fontSize: '2rem',
          }}>
            🔐
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>관리자 로그인</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            TunnelGuard 관제 시스템에 접속합니다
          </p>
        </div>

        {/* 폼 카드 */}
        <div className="card" style={{ padding: '32px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                아이디
              </label>
              <input
                id="input-username"
                type="text"
                className="input"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                비밀번호
              </label>
              <input
                id="input-password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                color: 'var(--accent-red)',
                fontSize: '0.875rem',
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              id="btn-login"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
            >
              {loading
                ? <><span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> 로그인 중...</>
                : '로그인'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
