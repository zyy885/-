import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { api, getCurrentUser, clearAuth, setAuth } from './api.js';
import WelcomeModal from './components/WelcomeModal.jsx';
import Login from './pages/Login.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import StudyPage from './pages/StudyPage.jsx';
import TestPage from './pages/TestPage.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import WordListManage from './pages/WordListManage.jsx';
import TaskManage from './pages/TaskManage.jsx';
import ProgressView from './pages/ProgressView.jsx';
import StudentWordLists from './pages/StudentWordLists.jsx';
import UserManage from './pages/UserManage.jsx';
import WrongBook from './pages/WrongBook.jsx';
import Favorites from './pages/Favorites.jsx';
import StatsPage from './pages/StatsPage.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import CommentsStudent from './pages/CommentsStudent.jsx';
import CommentsTeacher from './pages/CommentsTeacher.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SentenceListManage from './pages/SentenceListManage.jsx';
import SentencePractice from './pages/SentencePractice.jsx';

function Navbar() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  if (!user) return null;

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  const links = user.role === 'teacher'
    ? [
        { to: '/teacher', label: '总览' },
        { to: '/teacher/word-lists', label: '词表管理' },
        { to: '/teacher/sentence-lists', label: '长难句' },
        { to: '/teacher/tasks', label: '任务管理' },
        { to: '/teacher/users', label: '账号管理' },
        { to: '/teacher/comments', label: '留言' },
      ]
    : [
        { to: '/student', label: '我的任务' },
        { to: '/student/word-lists', label: '词表总览' },
        { to: '/student/sentence-practice', label: '长难句' },
        { to: '/student/wrong-book', label: '错题本' },
        { to: '/student/favorites', label: '收藏' },
        { to: '/student/stats', label: '统计' },
        { to: '/student/leaderboard', label: '排行' },
        { to: '/student/comments', label: '留言' },
      ];

  const goTo = (to) => {
    setMobileMenuOpen(false);
    navigate(to);
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <span className="logo">📖 研途单词</span>
      </div>
      <div className="nav-center">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={'nav-link' + (location.pathname === l.to ? ' active' : '')}
          >{l.label}</Link>
        ))}
      </div>
      <div className="nav-right">
        <button className="btn-link" onClick={() => navigate('/settings')} title="设置">⚙️</button>
        <span className="user-info">{user.role === 'teacher' ? '👨‍🏫' : '🎒'} {user.username}</span>
        <button className="btn-link" onClick={logout}>退出</button>
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} title="菜单">
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>
      {mobileMenuOpen && (
        <div className="mobile-menu">
          {links.map(l => (
            <div
              key={l.to}
              className={'mobile-menu-item' + (location.pathname === l.to ? ' active' : '')}
              onClick={() => goTo(l.to)}
            >{l.label}</div>
          ))}
          <div className="mobile-menu-item" onClick={() => { setMobileMenuOpen(false); navigate('/settings'); }}>⚙️ 设置</div>
          <div className="mobile-menu-item" onClick={() => { setMobileMenuOpen(false); logout(); }}>🚪 退出登录</div>
        </div>
      )}
    </nav>
  );
}

function ProtectedRoute({ children, role }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={'/' + user.role} replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const handler = () => setUser(getCurrentUser());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    const theme = localStorage.getItem('vocab_theme');
    if (theme === 'dark') document.body.classList.add('dark-theme');
  }, []);

  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login onLogin={(t, u) => { setAuth(t, u); setUser(u); }} />} />
          <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/task/:id/study" element={<ProtectedRoute role="student"><StudyPage /></ProtectedRoute>} />
          <Route path="/student/task/:id/test" element={<ProtectedRoute role="student"><TestPage /></ProtectedRoute>} />
          <Route path="/student/word-lists" element={<ProtectedRoute role="student"><StudentWordLists /></ProtectedRoute>} />
          <Route path="/student/sentence-practice" element={<ProtectedRoute role="student"><SentencePractice /></ProtectedRoute>} />
          <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/word-lists" element={<ProtectedRoute role="teacher"><WordListManage /></ProtectedRoute>} />
          <Route path="/teacher/sentence-lists" element={<ProtectedRoute role="teacher"><SentenceListManage /></ProtectedRoute>} />
          <Route path="/teacher/tasks" element={<ProtectedRoute role="teacher"><TaskManage /></ProtectedRoute>} />
          <Route path="/teacher/tasks/:id/progress" element={<ProtectedRoute role="teacher"><ProgressView /></ProtectedRoute>} />
          <Route path="/teacher/users" element={<ProtectedRoute role="teacher"><UserManage /></ProtectedRoute>} />
          <Route path="/teacher/comments" element={<ProtectedRoute role="teacher"><CommentsTeacher /></ProtectedRoute>} />
          <Route path="/student/wrong-book" element={<ProtectedRoute role="student"><WrongBook /></ProtectedRoute>} />
          <Route path="/student/favorites" element={<ProtectedRoute role="student"><Favorites /></ProtectedRoute>} />
          <Route path="/student/stats" element={<ProtectedRoute role="student"><StatsPage /></ProtectedRoute>} />
          <Route path="/student/leaderboard" element={<ProtectedRoute role="student"><Leaderboard /></ProtectedRoute>} />
          <Route path="/student/comments" element={<ProtectedRoute role="student"><CommentsStudent /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function HomeRedirect() {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={'/' + user.role} replace />;
}
