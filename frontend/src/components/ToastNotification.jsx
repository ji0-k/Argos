import React, { useState, useEffect } from 'react';
import { subscribeToAlerts } from '../utils/socket';

const TYPE_CONFIG = {
  fire:            { icon: '🔥', text: '화재 감지',     bg: 'rgba(239,68,68,0.95)',   border: '#ef4444' },
  smoke:           { icon: '💨', text: '연기 감지',     bg: 'rgba(71,85,105,0.95)',   border: '#94a3b8' },
  stopped_vehicle: { icon: '🚗', text: '정차차량 감지', bg: 'rgba(180,115,0,0.95)',   border: '#f59e0b' },
  congestion:      { icon: '🚦', text: '차량정체 감지', bg: 'rgba(194,88,17,0.95)',   border: '#f97316' },
};

const DISMISS_AFTER = 6000;

export default function ToastNotification() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToAlerts((alertData) => {
      const id = Date.now();
      setToasts(prev => [...prev.slice(-4), { ...alertData, id }]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, DISMISS_AFTER);
    });
    return unsubscribe;
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => {
        const cfg = TYPE_CONFIG[toast.type] || TYPE_CONFIG.fire;
        return (
          <div
            key={toast.id}
            className="animate-slide-in"
            style={{
              pointerEvents: 'auto',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              minWidth: '280px',
              maxWidth: '340px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{cfg.icon}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: '3px' }}>
                  ⚠️ {cfg.text}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.82rem', marginBottom: '4px',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {toast.cctv_name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                  신뢰도 {(toast.confidence * 100).toFixed(1)}%
                </div>
              </div>

              <button
                onClick={() => dismiss(toast.id)}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  fontSize: '1.1rem', lineHeight: 1, flexShrink: 0,
                  padding: '0 2px',
                }}
              >×</button>
            </div>

            {/* 자동 소멸 프로그레스 바 */}
            <div style={{
              marginTop: '10px',
              height: '2px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '1px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '1px',
                animation: `shrink ${DISMISS_AFTER}ms linear forwards`,
              }} />
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
