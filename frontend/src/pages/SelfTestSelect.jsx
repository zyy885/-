import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const chineseNumMap = { '零':0, '一':1, '二':2, '两':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '百':100, '千':1000, '万':10000 };
function chineseToNum(s) {
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
}
function parseSeqName(name) {
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
}
function sortListsBySeq(lists) {
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
}

const QUESTION_TYPES = [
  { key: 'fill_blank', label: '✏️ 填空题', desc: '输入答案' },
  { key: 'choice', label: '🎯 选择题', desc: '四选一' },
  { key: 'spelling', label: '🔤 拼写题', desc: '首字母提示' },
  { key: 'listening', label: '👂 听力题', desc: '听发音选单词' },
  { key: 'mixed', label: '🎲 混合模式', desc: '随机题型' },
];

export default function SelfTestSelect() {
  const navigate = useNavigate();
  const [wordBooks, setWordBooks] = useState([]);
  const [wordLists, setWordLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('books');
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState('fill_blank');
  const [langMode, setLangMode] = useState('mixed');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [books, lists] = await Promise.all([
        api.getWordBooks(),
        api.getWordLists(),
      ]);
      setWordBooks(books.wordBooks || []);
      setWordLists(sortListsBySeq(lists.wordLists || []));
    } finally { setLoading(false); }
  };

  const startTest = (params) => {
    const qs = new URLSearchParams({ count, mode, lang_mode: langMode, ...params }).toString();
    navigate(`/student/self-test?${qs}`);
  };

  if (loading) return <div className="loading">加载中...</div>;

  const COUNTS = [5, 10, 20, 30, 50];
  const showLangMode = mode === 'fill_blank' || mode === 'choice' || mode === 'mixed';

  return (
    <div className="self-select-page">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>单词自测</h2>
        <div />
      </div>

      <div className="self-config-card">
        <div className="config-row">
          <label>题目数量</label>
          <div className="chip-group">
            {COUNTS.map(c => (
              <button key={c} className={`chip ${count === c ? 'active' : ''}`} onClick={() => setCount(c)}>{c}题</button>
            ))}
          </div>
        </div>

        <div className="config-row">
          <label>题型选择</label>
          <div className="qtype-grid">
            {QUESTION_TYPES.map(qt => (
              <button
                key={qt.key}
                className={`qtype-card ${mode === qt.key ? 'active' : ''}`}
                onClick={() => setMode(qt.key)}
              >
                <div className="qtype-label">{qt.label}</div>
                <div className="qtype-desc">{qt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {showLangMode && (
          <div className="config-row">
            <label>语言方向</label>
            <div className="chip-group">
              <button className={`chip ${langMode === 'mixed' ? 'active' : ''}`} onClick={() => setLangMode('mixed')}>混合</button>
              <button className={`chip ${langMode === 'en_to_zh' ? 'active' : ''}`} onClick={() => setLangMode('en_to_zh')}>英译中</button>
              <button className={`chip ${langMode === 'zh_to_en' ? 'active' : ''}`} onClick={() => setLangMode('zh_to_en')}>中译英</button>
            </div>
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'books' ? 'active' : ''}`} onClick={() => setTab('books')}>📚 按单词书</button>
        <button className={`tab ${tab === 'lists' ? 'active' : ''}`} onClick={() => setTab('lists')}>📋 按词表</button>
      </div>

      {tab === 'books' && (
        <div className="select-list">
          {wordBooks.length === 0 && <div className="empty-state">暂无单词书</div>}
          {wordBooks.map(wb => (
            <div key={wb.id} className="select-item" onClick={() => startTest({ word_book_id: wb.id })}>
              <div className="select-cover" style={{ background: wb.cover_color || '#6366f1' }}>
                {wb.cover_image ? <img src={wb.cover_image} alt="" /> : <span>📚</span>}
              </div>
              <div className="select-info">
                <div className="select-title">{wb.name}</div>
                <div className="select-desc">{wb.description || '点击开始测试'}</div>
              </div>
              <div className="select-arrow">›</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'lists' && (
        <div className="select-list">
          {wordLists.length === 0 && <div className="empty-state">暂无词表</div>}
          {wordLists.map(wl => (
            <div key={wl.id} className="select-item" onClick={() => startTest({ word_list_id: wl.id })}>
              <div className="select-cover" style={{ background: '#f3f4f6' }}>
                <span>📋</span>
              </div>
              <div className="select-info">
                <div className="select-title">{wl.name}</div>
                <div className="select-desc">{wl.description || '点击开始测试'}</div>
              </div>
              <div className="select-arrow">›</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
