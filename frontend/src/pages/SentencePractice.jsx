import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getHomeRoute } from '../api.js';
import { speak } from '../utils/speech.js';

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

export default function SentencePractice() {
  const navigate = useNavigate();
  const goBack = () => { if (window.history.length > 2) navigate(-1); else navigate(getHomeRoute()); };
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userTranslation, setUserTranslation] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [mode, setMode] = useState('en_to_zh');
  const [records, setRecords] = useState([]);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedId) loadSentences(); }, [selectedId]);

  const load = async () => {
    try {
      const [listData, recData] = await Promise.all([
        api.getSentenceLists(),
        api.getTranslationRecords()
      ]);
      const sorted = sortListsBySeq(listData.sentenceLists || []);
      setLists(sorted);
      setRecords(recData.records || []);
      if (sorted.length > 0) setSelectedId(sorted[0].id);
    } finally { setLoading(false); }
  };

  const loadSentences = async () => {
    const data = await api.getSentences(selectedId);
    setSentences(data.sentences || []);
    setCurrentIndex(0);
    setShowAnswer(false);
    setUserTranslation('');
  };

  const submitAnswer = async (selfCorrect) => {
    const cur = sentences[currentIndex];
    if (!cur) return;
    try {
      await api.submitTranslation({
        sentence_id: cur.id,
        user_translation: userTranslation,
        is_correct: selfCorrect ? 1 : 0
      });
      const data = await api.getTranslationRecords();
      setRecords(data.records || []);
    } catch (e) {}
  };

  const next = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setUserTranslation('');
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
      setUserTranslation('');
    }
  };

  const shuffle = () => {
    const shuffled = [...sentences].sort(() => Math.random() - 0.5);
    setSentences(shuffled);
    setCurrentIndex(0);
    setShowAnswer(false);
    setUserTranslation('');
  };

  if (loading) return <div className="loading">加载中...</div>;

  const current = sentences[currentIndex];
  const practiced = records.length;
  const correct = records.filter(r => r.is_correct).length;

  return (
    <div className="study-page">
      <div className="page-header">
        <button className="btn-link" onClick={goBack}>← 返回</button>
        <h2>📝 长难句翻译</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="badge badge-green">已练 {practiced}</div>
          <div className="badge badge-blue">正确 {correct}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>选择句集</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lists.map(l => (
                <button
                  key={l.id}
                  className={`btn ${selectedId === l.id ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedId(l.id)}
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  📚 {l.name}
                </button>
              ))}
              {lists.length === 0 && <div className="muted">暂无句集</div>}
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontWeight: 600 }}>练习模式</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button className={`btn ${mode === 'en_to_zh' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => { setMode('en_to_zh'); setShowAnswer(false); setUserTranslation(''); }}>英译汉</button>
                <button className={`btn ${mode === 'zh_to_en' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => { setMode('zh_to_en'); setShowAnswer(false); setUserTranslation(''); }}>汉译英</button>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={shuffle}>🔀 随机排序</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 3, minWidth: 300 }}>
          {current ? (
            <div className="card study-card">
              <div className="study-progress">
                <span>第 {currentIndex + 1} / {sentences.length} 句</span>
                <span className="badge badge-blue">{mode === 'en_to_zh' ? '英译汉' : '汉译英'}</span>
              </div>

              <div className="study-content">
                {mode === 'en_to_zh' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 22, fontWeight: 600, flex: 1 }}>{current.sentence_en}</div>
                    <button className="icon-btn" onClick={() => speak(current.sentence_en)} title="朗读">🔊</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{current.sentence_zh}</div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={{ fontWeight: 600 }}>{mode === 'en_to_zh' ? '请输入你的翻译（中文）：' : 'Please translate to English:'}</label>
                <textarea
                  rows={4}
                  value={userTranslation}
                  onChange={e => setUserTranslation(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, resize: 'vertical' }}
                  placeholder={mode === 'en_to_zh' ? '输入中文翻译...' : 'Type your English translation...'}
                />
              </div>

              {!showAnswer ? (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => setShowAnswer(true)}>👀 看答案</button>
                  <button className="btn btn-outline" onClick={prev} disabled={currentIndex === 0}>← 上一句</button>
                  <button className="btn btn-outline" onClick={next} disabled={currentIndex === sentences.length - 1}>下一句 →</button>
                </div>
              ) : (
                <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#f0fdf4' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>✅ 参考翻译：</div>
                  <div style={{ fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {mode === 'en_to_zh' ? current.sentence_zh : current.sentence_en}
                  </div>

                  {current.vocabulary && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ fontWeight: 600, color: '#166534', marginBottom: 6 }}>📖 词及词组：</div>
                      <div className="muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{current.vocabulary}</div>
                    </div>
                  )}

                  {current.grammar && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ fontWeight: 600, color: '#166534', marginBottom: 6 }}>📝 语法点：</div>
                      <div className="muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{current.grammar}</div>
                    </div>
                  )}

                  {current.structure && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ fontWeight: 600, color: '#166534', marginBottom: 6 }}>🧩 主干梳理：</div>
                      <div className="muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{current.structure}</div>
                    </div>
                  )}

                  {current.analysis && !current.vocabulary && !current.grammar && !current.structure && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ fontWeight: 600, color: '#166534', marginBottom: 4 }}>💡 解析：</div>
                      <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{current.analysis}</div>
                    </div>
                  )}

                  {current.correction && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ fontWeight: 600, color: '#b45309', marginBottom: 6 }}>✏️ 订正：</div>
                      <div className="muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{current.correction}</div>
                    </div>
                  )}

                  {current.summary && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
                      <div style={{ fontWeight: 600, color: '#1d4ed8', marginBottom: 6 }}>📌 总结：</div>
                      <div className="muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{current.summary}</div>
                    </div>
                  )}

                  <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => { submitAnswer(true); next(); }}>✅ 我对了，下一句</button>
                    <button className="btn btn-outline" onClick={() => { submitAnswer(false); next(); }}>❌ 我错了，下一句</button>
                    <button className="btn btn-outline" onClick={prev} disabled={currentIndex === 0}>← 上一句</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">请选择左侧的句集开始练习</div>
          )}

          {records.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>📋 最近练习记录</h3>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {records.slice(0, 20).map((r, i) => (
                  <div key={r.id || i} style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={r.is_correct ? 'badge badge-green' : 'badge badge-red'} style={{ fontSize: 12 }}>{r.is_correct ? '正确' : '错误'}</span>
                      <span className="muted small">{new Date(r.translated_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13 }}>{r.sentence_en}</div>
                    <div className="muted small" style={{ fontSize: 12 }}>你的翻译：{r.user_translation || '(空)'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
