import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import api from '../utils/api';

const TYPE_KO = { fire: '화재', smoke: '연기', stopped_vehicle: '정차차량', congestion: '차량정체' };
const COLORS = { fire: '#fc8181', smoke: '#b794f4', stopped_vehicle: '#f6ad55', congestion: '#63b3ed' };

export default function StatsChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get('/logs/stats')
      .then((r) => {
        const chartData = Object.entries(r.data).map(([type, count]) => ({
          name: TYPE_KO[type] || type,
          count,
          type,
        }));
        setData(chartData);
      })
      .catch(console.error);
  }, []);

  if (data.length === 0) {
    return (
      <div style={{
        background: '#141824', border: '1px solid #1e2130', borderRadius: 10,
        height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#4a5568', fontSize: 13,
      }}>
        감지 데이터 없음
      </div>
    );
  }

  return (
    <div style={{ background: '#141824', border: '1px solid #1e2130', borderRadius: 10, padding: '16px 8px' }}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
          <XAxis dataKey="name" tick={{ fill: '#718096', fontSize: 12 }} />
          <YAxis tick={{ fill: '#718096', fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#0f1117', border: '1px solid #2d3748', borderRadius: 6, fontSize: 13 }}
            labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
            itemStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="count" name="감지 건수" radius={[4, 4, 0, 0]}
            fill="#4299e1"
            label={{ position: 'top', fill: '#718096', fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
