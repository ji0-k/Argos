import React from 'react';

const STATUS_BADGE = {
  active: { text: '운영 중', cls: 'badge-active' },
  inactive: { text: '비활성', cls: 'badge-inactive' },
};

const REGION_COLOR = {
  '서울': 'var(--accent-blue)',
  '경기도': 'var(--accent-cyan)',
};

export default function CctvCard({ cctv, onClick }) {
  const badge = STATUS_BADGE[cctv.status] || STATUS_BADGE.inactive;
  const regionColor = REGION_COLOR[cctv.region] || 'var(--accent-blue)';

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
    >
      {/* 좌측 색상 바 */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: '4px',
        background: regionColor,
        borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
      }} />

      <div style={{ paddingLeft: '12px' }}>
        {/* 상단: 이름 + 뱃지 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1, marginRight: '8px' }}>
            {cctv.name}
          </h3>
          <span className={`badge ${badge.cls}`}>{badge.text}</span>
        </div>

        {/* 위치 */}
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '8px' }}>
          📍 {cctv.location}
        </div>

        {/* 지역 태그 */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '999px',
            background: `${regionColor}20`,
            color: regionColor,
            border: `1px solid ${regionColor}40`,
            fontWeight: 500,
          }}>
            {cctv.region}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            ID: {cctv.its_id}
          </span>
        </div>

        {/* 클릭 힌트 */}
        <div style={{
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
        }}>
          <span>영상 보기</span>
          <span style={{ color: regionColor }}>→</span>
        </div>
      </div>
    </div>
  );
}
