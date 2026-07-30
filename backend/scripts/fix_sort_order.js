const { prepare, isPG } = require('../src/db');

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

function extractSeqNum(name) {
  if (!name) return Infinity;
  const patterns = [
    /^第([零一二三四五六七八九十百千万两\d]+)[页节章单元天]/,
    /^第([零一二三四五六七八九十百千万两\d]+)$/,
    /^([零一二三四五六七八九十百千万两\d]+)[页节章单元天]/,
    /List\s*(\d+)/i,
    /Unit\s*(\d+)/i,
    /Lesson\s*(\d+)/i,
    /(\d+)/,
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) {
      const n = chineseToNum(m[1]);
      if (n > 0) return n;
    }
  }
  return Infinity;
}

async function main() {
  console.log('数据库类型:', isPG ? 'PostgreSQL' : 'SQLite');
  
  // 获取所有词表
  const listsStmt = prepare('SELECT id, name, word_book_id, sort_order FROM word_lists ORDER BY id');
  const updateStmt = prepare('UPDATE word_lists SET sort_order = ? WHERE id = ?');
  
  const lists = await listsStmt.all();
  console.log(`共 ${lists.length} 个词表`);
  
  // 按 word_book_id 分组
  const groups = {};
  for (const l of lists) {
    const key = l.word_book_id || 'null';
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  }
  
  let updated = 0;
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    // 按序号排序
    const sorted = [...group].sort((a, b) => {
      const na = extractSeqNum(a.name);
      const nb = extractSeqNum(b.name);
      if (na !== nb) return na - nb;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    
    console.log(`\n分组 ${key === 'null' ? '(未分类)' : key} (${sorted.length} 个):`);
    for (let i = 0; i < sorted.length; i++) {
      const l = sorted[i];
      const newOrder = i + 1;
      if (l.sort_order !== newOrder) {
        console.log(`  ${l.id}: ${l.name}  sort_order: ${l.sort_order} → ${newOrder}`);
        await updateStmt.run(newOrder, l.id);
        updated++;
      }
    }
  }
  
  console.log(`\n========================================`);
  console.log(`完成！共更新 ${updated} 个词表的 sort_order`);
  console.log(`========================================`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
