const path = require('path');
const dbPath = path.join(__dirname, 'vocab.db');
const Database = require('better-sqlite3');
const db = new Database(dbPath);

const all = db.prepare("SELECT id, name FROM word_books").all();
for (const b of all) {
  console.log(`\n📚 ${b.id}: ${b.name}`);
  const lists = db.prepare("SELECT id, name FROM word_lists WHERE word_book_id = ? ORDER BY id").all(b.id);
  for (const l of lists) {
    console.log(`   📄 ${l.id}: ${l.name}`);
  }
}
