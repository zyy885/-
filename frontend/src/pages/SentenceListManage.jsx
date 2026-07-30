import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getHomeRoute } from '../api.js';

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
      if (lastUnit > 10) { total += temp; temp = 0; }
      temp = v;
      lastUnit = 1;
    }
  }
  return total + temp;
};
const parseSeqName = (name) => {
  if (!name) return null;
  const patterns = [
    /^第([零一二三四五六七八九十百千万两\d]+)[页节章单元]$/,
    /^第([零一二三四五六七八九十百千万两\d]+)$/,
    /^([零一二三四五六七八九十百千万两\d]+)[页节章单元]$/,
    /^List\s*(\d+)$/i,
    /^Unit\s*(\d+)$/i,
    /^Lesson\s*(\d+)$/i,
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
    const pa = parseSeqName(a.name);
    const pb = parseSeqName(b.name);
    if (pa && pb) return pa.num - pb.num;
    if (pa) return -1;
    if (pb) return 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
};

export default function SentenceListManage() {
  const navigate = useNavigate();
  const goBack = () => { if (window.history.length > 2) navigate(-1); else navigate(getHomeRoute()); };
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newList, setNewList] = useState({ name: '', description: '' });
  const [newSentence, setNewSentence] = useState({ sentence_en: '', sentence_zh: '', analysis: '' });
  const [editing, setEditing] = useState(null);
  const [importData, setImportData] = useState('');
  const [importPreview, setImportPreview] = useState(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedId) loadSentences(selectedId); }, [selectedId]);

  const load = async () => {
    try {
      const data = await api.getSentenceLists();
      const sorted = sortListsBySeq(data.sentenceLists || []);
      setLists(sorted);
      if (sorted.length > 0) setSelectedId(sorted[0].id);
    } finally { setLoading(false); }
  };

  const loadSentences = async (id) => {
    const data = await api.getSentences(id);
    setSentences(data.sentences || []);
  };

  const createList = async () => {
    if (!newList.name.trim()) return alert('请输入名称');
    await api.createSentenceList(newList);
    setShowCreate(false); setNewList({ name: '', description: '' }); load();
  };

  const deleteList = async (id) => {
    if (!confirm('确定删除此句集吗？')) return;
    await api.deleteSentenceList(id);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  const addSentence = async () => {
    if (!newSentence.sentence_en.trim() || !newSentence.sentence_zh.trim()) return alert('英文和中文都必填');
    await api.addSentence(selectedId, newSentence);
    setShowAdd(false); setNewSentence({ sentence_en: '', sentence_zh: '', analysis: '' });
    loadSentences(selectedId); load();
  };

  const saveEdit = async () => {
    await api.updateSentence(editing.id, editing);
    setEditing(null); loadSentences(selectedId);
  };

  const deleteSentence = async (id) => {
    if (!confirm('确定删除此句？')) return;
    await api.deleteSentence(id); loadSentences(selectedId);
  };

  const smartParseSentences = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const result = [];
    for (const line of lines) {
      const parts = line.split(/\|\||\t|@@|##/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        result.push({ sentence_en: parts[0], sentence_zh: parts[1], analysis: parts[2] || '' });
      } else {
        const mid = line.indexOf('。');
        if (mid > 0 && /[a-zA-Z]/.test(line.slice(0, mid)) && /[\u4e00-\u9fa5]/.test(line.slice(mid))) {
          result.push({ sentence_en: line.slice(0, mid + 1).trim(), sentence_zh: line.slice(mid + 1).trim(), analysis: '' });
        }
      }
    }
    return result;
  };

  useEffect(() => {
    if (showImport && importData) {
      const parsed = smartParseSentences(importData);
      setImportPreview({ name: '导入句集', sentences: parsed });
    }
  }, [importData, showImport]);

  const confirmImport = async () => {
    if (!importPreview?.sentences?.length) return alert('没有可导入的句子');
    const res = await api.importSentenceList(importPreview);
    alert(`导入成功！共 ${res.imported || 0} 个句子`);
    setShowImport(false); setImportData(''); setImportPreview(null); load();
  };

  const handleExport = async () => {
    try {
      const data = await api.exportSentenceList(selectedId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${data.name || '句集'}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="word-manage">
      <div className="page-header">
        <button className="btn-link" onClick={goBack}>← 返回</button>
        <h2>📚 长难句管理</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ 新建句集</button>
      </div>

      <div className="manage-layout">
        <div className="side-panel">
          <div className="panel-header"><h3>句集列表</h3></div>
          <div className="list-items">
            {lists.map(l => (
              <div key={l.id} className={`list-item ${selectedId === l.id ? 'active' : ''}`} onClick={() => setSelectedId(l.id)}>
                <div className="list-item-name">{l.name}</div>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); deleteList(l.id); }} title="删除">✕</button>
              </div>
            ))}
            {lists.length === 0 && <div className="empty-state">暂无句集</div>}
          </div>
        </div>

        <div className="main-panel">
          {selectedId ? (
            <>
              <div className="panel-header">
                <h3>{lists.find(l => l.id === selectedId)?.name} · 句子 ({sentences.length})</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)}>📥 导入</button>
                  <button className="btn btn-outline btn-sm" onClick={handleExport}>📤 导出</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ 添加句子</button>
                </div>
              </div>
              <div className="word-table">
                <table>
                  <thead><tr><th>#</th><th>英文原句</th><th>中文翻译</th><th>解析</th><th>操作</th></tr></thead>
                  <tbody>
                    {sentences.map((s, i) => (
                      <tr key={s.id}>
                        {editing?.id === s.id ? (
                          <>
                            <td>{i + 1}</td>
                            <td><textarea rows={2} value={editing.sentence_en} onChange={e => setEditing({ ...editing, sentence_en: e.target.value })} style={{ width: '100%' }} /></td>
                            <td><textarea rows={2} value={editing.sentence_zh} onChange={e => setEditing({ ...editing, sentence_zh: e.target.value })} style={{ width: '100%' }} /></td>
                            <td><input value={editing.analysis || ''} onChange={e => setEditing({ ...editing, analysis: e.target.value })} style={{ width: '100%' }} /></td>
                            <td>
                              <button className="btn btn-primary btn-sm" onClick={saveEdit}>保存</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>取消</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{i + 1}</td>
                            <td style={{ whiteSpace: 'pre-wrap' }}>{s.sentence_en}</td>
                            <td style={{ whiteSpace: 'pre-wrap' }}>{s.sentence_zh}</td>
                            <td className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{s.analysis || '-'}</td>
                            <td>
                              <button className="icon-btn" onClick={() => setEditing(s)} title="编辑">✏️</button>
                              <button className="icon-btn" onClick={() => deleteSentence(s.id)} title="删除" style={{ color: '#ef4444' }}>✕</button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {sentences.length === 0 && <tr><td colSpan={5} className="empty-state">暂无句子</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="empty-state">请选择左侧的句集</div>}
        </div>
      </div>

      {showCreate && (
        <div className="modal" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>新建句集</h3>
            <div className="form-group"><label>名称</label><input value={newList.name} onChange={e => setNewList({ ...newList, name: e.target.value })} placeholder="如：考研长难句 Unit 1" /></div>
            <div className="form-group"><label>描述（选填）</label><input value={newList.description} onChange={e => setNewList({ ...newList, description: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn btn-primary" onClick={createList}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal" onClick={() => setShowAdd(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h3>添加句子</h3>
            <div className="form-group"><label>英文原句</label><textarea rows={3} value={newSentence.sentence_en} onChange={e => setNewSentence({ ...newSentence, sentence_en: e.target.value })} placeholder="This is an example sentence." /></div>
            <div className="form-group"><label>中文翻译</label><textarea rows={3} value={newSentence.sentence_zh} onChange={e => setNewSentence({ ...newSentence, sentence_zh: e.target.value })} placeholder="这是一个例句。" /></div>
            <div className="form-group"><label>语法解析（选填）</label><textarea rows={2} value={newSentence.analysis} onChange={e => setNewSentence({ ...newSentence, analysis: e.target.value })} /></div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowAdd(false)}>取消</button>
              <button className="btn btn-primary" onClick={addSentence}>添加</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal" onClick={() => { setShowImport(false); setImportPreview(null); setImportData(''); }}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h3>📥 导入句集</h3>
            <div className="form-group"><label>粘贴内容（每行一句，格式：英文||中文||解析 或 英文。中文）</label>
              <textarea rows={6} value={importData} onChange={e => setImportData(e.target.value)}
                placeholder={'支持格式：\n英文原句||中文翻译||语法解析\n或：This is a book. 这是一本书。'} />
            </div>
            {importPreview && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#f9fafb' }}>
                <span className="badge badge-blue">已识别 {importPreview.sentences.length} 个句子</span>
                <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                  {importPreview.sentences.slice(0, 20).map((s, i) => (
                    <div key={i} style={{ padding: 6, borderBottom: '1px solid #eee', fontSize: 13 }}>
                      <div>{i + 1}. {s.sentence_en}</div>
                      <div className="muted">{s.sentence_zh}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setShowImport(false); setImportPreview(null); setImportData(''); }}>取消</button>
              <button className="btn btn-primary" onClick={confirmImport} disabled={!importPreview?.sentences?.length}>✅ 确认导入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
