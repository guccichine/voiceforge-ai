// ========== State ==========
let apiKey = localStorage.getItem('vf_api_key') || '';
let savedVoices = JSON.parse(localStorage.getItem('vf_saved_voices') || '[]');
let history = JSON.parse(localStorage.getItem('vf_history') || '[]');
let synthCount = parseInt(localStorage.getItem('vf_synth_count') || '0', 10);
let currentAudio = null;
let isSpeaking = false;
let lastBlob = null;
let lastSpokenText = '';

const COLORS = [
  '#8B5CF6', '#3B82F6', '#F97316', '#10B981',
  '#EC4899', '#6366F1', '#14B8A6', '#F59E0B'
];

// Seed some popular built-in voices if library is empty
const DEFAULT_VOICES = [
  { id: 'gno86tuhzvnt', name: 'My Cloned Voice', type: 'custom' },
  { id: 'eve', name: 'Eve', type: 'built-in' },
  { id: 'ara', name: 'Ara', type: 'built-in' },
  { id: 'leo', name: 'Leo', type: 'built-in' },
  { id: 'rex', name: 'Rex', type: 'built-in' },
  { id: 'sal', name: 'Sal', type: 'built-in' },
  { id: 'luna', name: 'Luna', type: 'built-in' },
  { id: 'orion', name: 'Orion', type: 'built-in' }
];

if (savedVoices.length === 0) {
  savedVoices = DEFAULT_VOICES;
  localStorage.setItem('vf_saved_voices', JSON.stringify(savedVoices));
}

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // Rate slider
  const rateEl = document.getElementById('synth-rate');
  if (rateEl) {
    rateEl.addEventListener('input', e => {
      document.getElementById('rate-val').textContent = e.target.value + 'x';
    });
  }

  // Search
  const searchEl = document.getElementById('search-voices');
  if (searchEl) searchEl.addEventListener('input', renderLibrary);

  // Pre-fill API key if present
  const keyInput = document.getElementById('api-key-input');
  if (keyInput && apiKey) keyInput.value = apiKey;

  updateStats();
  populateVoiceSelects();
  renderRecent();
  renderLibrary();
  renderHistory();
  createWaveformBars();
  updateApiStatus();
});

// ========== Navigation ==========
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(page).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
}

// ========== API Key ==========
function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  apiKey = key;
  localStorage.setItem('vf_api_key', key);
  updateApiStatus();
  alert(key ? 'API key saved (stored only in your browser).' : 'API key cleared.');
}

function updateApiStatus() {
  const el = document.getElementById('api-status');
  if (!el) return;
  if (apiKey) {
    el.textContent = 'Connected';
    el.style.color = 'var(--success)';
  } else {
    el.textContent = 'No API key';
    el.style.color = 'var(--danger)';
  }
}

// ========== Voices Management ==========
function populateVoiceSelects() {
  const selects = ['quick-voice', 'synth-voice'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '';

    savedVoices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.name} (${v.type === 'custom' ? 'Custom' : 'Built-in'})`;
      sel.appendChild(opt);
    });

    if (current && [...sel.options].some(o => o.value === current)) {
      sel.value = current;
    }
  });
}

function addVoice() {
  const name = document.getElementById('new-voice-name').value.trim();
  const id = document.getElementById('new-voice-id').value.trim();

  if (!name || !id) {
    alert('Please enter both a name and a Voice ID.');
    return;
  }

  if (savedVoices.some(v => v.id.toLowerCase() === id.toLowerCase())) {
    alert('This Voice ID is already in your library.');
    return;
  }

  const type = (id.length > 10 || /[0-9]/.test(id)) ? 'custom' : 'built-in';
  savedVoices.unshift({ id, name, type });
  localStorage.setItem('vf_saved_voices', JSON.stringify(savedVoices));

  document.getElementById('new-voice-name').value = '';
  document.getElementById('new-voice-id').value = '';

  updateStats();
  populateVoiceSelects();
  renderRecent();
  renderLibrary();
  alert(`Voice "${name}" added!`);
}

function deleteVoice(id) {
  if (!confirm('Remove this voice from your library?')) return;
  savedVoices = savedVoices.filter(v => v.id !== id);
  localStorage.setItem('vf_saved_voices', JSON.stringify(savedVoices));
  updateStats();
  populateVoiceSelects();
  renderRecent();
  renderLibrary();
}

// ========== Stats & Render ==========
function updateStats() {
  const voicesEl = document.getElementById('stat-voices');
  const synthsEl = document.getElementById('stat-synths');
  if (voicesEl) voicesEl.textContent = savedVoices.length;
  if (synthsEl) synthsEl.textContent = synthCount;
}

function renderRecent() {
  const container = document.getElementById('recent-voices');
  if (!container) return;
  container.innerHTML = '';
  const list = savedVoices.slice(0, 4);
  if (!list.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No voices yet. Add one on the Clone / Add page.</p>';
    return;
  }
  list.forEach((v, i) => container.appendChild(createVoiceCard(v, i)));
}

function renderLibrary() {
  const q = (document.getElementById('search-voices')?.value || '').toLowerCase();
  const container = document.getElementById('library-grid');
  if (!container) return;
  container.innerHTML = '';

  savedVoices
    .filter(v => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q))
    .forEach((v, i) => container.appendChild(createVoiceCard(v, i, true)));
}

function createVoiceCard(v, index, showDelete = false) {
  const card = document.createElement('div');
  card.className = 'voice-card';
  const color = COLORS[index % COLORS.length];
  card.innerHTML = `
    <div class="voice-avatar" style="background:${color}">${v.name[0]}</div>
    <div class="voice-name">${v.name}</div>
    <div class="voice-meta">${v.id} • ${v.type === 'custom' ? 'Custom' : 'Built-in'}</div>
    <div class="voice-actions">
      <button class="btn-play" onclick="previewVoice('${v.id}')">▶ Play</button>
      <button class="btn-use" onclick="useVoice('${v.id}')">Use</button>
      ${showDelete ? `<button class="btn-play" style="color:var(--danger)" onclick="deleteVoice('${v.id}')">✕</button>` : ''}
    </div>
  `;
  return card;
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = '';
  history.slice(0, 8).forEach((item) => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.textContent = item.text.slice(0, 60) + (item.text.length > 60 ? '…' : '');
    el.onclick = () => {
      document.getElementById('synth-text').value = item.text;
      speakMain();
    };
    list.appendChild(el);
  });
}

// ========== Core TTS (xAI) ==========
async function generateSpeech(text, voiceId) {
  if (!apiKey) {
    alert('Please add your xAI API key first (on the Clone / Add Voices page).');
    switchPage('clone');
    return null;
  }
  if (!text.trim()) return null;

  const response = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      voice_id: voiceId,
      language: 'en'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('TTS error:', response.status, errText);
    throw new Error(`TTS failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  return await response.blob();
}

async function speak(text, voiceId) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const blob = await generateSpeech(text, voiceId);
    if (!blob) return;

    lastBlob = blob;
    lastSpokenText = text;

    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);

    currentAudio.onplay = () => {
      isSpeaking = true;
      const btn = document.getElementById('play-btn');
      if (btn) btn.textContent = '⏸';
      animateWaveform(true);
    };
    currentAudio.onended = () => {
      isSpeaking = false;
      const btn = document.getElementById('play-btn');
      if (btn) btn.textContent = '▶';
      animateWaveform(false);
    };
    currentAudio.onerror = () => {
      isSpeaking = false;
      animateWaveform(false);
      alert('Playback error.');
    };

    await currentAudio.play();

    synthCount++;
    localStorage.setItem('vf_synth_count', synthCount);
    history.unshift({ text, voiceId, ts: Date.now() });
    history = history.slice(0, 20);
    localStorage.setItem('vf_history', JSON.stringify(history));
    updateStats();
    renderHistory();

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.disabled = false;

  } catch (err) {
    console.error(err);
    alert('Error generating speech:\n' + err.message);
  }
}

function speakQuick() {
  const text = document.getElementById('quick-text').value;
  const voiceId = document.getElementById('quick-voice').value;
  speak(text, voiceId);
}

function speakMain() {
  const text = document.getElementById('synth-text').value;
  const voiceId = document.getElementById('synth-voice').value;
  speak(text, voiceId);
}

function togglePlay() {
  if (!currentAudio) {
    if (lastSpokenText) speakMain();
    return;
  }
  if (isSpeaking) {
    currentAudio.pause();
    isSpeaking = false;
    document.getElementById('play-btn').textContent = '▶';
    animateWaveform(false);
  } else {
    currentAudio.play();
  }
}

function previewVoice(id) {
  speak('This is a short preview of the selected voice.', id);
}

function useVoice(id) {
  const sel1 = document.getElementById('synth-voice');
  const sel2 = document.getElementById('quick-voice');
  if (sel1) sel1.value = id;
  if (sel2) sel2.value = id;
  switchPage('synthesize');
}

// ========== Export ==========
function downloadLastAudio() {
  if (!lastBlob) {
    alert('Generate some speech first.');
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(lastBlob);
  a.download = 'voiceforge-' + Date.now() + '.mp3';
  a.click();
}

// ========== Waveform ==========
function createWaveformBars() {
  const container = document.querySelector('.bars');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const bar = document.createElement('span');
    bar.style.height = (20 + Math.random() * 60) + '%';
    container.appendChild(bar);
  }
}

let waveInterval = null;
function animateWaveform(active) {
  const bars = document.querySelectorAll('.bars span');
  if (waveInterval) clearInterval(waveInterval);
  if (!active) {
    bars.forEach(b => b.style.height = '30%');
    return;
  }
  waveInterval = setInterval(() => {
    bars.forEach(b => {
      b.style.height = (15 + Math.random() * 75) + '%';
    });
  }, 120);
}
