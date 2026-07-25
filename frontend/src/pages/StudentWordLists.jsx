import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function speak(word) {
  try { const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {}
}

export default function StudentWordLists() {
  const navigate = useNavigate();
  const [wordBooks, setWordBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favMap, setFavMap] = useState({});

  useEffect(() => {
    loadWordBooks();
    loadFavs();
  }, []);

  useEffect(() => {
    loadLists(selectedBookId);
  }, [selectedBookId]);

  useEffect(() => {
    if (selectedId) loadWords(selectedId);
  }, [selectedId]);

  const loadFavs = async () => {
    try {
      const d = await api.getFavorites();
      const m = {};
      for (const f of (d.favorites || d || [])) m[f.word_id] = true;
      setFavMap(m);
    } catch (e) {}
  };

  const toggleFav = async (word) => {
    try {
      if (favMap[word.id]) {
        await api.deleteFavorite(word.id);
        const m = { ...favMap }; delete m[word.id]; setFavMap(m);
      } else {
        await api.addFavorite(word.id);
        setFavMap({ ...favMap, [word.id]: true });
      }
    } catch (e) {}
  };

  const loadWordBooks = async () => {
    try {
      const data = await api.getWordBooks();
      setWordBooks(data.wordBooks);
    } catch (e) {}
    setLoading(false);
  };

  const loadLists = async (bookId) => {
    try {
      const data = await api.getWordLists(bookId || undefined);
      setLists(data.wordLists);
      if (data.wordLists.length > 0) setSelectedId(data.wordLists[0].id);
      else setSelectedId(null);
    } catch (e) {}
  };

  const loadWords = async (id) => {
    const data = await api.getWords(id);
    setWords(data.words);
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="word-manage">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>词表总览</h2>
        <div />
      </div>

      <div className="manage-layout" style={{ gridTemplateColumns: '240px 280px 1fr' }}>
        <div className="sidebar">
          <h3>单词书</h3>
          <div
            className={'list-item' + (selectedBookId === null ? ' active' : '')}
            onClick={() => { setSelectedBookId(null); setSelectedId(null); }}
          >
            <div className="list-item-info">
              <div className="list-item-name">📁 全部词表</div>
              <div className="muted small">查看所有词表</div>
            </div>
          </div>
          {wordBooks.map(b => (
            <div
              key={b.id}
              className={'list-item' + (selectedBookId === b.id ? ' active' : '')}
              onClick={() => setSelectedBookId(b.id)}
            >
              <div className="list-item-info">
                <div className="list-item-name">📚 {b.name}</div>
                <div className="muted small">{b.list_count || 0} 个词表 · {b.word_count || 0} 词</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar">
          <h3>词表列表</h3>
          {lists.length === 0 && <div className="muted small">暂无词表</div>}
          {lists.map(l => (
            <div
              key={l.id}
              className={'list-item' + (selectedId === l.id ? ' active' : '')}
              onClick={() => setSelectedId(l.id)}
            >
              <div className="list-item-info">
                <div className="list-item-name">{l.name}</div>
                <div className="muted small">{l.word_count || 0} 个单词</div>
              </div>
            </div>
          ))}
        </div>

        <div className="main-panel">
          {selectedId ? (
            <>
              <div className="panel-header">
                <h3>{lists.find(l => l.id === selectedId)?.name} · 单词 ({words.length})</h3>
                <div />
              </div>
              <div className="word-table">
                <table>
                  <thead>
                    <tr><th>#</th><th>单词</th><th>释义</th><th>例句</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {words.map((w, i) => (
                      <tr key={w.id}>
                        <td>{i + 1}</td>
                        <td><strong>{w.word}</strong></td>
                        <td>{w.meaning}</td>
                        <td className="muted small">{w.example || '-'}</td>
                        <td>
                          <button className="icon-btn" onClick={() => speak(w.word)} title="发音">🔊</button>
                          <button
                            className="icon-btn"
                            onClick={() => toggleFav(w)}
                            title={favMap[w.id] ? '取消收藏' : '收藏'}
                          >
                            {favMap[w.id] ? '⭐' : '☆'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {words.length === 0 && <tr><td colSpan="5" className="empty-state">暂无单词</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">请选择一个词表</div>
          )}
        </div>
      </div>
    </div>
  );
}
