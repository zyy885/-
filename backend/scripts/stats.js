const db = require('../src/db');

(async () => {
  const wb = await db.prepare("SELECT * FROM word_books WHERE name = '考研英语阅读真题词汇'").get();
  console.log('📖 单词书:', wb.name);
  const lists = await db.prepare('SELECT id, name FROM word_lists WHERE word_book_id = ? ORDER BY id').all(wb.id);
  console.log('共', lists.length, '个单词列表:');
  let total = 0;
  for (const l of lists) {
    const cnt = await db.prepare('SELECT COUNT(*) as c FROM words WHERE word_list_id = ?').get(l.id);
    console.log('  ' + l.name + ': ' + cnt.c + ' 词');
    total += cnt.c;
  }
  console.log('');
  console.log('总计: ' + total + ' 个单词');
  process.exit(0);
})();
