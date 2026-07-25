import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function TaskManage() {
  const [tasks, setTasks] = useState([]);
  const [wordBooks, setWordBooks] = useState([]);
  const [lists, setLists] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', word_list_id: '', deadline: '', test_words_count: 10, test_mode: 'mixed', student_ids: [] });

  useEffect(() => { load(); }, []);
  useEffect(() => { loadLists(); }, [selectedBookId]);

  const load = async () => {
    Promise.all([api.getTasks(), api.getWordBooks(), api.getStudents()])
      .then(([t, wb, s]) => {
        setTasks(t.tasks);
        setWordBooks(wb.wordBooks);
        setStudents(s.students);
      })
      .finally(() => setLoading(false));
  };

  const loadLists = async () => {
    try {
      const data = await api.getWordLists(selectedBookId || undefined);
      setLists(data.wordLists);
      if (data.wordLists.length > 0 && !form.word_list_id) {
        setForm(f => ({ ...f, word_list_id: data.wordLists[0].id }));
      }
    } catch (e) {}
  };

  const toggleStudent = (id) => {
    setForm(f => {
      const exists = f.student_ids.includes(id);
      return { ...f, student_ids: exists ? f.student_ids.filter(s => s !== id) : [...f.student_ids, id] };
    });
  };

  const toggleAllStudents = () => {
    if (form.student_ids.length === students.length) {
      setForm(f => ({ ...f, student_ids: [] }));
    } else {
      setForm(f => ({ ...f, student_ids: students.map(s => s.id) }));
    }
  };

  const create = async () => {
    if (!form.name.trim()) return alert('请输入任务名称');
    if (!form.word_list_id) return alert('请选择词表');
    if (form.student_ids.length === 0) return alert('请至少选择一个学生');
    try {
      await api.createTask({
      name: form.name,
      word_list_id: Number(form.word_list_id),
      deadline: form.deadline || null,
      test_words_count: Number(form.test_words_count) || 10,
      test_mode: form.test_mode,
      student_ids: form.student_ids,
    });
      setForm({ name: '', word_list_id: lists[0]?.id || '', deadline: '', test_words_count: 10, test_mode: 'mixed', student_ids: [] });
      setShowCreate(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('确定删除该任务？')) return;
    await api.deleteTask(id);
    load();
  };

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="task-manage">
      <div className="page-header">
        <h2>任务管理</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 发布任务</button>
      </div>

      {showCreate && (
        <div className="modal" onClick={() => setShowCreate(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h3>发布测试任务</h3>
            <div className="form-group"><label>任务名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：Unit 1 测试" />
            </div>
            <div className="form-group"><label>选择单词书</label>
              <select value={selectedBookId || ''} onChange={e => { setSelectedBookId(e.target.value || null); setForm(f => ({ ...f, word_list_id: '' })); }}>
                <option value="">全部词表</option>
                {wordBooks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.list_count || 0}个词表)</option>)}
              </select>
            </div>
            <div className="form-group"><label>选择词表</label>
              <select value={form.word_list_id} onChange={e => setForm({ ...form, word_list_id: e.target.value })}>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.word_count}词)</option>)}
              </select>
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
              <div className="student-checkboxes">
                {students.map(s => (
                  <label key={s.id} className="checkbox-item">
                    <input type="checkbox" checked={form.student_ids.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                    {s.username}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn btn-primary" onClick={create}>发布</button>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="empty-state">暂无任务</div>
      ) : (
        <div className="card-grid">
          {tasks.map(task => (
            <div key={task.id} className="card">
              <div className="card-header">
                <h3>{task.name}</h3>
                <span className="badge badge-blue">{task.student_count}人</span>
              </div>
              <div className="card-body">
                <p className="muted">词表：{task.word_list_name}</p>
                <p className="muted">测试题数：{task.test_words_count || 10}</p>
                {task.deadline && <p className="muted">截止：{new Date(task.deadline).toLocaleString()}</p>}
              </div>
              <div className="card-footer">
                <Link to={`/teacher/tasks/${task.id}/progress`} className="btn btn-outline">查看进度</Link>
                <button className="btn btn-danger btn-sm" onClick={() => remove(task.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
