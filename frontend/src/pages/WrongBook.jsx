import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function speak(word) {
  try { const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {}
}

export default function WrongBook() {
  const navigate = useNavigate();
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [sort, setSort] = useState('error_count');
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [reviewResults, setReviewResults] = useState({ known: [], unknown: [] });

  useEffect(() => {
    loadData();
  }, [sort]);

  const loadData = async () => {
    try {
      const [wrongData, favData] = await Promise.all([
        api.getWrongBook(sort),
        api.getFavorites()
      ]);
      setWords(wrongData.wrongWords || wrongData.words || wrongData || []);
      const favList = favData.favorites || favData.words || favData || [];
      setFavorites(favList.map(w => w.id || w.word_id));
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (wordId, e) => {
    e.stopPropagation();
    try {
      if (favorites.includes(wordId)) {
        await api.deleteFavorite(wordId);
        setFavorites(favorites.filter(id => id !== wordId));
      } else {
        await api.addFavorite(wordId);
        setFavorites([...favorites, wordId]);
      }
    } catch (err) {}
  };

  const startReview = () => {
    if (words.length === 0) return;
    setReviewMode(true);
    setReviewIdx(0);
    setShowMeaning(false);
    setReviewResults({ known: [], unknown: [] });
  };

  const markKnown = () => {
    const w = words[reviewIdx];
    const newResults = { ...reviewResults, known: [...reviewResults.known, w.id] };
    setReviewResults(newResults);
    nextReview();
  };

  const markUnknown = () => {
    const w = words[reviewIdx];
    const newResults = { ...reviewResults, unknown: [...reviewResults.unknown, w.id] };
    setReviewResults(newResults);
    nextReview();
  };

  const nextReview = () => {
    setShowMeaning(false);
    if (reviewIdx < words.length - 1) {
      setReviewIdx(reviewIdx + 1);
    } else {
      setReviewMode(false);
    }
  };

  if (reviewMode && words.length > 0) {
    const current = words[reviewIdx];
    const progress = ((reviewIdx + 1) / words.length) * 100;
    return (
      <div className="review-mode">
        <div className="page-header">
          <button className="btn-link" onClick={() => setReviewMode(false)}>← 退出复习</button>
          <h2>错题复习 ({reviewIdx + 1}/{words.length})</h2>
          <div />
        </div>
        <div className="review-progress">
          <div className="review-progress-bar" style={{ width: progress + '%' }} />
        </div>
        <div className="review-card" onClick={() => setShowMeaning(!showMeaning)}>
          <button className="icon-btn review-speak" onClick={(e) => { e.stopPropagation(); speak(current.word); }} title="发音">🔊</button>
          <div className="review-word">{current.word}</div>
          {showMeaning ? (
            <>
              <div className="review-meaning">{current.meaning}</div>
              {current.example && <div className="review-example">📝 {current.example}</div>}
            </>
          ) : (
            <div className="review-hint">👆 点击查看释义</div>
          )}
        </div>
        <div className="review-actions">
          <button className="btn btn-danger btn-lg" onClick={markUnknown}>❌ 不认识</button>
          <button className="btn btn-success btn-lg" onClick={markKnown}>✅ 认识</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">加载中...</div>;

  const totalErrors = words.reduce((s, w) => s + (w.error_count || 0), 0);
  const totalTests = words.reduce((s, w) => s + (w.error_count || 0) + (w.correct_count || 0), 0);

  return (
    <div className="word-manage">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>错题本</h2>
        <div />
      </div>

      <div className="stats-row">
        <div className="mini-stat">
          <div className="mini-stat-num">{words.length}</div>
          <div className="mini-stat-label">错题数</div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-num">{totalErrors}</div>
          <div className="mini-stat-label">总错误次数</div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-num">{totalTests > 0 ? Math.round(totalErrors / totalTests * 100) : 0}%</div>
          <div className="mini-stat-label">错误率</div>
        </div>
        <button
          className="btn btn-primary"
          disabled={words.length === 0}
          onClick={startReview}
        >📖 开始复习</button>
      </div>

      <div className="main-panel">
        <div className="panel-header">
          <h3>做错的单词</h3>
          <div className="sort-controls">
            <span className="muted small" style={{ marginRight: 8 }}>排序：</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="select-sm">
              <option value="error_count">错误次数</option>
              <option value="recent">最近错误</option>
              <option value="word">字母顺序</option>
            </select>
          </div>
        </div>
        <div className="word-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>单词</th>
                <th>释义</th>
                <th>❌错误</th>
                <th>✅正确</th>
                <th>最近测试</th>
                <th>来源词表</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr key={w.id || w.word_id || i}>
                  <td>{i + 1}</td>
                  <td><strong>{w.word}</strong></td>
                  <td>{w.meaning}</td>
                  <td>
                    <span className="badge badge-red" title="错误次数">{w.error_count || 0}</span>
                  </td>
                  <td>
                    <span className="badge badge-green">{w.correct_count || 0}</span>
                  </td>
                  <td className="muted small">
                    {w.last_tested_at ? new Date(w.last_tested_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="muted small">{w.word_list_name || '-'}</td>
                  <td>
                    <button className="icon-btn" onClick={() => speak(w.word)} title="发音">🔊</button>
                    <button
                      className="icon-btn"
                      onClick={(e) => toggleFavorite(w.id || w.word_id, e)}
                      title={favorites.includes(w.id || w.word_id) ? '取消收藏' : '收藏'}
                    >
                      {favorites.includes(w.id || w.word_id) ? '⭐' : '☆'}
                    </button>
                  </td>
                </tr>
              ))}
              {words.length === 0 && <tr><td colSpan="8" className="empty-state">暂无错题，继续保持！🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
