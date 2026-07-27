import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

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

function getRankIndex(days, words) {
  for (let i = 0; i < RANKS.length; i++) {
    if (days >= RANKS[i].minDays || words >= RANKS[i].minWords) return i;
  }
  return RANKS.length - 1;
}

export default function RankPreview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await api.getStudyStats();
      setStats(data);
    } catch (e) { console.error(e); }
  };

  const days = (stats?.streakDays || 0) + (stats?.rank_bonus_days || 0);
  const totalWords = (stats?.totalWords || 0) + (stats?.rank_bonus_words || 0);
  const currentIdx = getRankIndex(days, totalWords);
  const currentRank = RANKS[currentIdx];

  return (
    <div className="rank-preview">
      <div className="rank-header" style={{ background: `linear-gradient(135deg, ${currentRank.color}dd, ${currentRank.color}88)` }}>
        <button className="btn-back" onClick={() => navigate(-1)}>← 返回</button>
        <div className="rank-header-content">
          <div className="rank-badge-lg" style={{ borderColor: currentRank.color }}>
            <span className="rank-emoji-lg">{currentRank.icon}</span>
            <div>
              <div className="rank-name-lg" style={{ color: currentRank.color }}>{currentRank.name}</div>
              <div className="rank-level-lg">Lv.{RANKS.length - currentIdx}</div>
            </div>
          </div>
          <div className="rank-header-stats">
            <div>🔥 连续打卡 <b>{days}</b> 天</div>
            <div>📚 累计学习 <b>{totalWords}</b> 词</div>
          </div>
        </div>
      </div>

      <div className="rank-list">
        <div className="rank-list-title">🏅 等级一览</div>
        {RANKS.map((r, i) => {
          const isCurrent = i === currentIdx;
          const isUnlocked = i >= currentIdx;
          const needDays = r.minDays - days;
          const needWords = r.minWords - totalWords;
          const nextRank = i > 0 ? RANKS[i - 1] : null;
          const isNext = nextRank && i === currentIdx - 1;

          return (
            <div
              key={r.name}
              className={'rank-item' + (isCurrent ? ' current' : '') + (isUnlocked ? ' unlocked' : ' locked')}
              style={{ borderLeftColor: r.color }}
            >
              <div className="rank-item-left">
                <div className="rank-item-icon" style={{ color: r.color }}>{r.icon}</div>
                <div className="rank-item-info">
                  <div className="rank-item-name">
                    <span style={{ color: r.color }}>{r.name}</span>
                    <span className="rank-item-level">Lv.{RANKS.length - i}</span>
                    {isCurrent && <span className="rank-item-tag">当前</span>}
                    {isNext && <span className="rank-item-tag next">下一等级</span>}
                  </div>
                  <div className="rank-item-req">
                    打卡 <b>{r.minDays}</b> 天 <span className="rank-req-or">或</span> 学习 <b>{r.minWords}</b> 词
                  </div>
                </div>
              </div>
              <div className="rank-item-right">
                {isCurrent ? (
                  <div className="rank-progress-text">
                    {needDays > 0 && <span>还差 {needDays} 天</span>}
                    {needDays > 0 && needWords > 0 && <span> / </span>}
                    {needWords > 0 && <span>{needWords} 词</span>}
                    {needDays <= 0 && needWords <= 0 && <span>已达成！</span>}
                  </div>
                ) : isUnlocked ? (
                  <div className="rank-status unlocked">✓ 已达成</div>
                ) : (
                  <div className="rank-progress-text">
                    还需 {needDays} 天 / {needWords} 词
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
