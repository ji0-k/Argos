import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const TYPE_CONFIG = {
  fire:            { icon: '🔥', text: '화재',     cls: 'badge-fire',       bg: 'rgba(239,68,68,0.08)',      border: 'rgba(239,68,68,0.25)' },
  smoke:           { icon: '💨', text: '연기',     cls: 'badge-smoke',      bg: 'rgba(148,163,184,0.08)',    border: 'rgba(148,163,184,0.2)' },
  stopped_vehicle: { icon: '🚗', text: '정차차량', cls: 'badge-stopped',    bg: 'rgba(245,158,11,0.08)',     border: 'rgba(245,158,11,0.25)' },
  congestion:      { icon: '🚦', text: '차량정체', cls: 'badge-congestion', bg: 'rgba(249,115,22,0.08)',     border: 'rgba(249,115,22,0.25)' },
};

function AlertItem({ alert, onDismiss }) {
  const cfg = TYPE_CONFIG[alert.type] || TYPE_CONFIG.fire;
  const timeAgo = formatDistanceToNow(new Date(alert.detected_at), { addSuffix: true, locale: ko });

  return (
    <div
      className="animate-slide-in"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        position: 'relative',
        marginBottom: '10px',
      }}
    >
      <button
        onClick={() => onDismiss(alert.id)}
        style={{
          position: 'absolute', top: '8px', right: '8px',
          background: 'none', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontSize: '1rem', lineHeight: 1,
        }}
      >×</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '1.2rem' }}>{cfg.icon}</span>
        <span className={`badge ${cfg.cls}`}>{cfg.text} 감지</span>
      </div>

      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
        {alert.cctv_name}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>신뢰도 {(alert.confidence * 100).toFixed(1)}%</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}

export default function AlertPanel({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set());

  const handleDismiss = (id) => setDismissed(prev => new Set([...prev, id]));
  const handleClearAll = () => setDismissed(new Set(alerts.map(a => a.id)));

  const visible = alerts.filter(a => !dismissed.has(a.id));

  return (
    <div className="card" style={{ position: 'sticky', top: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '24px',
            background: visible.length > 0 ? 'var(--accent-red)' : 'var(--bg-secondary)',
            color: 'white', borderRadius: '50%',
            fontSize: '0.72rem', fontWeight: 700,
            transition: 'background 0.3s',
          }}>
            {visible.length}
          </span>
          실시간 알림
        </h3>
        {visible.length > 0 && (
          <button
            onClick={handleClearAll}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            모두 지우기
          </button>
        )}
      </div>

      <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p style={{ fontSize: '0.875rem' }}>새 알림이 없습니다</p>
          </div>
        ) : (
          visible.map(alert => (
            <AlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} />
          ))
        )}
      </div>
    </div>
  );
}
