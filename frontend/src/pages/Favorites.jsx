import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { speak } from '../utils/speech.js';

export default function Favorites() {
  const navigate = useNavigate();
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const data = await api.getFavorites();
      setWords(data.favorites || data.words || data || []);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (wordId, e) => {
    e.stopPropagation();
    try {
      await api.deleteFavorite(wordId);
      setWords(words.filter(w => (w.id || w.word_id) !== wordId));
    } catch (err) {}
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="word-manage">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>收藏单词</h2>
        <div />
      </div>

      <div className="main-panel">
        <div className="panel-header">
          <h3>我的收藏 ({words.length})</h3>
          <div />
        </div>
        <div className="word-table">
          <table>
            <thead>
              <tr><th>#</th><th>单词</th><th>释义</th><th>例句</th><th>操作</th></tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr key={w.id || w.word_id || i}>
                  <td>{i + 1}</td>
                  <td><strong>{w.word}</strong></td>
                  <td>{w.meaning}</td>
                  <td className="muted small">{w.example || '-'}</td>
                  <td>
                    <button className="icon-btn" onClick={() => speak(w.word)} title="发音">🔊</button>
                    <button
                      className="icon-btn"
                      onClick={(e) => removeFavorite(w.id || w.word_id, e)}
                      title="取消收藏"
                    >
                      ⭐
                    </button>
                  </td>
                </tr>
              ))}
              {words.length === 0 && <tr><td colSpan="5" className="empty-state">暂无收藏的单词</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
