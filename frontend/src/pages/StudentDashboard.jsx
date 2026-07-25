import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

export default function StudentDashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data.tasks);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="dashboard">
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
