const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'vocab.db');
const Database = require('better-sqlite3');
const db = new Database(dbPath);

const chineseNumMap = { '零':0, '一':1, '二':2, '两':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '百':100, '千':1000, '万':10000 };

function chineseToNum(s) {
  s = s.trim();
  if (/^\d+$/.test(s)) return parseInt(s);
  let total = 0, temp = 0, lastUnit = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const v = chineseNumMap[c];
    if (v === undefined) continue;
    if (v >= 10) {
      if (temp === 0) temp = 1;
      temp *= v;
      if (v >= 100) { total += temp; temp = 0; }
      lastUnit = v;
    } else {
      if (lastUnit >= 10) { total += temp; temp = 0; }
      temp = v;
      lastUnit = 1;
    }
  }
  return total + temp;
}

function convertName(name) {
  if (!name) return name;
  const patterns = [
    /^第([零一二三四五六七八九十百千万两]+)([页节章单元])(.*)$/,
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) {
      const n = chineseToNum(m[1]);
      if (n > 0) {
        return '第' + n + m[2] + (m[3] || '');
      }
    }
  }
  return name;
}

// 查找这本单词书
const books = db.prepare("SELECT id, name FROM word_books WHERE name LIKE '%考研单词%'").all();
console.log('找到的单词书:', books);

if (books.length > 0) {
  const bookId = books[0].id;
  console.log('使用单词书ID:', bookId, '名称:', books[0].name);
  
  const lists = db.prepare("SELECT id, name FROM word_lists WHERE word_book_id = ? ORDER BY name").all(bookId);
  console.log('\n当前词表:');
  for (const l of lists) {
    const newName = convertName(l.name);
    console.log(`  ${l.id}: "${l.name}" → "${newName}"`);
    if (newName !== l.name) {
      db.prepare("UPDATE word_lists SET name = ? WHERE id = ?").run(newName, l.id);
    }
  }
  console.log('\n更新完成!');
} else {
  console.log('未找到匹配的单词书，显示所有单词书:');
  const all = db.prepare("SELECT id, name FROM word_books").all();
  for (const b of all) console.log('  ', b.id, b.name);
}
