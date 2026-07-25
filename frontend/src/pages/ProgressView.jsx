import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
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

export default function ProgressView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ progress: [], words: [] });
  const [commentModal, setCommentModal] = useState(null);
  const [commentContent, setCommentContent] = useState('');
  const [testRecordsModal, setTestRecordsModal] = useState(null);
  const [testRecordsLoading, setTestRecordsLoading] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const d = await api.getTaskProgress(id);
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (ts) => {
    if (!confirm(`确定重置「${ts.username}」的任务进度？`)) return;
    try {
      await api.resetTaskStudent(ts.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const openComment = (ts) => {
    setCommentModal(ts);
    setCommentContent('');
  };

  const submitComment = async () => {
    if (!commentContent.trim()) return alert('请输入评语内容');
    try {
      await api.addComment({
        student_id: commentModal.student_id,
        task_id: Number(id),
        content: commentContent,
      });
      alert('评语发送成功');
      setCommentModal(null);
      setCommentContent('');
    } catch (e) {
      alert(e.message);
    }
  };

  const openTestRecords = async (ts) => {
    setTestRecordsModal({ ...ts, records: [] });
    setTestRecordsLoading(true);
    try {
      const d = await api.getTestRecords(ts.id);
      setTestRecordsModal({ ...ts, records: d.records });
    } catch (e) {
      alert(e.message);
    } finally {
      setTestRecordsLoading(false);
    }
  };

  const toggleCorrect = async (rec) => {
    try {
      const newVal = rec.is_correct ? 0 : 1;
      const d = await api.updateTestRecord(rec.id, newVal);
      const updated = testRecordsModal.records.map(r =>
        r.id === rec.id ? { ...r, is_correct: newVal } : r
      );
      setTestRecordsModal({ ...testRecordsModal, records: updated, test_score: d.score });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleExport = () => {
    api.exportTaskScores(id);
  };

  if (loading) return <div className="loading">加载中...</div>;

  const { progress, words } = data;
  const avgProgress = progress.length > 0
    ? progress.reduce((s, p) => s + (p.study_progress || 0), 0) / progress.length
    : 0;
  const avgScore = progress.filter(p => p.test_score != null).length > 0
    ? progress.filter(p => p.test_score != null).reduce((s, p) => s + p.test_score, 0) / progress.filter(p => p.test_score != null).length
    : 0;
  const testedCount = progress.filter(p => p.test_score != null).length;

  return (
    <div className="progress-view">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>学生进度</h2>
        <button className="btn btn-outline" onClick={handleExport}>📊 导出成绩</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-num">{progress.length}</div>
          <div className="stat-label">分配学生</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{Math.round(avgProgress)}%</div>
          <div className="stat-label">平均学习进度</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{testedCount}/{progress.length}</div>
          <div className="stat-label">已完成测试</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{avgScore ? Math.round(avgScore) : '-'}分</div>
          <div className="stat-label">平均测试分数</div>
        </div>
      </div>

      <h3>词表单词 ({words.length})</h3>
      <div className="word-tags">
        {words.map(w => (
          <span key={w.id} className="word-tag">
            <strong>{w.word}</strong> - {w.meaning}
          </span>
        ))}
      </div>

      <h3>学生详情</h3>
      <div className="progress-table">
        <table>
          <thead>
            <tr>
              <th>学生</th>
              <th>状态</th>
              <th>学习进度</th>
              <th>测试分数</th>
              <th>最近学习</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {progress.map(p => (
              <tr key={p.id}>
                <td>🎒 {p.username}</td>
                <td>{statusBadge(p.status)}</td>
                <td>
                  <div className="progress-bar-small">
                    <div className="progress-fill" style={{ width: (p.study_progress || 0) + '%' }} />
                  </div>
                  <span className="muted small">{Math.round(p.study_progress || 0)}%</span>
                </td>
                <td>
                  {p.test_score != null ? (
                    <span className={'score ' + (p.test_score >= 80 ? 'good' : p.test_score >= 60 ? 'mid' : 'low')}>
                      {Math.round(p.test_score)}分
                    </span>
                  ) : <span className="muted">-</span>}
                </td>
                <td className="muted small">{p.last_studied_at ? new Date(p.last_studied_at).toLocaleString() : '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openComment(p)}>评语</button>
                    {p.test_score != null && (
                      <button className="btn btn-primary btn-sm" onClick={() => openTestRecords(p)}>查看答案</button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleReset(p)}>重置</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {commentModal && (
        <div className="modal" onClick={() => setCommentModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>给「{commentModal.username}」写评语</h3>
            <div className="form-group"><label>评语内容</label>
              <textarea
                rows={4}
                value={commentContent}
                onChange={e => setCommentContent(e.target.value)}
                placeholder="请输入评语内容..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setCommentModal(null)}>取消</button>
              <button className="btn btn-primary" onClick={submitComment}>发送</button>
            </div>
          </div>
        </div>
      )}

      {testRecordsModal && (
        <div className="modal" onClick={() => setTestRecordsModal(null)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h3>
              「{testRecordsModal.username}」的测试答案
              {testRecordsModal.test_score != null && (
                <span style={{ marginLeft: 12 }} className={'score ' + (testRecordsModal.test_score >= 80 ? 'good' : testRecordsModal.test_score >= 60 ? 'mid' : 'low')}>
                  {Math.round(testRecordsModal.test_score)}分
                </span>
              )}
            </h3>
            {testRecordsLoading ? (
              <div className="loading">加载中...</div>
            ) : testRecordsModal.records.length === 0 ? (
              <div className="empty-state">暂无测试记录</div>
            ) : (
              <div className="result-list" style={{ maxHeight: 500, overflowY: 'auto' }}>
                {testRecordsModal.records.map((r, i) => (
                  <div key={r.id} className={'result-item ' + (r.is_correct ? 'correct' : 'wrong')}>
                    <div className="result-num">{i + 1}</div>
                    <div className="result-content">
                      <p className="word-text">
                        <strong>{r.word}</strong>
                        {(r.question_type === 'zh_to_en' && <span className="badge badge-green" style={{ fontSize: 12, marginLeft: 8 }}>汉译英</span>}
                        {r.question_type !== 'zh_to_en' && <span className="badge badge-blue" style={{ fontSize: 12, marginLeft: 8 }}>英译汉</span>}
                      </p>
                      <p className="muted small">你的答案：{r.user_answer || '(空)'}</p>
                      <p className="muted small">正确答案：{(r.question_type || 'en_to_zh') === 'en_to_zh' ? r.meaning : r.word}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                      <div className="result-indicator">{r.is_correct ? '✓' : '✗'}</div>
                      <button
                        className={'btn btn-sm ' + (r.is_correct ? 'btn-outline' : 'btn-success')}
                        style={{ fontSize: 12 }}
                        onClick={() => toggleCorrect(r)}
                      >
                        {r.is_correct ? '改为错误' : '改为正确'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setTestRecordsModal(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
