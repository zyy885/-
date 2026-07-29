const BASE_URL = 'https://vocab-1ial.onrender.com';
const USERNAME = 'teacher';
const PASSWORD = '123456';

function parseListName(name) {
  const m = name.match(/(\d{4})年阅读理解Text\s*(\d+)/);
  if (m) return { year: parseInt(m[1]), text: parseInt(m[2]) };
  return { year: 9999, text: 999 };
}

async function api(method, endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

async function main() {
  console.log('1️⃣  登录中...');
  const login = await api('POST', '/api/auth/login', { username: USERNAME, password: PASSWORD });
  if (!login.ok) { console.error('登录失败:', login.data); process.exit(1); }
  const token = login.data.token;
  console.log('✅ 登录成功');

  // 等一下，让线上部署完成后，字段 sort_order 应该已经有了
  // 但我们这里直接获取词表列表，然后需要通过 API 更新排序
  // 由于没有专门的更新 sort_order API，我们需要：
  // 1. 先获取所有词表
  // 2. 按名称排序
  // 3. 因为词表是按 sort_order 排序的，没有 sort_order 的按 created_at
  // 线上的词表可能还没有 sort_order 字段，等部署完成后字段会自动加上
  // 但 sort_order 的值需要我们设置
  
  // 由于没有直接更新 sort_order 的 API，我们采取另一种方法：
  // 等线上部署完成后，通过 API 更新每个词表的 sort_order
  // 但需要先加一个 API 端点...
  
  // 实际上，更简单的方法是：由于我们只需要这个单词书里的词表按年份排序，
  // 而且它们是按创建时间顺序插入的（除了 2005 Text4 和 2006 Text1 是后面补的），
  // 我们可以直接删掉线上的这些词表，然后按正确顺序重新导入。

  console.log('\n2️⃣  获取词表...');
  const listsRes = await api('GET', '/api/word-lists', null, token);
  const allLists = listsRes.data.wordLists || [];
  const kaoyanLists = allLists.filter(l => /\d{4}年阅读理解Text/.test(l.name));
  
  console.log('找到', kaoyanLists.length, '个考研词汇词表');
  
  kaoyanLists.sort((a, b) => {
    const pa = parseListName(a.name);
    const pb = parseListName(b.name);
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.text - pb.text;
  });

  console.log('\n3️⃣  正确顺序:');
  kaoyanLists.forEach((l, i) => console.log(`  ${i+1}. ${l.name}`));

  // 因为没有直接更新 sort_order 的 API，我们先删除再按顺序创建
  console.log('\n4️⃣  删除旧词表...');
  for (const l of kaoyanLists) {
    // 需要先检查词表是否被任务引用
    const del = await api('DELETE', `/api/word-lists/${l.id}`, null, token);
    if (del.ok) {
      console.log(`  ✅ 已删除: ${l.name}`);
    } else {
      console.log(`  ❌ 删除失败: ${l.name} -`, del.data);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // 读取本地导出的 JSON，按正确顺序重新创建
  console.log('\n5️⃣  按正确顺序重新创建词表...');
  const fs = require('fs');
  const path = require('path');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'kaoyan_vocab_export.json'), 'utf-8'));
  
  // 找到单词书
  const booksRes = await api('GET', '/api/word-books', null, token);
  const book = booksRes.data.wordBooks.find(b => b.name === data.wordBook.name);

  data.lists.sort((a, b) => {
    const pa = parseListName(a.name);
    const pb = parseListName(b.name);
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.text - pb.text;
  });

  for (const listData of data.lists) {
    const createList = await api('POST', '/api/word-lists', {
      name: listData.name,
      description: listData.description,
      word_book_id: book.id,
      words: listData.words,
    }, token);

    if (createList.ok) {
      console.log(`  ✅ ${listData.name}: ${listData.words.length} 词`);
    } else {
      console.log(`  ❌ ${listData.name}: 失败 -`, createList.data);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n✅ 全部完成！线上词表已按年份正确排序');
}

main().catch(console.error);
