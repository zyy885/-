import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('vocab_theme') || 'light';
    setTheme(savedTheme);
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-eye', 'dark-theme');
    if (savedTheme !== 'light') {
      document.body.classList.add('theme-' + savedTheme);
    }
  }, []);

  const changeTheme = async (newTheme) => {
    try {
      await api.saveSettings({ theme: newTheme });
      setTheme(newTheme);
      localStorage.setItem('vocab_theme', newTheme);
      document.body.classList.remove('theme-light', 'theme-dark', 'theme-eye', 'dark-theme');
      if (newTheme !== 'light') {
        document.body.classList.add('theme-' + newTheme);
      }
      window.dispatchEvent(new CustomEvent('theme-changed'));
    } catch (e) {
      alert(e.message);
    }
  };

  const changePassword = async () => {
    if (!oldPw.trim() || !newPw.trim() || !confirmPw.trim()) {
      return alert('请填写所有密码字段');
    }
    if (newPw !== confirmPw) {
      return alert('两次输入的新密码不一致');
    }
    try {
      await api.changePassword(oldPw, newPw);
      alert('密码修改成功');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="progress-view">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>设置</h2>
        <div />
      </div>

      <div className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
        <h3>修改密码</h3>
        <div className="form-group"><label>原密码</label>
          <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="请输入原密码" />
        </div>
        <div className="form-group"><label>新密码</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="请输入新密码" />
        </div>
        <div className="form-group"><label>确认新密码</label>
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="请再次输入新密码" />
        </div>
        <button className="btn btn-primary" onClick={changePassword}>修改密码</button>
      </div>

      <div className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
        <h3>主题切换</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
          <button
            className={'btn ' + (theme === 'light' ? 'btn-primary' : 'btn-outline')}
            onClick={() => changeTheme('light')}
          >
            ☀️ 浅色
          </button>
          <button
            className={'btn ' + (theme === 'dark' ? 'btn-primary' : 'btn-outline')}
            onClick={() => changeTheme('dark')}
          >
            🌙 深色
          </button>
          <button
            className={'btn ' + (theme === 'eye' ? 'btn-primary' : 'btn-outline')}
            onClick={() => changeTheme('eye')}
          >
            👁️ 护眼
          </button>
        </div>
      </div>
    </div>
  );
}
