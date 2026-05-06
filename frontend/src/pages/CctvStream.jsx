import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { cctvApi, logsApi } from '../utils/api';
import { subscribeToAlerts } from '../utils/socket';
import DetectionLog from '../components/DetectionLog';

const TYPE_LABEL = {
  fire: { text: '🔥 화재', cls: 'badge-fire' },
  smoke: { text: '💨 연기', cls: 'badge-smoke' },
  stopped_vehicle: { text: '🚗 정차차량', cls: 'badge-stopped' },
  congestion: { text: '🚦 차량정체', cls: 'badge-congestion' },
  normal: { text: '✅ 정상', cls: 'badge-active' },
};

export default function CctvStream() {
  const { id } = useParams();
  const cctvId = parseInt(id, 10);

  const [cctv, setCctv] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [latestResult, setLatestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const streamRef = useRef(null);

  useEffect(() => {
    fetchCctv();
    fetchLogs();

    const unsubscribe = subscribeToAlerts((alertData) => {
      if (alertData.cctv_id === cctvId) {
        setLatestResult(alertData);
        fetchLogs();
      }
    });
    return unsubscribe;
  }, [cctvId]);

  const fetchCctv = async () => {
    try {
      const res = await cctvApi.getList();
      const found = res.data.find(c => c.id === cctvId);
      setCctv(found || null);
    } catch {}
  };

  const fetchLogs = async () => {
    try {
      const res = await logsApi.getByCctv(cctvId, 1, 10);
      setLogs(res.data.logs);
      setLogsTotal(res.data.total);
    } catch {}
  };

  const handleStartDetection = async () => {
    try {
      setLoading(true);
      const res = await cctvApi.startDetection(cctvId);
      setSessionId(res.data.session_id);
      setDetecting(true);
    } catch (err) {
      alert('감지 시작에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopDetection = async () => {
    try {
      setLoading(true);
      await cctvApi.stopDetection(cctvId, sessionId);
      setDetecting(false);
      setSessionId(null);
      setLatestResult(null);
      fetchLogs();
    } catch (err) {
      alert('감지 종료에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const streamUrl = cctvApi.getStreamUrl(cctvId);
  const resultInfo = latestResult ? TYPE_LABEL[latestResult.type] : null;

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', padding: '32px 24px' }}>
      <div className="container">
        {/* 브레드크럼 */}
        <div style={{ marginBottom: '20px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <Link to="/">CCTV 목록</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <span style={{ color: 'var(--text-primary)' }}>{cctv?.name || `CCTV #${cctvId}`}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
          {/* 왼쪽: 스트리밍 + 컨트롤 */}
          <div>
            {/* 스트림 뷰 */}
            <div style={{
              position: 'relative',
              background: '#000',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: `2px solid ${detecting ? 'var(--accent-blue)' : 'var(--border)'}`,
              boxShadow: detecting ? 'var(--shadow-glow-blue)' : 'none',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}>
              <img
                ref={streamRef}
                src={streamUrl}
                alt="CCTV 스트림"
                style={{ width: '100%', display: 'block', maxHeight: '500px', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />

              {/* 감지 상태 오버레이 */}
              {detecting && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                }}>
                  <div style={{
                    width: '8px', height: '8px',
                    background: 'var(--accent-red)',
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite',
                  }} />
                  <span style={{ color: 'white' }}>AI 감지 중</span>
                </div>
              )}

              {/* 감지 결과 오버레이 */}
              {resultInfo && latestResult?.type !== 'normal' && (
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span className={`badge ${resultInfo.cls}`}>{resultInfo.text}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    신뢰도: {(latestResult.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* CCTV 정보 */}
            <div className="card" style={{ marginTop: '16px' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                {cctv?.name || `CCTV #${cctvId}`}
              </h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '4px' }}>
                📍 {cctv?.location}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                🗺 {cctv?.region}
              </div>
            </div>

            {/* 감지 컨트롤 */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              {!detecting ? (
                <button
                  id="btn-start-detection"
                  onClick={handleStartDetection}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '14px' }}
                >
                  {loading ? <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : '🚀 감지 시작'}
                </button>
              ) : (
                <button
                  id="btn-stop-detection"
                  onClick={handleStopDetection}
                  disabled={loading}
                  className="btn btn-danger"
                  style={{ flex: 1, justifyContent: 'center', padding: '14px' }}
                >
                  {loading ? <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : '⏹ 감지 종료'}
                </button>
              )}
            </div>
          </div>

          {/* 오른쪽: 최근 감지 로그 */}
          <div>
            <div className="card">
              <h3 style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                최근 감지 로그
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  총 {logsTotal}건
                </span>
              </h3>
              <DetectionLog logs={logs} compact />
              {logs.length === 0 && (
                <div className="empty-state" style={{ padding: '32px' }}>
                  <p style={{ fontSize: '0.875rem' }}>감지 기록이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
