import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = mode === 'login' ? api.login : api.register;
      const args = mode === 'login' ? [username, password] : [username, password, 'student'];
      const data = await fn(...args);
      onLogin(data.token, data.user);
      navigate('/' + data.user.role);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">📖 研途单词</h1>
        <p className="auth-subtitle">研途教育 · 单词测试学习平台</p>
        <div className="auth-tabs">
          <button className={'tab' + (mode === 'login' ? ' active' : '')} onClick={() => setMode('login')}>登录</button>
          <button className={'tab' + (mode === 'register' ? ' active' : '')} onClick={() => setMode('register')}>注册</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          <div className="form-group">
            <label>用户名</label>
            <input value={username} onChange={e => setUsername(e.target.value)} required placeholder="请输入用户名" />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="请输入密码" />
          </div>
          {mode === 'register' && (
            <div className="muted small" style={{ textAlign: 'center', marginBottom: '8px' }}>
              注册后默认是学生身份，老师账号请联系管理员添加
            </div>
          )}
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
          </button>
        </form>
      </div>
    </div>
  );
}
