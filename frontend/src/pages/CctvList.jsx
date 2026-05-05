import React, { useEffect, useState } from 'react';
import CctvCard from '../components/CctvCard';
import api from '../utils/api';

const REGIONS = ['전체', '서울', '경기도'];

export default function CctvList() {
  const [cctvs, setCctvs] = useState([]);
  const [region, setRegion] = useState('전체');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cctv/list')
      .then((r) => setCctvs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = region === '전체' ? cctvs : cctvs.filter((c) => c.region === region);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>CCTV 목록</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            style={{
              background: region === r ? '#4299e1' : '#1e2130',
              color: region === r ? '#fff' : '#94a3b8',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#718096' }}>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#718096' }}>CCTV가 없습니다.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((cctv) => (
            <CctvCard key={cctv.id} cctv={cctv} />
          ))}
        </div>
      )}
    </div>
  );
}
