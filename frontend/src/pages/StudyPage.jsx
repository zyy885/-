import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { speak, speakSentence, getExampleFromDictionary, stopAll } from '../utils/speech.js';

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
  const [hints, setHints] = useState({ firstLetter: false, example: false, image: false, syllable: false });
  const [fetchedExamples, setFetchedExamples] = useState({});
  const [loadingWords, setLoadingWords] = useState({});
  const fetchedRef = useRef({});
  const loadingRef = useRef({});

  useEffect(() => {
    loadFavs();
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
    };
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

  useEffect(() => {
    const word = words[idx];
    if (word && !word.example && !fetchedRef.current[word.id] && !loadingRef.current[word.id]) {
      loadingRef.current[word.id] = true;
      setLoadingWords(prev => ({ ...prev, [word.id]: true }));
      getExampleFromDictionary(word.word).then(ex => {
        loadingRef.current[word.id] = false;
        if (ex) {
          fetchedRef.current[word.id] = ex;
          setFetchedExamples(prev => ({ ...prev, [word.id]: ex }));
        }
        setLoadingWords(prev => ({ ...prev, [word.id]: false }));
      }).catch(() => {
        loadingRef.current[word.id] = false;
        setLoadingWords(prev => ({ ...prev, [word.id]: false }));
      });
    }
  }, [idx, words]);

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
    setHints({ firstLetter: false, example: false, image: false, syllable: false });
    if (idx < words.length - 1) {
      setIdx(idx + 1);
    }
  };

  const prev = () => {
    setShowMeaning(false);
    setHints({ firstLetter: false, example: false, image: false, syllable: false });
    if (idx > 0) setIdx(idx - 1);
  };

  const toggleHint = (key) => {
    setHints({ ...hints, [key]: !hints[key] });
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (words.length === 0) return <div className="empty-state">该词表暂无单词</div>;

  const word = words[idx];
  const studiedCount = Object.keys(studiedMap).length;
  const progress = (studiedCount / words.length) * 100;

  const firstLetterHint = word.word.charAt(0).toUpperCase() + '... (' + word.word.length + '个字母)';
  const syllableHint = word.word.replace(/[^aeiouAEIOU]/g, '').length + ' 个元音';
  const effectiveExample = word.example || fetchedExamples[word.id] || '';
  const exampleWithBlank = effectiveExample
    ? effectiveExample.replace(new RegExp('\\b' + word.word + '\\b', 'gi'), '______')
    : '';

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

      {!showMeaning && (
        <div className="hint-buttons">
          <button
            className={'btn btn-sm ' + (hints.firstLetter ? 'btn-primary' : 'btn-outline')}
            onClick={() => toggleHint('firstLetter')}
          >💡 首字母提示</button>
          <button
            className={'btn btn-sm ' + (hints.syllable ? 'btn-primary' : 'btn-outline')}
            onClick={() => toggleHint('syllable')}
          >🔤 音节提示</button>
          <button
            className={'btn btn-sm ' + (hints.example ? 'btn-primary' : 'btn-outline')}
            onClick={() => toggleHint('example')}
          >📝 例句提示</button>
          <button
            className={'btn btn-sm ' + (hints.image ? 'btn-primary' : 'btn-outline')}
            onClick={() => toggleHint('image')}
          >🖼️ 图片提示</button>
        </div>
      )}

      {hints.firstLetter && !showMeaning && (
        <div className="hint-panel">
          <span className="badge badge-blue">首字母提示</span>
          <span className="hint-text-large">{firstLetterHint}</span>
        </div>
      )}
      {hints.syllable && !showMeaning && (
        <div className="hint-panel">
          <span className="badge badge-green">音节提示</span>
          <span className="hint-text-large">{syllableHint}</span>
        </div>
      )}
      {hints.example && !showMeaning && effectiveExample && (
        <div className="hint-panel">
          <span className="badge badge-orange">例句提示</span>
          <span className="hint-text-large">{exampleWithBlank}</span>
        </div>
      )}
      {hints.image && !showMeaning && (
        <div className="hint-panel" style={{ justifyContent: 'center' }}>
          <img
            src={'https://image.pollinations.ai/prompt/' + encodeURIComponent(word.word + ' ' + (word.meaning || '')) + '?width=400&height=300&nologo=true&seed=' + word.id}
            alt="提示图片"
            style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 260 }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://picsum.photos/seed/' + encodeURIComponent(word.word) + '/400/300';
            }}
          />
        </div>
      )}

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
            {(effectiveExample || loadingWords[word.id]) && (
              <p className="example" style={{ textAlign: 'left', padding: '12px 16px', background: 'rgba(255,255,255,0.15)', borderRadius: 10, marginTop: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>📝 例句：</span>
                  {effectiveExample && (
                    <button
                      className="icon-btn"
                      style={{ color: 'white', fontSize: 16, padding: '2px 6px' }}
                      onClick={(e) => { e.stopPropagation(); speakSentence(effectiveExample); }}
                      title="朗读例句"
                    >🔊</button>
                  )}
                </span>
                {loadingWords[word.id] && !effectiveExample ? (
                  <span style={{ opacity: 0.7 }}>正在加载例句...</span>
                ) : (
                  <span>{effectiveExample}</span>
                )}
              </p>
            )}
            {hints.image || showMeaning ? (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <img
                  src={'https://image.pollinations.ai/prompt/' + encodeURIComponent(word.word + ' ' + (word.meaning || '')) + '?width=400&height=250&nologo=true&seed=' + word.id}
                  alt="关联图片"
                  style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 220 }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://picsum.photos/seed/' + encodeURIComponent(word.word) + '/400/250';
                  }}
                />
              </div>
            ) : null}
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
