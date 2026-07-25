import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function WordListManage() {
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newList, setNewList] = useState({ name: '', description: '' });
  const [newWord, setNewWord] = useState({ word: '', meaning: '', example: '' });
  const [editingWord, setEditingWord] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [importData, setImportData] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importFileName, setImportFileName] = useState('');

  useEffect(() => { loadLists(); }, []);
  useEffect(() => { if (selectedId) loadWords(selectedId); }, [selectedId]);

  const loadLists = async () => {
    const data = await api.getWordLists();
    setLists(data.wordLists);
    if (!selectedId && data.wordLists.length > 0) {
      setSelectedId(data.wordLists[0].id);
    }
    setLoading(false);
  };

  const loadWords = async (id) => {
    const data = await api.getWords(id);
    setWords(data.words);
  };

  const createList = async () => {
    if (!newList.name.trim()) return alert('请输入词表名称');
    try {
      const data = await api.createWordList(newList);
      setSelectedId(data.id);
      setNewList({ name: '', description: '' });
      setShowCreate(false);
      loadLists();
    } catch (e) { alert(e.message); }
  };

  const deleteList = async (id) => {
    if (!confirm('确定删除该词表及其所有单词？')) return;
    await api.deleteWordList(id);
    if (selectedId === id) setSelectedId(null);
    loadLists();
  };

  const startRename = (l) => {
    setRenamingId(l.id);
    setRenamingValue(l.name);
  };

  const saveRename = async () => {
    if (!renamingValue.trim()) return alert('词表名称不能为空');
    const list = lists.find(l => l.id === renamingId);
    if (!list) return;
    try {
      await api.updateWordList(renamingId, { name: renamingValue.trim(), description: list.description || '' });
      setRenamingId(null);
      setRenamingValue('');
      loadLists();
    } catch (e) { alert(e.message); }
  };

  const addWord = async () => {
    if (!newWord.word.trim() || !newWord.meaning.trim()) return alert('单词和释义必填');
    try {
      await api.addWord(selectedId, newWord);
      setNewWord({ word: '', meaning: '', example: '' });
      setShowAddWord(false);
      loadWords(selectedId);
      loadLists();
    } catch (e) { alert(e.message); }
  };

  const updateWord = async (w) => {
    try {
      await api.updateWord(w.id, w);
      setEditingWord(null);
      loadWords(selectedId);
    } catch (e) { alert(e.message); }
  };

  const deleteWord = async (id) => {
    if (!confirm('确定删除该单词？')) return;
    await api.deleteWord(id);
    loadWords(selectedId);
    loadLists();
  };

  const batchAddWords = () => {
    const text = prompt('批量添加单词（每行格式：单词,释义,例句 或 单词 释义）\n例句可选');
    if (!text) return;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let count = 0;
    const errors = [];
    Promise.all(lines.map(async (line, i) => {
      const parts = line.split(/[,，\t]/).map(s => s.trim());
      if (parts.length < 2) { errors.push(`第${i + 1}行格式错误`); return; }
      try {
        await api.addWord(selectedId, { word: parts[0], meaning: parts[1], example: parts[2] || '' });
        count++;
      } catch (e) { errors.push(`第${i + 1}行: ${e.message}`); }
    })).then(() => {
      loadWords(selectedId);
      loadLists();
      alert(`成功添加 ${count} 个单词${errors.length ? '，失败：' + errors.length + '个' : ''}`);
    });
  };

  const handleExport = async () => {
    try {
      const data = await api.exportWordList(selectedId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.name || '词表'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); }
  };

  const smartParse = (text, fileName = '') => {
    text = (text || '').trim();
    if (!text) return { error: '内容为空', name: '', words: [] };

    const POS_STRICT = /^(n|v|vt|vi|adj|adv|prep|conj|pron|intj|abbr|aux|art|num)\.?$/i;
    const POS_LOOSE = /^[\"'\"'\(（]?\s*(n|v|vt|vi|adj|adv|prep|conj|pron|intj|abbr|aux|art|num)\.?\s*[\"'\"'\)）]?$/i;
    const isPOS = (s) => POS_STRICT.test(s.trim());
    const startsWithPOS = (s) => /^(n|v|vt|vi|adj|adv|prep|conj|pron|intj|abbr|aux|art|num)\.?\b/i.test(s.trim());
    const cleanLine = (s) => s.replace(/\s+/g, ' ').replace(/[\"'\"']/g, '').trim();

    let name = fileName.replace(/\.[^.]+$/, '') || '';
    let words = [];

    try {
      const json = JSON.parse(text);
      if (json.words && Array.isArray(json.words)) {
        name = json.name || name;
        words = json.words
          .filter(w => w && (w.word || w.term || w.en))
          .map(w => ({
            word: (w.word || w.term || w.en || '').trim(),
            meaning: (w.meaning || w.definition || w.zh || w.translation || w.cn || '').trim(),
            example: (w.example || w.sentence || '').trim(),
          }))
          .filter(w => w.word && w.meaning && !isPOS(w.word));
      }
      if (words.length > 0) return { name, words, format: 'JSON' };
    } catch (e) {}

    const rawLines = text.split(/\r?\n/).map(l => cleanLine(l)).filter(Boolean);
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];
      while (startsWithPOS(line) && lines.length > 0) {
        lines[lines.length - 1] = lines[lines.length - 1] + ' ' + line;
        line = '';
        if (i < rawLines.length - 1 && startsWithPOS(rawLines[i + 1])) {
          i++;
          line = rawLines[i];
        }
      }
      if (line) lines.push(line);
    }

    const delimiters = [/[,，\t]/, /\s{2,}/, /[:：]/, /\s+/];
    let bestResult = { words: [], delimiter: null };

    const smartMergeLine = (line) => {
      const segs = line.split(/\s*((?:n|v|vt|vi|adj|adv|prep|conj|pron|intj|abbr|aux|art|num)\.?)\s+/i).map(s => s.trim()).filter(Boolean);
      if (segs.length <= 2) return null;

      let engWord = '';
      const meanings = [];
      let curMeaning = '';
      let curPOS = '';

      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (isPOS(s)) {
          if (curMeaning) meanings.push((curPOS ? curPOS + ' ' : '') + curMeaning);
          curPOS = s;
          curMeaning = '';
        } else if (/[a-zA-Z]/.test(s) && !engWord) {
          engWord = s;
        } else {
          curMeaning = curMeaning ? curMeaning + ' ' + s : s;
        }
      }
      if (curMeaning) meanings.push((curPOS ? curPOS + ' ' : '') + curMeaning);

      if (engWord && meanings.length > 0) {
        return { word: engWord, meaning: meanings.join('；'), example: '' };
      }
      return null;
    };

    for (const delim of delimiters) {
      const parsed = [];
      for (const line of lines) {
        if (/^(单词|word|term|英语|英文|序号|list)/i.test(line)) continue;

        const merged = smartMergeLine(line);
        if (merged) { parsed.push(merged); continue; }

        const parts = line.split(delim).map(p => p.trim()).filter(Boolean);
        if (parts.length < 2) continue;

        const engIdx = parts.findIndex(p => /[a-zA-Z]/.test(p) && !POS_LOOSE.test(p));
        if (engIdx < 0) continue;

        let w = parts[engIdx];
        if (POS_LOOSE.test(w)) continue;

        const zhParts = [];
        let ex = '';
        for (let i = 0; i < parts.length; i++) {
          if (i === engIdx) continue;
          const p = parts[i];
          if (POS_LOOSE.test(p)) {
            const pos = p.replace(/[\"'\"'\(（\)）]/g, '').trim();
            if (zhParts.length > 0) zhParts[zhParts.length - 1] = pos + ' ' + zhParts[zhParts.length - 1];
            else zhParts.push(pos);
          } else if (/[\u4e00-\u9fa5]/.test(p)) {
            zhParts.push(p);
          } else if (/[a-zA-Z]{4,}/.test(p)) {
            ex = p;
          } else {
            zhParts.push(p);
          }
        }

        let m = zhParts.join(' ').trim();
        if (!m) continue;

        if (/^[a-zA-Z]/.test(w) && !/[a-zA-Z]/.test(m)) {
          parsed.push({ word: w, meaning: m, example: ex || '' });
        }
      }
      if (parsed.length > bestResult.words.length) {
        bestResult = { words: parsed, delimiter: delim };
      }
    }

    if (bestResult.words.length === 0) {
      const allText = lines.join(' ');
      const pairs = allText.match(/([a-zA-Z][a-zA-Z\s\-']*[a-zA-Z])[^a-zA-Z\u4e00-\u9fa5]{0,5}([\u4e00-\u9fa5][\u4e00-\u9fa5，。；：、\s]*[\u4e00-\u9fa5])/g);
      if (pairs) {
        for (const p of pairs) {
          const m = p.match(/^([a-zA-Z][a-zA-Z\s\-']*[a-zA-Z])[^a-zA-Z\u4e00-\u9fa5]{0,5}([\u4e00-\u9fa5][\u4e00-\u9fa5，。；：、\s]*[\u4e00-\u9fa5])$/);
          if (m && !isPOS(m[1].trim())) {
            bestResult.words.push({ word: m[1].trim(), meaning: m[2].trim(), example: '' });
          }
        }
      }
    }

    words = bestResult.words.filter(w => !isPOS(w.word));

    const seen = new Set();
    words = words.filter(w => {
      const k = w.word.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (!name) {
      name = words.length > 0 ? `导入词表 (${words.length}词)` : '导入词表';
    }

    return {
      name,
      words,
      format: bestResult.delimiter ? '文本' : 'JSON',
      error: words.length === 0 ? '未解析到有效的单词，请检查格式' : null,
    };
  };

  const runPreview = () => {
    const result = smartParse(importData, importFileName);
    setImportPreview(result);
  };

  useEffect(() => {
    if (showImport && importData) {
      runPreview();
    }
  }, [importData, showImport]);

  const confirmImport = async () => {
    if (!importPreview || !importPreview.words || importPreview.words.length === 0) {
      return alert('没有可导入的单词');
    }
    try {
      const res = await api.importWordList({
        name: importPreview.name,
        description: '',
        words: importPreview.words,
      });
      alert(`导入成功！词表「${importPreview.name}」已添加，共 ${res.imported || importPreview.words.length} 个单词`);
      setShowImport(false);
      setImportData('');
      setImportPreview(null);
      setImportFileName('');
      loadLists();
    } catch (e) {
      alert('导入失败：' + e.message);
    }
  };

  const updatePreviewWord = (index, field, value) => {
    if (!importPreview) return;
    const newWords = [...importPreview.words];
    newWords[index] = { ...newWords[index], [field]: value };
    setImportPreview({ ...importPreview, words: newWords });
  };

  const removePreviewWord = (index) => {
    if (!importPreview) return;
    const newWords = importPreview.words.filter((_, i) => i !== index);
    setImportPreview({ ...importPreview, words: newWords });
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result || '';
      setImportData(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="word-manage">
      <div className="page-header">
        <h2>词表管理</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建词表</button>
      </div>

      {showCreate && (
        <div className="modal" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>新建词表</h3>
            <div className="form-group">
              <label>名称</label>
              <input value={newList.name} onChange={e => setNewList({ ...newList, name: e.target.value })} placeholder="如：Unit 1 词汇" />
            </div>
            <div className="form-group">
              <label>描述（可选）</label>
              <input value={newList.description} onChange={e => setNewList({ ...newList, description: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn btn-primary" onClick={createList}>创建</button>
            </div>
          </div>
        </div>
      )}

      <div className="manage-layout">
        <div className="sidebar">
          <h3>词表列表</h3>
          {lists.length === 0 && <div className="muted small">暂无词表</div>}
          {lists.map(l => (
            <div
              key={l.id}
              className={'list-item' + (selectedId === l.id ? ' active' : '')}
              onClick={() => !renamingId && setSelectedId(l.id)}
            >
              <div className="list-item-info" style={{ flex: 1, minWidth: 0 }}>
                {renamingId === l.id ? (
                  <input
                    autoFocus
                    value={renamingValue}
                    onChange={e => setRenamingValue(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setRenamingId(null); setRenamingValue(''); } }}
                    style={{ width: '100%', padding: 4, fontSize: 14, borderRadius: 4, border: '1px solid #3b82f6' }}
                  />
                ) : (
                  <div className="list-item-name">{l.name}</div>
                )}
                <div className="muted small">{l.word_count || 0} 个单词</div>
              </div>
              {renamingId === l.id ? (
                <>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); saveRename(); }} title="保存">✓</button>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); setRenamingId(null); setRenamingValue(''); }} title="取消">✕</button>
                </>
              ) : (
                <>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); startRename(l); }} title="重命名">✏️</button>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); deleteList(l.id); }} title="删除">🗑</button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="main-panel">
          {selectedId ? (
            <>
              <div className="panel-header">
                <h3>{lists.find(l => l.id === selectedId)?.name} · 单词 ({words.length})</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)}>📥 导入词表</button>
                  <button className="btn btn-outline btn-sm" onClick={handleExport}>📤 导出</button>
                  <button className="btn btn-outline btn-sm" onClick={batchAddWords}>批量添加</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddWord(true)}>+ 添加单词</button>
                </div>
              </div>

              {showImport && (
                <div className="modal" onClick={() => { setShowImport(false); setImportPreview(null); setImportData(''); setImportFileName(''); }}>
                  <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
                    <h3>📥 智能导入词表</h3>

                    <div className="form-group"><label>选择文件（支持 .json / .txt / .csv）</label>
                      <input type="file" accept=".json,.txt,.csv,text/plain,application/json" onChange={handleImportFile} />
                    </div>

                    <div className="form-group"><label>或直接粘贴内容</label>
                      <textarea
                        rows={5}
                        value={importData}
                        onChange={e => setImportData(e.target.value)}
                        placeholder={'支持多种格式，智能识别：\n\n• JSON: {"name":"Unit 1","words":[{"word":"apple","meaning":"苹果"}]}\n• CSV/TXT: apple,苹果  或  apple 苹果  或  apple:苹果\n• 任意中英混排文本也能自动提取单词对'}
                        style={{ fontFamily: 'monospace', fontSize: 13 }}
                      />
                    </div>

                    {importPreview && (
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#f9fafb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <span className="badge badge-blue">已识别 {importPreview.words.length} 个单词</span>
                            {importPreview.format && <span className="badge badge-gray" style={{ marginLeft: 8 }}>{importPreview.format}格式</span>}
                            {importPreview.error && <span style={{ color: '#ef4444', marginLeft: 8 }}>{importPreview.error}</span>}
                          </div>
                        </div>

                        <div className="form-row" style={{ marginTop: 8 }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>词表名称</label>
                            <input
                              value={importPreview.name || ''}
                              onChange={e => setImportPreview({ ...importPreview, name: e.target.value })}
                              placeholder="词表名称"
                            />
                          </div>
                        </div>

                        {importPreview.words.length > 0 && (
                          <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 6 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
                                <tr>
                                  <th style={{ padding: 8, textAlign: 'left', width: 30 }}>#</th>
                                  <th style={{ padding: 8, textAlign: 'left' }}>单词</th>
                                  <th style={{ padding: 8, textAlign: 'left' }}>释义</th>
                                  <th style={{ padding: 8, textAlign: 'left' }}>例句</th>
                                  <th style={{ padding: 8, width: 40 }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {importPreview.words.slice(0, 100).map((w, i) => (
                                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: 6, color: '#999' }}>{i + 1}</td>
                                    <td style={{ padding: 4 }}>
                                      <input
                                        value={w.word}
                                        onChange={e => updatePreviewWord(i, 'word', e.target.value)}
                                        style={{ width: '100%', padding: 4, border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }}
                                      />
                                    </td>
                                    <td style={{ padding: 4 }}>
                                      <input
                                        value={w.meaning}
                                        onChange={e => updatePreviewWord(i, 'meaning', e.target.value)}
                                        style={{ width: '100%', padding: 4, border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }}
                                      />
                                    </td>
                                    <td style={{ padding: 4 }}>
                                      <input
                                        value={w.example || ''}
                                        onChange={e => updatePreviewWord(i, 'example', e.target.value)}
                                        style={{ width: '100%', padding: 4, border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13 }}
                                      />
                                    </td>
                                    <td style={{ padding: 4 }}>
                                      <button
                                        className="icon-btn"
                                        onClick={() => removePreviewWord(i)}
                                        title="移除"
                                        style={{ color: '#ef4444' }}
                                      >✕</button>
                                    </td>
                                  </tr>
                                ))}
                                {importPreview.words.length > 100 && (
                                  <tr><td colSpan={5} style={{ padding: 8, textAlign: 'center', color: '#999' }}>
                                    ... 还有 {importPreview.words.length - 100} 个单词
                                  </td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="modal-actions">
                      <button className="btn btn-outline" onClick={() => { setShowImport(false); setImportPreview(null); setImportData(''); setImportFileName(''); }}>取消</button>
                      <button
                        className="btn btn-primary"
                        onClick={confirmImport}
                        disabled={!importPreview || !importPreview.words || importPreview.words.length === 0}
                      >
                        ✅ 确认导入 ({importPreview?.words?.length || 0}词)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showAddWord && (
                <div className="modal" onClick={() => setShowAddWord(false)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <h3>添加单词</h3>
                    <div className="form-group"><label>单词</label>
                      <input value={newWord.word} onChange={e => setNewWord({ ...newWord, word: e.target.value })} placeholder="如：apple" />
                    </div>
                    <div className="form-group"><label>释义</label>
                      <input value={newWord.meaning} onChange={e => setNewWord({ ...newWord, meaning: e.target.value })} placeholder="如：苹果" />
                    </div>
                    <div className="form-group"><label>例句（可选）</label>
                      <input value={newWord.example} onChange={e => setNewWord({ ...newWord, example: e.target.value })} placeholder="如：I eat an apple." />
                    </div>
                    <div className="modal-actions">
                      <button className="btn btn-outline" onClick={() => setShowAddWord(false)}>取消</button>
                      <button className="btn btn-primary" onClick={addWord}>添加</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="word-table">
                <table>
                  <thead>
                    <tr><th>#</th><th>单词</th><th>释义</th><th>例句</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {words.map((w, i) => (
                      <tr key={w.id}>
                        <td>{i + 1}</td>
                        {editingWord?.id === w.id ? (
                          <>
                            <td><input value={editingWord.word} onChange={e => setEditingWord({ ...editingWord, word: e.target.value })} /></td>
                            <td><input value={editingWord.meaning} onChange={e => setEditingWord({ ...editingWord, meaning: e.target.value })} /></td>
                            <td><input value={editingWord.example || ''} onChange={e => setEditingWord({ ...editingWord, example: e.target.value })} /></td>
                            <td>
                              <button className="btn btn-primary btn-sm" onClick={() => updateWord(editingWord)}>保存</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setEditingWord(null)}>取消</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{w.word}</td>
                            <td>{w.meaning}</td>
                            <td className="muted small">{w.example || '-'}</td>
                            <td>
                              <button className="icon-btn" onClick={() => setEditingWord({ ...w })}>✏️</button>
                              <button className="icon-btn" onClick={() => deleteWord(w.id)}>🗑</button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {words.length === 0 && <tr><td colSpan="5" className="empty-state">暂无单词</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">请选择或创建一个词表</div>
          )}
        </div>
      </div>
    </div>
  );
}
