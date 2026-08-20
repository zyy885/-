import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function statusBadge(status) {
  const map = {
    pending: { text: '未开始', cls: 'badge-gray' },
    studying: { text: '学习中', cls: 'badge-blue' },
    tested: { text: '已测试', cls: 'badge-green' },
  };
  const s = map[status] || map.pending;
  return <span className={'badge ' + s.cls}>{s.text}</span>;
}

function getKaoyanDate() {
  const saved = localStorage.getItem('kaoyan_date');
  if (saved) return saved;
  return '2026-12-19';
}

function calcCountdown(targetDateStr) {
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [kaoyanDate, setKaoyanDate] = useState(getKaoyanDate());
  const [showKaoyanEdit, setShowKaoyanEdit] = useState(false);
  const [kaoyanInput, setKaoyanInput] = useState(kaoyanDate);
  const [countdown, setCountdown] = useState(calcCountdown(kaoyanDate));

  useEffect(() => {
    loadAll();
    const t = setInterval(() => setCountdown(calcCountdown(kaoyanDate)), 60000);
    return () => clearInterval(t);
  }, [kaoyanDate]);

  const loadAll = async () => {
    try {
      const [tasksData, checkinData] = await Promise.all([
        api.getTasks(),
        api.getCheckinStatus().catch(() => null),
      ]);
      setTasks(tasksData.tasks);
      setCheckinStatus(checkinData);
    } catch (e) {
      console.error('加载失败:', e);
      alert('加载失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!checkinStatus?.can_checkin || checkingIn) return;
    setCheckingIn(true);
    try {
      await api.doCheckin();
      await loadAll();
    } catch (e) {
      alert(e.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const saveKaoyanDate = () => {
    if (!kaoyanInput) return;
    setKaoyanDate(kaoyanInput);
    localStorage.setItem('kaoyan_date', kaoyanInput);
    setCountdown(calcCountdown(kaoyanInput));
    setShowKaoyanEdit(false);
  };

  const rank = checkinStatus?.rank;
  const streak = checkinStatus?.streak || 0;

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="dashboard">
      <div className="page-bg-animation">
        <div className="bg-blob bg-blob-1"></div>
        <div className="bg-blob bg-blob-2"></div>
        <div className="bg-blob bg-blob-3"></div>
      </div>

      <div className="top-row">
        <div className="checkin-section" style={{ flex: 1, minWidth: 0 }}>
          <div className="checkin-card" style={{ background: rank ? `linear-gradient(135deg, ${rank.color} 0%, #764ba2 100%)` : undefined }}>
            <div className="checkin-card-left">
              <div className="rank-icon-wrap" onClick={() => navigate('/rank-preview')}>
                <span className="rank-emoji">{rank?.icon || '🌱'}</span>
                {rank && (
                  <div className="rank-badge-sm" style={{ background: rank.color }}>
                    Lv.{rank.level}
                  </div>
                )}
              </div>
              <div>
                <div className="checkin-title">
                  {checkinStatus?.checked_in ? '今日已打卡' : '每日打卡'}
                  <span className="rank-name" style={{ marginLeft: 8, cursor: 'pointer' }} onClick={() => navigate('/rank-preview')}>{rank?.name || '初学者'}</span>
                </div>
                <div className="checkin-reason">
                  {checkinStatus?.checkin_reason || '加载中...'}
                </div>
                <div className="streak-row">
                  <span className="streak-item">🔥 连续 <strong>{streak}</strong> 天</span>
                  <span className="streak-divider">·</span>
                  <span className="streak-item">📅 累计 <strong>{checkinStatus?.total_checkins || 0}</strong> 天</span>
                </div>
              </div>
            </div>
            <div className="checkin-card-right">
              <button
                className={'btn checkin-btn' + (checkinStatus?.can_checkin ? ' btn-primary' : ' btn-disabled')}
                onClick={handleCheckin}
                disabled={!checkinStatus?.can_checkin || checkingIn}
              >
                {checkingIn ? '打卡中...' : checkinStatus?.checked_in ? '✓ 已打卡' : '立即打卡'}
              </button>
            </div>
          </div>
        </div>

        <div className="kaoyan-card" onClick={() => setShowKaoyanEdit(true)}>
          <div className="kaoyan-icon">📚</div>
          <div className="kaoyan-content">
            <div className="kaoyan-label">考研倒计时</div>
            <div className="kaoyan-count">
              {countdown > 0 ? (
                <>
                  <span className="kaoyan-num">{countdown}</span>
                  <span className="kaoyan-unit">天</span>
                </>
              ) : countdown === 0 ? (
                <span className="kaoyan-today">今天是考研日！加油！</span>
              ) : (
                <span className="kaoyan-past">考研已结束</span>
              )}
            </div>
            <div className="kaoyan-date">目标：{kaoyanDate}（点击修改）</div>
          </div>
        </div>
      </div>

      {showKaoyanEdit && (
        <div className="modal" onClick={() => setShowKaoyanEdit(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>设置考研日期</h3>
            <div className="form-group">
              <label>考研日期</label>
              <input
                type="date"
                value={kaoyanInput}
                onChange={e => setKaoyanInput(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowKaoyanEdit(false)}>取消</button>
              <button className="btn btn-primary" onClick={saveKaoyanDate}>保存</button>
            </div>
          </div>
        </div>
      )}

      <h2>我的任务</h2>
      {tasks.length === 0 ? (
        <div className="empty-state">暂无任务，请等待老师发布</div>
      ) : (
        <div className="card-grid">
          {tasks.map(task => (
            <div key={task.id} className="card">
              <div className="card-header">
                <h3>{task.name}</h3>
                {statusBadge(task.status)}
              </div>
              <div className="card-body">
                <p className="muted">词表：{task.word_list_name}</p>
                <p className="muted">单词数：{task.total_words}</p>
                {task.deadline && <p className="muted">截止：{new Date(task.deadline).toLocaleString()}</p>}
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: (task.study_progress || 0) + '%' }} />
                </div>
                <p className="muted small">学习进度 {Math.round(task.study_progress || 0)}%{task.test_score != null && ` · 测试 ${Math.round(task.test_score)}分`}</p>
              </div>
              <div className="card-footer">
                <Link to={`/student/task/${task.id}/study`} className="btn btn-outline">背单词</Link>
                <Link to={`/student/task/${task.id}/test`} className="btn btn-primary">开始测试</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
