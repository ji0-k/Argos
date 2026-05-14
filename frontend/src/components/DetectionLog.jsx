import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const TYPE_CONFIG = {
  fire:            { icon: '🔥', text: '화재',     cls: 'badge-fire' },
  smoke:           { icon: '💨', text: '연기',     cls: 'badge-smoke' },
  stopped_vehicle: { icon: '🚗', text: '정차차량', cls: 'badge-stopped' },
  congestion:      { icon: '🚦', text: '차량정체', cls: 'badge-congestion' },
};

function CameraBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="상세 정보 보기"
      style={{
        background: 'none', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        padding: '3px 7px', fontSize: '0.85rem', lineHeight: 1,
        color: 'var(--text-secondary)',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
    >
      📷
    </button>
  );
}

function timeAgo(dateStr) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ko });
  } catch {
    return '-';
  }
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

/* compact=true → 카드형 리스트, compact=false(기본) → 테이블 */
export default function DetectionLog({ logs = [], compact = false, onDetail }) {
  if (logs.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 16px' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>
        </svg>
        <p style={{ fontSize: '0.875rem' }}>감지 기록이 없습니다.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {logs.map(log => {
          const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.fire;
          return (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{cfg.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span className={`badge ${cfg.cls}`} style={{ fontSize: '0.7rem', padding: '1px 7px' }}>
                    {cfg.text}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {timeAgo(log.detected_at)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {(log.confidence * 100).toFixed(0)}%
                </div>
                {log.snapshot_path && onDetail && (
                  <CameraBtn onClick={() => onDetail(log)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>유형</th>
            <th>CCTV</th>
            <th>신뢰도</th>
            <th>감지 시각</th>
            <th>캡처</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.fire;
            return (
              <tr key={log.id}>
                <td>
                  <span className={`badge ${cfg.cls}`}>
                    {cfg.icon} {cfg.text}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.cctv_name || `CCTV #${log.cctv_id}`}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      height: '4px', width: '60px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '2px', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${(log.confidence * 100).toFixed(0)}%`,
                        background: log.confidence > 0.8 ? 'var(--accent-red)' : log.confidence > 0.5 ? 'var(--accent-yellow)' : 'var(--accent-green)',
                        borderRadius: '2px',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '36px' }}>
                      {(log.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  {formatDate(log.detected_at)}
                </td>
                <td>
                  {log.snapshot_path && onDetail
                    ? <CameraBtn onClick={() => onDetail(log)} />
                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
