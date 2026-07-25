import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function CommentsStudent() {
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    try {
      const data = await api.getComments();
      setComments(data.comments || data || []);
    } finally {
      setLoading(false);
    }
  };

  const isNew = (createdAt) => {
    if (!createdAt) return false;
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff < 3 * 24 * 60 * 60 * 1000;
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="progress-view">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>老师留言</h2>
        <div />
      </div>

      {comments.length === 0 ? (
        <div className="empty-state">暂无留言</div>
      ) : (
        <div className="comment-list">
          {comments.map((c, i) => (
            <div
              key={c.id || i}
              className={'comment-card' + (isNew(c.created_at) ? ' new-comment' : '')}
            >
              <div className="comment-header">
                <div className="comment-teacher">👨‍🏫 {c.teacher_name || '老师'}</div>
                {isNew(c.created_at) && <span className="badge badge-blue">新</span>}
              </div>
              {c.task_name && <div className="comment-task">📋 {c.task_name}</div>}
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
