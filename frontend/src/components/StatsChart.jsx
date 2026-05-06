import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler
);

const TYPE_STYLE = {
  fire:            { label: '🔥 화재',     color: 'rgba(239,68,68,0.8)',    border: 'rgba(239,68,68,1)' },
  smoke:           { label: '💨 연기',     color: 'rgba(148,163,184,0.7)',  border: 'rgba(148,163,184,1)' },
  stopped_vehicle: { label: '🚗 정차차량', color: 'rgba(245,158,11,0.8)',   border: 'rgba(245,158,11,1)' },
  congestion:      { label: '🚦 차량정체', color: 'rgba(249,115,22,0.8)',   border: 'rgba(249,115,22,1)' },
};

function formatHour(isoStr) {
  try {
    const d = new Date(isoStr);
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}시`;
  } catch {
    return isoStr;
  }
}

export default function StatsChart({ data = [] }) {
  const { labels, datasets } = useMemo(() => {
    if (!data.length) return { labels: [], datasets: [] };

    // 고유 시간대 정렬
    const hourSet = [...new Set(data.map(d => d.hour))].sort();
    const labels = hourSet.map(formatHour);

    // 타입별 데이터셋 생성
    const typeSet = [...new Set(data.map(d => d.type))];
    const datasets = typeSet.map(type => {
      const style = TYPE_STYLE[type] || { label: type, color: 'rgba(99,102,241,0.7)', border: 'rgba(99,102,241,1)' };
      const counts = hourSet.map(hour => {
        const entry = data.find(d => d.hour === hour && d.type === type);
        return entry ? entry.count : 0;
      });
      return {
        label: style.label,
        data: counts,
        backgroundColor: style.color,
        borderColor: style.border,
        borderWidth: 1,
        borderRadius: 4,
      };
    });

    return { labels, datasets };
  }, [data]);

  if (!data.length) {
    return (
      <div className="empty-state" style={{ padding: '40px' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/>
        </svg>
        <p style={{ fontSize: '0.875rem' }}>통계 데이터가 없습니다.</p>
      </div>
    );
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { size: 12 },
          padding: 16,
          boxWidth: 12,
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 10,
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          maxRotation: 45,
          maxTicksLimit: 12,
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          stepSize: 1,
        },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
    },
  };

  return (
    <div style={{ position: 'relative', height: '260px' }}>
      <Bar data={{ labels, datasets }} options={{ ...options, maintainAspectRatio: false }} />
    </div>
  );
}
