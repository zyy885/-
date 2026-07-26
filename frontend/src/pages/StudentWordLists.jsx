import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function speak(word) {
  try { const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {}
}

export default function StudentWordLists() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wordBooks, setWordBooks] = useState([]);
  const [allLists, setAllLists] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedList, setSelectedList] = useState(null);
  const [words, setWords] = useState([]);
  const [favMap, setFavMap] = useState({});

  useEffect(() => {
    loadAll();
    loadFavs();
  }, []);

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

  const loadAll = async () => {
    try {
      const [wbData, wlData] = await Promise.all([
        api.getWordBooks(),
        api.getWordLists(),
      ]);
      setWordBooks(wbData.wordBooks);
      setAllLists(wlData.wordLists);
    } catch (e) {}
    setLoading(false);
  };

  const selectBook = async (book) => {
    setSelectedBook(book);
    setSelectedList(null);
    setWords([]);
  };

  const selectList = async (list) => {
    setSelectedList(list);
    const data = await api.getWords(list.id);
    setWords(data.words);
  };

  const goBack = () => {
    if (selectedList) {
      setSelectedList(null);
      setWords([]);
    } else if (selectedBook) {
      setSelectedBook(null);
    } else {
      navigate(-1);
    }
  };

  const getListsForBook = (bookId) => {
    if (bookId === null) return allLists.filter(l => l.word_book_id == null);
    return allLists.filter(l => l.word_book_id === bookId);
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="word-browse-page">
      <div className="page-header">
        <button className="btn-link" onClick={goBack}>
          {selectedList ? '← 返回词表' : selectedBook ? '← 返回单词书' : '← 返回'}
        </button>
        <h2>
          {selectedList ? selectedList.name : selectedBook ? selectedBook.name : '词表总览'}
        </h2>
        <div />
      </div>

      {!selectedBook && !selectedList && (
        <>
          <div className="browse-section">
            <h3 className="section-title">
              📚 我的单词书
              <span className="muted small" style={{ marginLeft: 8 }}>共 {wordBooks.length} 本</span>
            </h3>
            {wordBooks.length === 0 ? (
              <div className="empty-state-small">暂无单词书</div>
            ) : (
              <div className="book-cover-grid">
                {wordBooks.map(book => (
                  <div
                    key={book.id}
                    className="book-cover-wrapper"
                    onClick={() => selectBook(book)}
                  >
                    <div className="book-cover" style={{
                      '--book-color': book.cover_color || '#6366f1'
                    }}>
                      <div className="book-cover-spine" />
                      <div className="book-cover-face" style={{
                        background: book.cover_image
                          ? `url(${book.cover_image}) center/cover no-repeat`
                          : `linear-gradient(135deg, ${book.cover_color || '#6366f1'}dd 0%, ${book.cover_color || '#6366f1'}aa 100%)`
                      }}>
                        {!book.cover_image && (
                          <div className="book-cover-inner">
                            <div className="book-cover-icon">📖</div>
                            <div className="book-cover-title">{book.name}</div>
                          </div>
                        )}
                        {book.cover_image && (
                          <div className="book-cover-overlay">
                            <div className="book-cover-title-light">{book.name}</div>
                          </div>
                        )}
                      </div>
                      <div className="book-cover-shadow" />
                    </div>
                    <div className="book-cover-info">
                      <div className="book-cover-name">{book.name}</div>
                      <div className="book-cover-meta">
                        <span>📋 {book.list_count || 0} 词表</span>
                        <span>🔤 {book.word_count || 0} 词</span>
                        {book.is_public && <span className="badge badge-green">公开</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {getListsForBook(null).length > 0 && (
            <div className="browse-section">
              <h3 className="section-title">
                📁 未分类词表
                <span className="muted small" style={{ marginLeft: 8 }}>共 {getListsForBook(null).length} 个</span>
              </h3>
              <div className="browse-grid">
                {getListsForBook(null).map(list => (
                  <div
                    key={list.id}
                    className="browse-card list-card"
                    onClick={() => selectList(list)}
                  >
                    <div className="browse-icon">📋</div>
                    <div className="browse-title">{list.name}</div>
                    <div className="browse-meta">
                      <span>🔤 {list.word_count || 0} 词</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selectedBook && !selectedList && (
        <div className="browse-section">
          {selectedBook.description && (
            <p className="muted" style={{ marginBottom: 16 }}>{selectedBook.description}</p>
          )}
          <h3 className="section-title">
            📋 词表列表
            <span className="muted small" style={{ marginLeft: 8 }}>共 {getListsForBook(selectedBook.id).length} 个</span>
          </h3>
          {getListsForBook(selectedBook.id).length === 0 ? (
            <div className="empty-state-small">该书下暂无词表</div>
          ) : (
            <div className="browse-grid">
              {getListsForBook(selectedBook.id).map(list => (
                <div
                  key={list.id}
                  className="browse-card list-card"
                  onClick={() => selectList(list)}
                >
                  <div className="browse-icon">📋</div>
                  <div className="browse-title">{list.name}</div>
                  {list.description && <div className="browse-desc">{list.description}</div>}
                  <div className="browse-meta">
                    <span>🔤 {list.word_count || 0} 词</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedList && (
        <div className="browse-section">
          <div className="word-list-header">
            <span className="muted small">共 {words.length} 个单词</span>
          </div>
          <div className="word-cards">
            {words.map((w, i) => (
              <div key={w.id} className="word-card">
                <div className="word-card-top">
                  <span className="word-index">{i + 1}</span>
                  <div className="word-card-actions">
                    <button className="icon-btn" onClick={() => speak(w.word)} title="发音">🔊</button>
                    <button
                      className="icon-btn"
                      onClick={() => toggleFav(w)}
                      title={favMap[w.id] ? '取消收藏' : '收藏'}
                    >{favMap[w.id] ? '⭐' : '☆'}</button>
                  </div>
                </div>
                <div className="word-card-word">{w.word}</div>
                <div className="word-card-meaning">{w.meaning}</div>
                {w.example && <div className="word-card-example">📝 {w.example}</div>}
              </div>
            ))}
            {words.length === 0 && <div className="empty-state-small">该词表暂无单词</div>}
          </div>
        </div>
      )}
    </div>
  );
}
