import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function WordListManage() {
  const [wordBooks, setWordBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newList, setNewList] = useState({ name: '', description: '' });
  const [newBook, setNewBook] = useState({ name: '', description: '', cover_color: '#6366f1', cover_image: '', is_public: true });
  const [editBook, setEditBook] = useState(null);
  const [newWord, setNewWord] = useState({ word: '', meaning: '', example: '' });
  const [editingWord, setEditingWord] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [renamingBookId, setRenamingBookId] = useState(null);
  const [renamingBookValue, setRenamingBookValue] = useState('');
  const [editingListBookId, setEditingListBookId] = useState(null);
  const [importData, setImportData] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importFileName, setImportFileName] = useState('');
  const [importMode, setImportMode] = useState('new');

  useEffect(() => { loadWordBooks(); }, []);
  useEffect(() => { loadLists(selectedBookId); }, [selectedBookId]);
  useEffect(() => { if (selectedId) loadWords(selectedId); }, [selectedId]);

  const loadWordBooks = async () => {
    try {
      const data = await api.getWordBooks();
      setWordBooks(data.wordBooks);
    } catch (e) {}
    setLoading(false);
  };

  const loadLists = async (bookId) => {
    const data = await api.getWordLists(bookId || undefined);
    setLists(data.wordLists);
    if (!selectedId && data.wordLists.length > 0) {
      setSelectedId(data.wordLists[0].id);
    } else if (data.wordLists.length === 0) {
      setSelectedId(null);
    }
  };

  const loadWords = async (id) => {
    const data = await api.getWords(id);
    setWords(data.words);
  };

  const createBook = async () => {
    if (!newBook.name.trim()) return alert('请输入单词书名称');
    try {
      const data = await api.createWordBook(newBook);
      setSelectedBookId(data.id);
      setNewBook({ name: '', description: '', cover_color: '#6366f1', cover_image: '', is_public: true });
      setShowCreateBook(false);
      loadWordBooks();
    } catch (e) { alert(e.message); }
  };

  const openEditBook = (b) => {
    setEditBook({
      id: b.id,
      name: b.name,
      description: b.description || '',
      cover_color: b.cover_color || '#6366f1',
      cover_image: b.cover_image || '',
      is_public: b.is_public ? true : false,
    });
  };

  const handleImageUpload = (e, target) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('请选择图片文件');
    if (file.size > 10 * 1024 * 1024) return alert('图片不能超过 10MB');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = ev.target.result;
      if (target === 'new') {
        setNewBook({ ...newBook, cover_image: img });
      } else {
        setEditBook({ ...editBook, cover_image: img });
      }
    };
    reader.readAsDataURL(file);
  };

  const saveEditBook = async () => {
    if (!editBook.name.trim()) return alert('请输入单词书名称');
    try {
      await api.updateWordBook(editBook.id, editBook);
      setEditBook(null);
      loadWordBooks();
    } catch (e) { alert(e.message); }
  };

  const deleteBook = async (id) => {
    if (!confirm('确定删除该单词书及其所有词表？')) return;
    await api.deleteWordBook(id);
    if (selectedBookId === id) setSelectedBookId(null);
    loadWordBooks();
  };

  const startRenameBook = (b) => {
    setRenamingBookId(b.id);
    setRenamingBookValue(b.name);
  };

  const saveRenameBook = async () => {
    if (!renamingBookValue.trim()) return alert('单词书名称不能为空');
    const book = wordBooks.find(b => b.id === renamingBookId);
    if (!book) return;
    try {
      await api.updateWordBook(renamingBookId, { name: renamingBookValue.trim(), description: book.description || '' });
      setRenamingBookId(null);
      setRenamingBookValue('');
      loadWordBooks();
    } catch (e) { alert(e.message); }
  };

  const createList = async () => {
    if (!newList.name.trim()) return alert('请输入词表名称');
    try {
      const data = await api.createWordList({ ...newList, word_book_id: selectedBookId || null });
      setSelectedId(data.id);
      setNewList({ name: '', description: '' });
      setShowCreate(false);
      loadLists(selectedBookId);
    } catch (e) { alert(e.message); }
  };

  const deleteList = async (id) => {
    if (!confirm('确定删除该词表及其所有单词？')) return;
    await api.deleteWordList(id);
    if (selectedId === id) setSelectedId(null);
    loadLists(selectedBookId);
  };

  const startRename = (l) => {
    setRenamingId(l.id);
    setRenamingValue(l.name);
    setEditingListBookId(l.word_book_id || null);
  };

  const saveRename = async () => {
    if (!renamingValue.trim()) return alert('词表名称不能为空');
    const list = lists.find(l => l.id === renamingId);
    if (!list) return;
    try {
      await api.updateWordList(renamingId, { name: renamingValue.trim(), description: list.description || '', word_book_id: editingListBookId });
      setRenamingId(null);
      setRenamingValue('');
      setEditingListBookId(null);
      loadLists(selectedBookId);
      loadWordBooks();
    } catch (e) { alert(e.message); }
  };

  const addWord = async () => {
    if (!newWord.word.trim() || !newWord.meaning.trim()) return alert('单词和释义必填');
    try {
      await api.addWord(selectedId, newWord);
      setNewWord({ word: '', meaning: '', example: '' });
      setShowAddWord(false);
      loadWords(selectedId);
      loadLists(selectedBookId);
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
    loadLists(selectedBookId);
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
      loadLists(selectedBookId);
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

  const chineseNumMap = { '零':0, '一':1, '二':2, '两':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '百':100, '千':1000, '万':10000 };
  const numToChinese = (n) => {
    if (n === 0) return '零';
    if (n < 10) return ['零','一','二','三','四','五','六','七','八','九'][n];
    if (n < 20) return '十' + (n % 10 === 0 ? '' : numToChinese(n % 10));
    if (n < 100) {
      const tens = Math.floor(n / 10);
      const ones = n % 10;
      return numToChinese(tens) + '十' + (ones === 0 ? '' : numToChinese(ones));
    }
    if (n < 1000) {
      const hundreds = Math.floor(n / 100);
      const rest = n % 100;
      let result = numToChinese(hundreds) + '百';
      if (rest > 0) {
        if (rest < 10) result += '零';
        result += numToChinese(rest);
      }
      return result;
    }
    return String(n);
  };
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
        if (n > 0) return { num: n, baseName: name };
      }
    }
    return null;
  };
  const getNextSeqName = () => {
    const seqs = lists.map(l => parseSeqName(l.name)).filter(Boolean).sort((a, b) => b.num - a.num);
    if (seqs.length === 0) return null;
    const maxSeq = seqs[0];
    const nextNum = maxSeq.num + 1;
    const base = maxSeq.baseName;
    const cnNum = numToChinese(nextNum);
    if (/^第.+[页节章单元]$/.test(base)) {
      const suffix = base.match(/[页节章单元]$/)[0];
      return `第${cnNum}${suffix}`;
    }
    if (/^第.+$/.test(base)) return `第${cnNum}`;
    if (/^.+[页节章单元]$/.test(base)) {
      const suffix = base.match(/[页节章单元]$/)[0];
      return `${cnNum}${suffix}`;
    }
    if (/^List\s*\d+$/i.test(base)) return `List ${nextNum}`;
    if (/^Unit\s*\d+$/i.test(base)) return `Unit ${nextNum}`;
    if (/^Lesson\s*\d+$/i.test(base)) return `Lesson ${nextNum}`;
    return `第${cnNum}页`;
  };

  const smartParse = (text, fileName = '') => {
    text = (text || '').trim();
    text = text.replace(/^\uFEFF/, '');
    if (!text) return { error: '内容为空', name: '', words: [] };

    const POS_STRICT = /^(n|v|vt|vi|adj|adv|prep|conj|pron|intj|abbr|aux|art|num)\.?$/i;
    const POS_LOOSE = /^[\"'\"'\(（]?\s*(n|v|vt|vi|adj|adv|prep|conj|pron|intj|abbr|aux|art|num)\.?\s*[\"'\"'\)）]?$/i;
    const isPOS = (s) => POS_STRICT.test(s.trim());
    const startsWithPOS = (s) => /^(n|v|vt|vi|adj|adv|prep|conj|pron|intj|abbr|aux|art|num)\.?\b/i.test(s.trim());

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

    const stripLinePrefix = (line) => {
      line = line.replace(/^[\s\u3000]+/, '');
      line = line.replace(/^[\(（]?\d+[\)）\.、\s]+/, '');
      line = line.replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/, '');
      line = line.replace(/^[▪■●◆▲★☆◇□※•·]\s*/, '');
      return line.trim();
    };

    const cleanLine = (s) => s.replace(/\s+/g, ' ').replace(/[\"'\"']/g, '').trim();

    const rawLines = text.split(/\r?\n/).map(l => stripLinePrefix(l)).map(l => cleanLine(l)).filter(Boolean);
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

    const tryParseLine = (line) => {
      line = line.trim();
      if (!line) return null;
      if (/^(单词|word|term|英语|英文|序号|list|释义|中文|翻译|meaning)/i.test(line)) return null;

      const hasCN = /[\u4e00-\u9fa5]/.test(line);
      const hasEN = /[a-zA-Z]/.test(line);
      if (!hasCN || !hasEN) return null;

      const trySplit = (pattern) => {
        const parts = line.split(pattern).map(s => s.trim()).filter(Boolean);
        if (parts.length < 2) return null;
        let eng = '', zh = '';
        for (const p of parts) {
          if (/[a-zA-Z]/.test(p) && !POS_LOOSE.test(p) && !eng) {
            eng = p;
          } else if (/[\u4e00-\u9fa5]/.test(p)) {
            zh = zh ? zh + '；' + p : p;
          }
        }
        if (eng && zh) return { word: eng, meaning: zh, example: '' };
        return null;
      };

      const multiDelims = [
        /\s*[,，]\s*/,
        /\s*\t\s*/,
        /\s*[|｜]\s*/,
        /\s*[—–\-]{1,3}\s*/,
        /\s*[:：]\s*/,
        /\s{2,}/,
        /\s+/,
      ];

      for (const d of multiDelims) {
        const r = trySplit(d);
        if (r) return r;
      }

      const cnPart = (line.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5，。；：、\s\w\d()（）]*[\u4e00-\u9fa5\d]/) || [])[0];
      const enPart = (line.match(/[a-zA-Z][a-zA-Z\s\-']*[a-zA-Z]/) || [])[0];
      if (enPart && cnPart) {
        const w = enPart.trim();
        const m = cnPart.trim();
        if (!isPOS(w)) return { word: w, meaning: m, example: '' };
      }
      return null;
    };

    const smartMergeLine = (line) => {
      const segs = line.split(/\s*\b((?:n|v|vt|vi|adj|adv|prep|conj|pron|intj|abbr|aux|art|num)\.?)\s+/i).map(s => s.trim()).filter(Boolean);
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

    const parsed = [];
    for (const line of lines) {
      const merged = smartMergeLine(line);
      if (merged) { parsed.push(merged); continue; }
      const p = tryParseLine(line);
      if (p) parsed.push(p);
    }

    words = parsed.filter(w => !isPOS(w.word));

    const seen = new Set();
    words = words.filter(w => {
      const k = w.word.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (!name) {
      const autoSeq = getNextSeqName();
      name = autoSeq || (words.length > 0 ? `导入词表 (${words.length}词)` : '导入词表');
    }

    return {
      name,
      words,
      format: '文本',
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
      if (importMode === 'append' && selectedId) {
        const res = await api.importWordsToList(selectedId, {
          words: importPreview.words,
        });
        const skipped = res.skipped || 0;
        alert(`导入成功！已向当前词表追加 ${res.imported || 0} 个单词${skipped > 0 ? `，已跳过 ${skipped} 个重复/无效单词` : ''}`);
      } else {
        const res = await api.importWordList({
          name: importPreview.name,
          description: '',
          words: importPreview.words,
          word_book_id: selectedBookId || null,
        });
        const skipped = res.skipped || 0;
        alert(`导入成功！词表「${importPreview.name}」已添加，共 ${res.imported || 0} 个单词${skipped > 0 ? `，已跳过 ${skipped} 个重复/无效单词` : ''}`);
      }
      setShowImport(false);
      setImportData('');
      setImportPreview(null);
      setImportFileName('');
      loadLists(selectedBookId);
      if (selectedId) loadWords(selectedId);
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
        <button className="btn btn-primary" onClick={() => setShowCreateBook(true)}>+ 新建单词书</button>
      </div>

      {showCreateBook && (
        <div className="modal" onClick={() => setShowCreateBook(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>新建单词书</h3>
            <div className="form-group">
              <label>名称</label>
              <input value={newBook.name} onChange={e => setNewBook({ ...newBook, name: e.target.value })} placeholder="如：考研英语5500词" />
            </div>
            <div className="form-group">
              <label>描述（可选）</label>
              <input value={newBook.description} onChange={e => setNewBook({ ...newBook, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>封面颜色</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewBook({ ...newBook, cover_color: c })}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: c,
                      border: newBook.cover_color === c ? '3px solid #1a1a2e' : '2px solid #e5e7eb',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>封面图片（可选，支持 JPG/PNG，最大 10MB）</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {newBook.cover_image ? (
                  <div style={{ position: 'relative' }}>
                    <img src={newBook.cover_image} alt="封面预览" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      className="icon-btn"
                      onClick={() => setNewBook({ ...newBook, cover_image: '' })}
                      style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
                    >✕</button>
                  </div>
                ) : (
                  <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                    📷 选择图片
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleImageUpload(e, 'new')}
                    />
                  </label>
                )}
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>建议使用 4:3 或 16:9 的横版图片</div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={newBook.is_public}
                  onChange={e => setNewBook({ ...newBook, is_public: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                公开给所有用户（开启后，所有登录用户都可以看到这本单词书）
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowCreateBook(false)}>取消</button>
              <button className="btn btn-primary" onClick={createBook}>创建</button>
            </div>
          </div>
        </div>
      )}

      {editBook && (
        <div className="modal" onClick={() => setEditBook(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>编辑单词书</h3>
            <div className="form-group">
              <label>名称</label>
              <input value={editBook.name} onChange={e => setEditBook({ ...editBook, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>描述（可选）</label>
              <input value={editBook.description} onChange={e => setEditBook({ ...editBook, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>封面颜色</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditBook({ ...editBook, cover_color: c })}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: c,
                      border: editBook.cover_color === c ? '3px solid #1a1a2e' : '2px solid #e5e7eb',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>封面图片（可选，支持 JPG/PNG，最大 10MB）</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {editBook.cover_image ? (
                  <div style={{ position: 'relative' }}>
                    <img src={editBook.cover_image} alt="封面预览" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      className="icon-btn"
                      onClick={() => setEditBook({ ...editBook, cover_image: '' })}
                      style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
                    >✕</button>
                  </div>
                ) : (
                  <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                    📷 选择图片
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleImageUpload(e, 'edit')}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={editBook.is_public}
                  onChange={e => setEditBook({ ...editBook, is_public: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                公开给所有用户
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditBook(null)}>取消</button>
              <button className="btn btn-primary" onClick={saveEditBook}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>新建词表</h3>
            <div className="form-group">
              <label>名称 {getNextSeqName() && (
                <button
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
                  onClick={() => setNewList({ ...newList, name: getNextSeqName() })}
                >⏩ 下一个：{getNextSeqName()}</button>
              )}</label>
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

      <div className="manage-layout" style={{ gridTemplateColumns: '240px 280px 1fr' }}>
        <div className="sidebar">
          <h3>单词书</h3>
          <div
            className={'list-item' + (selectedBookId === null ? ' active' : '')}
            onClick={() => { setSelectedBookId(null); setSelectedId(null); }}
          >
            <div className="list-item-info">
              <div className="list-item-name">📁 未分类</div>
              <div className="muted small">不属于任何单词书的词表</div>
            </div>
          </div>
          {wordBooks.map(b => (
            <div
              key={b.id}
              className={'list-item' + (selectedBookId === b.id ? ' active' : '')}
              onClick={() => setSelectedBookId(b.id)}
              style={{ borderLeft: `4px solid ${b.cover_color || '#6366f1'}` }}
            >
              <div className="list-item-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="list-item-name">
                  📚 {b.name}
                  {b.is_public && <span className="badge badge-green" style={{ marginLeft: 6, fontSize: 10 }}>公开</span>}
                </div>
                <div className="muted small">{b.list_count || 0} 个词表 · {b.word_count || 0} 词</div>
              </div>
              <button className="icon-btn" onClick={e => { e.stopPropagation(); openEditBook(b); }} title="编辑">✏️</button>
              <button className="icon-btn" onClick={e => { e.stopPropagation(); deleteBook(b.id); }} title="删除">🗑</button>
            </div>
          ))}
        </div>

        <div className="sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>词表列表</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ 新建</button>
          </div>
          {lists.length === 0 && <div className="muted small">暂无词表</div>}
          {lists.map(l => (
            <div
              key={l.id}
              className={'list-item' + (selectedId === l.id ? ' active' : '')}
              onClick={() => !renamingId && setSelectedId(l.id)}
            >
              <div className="list-item-info" style={{ flex: 1, minWidth: 0 }}>
                {renamingId === l.id ? (
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      autoFocus
                      value={renamingValue}
                      onChange={e => setRenamingValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setRenamingId(null); setRenamingValue(''); setEditingListBookId(null); } }}
                      style={{ width: '100%', padding: 4, fontSize: 14, borderRadius: 4, border: '1px solid #3b82f6' }}
                    />
                    <select
                      value={editingListBookId || ''}
                      onChange={e => setEditingListBookId(e.target.value ? Number(e.target.value) : null)}
                      style={{ width: '100%', padding: 4, fontSize: 12, borderRadius: 4, border: '1px solid #d1d5db' }}
                    >
                      <option value="">📁 未分类</option>
                      {wordBooks.map(b => (
                        <option key={b.id} value={b.id}>📚 {b.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="list-item-name">{l.name}</div>
                    <div className="muted small">{l.word_count || 0} 个单词</div>
                  </>
                )}
              </div>
              {renamingId === l.id ? (
                <>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); saveRename(); }} title="保存">✓</button>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); setRenamingId(null); setRenamingValue(''); setEditingListBookId(null); }} title="取消">✕</button>
                </>
              ) : (
                <>
                  <button className="icon-btn" onClick={e => { e.stopPropagation(); startRename(l); }} title="重命名 / 移动">✏️</button>
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
                <div className="modal" onClick={() => { setShowImport(false); setImportPreview(null); setImportData(''); setImportFileName(''); setImportMode('new'); }}>
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

                        {selectedId && (
                          <div style={{ display: 'flex', gap: 12, marginBottom: 12, padding: 10, background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                              <input
                                type="radio"
                                checked={importMode === 'new'}
                                onChange={() => setImportMode('new')}
                                style={{ width: 16, height: 16 }}
                              />
                              <span>🆕 新建词表导入</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                              <input
                                type="radio"
                                checked={importMode === 'append'}
                                onChange={() => setImportMode('append')}
                                style={{ width: 16, height: 16 }}
                              />
                              <span>➕ 追加到当前词表「{lists.find(l => l.id === selectedId)?.name}」</span>
                            </label>
                          </div>
                        )}

                        <div className="form-row" style={{ marginTop: 8 }}>
                          {importMode === 'new' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>词表名称 {getNextSeqName() && (
                                <button
                                  className="btn btn-outline btn-sm"
                                  style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
                                  onClick={() => setImportPreview({ ...importPreview, name: getNextSeqName() })}
                                >⏩ 下一个：{getNextSeqName()}</button>
                              )}</label>
                              <input
                                value={importPreview.name || ''}
                                onChange={e => setImportPreview({ ...importPreview, name: e.target.value })}
                                placeholder="词表名称"
                              />
                            </div>
                          )}
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
                      <button className="btn btn-outline" onClick={() => { setShowImport(false); setImportPreview(null); setImportData(''); setImportFileName(''); setImportMode('new'); }}>取消</button>
                      <button
                        className="btn btn-primary"
                        onClick={confirmImport}
                        disabled={!importPreview || !importPreview.words || importPreview.words.length === 0}
                      >
                        ✅ {importMode === 'append' && selectedId ? '追加到当前词表' : '新建词表导入'} ({importPreview?.words?.length || 0}词)
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
