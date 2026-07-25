import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function rankIcon(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await api.getLeaderboard();
      const list = data.users || data.leaderboard || data || [];
      setUsers(list.map(u => ({
        ...u,
        avgScore: u.avg_score ?? u.avgScore,
        totalTasks: u.tasks ?? u.totalTasks,
        studyDays: u.days ?? u.studyDays,
      })));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="progress-view">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>排行榜</h2>
        <div />
      </div>

      <div className="progress-table">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>用户名</th>
              <th>平均分</th>
              <th>学习天数</th>
              <th>任务数</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id || i}>
                <td><span className={'rank rank-' + (i + 1)}>{rankIcon(i + 1)}</span></td>
                <td>🎒 {u.username}</td>
                <td>{u.avgScore ? Math.round(u.avgScore) + '分' : '-'}</td>
                <td>{(u.studyDays || 0) + '天'}</td>
                <td>{u.totalTasks || 0}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="5" className="empty-state">暂无数据</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
