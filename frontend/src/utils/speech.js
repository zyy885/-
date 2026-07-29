let cachedVoices = [];
const audioCache = {};
const audioFailedCache = {}; // 记录失败的音频URL
const dictCache = {};
const translationCache = {};
let currentAudio = null;

function loadVoices() {
  if (typeof speechSynthesis !== 'undefined') {
    cachedVoices = speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => {
      cachedVoices = speechSynthesis.getVoices();
    };
  }
}

loadVoices();

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
    audio.onerror = (e) => { cleanup(); reject(new Error('Audio load/play failed: ' + url)); };
    
    // 设置超时，防止音频加载卡住
    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('Audio load timeout'));
      }
    }, 5000);
    
    const p = audio.play();
    if (p && p.then) {
      p.then(() => {
        clearTimeout(timeout);
      }).catch((e) => {
        clearTimeout(timeout);
        cleanup();
        reject(e);
      });
    }
  });
}

function speakWithTTS(text, lang, rate) {
  lang = lang || 'en-US';
  rate = rate || 0.9;
  try {
    if (typeof speechSynthesis === 'undefined') return false;
    stopAll();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    if (savedVoice !== 'default') {
      const v = cachedVoices.find(function(v) { return v.name === savedVoice; });
      if (v) u.voice = v;
    }
    speechSynthesis.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

export async function speak(text, lang) {
  stopAll();
  lang = lang || 'en-US';
  try {
    const word = text.trim().toLowerCase();
    if (!word) return;

    // 检查是否有缓存且未失败的音频
    const cachedUrl = audioCache[word];
    if (cachedUrl && !audioFailedCache[cachedUrl]) {
      try {
        await playAudioUrl(cachedUrl);
        return; // 成功播放
      } catch (e) {
        // 播放失败，记录并清除缓存
        audioFailedCache[cachedUrl] = true;
        delete audioCache[word];
        // 继续fallback到TTS
      }
    }

    // 检查字典缓存中是否有音频
    const cached = dictCache[word];
    if (cached && cached.audio && !audioFailedCache[cached.audio]) {
      audioCache[word] = cached.audio;
      try {
        await playAudioUrl(cached.audio);
        return; // 成功播放
      } catch (e) {
        // 播放失败，记录并清除缓存
        audioFailedCache[cached.audio] = true;
        delete audioCache[word];
        // 继续fallback到TTS
      }
    }

    // 使用TTS播放（立即响应）
    speakWithTTS(text, lang);

    // 后台异步获取真人发音（下次可用）
    fetchDictionaryData(word).then(data => {
      if (data.audio && !audioFailedCache[data.audio]) {
        audioCache[word] = data.audio;
      }
    });
  } catch (e) {
    // 最后的fallback
    speakWithTTS(text, lang);
  }
}

export async function speakSentence(text, lang) {
  stopAll();
  speakWithTTS(text, lang, 0.75);
}

export async function getExampleFromDictionary(word) {
  const data = await fetchDictionaryData(word);
  return data.example;
}

export function getVoices() {
  return cachedVoices;
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

export { stopAll };