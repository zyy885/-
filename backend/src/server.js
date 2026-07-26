const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { signToken, authMiddleware, requireRole } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(FRONTEND_DIST)) {
  console.log('检测到前端构建产物，已启用静态文件托管');
  app.use(express.static(FRONTEND_DIST));
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '参数错误' });
  }
  const exists = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, 'student');
  const user = { id: info.lastInsertRowid, username, role: 'student' };
  res.json({ token: signToken(user), user });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const students = await db.prepare(
    "SELECT id, username, created_at FROM users WHERE role = 'student' ORDER BY id"
  ).all();
  res.json({ students });
});

app.get('/api/users', authMiddleware, requireRole('teacher'), async (req, res) => {
  const users = await db.prepare(
    'SELECT id, username, role, created_at FROM users ORDER BY role, username'
  ).all();
  res.json({ users });
});

app.post('/api/users', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: '参数错误' });
  }
  const exists = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, role);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/users/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '不能删除当前登录账号' });
  }
  await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/word-books', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT wb.*, 
        (SELECT COUNT(*) FROM word_lists wl WHERE wl.word_book_id = wb.id) as list_count,
        (SELECT COUNT(*) FROM words w 
         INNER JOIN word_lists wl ON wl.id = w.word_list_id 
         WHERE wl.word_book_id = wb.id) as word_count
       FROM word_books wb 
       WHERE wb.teacher_id = ? 
       ORDER BY wb.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT DISTINCT wb.*, 
        (SELECT COUNT(*) FROM word_lists wl WHERE wl.word_book_id = wb.id) as list_count,
        (SELECT COUNT(*) FROM words w 
         INNER JOIN word_lists wl ON wl.id = w.word_list_id 
         WHERE wl.word_book_id = wb.id) as word_count
       FROM word_books wb
       WHERE wb.is_public = 1 OR wb.id IN (
         SELECT DISTINCT wl2.word_book_id FROM word_lists wl2
         INNER JOIN tasks t ON t.word_list_id = wl2.id
         INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       ) OR wb.teacher_id = ?
       ORDER BY wb.created_at DESC`
    ).all(req.user.id, req.user.id);
  }
  res.json({ wordBooks: rows });
});

app.post('/api/word-books', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, cover_color, cover_image, is_public } = req.body;
  if (!name) return res.status(400).json({ error: '请输入单词书名称' });
  const info = await db.prepare(
    'INSERT INTO word_books (name, description, cover_color, cover_image, is_public, teacher_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, description || '', cover_color || '#6366f1', cover_image || null, is_public ? 1 : 0, req.user.id);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/word-books/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, cover_color, cover_image, is_public } = req.body;
  await db.prepare(
    'UPDATE word_books SET name = ?, description = ?, cover_color = ?, cover_image = ?, is_public = ? WHERE id = ? AND teacher_id = ?'
  ).run(name, description || '', cover_color || '#6366f1', cover_image || null, is_public ? 1 : 0, req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/word-books/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM word_books WHERE id = ? AND teacher_id = ?').run(
    req.params.id, req.user.id
  );
  res.json({ ok: true });
});

app.get('/api/word-lists', authMiddleware, async (req, res) => {
  const { word_book_id } = req.query;
  let rows;
  let baseSQL = 'SELECT wl.*, (SELECT COUNT(*) FROM words w WHERE w.word_list_id = wl.id) as word_count FROM word_lists wl';
  let whereSQL = '';
  let params = [];

  if (req.user.role === 'teacher') {
    whereSQL = ' WHERE wl.teacher_id = ?';
    params.push(req.user.id);
  } else {
    baseSQL += ` LEFT JOIN tasks t ON t.word_list_id = wl.id
                 LEFT JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
                 LEFT JOIN word_books wb ON wb.id = wl.word_book_id`;
    whereSQL = ' WHERE (ts.id IS NOT NULL OR wb.is_public = 1 OR wl.teacher_id = ?)';
    params.push(req.user.id, req.user.id);
  }

  if (word_book_id) {
    whereSQL += ' AND wl.word_book_id = ?';
    params.push(word_book_id);
  } else if (req.user.role === 'teacher') {
    whereSQL += ' AND wl.word_book_id IS NULL';
  }

  const finalSQL = baseSQL + whereSQL + ' GROUP BY wl.id ORDER BY wl.created_at DESC';
  rows = await db.prepare(finalSQL).all(...params);
  res.json({ wordLists: rows });
});

app.post('/api/word-lists', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, words, word_book_id } = req.body;
  if (!name) return res.status(400).json({ error: '请输入词表名称' });
  const info = await db.prepare(
    'INSERT INTO word_lists (name, description, word_book_id, teacher_id) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', word_book_id || null, req.user.id);
  const listId = info.lastInsertRowid;
  if (words && words.length) {
    const stmt = db.prepare(
      'INSERT INTO words (word_list_id, word, meaning, example) VALUES (?, ?, ?, ?)'
    );
    for (const w of words) {
      if (w.word && w.meaning) await stmt.run(listId, w.word, w.meaning, w.example || '');
    }
  }
  res.json({ id: listId });
});

app.put('/api/word-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, word_book_id } = req.body;
  await db.prepare(
    'UPDATE word_lists SET name = ?, description = ?, word_book_id = ? WHERE id = ? AND teacher_id = ?'
  ).run(name, description || '', word_book_id || null, req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/word-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM word_lists WHERE id = ? AND teacher_id = ?').run(
    req.params.id, req.user.id
  );
  res.json({ ok: true });
});

app.get('/api/word-lists/:id/words', authMiddleware, async (req, res) => {
  const words = await db.prepare(
    'SELECT * FROM words WHERE word_list_id = ? ORDER BY id'
  ).all(req.params.id);
  res.json({ words });
});

app.post('/api/word-lists/:id/words', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { word, meaning, example } = req.body;
  if (!word || !meaning) return res.status(400).json({ error: '单词和释义必填' });
  const info = await db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, word, meaning, example || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/words/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { word, meaning, example } = req.body;
  await db.prepare(
    'UPDATE words SET word = ?, meaning = ?, example = ? WHERE id = ?'
  ).run(word, meaning, example || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/words/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT t.*, wl.name as word_list_name,
        (SELECT COUNT(DISTINCT student_id) FROM task_students ts WHERE ts.task_id = t.id) as student_count
       FROM tasks t
       INNER JOIN word_lists wl ON wl.id = t.word_list_id
       WHERE t.teacher_id = ? ORDER BY t.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT t.*, wl.name as word_list_name, ts.status, ts.study_progress, ts.test_score, ts.last_studied_at,
        (SELECT COUNT(*) FROM words w WHERE w.word_list_id = t.word_list_id) as total_words
       FROM tasks t
       INNER JOIN word_lists wl ON wl.id = t.word_list_id
       INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       ORDER BY t.created_at DESC`
    ).all(req.user.id);
  }
  res.json({ tasks: rows });
});

app.post('/api/tasks', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, word_list_id, deadline, test_words_count, test_mode, student_ids } = req.body;
  if (!name || !word_list_id) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare(
    'INSERT INTO tasks (name, word_list_id, teacher_id, deadline, test_words_count, test_mode) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, word_list_id, req.user.id, deadline || null, test_words_count || 10, test_mode || 'mixed');
  const taskId = info.lastInsertRowid;
  if (student_ids && student_ids.length) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO task_students (task_id, student_id) VALUES (?, ?)'
    );
    for (const sid of student_ids) await stmt.run(taskId, sid);
  }
  res.json({ id: taskId });
});

app.delete('/api/tasks/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM tasks WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/tasks/:id/progress', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    `SELECT ts.*, u.username,
      (SELECT COUNT(*) FROM words w WHERE w.word_list_id = t.word_list_id) as total_words
     FROM task_students ts
     INNER JOIN users u ON u.id = ts.student_id
     INNER JOIN tasks t ON t.id = ts.task_id
     WHERE ts.task_id = ?
     ORDER BY u.username`
  ).all(req.params.id);
  const words = await db.prepare(
    `SELECT w.* FROM words w
     INNER JOIN tasks t ON t.word_list_id = w.word_list_id
     WHERE t.id = ? ORDER BY w.id`
  ).all(req.params.id);
  res.json({ progress: rows, words });
});

app.get('/api/tasks/:id/study', authMiddleware, async (req, res) => {
  const ts = await db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未分配此任务' });
  const words = await db.prepare(
    `SELECT w.* FROM words w
     INNER JOIN tasks t ON t.word_list_id = w.word_list_id
     WHERE t.id = ? ORDER BY w.id`
  ).all(req.params.id);
  const studied = await db.prepare(
    'SELECT word_id, is_known FROM study_records WHERE task_student_id = ?'
  ).all(ts.id);
  const studiedMap = {};
  for (const s of studied) studiedMap[s.word_id] = s.is_known;
  await db.prepare(
    "UPDATE task_students SET status = CASE WHEN status = 'pending' THEN 'studying' ELSE status END, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(ts.id);
  res.json({ taskStudentId: ts.id, words, studiedMap });
});

app.post('/api/study-records', authMiddleware, async (req, res) => {
  const { task_student_id, word_id, is_known } = req.body;
  if (!task_student_id || !word_id) return res.status(400).json({ error: '参数错误' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'student' && ts.student_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  await db.prepare(
    `INSERT INTO study_records (task_student_id, word_id, is_known) VALUES (?, ?, ?)
     ON CONFLICT(task_student_id, word_id) DO UPDATE SET is_known = excluded.is_known, studied_at = CURRENT_TIMESTAMP`
  ).run(task_student_id, word_id, is_known ? 1 : 0);
  const progress = await db.prepare(
    `SELECT
      (SELECT COUNT(*) FROM study_records sr WHERE sr.task_student_id = ts.id) as studied,
      (SELECT COUNT(*) FROM words w
        INNER JOIN tasks t ON t.word_list_id = w.word_list_id
        WHERE t.id = ts.task_id) as total
     FROM task_students ts WHERE ts.id = ?`
  ).get(task_student_id);
  const pct = progress.total > 0 ? Math.min(100, (progress.studied / progress.total) * 100) : 0;
  await db.prepare('UPDATE task_students SET study_progress = ?, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(pct, task_student_id);
  res.json({ ok: true, progress: pct });
});

app.get('/api/tasks/:id/test-words', authMiddleware, async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const ts = await db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未分配此任务' });
  const randomFn = db.isPG ? 'RANDOM()' : 'RANDOM()';
  const allWords = await db.prepare(
    `SELECT * FROM words WHERE word_list_id = ? ORDER BY ${randomFn} LIMIT ?`
  ).all(task.word_list_id, task.test_words_count || 10);
  const mode = task.test_mode || 'en_to_zh';
  const words = allWords.map((w, i) => {
    let qType = 'en_to_zh';
    if (mode === 'zh_to_en') qType = 'zh_to_en';
    else if (mode === 'mixed') qType = i % 2 === 0 ? 'en_to_zh' : 'zh_to_en';
    return { ...w, question_type: qType };
  });
  res.json({ taskStudentId: ts.id, words, testMode: mode });
});

app.post('/api/tests/submit', authMiddleware, async (req, res) => {
  const { task_student_id, answers } = req.body;
  if (!task_student_id || !answers || !answers.length) return res.status(400).json({ error: '参数错误' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'student' && ts.student_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  let correct = 0;
  const insertTr = db.prepare(
    'INSERT INTO test_records (task_student_id, word_id, user_answer, is_correct, question_type) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of answers) {
    const word = await db.prepare('SELECT * FROM words WHERE id = ?').get(a.word_id);
    if (!word) continue;
    const qType = a.question_type || 'en_to_zh';
    let isCorrect = false;
    const userAns = (a.user_answer || '').trim().toLowerCase();
    if (userAns.length === 0) {
      isCorrect = false;
    } else {
      const cleanMeaning = (s) => {
        s = s.trim().toLowerCase();
        s = s.replace(/\(.*?\)/g, '').trim();
        s = s.replace(/^[a-z]+\.\s*/, '').trim();
        s = s.replace(/^[（(][^）)]*[）)]\s*/, '').trim();
        return s;
      };
      if (qType === 'zh_to_en') {
        const validWords = word.word.split(/[;,，；、\/\|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        isCorrect = validWords.some(w => w === userAns || userAns.includes(w) || w.includes(userAns));
      } else {
        const rawMeanings = word.meaning.split(/[;,，；、\/\|]/).map(s => s.trim()).filter(Boolean);
        const validMeanings = rawMeanings.map(cleanMeaning).filter(Boolean);
        isCorrect = validMeanings.some(m => m === userAns || userAns.includes(m) || m.includes(userAns));
      }
    }
    if (isCorrect) correct++;
    await insertTr.run(task_student_id, a.word_id, a.user_answer || '', isCorrect ? 1 : 0, qType);
  }
  const score = (correct / answers.length) * 100;
  await db.prepare(
    "UPDATE task_students SET status = 'tested', test_score = ?, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(score, task_student_id);
  res.json({ score, correct, total: answers.length });
});

app.get('/api/tasks/:id/test-result', authMiddleware, async (req, res) => {
  const ts = await db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  const records = await db.prepare(
    `SELECT tr.*, w.word, w.meaning, w.example
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     WHERE tr.task_student_id = ? ORDER BY tr.id`
  ).all(ts.id);
  res.json({ score: ts.test_score, records });
});

app.put('/api/me/password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '参数错误' });
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 10), req.user.id
  );
  res.json({ ok: true });
});

app.get('/api/favorites', authMiddleware, async (req, res) => {
  const rows = await db.prepare(
    `SELECT f.*, w.word, w.meaning, w.example, w.word_list_id, wl.name as word_list_name
     FROM favorites f
     INNER JOIN words w ON w.id = f.word_id
     LEFT JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`
  ).all(req.user.id);
  res.json({ favorites: rows });
});

app.post('/api/favorites', authMiddleware, async (req, res) => {
  const { word_id } = req.body;
  if (!word_id) return res.status(400).json({ error: '参数错误' });
  await db.prepare('INSERT OR IGNORE INTO favorites (user_id, word_id) VALUES (?, ?)').run(req.user.id, word_id);
  res.json({ ok: true });
});

app.delete('/api/favorites/:wordId', authMiddleware, async (req, res) => {
  await db.prepare('DELETE FROM favorites WHERE user_id = ? AND word_id = ?').run(req.user.id, req.params.wordId);
  res.json({ ok: true });
});

app.get('/api/wrong-book', authMiddleware, async (req, res) => {
  const rows = await db.prepare(
    `SELECT DISTINCT w.*, tr.is_correct, tr.tested_at, wl.name as word_list_name
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     LEFT JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE ts.student_id = ? AND tr.is_correct = 0
     ORDER BY tr.tested_at DESC`
  ).all(req.user.id);
  res.json({ wrongWords: rows });
});

app.get('/api/stats/me', authMiddleware, async (req, res) => {
  const totalTasks = (await db.prepare(
    'SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ?'
  ).get(req.user.id)).cnt;
  const testedTasks = (await db.prepare(
    "SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ? AND status = 'tested'"
  ).get(req.user.id)).cnt;
  const avgScore = (await db.prepare(
    'SELECT AVG(test_score) as avg FROM task_students WHERE student_id = ? AND test_score IS NOT NULL'
  ).get(req.user.id)).avg || 0;
  const studyDays = (await db.prepare(
    "SELECT COUNT(DISTINCT DATE(last_studied_at)) as cnt FROM task_students WHERE student_id = ? AND last_studied_at IS NOT NULL"
  ).get(req.user.id)).cnt;
  const totalWords = (await db.prepare(
    `SELECT COUNT(DISTINCT sr.word_id) as cnt FROM study_records sr
     INNER JOIN task_students ts ON ts.id = sr.task_student_id
     WHERE ts.student_id = ?`
  ).get(req.user.id)).cnt;
  const wrongCount = (await db.prepare(
    `SELECT COUNT(DISTINCT tr.word_id) as cnt FROM test_records tr
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     WHERE ts.student_id = ? AND tr.is_correct = 0`
  ).get(req.user.id)).cnt;
  res.json({
    totalTasks, testedTasks, avgScore: Math.round(avgScore),
    studyDays, totalWords, wrongCount
  });
});

app.get('/api/leaderboard', authMiddleware, async (req, res) => {
  const nullsLast = db.isPG ? 'NULLS LAST' : '';
  const rows = await db.prepare(
    `SELECT u.id, u.username,
      COUNT(DISTINCT ts.id) as tasks,
      AVG(CASE WHEN ts.test_score IS NOT NULL THEN ts.test_score END) as avg_score,
      COUNT(DISTINCT DATE(ts.last_studied_at)) as days
     FROM users u
     LEFT JOIN task_students ts ON ts.student_id = u.id
     WHERE u.role = 'student'
     GROUP BY u.id
     ORDER BY avg_score DESC ${nullsLast}, days DESC, tasks DESC
     LIMIT 20`
  ).all();
  res.json({ leaderboard: rows });
});

app.post('/api/users/batch', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { users } = req.body;
  if (!users || !Array.isArray(users)) return res.status(400).json({ error: '参数错误' });
  let added = 0, skipped = 0;
  await db.transaction(async (txDb) => {
    const stmt = txDb.prepare(
      'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    );
    for (const u of users) {
      if (!u.username || !u.password) { skipped++; continue; }
      const exists = await txDb.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
      if (exists) { skipped++; continue; }
      await stmt.run(u.username, bcrypt.hashSync(u.password, 10), u.role || 'student');
      added++;
    }
  });
  res.json({ added, skipped });
});

app.get('/api/tasks/:id/export', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    `SELECT u.username, ts.status, ts.study_progress, ts.test_score, ts.last_studied_at
     FROM task_students ts
     INNER JOIN users u ON u.id = ts.student_id
     WHERE ts.task_id = ?
     ORDER BY u.username`
  ).all(req.params.id);
  const task = await db.prepare('SELECT name FROM tasks WHERE id = ?').get(req.params.id);
  const csv = [
    ['用户名', '状态', '学习进度%', '测试分数', '最后学习时间'].join(','),
    ...rows.map(r => [
      r.username,
      { pending: '未开始', studying: '学习中', tested: '已测试' }[r.status] || r.status,
      r.study_progress || 0,
      r.test_score ?? '',
      r.last_studied_at || ''
    ].join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${(task?.name || '成绩')}.csv"`);
  res.send('\ufeff' + csv);
});

app.post('/api/task-students/:id/reset', authMiddleware, requireRole('teacher'), async (req, res) => {
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(req.params.id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  await db.prepare('DELETE FROM study_records WHERE task_student_id = ?').run(ts.id);
  await db.prepare('DELETE FROM test_records WHERE task_student_id = ?').run(ts.id);
  await db.prepare(
    "UPDATE task_students SET status = 'pending', study_progress = 0, test_score = NULL, last_studied_at = NULL WHERE id = ?"
  ).run(ts.id);
  res.json({ ok: true });
});

app.get('/api/word-lists/:id/export', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'teacher' && list.teacher_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  const words = await db.prepare('SELECT word, meaning, example FROM words WHERE word_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ name: list.name, description: list.description, words });
});

app.post('/api/word-lists/import', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, words, word_book_id } = req.body;
  if (!name || !words || !Array.isArray(words)) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare(
    'INSERT INTO word_lists (name, description, word_book_id, teacher_id) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', word_book_id || null, req.user.id);
  const listId = info.lastInsertRowid;
  const stmt = db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example) VALUES (?, ?, ?, ?)'
  );
  let count = 0;
  for (const w of words) {
    if (w.word && w.meaning) { await stmt.run(listId, w.word, w.meaning, w.example || ''); count++; }
  }
  res.json({ id: listId, imported: count });
});

app.get('/api/comments', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT c.*, u.username as student_name, t.name as task_name
       FROM comments c
       INNER JOIN users u ON u.id = c.student_id
       LEFT JOIN tasks t ON t.id = c.task_id
       WHERE c.teacher_id = ? ORDER BY c.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT c.*, u.username as teacher_name, t.name as task_name
       FROM comments c
       INNER JOIN users u ON u.id = c.teacher_id
       LEFT JOIN tasks t ON t.id = c.task_id
       WHERE c.student_id = ? ORDER BY c.created_at DESC`
    ).all(req.user.id);
  }
  res.json({ comments: rows });
});

app.post('/api/comments', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { student_id, task_id, content } = req.body;
  if (!student_id || !content) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare(
    'INSERT INTO comments (teacher_id, student_id, task_id, content) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, student_id, task_id || null, content);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/comments/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM comments WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/settings', authMiddleware, async (req, res) => {
  let s = await db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  if (!s) s = { theme: 'light' };
  res.json({ settings: s });
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  const { theme } = req.body;
  await db.prepare(
    `INSERT INTO settings (user_id, theme) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme`
  ).run(req.user.id, theme || 'light');
  res.json({ ok: true });
});

app.get('/api/sentence-lists', authMiddleware, async (req, res) => {
  const where = req.user.role === 'teacher' ? 'WHERE teacher_id = ?' : '';
  const params = req.user.role === 'teacher' ? [req.user.id] : [];
  const rows = await db.prepare(`SELECT * FROM sentence_lists ${where} ORDER BY created_at DESC`).all(...params);
  res.json({ sentenceLists: rows });
});

app.post('/api/sentence-lists', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: '名称必填' });
  const info = await db.prepare('INSERT INTO sentence_lists (name, description, teacher_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/sentence-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description } = req.body;
  await db.prepare('UPDATE sentence_lists SET name = ?, description = ? WHERE id = ? AND teacher_id = ?').run(name, description || '', req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/sentence-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM sentence_lists WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/sentence-lists/:id/sentences', authMiddleware, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM sentences WHERE sentence_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ sentences: rows });
});

app.post('/api/sentence-lists/:id/sentences', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { sentence_en, sentence_zh, analysis } = req.body;
  if (!sentence_en || !sentence_zh) return res.status(400).json({ error: '英文和中文都必填' });
  const info = await db.prepare(
    'INSERT INTO sentences (sentence_list_id, sentence_en, sentence_zh, analysis) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, sentence_en, sentence_zh, analysis || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/sentences/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { sentence_en, sentence_zh, analysis } = req.body;
  await db.prepare('UPDATE sentences SET sentence_en = ?, sentence_zh = ?, analysis = ? WHERE id = ?').run(sentence_en, sentence_zh, analysis || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/sentences/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM sentences WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/sentence-lists/:id/export', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM sentence_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '不存在' });
  const sentences = await db.prepare('SELECT sentence_en, sentence_zh, analysis FROM sentences WHERE sentence_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ name: list.name, description: list.description, sentences });
});

app.post('/api/sentence-lists/import', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, sentences } = req.body;
  if (!name || !Array.isArray(sentences)) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare('INSERT INTO sentence_lists (name, description, teacher_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  const insert = db.prepare('INSERT INTO sentences (sentence_list_id, sentence_en, sentence_zh, analysis) VALUES (?, ?, ?, ?)');
  let count = 0;
  for (const s of sentences) {
    if (s.sentence_en && s.sentence_zh) {
      await insert.run(info.lastInsertRowid, s.sentence_en, s.sentence_zh, s.analysis || '');
      count++;
    }
  }
  res.json({ id: info.lastInsertRowid, imported: count });
});

app.post('/api/translation/submit', authMiddleware, async (req, res) => {
  const { sentence_id, user_translation, is_correct } = req.body;
  if (!sentence_id) return res.status(400).json({ error: '参数错误' });
  await db.prepare(
    'INSERT INTO translation_records (student_id, sentence_id, user_translation, is_correct) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, sentence_id, user_translation || '', is_correct ? 1 : 0);
  res.json({ ok: true });
});

app.get('/api/translation/records', authMiddleware, async (req, res) => {
  const rows = await db.prepare(
    `SELECT tr.*, s.sentence_en, s.sentence_zh, s.analysis, sl.name as list_name
     FROM translation_records tr
     INNER JOIN sentences s ON s.id = tr.sentence_id
     LEFT JOIN sentence_lists sl ON sl.id = s.sentence_list_id
     WHERE tr.student_id = ? ORDER BY tr.translated_at DESC LIMIT 200`
  ).all(req.user.id);
  res.json({ records: rows });
});

app.get('/api/task-students/:id/test-records', authMiddleware, requireRole('teacher'), async (req, res) => {
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(req.params.id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(ts.task_id);
  if (task && task.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  const records = await db.prepare(
    `SELECT tr.*, w.word, w.meaning, w.example, u.username as student_name
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     INNER JOIN users u ON u.id = ts.student_id
     WHERE tr.task_student_id = ? ORDER BY tr.id`
  ).all(req.params.id);
  res.json({ taskStudent: ts, records });
});

app.put('/api/test-records/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { is_correct } = req.body;
  const rec = await db.prepare('SELECT * FROM test_records WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: '未找到' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(rec.task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(ts.task_id);
  if (task && task.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare('UPDATE test_records SET is_correct = ? WHERE id = ?').run(is_correct ? 1 : 0, req.params.id);
  const stats = await db.prepare(
    'SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct FROM test_records WHERE task_student_id = ?'
  ).get(ts.id);
  const score = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
  await db.prepare('UPDATE task_students SET test_score = ? WHERE id = ?').run(score, ts.id);
  res.json({ ok: true, score });
});

app.get('/api/checkins/status', authMiddleware, requireRole('student'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const studentId = req.user.id;

  const todayCheckin = await db.prepare(
    isPG
      ? "SELECT * FROM checkins WHERE student_id = $1 AND checkin_date = $2"
      : "SELECT * FROM checkins WHERE student_id = ? AND checkin_date = ?"
  ).get(studentId, today);

  const totalCheckins = await db.prepare(
    isPG
      ? "SELECT COUNT(*) as cnt FROM checkins WHERE student_id = $1"
      : "SELECT COUNT(*) as cnt FROM checkins WHERE student_id = ?"
  ).get(studentId);

  let canCheckin = false;
  let checkinReason = '';
  let todayTest = null;

  const recentTasks = await db.prepare(
    isPG
      ? `SELECT ts.*, t.name as task_name
         FROM task_students ts
         LEFT JOIN tasks t ON t.id = ts.task_id
         WHERE ts.student_id = $1 AND ts.status = 'tested'
         ORDER BY ts.last_studied_at DESC LIMIT 20`
      : `SELECT ts.*, t.name as task_name
         FROM task_students ts
         LEFT JOIN tasks t ON t.id = ts.task_id
         WHERE ts.student_id = ? AND ts.status = 'tested'
         ORDER BY ts.last_studied_at DESC LIMIT 20`
  ).all(studentId);

  const todayTaskTests = recentTasks.filter(ts => {
    if (!ts.last_studied_at) return false;
    const testDate = new Date(ts.last_studied_at).toISOString().split('T')[0];
    return testDate === today;
  });

  const recentSelfTests = await db.prepare(
    isPG
      ? `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
         FROM self_tests st
         LEFT JOIN word_books wb ON wb.id = st.word_book_id
         LEFT JOIN word_lists wl ON wl.id = st.word_list_id
         WHERE st.student_id = $1
         ORDER BY st.created_at DESC LIMIT 20`
      : `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
         FROM self_tests st
         LEFT JOIN word_books wb ON wb.id = st.word_book_id
         LEFT JOIN word_lists wl ON wl.id = st.word_list_id
         WHERE st.student_id = ?
         ORDER BY st.created_at DESC LIMIT 20`
  ).all(studentId);

  const todaySelfTests = recentSelfTests.filter(st => {
    if (!st.created_at) return false;
    const testDate = new Date(st.created_at).toISOString().split('T')[0];
    return testDate === today;
  });

  const allTodayScores = [
    ...todayTaskTests.map(t => ({ score: t.test_score || 0, name: t.task_name || '任务测试', type: 'task' })),
    ...todaySelfTests.map(t => ({ score: t.score || 0, name: t.word_book_name || t.word_list_name || '自测', type: 'self' })),
  ];

  if (allTodayScores.length > 0) {
    const bestScore = Math.max(...allTodayScores.map(t => t.score));
    const bestTest = allTodayScores.find(t => t.score === bestScore);
    todayTest = { score: bestScore, name: bestTest.name, type: bestTest.type };
    if (bestScore >= 70) {
      canCheckin = !todayCheckin;
      checkinReason = canCheckin ? `今日最佳成绩 ${Math.round(bestScore)}%（${bestTest.name}），可以打卡！` : '今日已打卡';
    } else {
      checkinReason = `今日最高正确率仅 ${Math.round(bestScore)}%，需达到 70% 才能打卡`;
    }
  } else {
    checkinReason = '今日还没有完成测试，完成测试且正确率 ≥ 70% 即可打卡（任务测试或自测均可）';
  }

  res.json({
    checked_in: !!todayCheckin,
    can_checkin: canCheckin,
    checkin_reason: checkinReason,
    today_test: todayTest,
    total_checkins: totalCheckins.cnt || 0,
    today_checkin: todayCheckin,
  });
});

app.post('/api/checkins', authMiddleware, requireRole('student'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const studentId = req.user.id;

  const todayCheckin = await db.prepare(
    isPG
      ? "SELECT * FROM checkins WHERE student_id = $1 AND checkin_date = $2"
      : "SELECT * FROM checkins WHERE student_id = ? AND checkin_date = ?"
  ).get(studentId, today);

  if (todayCheckin) {
    return res.status(400).json({ error: '今日已打卡' });
  }

  const taskTests = await db.prepare(
    isPG
      ? `SELECT ts.* FROM task_students ts
         WHERE ts.student_id = $1 AND ts.status = 'tested'`
      : `SELECT ts.* FROM task_students ts
         WHERE ts.student_id = ? AND ts.status = 'tested'`
  ).all(studentId);

  const todayValidTasks = taskTests.filter(ts => {
    if (!ts.last_studied_at) return false;
    const testDate = new Date(ts.last_studied_at).toISOString().split('T')[0];
    return testDate === today && (ts.test_score || 0) >= 70;
  });

  const selfTests = await db.prepare(
    isPG
      ? `SELECT * FROM self_tests WHERE student_id = $1`
      : `SELECT * FROM self_tests WHERE student_id = ?`
  ).all(studentId);

  const todayValidSelf = selfTests.filter(st => {
    if (!st.created_at) return false;
    const testDate = new Date(st.created_at).toISOString().split('T')[0];
    return testDate === today && (st.score || 0) >= 70;
  });

  const allValid = [
    ...todayValidTasks.map(t => ({ id: t.id, score: t.test_score || 0, type: 'task' })),
    ...todayValidSelf.map(t => ({ id: t.id, score: t.score || 0, type: 'self' })),
  ];

  if (allValid.length === 0) {
    return res.status(400).json({ error: '今日没有符合条件的测试记录（需正确率 ≥ 70%，任务测试或自测均可）' });
  }

  const bestTest = allValid.reduce((a, b) => a.score > b.score ? a : b);

  const info = await db.prepare(
    isPG
      ? `INSERT INTO checkins (student_id, checkin_date, task_student_id, test_score)
         VALUES ($1, $2, $3, $4)`
      : `INSERT INTO checkins (student_id, checkin_date, task_student_id, test_score)
         VALUES (?, ?, ?, ?)`
  ).run(studentId, today, bestTest.type === 'task' ? bestTest.id : null, bestTest.score);

  res.json({ ok: true, id: info.lastInsertRowid, test_score: bestTest.test_score });
});

app.get('/api/checkins', authMiddleware, requireRole('student'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT * FROM checkins WHERE student_id = $1 ORDER BY checkin_date DESC LIMIT 30`
      : `SELECT * FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC LIMIT 30`
  ).all(req.user.id);
  res.json({ checkins: rows });
});

app.get('/api/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT t.*, (SELECT COUNT(*) FROM student_tags st WHERE st.tag_id = t.id) as student_count
         FROM tags t WHERE t.teacher_id = $1 ORDER BY t.created_at DESC`
      : `SELECT t.*, (SELECT COUNT(*) FROM student_tags st WHERE st.tag_id = t.id) as student_count
         FROM tags t WHERE t.teacher_id = ? ORDER BY t.created_at DESC`
  ).all(req.user.id);
  res.json({ tags: rows });
});

app.post('/api/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入标签名称' });
  const info = await db.prepare(
    isPG
      ? 'INSERT INTO tags (name, color, teacher_id) VALUES ($1, $2, $3)'
      : 'INSERT INTO tags (name, color, teacher_id) VALUES (?, ?, ?)'
  ).run(name.trim(), color || '#6366f1', req.user.id);
  res.json({ id: info.lastInsertRowid, ok: true });
});

app.put('/api/tags/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, color } = req.body;
  const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: '标签不存在' });
  if (tag.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare(
    isPG
      ? 'UPDATE tags SET name = $1, color = $2 WHERE id = $3'
      : 'UPDATE tags SET name = ?, color = ? WHERE id = ?'
  ).run(name || tag.name, color || tag.color, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/tags/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: '标签不存在' });
  if (tag.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/students/:id/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT t.* FROM tags t
         INNER JOIN student_tags st ON st.tag_id = t.id
         WHERE st.student_id = $1 AND t.teacher_id = $2`
      : `SELECT t.* FROM tags t
         INNER JOIN student_tags st ON st.tag_id = t.id
         WHERE st.student_id = ? AND t.teacher_id = ?`
  ).all(req.params.id, req.user.id);
  res.json({ tags: rows });
});

app.post('/api/students/:id/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { tag_ids } = req.body;
  const studentId = req.params.id;
  await db.prepare('DELETE FROM student_tags WHERE student_id = ?').run(studentId);
  if (tag_ids && tag_ids.length > 0) {
    const insert = db.prepare(
      isPG
        ? 'INSERT INTO student_tags (student_id, tag_id) VALUES ($1, $2)'
        : 'INSERT INTO student_tags (student_id, tag_id) VALUES (?, ?)'
    );
    for (const tagId of tag_ids) {
      const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
      if (tag && tag.teacher_id === req.user.id) {
        try { await insert.run(studentId, tagId); } catch (e) {}
      }
    }
  }
  res.json({ ok: true });
});

app.get('/api/tags/:id/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT u.* FROM users u
         INNER JOIN student_tags st ON st.student_id = u.id
         WHERE st.tag_id = $1`
      : `SELECT u.* FROM users u
         INNER JOIN student_tags st ON st.student_id = u.id
         WHERE st.tag_id = ?`
  ).all(req.params.id);
  res.json({ students: rows });
});

app.get('/api/checkins/all', authMiddleware, requireRole('teacher'), async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const rows = await db.prepare(
    isPG
      ? `SELECT c.*, u.username
         FROM checkins c
         LEFT JOIN users u ON u.id = c.student_id
         WHERE c.checkin_date = $1
         ORDER BY c.created_at DESC`
      : `SELECT c.*, u.username
         FROM checkins c
         LEFT JOIN users u ON u.id = c.student_id
         WHERE c.checkin_date = ?
         ORDER BY c.created_at DESC`
  ).all(date);
  const allStudents = await db.prepare("SELECT id, username FROM users WHERE role = 'student'").all();
  res.json({ checkins: rows, all_students: allStudents, date });
});

app.get('/api/self-tests/words', authMiddleware, requireRole('student'), async (req, res) => {
  const { word_book_id, word_list_id, count = 20, mode = 'mixed' } = req.query;
  let words = [];
  if (word_list_id) {
    words = await db.prepare('SELECT * FROM words WHERE word_list_id = ? ORDER BY RANDOM() LIMIT ?').all(word_list_id, Math.min(Number(count), 100));
  } else if (word_book_id) {
    words = await db.prepare(
      `SELECT w.* FROM words w
       INNER JOIN word_lists wl ON wl.id = w.word_list_id
       WHERE wl.word_book_id = ?
       ORDER BY RANDOM() LIMIT ?`
    ).all(word_book_id, Math.min(Number(count), 100));
  }
  const qMode = mode === 'en_to_zh' ? 'en_to_zh' : mode === 'zh_to_en' ? 'zh_to_en' : 'mixed';
  const questions = words.map(w => ({
    word_id: w.id,
    word: w.word,
    meaning: w.meaning,
    question_type: qMode === 'mixed' ? (Math.random() > 0.5 ? 'en_to_zh' : 'zh_to_en') : qMode,
  }));
  res.json({ questions, total: questions.length });
});

app.post('/api/self-tests/submit', authMiddleware, requireRole('student'), async (req, res) => {
  const { word_book_id, word_list_id, answers } = req.body;
  if (!answers || !answers.length) return res.status(400).json({ error: '参数错误' });
  let correct = 0;
  const cleanMeaning = (s) => {
    s = s.trim().toLowerCase();
    s = s.replace(/\(.*?\)/g, '').trim();
    s = s.replace(/^[a-z]+\.\s*/, '').trim();
    s = s.replace(/^[（(][^）)]*[）)]\s*/, '').trim();
    return s;
  };
  for (const a of answers) {
    const word = await db.prepare('SELECT * FROM words WHERE id = ?').get(a.word_id);
    if (!word) continue;
    const qType = a.question_type || 'en_to_zh';
    const userAns = (a.user_answer || '').trim().toLowerCase();
    if (userAns.length > 0) {
      if (qType === 'zh_to_en') {
        const validWords = word.word.split(/[;,，；、\/\|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        if (validWords.some(w => w === userAns || userAns.includes(w) || w.includes(userAns))) a.is_correct = true;
      } else {
        const rawMeanings = word.meaning.split(/[;,，；、\/\|]/).map(s => s.trim()).filter(Boolean);
        const validMeanings = rawMeanings.map(cleanMeaning).filter(Boolean);
        if (validMeanings.some(m => m === userAns || userAns.includes(m) || m.includes(userAns))) a.is_correct = true;
      }
    }
    if (a.is_correct) correct++;
  }
  const score = (correct / answers.length) * 100;
  const info = await db.prepare(
    isPG
      ? 'INSERT INTO self_tests (student_id, word_book_id, word_list_id, total_words, correct_count, score) VALUES ($1, $2, $3, $4, $5, $6)'
      : 'INSERT INTO self_tests (student_id, word_book_id, word_list_id, total_words, correct_count, score) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, word_book_id || null, word_list_id || null, answers.length, correct, score);
  const selfTestId = info.lastInsertRowid;
  const insertRec = db.prepare(
    isPG
      ? 'INSERT INTO self_test_records (self_test_id, word_id, user_answer, is_correct, question_type) VALUES ($1, $2, $3, $4, $5)'
      : 'INSERT INTO self_test_records (self_test_id, word_id, user_answer, is_correct, question_type) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of answers) {
    await insertRec.run(selfTestId, a.word_id, a.user_answer || '', a.is_correct ? 1 : 0, a.question_type || 'en_to_zh');
  }
  res.json({ self_test_id: selfTestId, score, correct, total: answers.length });
});

app.get('/api/self-tests', authMiddleware, requireRole('student'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
         FROM self_tests st
         LEFT JOIN word_books wb ON wb.id = st.word_book_id
         LEFT JOIN word_lists wl ON wl.id = st.word_list_id
         WHERE st.student_id = $1
         ORDER BY st.created_at DESC LIMIT 50`
      : `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
         FROM self_tests st
         LEFT JOIN word_books wb ON wb.id = st.word_book_id
         LEFT JOIN word_lists wl ON wl.id = st.word_list_id
         WHERE st.student_id = ?
         ORDER BY st.created_at DESC LIMIT 50`
  ).all(req.user.id);
  res.json({ self_tests: rows });
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`服务运行在 http://localhost:${PORT}`);
});
