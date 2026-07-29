const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const db = require('../src/db');

const PDF_PATH = 'C:\\Users\\32314\\Desktop\\考研英语阅读理解真题词汇(05-09)(1).pdf';
const TEACHER_ID = 1;
const WORD_BOOK_NAME = '考研英语阅读真题词汇';
const WORD_BOOK_DESC = '2005-2009年考研英语阅读理解真题词汇';

function isChinese(char) {
  return /[\u4e00-\u9fa5]/.test(char);
}

function isEnglishWord(text) {
  return /^[a-zA-Z][a-zA-Z\-'\s]*$/.test(text.trim());
}

function hasPhonetic(text) {
  return /\[.*\]/.test(text);
}

function parsePDFText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const groups = [];
  let currentGroup = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 检测标题：
    // 格式1: "2005" + "年" + "阅" + "读" + "理" + "解Text" + "1" (分散多行)
    // 格式2: "2005年阅读理解Text" + "1" (标题一行, 数字下一行)
    const titleFullMatch = lines.slice(i, i + 10).join('').match(/(\d{4})年阅读理解Text\s*(\d+)/);
    if (titleFullMatch) {
      const year = titleFullMatch[1];
      const textNum = titleFullMatch[2];
      const title = `${year}年阅读理解Text ${textNum}`;
      if (currentGroup) groups.push(currentGroup);
      currentGroup = { title, words: [] };
      // 跳过标题行，直到遇到完整标题
      let skipCount = 0;
      let joined = '';
      while (i + skipCount < lines.length && skipCount < 12) {
        joined += lines[i + skipCount];
        skipCount++;
        if (/\d{4}年阅读理解Text\s*\d+/.test(joined)) break;
      }
      // 再跳过"段落单词词义"表头
      if (i + skipCount < lines.length && /段落.*单词.*词义/.test(lines[i + skipCount])) {
        skipCount++;
      }
      i += skipCount;
      continue;
    }

    // 检测单词行：英文单词+[音标] 或者 英文单词单独一行
    // 格式1: "fat[fæt]a."
    // 格式2: "slack" (下一行是音标+释义)
    // 格式3: "reputation[,repju'teiʃn]n.名声；声望" (同一行有完整信息)
    const wordWithPhonetic = line.match(/^([a-zA-Z][a-zA-Z\-']*)\s*\[([^\]]+)\]\s*(.*)$/);
    const pureWord = isEnglishWord(line) && !/选项|段落|单词|词义/.test(line);

    if (wordWithPhonetic) {
      const word = wordWithPhonetic[1];
      const phonetic = wordWithPhonetic[2];
      let rest = wordWithPhonetic[3];
      
      // 收集后续行直到遇到下一个单词或段落号
      let meaningLines = [rest];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        // 如果遇到下一个单词（有音标）或者纯英文单词行，或者段落号，或者标题，停止
        if (/^[a-zA-Z][a-zA-Z\-']*\s*\[/.test(nextLine)) break;
        if (/^\d{4}$/.test(nextLine) && j + 3 < lines.length && /年/.test(lines[j + 1])) break;
        if (/选项/.test(nextLine)) break;
        // 纯英文单词（下一行有音标的情况）
        if (isEnglishWord(nextLine) && j + 1 < lines.length && hasPhonetic(lines[j + 1])) break;
        // 段落号（单独数字）
        if (/^\d+$/.test(nextLine) && nextLine.length <= 2) {
          // 检查下一个是否是单词
          if (j + 1 < lines.length && (/^[a-zA-Z][a-zA-Z\-']*\s*\[/.test(lines[j + 1]) || isEnglishWord(lines[j + 1]))) {
            break;
          }
        }
        meaningLines.push(nextLine);
        j++;
      }
      
      const meaning = meaningLines.join('').replace(/\s+/g, ' ').trim();
      if (currentGroup && word && meaning) {
        currentGroup.words.push({ word, meaning: `[${phonetic}] ${meaning}` });
      }
      i = j;
      continue;
    }

    // 处理纯单词行（下一行有音标）
    if (pureWord && i + 1 < lines.length && hasPhonetic(lines[i + 1])) {
      const word = line;
      const nextLine = lines[i + 1];
      const phoneticMatch = nextLine.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (phoneticMatch) {
        const phonetic = phoneticMatch[1];
        let rest = phoneticMatch[2];
        
        let meaningLines = [rest];
        let j = i + 2;
        while (j < lines.length) {
          const nextLine2 = lines[j];
          if (/^[a-zA-Z][a-zA-Z\-']*\s*\[/.test(nextLine2)) break;
          if (/^\d{4}$/.test(nextLine2) && j + 3 < lines.length && /年/.test(lines[j + 1])) break;
          if (/选项/.test(nextLine2)) break;
          if (isEnglishWord(nextLine2) && j + 1 < lines.length && hasPhonetic(lines[j + 1])) break;
          if (/^\d+$/.test(nextLine2) && nextLine2.length <= 2) {
            if (j + 1 < lines.length && (/^[a-zA-Z][a-zA-Z\-']*\s*\[/.test(lines[j + 1]) || isEnglishWord(lines[j + 1]))) {
              break;
            }
          }
          meaningLines.push(nextLine2);
          j++;
        }
        
        const meaning = meaningLines.join('').replace(/\s+/g, ' ').trim();
        if (currentGroup && word && meaning) {
          currentGroup.words.push({ word, meaning: `[${phonetic}] ${meaning}` });
        }
        i = j;
        continue;
      }
    }

    i++;
  }

  if (currentGroup) groups.push(currentGroup);
  return groups;
}

async function importToDatabase(groups) {
  console.log(`\n共解析到 ${groups.length} 个单词列表\n`);
  
  // 创建或获取单词书
  let wordBook = await db.prepare(
    'SELECT * FROM word_books WHERE name = ? AND teacher_id = ?'
  ).get(WORD_BOOK_NAME, TEACHER_ID);
  
  if (!wordBook) {
    const result = await db.prepare(
      'INSERT INTO word_books (name, description, teacher_id, is_public) VALUES (?, ?, ?, ?)'
    ).run(WORD_BOOK_NAME, WORD_BOOK_DESC, TEACHER_ID, 1);
    wordBook = { id: result.lastInsertRowid };
    console.log(`✅ 创建单词书: ${WORD_BOOK_NAME} (id=${wordBook.id})`);
  } else {
    console.log(`📖 已存在单词书: ${WORD_BOOK_NAME} (id=${wordBook.id})`);
  }

  let totalWords = 0;
  let skippedLists = 0;

  for (const group of groups) {
    // 检查是否已存在同名单词列表
    const existing = await db.prepare(
      'SELECT id FROM word_lists WHERE name = ? AND teacher_id = ?'
    ).get(group.title, TEACHER_ID);
    
    if (existing) {
      console.log(`⏭️  已存在，跳过: ${group.title}`);
      skippedLists++;
      continue;
    }

    // 创建单词列表
    const listResult = await db.prepare(
      'INSERT INTO word_lists (name, description, word_book_id, teacher_id) VALUES (?, ?, ?, ?)'
    ).run(group.title, `考研英语阅读理解真题词汇`, wordBook.id, TEACHER_ID);
    const listId = listResult.lastInsertRowid;

    // 插入单词
    const insertWord = db.prepare(
      'INSERT INTO words (word_list_id, word, meaning, sort_order) VALUES (?, ?, ?, ?)'
    );
    for (let idx = 0; idx < group.words.length; idx++) {
      const w = group.words[idx];
      await insertWord.run(listId, w.word, w.meaning, idx + 1);
    }

    console.log(`✅ ${group.title}: ${group.words.length} 个单词`);
    totalWords += group.words.length;
  }

  console.log(`\n========================================`);
  console.log(`导入完成！`);
  console.log(`  新增列表: ${groups.length - skippedLists} 个`);
  console.log(`  跳过列表: ${skippedLists} 个`);
  console.log(`  新增单词: ${totalWords} 个`);
  console.log(`========================================`);
}

async function main() {
  console.log('正在读取 PDF 文件...');
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const data = await pdf(dataBuffer);
  
  console.log(`PDF 共 ${data.numpages} 页，开始解析...`);
  
  const groups = parsePDFText(data.text);
  
  // 打印解析结果预览
  groups.forEach(g => {
    console.log(`\n📋 ${g.title} (${g.words.length} 词)`);
    g.words.slice(0, 3).forEach(w => {
      console.log(`   ${w.word}: ${w.meaning.substring(0, 60)}...`);
    });
    if (g.words.length > 3) console.log(`   ... 还有 ${g.words.length - 3} 个`);
  });

  await importToDatabase(groups);
}

main().catch(console.error);
