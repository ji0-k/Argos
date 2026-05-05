import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import DetectionLog from '../components/DetectionLog';

const TYPE_KO = { fire: '화재', smoke: '연기', stopped_vehicle: '정차차량', congestion: '차량정체' };
const TYPE_COLOR = { fire: '#fc8181', smoke: '#b794f4', stopped_vehicle: '#f6ad55', congestion: '#63b3ed' };

const FLASK_URL = process.env.REACT_APP_FLASK_URL || 'http://localhost:5000';

export default function CctvStream() {
  const { id } = useParams();
  const [cctv, setCctv] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [lastAlert, setLastAlert] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    api.get(`/cctv/${id}`).then((r) => setCctv(r.data)).catch(console.error);
  }, [id]);

  const startDetection = async () => {
    try {
      const r = await api.post(`/cctv/${id}/detection/start`);
      setSessionId(r.data.session_id);
      setDetecting(true);
    } catch (e) {
      alert('감지 시작 실패');
    }
  };

  const stopDetection = async () => {
    try {
      await api.post(`/cctv/${id}/detection/stop`, { session_id: sessionId });
      setDetecting(false);
      setSessionId(null);
    } catch (e) {
      alert('감지 종료 실패');
    }
  };

  if (!cctv) return <p style={{ padding: 24, color: '#718096' }}>불러오는 중...</p>;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{cctv.name}</h2>
      <p style={{ color: '#718096', fontSize: 13, marginBottom: 20 }}>{cctv.location}</p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* 영상 */}
        <div style={{ flex: '1 1 480px' }}>
          <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <img
              ref={imgRef}
              src={`${FLASK_URL}/api/cctv/${id}/stream`}
              alt="CCTV 스트림"
              style={{ width: '100%', display: 'block', minHeight: 320 }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {detecting && lastAlert && (
              <div style={{
                position: 'absolute', top: 12, left: 12,
                background: 'rgba(0,0,0,0.75)',
                border: `2px solid ${TYPE_COLOR[lastAlert.type] || '#fff'}`,
                borderRadius: 6, padding: '6px 12px',
                color: TYPE_COLOR[lastAlert.type] || '#fff',
                fontWeight: 700, fontSize: 14,
              }}>
                ⚠ {TYPE_KO[lastAlert.type] || lastAlert.type} ({(lastAlert.confidence * 100).toFixed(1)}%)
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              onClick={detecting ? stopDetection : startDetection}
              style={{
                background: detecting ? '#742a2a' : '#2f855a',
                color: '#fff',
                padding: '10px 20px',
              }}
            >
              {detecting ? '⏹ 감지 종료' : '▶ 감지 시작'}
            </button>
            <span style={{
              alignSelf: 'center', fontSize: 13,
              color: detecting ? '#68d391' : '#718096',
            }}>
              {detecting ? '● 감지 중' : '○ 대기 중'}
            </span>
          </div>
        </div>

        {/* 로그 */}
        <div style={{ flex: '1 1 320px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>최근 감지 로그</h3>
          <DetectionLog cctvId={id} onNewAlert={setLastAlert} live={detecting} />
        </div>
      </div>
    </div>
  );
}
