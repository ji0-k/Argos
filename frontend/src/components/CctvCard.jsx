import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function CctvCard({ cctv }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/cctv/${cctv.id}`)}
      style={{
        background: '#141824',
        border: '1px solid #1e2130',
        borderRadius: 10,
        padding: 20,
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#4299e1';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#1e2130';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4, flex: 1 }}>
          {cctv.name}
        </span>
        <span className={`badge badge-${cctv.status}`} style={{ marginLeft: 8, flexShrink: 0 }}>
          {cctv.status === 'active' ? '정상' : '비활성'}
        </span>
      </div>

      <p style={{ fontSize: 12, color: '#718096', marginBottom: 6, lineHeight: 1.5 }}>
        📍 {cctv.location}
      </p>
      <p style={{ fontSize: 11, color: '#4a5568' }}>
        {cctv.region}
      </p>
    </div>
  );
}
