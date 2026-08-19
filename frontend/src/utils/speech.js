let cachedVoices = [];
const audioCache = {};
const audioFailedCache = {};
const dictCache = {};
const translationCache = {};
let currentAudio = null;

const TTS_ENGINES = {
  BAIDU: 'baidu',
  YOUDAO: 'youdao',
  GOOGLE: 'google',
  DICTIONARY: 'dictionary',
  BROWSER: 'browser'
};

const ACCENTS = {
  US: 'en-US',
  GB: 'en-GB'
};

const BAIDU_VOICES = [
  { id: 0, name: '度小美 · 女声 (推荐)', tag: '女声' },
  { id: 1, name: '度小宇 · 男声', tag: '男声' },
  { id: 3, name: '度逍遥 · 磁性男声', tag: '磁性' },
  { id: 4, name: '度小娇 · 情感女声', tag: '情感' }
];

const YOUDAO_VOICES = [
  { id: 'female', name: '女声 (Lily)', tag: '女声' },
  { id: 'male', name: '男声 (Daniel)', tag: '男声' }
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
  return localStorage.getItem('vocab_tts_engine') || TTS_ENGINES.BROWSER;
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

function buildBaiduTtsUrl(text, accent, voiceId) {
  const per = voiceId && voiceId !== 'default' ? parseInt(voiceId) : 0;
  const lan = accent === ACCENTS.GB ? 'en-GB' : 'en-US';
  return `https://tts.baidu.com/text2audio?lan=${lan}&per=${per}&text=${encodeURIComponent(text)}&spd=${Math.round((getRate() - 0.5) * 10)}&pit=5&vol=9&form=mp3`;
}

function buildYoudaoTtsUrl(text, accent, voiceId) {
  const type = accent === ACCENTS.GB ? 1 : 2;
  return `https://tts.youdao.com/tts?lang=en&img=false&audio=true&text=${encodeURIComponent(text)}&type=${type}`;
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
    const audio = new Audio(url);
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

    const p = audio.play();
    if (p && p.then) {
      p.then(() => { clearTimeout(timeout); }).catch((e) => {
        clearTimeout(timeout); cleanup(); reject(e);
      });
    }
  });
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
  stopAll();
  const accent = getAccent();
  const engine = getEngine();
  const rate = getRate();
  const voiceId = getVoiceId();
  lang = lang || accent;

  if (engine === TTS_ENGINES.BROWSER) {
    speakWithTTS(text, lang, rate);
    return;
  }

  try {
    const word = text.trim().toLowerCase();
    if (!word) return;

    const cacheKey = word + '|' + accent + '|' + engine + '|' + voiceId;
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

    if (engine === TTS_ENGINES.BAIDU) {
      sources.push({ url: buildBaiduTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildYoudaoTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildGoogleTtsUrl(text, accent) });
    } else if (engine === TTS_ENGINES.YOUDAO) {
      sources.push({ url: buildYoudaoTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildBaiduTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildGoogleTtsUrl(text, accent) });
    } else if (engine === TTS_ENGINES.GOOGLE) {
      sources.push({ url: buildGoogleTtsUrl(text, accent) });
      sources.push({ url: buildBaiduTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildYoudaoTtsUrl(text, accent, voiceId) });
    } else if (engine === TTS_ENGINES.DICTIONARY) {
      const dictData = await fetchDictionaryData(word);
      if (dictData.audio) {
        sources.push({ url: dictData.audio });
      }
      sources.push({ url: buildBaiduTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildYoudaoTtsUrl(text, accent, voiceId) });
    }

    const success = await tryPlaySources(sources, cacheKey);
    if (success) return;

    speakWithTTS(text, lang, rate);

  } catch (e) {
    speakWithTTS(text, lang, rate);
  }
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
    if (engine === TTS_ENGINES.BAIDU || engine === TTS_ENGINES.DICTIONARY) {
      sources.push({ url: buildBaiduTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildYoudaoTtsUrl(text, accent, voiceId) });
    } else if (engine === TTS_ENGINES.YOUDAO) {
      sources.push({ url: buildYoudaoTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildBaiduTtsUrl(text, accent, voiceId) });
    } else {
      sources.push({ url: buildBaiduTtsUrl(text, accent, voiceId) });
      sources.push({ url: buildGoogleTtsUrl(text, accent) });
      sources.push({ url: buildYoudaoTtsUrl(text, accent, voiceId) });
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
  if (engine === TTS_ENGINES.BAIDU) return BAIDU_VOICES;
  if (engine === TTS_ENGINES.YOUDAO) return YOUDAO_VOICES;
  return [];
}

export function getEngines() {
  return [
    { id: TTS_ENGINES.BROWSER, name: '浏览器内置语音 (推荐)', tag: '适合英语' },
    { id: TTS_ENGINES.BAIDU, name: '百度语音 · 神经引擎', tag: '高德地图同款' },
    { id: TTS_ENGINES.YOUDAO, name: '有道智云 · 高品质发音', tag: '国内稳定' },
    { id: TTS_ENGINES.GOOGLE, name: 'Google 神经发音', tag: '国际主流' },
    { id: TTS_ENGINES.DICTIONARY, name: 'DictionaryAPI 真人发音', tag: '真人录音' }
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
