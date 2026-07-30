const { prepare, isPG } = require('./src/db');

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
    /^第([零一二三四五六七八九十百千万两]+)([页节章单元天])(.*)$/,
    /^第([零一二三四五六七八九十百千万两]+)$/,
    /^([零一二三四五六七八九十百千万两]+)([页节章单元天])(.*)$/,
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) {
      if (m.length === 4) {
        const n = chineseToNum(m[1]);
        if (n > 0) {
          if (name.startsWith('第')) {
            return '第' + n + m[2] + (m[3] || '');
          } else {
            return n + m[2] + (m[3] || '');
          }
        }
      } else if (m.length === 3) {
        const n = chineseToNum(m[1]);
        if (n > 0) {
          return '第' + n;
        }
      }
    }
  }
  return name;
}

async function main() {
  console.log('数据库类型:', isPG ? 'PostgreSQL' : 'SQLite');
  
  // 处理词表
  const listsStmt = prepare("SELECT id, word_book_id, name FROM word_lists");
  const updateListStmt = prepare("UPDATE word_lists SET name = ? WHERE id = ?");
  
  const lists = await listsStmt.all();
  console.log(`\n共 ${lists.length} 个词表`);
  
  let updatedLists = 0;
  for (const l of lists) {
    const newName = convertName(l.name);
    if (newName !== l.name) {
      console.log(`  词表: "${l.name}" → "${newName}"`);
      await updateListStmt.run(newName, l.id);
      updatedLists++;
    }
  }
  
  // 处理句子列表
  const sentListsStmt = prepare("SELECT id, name FROM sentence_lists");
  const updateSentStmt = prepare("UPDATE sentence_lists SET name = ? WHERE id = ?");
  
  const sentLists = await sentListsStmt.all();
  console.log(`\n共 ${sentLists.length} 个句子列表`);
  
  let updatedSent = 0;
  for (const l of sentLists) {
    const newName = convertName(l.name);
    if (newName !== l.name) {
      console.log(`  句表: "${l.name}" → "${newName}"`);
      await updateSentStmt.run(newName, l.id);
      updatedSent++;
    }
  }
  
  console.log(`\n========================================`);
  console.log(`完成！`);
  console.log(`  更新词表: ${updatedLists} 个`);
  console.log(`  更新句表: ${updatedSent} 个`);
  console.log(`========================================`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
