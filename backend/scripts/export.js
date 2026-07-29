const db = require('../src/db');
const fs = require('fs');
const path = require('path');

(async () => {
  const wb = await db.prepare("SELECT * FROM word_books WHERE name = '考研英语阅读真题词汇'").get();
  const lists = await db.prepare('SELECT * FROM word_lists WHERE word_book_id = ? ORDER BY id').all(wb.id);
  
  const result = {
    wordBook: { name: wb.name, description: wb.description, is_public: wb.is_public },
    lists: []
  };
  
  for (const l of lists) {
    const words = await db.prepare('SELECT word, meaning, sort_order FROM words WHERE word_list_id = ? ORDER BY sort_order, id').all(l.id);
    result.lists.push({
      name: l.name,
      description: l.description,
      words: words.map(w => ({ word: w.word, meaning: w.meaning }))
    });
  }
  
  const outPath = path.join(__dirname, 'kaoyan_vocab_export.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log('已导出到:', outPath);
  console.log('单词书:', result.wordBook.name);
  console.log('单词列表:', result.lists.length + ' 个');
  console.log('总单词数:', result.lists.reduce((s, l) => s + l.words.length, 0));
  process.exit(0);
})();
