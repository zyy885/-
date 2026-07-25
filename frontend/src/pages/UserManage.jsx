import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function roleLabel(role) {
  return role === 'teacher' ? '👨‍🏫 老师' : '🎒 学生';
}

function roleBadge(role) {
  return role === 'teacher'
    ? <span className="badge badge-blue">老师</span>
    : <span className="badge badge-green">学生</span>;
}

export default function UserManage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [form, setForm] = useState({ username: '', password: '', role: 'student' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data.users);
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      return alert('请输入用户名和密码');
    }
    try {
      await api.createUser(form);
      setForm({ username: '', password: '', role: 'student' });
      setShowAdd(false);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleBatchImport = async () => {
    if (!batchText.trim()) return alert('请输入用户数据');
    const lines = batchText.trim().split('\n').filter(l => l.trim());
    const users = [];
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        const [username, password, role] = parts;
        users.push({ username, password, role: role || 'student' });
      }
    }
    if (users.length === 0) return alert('未解析到有效用户');
    try {
      const res = await api.batchCreateUsers(users);
      alert(`成功添加 ${res.added || 0} 个，跳过 ${res.skipped || 0} 个`);
      setBatchText('');
      setShowBatch(false);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const removeUser = async (u) => {
    if (!confirm(`确定删除用户「${u.username}」？`)) return;
    try {
      await api.deleteUser(u.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');

  return (
    <div className="task-manage">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>账号管理</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowBatch(true)}>📥 批量导入</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 添加账号</button>
        </div>
      </div>

      {showBatch && (
        <div className="modal" onClick={() => setShowBatch(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h3>批量导入账号</h3>
            <div className="form-group"><label>用户数据</label>
              <textarea
                rows={8}
                value={batchText}
                onChange={e => setBatchText(e.target.value)}
                placeholder={'每行一个，格式：用户名,密码,身份（身份可选，默认student）\n\n例：\nzhangsan,123456\nlisi,123456,student\nwangwu,123456,teacher'}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowBatch(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleBatchImport}>开始导入</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>添加账号</h3>
            <div className="form-group"><label>用户名</label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="请输入用户名" />
            </div>
            <div className="form-group"><label>密码</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="请输入密码" />
            </div>
            <div className="form-group"><label>身份</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="student">学生</option>
                <option value="teacher">老师</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowAdd(false)}>取消</button>
              <button className="btn btn-primary" onClick={addUser}>添加</button>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{users.length}</div><div className="stat-label">总账号</div></div>
        <div className="stat-card"><div className="stat-num">{teachers.length}</div><div className="stat-label">老师</div></div>
        <div className="stat-card"><div className="stat-num">{students.length}</div><div className="stat-label">学生</div></div>
      </div>

      <h3 style={{ marginTop: 24 }}>全部用户</h3>
      <div className="progress-table">
        <table>
          <thead>
            <tr><th>#</th><th>用户名</th><th>身份</th><th>创建时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id}>
                <td>{i + 1}</td>
                <td>{roleLabel(u.role)} {u.username}</td>
                <td>{roleBadge(u.role)}</td>
                <td className="muted small">{new Date(u.created_at).toLocaleString()}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => removeUser(u)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
