import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function StudyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState([]);
  const [studiedMap, setStudiedMap] = useState({});
  const [tsId, setTsId] = useState(null);
  const [idx, setIdx] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [favMap, setFavMap] = useState({});

  const speak = (w) => {
    try { const u = new SpeechSynthesisUtterance(w); u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {}
  };

  useEffect(() => {
    loadFavs();
  }, []);

  const loadFavs = async () => {
    try {
      const d = await api.getFavorites();
      const m = {};
      for (const f of d.favorites) m[f.word_id] = true;
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
    } catch (e) { alert(e.message); }
  };

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const data = await api.getStudyWords(id);
      setWords(data.words);
      setStudiedMap(data.studiedMap || {});
      setTsId(data.taskStudentId);
    } catch (e) {
      alert(e.message);
      navigate('/student');
    } finally {
      setLoading(false);
    }
  };

  const markKnown = async (known) => {
    const word = words[idx];
    if (!word || !tsId) return;
    try {
      await api.saveStudyRecord({ task_student_id: tsId, word_id: word.id, is_known: known });
      setStudiedMap({ ...studiedMap, [word.id]: known ? 1 : 0 });
      next();
    } catch (e) {
      alert(e.message);
    }
  };

  const next = () => {
    setShowMeaning(false);
    if (idx < words.length - 1) {
      setIdx(idx + 1);
    }
  };

  const prev = () => {
    setShowMeaning(false);
    if (idx > 0) setIdx(idx - 1);
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (words.length === 0) return <div className="empty-state">该词表暂无单词</div>;

  const word = words[idx];
  const studiedCount = Object.keys(studiedMap).length;
  const progress = (studiedCount / words.length) * 100;

  return (
    <div className="study-page">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>背单词 ({idx + 1}/{words.length})</h2>
        <Link to={`/student/task/${id}/test`} className="btn btn-primary btn-sm">去测试</Link>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: progress + '%' }} />
      </div>
      <p className="muted small center">已学习 {studiedCount}/{words.length} 个</p>

      <div className="flashcard" onClick={() => setShowMeaning(!showMeaning)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div className="flashcard-word">{word.word}</div>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); speak(word.word); }}
            title="发音"
          >🔊</button>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); toggleFav(word); }}
            title="收藏"
          >{favMap[word.id] ? '⭐' : '☆'}</button>
        </div>
        {showMeaning && (
          <div className="flashcard-meaning">
            <p className="meaning-text">{word.meaning}</p>
            {word.example && <p className="example">例句：{word.example}</p>}
          </div>
        )}
        {!showMeaning && <p className="hint-text">点击卡片查看释义</p>}
        {studiedMap[word.id] != null && (
          <div className={'studied-badge ' + (studiedMap[word.id] ? 'known' : 'unknown')}>
            {studiedMap[word.id] ? '✓ 已标记为认识' : '✗ 已标记为不认识'}
          </div>
        )}
      </div>

      <div className="study-controls">
        <button className="btn btn-outline" onClick={prev} disabled={idx === 0}>上一个</button>
        <button className="btn btn-danger" onClick={() => markKnown(false)}>😵 不认识</button>
        <button className="btn btn-success" onClick={() => markKnown(true)}>😊 认识</button>
        <button className="btn btn-outline" onClick={next} disabled={idx === words.length - 1}>下一个</button>
      </div>
    </div>
  );
}
