import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import socket from '../utils/socket';

const TYPE_KO = { fire: '화재', smoke: '연기', stopped_vehicle: '정차차량', congestion: '차량정체' };
const TYPE_BADGE = { fire: 'fire', smoke: 'smoke', stopped_vehicle: 'stopped', congestion: 'congestion' };

function fmtDatetime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function DetectionLog({ cctvId, filter = {}, showCctvName = false, live = false, onNewAlert }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(filter.page || 1);
  const limit = 10;

  const fetchLogs = useCallback(() => {
    const endpoint = cctvId ? `/logs/${cctvId}` : '/logs';
    const params = { page, limit, ...(filter.type ? { type: filter.type } : {}) };
    api.get(endpoint, { params })
      .then((r) => { setLogs(r.data.logs); setTotal(r.data.total); })
      .catch(console.error);
  }, [cctvId, page, filter.type, limit]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!live) return;
    socket.connect();
    socket.on('alert', (data) => {
      if (onNewAlert) onNewAlert(data);
      fetchLogs();
    });
    return () => { socket.off('alert'); };
  }, [live, fetchLogs, onNewAlert]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1e2130' }}>
        <table>
          <thead>
            <tr>
              {showCctvName && <th>CCTV</th>}
              <th>유형</th>
              <th>신뢰도</th>
              <th>감지 시각</th>
              <th>이메일</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={showCctvName ? 5 : 4} style={{ textAlign: 'center', color: '#4a5568', padding: 24 }}>감지 기록 없음</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  {showCctvName && <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.cctv_name}</td>}
                  <td>
                    <span className={`badge badge-${TYPE_BADGE[log.type] || 'normal'}`}>
                      {TYPE_KO[log.type] || log.type}
                    </span>
                  </td>
                  <td>{(log.confidence * 100).toFixed(1)}%</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDatetime(log.detected_at)}</td>
                  <td style={{ color: log.alert_sent ? '#68d391' : '#4a5568', fontSize: 12 }}>
                    {log.alert_sent ? '발송됨' : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            style={{ background: '#1e2130', color: '#94a3b8', padding: '5px 12px' }}>
            ‹
          </button>
          <span style={{ alignSelf: 'center', fontSize: 13, color: '#718096' }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ background: '#1e2130', color: '#94a3b8', padding: '5px 12px' }}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}
