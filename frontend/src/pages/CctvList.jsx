import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cctvApi } from '../utils/api';
import CctvCard from '../components/CctvCard';

export default function CctvList() {
  const [cctvList, setCctvList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCctvList();
  }, []);

  const fetchCctvList = async () => {
    try {
      setLoading(true);
      const res = await cctvApi.getList();
      setCctvList(res.data);
    } catch (err) {
      setError('CCTV 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', padding: '32px 24px' }}>
      <div className="container">
        {/* 헤더 */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
            📹 경부고속도로 CCTV
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            경부고속도로 실시간 CCTV를 모니터링합니다.
          </p>
        </div>

        {/* 상태 표시 */}
        {loading && (
          <div className="empty-state">
            <div className="spinner" />
            <p>CCTV 목록 로딩 중...</p>
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            color: 'var(--accent-red)',
            marginBottom: '24px',
          }}>
            ⚠️ {error}
            <button
              onClick={fetchCctvList}
              className="btn btn-outline"
              style={{ marginLeft: '16px', padding: '4px 12px', fontSize: '0.8rem' }}
            >
              재시도
            </button>
          </div>
        )}

        {/* CCTV 카드 그리드 */}
        {!loading && (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              총 <strong style={{ color: 'var(--text-primary)' }}>{cctvList.length}</strong>개 CCTV
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
            }}>
              {cctvList.map(cctv => (
                <CctvCard
                  key={cctv.id}
                  cctv={cctv}
                  onClick={() => navigate(`/cctv/${cctv.id}`)}
                />
              ))}
              {cctvList.length === 0 && (
                <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m9 10 6 4-6 4V10z"/>
                  </svg>
                  <p>CCTV 목록이 없습니다.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
