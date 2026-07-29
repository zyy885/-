const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://vocab-1ial.onrender.com';
const USERNAME = 'teacher';
const PASSWORD = '123456';

const dataPath = path.join(__dirname, 'kaoyan_vocab_export.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

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
  console.log('🚀 开始同步到线上:', BASE_URL);
  console.log('');

  // 1. 登录
  console.log('1️⃣  登录中...');
  const login = await api('POST', '/api/auth/login', { username: USERNAME, password: PASSWORD });
  if (!login.ok) {
    console.error('❌ 登录失败:', login.data);
    process.exit(1);
  }
  const token = login.data.token;
  console.log('✅ 登录成功');
  console.log('');

  // 2. 获取现有单词书
  console.log('2️⃣  检查现有单词书...');
  const books = await api('GET', '/api/word-books', null, token);
  const existingBook = books.data.wordBooks?.find(b => b.name === data.wordBook.name);
  let bookId;

  if (existingBook) {
    bookId = existingBook.id;
    console.log(`📖 已存在单词书: ${existingBook.name} (id=${bookId})`);
  } else {
    console.log(`📖 创建单词书: ${data.wordBook.name}`);
    const createBook = await api('POST', '/api/word-books', {
      name: data.wordBook.name,
      description: data.wordBook.description,
      is_public: true,
    }, token);
    bookId = createBook.data.id;
    console.log(`✅ 单词书创建成功 (id=${bookId})`);
  }
  console.log('');

  // 3. 获取现有词表
  console.log('3️⃣  获取现有词表...');
  const listsRes = await api('GET', '/api/word-lists', null, token);
  const existingLists = {};
  (listsRes.data.wordLists || []).forEach(l => { existingLists[l.name] = l; });

  // 4. 创建词表和单词
  console.log('4️⃣  创建词表和单词...');
  let created = 0, skipped = 0, totalWords = 0;

  for (const listData of data.lists) {
    if (existingLists[listData.name]) {
      console.log(`  ⏭️  已存在，跳过: ${listData.name} (${listData.words.length} 词)`);
      skipped++;
      continue;
    }

    const createList = await api('POST', '/api/word-lists', {
      name: listData.name,
      description: listData.description,
      word_book_id: bookId,
      words: listData.words,
    }, token);

    if (createList.ok) {
      console.log(`  ✅ ${listData.name}: ${listData.words.length} 词`);
      created++;
      totalWords += listData.words.length;
    } else {
      console.log(`  ❌ ${listData.name}: 失败 -`, createList.data);
    }

    // 限速，避免请求过快
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('');
  console.log('========================================');
  console.log('✅ 同步完成！');
  console.log(`  单词书: ${data.wordBook.name}`);
  console.log(`  新建词表: ${created} 个`);
  console.log(`  跳过词表: ${skipped} 个`);
  console.log(`  新增单词: ${totalWords} 个`);
  console.log('========================================');
}

main().catch(console.error);
