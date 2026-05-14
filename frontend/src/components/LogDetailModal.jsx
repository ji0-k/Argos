import { useEffect } from 'react';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const TYPE_CONFIG = {
  fire:            { icon: '🔥', text: '화재 감지',     color: 'var(--accent-red)' },
  smoke:           { icon: '💨', text: '연기 감지',     color: 'var(--text-secondary)' },
  stopped_vehicle: { icon: '🚗', text: '정차차량 감지', color: 'var(--accent-yellow)' },
  congestion:      { icon: '🚦', text: '차량정체 감지', color: 'var(--accent-orange)' },
};

function formatDateTime(isoStr) {
  try {
    return new Date(isoStr).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

function InfoBox({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: accent || 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

export default function LogDetailModal({ log, onClose }) {
  const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.fire;

  // log_id: AlertPanel에서 'db-N' 형태로 덮어쓴 경우 대비, 원본 numeric ID 보존
  const numericId = log.log_id ?? (typeof log.id === 'number' ? log.id : null);
  const snapshotUrl = numericId ? `${BASE_URL}/api/logs/${numericId}/snapshot` : null;

  const confidencePct = (log.confidence * 100).toFixed(1);
  const confidenceColor = log.confidence > 0.8
    ? 'var(--accent-red)'
    : log.confidence > 0.5
    ? 'var(--accent-yellow)'
    : 'var(--accent-green)';

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{cfg.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: cfg.color }}>{cfg.text}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {log.cctv_name || `CCTV #${log.cctv_id}`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              fontSize: '1.4rem', cursor: 'pointer',
              color: 'var(--text-muted)', lineHeight: 1, padding: '4px',
            }}
          >×</button>
        </div>

        {/* 스냅샷 */}
        <div style={{ background: '#0f172a', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt="감지 스냅샷"
              style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', display: 'block' }}
              onError={e => {
                e.target.style.display = 'none';
                e.target.parentNode.querySelector('.no-snapshot').style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="no-snapshot"
            style={{
              display: snapshotUrl ? 'none' : 'flex',
              flexDirection: 'column', alignItems: 'center', gap: '10px',
              color: '#475569', padding: '48px',
            }}
          >
            <span style={{ fontSize: '3rem' }}>📷</span>
            <span style={{ fontSize: '0.875rem' }}>저장된 스냅샷이 없습니다</span>
          </div>
        </div>

        {/* 상세 정보 */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <InfoBox label="감지 CCTV" value={log.cctv_name || `CCTV #${log.cctv_id}`} />
            <InfoBox label="감지 시각" value={formatDateTime(log.detected_at)} />
            <InfoBox label="감지 유형" value={`${cfg.icon} ${cfg.text}`} />
            <InfoBox label="신뢰도" value={`${confidencePct}%`} accent={confidenceColor} />
          </div>

          {/* 신뢰도 바 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span>신뢰도</span>
              <span style={{ color: confidenceColor, fontWeight: 600 }}>{confidencePct}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${confidencePct}%`,
                background: confidenceColor,
                borderRadius: '4px',
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
