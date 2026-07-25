import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function StatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getMyStats();
      setStats(data.stats || data || {});
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  const statItems = [
    { label: '总任务', value: stats.totalTasks || 0, icon: '📋' },
    { label: '已测试', value: stats.testedTasks || 0, icon: '✅' },
    { label: '平均分', value: stats.avgScore ? Math.round(stats.avgScore) + '分' : '-', icon: '📊' },
    { label: '学习天数', value: (stats.studyDays || 0) + '天', icon: '📅' },
    { label: '已学单词', value: stats.totalWords || 0, icon: '📚' },
    { label: '错题数', value: stats.wrongCount || 0, icon: '❌' },
  ];

  return (
    <div className="progress-view">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>学习统计</h2>
        <div />
      </div>

      <div className="stats-grid">
        {statItems.map((item, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon">{item.icon}</div>
            <div className="stat-num">{item.value}</div>
            <div className="stat-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
