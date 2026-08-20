import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { speak, preloadWordAudio } from '../utils/speech.js';

const chineseNumMap = { '零':0, '一':1, '二':2, '两':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '百':100, '千':1000, '万':10000 };
const chineseToNum = (s) => {
  s = s.trim();
  if (/^\d+$/.test(s)) return parseInt(s);
  let total = 0, temp = 0, lastUnit = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const v = chineseNumMap[c];
    if (v === undefined) continue;
    if (v >= 10) {
      if (temp === 0) temp = 1;
      temp *= v;
      if (v >= 100) { total += temp; temp = 0; }
      lastUnit = v;
    } else {
      if (lastUnit >= 10) { total += temp; temp = 0; }
      temp = v;
      lastUnit = 1;
    }
  }
  return total + temp;
};
const parseSeqName = (name) => {
  if (!name) return null;
  const patterns = [
    /^第([零一二三四五六七八九十百千万两\d]+)[页节章单元天]/,
    /^第([零一二三四五六七八九十百千万两\d]+)$/,
    /^([零一二三四五六七八九十百千万两\d]+)[页节章单元天]/,
    /List\s*(\d+)/i,
    /Unit\s*(\d+)/i,
    /Lesson\s*(\d+)/i,
    /(\d+)/,
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) {
      const n = chineseToNum(m[1]);
      if (n > 0) return { num: n };
    }
  }
  return null;
};
const sortListsBySeq = (lists) => {
  return [...lists].sort((a, b) => {
    if (a.sort_order !== undefined && b.sort_order !== undefined && a.sort_order !== null && b.sort_order !== null) {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    }
    const pa = parseSeqName(a.name);
    const pb = parseSeqName(b.name);
    if (pa && pb) return pa.num - pb.num;
    if (pa) return -1;
    if (pb) return 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
};

export default function StudentWordLists() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wordBooks, setWordBooks] = useState([]);
  const [allLists, setAllLists] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedList, setSelectedList] = useState(null);
  const [words, setWords] = useState([]);
  const [favMap, setFavMap] = useState({});
  const [flippedMap, setFlippedMap] = useState({});
  const [preloadedAudios, setPreloadedAudios] = useState({});

  useEffect(() => {
    loadAll();
    loadFavs();
  }, []);

  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        loadAll();
        loadFavs();
      }
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
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
      setAllLists(sortListsBySeq(wlData.wordLists));
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
    setFlippedMap({});
    const data = await api.getWords(list.id);
    setWords(data.words);
    // 批量后台预加载单词音频（不阻塞）
    if (data.words && data.words.length) {
      setTimeout(() => {
        data.words.forEach((w, idx) => {
          // 分批预加载，避免一次性网络请求过多
          setTimeout(() => preloadWordAudio(w.word), idx * 150);
        });
      }, 200);
    }
  };

  const toggleFlip = (wordId) => {
    setFlippedMap(prev => ({ ...prev, [wordId]: !prev[wordId] }));
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
        <button
          className="btn-link"
          onClick={() => { loadAll(); loadFavs(); }}
          title="刷新"
        >🔄 刷新</button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              📋 词表列表
              <span className="muted small" style={{ marginLeft: 8 }}>共 {getListsForBook(selectedBook.id).length} 个</span>
            </h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/student/self-test?word_book_id=${selectedBook.id}`)}
            >📝 整本书自测</button>
          </div>
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
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/student/self-test?word_list_id=${selectedList.id}`)}
            >📝 开始自测</button>
          </div>
          <div className="word-cards">
            {words.map((w, i) => {
              const isFlipped = !!flippedMap[w.id];
              return (
                <div
                  key={w.id}
                  className={`flip-card ${isFlipped ? 'flipped' : ''}`}
                  onClick={() => toggleFlip(w.id)}
                >
                  <div className="flip-card-inner">
                    {/* 正面：单词 */}
                    <div className="flip-card-front word-card">
                      <div className="word-card-top">
                        <span className="word-index">{i + 1}</span>
                        <div className="word-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="icon-btn" onClick={() => speak(w.word)} title="发音">🔊</button>
                          <button
                            className="icon-btn"
                            onClick={() => toggleFav(w)}
                            title={favMap[w.id] ? '取消收藏' : '收藏'}
                          >{favMap[w.id] ? '⭐' : '☆'}</button>
                        </div>
                      </div>
                      <div className="word-card-word">{w.word}</div>
                      <div className="flip-hint">👆 点击卡片查看释义</div>
                    </div>
                    {/* 背面：释义+例句 */}
                    <div className="flip-card-back word-card word-card-back">
                      <div className="word-card-top">
                        <span className="word-index">{i + 1}</span>
                        <div className="word-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="icon-btn" onClick={() => speak(w.word)} title="发音">🔊</button>
                          <button
                            className="icon-btn"
                            onClick={() => toggleFav(w)}
                            title={favMap[w.id] ? '取消收藏' : '收藏'}
                          >{favMap[w.id] ? '⭐' : '☆'}</button>
                        </div>
                      </div>
                      <div className="word-card-word-small">{w.word}</div>
                      <div className="word-card-meaning">{w.meaning}</div>
                      {w.example && <div className="word-card-example">📝 {w.example}</div>}
                      <div className="flip-hint">👆 点击返回单词</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {words.length === 0 && <div className="empty-state-small">该词表暂无单词</div>}
          </div>
        </div>
      )}
    </div>
  );
}
