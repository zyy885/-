import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const TAG_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];

const RANK_LEVELS = [
  { name: '传奇', icon: '🌟', color: '#dc2626', level: 9, minDays: 366, minWords: 20000 },
  { name: '宗师', icon: '👑', color: '#7c3aed', level: 8, minDays: 201, minWords: 12000 },
  { name: '大师', icon: '🏆', color: '#ea580c', level: 7, minDays: 101, minWords: 7000 },
  { name: '钻石', icon: '💠', color: '#2563eb', level: 6, minDays: 61, minWords: 4000 },
  { name: '铂金', icon: '💎', color: '#0891b2', level: 5, minDays: 31, minWords: 2000 },
  { name: '黄金', icon: '🥇', color: '#d97706', level: 4, minDays: 15, minWords: 1000 },
  { name: '白银', icon: '🥈', color: '#6b7280', level: 3, minDays: 8, minWords: 500 },
  { name: '青铜', icon: '🥉', color: '#92400e', level: 2, minDays: 4, minWords: 200 },
  { name: '初学者', icon: '🌱', color: '#65a30d', level: 1, minDays: 0, minWords: 0 },
];

function getRank(days, words) {
  for (const r of RANK_LEVELS) {
    if (days >= r.minDays || words >= r.minWords) return r;
  }
  return RANK_LEVELS[RANK_LEVELS.length - 1];
}

function roleLabel(role) {
  return role === 'teacher' ? '👨‍🏫' : '🎒';
}

function roleBadge(role) {
  return role === 'teacher'
    ? <span className="badge badge-blue">老师</span>
    : <span className="badge badge-green">学生</span>;
}

export default function UserManage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [showAdd, setShowAdd] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showStudentTagModal, setShowStudentTagModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [rankInfo, setRankInfo] = useState(null);
  const [bonusDays, setBonusDays] = useState(0);
  const [bonusWords, setBonusWords] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [studentTagIds, setStudentTagIds] = useState([]);
  const [batchText, setBatchText] = useState('');
  const [form, setForm] = useState({ username: '', password: '', role: 'student' });
  const [tagForm, setTagForm] = useState({ name: '', color: TAG_COLORS[0] });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [usersData, tagsData, checkinData] = await Promise.all([
        api.getUsers(),
        api.getTags().catch(() => ({ tags: [] })),
        api.getAllCheckins().catch(() => ({ checkins: [], all_students: [] })),
      ]);
      setUsers(usersData.users);
      setTags(tagsData.tags || []);
      setCheckins(checkinData.checkins || []);
      setAllStudents(checkinData.all_students || []);
    } catch (e) {
      console.error('加载失败:', e);
      alert('加载失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    if (!form.username.trim() || !form.password.trim()) return alert('请输入用户名和密码');
    try {
      await api.createUser(form);
      setForm({ username: '', password: '', role: 'student' });
      setShowAdd(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const openAddTeacher = () => {
    setForm({ username: '', password: '', role: 'teacher' });
    setShowAdd(true);
  };

  const handleBatchImport = async () => {
    if (!batchText.trim()) return alert('请输入用户数据');
    const lines = batchText.trim().split('\n').filter(l => l.trim());
    const us = [];
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        const [username, password, role] = parts;
        us.push({ username, password, role: role || 'student' });
      }
    }
    if (us.length === 0) return alert('未解析到有效用户');
    try {
      const res = await api.batchCreateUsers(us);
      alert(`成功添加 ${res.added || 0} 个，跳过 ${res.skipped || 0} 个`);
      setBatchText('');
      setShowBatch(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const removeUser = async (u) => {
    if (!confirm(`确定删除用户「${u.username}」？`)) return;
    try { await api.deleteUser(u.id); load(); } catch (e) { alert(e.message); }
  };

  const openResetPassword = (u) => {
    setResetPasswordUser(u);
    setNewPassword('123456');
    setShowPasswordModal(true);
  };

  const saveResetPassword = async () => {
    if (!resetPasswordUser) return;
    if (!newPassword.trim() || newPassword.length < 6) return alert('密码长度至少6位');
    try {
      await api.resetUserPassword(resetPasswordUser.id, newPassword.trim());
      alert(`用户「${resetPasswordUser.username}」的密码已重置为：${newPassword}`);
      setShowPasswordModal(false);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (e) { alert(e.message); }
  };

  const openRankModal = async (student) => {
    setSelectedStudent(student);
    setRankInfo(null);
    setBonusDays(0);
    setBonusWords(0);
    try {
      const data = await api.getUserRankInfo(student.id);
      setRankInfo(data);
      setBonusDays(data.rank_bonus_days || 0);
      setBonusWords(data.rank_bonus_words || 0);
    } catch (e) { console.error(e); }
    setShowRankModal(true);
  };

  const saveRankBonus = async () => {
    if (!selectedStudent) return;
    try {
      await api.updateUserRankBonus(selectedStudent.id, {
        rank_bonus_days: Number(bonusDays) || 0,
        rank_bonus_words: Number(bonusWords) || 0,
      });
      const data = await api.getUserRankInfo(selectedStudent.id);
      setRankInfo(data);
      alert(`「${selectedStudent.username}」的等级奖励已更新！当前等级：${data.rank.icon} ${data.rank.name}`);
      setShowRankModal(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const promoteToMaxRank = () => {
    setBonusDays(9999);
    setBonusWords(999999);
  };

  const openTagModal = (tag = null) => {
    setEditingTag(tag);
    setTagForm(tag ? { name: tag.name, color: tag.color } : { name: '', color: TAG_COLORS[0] });
    setShowTagModal(true);
  };

  const saveTag = async () => {
    if (!tagForm.name.trim()) return alert('请输入标签名称');
    try {
      if (editingTag) {
        await api.updateTag(editingTag.id, tagForm);
      } else {
        await api.createTag(tagForm);
      }
      setShowTagModal(false);
      load();
    } catch (e) { alert(e.message); }
  };

  const deleteTag = async (tag) => {
    if (!confirm(`确定删除标签「${tag.name}」？`)) return;
    try { await api.deleteTag(tag.id); load(); } catch (e) { alert(e.message); }
  };

  const openStudentTagModal = async (student) => {
    setSelectedStudent(student);
    try {
      const data = await api.getStudentTags(student.id);
      setStudentTagIds((data.tags || []).map(t => t.id));
    } catch (e) { setStudentTagIds([]); }
    setShowStudentTagModal(true);
  };

  const saveStudentTags = async () => {
    if (!selectedStudent) return;
    try {
      await api.setStudentTags(selectedStudent.id, studentTagIds);
      setShowStudentTagModal(false);
      setSelectedStudent(null);
    } catch (e) { alert(e.message); }
  };

  const toggleStudentTag = (tagId) => {
    setStudentTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  if (loading) return <div className="loading">加载中...</div>;

  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');
  const checkedInStudentIds = new Set(checkins.map(c => c.student_id));

  return (
    <div className="task-manage">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>账号管理</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowBatch(true)}>📥 批量导入</button>
          <button className="btn btn-outline" onClick={openAddTeacher}>👨‍🏫 添加管理员</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ 添加账号</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <button className={'btn ' + (activeTab === 'users' ? 'btn-primary' : 'btn-outline')} onClick={() => setActiveTab('users')}>👥 用户</button>
        <button className={'btn ' + (activeTab === 'tags' ? 'btn-primary' : 'btn-outline')} onClick={() => setActiveTab('tags')}>🏷️ 标签</button>
        <button className={'btn ' + (activeTab === 'checkins' ? 'btn-primary' : 'btn-outline')} onClick={() => setActiveTab('checkins')}>✅ 打卡</button>
      </div>

      {activeTab === 'users' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num">{users.length}</div><div className="stat-label">总账号</div></div>
            <div className="stat-card"><div className="stat-num">{teachers.length}</div><div className="stat-label">老师</div></div>
            <div className="stat-card"><div className="stat-num">{students.length}</div><div className="stat-label">学生</div></div>
          </div>

          <h3 style={{ marginTop: 24 }}>全部用户</h3>
          <div className="progress-table">
            <table>
              <thead>
                <tr><th>#</th><th>用户名</th><th>身份</th><th>等级</th><th>标签</th><th>创建时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const effectiveDays = (u.total_checkins || 0) + (u.rank_bonus_days || 0);
                  const effectiveWords = (u.total_words || 0) + (u.rank_bonus_words || 0);
                  const rank = u.role === 'student' ? getRank(effectiveDays, effectiveWords) : null;
                  return (
                  <tr key={u.id}>
                    <td>{i + 1}</td>
                    <td>{roleLabel(u.role)} {u.username}</td>
                    <td>{roleBadge(u.role)}</td>
                    <td>
                      {u.role === 'student' ? (
                        <button className="btn btn-outline btn-sm" onClick={() => openRankModal(u)} style={{ borderColor: rank.color, color: rank.color }}>
                          {rank.icon} {rank.name}
                        </button>
                      ) : '-'}
                    </td>
                    <td>
                      {u.role === 'student' ? (
                        <button className="btn btn-outline btn-sm" onClick={() => openStudentTagModal(u)}>
                          🏷️ 打标签
                        </button>
                      ) : '-'}
                    </td>
                    <td className="muted small">{new Date(u.created_at).toLocaleString()}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openResetPassword(u)}>🔑 改密码</button>
                      <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => removeUser(u)}>删除</button>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'tags' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>标签管理</h3>
            <button className="btn btn-primary btn-sm" onClick={() => openTagModal(null)}>+ 新建标签</button>
          </div>
          {tags.length === 0 ? (
            <div className="empty-state">暂无标签，点击右上角新建</div>
          ) : (
            <div className="card-grid">
              {tags.map(tag => (
                <div key={tag.id} className="card" style={{ borderLeft: `4px solid ${tag.color}` }}>
                  <div className="card-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: tag.color }} />
                      {tag.name}
                    </h3>
                    <span className="badge badge-blue">{tag.student_count || 0} 人</span>
                  </div>
                  <div className="card-footer">
                    <button className="btn btn-outline btn-sm" onClick={() => openTagModal(tag)}>编辑</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteTag(tag)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'checkins' && (
        <>
          <h3 style={{ marginTop: 0 }}>今日打卡情况（{new Date().toISOString().split('T')[0]}）</h3>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num">{allStudents.length}</div><div className="stat-label">学生总数</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: '#10b981' }}>{checkins.length}</div><div className="stat-label">已打卡</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: '#ef4444' }}>{allStudents.length - checkins.length}</div><div className="stat-label">未打卡</div></div>
          </div>

          <h3 style={{ marginTop: 24 }}>打卡明细</h3>
          <div className="progress-table">
            <table>
              <thead>
                <tr><th>#</th><th>学生</th><th>状态</th><th>打卡时间</th><th>测试成绩</th></tr>
              </thead>
              <tbody>
                {allStudents.map((s, i) => {
                  const cin = checkins.find(c => c.student_id === s.id);
                  return (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td>🎒 {s.username}</td>
                      <td>
                        {cin
                          ? <span className="badge badge-green">✅ 已打卡</span>
                          : <span className="badge badge-gray">⏳ 未打卡</span>}
                      </td>
                      <td className="muted small">{cin ? new Date(cin.created_at).toLocaleString() : '-'}</td>
                      <td className="muted small">{cin && cin.test_score != null ? `${Math.round(cin.test_score)} 分` : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAdd && (
        <div className="modal" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{form.role === 'teacher' ? '添加管理员' : '添加账号'}</h3>
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

      {showBatch && (
        <div className="modal" onClick={() => setShowBatch(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h3>批量导入账号</h3>
            <div className="form-group"><label>用户数据</label>
              <textarea rows={8} value={batchText} onChange={e => setBatchText(e.target.value)}
                placeholder={'每行一个，格式：用户名,密码,身份（身份可选，默认student）\n\n例：\nzhangsan,123456\nlisi,123456,student\nwangwu,123456,teacher'} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowBatch(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleBatchImport}>开始导入</button>
            </div>
          </div>
        </div>
      )}

      {showTagModal && (
        <div className="modal" onClick={() => setShowTagModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editingTag ? '编辑标签' : '新建标签'}</h3>
            <div className="form-group"><label>标签名称</label>
              <input value={tagForm.name} onChange={e => setTagForm({ ...tagForm, name: e.target.value })} placeholder="如：一班、考研组" />
            </div>
            <div className="form-group"><label>标签颜色</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TAG_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setTagForm({ ...tagForm, color: c })}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', background: c,
                      border: tagForm.color === c ? '3px solid #1a1a2e' : '2px solid transparent',
                      cursor: 'pointer'
                    }} />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowTagModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={saveTag}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showStudentTagModal && selectedStudent && (
        <div className="modal" onClick={() => setShowStudentTagModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>为「{selectedStudent.username}」打标签</h3>
            {tags.length === 0 ? (
              <p className="muted">暂无标签，请先到「标签」页面创建</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tags.map(tag => (
                  <label key={tag.id} className="checkbox-item" style={{
                    padding: '8px 14px', borderRadius: 20, border: `2px solid ${tag.color}`,
                    background: studentTagIds.includes(tag.id) ? tag.color : 'transparent',
                    color: studentTagIds.includes(tag.id) ? 'white' : tag.color,
                    cursor: 'pointer', userSelect: 'none'
                  }}>
                    <input type="checkbox" checked={studentTagIds.includes(tag.id)}
                      onChange={() => toggleStudentTag(tag.id)} style={{ marginRight: 6 }} />
                    {tag.name}
                  </label>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowStudentTagModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={saveStudentTags}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && resetPasswordUser && (
        <div className="modal" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>修改「{resetPasswordUser.username}」的密码</h3>
            <div className="form-group">
              <label>新密码（至少6位）</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="请输入新密码"
                autoFocus
              />
            </div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              默认密码为 123456，建议用户登录后自行修改
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setShowPasswordModal(false); setResetPasswordUser(null); }}>取消</button>
              <button className="btn btn-primary" onClick={saveResetPassword}>确认修改</button>
            </div>
          </div>
        </div>
      )}

      {showRankModal && selectedStudent && (
        <div className="modal" onClick={() => setShowRankModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>「{selectedStudent.username}」的等级信息</h3>
            {rankInfo && rankInfo.rank && (
              <div style={{
                padding: '16px',
                borderRadius: 12,
                marginBottom: 16,
                background: `linear-gradient(135deg, ${rankInfo.rank.color}22, ${rankInfo.rank.color}11)`,
                border: `1px solid ${rankInfo.rank.color}44`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 40 }}>{rankInfo.rank.icon}</span>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: rankInfo.rank.color }}>
                      {rankInfo.rank.name}
                    </div>
                    <div className="muted small">Lv.{rankInfo.rank.level}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 13 }}>
                  <div>🔥 连续打卡：<b>{rankInfo.streak_days}</b> 天</div>
                  <div>📅 累计打卡：<b>{rankInfo.total_checkins}</b> 天</div>
                  <div>📚 学习单词：<b>{rankInfo.total_words}</b> 词</div>
                  <div>🎁 奖励天数：<b style={{ color: '#16a34a' }}>+{rankInfo.rank_bonus_days}</b></div>
                  <div>🎁 奖励单词：<b style={{ color: '#16a34a' }}>+{rankInfo.rank_bonus_words}</b></div>
                  <div>✨ 有效天数：<b>{rankInfo.effective_days}</b></div>
                </div>
                {rankInfo.next_rank && (
                  <div className="muted small" style={{ marginTop: 8 }}>
                    下一等级：{rankInfo.next_rank.icon} {rankInfo.next_rank.name}（打卡 {rankInfo.next_rank.minDays} 天 或 学习 {rankInfo.next_rank.minWords} 词）
                  </div>
                )}
              </div>
            )}
            <div className="form-group">
              <label>奖励打卡天数（加到连续/累计天数上计算等级）</label>
              <input
                type="number"
                min="0"
                max="9999"
                value={bonusDays}
                onChange={e => setBonusDays(Number(e.target.value) || 0)}
              />
            </div>
            <div className="form-group">
              <label>奖励学习单词数（加到学习单词数上计算等级）</label>
              <input
                type="number"
                min="0"
                max="999999"
                value={bonusWords}
                onChange={e => setBonusWords(Number(e.target.value) || 0)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-outline btn-sm" onClick={promoteToMaxRank}>
                🚀 直接升至最高等级（传奇）
              </button>
            </div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              提示：设置奖励天数/单词数后，学生的实际等级将重新计算。
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setShowRankModal(false); setSelectedStudent(null); }}>取消</button>
              <button className="btn btn-primary" onClick={saveRankBonus}>保存等级奖励</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
