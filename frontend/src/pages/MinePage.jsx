import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCurrentUser, clearAuth } from '../api.js';

const RANKS = [
  { name: '传奇', icon: '🌟', minDays: 366, minWords: 20000, color: '#dc2626' },
  { name: '宗师', icon: '👑', minDays: 201, minWords: 12000, color: '#7c3aed' },
  { name: '大师', icon: '🏆', minDays: 101, minWords: 7000, color: '#ea580c' },
  { name: '钻石', icon: '💠', minDays: 61, minWords: 4000, color: '#2563eb' },
  { name: '铂金', icon: '💎', minDays: 31, minWords: 2000, color: '#0891b2' },
  { name: '黄金', icon: '🥇', minDays: 15, minWords: 1000, color: '#d97706' },
  { name: '白银', icon: '🥈', minDays: 8, minWords: 500, color: '#6b7280' },
  { name: '青铜', icon: '🥉', minDays: 4, minWords: 200, color: '#92400e' },
  { name: '初学者', icon: '🌱', minDays: 0, minWords: 0, color: '#65a30d' },
];

function getRank(days, words) {
  for (let i = 0; i < RANKS.length; i++) {
    if (days >= RANKS[i].minDays || words >= RANKS[i].minWords) {
      return { ...RANKS[i], level: RANKS.length - i };
    }
  }
  return { ...RANKS[RANKS.length - 1], level: 1 };
}

const AVATAR_OPTIONS = ['🧑‍🎓', '👨‍🎓', '👩‍🎓', '🧒', '👦', '👧', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐙', '🦄', '🐳', '🌸'];

export default function MinePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [stats, setStats] = useState(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await api.getStudyStats();
      setStats(data);
    } catch (e) { console.error(e); }
  };

  const rank = getRank(
    (stats?.streakDays || 0) + (stats?.rank_bonus_days || 0),
    (stats?.totalWords || 0) + (stats?.rank_bonus_words || 0)
  );

  const changeAvatar = async (emoji) => {
    try {
      await api.updateAvatar(emoji);
      const updated = { ...user, avatar: emoji };
      localStorage.setItem('vocab_user', JSON.stringify(updated));
      setShowAvatarPicker(false);
      window.dispatchEvent(new CustomEvent('user-updated'));
    } catch (e) { alert(e.message); }
  };

  const logout = () => {
    if (!confirm('确定要退出登录吗？')) return;
    clearAuth();
    navigate('/login');
  };

  const fmtMin = (sec) => Math.round(sec / 60);

  const isTeacher = user?.role === 'teacher';

  const menuGroups = isTeacher
    ? [
        {
          title: '教学管理',
          items: [
            { icon: '📋', label: '词表管理', onClick: () => navigate('/teacher/word-lists') },
            { icon: '📝', label: '长难句', onClick: () => navigate('/teacher/sentence-lists') },
            { icon: '📊', label: '任务管理', onClick: () => navigate('/teacher/tasks') },
            { icon: '👥', label: '账号管理', onClick: () => navigate('/teacher/users') },
            { icon: '💬', label: '留言管理', onClick: () => navigate('/teacher/comments') },
          ]
        },
        {
          title: '更多',
          items: [
            { icon: '⚙️', label: '设置', onClick: () => navigate('/settings') },
            { icon: '🚪', label: '退出登录', onClick: logout, danger: true },
          ]
        }
      ]
    : [
        {
          title: '学习数据',
          items: [
            { icon: '📊', label: '学习统计', onClick: () => navigate('/student/stats') },
            { icon: '⭐', label: '我的收藏', onClick: () => navigate('/student/favorites') },
            { icon: '❌', label: '错题本', onClick: () => navigate('/student/wrong-book') },
          ]
        },
        {
          title: '更多',
          items: [
            { icon: '⚙️', label: '设置', onClick: () => navigate('/settings') },
            { icon: '🚪', label: '退出登录', onClick: logout, danger: true },
          ]
        }
      ];

  return (
    <div className="mine-page">
      <div className="mine-header" style={{ background: `linear-gradient(135deg, ${rank.color}dd, ${rank.color}99)` }}>
        <div className="mine-user-row">
          <div className="mine-avatar" onClick={() => setShowAvatarPicker(true)}>
            {user?.avatar || '🧑‍🎓'}
          </div>
          <div className="mine-user-info">
            <div className="mine-username">{user?.username || '用户'}</div>
            <div className="mine-user-sub">{isTeacher ? '工号' : '学号'} #{user?.id} · 点击头像更换</div>
          </div>
        </div>

        <div className="mine-rank-row" onClick={() => navigate('/rank-preview')}>
          <div className="mine-rank-badge" style={{ borderColor: rank.color }}>
            <span className="mine-rank-icon">{rank.icon}</span>
            <span className="mine-rank-name" style={{ color: rank.color }}>{rank.name}</span>
            <span className="mine-rank-level">Lv.{rank.level}</span>
          </div>
          <div className="mine-rank-stats">
            <div>🔥 连续打卡 <b>{stats?.streakDays || 0}</b> 天</div>
            <div>📅 累计打卡 <b>{stats?.checkinDays || 0}</b> 天</div>
          </div>
        </div>
      </div>

      <div className="mine-stats-card">
        <div className="mine-stats-title">📚 我的数据</div>
        <div className="mine-stats-grid">
          <div className="mine-stat-item">
            <div className="mine-stat-icon" style={{ color: '#f59e0b' }}>📝</div>
            <div className="mine-stat-info">
              <div className="mine-stat-label">今日学习</div>
              <div className="mine-stat-value">{stats?.todayWords || 0} <span className="mine-stat-unit">词</span></div>
            </div>
          </div>
          <div className="mine-stat-item">
            <div className="mine-stat-icon" style={{ color: '#ef4444' }}>📈</div>
            <div className="mine-stat-info">
              <div className="mine-stat-label">累计学习</div>
              <div className="mine-stat-value">{stats?.totalWords || 0} <span className="mine-stat-unit">词</span></div>
            </div>
          </div>
          <div className="mine-stat-item">
            <div className="mine-stat-icon" style={{ color: '#10b981' }}>⏱️</div>
            <div className="mine-stat-info">
              <div className="mine-stat-label">今日时长</div>
              <div className="mine-stat-value">{fmtMin(stats?.todayDuration || 0)} <span className="mine-stat-unit">分钟</span></div>
            </div>
          </div>
          <div className="mine-stat-item">
            <div className="mine-stat-icon" style={{ color: '#8b5cf6' }}>⏰</div>
            <div className="mine-stat-info">
              <div className="mine-stat-label">累计时长</div>
              <div className="mine-stat-value">{fmtMin(stats?.totalDuration || 0)} <span className="mine-stat-unit">分钟</span></div>
            </div>
          </div>
        </div>
      </div>

      {menuGroups.map((g, gi) => (
        <div className="mine-menu-group" key={gi}>
          {g.title && <div className="mine-menu-title">{g.title}</div>}
          <div className="mine-menu-list">
            {g.items.map((item, ii) => (
              <div className={`mine-menu-item ${item.danger ? 'danger' : ''}`} key={ii} onClick={item.onClick}>
                <span className="mine-menu-icon">{item.icon}</span>
                <span className="mine-menu-label">{item.label}</span>
                <span className="mine-menu-arrow">›</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showAvatarPicker && (
        <div className="modal-overlay" onClick={() => setShowAvatarPicker(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>选择头像</h3>
            <div className="avatar-grid">
              {AVATAR_OPTIONS.map(e => (
                <div key={e} className="avatar-option" onClick={() => changeAvatar(e)}>{e}</div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setShowAvatarPicker(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
