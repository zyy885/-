import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function SelfTestSelect() {
  const navigate = useNavigate();
  const [wordBooks, setWordBooks] = useState([]);
  const [wordLists, setWordLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('books');
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState('en_to_zh');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [books, lists] = await Promise.all([
        api.getWordBooks(),
        api.getWordLists(),
      ]);
      setWordBooks(books.wordBooks || []);
      setWordLists(lists.wordLists || []);
    } finally { setLoading(false); }
  };

  const startTest = (params) => {
    const qs = new URLSearchParams({ count, mode, ...params }).toString();
    navigate(`/self-test?${qs}`);
  };

  if (loading) return <div className="loading">加载中...</div>;

  const COUNTS = [5, 10, 20, 30, 50];

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
          <label>测试模式</label>
          <div className="chip-group">
            <button className={`chip ${mode === 'en_to_zh' ? 'active' : ''}`} onClick={() => setMode('en_to_zh')}>英译中</button>
            <button className={`chip ${mode === 'zh_to_en' ? 'active' : ''}`} onClick={() => setMode('zh_to_en')}>中译英</button>
          </div>
        </div>
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
