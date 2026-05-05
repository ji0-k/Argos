import React, { useEffect, useState } from 'react';
import socket from '../utils/socket';

const TYPE_KO = { fire: '화재', smoke: '연기', stopped_vehicle: '정차차량', congestion: '차량정체' };
const TYPE_COLOR = { fire: '#fc8181', smoke: '#b794f4', stopped_vehicle: '#f6ad55', congestion: '#63b3ed' };

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AlertPanel() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    socket.connect();

    socket.on('alert', (data) => {
      setAlerts((prev) => [{ ...data, _id: Date.now() }, ...prev].slice(0, 50));
    });

    return () => {
      socket.off('alert');
      socket.disconnect();
    };
  }, []);

  return (
    <div style={{
      background: '#141824',
      border: '1px solid #1e2130',
      borderRadius: 10,
      height: 320,
      overflowY: 'auto',
    }}>
      {alerts.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4a5568', fontSize: 13 }}>
          실시간 알림 대기 중...
        </div>
      ) : (
        alerts.map((a) => (
          <div
            key={a._id}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #1e2130',
              borderLeft: `3px solid ${TYPE_COLOR[a.type] || '#718096'}`,
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: TYPE_COLOR[a.type] || '#e2e8f0', fontSize: 13 }}>
                ⚠ {TYPE_KO[a.type] || a.type}
              </span>
              <span style={{ fontSize: 11, color: '#4a5568' }}>{fmtTime(a.detected_at)}</span>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>
              {a.cctv_name} &nbsp;·&nbsp; 신뢰도 {(a.confidence * 100).toFixed(1)}%
            </p>
          </div>
        ))
      )}
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  );
}
