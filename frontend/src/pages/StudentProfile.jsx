import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const [usersRes, commentsRes] = await Promise.all([
        api.getUsers(),
        api.getComments(),
      ]);
      const users = usersRes.users || usersRes || [];
      const found = users.find(u => u.id === Number(id));
      setStudent(found);
      const allComments = commentsRes.comments || commentsRes || [];
      setComments(allComments.filter(c => c.student_id === Number(id)));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  if (!student) return <div className="empty-state">未找到该学生</div>;

  return (
    <div className="progress-view">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>学生详情</h2>
        <div />
      </div>

      <div className="card" style={{ maxWidth: 600, margin: '24px auto' }}>
        <div style={{ fontSize: 48, textAlign: 'center' }}>🎒</div>
        <h3 style={{ textAlign: 'center' }}>{student.username}</h3>
        <p className="muted" style={{ textAlign: 'center' }}>
          注册时间：{new Date(student.created_at).toLocaleString()}
        </p>
      </div>

      <h3>老师留言 ({comments.length})</h3>
      {comments.length === 0 ? (
        <div className="empty-state">暂无留言</div>
      ) : (
        <div className="comment-list">
          {comments.map((c, i) => (
            <div key={c.id || i} className="comment-card">
              <div className="comment-header">
                <div className="comment-teacher">
                  👨‍🏫 {c.teacher_name || '老师'}
                  {c.task_name && <span className="muted small" style={{ marginLeft: 12 }}>📋 {c.task_name}</span>}
                </div>
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
