// ========== State ==========
let voices = [];           // browser voices
let customVoices = JSON.parse(localStorage.getItem('vf_custom_voices') || '[]');
let history = JSON.parse(localStorage.getItem('vf_history') || '[]');
let synthCount = parseInt(localStorage.getItem('vf_synth_count') || '0', 10);
let currentUtterance = null;
let isSpeaking = false;
let mediaRecorder = null;
let recordedChunks = [];
let lastSpokenText = '';

const COLORS = [
  '#8B5CF6', '#3B82F6', '#F97316', '#10B981',
  '#EC4899', '#6366F1', '#14B8A6', '#F59E0B'
];

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // File upload
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', handleFiles);

  // Drag & drop
  const zone = document.getElementById('upload-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = '#a78bfa'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    if (e.dataTransfer.files.length) handleFiles({ target: { files: e.dataTransfer.files } });
  });

  // Record button
  document.getElementById('record-btn').addEventListener('click', toggleRecord);

  // Sliders
  document.getElementById('synth-rate').addEventListener('input', e => {
    document.getElementById('rate-val').textContent = e.target.value + 'x';
  });
  document.getElementById('synth-pitch').addEventListener('input', e => {
    document.getElementById('pitch-val').textContent = e.target.value;
  });

  // Search
  document.getElementById('search-voices').addEventListener('input', renderLibrary);

  updateStats();
  renderRecent();
  renderLibrary();
  renderHistory();
  createWaveformBars();
});

// ========== Voices ==========
function loadVoices() {
  voices = speechSynthesis.getVoices();
  populateVoiceSelects();
  document.getElementById('stat-browser').textContent = voices.length || '—';
}

function populateVoiceSelects() {
  const selects = ['quick-voice', 'synth-voice'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '';

    // Custom voices first
    if (customVoices.length) {
      const group = document.createElement('optgroup');
      group.label = 'Your Cloned Voices';
      customVoices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = 'custom:' + v.id;
        opt.textContent = v.name + ' (cloned)';
        group.appendChild(opt);
      });
      sel.appendChild(group);
    }

    // Browser voices
    const group2 = document.createElement('optgroup');
    group2.label = 'System Voices';
    voices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = 'sys:' + i;
      opt.textContent = `${v.name} (${v.lang})`;
      group2.appendChild(opt);
    });
    sel.appendChild(group2);

    if (current) sel.value = current;
  });
}

function getSelectedVoice(selectId) {
  const val = document.getElementById(selectId).value;
  if (val.startsWith('custom:')) {
    return voices[0] || null;
  }
  if (val.startsWith('sys:')) {
    return voices[parseInt(val.slice(4), 10)] || null;
  }
  return voices[0] || null;
}

// ========== Navigation ==========
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(page).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
}

// ========== Stats & Render ==========
function updateStats() {
  document.getElementById('stat-voices').textContent = customVoices.length;
  document.getElementById('stat-synths').textContent = synthCount;
}

function renderRecent() {
  const container = document.getElementById('recent-voices');
  container.innerHTML = '';
  const list = customVoices.slice(0, 4);
  if (!list.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No cloned voices yet. Go to Clone Voice to create one.</p>';
    return;
  }
  list.forEach((v, i) => {
    container.appendChild(createVoiceCard(v, i));
  });
}

function renderLibrary() {
  const q = (document.getElementById('search-voices')?.value || '').toLowerCase();
  const container = document.getElementById('library-grid');
  container.innerHTML = '';

  customVoices
    .filter(v => v.name.toLowerCase().includes(q))
    .forEach((v, i) => container.appendChild(createVoiceCard(v, i, true)));

  voices
    .filter(v => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q))
    .slice(0, 12)
    .forEach((v, i) => {
      const card = document.createElement('div');
      card.className = 'voice-card';
      const color = COLORS[i % COLORS.length];
      card.innerHTML = `
        <div class="voice-avatar" style="background:${color}">${v.name[0]}</div>
        <div class="voice-name">${v.name}</div>
        <div class="voice-meta">${v.lang} • System</div>
        <div class="voice-actions">
          <button class="btn-play" onclick="previewSystem(${i})">▶ Play</button>
          <button class="btn-use" onclick="useSystem(${i})">Use</button>
        </div>
      `;
      container.appendChild(card);
    });
}

function createVoiceCard(v, index, showDelete = false) {
  const card = document.createElement('div');
  card.className = 'voice-card';
  const color = COLORS[index % COLORS.length];
  card.innerHTML = `
    <div class="voice-avatar" style="background:${color}">${v.name[0]}</div>
    <div class="voice-name">${v.name}</div>
    <div class="voice-meta">${v.lang || 'Custom'} • Cloned</div>
    <div class="voice-actions">
      <button class="btn-play" onclick="previewCustom('${v.id}')">▶ Play</button>
      <button class="btn-use" onclick="useCustom('${v.id}')">Use</button>
      ${showDelete ? `<button class="btn-play" style="color:var(--danger)" onclick="deleteVoice('${v.id}')">✕</button>` : ''}
    </div>
  `;
  return card;
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  history.slice(0, 8).forEach((item, i) => {
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

// ========== Speech ==========
function speak(text, voice, rate = 1, pitch = 1) {
  if (!text.trim()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = rate;
  u.pitch = pitch;
  u.onstart = () => {
    isSpeaking = true;
    document.getElementById('play-btn').textContent = '⏸';
    animateWaveform(true);
  };
  u.onend = () => {
    isSpeaking = false;
    document.getElementById('play-btn').textContent = '▶';
    animateWaveform(false);
  };
  currentUtterance = u;
  lastSpokenText = text;
  speechSynthesis.speak(u);

  synthCount++;
  localStorage.setItem('vf_synth_count', synthCount);
  history.unshift({ text, ts: Date.now() });
  history = history.slice(0, 20);
  localStorage.setItem('vf_history', JSON.stringify(history));
  updateStats();
  renderHistory();
  document.getElementById('export-btn').disabled = false;
}

function speakQuick() {
  const text = document.getElementById('quick-text').value;
  const voice = getSelectedVoice('quick-voice');
  const rate = parseFloat(document.getElementById('quick-rate').value);
  const pitch = parseFloat(document.getElementById('quick-pitch').value);
  speak(text, voice, rate, pitch);
}

function speakMain() {
  const text = document.getElementById('synth-text').value;
  const voice = getSelectedVoice('synth-voice');
  const rate = parseFloat(document.getElementById('synth-rate').value);
  const pitch = parseFloat(document.getElementById('synth-pitch').value);
  speak(text, voice, rate, pitch);
}

function togglePlay() {
  if (isSpeaking) {
    speechSynthesis.cancel();
    isSpeaking = false;
    document.getElementById('play-btn').textContent = '▶';
    animateWaveform(false);
  } else if (lastSpokenText) {
    speakMain();
  }
}

function previewSystem(i) {
  speak('This is a preview of the selected system voice.', voices[i], 1, 1);
}

function previewCustom(id) {
  const v = customVoices.find(c => c.id === id);
  if (v) speak(`This is a preview of your cloned voice named ${v.name}.`, voices[0], 1, 1);
}

function useSystem(i) {
  document.getElementById('synth-voice').value = 'sys:' + i;
  document.getElementById('quick-voice').value = 'sys:' + i;
  switchPage('synthesize');
}

function useCustom(id) {
  document.getElementById('synth-voice').value = 'custom:' + id;
  document.getElementById('quick-voice').value = 'custom:' + id;
  switchPage('synthesize');
}

function deleteVoice(id) {
  customVoices = customVoices.filter(v => v.id !== id);
  localStorage.setItem('vf_custom_voices', JSON.stringify(customVoices));
  updateStats();
  renderRecent();
  renderLibrary();
  populateVoiceSelects();
}

// ========== Cloning (simulated) ==========
function handleFiles(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  document.getElementById('record-status').textContent =
    `Selected ${files.length} file(s): ${files.map(f => f.name).join(', ')}`;
  if (!document.getElementById('clone-name').value) {
    document.getElementById('clone-name').value = files[0].name.replace(/\.[^/.]+$/, '');
  }
}

async function toggleRecord() {
  const btn = document.getElementById('record-btn');
  const status = document.getElementById('record-status');

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    btn.textContent = '● Record';
    btn.style.color = '';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      status.textContent = 'Recording saved. Click Start Training to create the voice.';
      if (!document.getElementById('clone-name').value) {
        document.getElementById('clone-name').value = 'My Recorded Voice';
      }
    };
    mediaRecorder.start();
    btn.textContent = '■ Stop';
    btn.style.color = '#f87171';
    status.textContent = 'Recording… speak clearly.';
  } catch (err) {
    status.textContent = 'Microphone access denied or unavailable.';
  }
}

function startTraining() {
  const name = document.getElementById('clone-name').value.trim() || 'Untitled Voice';
  const lang = document.getElementById('clone-lang').value;
  const btn = document.getElementById('train-btn');
  btn.disabled = true;
  btn.textContent = 'Training…';

  setTimeout(() => {
    const newVoice = {
      id: 'v_' + Date.now(),
      name,
      lang,
      created: Date.now()
    };
    customVoices.unshift(newVoice);
    localStorage.setItem('vf_custom_voices', JSON.stringify(customVoices));

    btn.disabled = false;
    btn.textContent = 'Start Training →';
    document.getElementById('record-status').textContent = '';
    document.getElementById('clone-name').value = '';
    updateStats();
    renderRecent();
    renderLibrary();
    populateVoiceSelects();

    alert(`Voice "${name}" has been added to your library!\n\nNote: This is a simulated clone. Real high-quality voice cloning requires specialized ML models. The app currently uses your browser’s system voices for synthesis.`);
    switchPage('library');
  }, 2200);
}

// ========== Waveform animation ==========
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

// ========== Export (placeholder) ==========
function downloadLastAudio() {
  alert('In a full production version this would download the generated MP3.\n\nCurrently the audio is played via the browser Web Speech API and is not exported as a file.');
}
