const db = require('../src/db');

(async () => {
  // 删除错误的2006 Text 1列表及其单词
  const list = await db.prepare("SELECT id FROM word_lists WHERE name = '2006年阅读理解Text 1' AND teacher_id = 1").get();
  if (list) {
    await db.prepare('DELETE FROM words WHERE word_list_id = ?').run(list.id);
    await db.prepare('DELETE FROM word_lists WHERE id = ?').run(list.id);
    console.log('已删除错误的 2006年阅读理解Text 1 (id=' + list.id + ')');
  }
  console.log('当前所有列表:');
  const lists = await db.prepare('SELECT id, name FROM word_lists WHERE teacher_id = 1 ORDER BY id').all();
  lists.forEach(l => console.log('  ' + l.id + ': ' + l.name));
  process.exit(0);
})();
