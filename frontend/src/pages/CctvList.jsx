import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { cctvApi, logsApi } from '../utils/api';
import { subscribeToAlerts } from '../utils/socket';

const TYPE_META = {
  fire:            { label: '화재',    color: '#ef4444', bg: '#fee2e2', icon: '🔥' },
  smoke:           { label: '연기',    color: '#f97316', bg: '#ffedd5', icon: '💨' },
  stopped_vehicle: { label: '정차차량', color: '#b45309', bg: '#fef9c3', icon: '🚗' },
  congestion:      { label: '차량정체', color: '#1d4ed8', bg: '#dbeafe', icon: '🚦' },
};

const STATUS_BADGE = {
  진행중: { bg: '#fee2e2', color: '#dc2626' },
  처리중: { bg: '#fef9c3', color: '#b45309' },
  완료:   { bg: '#dcfce7', color: '#16a34a' },
};

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function SummaryCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: 14,
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minWidth: 150,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: '50%',
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.2rem',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>
          {value} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>/ {sub}</span>
        </div>
      </div>
    </div>
  );
}

export default function CctvList() {
  const [cctvList, setCctvList]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [incidents, setIncidents]   = useState([]);
  const [selectedCctv, setSelected] = useState(null);
  const [viewMode, setViewMode]     = useState('map'); // 'map' | 'stream'
  const navigate  = useNavigate();
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);
  const listRef   = useRef(null);

  useEffect(() => {
    cctvApi.getList()
      .then(res => setCctvList(res.data))
      .finally(() => setLoading(false));

    logsApi.getAll(1, 30)
      .then(res => setIncidents(res.data.logs))
      .catch(() => {});

    const unsub = subscribeToAlerts(alert => {
      setIncidents(prev => [{ ...alert, id: `ws-${Date.now()}` }, ...prev].slice(0, 50));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (loading || leafletRef.current || !mapRef.current) return;

    const koreaBounds = L.latLngBounds([33.0, 124.5], [38.9, 130.1]);
    const map = L.map(mapRef.current, {
      zoomControl: true,
      zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
      maxBounds: koreaBounds,
      maxBoundsViscosity: 1.0,
      minZoom: 6,
      maxZoom: 17,
    }).setView([36.5, 127.8], 8);
    leafletRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    const valid = cctvList.filter(c => c.coord_lat && c.coord_lng);
    if (valid.length > 0) {
      map.fitBounds(L.latLngBounds(valid.map(c => [c.coord_lat, c.coord_lng])), { padding: [30, 30] });
    }

    const pinIcon = L.divIcon({
      className: '',
      html: `<div style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));">📹</div>`,
      iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10],
    });

    valid.forEach(cctv => {
      const marker = L.marker([cctv.coord_lat, cctv.coord_lng], { icon: pinIcon }).addTo(map);
      marker.bindPopup(`
        <div style="min-width:160px;font-family:sans-serif">
          <strong style="font-size:0.82rem;display:block;margin-bottom:4px">${cctv.name}</strong>
          <div style="font-size:0.72rem;color:#64748b;margin-bottom:8px">${cctv.location}</div>
          <button onclick="window.__argosSelect(${cctv.id})"
            style="width:100%;padding:5px;font-size:0.75rem;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer">
            영상 보기 →
          </button>
        </div>
      `);
      marker.on('click', () => handleSelectCctv(cctv));
    });

    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      try { map.remove(); } catch {}
      leafletRef.current = null;
    };
  }, [loading, cctvList]);

  useEffect(() => {
    window.__argosSelect = (id) => {
      const cctv = cctvList.find(c => c.id === id);
      if (cctv) handleSelectCctv(cctv);
    };
    return () => { delete window.__argosSelect; };
  }, [cctvList]);

  const handleSelectCctv = (cctv) => {
    setSelected(cctv);
    setViewMode('stream');
    listRef.current?.querySelector(`[data-id="${cctv.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // 요약 통계
  const fireCount = incidents.filter(i => i.type === 'fire' || i.type === 'smoke').length;
  const congestionCount = incidents.filter(i => i.type === 'congestion').length;

  const PANEL_HEIGHT = 560;

  return (
    <div className="page-outer" style={{ background: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* 타이틀 + 요약 카드 */}
        <div className="monitor-header">
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>실시간 교통 모니터링</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>경부고속도로 ITS CCTV 실시간 스트리밍 및 돌발정보 현황</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <SummaryCard label="운영 CCTV" value={cctvList.length} sub={cctvList.length} color="#10b981" icon="📹" />
            <SummaryCard label="차량정체" value={congestionCount} sub="30건" color="#f97316" icon="🚦" />
            <SummaryCard label="화재 감지" value={fireCount} sub="30건" color="#ef4444" icon="🔥" />
          </div>
        </div>

        {/* 메인 콘텐츠: 영상/지도 + 목록 */}
        <div className="grid-monitor">

          {/* 좌측: 영상 or 지도 */}
          <div style={{
            background: 'white', borderRadius: 16, border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
          }}>
            {/* 패널 헤더 */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                {viewMode === 'stream' ? '실시간 영상' : '경부고속도로 지도'}
                {viewMode === 'stream' && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: '0.72rem', color: '#ef4444',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
                    LIVE
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setViewMode('map')}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid #e2e8f0',
                    background: viewMode === 'map' ? '#f0fdf4' : 'white',
                    color: viewMode === 'map' ? '#10b981' : '#64748b',
                  }}
                >🗺 지도</button>
                <button
                  onClick={() => { if (selectedCctv) setViewMode('stream'); }}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid #e2e8f0',
                    background: viewMode === 'stream' ? '#f0fdf4' : 'white',
                    color: viewMode === 'stream' ? '#10b981' : '#94a3b8',
                  }}
                >📹 영상</button>
              </div>
            </div>

            {/* 지도 */}
            <div style={{ display: viewMode === 'map' ? 'block' : 'none', height: PANEL_HEIGHT }}>
              {loading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner" />
                </div>
              ) : (
                <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
              )}
            </div>

            {/* 영상 스트림 */}
            {viewMode === 'stream' && selectedCctv && (
              <div>
                <div style={{ background: '#0f172a', position: 'relative', height: PANEL_HEIGHT - 64 }}>
                  <img
                    src={`${BASE_URL}/api/cctv/${selectedCctv.id}/stream`}
                    alt="CCTV 스트림"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div style={{
                    position: 'absolute', top: 16, left: 16,
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                    padding: '8px 14px', borderRadius: 10, color: 'white',
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{selectedCctv.name}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>{selectedCctv.location}</div>
                  </div>
                </div>
                <div style={{
                  height: 64, background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 20px',
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>📍 {selectedCctv.location}</span>
                  <button
                    onClick={() => navigate(`/cctv/${selectedCctv.id}`)}
                    className="btn btn-primary"
                    style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                  >
                    상세 보기 →
                  </button>
                </div>
              </div>
            )}

            {/* 영상 미선택 */}
            {viewMode === 'stream' && !selectedCctv && (
              <div style={{ height: PANEL_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#94a3b8' }}>
                <span style={{ fontSize: '2rem' }}>📹</span>
                <p style={{ fontSize: '0.875rem' }}>좌측 목록에서 CCTV를 선택하세요</p>
              </div>
            )}
          </div>

          {/* 우측: CCTV 목록 */}
          <div style={{
            background: 'white', borderRadius: 16, border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column',
            height: PANEL_HEIGHT + 52,
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>CCTV 목록</h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>북쪽 → 남쪽</span>
            </div>
            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cctvList.map(cctv => {
                const active = selectedCctv?.id === cctv.id;
                return (
                  <div
                    key={cctv.id}
                    data-id={cctv.id}
                    onClick={() => handleSelectCctv(cctv)}
                    style={{
                      flexShrink: 0, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${active ? '#10b981' : '#e2e8f0'}`,
                      background: active ? '#f0fdf4' : 'white',
                      transition: 'all 0.15s',
                      display: 'flex', gap: 10, alignItems: 'center',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = '#10b981'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  >
                    <div style={{
                      width: 40, height: 28, background: active ? '#dcfce7' : '#f1f5f9',
                      borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem', flexShrink: 0,
                    }}>📹</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cctv.name.replace('[경부선] ', '')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 1 }}>경부고속도로</div>
                    </div>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', flexShrink: 0,
                      background: '#dcfce7', color: '#16a34a',
                    }}>정상</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 실시간 돌발정보 테이블 */}
        <div style={{
          background: 'white', borderRadius: 16, border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              실시간 돌발정보
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>최근 {incidents.length}건</span>
          </div>

          {incidents.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px' }}>
              <p>감지된 돌발상황이 없습니다.</p>
            </div>
          ) : (
            <div className="table-wrap"><table>
              <thead>
                <tr>
                  {['시각', '유형', '위치', '상세내용', '신뢰도', '상태'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc, idx) => {
                  const meta = TYPE_META[inc.type] || { label: inc.type, color: '#64748b', bg: '#f1f5f9', icon: '⚠️' };
                  const time = inc.detected_at
                    ? new Date(inc.detected_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                    : '-';
                  const status = inc.status || '진행중';
                  const sbadge = STATUS_BADGE[status] || STATUS_BADGE['진행중'];
                  return (
                    <tr
                      key={inc.id ?? idx}
                      onClick={() => inc.cctv_id && navigate(`/cctv/${inc.cctv_id}`)}
                      style={{ cursor: inc.cctv_id ? 'pointer' : 'default' }}
                    >
                      <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{time}</td>
                      <td>
                        <span style={{
                          padding: '3px 9px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                          background: meta.bg, color: meta.color,
                        }}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                        {inc.cctv_name || `CCTV #${inc.cctv_id}`}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                        {meta.label} 감지, 신뢰도 {Math.round((inc.confidence || 0) * 100)}%
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                          <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round((inc.confidence || 0) * 100)}%`, height: '100%', background: meta.color, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>
                            {Math.round((inc.confidence || 0) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 9px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                          background: sbadge.bg, color: sbadge.color,
                        }}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}
