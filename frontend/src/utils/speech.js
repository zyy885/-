let cachedVoices = [];
const audioCache = {};           // cacheKey -> audioUrl
const audioElCache = {};         // audioUrl -> Audio element (preloaded)
const audioFailedCache = {};
const dictCache = {};
const translationCache = {};
let currentAudio = null;

const TTS_ENGINES = {
  YOUDAO: 'youdao',
  BAIDU_STANDARD: 'baidu_standard',
  XFYUN: 'xfyun',
  DICTIONARY: 'dictionary',
  BROWSER: 'browser',
  GOOGLE: 'google'
};

const ACCENTS = {
  US: 'en-US',
  GB: 'en-GB'
};

const YOUDAO_VOICES = [
  { id: 'female', name: 'Lily · 美式女声', tag: '美式' },
  { id: 'male', name: 'Daniel · 美式男声', tag: '美式' },
  { id: 'female_GB', name: 'Ava · 英式女声', tag: '英式' },
  { id: 'male_GB', name: 'Oliver · 英式男声', tag: '英式' }
];

const BAIDU_STANDARD_VOICES = [
  { id: 0, name: '度小美 · 新国标女声', tag: '国标' },
  { id: 1, name: '度小宇 · 新国标男声', tag: '国标' }
];

const XFYUN_VOICES = [
  { id: 0, name: '讯飞 · 美式女声', tag: '美式' },
  { id: 1, name: '讯飞 · 美式男声', tag: '美式' },
  { id: 2, name: '讯飞 · 英式女声', tag: '英式' },
  { id: 3, name: '讯飞 · 英式男声', tag: '英式' }
];

function loadVoices() {
  if (typeof speechSynthesis !== 'undefined') {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length === 0) {
      speechSynthesis.onvoiceschanged = () => {
        cachedVoices = speechSynthesis.getVoices();
      };
    }
  }
}

loadVoices();
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = loadVoices;
}

function stopAll() {
  try {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  } catch (e) {}
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }
}

function getEngine() {
  return localStorage.getItem('vocab_tts_engine') || TTS_ENGINES.YOUDAO;
}

function getAccent() {
  return localStorage.getItem('vocab_tts_accent') || ACCENTS.US;
}

function getRate() {
  return parseFloat(localStorage.getItem('vocab_tts_rate')) || 0.9;
}

function getVoiceId() {
  return localStorage.getItem('vocab_tts_voice') || 'default';
}

function buildYoudaoTtsUrl(text, accent, voiceId) {
  let type;
  if (voiceId === 'female_GB') type = 1;
  else if (voiceId === 'male_GB') type = 1;
  else type = accent === ACCENTS.GB ? 1 : 2;
  
  let voice;
  if (voiceId === 'female_GB' || voiceId === 'male_GB') {
    voice = voiceId;
  } else {
    voice = voiceId || (accent === ACCENTS.GB ? 'male' : 'female');
  }
  
  return `https://tts.youdao.com/tts?lang=en&img=false&audio=true&text=${encodeURIComponent(text)}&type=${type}&voice=${voice}`;
}

function buildYoudaoDictUrl(text, accent) {
  const type = accent === ACCENTS.GB ? 1 : 2;
  return `https://dict.youdao.com/dictvoice?type=${type}&audio=${encodeURIComponent(text)}`;
}

function buildBaiduStandardTtsUrl(text, accent, voiceId) {
  const per = voiceId && voiceId !== 'default' ? parseInt(voiceId) : 0;
  const lan = accent === ACCENTS.GB ? 'en-GB' : 'en-US';
  return `https://tts.baidu.com/text2audio?lan=${lan}&per=${per}&text=${encodeURIComponent(text)}&spd=${Math.round((getRate() - 0.5) * 10)}&pit=5&vol=9&form=mp3`;
}

function buildXfyunTtsUrl(text, accent, voiceId) {
  const type = voiceId && voiceId !== 'default' ? parseInt(voiceId) : (accent === ACCENTS.GB ? 2 : 0);
  return `https://tts-api.xfyun.cn/v2/tts?text=${encodeURIComponent(text)}&voice_type=${type}&speed=${getRate()}`;
}

function buildGoogleTtsUrl(text, accent) {
  const tl = accent === ACCENTS.GB ? 'en-GB' : 'en';
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encodeURIComponent(text)}`;
}

async function fetchDictionaryData(word) {
  const key = word.toLowerCase();
  if (dictCache[key]) return dictCache[key];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      dictCache[key] = { audio: null, example: null };
      return dictCache[key];
    }
    const data = await res.json();
    let audioUrl = null;
    let exampleText = null;
    if (Array.isArray(data) && data.length > 0) {
      const phonetics = data[0].phonetics || [];
      for (const p of phonetics) {
        if (p.audio && p.audio.length > 0) {
          audioUrl = p.audio;
          break;
        }
      }
      const meanings = data[0].meanings || [];
      for (const m of meanings) {
        const defs = m.definitions || [];
        for (const d of defs) {
          if (d.example && d.example.trim()) {
            exampleText = d.example;
            break;
          }
        }
        if (exampleText) break;
      }
    }
    dictCache[key] = { audio: audioUrl, example: exampleText };
    return dictCache[key];
  } catch (e) {
    dictCache[key] = { audio: null, example: null };
    return dictCache[key];
  }
}

async function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    stopAll();
    // 优先使用已预加载的 Audio 元素（已完成缓冲）
    let audio = audioElCache[url];
    if (!audio || audio.readyState < 2) {
      audio = new Audio(url);
      audioElCache[url] = audio;
    }
    currentAudio = audio;
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        currentAudio = null;
      }
    };

    audio.onended = () => { cleanup(); resolve(); };
    audio.onerror = () => { cleanup(); reject(new Error('Audio load/play failed')); };

    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('Audio load timeout'));
      }
    }, 8000);

    try {
      audio.currentTime = 0;
    } catch (e) {}

    const p = audio.play();
    if (p && p.then) {
      p.then(() => { clearTimeout(timeout); }).catch((e) => {
        clearTimeout(timeout); cleanup(); reject(e);
      });
    }
  });
}

/**
 * 预加载音频（不播放，仅缓冲到内存），用于点击时零延迟播放
 */
export function preloadAudioUrl(url) {
  if (!url || audioElCache[url] || audioFailedCache[url]) return;
  try {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audioElCache[url] = audio;
    // 静默加载，不播放
    audio.load();
  } catch (e) {}
}

/**
 * 预加载指定单词的所有候选音频源（在单词列表渲染时批量调用）
 */
export function preloadWordAudio(word) {
  if (!word) return;
  const w = word.trim().toLowerCase();
  if (!w) return;
  const accent = getAccent();
  const engine = getEngine();
  const voiceId = getVoiceId();

  // 按引擎生成候选URL并静默预加载
  const candidates = [];
  try {
    if (engine === TTS_ENGINES.YOUDAO) {
      candidates.push(buildYoudaoTtsUrl(word, accent, voiceId));
      candidates.push(buildYoudaoDictUrl(word, accent));
    } else if (engine === TTS_ENGINES.BAIDU_STANDARD) {
      candidates.push(buildBaiduStandardTtsUrl(word, accent, voiceId));
      candidates.push(buildYoudaoDictUrl(word, accent));
    } else if (engine === TTS_ENGINES.GOOGLE) {
      candidates.push(buildGoogleTtsUrl(word, accent));
      candidates.push(buildYoudaoDictUrl(word, accent));
    } else if (engine === TTS_ENGINES.DICTIONARY) {
      candidates.push(buildYoudaoDictUrl(word, accent));
      candidates.push(buildBaiduStandardTtsUrl(word, accent, voiceId));
    } else if (engine === TTS_ENGINES.XFYUN) {
      candidates.push(buildYoudaoDictUrl(word, accent));
    } else {
      candidates.push(buildYoudaoDictUrl(word, accent));
    }
  } catch (e) {}

  // 异步、非阻塞预加载
  setTimeout(() => {
    candidates.forEach(url => preloadAudioUrl(url));
  }, 0);
}

function speakWithTTS(text, lang, rate) {
  lang = lang || 'en-US';
  rate = rate || getRate();
  try {
    if (typeof speechSynthesis === 'undefined') return false;
    stopAll();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = 1;
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    if (savedVoice !== 'default') {
      const v = cachedVoices.find(v => v.name === savedVoice);
      if (v) u.voice = v;
    } else {
      const preferred = cachedVoices.find(v =>
        (getAccent() === ACCENTS.GB ? v.lang.startsWith('en-GB') : v.lang.startsWith('en-US'))
      );
      if (preferred) u.voice = preferred;
    }
    speechSynthesis.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

async function tryPlaySources(sources, cacheKey) {
  for (const source of sources) {
    if (!audioFailedCache[source.url]) {
      try {
        await playAudioUrl(source.url);
        if (cacheKey) audioCache[cacheKey] = source.url;
        return true;
      } catch (e) {
        audioFailedCache[source.url] = true;
      }
    }
  }
  return false;
}

export async function speak(text, lang) {
  const accent = getAccent();
  const engine = getEngine();
  const rate = getRate();
  const voiceId = getVoiceId();
  lang = lang || accent;

  const word = text.trim().toLowerCase();
  if (!word) return;

  const cacheKey = word + '|' + accent + '|' + engine + '|' + voiceId;
  const cachedUrl = audioCache[cacheKey];

  // ========== 快速路径 1：已缓存且已预加载的音频 -> 直接秒播 ==========
  if (cachedUrl && !audioFailedCache[cachedUrl]) {
    const preloadedEl = audioElCache[cachedUrl];
    if (preloadedEl && preloadedEl.readyState >= 2) {
      // 完全就绪：直接播放
      stopAll();
      try {
        await playAudioUrl(cachedUrl);
        return;
      } catch (e) {
        audioFailedCache[cachedUrl] = true;
        delete audioCache[cacheKey];
        // 失败继续往下走
      }
    } else if (cachedUrl) {
      // 有缓存URL但未完成预加载：立即尝试播放，同时后台继续缓冲
      stopAll();
      try {
        playAudioUrl(cachedUrl); // 不 await，不阻塞回退
        return;
      } catch (e) {}
    }
  }

  // ========== 快速路径 2：无缓存 -> 先用浏览器内置语音**立即响应**（零延迟）==========
  // 先停掉之前的，立即响应用户点击
  stopAll();
  const instantPlayed = speakWithTTS(text, lang, rate);

  // ========== 后台异步：加载用户所选引擎的音频并缓存（为下一次点击服务）==========
  // 注意：只有非浏览器引擎才需要后台缓存在线音频
  if (engine === TTS_ENGINES.BROWSER) {
    return; // 浏览器模式已直接用 TTS 响应
  }

  // 在后台异步构建源并预加载，不阻塞当前响应
  (async () => {
    try {
      const sources = [];

      if (engine === TTS_ENGINES.YOUDAO) {
        sources.push({ url: buildYoudaoTtsUrl(text, accent, voiceId) });
        sources.push({ url: buildYoudaoDictUrl(text, accent) });
        sources.push({ url: buildBaiduStandardTtsUrl(text, accent, voiceId) });
      } else if (engine === TTS_ENGINES.BAIDU_STANDARD) {
        sources.push({ url: buildBaiduStandardTtsUrl(text, accent, voiceId) });
        sources.push({ url: buildYoudaoDictUrl(text, accent) });
        sources.push({ url: buildGoogleTtsUrl(text, accent) });
      } else if (engine === TTS_ENGINES.XFYUN) {
        sources.push({ url: buildXfyunTtsUrl(text, accent, voiceId) });
        sources.push({ url: buildYoudaoDictUrl(text, accent) });
        sources.push({ url: buildBaiduStandardTtsUrl(text, accent, voiceId) });
      } else if (engine === TTS_ENGINES.GOOGLE) {
        sources.push({ url: buildGoogleTtsUrl(text, accent) });
        sources.push({ url: buildYoudaoDictUrl(text, accent) });
      } else if (engine === TTS_ENGINES.DICTIONARY) {
        const dictData = await fetchDictionaryData(word);
        if (dictData.audio) {
          sources.push({ url: dictData.audio });
        }
        sources.push({ url: buildYoudaoDictUrl(text, accent) });
        sources.push({ url: buildBaiduStandardTtsUrl(text, accent, voiceId) });
      }

      // 静默尝试播放第一个可用源，成功则缓存
      for (const source of sources) {
        if (!audioFailedCache[source.url]) {
          try {
            // 先预加载（不播放）
            preloadAudioUrl(source.url);
            // 如果浏览器TTS失败（instantPlayed=false），则等待在线音频加载后真正播放一次
            if (!instantPlayed) {
              await playAudioUrl(source.url);
              audioCache[cacheKey] = source.url;
              return;
            }
            // 只缓存URL，不重复播放打断用户
            audioCache[cacheKey] = source.url;
            return;
          } catch (e) {
            audioFailedCache[source.url] = true;
          }
        }
      }
    } catch (e) {}
  })();
}

export async function speakSentence(text, lang) {
  stopAll();
  const accent = getAccent();
  const engine = getEngine();
  const rate = Math.min(getRate(), 0.85);
  const voiceId = getVoiceId();

  if (engine === TTS_ENGINES.BROWSER) {
    speakWithTTS(text, lang, rate);
    return;
  }

  try {
    const cacheKey = 'sentence|' + text.trim().toLowerCase() + '|' + accent + '|' + engine + '|' + voiceId;
    const cachedUrl = audioCache[cacheKey];
    if (cachedUrl && !audioFailedCache[cachedUrl]) {
      try {
        await playAudioUrl(cachedUrl);
        return;
      } catch (e) {
        audioFailedCache[cachedUrl] = true;
        delete audioCache[cacheKey];
      }
    }

    const sources = [];
    if (engine === TTS_ENGINES.YOUDAO) {
      sources.push({ url: buildYoudaoDictUrl(text, accent) });
      sources.push({ url: buildBaiduStandardTtsUrl(text, accent, voiceId) });
    } else if (engine === TTS_ENGINES.BAIDU_STANDARD) {
      sources.push({ url: buildBaiduStandardTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildYoudaoDictUrl(text, accent) });
    } else if (engine === TTS_ENGINES.XFYUN) {
      sources.push({ url: buildXfyunTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildYoudaoDictUrl(text, accent) });
    } else if (engine === TTS_ENGINES.DICTIONARY) {
      sources.push({ url: buildYoudaoDictUrl(text, accent) });
      sources.push({ url: buildBaiduStandardTtsUrl(text, accent, voiceId) });
    } else {
      sources.push({ url: buildYoudaoDictUrl(text, accent) });
      sources.push({ url: buildGoogleTtsUrl(text, accent) });
    }

    const success = await tryPlaySources(sources, cacheKey);
    if (success) return;

    speakWithTTS(text, lang, rate);
  } catch (e) {
    speakWithTTS(text, lang, rate);
  }
}

export async function getExampleFromDictionary(word) {
  const data = await fetchDictionaryData(word);
  return data.example;
}

export function getVoices() {
  return cachedVoices;
}

export function getEngineVoices(engine) {
  if (engine === TTS_ENGINES.YOUDAO) return YOUDAO_VOICES;
  if (engine === TTS_ENGINES.BAIDU_STANDARD) return BAIDU_STANDARD_VOICES;
  if (engine === TTS_ENGINES.XFYUN) return XFYUN_VOICES;
  return [];
}

export function getEngines() {
  return [
    { id: TTS_ENGINES.YOUDAO, name: '有道词典发音', tag: '最适合学习' },
    { id: TTS_ENGINES.BAIDU_STANDARD, name: '百度 · 新国标英语', tag: '国家标准' },
    { id: TTS_ENGINES.XFYUN, name: '讯飞语音', tag: '清晰自然' },
    { id: TTS_ENGINES.DICTIONARY, name: 'DictionaryAPI 真人发音', tag: '真人录音' },
    { id: TTS_ENGINES.BROWSER, name: '浏览器内置语音', tag: '原生离线' },
    { id: TTS_ENGINES.GOOGLE, name: 'Google 神经发音', tag: '国际主流' }
  ];
}

export function getAccents() {
  return [
    { id: ACCENTS.US, name: '美式英语 (en-US)' },
    { id: ACCENTS.GB, name: '英式英语 (en-GB)' }
  ];
}

export async function translateText(text, from, to) {
  const key = text.trim().toLowerCase() + '|' + from + '|' + to;
  if (translationCache[key]) return translationCache[key];
  try {
    const res = await fetch(
      'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + from + '|' + to
    );
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data?.responseData?.translatedText || null;
    if (translated) {
      translationCache[key] = translated;
    }
    return translated;
  } catch (e) {
    return null;
  }
}

export { stopAll, TTS_ENGINES, ACCENTS };
