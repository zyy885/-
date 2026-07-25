import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function CommentsTeacher() {
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ student_id: '', task_id: '', content: '' });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [c, s, t] = await Promise.all([
        api.getComments(),
        api.getStudents(),
        api.getTasks(),
      ]);
      setComments(c.comments || c || []);
      setStudents(s.students || s || []);
      setTasks(t.tasks || t || []);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!form.student_id) return alert('请选择学生');
    if (!form.content.trim()) return alert('请输入留言内容');
    try {
      await api.addComment({
        student_id: Number(form.student_id),
        task_id: form.task_id ? Number(form.task_id) : null,
        content: form.content,
      });
      setForm({ student_id: '', task_id: '', content: '' });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (c) => {
    if (!confirm('确定删除该留言？')) return;
    try {
      await api.deleteComment(c.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="progress-view">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>老师留言</h2>
        <div />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>新增留言</h3>
        <div className="form-row">
          <div className="form-group"><label>选择学生</label>
            <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}>
              <option value="">请选择学生</option>
              {students.map(s => <option key={s.id} value={s.id}>🎒 {s.username}</option>)}
            </select>
          </div>
          <div className="form-group"><label>关联任务（可选）</label>
            <select value={form.task_id} onChange={e => setForm({ ...form, task_id: e.target.value })}>
              <option value="">不关联任务</option>
              {tasks.map(t => <option key={t.id} value={t.id}>📋 {t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label>留言内容</label>
          <textarea
            rows={4}
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="请输入留言内容..."
          />
        </div>
        <button className="btn btn-primary" onClick={submit}>发送留言</button>
      </div>

      <h3>已有留言</h3>
      {comments.length === 0 ? (
        <div className="empty-state">暂无留言</div>
      ) : (
        <div className="comment-list">
          {comments.map((c, i) => (
            <div key={c.id || i} className="comment-card">
              <div className="comment-header">
                <div className="comment-teacher">
                  🎒 {c.student_name || '学生'}
                  {c.task_name && <span className="muted small" style={{ marginLeft: 12 }}>📋 {c.task_name}</span>}
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>删除</button>
              </div>
              <div className="comment-content">{c.content}</div>
              <div className="comment-time muted small">
                {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
