const xlsx = require('xlsx');
const db = require('./src/db');
const { isPG } = require('./src/db');

(async () => {
  console.log('数据库类型: ' + (isPG ? 'PostgreSQL' : 'SQLite'));
  
  const wb = xlsx.readFile('H:\\工作\\考研单词\\单词表副本\\第三天·.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, {header:1});

  const words = [];
  const seen = new Set();
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    for (let g = 0; g < 4; g++) {
      const wordIdx = 1 + g * 3;
      const meaningIdx = 2 + g * 3;
      const word = row[wordIdx];
      const meaning = row[meaningIdx];
      if (word && meaning && typeof word === 'string' && word.trim()) {
        const key = word.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          words.push({
            word: word.trim(),
            meaning: String(meaning).trim().replace(/\n/g, '; ')
          });
        }
      }
    }
  }
  
  console.log('解析完成，去重后共 ' + words.length + ' 个单词');
  
  const teacher = await db.prepare("SELECT id FROM users WHERE role = 'teacher' LIMIT 1").get();
  if (!teacher) { console.log('没有教师账号'); return; }
  const teacherId = teacher.id;
  console.log('使用教师ID: ' + teacherId);
  
  const existing = await db.prepare('SELECT id FROM word_books WHERE name = ? AND teacher_id = ?').get('打卡100单词', teacherId);
  let bookId;
  if (existing) {
    bookId = existing.id;
    console.log('单词书已存在，ID: ' + bookId + '，先清理旧词表...');
    const oldLists = await db.prepare('SELECT id FROM word_lists WHERE word_book_id = ?').all(bookId);
    for (const l of oldLists) {
      await db.prepare('DELETE FROM words WHERE word_list_id = ?').run(l.id);
    }
    await db.prepare('DELETE FROM word_lists WHERE word_book_id = ?').run(bookId);
    console.log('  已清理 ' + oldLists.length + ' 个旧词表');
  } else {
    const publicFlag = isPG ? true : 1;
    const bookInfo = await db.prepare(
      'INSERT INTO word_books (name, description, cover_color, is_public, teacher_id) VALUES (?, ?, ?, ?, ?)'
    ).run('打卡100单词', '考研核心词汇，每天100个，共38天', '#6366f1', publicFlag, teacherId);
    bookId = bookInfo.lastInsertRowid;
    console.log('创建单词书成功，ID: ' + bookId);
  }
  
  const totalDays = Math.ceil(words.length / 100);
  console.log('共 ' + totalDays + ' 天，开始导入...');
  
  for (let day = 1; day <= totalDays; day++) {
    const startIdx = (day - 1) * 100;
    const endIdx = Math.min(day * 100, words.length);
    const dayWords = words.slice(startIdx, endIdx);
    
    const listInfo = await db.prepare(
      'INSERT INTO word_lists (name, description, word_book_id, teacher_id) VALUES (?, ?, ?, ?)'
    ).run('第' + day + '天', '打卡第' + day + '天，共' + dayWords.length + '个单词', bookId, teacherId);
    const listId = listInfo.lastInsertRowid;
    
    const stmt = db.prepare(
      'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < dayWords.length; i++) {
      await stmt.run(listId, dayWords[i].word, dayWords[i].meaning, '', i + 1);
    }
    
    console.log('  第' + day + '天: ' + dayWords.length + ' 个单词 ✓');
  }
  
  console.log('\n全部完成！共导入 ' + words.length + ' 个单词，分成 ' + totalDays + ' 个词表');
  process.exit(0);
})();
