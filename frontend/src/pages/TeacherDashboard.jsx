import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function TeacherDashboard() {
  const [stats, setStats] = useState({ wordLists: 0, tasks: 0, students: 0 });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [wl, tk, st] = await Promise.all([
        api.getWordLists(),
        api.getTasks(),
        api.getStudents(),
      ]);
      setStats({ wordLists: wl.wordLists.length, tasks: tk.tasks.length, students: st.students.length });
      setTasks(tk.tasks);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="dashboard">
      <h2>老师总览</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-num">{stats.wordLists}</div>
          <div className="stat-label">词表</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{stats.tasks}</div>
          <div className="stat-label">任务</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{stats.students}</div>
          <div className="stat-label">学生</div>
        </div>
      </div>
      <div className="quick-actions">
        <Link to="/teacher/word-lists" className="btn btn-primary">管理词表</Link>
        <Link to="/teacher/tasks" className="btn btn-outline">发布任务</Link>
      </div>
      <h3>最近任务</h3>
      {tasks.length === 0 ? (
        <div className="empty-state">暂无任务</div>
      ) : (
        <div className="card-grid">
          {tasks.slice(0, 6).map(task => (
            <div key={task.id} className="card">
              <div className="card-header">
                <h3>{task.name}</h3>
                <span className="badge badge-blue">{task.student_count}人</span>
              </div>
              <div className="card-body">
                <p className="muted">词表：{task.word_list_name}</p>
                {task.deadline && <p className="muted">截止：{new Date(task.deadline).toLocaleString()}</p>}
              </div>
              <div className="card-footer">
                <Link to={`/teacher/tasks/${task.id}/progress`} className="btn btn-outline">查看进度</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
