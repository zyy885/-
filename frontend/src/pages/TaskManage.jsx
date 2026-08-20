import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

export default function TaskManage() {
  const [tasks, setTasks] = useState([]);
  const [wordBooks, setWordBooks] = useState([]);
  const [lists, setLists] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [students, setStudents] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [form, setForm] = useState({
    name: '', word_list_ids: [], deadline: '', test_words_count: 10, test_mode: 'mixed', student_ids: [] });

  useEffect(() => { load(); }, []);
  useEffect(() => { loadLists(); }, [selectedBookId]);

  const load = async () => {
    Promise.all([api.getTasks(), api.getWordBooks(), api.getStudents(), api.getTags().catch(() => ({ tags: [] }))])
      .then(([t, wb, s, tg]) => {
        setTasks(t.tasks);
        setWordBooks(wb.wordBooks);
        setStudents(s.students);
        setTags(tg.tags || []);
      })
      .finally(() => setLoading(false));
  };

  const loadLists = async () => {
    try {
      const data = await api.getWordLists(selectedBookId || undefined);
      const sorted = sortListsBySeq((data.wordLists || []).map(l => ({ ...l, id: Number(l.id), word_count: Number(l.word_count) || 0 })));
      setLists(sorted);
      setForm(f => ({ ...f, word_list_ids: [], test_words_count: 10 }));
    } catch (e) { console.error('加载词表失败:', e); }
  };

  const toggleStudent = (id) => {
    const numId = Number(id);
    setForm(f => {
      const exists = f.student_ids.some(s => Number(s) === numId);
      return { ...f, student_ids: exists ? f.student_ids.filter(s => Number(s) !== numId) : [...f.student_ids, numId] };
    });
  };

  const toggleWordList = (id) => {
    const numId = Number(id);
    setForm(f => {
      const exists = f.word_list_ids.some(x => Number(x) === numId);
      const newIds = exists ? f.word_list_ids.filter(s => Number(s) !== numId) : [...f.word_list_ids, numId];
      const totalWords = newIds.reduce((sum, lid) => {
        const list = lists.find(l => Number(l.id) === Number(lid));
        return sum + Number(list?.word_count || 0);
      }, 0);
      return { ...f, word_list_ids: newIds, test_words_count: totalWords || 10 };
    });
  };

  const toggleAllWordLists = () => {
    if (form.word_list_ids.length === lists.length) {
      setForm(f => ({ ...f, word_list_ids: [], test_words_count: 10 }));
    } else {
      const allIds = lists.map(l => Number(l.id));
      const totalWords = lists.reduce((sum, l) => sum + Number(l.word_count || 0), 0);
      setForm(f => ({ ...f, word_list_ids: allIds, test_words_count: totalWords || 10 }));
    }
  };

  const getTotalWordsCount = () => {
    return form.word_list_ids.reduce((sum, id) => {
      const list = lists.find(l => Number(l.id) === Number(id));
      return sum + Number(list?.word_count || 0);
    }, 0);
  };

  const toggleAllStudents = () => {
    if (form.student_ids.length === students.length && students.length > 0) {
      setForm(f => ({ ...f, student_ids: [] }));
    } else {
      setForm(f => ({ ...f, student_ids: students.map(s => Number(s.id)) }));
    }
  };

  const selectByTag = async (tagId) => {
    try {
      const data = await api.getTagStudents(tagId);
      const tagStudentIds = (data.students || []).map(s => Number(s.id));
      setForm(f => {
        const merged = [...new Set([...f.student_ids, ...tagStudentIds])];
        return { ...f, student_ids: merged };
      });
    } catch (e) { alert(e.message); }
  };

  const create = async () => {
    if (!form.name.trim()) return alert('请输入任务名称');
    if (form.word_list_ids.length === 0) return alert('请至少选择一个词表');
    if (form.student_ids.length === 0) return alert('请至少选择一个学生');
    try {
      await api.createTask({
        name: form.name,
        word_list_ids: form.word_list_ids,
        word_list_id: form.word_list_ids[0],
        deadline: form.deadline || null,
        test_words_count: Number(form.test_words_count) || 10,
        test_mode: form.test_mode,
        student_ids: form.student_ids,
      });
      setForm({ name: '', word_list_ids: [], deadline: '', test_words_count: 10, test_mode: 'mixed', student_ids: [] });
      setShowCreate(false);
      setDropdownOpen(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('确定删除该任务？')) return;
    await api.deleteTask(id);
    load();
  };

  if (loading) return <div className="loading">加载中...</div>;

  const filteredTasks = tasks.filter(task => {
    const matchFilter = filter === 'all' || task.task_status === filter;
    const matchSearch = !searchText || task.name.toLowerCase().includes(searchText.toLowerCase());
    return matchFilter && matchSearch;
  });

  const statusLabels = {
    active: { text: '进行中', color: '#3b82f6', bg: '#eff6ff' },
    completed: { text: '已完成', color: '#10b981', bg: '#ecfdf5' },
    expired: { text: '已截止', color: '#f59e0b', bg: '#fffbeb' }
  };

  return (
    <div className="task-manage">
      <div className="page-header">
        <h2>任务管理</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 发布任务</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 搜索任务名称..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{
            flex: '1 1 200px',
            maxWidth: 300,
            padding: '8px 14px',
            border: '1.5px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
            transition: 'all 0.2s'
          }}
          onFocus={e => e.target.style.borderColor = '#667eea'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 4 }}>
          {[
            { key: 'all', label: '全部', count: tasks.length },
            { key: 'active', label: '进行中', count: tasks.filter(t => t.task_status === 'active').length },
            { key: 'completed', label: '已完成', count: tasks.filter(t => t.task_status === 'completed').length },
            { key: 'expired', label: '已截止', count: tasks.filter(t => t.task_status === 'expired').length }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: filter === item.key ? 600 : 400,
                background: filter === item.key ? '#667eea' : 'transparent',
                color: filter === item.key ? 'white' : '#6b7280',
                transition: 'all 0.2s'
              }}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="modal" onClick={() => { setShowCreate(false); setDropdownOpen(false); }}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h3>发布测试任务</h3>
            <div className="form-group"><label>任务名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：Unit 1 测试" />
            </div>
            <div className="form-group"><label>选择单词书</label>
              <select value={selectedBookId || ''} onChange={e => { const newBookId = e.target.value || null; setSelectedBookId(newBookId); setForm(f => ({ ...f, word_list_ids: [] })); setDropdownOpen(false); }}>
                <option value="">全部词表</option>
                {wordBooks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.list_count || 0}个词表)</option>)}
              </select>
            </div>
            <div className="form-group"><label>选择词表（可多选）</label>
              <div style={{
                border: '1.5px solid #e5e7eb', borderRadius: 10,
                background: '#fff', transition: 'all 0.2s',
                borderColor: dropdownOpen ? '#667eea' : '#e5e7eb',
                boxShadow: dropdownOpen ? '0 0 0 3px rgba(102,126,234,0.1)' : 'none'
              }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: 'none', background: 'transparent', padding: '10px 14px',
                    color: form.word_list_ids.length === 0 ? '#9ca3af' : '#1f2937'
                  }}
                  onClick={() => setDropdownOpen(o => !o)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    {form.word_list_ids.length === 0 ? (
                      <span>请选择词表...</span>
                    ) : (
                      <>
                        <span style={{
                          background: '#667eea', color: 'white', fontSize: 12,
                          padding: '2px 8px', borderRadius: 10, fontWeight: 600
                        }}>{form.word_list_ids.length}</span>
                        <span>个词表 · 共 <b>{getTotalWordsCount()}</b> 词</span>
                      </>
                    )}
                  </span>
                  <span style={{
                    transition: 'transform 0.2s',
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    fontSize: 12, color: '#667eea'
                  }}>▼</span>
                </button>
                {dropdownOpen && (
                  <div style={{
                    borderTop: '1px solid #f3f4f6', padding: '10px 12px',
                    maxHeight: 280, overflowY: 'auto'
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f3f4f6'
                    }}>
                      <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: 12 }} onClick={toggleAllWordLists}>
                        {form.word_list_ids.length === lists.length && lists.length > 0 ? '清空全部' : '全选'}
                      </button>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        已选 <b style={{ color: '#667eea' }}>{form.word_list_ids.length}</b> 个 · 共 <b style={{ color: '#667eea' }}>{getTotalWordsCount()}</b> 词
                      </span>
                    </div>
                    {form.word_list_ids.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {form.word_list_ids.map(id => {
                          const list = lists.find(l => Number(l.id) === Number(id));
                          if (!list) return null;
                          return (
                            <span key={id} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: '#eef2ff', color: '#4f46e5',
                              padding: '3px 8px', borderRadius: 6, fontSize: 12,
                              border: '1px solid #e0e7ff'
                            }}>
                              {list.name}
                              <span
                                onClick={(e) => { e.stopPropagation(); toggleWordList(id); }}
                                style={{ cursor: 'pointer', opacity: 0.6, fontSize: 14, lineHeight: 1 }}
                              >✕</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {lists.length === 0 ? (
                      <span className="muted" style={{ padding: '12px 0', display: 'block', textAlign: 'center' }}>该单词书下暂无词表</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {lists.map(l => {
                          const numId = Number(l.id);
                          const checked = form.word_list_ids.some(x => Number(x) === numId);
                          return (
                            <label
                              key={numId}
                              style={{
                                display: 'flex', alignItems: 'center', padding: '8px 10px',
                                borderRadius: 6, cursor: 'pointer',
                                background: checked ? '#eff6ff' : 'transparent',
                                border: checked ? '1px solid #dbeafe' : '1px solid transparent',
                                transition: 'all 0.15s',
                                fontSize: 14
                              }}
                              onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#f9fafb'; }}
                              onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleWordList(numId)}
                                style={{ width: 'auto', margin: 0, accentColor: '#667eea' }}
                              />
                              <span style={{
                                width: 18, height: 18, borderRadius: 4,
                                border: checked ? 'none' : '1.5px solid #d1d5db',
                                background: checked ? '#667eea' : 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s', flexShrink: 0,
                                marginLeft: 8
                              }}>
                                {checked && <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>}
                              </span>
                              <span style={{ marginLeft: 10, flex: 1, color: '#1f2937', fontWeight: checked ? 500 : 400 }}>{l.name}</span>
                              <span style={{
                                fontSize: 11, padding: '1px 6px', borderRadius: 8,
                                background: checked ? '#dbeafe' : '#f3f4f6',
                                color: checked ? '#1e40af' : '#6b7280', fontWeight: 500
                              }}>{l.word_count}词</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>测试题数</label>
                <input type="number" min="1" value={form.test_words_count} onChange={e => setForm({ ...form, test_words_count: e.target.value })} />
              </div>
              <div className="form-group"><label>截止时间（可选）</label>
                <input type="datetime-local" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>
            <div className="form-group"><label>测试模式</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className={`btn ${form.test_mode === 'en_to_zh' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setForm({ ...form, test_mode: 'en_to_zh' })}>仅英译汉</button>
                <button type="button" className={`btn ${form.test_mode === 'zh_to_en' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setForm({ ...form, test_mode: 'zh_to_en' })}>仅汉译英</button>
                <button type="button" className={`btn ${form.test_mode === 'mixed' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setForm({ ...form, test_mode: 'mixed' })}>交叉随机（推荐）</button>
              </div>
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={form.student_ids.length === students.length && students.length > 0} onChange={toggleAllStudents} />
                选择学生（全选）
              </label>
              {tags.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <span className="muted small" style={{ marginRight: 8 }}>按标签选择：</span>
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ marginRight: 6, marginBottom: 4, borderColor: tag.color, color: tag.color }}
                      onClick={() => selectByTag(tag.id)}
                    >+ {tag.name}（{tag.student_count || 0}人）</button>
                  ))}
                </div>
              )}
              <div className="student-checkboxes">
                {students.map(s => (
                  <label key={s.id} className="checkbox-item">
                    <input type="checkbox" checked={form.student_ids.some(x => Number(x) === Number(s.id))} onChange={() => toggleStudent(s.id)} />
                    {s.username}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setShowCreate(false); setDropdownOpen(false); }}>取消</button>
              <button className="btn btn-primary" onClick={create}>发布</button>
            </div>
          </div>
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          {tasks.length === 0 ? '暂无任务' : '没有符合条件的任务'}
        </div>
      ) : (
        <div className="card-grid">
          {filteredTasks.map(task => {
            const status = statusLabels[task.task_status] || statusLabels.active;
            const progress = task.avg_progress || 0;
            const totalStudents = task.total_students || task.student_count || 0;
            const completedCount = task.completed_count || 0;
            const completionRate = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

            return (
              <div key={task.id} className="card" style={{ borderTop: `3px solid ${status.color}` }}>
                <div className="card-header">
                  <h3 style={{ margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</h3>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500,
                    background: status.bg,
                    color: status.color,
                    flexShrink: 0
                  }}>{status.text}</span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#6b7280', marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {task.show_student_names && task.student_names && task.student_names.length > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        👥 
                        {task.student_names.map((name, idx) => (
                          <span key={idx} style={{
                            background: '#f3f4f6',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 12,
                            color: '#4b5563'
                          }}>{name}</span>
                        ))}
                      </span>
                    ) : (
                      <span>👥 {totalStudents}人</span>
                    )}
                    <span>📝 {task.test_words_count || 10}题</span>
                    {task.deadline && (
                      <span style={{ color: new Date(task.deadline) < new Date() ? '#ef4444' : '#6b7280' }}>
                        🕐 {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: '#6b7280' }}>完成进度</span>
                      <span style={{ fontWeight: 600, color: progress >= 80 ? '#10b981' : progress >= 50 ? '#3b82f6' : '#6b7280' }}>
                        {completedCount}/{totalStudents} 完成 · {completionRate}%
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${completionRate}%`,
                        background: completionRate >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : completionRate >= 50 ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : 'linear-gradient(90deg, #9ca3af, #d1d5db)',
                        borderRadius: 4,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                  
                  {task.avg_score !== null && task.avg_score !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                      <span>📊 平均分</span>
                      <span style={{ fontWeight: 600, color: task.avg_score >= 80 ? '#10b981' : task.avg_score >= 60 ? '#f59e0b' : '#ef4444' }}>
                        {task.avg_score} 分
                      </span>
                    </div>
                  )}
                </div>
                <div className="card-footer">
                  <Link to={`/teacher/tasks/${task.id}/progress`} className="btn btn-outline" style={{ flex: 1 }}>📈 查看详情</Link>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(task.id)}>删除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
