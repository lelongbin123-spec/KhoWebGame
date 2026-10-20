/* ══════════════════════════════════════════
   VỆ SĨ THÔNG THÁI – script.js
   Web Speech API (TTS + STT) · Local Eval
   ══════════════════════════════════════════ */

/* ── App State (Trạng thái ứng dụng) ── */
let SCENARIOS = [];
let currentScenarioIndex = 0;
let totalStars = 0;
let isSoundMuted = false;
let isListening = false;
let isAnswering = false;
let speechRecognitionInstance = null;
let ttsVoice = null; // cached Vietnamese voice
let sessionCorrectCount = 0;
let sessionWrongCount = 0;
let pendingScenarioResult = null;
let speechRequestId = 0;
let speechStartTimer = null;
let scenarioSpeechTimer = null;

/* ── Audio files (Các tệp âm thanh) ── */
const audioCorrect   = new Audio('assets/audio/correct.m4a');
const audioIncorrect = new Audio('assets/audio/incorrect.m4a');
const audioClick     = new Audio('assets/audio/click.m4a');


function playSound(type) {
  if (isSoundMuted) return;
  try {
    if (type === 'pop') {
      audioClick.currentTime = 0;
      audioClick.play().catch(() => {});
    } else if (type === 'win') {
      audioCorrect.currentTime = 0;
      audioCorrect.play().catch(() => {});
    } else if (type === 'warn') {
      audioIncorrect.currentTime = 0;
      audioIncorrect.play().catch(() => {});
    }
  } catch (e) {}
}

/* ══════════════════════════════════════════
   TEXT-TO-SPEECH  (Web Speech API – Primary)
   (Chuyển văn bản thành giọng nói)
   ══════════════════════════════════════════ */

// Hàm findVietnameseVoice: Tìm kiếm và trả về một giọng nói tiếng Việt từ danh sách các giọng nói có sẵn trên trình duyệt.
function findVietnameseVoice() {
  const voices = speechSynthesis.getVoices();
  const vietnameseVoices = voices.filter(v => v.lang.toLowerCase() === 'vi-vn');
  const candidates = vietnameseVoices.length
    ? vietnameseVoices
    : voices.filter(v => v.lang.toLowerCase().startsWith('vi'));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];

}

// Hàm loadVoices: Gọi hàm findVietnameseVoice và lưu kết quả vào biến toàn cục ttsVoice. In log thông báo kết quả.
function loadVoices() {
  ttsVoice = findVietnameseVoice();
  if (ttsVoice) {
    console.log('[TTS] Vietnamese voice found:', ttsVoice.name, ttsVoice.lang);
  } else {
    console.warn('[TTS] No Vietnamese voice found. Available voices:',
      speechSynthesis.getVoices().map(v => `${v.name} (${v.lang})`).join(', '));
  }
}
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices(); // try immediately (works in Firefox)

// Hàm stopSpeechPlayback: Dừng ngay lập tức việc đọc văn bản (cả API offline và API dự phòng online).
function stopSpeechPlayback() {
  speechRequestId++;
  clearTimeout(speechStartTimer);
  speechStartTimer = null;
  speechSynthesis.cancel();
  const audio = document.getElementById('ttsAudioPlayer');
  if (audio) {
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    audio.removeAttribute('src');
    audio.load();
  }
  document.getElementById('speakingBadge')?.classList.add('hidden');
  return speechRequestId;
}

// Hàm cancelScenarioSpeech: Hủy bộ hẹn giờ tự động đọc kịch bản.
function cancelScenarioSpeech() {
  clearTimeout(scenarioSpeechTimer);
  scenarioSpeechTimer = null;
}


function speakText(text) {
  const requestId = stopSpeechPlayback();
  if (isSoundMuted) return;
  const badge = document.getElementById('speakingBadge');
  speechStartTimer = setTimeout(() => {
    speechStartTimer = null;
    if (requestId !== speechRequestId || isSoundMuted) return;
    if (!ttsVoice) ttsVoice = findVietnameseVoice();

    if (ttsVoice) {
      // ── Sử dụng giọng tiếng Việt có sẵn của trình duyệt (offline/local)
      const u = new SpeechSynthesisUtterance(text);
      u.lang   = 'vi-VN';
      u.voice  = ttsVoice;
      u.rate   = 0.8;  // Tốc độ đọc (nhỏ hơn 1 là chậm lại)
      u.pitch  = 1.1;  // Độ cao giọng (lớn hơn 1 là cao hơn)
      u.volume = 1;    // Âm lượng tối đa
      badge?.classList.remove('hidden');
      u.onend = () => {
        if (requestId === speechRequestId) badge?.classList.add('hidden');
      };
      u.onerror = event => {
        if (requestId !== speechRequestId || event.error === 'canceled' || event.error === 'interrupted') return;
        badge?.classList.add('hidden');
        googleTTSGtx(text, badge, requestId);
      };
      console.log('🔊 Giọng đang đọc (Local TTS):', ttsVoice.name);
      speechSynthesis.speak(u);
    } else {
      // ── Phương án dự phòng: Sử dụng Google Translate TTS (cần internet)
      console.log('🔊 Giọng đang đọc: Google Translate TTS (Dự phòng)');
      googleTTSGtx(text, badge, requestId);
    }
  }, 100);
}


function googleTTSGtx(text, badge, requestId) {
  if (requestId !== speechRequestId || isSoundMuted) return;
  const audio = document.getElementById('ttsAudioPlayer');
  if (!audio) return;

  badge?.classList.remove('hidden');
  // Lưu ý: Google TTS có thể lỗi với chuỗi quá dài, nhưng với câu ngắn thì hoạt động tốt.
  const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encodeURIComponent(text)}`;
  audio.src = url;
  audio.onended = () => {
    if (requestId === speechRequestId) badge?.classList.add('hidden');
  };
  audio.onerror = () => {
    if (requestId !== speechRequestId) return;
    badge?.classList.add('hidden');
    console.error('[TTS] Google Fallback failed.');
  };
  audio.play().catch(e => {
    if (requestId !== speechRequestId) return;
    console.error('[TTS] Playback error:', e);
    badge?.classList.add('hidden');
    if (e.name === 'NotAllowedError') {
      console.warn('Trình duyệt chặn tự động phát âm thanh. Vui lòng click vào màn hình hoặc nút nghe lại.');
    }
  });
}

/* ── Debug helper (gọi hàm này trong console trình duyệt: listVoices()) ── */
window.listVoices = () => {
  const voices = speechSynthesis.getVoices();
  console.table(voices.map(v => ({ name: v.name, lang: v.lang, local: v.localService })));
};

/* ══════════════════════════════════════════
   SPEECH-TO-TEXT  (Web Speech API – Primary)
   (Chuyển giọng nói thành văn bản)
   ══════════════════════════════════════════ */

// Hàm setupSpeechRecognition: Khởi tạo và cấu hình bộ nhận diện giọng nói (Web Speech API). Gắn các sự kiện start, result, error, end.
function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    document.getElementById('micStatusText').innerText = 'Trình duyệt chưa hỗ trợ mic. Dùng Chrome/Edge nhé!';
    return null;
  }

  const rec = new SR();
  rec.lang            = 'vi-VN';
  rec.continuous      = false;
  rec.interimResults  = true;
  rec.maxAlternatives = 1;
  rec.onstart = () => {
    cancelScenarioSpeech(); // Hủy đọc kịch bản
    stopSpeechPlayback();   // Dừng mọi âm thanh đang phát
    isListening = true;     // Đánh dấu đang nghe
    updateMicUI(true);      // Cập nhật giao diện mic
    playSound('pop');       // Phát tiếng thông báo
    setTranscript('Đang lắng nghe...', true);
  };
  rec.onresult = (e) => {
    let t = '';
    // Gộp các kết quả lại thành chuỗi văn bản
    for (let i = e.resultIndex; i < e.results.length; i++) {
      t += e.results[i][0].transcript;
    }
    setTranscript(`"${t}"`, true); // Hiển thị lên màn hình
  };
  rec.onerror = (e) => {
    console.warn('STT error:', e.error);
    isListening = false;
    updateMicUI(false);
    if (e.error === 'no-speech') {
      document.getElementById('micStatusText').innerText = 'Chưa nghe thấy gì, thử lại nha bé! 🎙️';
    } else if (e.error === 'not-allowed') {
      document.getElementById('micStatusText').innerText = 'Cần cho phép dùng microphone!';
    } else {
      document.getElementById('micStatusText').innerText = 'Lỗi mic, thử lại nhé!';
    }
  };
  rec.onend = () => {
    isListening = false;
    updateMicUI(false);
    const txt = (document.getElementById('transcriptPreview').innerText || '')
      .replace(/["""]/g, '').trim();
    const skipList = ['Đang lắng nghe...', 'Bé hãy lắng nghe và bấm nút nhé!', 'Chạm Robot để nói 🎙️'];
    if (txt && !skipList.includes(txt)) {
      evaluateIntent(txt);
    } else {
      document.getElementById('micStatusText').innerText = 'Chạm Robot để nói 🎙️';
    }
  };

  return rec;
}

function updateMicUI(listening) {
  const micBtn  = document.getElementById('micBtn');
  const micRing = document.getElementById('micRing');
  const status  = document.getElementById('micStatusText');
  if (listening) {
    micRing?.classList.remove('hidden');
    micBtn?.classList.add('listening');
    status.innerText = 'Đang nghe bé nói...';
    status.classList.add('is-listening');
  } else {
    micRing?.classList.add('hidden');
    micBtn?.classList.remove('listening');
    status.innerText = 'Chạm Robot để nói 🎙️';
    status.classList.remove('is-listening');
  }
}

// Hàm setTranscript: Hiển thị văn bản (hoặc trạng thái) lên vùng xem trước kết quả STT.
function setTranscript(text, active = false) {
  const el = document.getElementById('transcriptPreview');
  el.innerText = text;
  el.classList.toggle('active', active);
}

// Hàm clearFeedbackEffects: Xóa các hiệu ứng phản hồi (màu sắc an toàn/không an toàn) trên giao diện.
function clearFeedbackEffects() {
  document.getElementById('feedbackEffects')?.classList.add('hidden');
  document.getElementById('feedbackEffects')?.classList.remove('is-safe', 'is-unsafe');
  document.getElementById('scenarioImageContainer')?.classList.remove('is-safe', 'is-unsafe');
}

function playFeedbackEffect(isSafe) {
  clearFeedbackEffects();
  const effects = document.getElementById('feedbackEffects');
  const scene = document.getElementById('scenarioImageContainer');
  effects?.classList.remove('hidden');
  effects?.classList.add(isSafe ? 'is-safe' : 'is-unsafe');
  scene?.classList.add(isSafe ? 'is-safe' : 'is-unsafe');
}

/* ══════════════════════════════════════════
   LOCAL EVALUATION (No API needed)
   (Đánh giá câu trả lời trực tiếp trên trình duyệt)
   ══════════════════════════════════════════ */

function evaluateIntent(spoken) {
  if (isAnswering) return;
  cancelScenarioSpeech();
  isAnswering = true;
  document.getElementById('micStatusText').innerText = 'Đang đánh giá...';
  
  // Log kết quả thu âm ra console
  console.log("🎤 KẾT QUẢ THU ÂM (Speech to Text):", spoken);

  const scenario = SCENARIOS[currentScenarioIndex];
  const result = localEval(spoken, scenario);
  const specificFeedback = result.isSafe ? scenario?.correctFeedback : scenario?.wrongFeedback;
  if (specificFeedback) result.spokenFeedback = specificFeedback;
  showResult(spoken, result);
}

// Hàm localEval: Phân tích và chấm điểm độ an toàn của câu nói so với các từ khóa kịch bản và từ khóa chung.
function localEval(text, scenario) {
  const normalize = value => value.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const t = normalize(text);
  const hasPhrase = phrase => (` ${t} `).includes(` ${normalize(phrase)} `);
  const tOrig = text.toLowerCase();
  // Một sự từ chối rõ ràng được ưu tiên hơn các từ đồng ý nằm bên trong nó (ví dụ: "được" nằm trong "không được").
  const safeWords = [
    'khong', 'hong', 'khong duoc', 'hong duoc', 'mach', 'mach me', 'mach ba',
    'mach nguoi lon', 'la len', 'la to', 'keu cuu', 'chay di', 'chay',
    'bao ve', 'goi cong an', 'goi police', 'con khong biet', 'con so',
    'nguy hiem', 'khong mo cua', 'khong di theo', 'tu choi', 'so lam'
  ];
  const scenarioSafe = scenario?.safeKeywords?.some(kw => hasPhrase(kw)) || false;
  const generalSafe = safeWords.some(hasPhrase);
  if (scenarioSafe || generalSafe) {
    const strongWords = ['không được', 'hổng được', 'la lên', 'mách', 'chạy', 'kêu cứu'];
    const isStrong = strongWords.some(w => tOrig.includes(w));
    return {
      isSafe: true,
      intent: isStrong ? 'Từ chối dứt khoát 🛡️' : 'Cảnh giác 🛡️',
      stars: isStrong ? 3 : 2,
      spokenFeedback: isStrong
        ? 'Hoan hô! Bé rất dũng cảm! Bé nói KHÔNG rất to và rõ ràng!'
        : 'Bé phản xạ tốt rồi! Lần sau hô to hơn để kẻ xấu sợ nha bé!'
    };
  }
  // Khớp toàn bộ cụm từ để tránh sai sót.
  const dangerWords = [
    'di theo', 'dong y', 'u di', 'mo cua', 'vao di', 'lay keo',
    'ok', 'duoc', 'co', 'vang', 'gui', 'gui cho'
  ];
  if (dangerWords.some(hasPhrase)) {
    return {
      isSafe: false,
      intent: 'Đồng ý nguy hiểm ⚠️',
      stars: 1, // Động viên 1 sao dù sai
      spokenFeedback: 'Ôi không được! Bé phải nói KHÔNG và chạy đến người lớn ngay nhé!'
    };
  }
  return {
    isSafe: false,
    intent: 'Chưa rõ ràng 🤔',
    stars: 0,
    spokenFeedback: 'Bé phát âm chưa rõ hoặc trả lời sai rồi! Bé phải nói KHÔNG và mách người lớn nhé!'
  };
}

/* ══════════════════════════════════════════
   RESULT MODAL
   (Hộp thoại hiển thị kết quả sau mỗi câu trả lời)
   ══════════════════════════════════════════ */

// Hàm showResult: Hiển thị giao diện kết quả đánh giá cho câu nói vừa rồi (đúng/sai, số sao, phản hồi).
function showResult(spoken, assessment) {
  playFeedbackEffect(assessment.isSafe);
  document.getElementById('micStatusText').innerText = 'Chạm Robot để nói 🎙️';
  const attemptStars = assessment.isSafe ? (assessment.stars || 3) : 0;
  if (!pendingScenarioResult) {
    pendingScenarioResult = { isSafe: false, stars: 0 };
  }
  if (assessment.isSafe) {
    pendingScenarioResult.isSafe = true;
    pendingScenarioResult.stars = Math.max(pendingScenarioResult.stars, attemptStars);
  }
  const modal    = document.getElementById('resultModal');
  const box      = document.getElementById('resultModalBox');
  const titleEl  = document.getElementById('resultTitle');
  const starsEl  = document.getElementById('starAwardContainer');
  const fbEl     = document.getElementById('resultVoiceFeedback');
  const fbBox    = document.getElementById('resultFeedbackBox');
  const robotImg = document.getElementById('resultRobotImg');

  const stars = attemptStars;
  starsEl.innerHTML = '';
  for (let index = 0; index < 3; index++) {
    const star = document.createElement('i');
    star.className = `fa-solid fa-star${index < stars ? '' : ' dim'}`;
    starsEl.appendChild(star);
  }
  fbEl.innerText = assessment.isSafe
    ? 'An toàn! Bé làm tốt lắm!'
    : 'Từ chối, báo ba mẹ nhé!';
  if (assessment.isSafe) {
    titleEl.innerText = 'Chính xác!';
    titleEl.className = 'modal-title safe';
    box.className     = 'modal-box result-modal-box';
    starsEl.setAttribute('aria-label', `${stars} sao nhận được`);
    fbBox.className   = 'feedback-box';
    robotImg.src      = 'assets/images/Robot_happy.jpg'; // Ảnh robot vui vẻ
    playSound('win');
  } else {
    titleEl.innerText = 'Thử lại nhé!';
    titleEl.className = 'modal-title unsafe';
    box.className     = 'modal-box result-modal-box unsafe';
    starsEl.setAttribute('aria-label', 'Chưa nhận sao');
    fbBox.className   = 'feedback-box unsafe';
    robotImg.src      = 'assets/images/Robot_buon.jpg';  // Ảnh robot buồn
    playSound('warn');
  }
  modal.classList.remove('hidden');
  speakText(assessment.spokenFeedback);
}

/* ══════════════════════════════════════════
   SCENARIO LOADING
   (Tải và hiển thị kịch bản)
   ══════════════════════════════════════════ */

function loadScenario(idx) {
  if (idx < 0 || idx >= SCENARIOS.length) return;
  cancelScenarioSpeech();
  stopSpeechPlayback();
  clearFeedbackEffects();
  isAnswering = false;
  pendingScenarioResult = null;
  currentScenarioIndex = idx;
  const sc = SCENARIOS[idx];
  const titleEl    = document.getElementById('scenarioTitle');
  const dialogueEl = document.getElementById('scenarioDialogue');
  const scenarioImage = document.querySelector('#scenarioImage img');
  if (titleEl)    titleEl.innerText    = sc.title;
  if (dialogueEl) dialogueEl.innerText = sc.dialogue;
  if (scenarioImage && sc.image) {
    scenarioImage.src = sc.image;
    scenarioImage.alt = sc.imageAlt || sc.title;
  }
  const progressText = document.getElementById('progressText');
  const progressBar  = document.getElementById('progressBar');
  const progressTrack = document.getElementById('progressTrack');
  const progress = Math.round(((idx + 1) / SCENARIOS.length) * 100);
  if (progressText) progressText.innerText = `${idx + 1} / ${SCENARIOS.length}`;
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressTrack) {
    progressTrack.setAttribute('aria-valuenow', progress);
    progressTrack.setAttribute('aria-valuetext', `Tình huống ${idx + 1} trên ${SCENARIOS.length}`);
  }
  setTranscript('Bé hãy lắng nghe và bấm nút nhé!', false);
  document.getElementById('micStatusText').innerText = 'Chạm Robot để nói 🎙️';
  scenarioSpeechTimer = setTimeout(() => {
    scenarioSpeechTimer = null;
    if (currentScenarioIndex === idx && !isAnswering) speakText(sc.dialogue);
  }, 400);
}

/* ══════════════════════════════════════════
   BOOT
   (Khởi động ứng dụng khi trang web tải xong)
   ══════════════════════════════════════════ */

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('data/data.json');
    const jsonData = await response.json();
    SCENARIOS = jsonData.data || [];
  } catch (e) {
    console.error('Không tải được data.json:', e);
    return;
  }
  speechRecognitionInstance = setupSpeechRecognition();

  // ── Logic xử lý nút Mic (nhấn giữ để nói hoặc click để bật/tắt)
  const micBtn = document.getElementById('micBtn');
  // Hàm bắt đầu nghe
  const startListening = () => {
    if (!speechRecognitionInstance) speechRecognitionInstance = setupSpeechRecognition();
    if (!speechRecognitionInstance) return;
    try { speechRecognitionInstance.start(); }
    catch (e) {
      speechRecognitionInstance = setupSpeechRecognition();
      try { speechRecognitionInstance?.start(); } catch (_) {}
    }
  };
  // Hàm kết thúc nghe
  const stopListening = () => {
    try { speechRecognitionInstance?.stop(); } catch (_) {}
  };

  // Các sự kiện cho nhấn giữ (hỗ trợ cảm ứng và chuột)
  micBtn.addEventListener('pointerdown', event => {
    if (event.button !== 0) return; // Chỉ bắt chuột trái
    event.preventDefault();
    micBtn.setPointerCapture(event.pointerId);
    startListening();
  });
  micBtn.addEventListener('pointerup', stopListening);
  micBtn.addEventListener('pointercancel', stopListening);
  micBtn.addEventListener('lostpointercapture', stopListening);
  
  // Sự kiện click phòng hờ làm dạng bật/tắt
  micBtn.addEventListener('click', event => {
    if (event.detail !== 0) return;
    if (isListening) stopListening();
    else startListening();
  });

  // ── Sự kiện nút "Đồng ý" (nút vật lý/ảo để trả lời thay giọng nói)
  document.getElementById('agreeBtn').addEventListener('click', () => {
    setTranscript('"Đồng ý"', true);
    evaluateIntent('đồng ý');
  });

  // ── Sự kiện nút "Không được!" (từ chối)
  document.getElementById('rejectBtn').addEventListener('click', () => {
    setTranscript('"Không được!"', true);
    evaluateIntent('không được');
  });

  // ── Sự kiện nút "Nghe lại" (phát lại kịch bản)
  document.getElementById('replayVoiceBtn').addEventListener('click', () => {
    cancelScenarioSpeech();
    playSound('pop');
    speakText(SCENARIOS[currentScenarioIndex]?.dialogue || '');
  });

  // ── Sự kiện nút "Bật/tắt âm thanh"
  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    isSoundMuted = !isSoundMuted;
    const icon = document.getElementById('soundIcon');
    if (isSoundMuted) {
      cancelScenarioSpeech();
      icon.className  = 'fa-solid fa-volume-xmark';
      icon.style.color = '#94a3b8';
      document.getElementById('soundToggleBtn').setAttribute('aria-label', 'Bật tiếng');
      stopSpeechPlayback(); // Dừng ngay tiếng đang phát
    } else {
      icon.className  = 'fa-solid fa-volume-high';
      icon.style.color = 'var(--blue)';
      document.getElementById('soundToggleBtn').setAttribute('aria-label', 'Tắt tiếng');
      playSound('pop');
    }
  });

  // ── Các nút trong Modal kết quả
  // Nút "Thử lại" (chơi lại kịch bản hiện tại)
  document.getElementById('retryBtn').addEventListener('click', () => {
    playSound('pop');
    document.getElementById('resultModal').classList.add('hidden');
    clearFeedbackEffects();
    isAnswering = false;
    stopSpeechPlayback();
  });

  // Nút "Tiếp tục" (sang kịch bản tiếp theo hoặc kết thúc trò chơi)
  document.getElementById('nextScenarioBtn').addEventListener('click', () => {
    playSound('pop');
    document.getElementById('resultModal').classList.add('hidden');
    clearFeedbackEffects();
    stopSpeechPlayback();

    commitScenarioResult(); // Cộng điểm, sao, số câu đúng sai
    
    // Nếu hết kịch bản thì hiển thị màn hình kết thúc, ngược lại tải kịch bản tiếp
    if (currentScenarioIndex + 1 >= SCENARIOS.length) {
      showEndgame();
    } else {
      loadScenario(currentScenarioIndex + 1);
    }
  });

  // ── Nút "Chơi lại từ đầu" ở màn hình kết thúc (Endgame)
  document.getElementById('restartGameBtn').addEventListener('click', () => {
    playSound('pop');
    document.getElementById('endgameModal').classList.add('hidden');
    clearFeedbackEffects();
    totalStars = 0;
    sessionCorrectCount = 0;
    sessionWrongCount = 0;
    document.getElementById('starCounter').innerText = totalStars;
    document.getElementById('correctCount').innerText = sessionCorrectCount;
    document.getElementById('wrongCount').innerText = sessionWrongCount;
    
    // Tải lại kịch bản đầu tiên
    loadScenario(0);
  });

  // ── Khởi chạy game! (Bắt đầu với kịch bản đầu tiên)
  loadScenario(0);
});

/* ══════════════════════════════════════════
   ENDGAME
   (Xử lý màn hình kết thúc trò chơi)
   ══════════════════════════════════════════ */

// Hàm showEndgame: Hiển thị hộp thoại tổng kết cuối trò chơi (số sao, số câu đúng/sai).
function showEndgame() {
  document.getElementById('endCorrect').innerText = sessionCorrectCount;
  document.getElementById('endWrong').innerText = sessionWrongCount;
  document.getElementById('endStars').innerText = totalStars;
  
  document.getElementById('endgameModal').classList.remove('hidden');
  playSound('win');
  speakText("Chúc mừng bé đã hoàn thành tất cả các tình huống. Bé giỏi lắm!");
}

// Hàm commitScenarioResult: Cập nhật biến tổng điểm (số sao, số câu đúng/sai) dựa trên kết quả kịch bản vừa rồi, và cập nhật lên giao diện.
function commitScenarioResult() {
  if (!pendingScenarioResult) return;
  if (pendingScenarioResult.isSafe) {
    totalStars += pendingScenarioResult.stars;
    sessionCorrectCount++;
  } else {
    sessionWrongCount++;
  }
  document.getElementById('starCounter').innerText = totalStars;
  document.getElementById('correctCount').innerText = sessionCorrectCount;
  document.getElementById('wrongCount').innerText = sessionWrongCount;
  pendingScenarioResult = null;
}