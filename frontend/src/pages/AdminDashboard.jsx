import { useState, useEffect } from 'react';
import { cctvApi, logsApi } from '../utils/api';
import { subscribeToAlerts } from '../utils/socket';
import ToastNotification from '../components/ToastNotification';
import AlertPanel from '../components/AlertPanel';
import DetectionLog from '../components/DetectionLog';
import StatsChart from '../components/StatsChart';
import LogDetailModal from '../components/LogDetailModal';
import api from '../utils/api';

export default function AdminDashboard() {
  const [cctvList, setCctvList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [stats, setStats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const LIMIT = 20;

  useEffect(() => {
    fetchAll();
    // WebSocket 알림 구독
    const unsubscribe = subscribeToAlerts((alertData) => {
      setAlerts(prev => [{ ...alertData, id: Date.now() }, ...prev].slice(0, 20));
      // 로그 새로고침
      fetchLogs(1, '');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    fetchLogs(page, filterType);
  }, [page, filterType]);

  const fetchAll = async () => {
    await Promise.all([fetchCctvList(), fetchLogs(1, ''), fetchStats(), fetchRecentAlerts()]);
  };

  const fetchRecentAlerts = async () => {
    try {
      const res = await logsApi.getAll(1, 20);
      // log_id: 모달에서 스냅샷 API 호출에 쓸 numeric ID 보존
      const recent = res.data.logs.map(l => ({ ...l, id: `db-${l.id}`, log_id: l.id }));
      setAlerts(recent);
    } catch {}
  };

  const fetchCctvList = async () => {
    try {
      const res = await cctvApi.getList();
      setCctvList(res.data);
    } catch {}
  };

  const fetchLogs = async (p, type) => {
    try {
      const res = await logsApi.getAll(p, LIMIT, type || null);
      setLogs(res.data.logs);
      setLogsTotal(res.data.total);
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const res = await logsApi.getStats();
      setStats(res.data);
    } catch {}
  };

  /* 요약 통계 */
  const totalCctv = cctvList.length;
  const autoDetectTotal = cctvList.filter(c => c.detection_allowed).length;
  const autoDetectConnected = cctvList.filter(c => c.detection_allowed && c.stream_connected).length;
  const todayAlerts = logs.filter(l => {
    const d = new Date(l.detected_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const SUMMARY_CARDS = [
    { label: '전체 CCTV', value: totalCctv, icon: '📹', color: 'var(--accent-blue)' },
    { label: '실시간 감지', value: `${autoDetectConnected} / ${autoDetectTotal}`, icon: '🟢', color: 'var(--accent-green)' },
    { label: '오늘 이상감지', value: todayAlerts, icon: '⚠️', color: 'var(--accent-yellow)' },
    { label: '전체 로그', value: logsTotal, icon: '📋', color: 'var(--accent-cyan)' },
  ];

  return (
    <>
    <ToastNotification />
    {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    <div className="page-outer" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="container">
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>🖥 관제 대시보드</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              실시간 이상징후 모니터링 · WebSocket 알림 연동
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchAll} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              🔄 새로고침
            </button>
            <button
              onClick={() => api.post('/api/cctv/test-alert').then(() => alert('테스트 알림 전송됨 — 우측 상단 토스트 확인')).catch(e => alert('전송 실패: ' + e))}
              className="btn btn-outline"
              style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: '#f59e0b', color: '#f59e0b' }}
            >
              🧪 WS 테스트
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid-stats">
          {SUMMARY_CARDS.map(card => (
            <div key={card.label} className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{card.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: card.color, lineHeight: 1 }}>
                {card.value}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '6px' }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* 메인 컨텐츠 */}
        <div className="grid-dash">
          {/* 왼쪽 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 통계 차트 */}
            <div className="card">
              <h3 style={{ marginBottom: '20px' }}>📊 시간대별 이상징후 발생 현황</h3>
              <StatsChart data={stats} />
            </div>

            {/* 로그 테이블 */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3>📋 이상징후 로그</h3>
                <div className="filter-bar">
                  {['', 'fire', 'smoke', 'stopped_vehicle', 'congestion'].map(type => (
                    <button
                      key={type}
                      onClick={() => { setFilterType(type); setPage(1); }}
                      className="btn"
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.78rem',
                        background: filterType === type ? 'var(--accent-blue)' : 'transparent',
                        border: `1px solid ${filterType === type ? 'var(--accent-blue)' : 'var(--border)'}`,
                        color: filterType === type ? 'white' : 'var(--text-muted)',
                      }}
                    >
                      {type === '' ? '전체' : type === 'fire' ? '🔥 화재' : type === 'smoke' ? '💨 연기' : type === 'stopped_vehicle' ? '🚗 정차' : '🚦 정체'}
                    </button>
                  ))}
                </div>
              </div>
              <DetectionLog logs={logs} onDetail={setSelectedLog} />
              {/* 페이지네이션 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                <button
                  className="btn btn-outline"
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  이전
                </button>
                <span style={{ lineHeight: '36px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {page} / {Math.max(1, Math.ceil(logsTotal / LIMIT))}
                </span>
                <button
                  className="btn btn-outline"
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  disabled={page >= Math.ceil(logsTotal / LIMIT)}
                  onClick={() => setPage(p => p + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </div>

          {/* 오른쪽: 실시간 알림 패널 */}
          <div>
            <AlertPanel alerts={alerts} onDetail={setSelectedLog} />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
