const db = require('../src/db');

function parseListName(name) {
  const m = name.match(/(\d{4})年阅读理解Text\s*(\d+)/);
  if (m) return { year: parseInt(m[1]), text: parseInt(m[2]) };
  return { year: 9999, text: 999 };
}

(async () => {
  const wb = await db.prepare("SELECT id FROM word_books WHERE name = '考研英语阅读真题词汇'").get();
  const lists = await db.prepare('SELECT id, name, created_at FROM word_lists WHERE word_book_id = ?').all(wb.id);
  
  lists.sort((a, b) => {
    const pa = parseListName(a.name);
    const pb = parseListName(b.name);
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.text - pb.text;
  });

  console.log('正确排序后:');
  for (let i = 0; i < lists.length; i++) {
    const l = lists[i];
    const sortOrder = i + 1;
    console.log(`  ${sortOrder}. ${l.name}`);
  }

  // 检查是否有 sort_order 字段
  try {
    await db.prepare('SELECT sort_order FROM word_lists LIMIT 1').get();
  } catch (e) {
    console.log('\n添加 sort_order 字段...');
    await db.prepare('ALTER TABLE word_lists ADD COLUMN sort_order INTEGER').run();
  }

  console.log('\n更新排序...');
  for (let i = 0; i < lists.length; i++) {
    const sortOrder = i + 1;
    await db.prepare('UPDATE word_lists SET sort_order = ? WHERE id = ?').run(sortOrder, lists[i].id);
  }

  console.log('✅ 排序完成！');
  process.exit(0);
})();
