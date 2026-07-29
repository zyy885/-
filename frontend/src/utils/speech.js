let cachedVoices = [];
const audioCache = {};

function loadVoices() {
  if (typeof speechSynthesis !== 'undefined') {
    cachedVoices = speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => {
      cachedVoices = speechSynthesis.getVoices();
    };
  }
}

loadVoices();

async function fetchDictionaryAudio(word) {
  try {
    const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const phonetics = data[0].phonetics || [];
      for (const p of phonetics) {
        if (p.audio && p.audio.length > 0) {
          return p.audio;
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getExampleFromDictionary(word) {
  try {
    const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const meanings = data[0].meanings || [];
      for (const m of meanings) {
        const defs = m.definitions || [];
        for (const d of defs) {
          if (d.example && d.example.trim()) {
            return d.example;
          }
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function playAudio(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = resolve;
    audio.onerror = reject;
    audio.play().catch(reject);
  });
}

export async function speak(text, lang) {
  lang = lang || 'en-US';
  try {
    const word = text.trim().toLowerCase();
    if (!word) return;

    if (audioCache[word]) {
      try {
        await playAudio(audioCache[word]);
        return;
      } catch (e) {}
    }

    const audioUrl = await fetchDictionaryAudio(word);
    if (audioUrl) {
      audioCache[word] = audioUrl;
      try {
        await playAudio(audioUrl);
        return;
      } catch (e) {}
    }

    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    if (savedVoice !== 'default') {
      const v = cachedVoices.find(function(v) { return v.name === savedVoice; });
      if (v) u.voice = v;
    }
    speechSynthesis.speak(u);
  } catch (e) {}
}

export async function speakSentence(text, lang) {
  lang = lang || 'en-US';
  try {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    if (savedVoice !== 'default') {
      const v = cachedVoices.find(function(v) { return v.name === savedVoice; });
      if (v) u.voice = v;
    }
    speechSynthesis.speak(u);
  } catch (e) {}
}

export function getVoices() {
  return cachedVoices;
}

export { getExampleFromDictionary };
