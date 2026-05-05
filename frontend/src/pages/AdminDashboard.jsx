import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import AlertPanel from '../components/AlertPanel';
import DetectionLog from '../components/DetectionLog';
import StatsChart from '../components/StatsChart';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, active: 0, anomaly: 0 });
  const [logFilter, setLogFilter] = useState({ type: '', page: 1 });
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/me').catch(() => navigate('/admin/login'));
  }, [navigate]);

  useEffect(() => {
    Promise.all([
      api.get('/cctv/list'),
      api.get('/logs?limit=1'),
    ]).then(([cctvRes, logRes]) => {
      const cctvs = cctvRes.data;
      setStats({
        total: cctvs.length,
        active: cctvs.filter((c) => c.status === 'active').length,
        anomaly: logRes.data.total,
      });
    }).catch(console.error);
  }, []);

  const logout = async () => {
    await api.post('/admin/logout');
    navigate('/admin/login');
  };

  const StatCard = ({ label, value, color }) => (
    <div style={{
      background: '#141824', border: '1px solid #1e2130', borderRadius: 10,
      padding: '20px 28px', flex: '1 1 160px',
    }}>
      <p style={{ color: '#718096', fontSize: 12, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 800, color: color || '#e2e8f0' }}>{value}</p>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>관제 대시보드</h1>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ background: '#2d3748', color: '#94a3b8', fontSize: 13 }}>
          로그아웃
        </button>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard label="전체 CCTV" value={stats.total} />
        <StatCard label="활성 CCTV" value={stats.active} color="#68d391" />
        <StatCard label="누적 이상징후" value={stats.anomaly} color="#fc8181" />
      </div>

      {/* 알림 + 차트 */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 360px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>실시간 알림</h3>
          <AlertPanel />
        </div>
        <div style={{ flex: '2 1 480px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>시간대별 감지 현황</h3>
          <StatsChart />
        </div>
      </div>

      {/* 로그 테이블 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>이상징후 로그</h3>
          <select
            value={logFilter.type}
            onChange={(e) => setLogFilter({ type: e.target.value, page: 1 })}
            style={{
              background: '#1e2130', border: '1px solid #2d3748', color: '#e2e8f0',
              borderRadius: 6, padding: '6px 10px', fontSize: 13,
            }}
          >
            <option value="">전체 유형</option>
            <option value="fire">화재</option>
            <option value="smoke">연기</option>
            <option value="stopped_vehicle">정차차량</option>
            <option value="congestion">차량정체</option>
          </select>
        </div>
        <DetectionLog filter={logFilter} showCctvName />
      </div>
    </div>
  );
}
