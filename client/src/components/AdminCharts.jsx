import React, { useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { motion } from 'framer-motion';
import './AdminCharts.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const NEON = ['#7b2ff7', '#00d4ff', '#ff006e', '#ff6b35', '#00ff88', '#a855f7'];

const COMMON_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: 'rgba(240,240,255,0.7)',
        font: { family: 'DM Sans, sans-serif', size: 11 },
        padding: 14,
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(5, 5, 15, 0.9)',
      titleColor: '#fff',
      bodyColor: 'rgba(240,240,255,0.85)',
      borderColor: 'rgba(123, 47, 247, 0.5)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
      titleFont: { family: 'DM Sans, sans-serif', size: 12, weight: '600' },
      bodyFont: { family: 'DM Sans, sans-serif', size: 12 },
    },
  },
};

const BAR_OPTS = {
  ...COMMON_OPTS,
  plugins: { ...COMMON_OPTS.plugins, legend: { display: false } },
  scales: {
    x: {
      ticks: { color: 'rgba(240,240,255,0.6)', font: { family: 'DM Sans, sans-serif', size: 11 } },
      grid: { display: false },
      border: { color: 'rgba(255,255,255,0.08)' },
    },
    y: {
      ticks: { color: 'rgba(240,240,255,0.4)', font: { family: 'DM Sans, sans-serif', size: 10 } },
      grid: { color: 'rgba(255,255,255,0.04)' },
      border: { display: false },
      beginAtZero: true,
    },
  },
  animation: { duration: 1400, easing: 'easeOutCubic' },
};

const DONUT_OPTS = {
  ...COMMON_OPTS,
  cutout: '68%',
  animation: { animateRotate: true, animateScale: true, duration: 1400, easing: 'easeOutCubic' },
};

function ChartCard({ title, subtitle, children, index = 0 }) {
  return (
    <motion.div
      className="ac-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ac-card-head">
        <h4 className="ac-card-title">{title}</h4>
        {subtitle && <span className="ac-card-sub">{subtitle}</span>}
      </div>
      <div className="ac-card-body">{children}</div>
    </motion.div>
  );
}

function makeDonut(rows, colors = NEON) {
  return {
    labels: rows.map((r) => r._id || 'unknown'),
    datasets: [{
      data: rows.map((r) => r.count),
      backgroundColor: rows.map((_, i) => colors[i % colors.length]),
      borderColor: 'rgba(10,10,26,0.7)',
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };
}

function makeBar(rows, label, colors = NEON) {
  return {
    labels: rows.map((r) => r._id || 'unknown'),
    datasets: [{
      label,
      data: rows.map((r) => r.count),
      backgroundColor: rows.map((_, i) => colors[i % colors.length] + 'cc'),
      borderColor: rows.map((_, i) => colors[i % colors.length]),
      borderWidth: 1.5,
      borderRadius: 8,
      borderSkipped: false,
    }],
  };
}

export default function AdminCharts({ booths = [], roles = [], applications = [] }) {
  const boothData = useMemo(() => makeBar(booths, 'Booths'), [booths]);
  const roleData = useMemo(() => makeDonut(roles), [roles]);
  const appData = useMemo(() => makeDonut(applications, ['#00ff88', '#ffb300', '#ff006e', '#7b2ff7']), [applications]);

  const total = (rows) => rows.reduce((s, r) => s + (r.count || 0), 0);

  return (
    <div className="ac-grid">
      <ChartCard title="Booth Status" subtitle={`${total(booths)} total`} index={0}>
        {booths.length ? (
          <Bar data={boothData} options={BAR_OPTS} />
        ) : (
          <div className="ac-empty">No booth data</div>
        )}
      </ChartCard>

      <ChartCard title="Users by Role" subtitle={`${total(roles)} users`} index={1}>
        {roles.length ? (
          <Doughnut data={roleData} options={DONUT_OPTS} />
        ) : (
          <div className="ac-empty">No role data</div>
        )}
      </ChartCard>

      <ChartCard title="Applications" subtitle={`${total(applications)} total`} index={2}>
        {applications.length ? (
          <Doughnut data={appData} options={DONUT_OPTS} />
        ) : (
          <div className="ac-empty">No applications</div>
        )}
      </ChartCard>
    </div>
  );
}
