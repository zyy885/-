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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [wrongData, favData] = await Promise.all([
        api.getWrongBook(),
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

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="word-manage">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>错题本</h2>
        <div />
      </div>

      <div className="main-panel">
        <div className="panel-header">
          <h3>做错的单词 ({words.length})</h3>
          <div />
        </div>
        <div className="word-table">
          <table>
            <thead>
              <tr><th>#</th><th>单词</th><th>释义</th><th>例句</th><th>来源词表</th><th>操作</th></tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr key={w.id || w.word_id || i}>
                  <td>{i + 1}</td>
                  <td><strong>{w.word}</strong></td>
                  <td>{w.meaning}</td>
                  <td className="muted small">{w.example || '-'}</td>
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
              {words.length === 0 && <tr><td colSpan="6" className="empty-state">暂无错题</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
