let cachedVoices = [];

function loadVoices() {
  if (typeof speechSynthesis !== 'undefined') {
    cachedVoices = speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => {
      cachedVoices = speechSynthesis.getVoices();
    };
  }
}

loadVoices();

export function speak(text, lang = 'en-US') {
  try {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    if (savedVoice !== 'default') {
      const v = cachedVoices.find(v => v.name === savedVoice);
      if (v) u.voice = v;
    }
    speechSynthesis.speak(u);
  } catch (e) {}
}

export function getVoices() {
  return cachedVoices;
}
