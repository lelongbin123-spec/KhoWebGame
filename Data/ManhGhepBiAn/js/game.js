(async function () {
  // Chữ hiển thị của giao diện được giữ trong JS, tách khỏi nội dung câu hỏi.
  const ui = {
    loadTitle: 'Không tải được dữ liệu trò chơi',
    loadMessage: 'Hãy mở trò chơi qua máy chủ web để tải được data/data.json.',
    initTitle: 'Không thể khởi tạo trò chơi',
    initMessage: 'Vui lòng kiểm tra định dạng dữ liệu trong data/data.json.',
    noHighScore: '—',
    startCaption: 'Hãy mở các mảnh ghép để khám phá bức tranh!',
    openedCaption: 'Bức tranh đã được hé lộ. Con đoán ra từ khóa chưa?',
    solvedCaption: 'Tuyệt vời! Con đã khám phá bức tranh bí ẩn!',
    chooseAnswer: 'Con hãy chọn một đáp án nhé.',
    wrongAnswer: 'Chưa đúng rồi, con thử suy nghĩ thêm nhé!',
    emptyGuess: 'Con hãy nhập từ khóa trước nhé.',
    wrongGuess: 'Chưa phải từ khóa này. Con hãy xem gợi ý nhé!',
    winEarly: 'Đoán đúng từ khóa sớm! Điểm thưởng còn lại đã được cộng vào tổng điểm.',
    winComplete: 'Con đã khám phá xong bức tranh bí ẩn!',
    started: 'Bắt đầu thôi! Hãy chọn một mảnh ghép để khám phá.',
    questionCount: (number, total) => `Câu hỏi ${number} / ${total}`,
    tileLabel: (number, subject) => `Mảnh ghép ${number}: ${subject}`
  };

  // Tải dữ liệu trò chơi từ tệp JSON trước khi khởi tạo bàn chơi.
  let gameData;
  try {
    const response = await fetch('data/data_offline.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    gameData = await response.json();
  } catch (error) {
    console.error('Could not load data/data.json:', error);
    const title = document.querySelector('.ready-card h2');
    const message = document.querySelector('.ready-card p');
    if (title) title.textContent = ui.loadTitle;
    if (message) message.textContent = ui.loadMessage;
    return;
  }

  const keyword = gameData.keyword;
  const letters = [...keyword.replace(/\s/g, '')];
  // JSON chứa câu hỏi trong "data" và thông tin tên/nhãn/biểu tượng trong "subjects".
  const questions = gameData.data;
  const subjects = gameData.subjects;
  const tilesEl = document.querySelector('#tiles');
  const scene = document.querySelector('#scene');
  const modal = document.querySelector('#quiz-modal');
  const guessModal = document.querySelector('#guess-modal');
  const startButton = document.querySelector('#start-game');
  let opened = new Set();
  let currentTile = null;
  let selected = null;
  let solved = false;
  let started = false;
  let guessCount = 0;
  // Điểm thưởng từ khóa giảm dần sau khi trả lời đúng câu thứ hai trở đi.
  let keyScore = 100;

  // Đọc và cập nhật điểm cao; trò chơi vẫn chạy nếu trình duyệt chặn localStorage.
  function getHighScore() {
    try { return Number(localStorage.getItem('mgb-high-score')) || 0; }
    catch { return 0; }
  }

  function setHighScore(score) {
    try { localStorage.setItem('mgb-high-score', String(score)); }
    catch { /* Lưu điểm cao là tùy chọn. */ }
  }

  // Cập nhật số câu đã mở và thanh tiến độ theo tổng số câu trong JSON.
  function updateProgress() {
    const count = opened.size;
    const total = questions.length;
    document.querySelector('#correct-count').textContent = String(count);
    document.querySelector('#progress-label').textContent = `${count}/${total}`;
    document.querySelector('#progress').style.width = `${count / total * 100}%`;
  }

  function buildBoard() {
    tilesEl.replaceChildren();
    // Mỗi câu hỏi tạo một khối; chia lưới cân bằng và kéo giãn hàng cuối khi cần.
    const rows = Math.max(1, Math.floor(Math.sqrt(questions.length)));
    const columns = Math.ceil(questions.length / rows);
    const remainder = questions.length % columns;
    tilesEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    tilesEl.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    tilesEl.style.setProperty('--tile-last-span', String(
      remainder === 0 ? 1 : columns - remainder + 1
    ));
    questions.forEach((question, index) => {
      const subject = subjects[question.subject];
      if (!subject) throw new Error(`Unknown subject: ${question.subject}`);
      const tile = document.createElement('button');
      const icon = document.createElement('span');
      const label = document.createElement('b');
      tile.type = 'button';
      tile.className = `tile tile--${question.subject}`;
      tile.dataset.index = String(index);
      tile.setAttribute('aria-label', ui.tileLabel(index + 1, subject.label));
      icon.className = 'tile-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = subject.icon;
      label.textContent = subject.label;
      tile.append(icon, label);
      tile.addEventListener('click', () => openQuestion(index));
      tilesEl.append(tile);
    });
    document.querySelector('#letters').innerHTML = letters
      .map((_, index) => `<span class="letter-slot blank" data-letter="${index}"></span>`)
      .join('');
  }

  // Đưa trò chơi, điểm và gợi ý về trạng thái ban đầu.
  function resetGame() {
    opened = new Set();
    currentTile = null;
    selected = null;
    solved = false;
    started = false;
    guessCount = 0;
    keyScore = 100;
    modal.hidden = true;
    guessModal.hidden = true;
    document.querySelector('#guess-input').value = '';
    document.querySelector('#guess-feedback').textContent = '';
    document.querySelector('#guess-hint').textContent = gameData.hints.initial;
    document.querySelector('#ai-hint').textContent = gameData.hints.initial;
    document.querySelector('#win-toast').hidden = true;
    document.querySelector('#ready-overlay').hidden = false;
    document.querySelector('#scene-caption').textContent = ui.startCaption;
    document.querySelector('#start-label').textContent = 'Bắt đầu';
    document.querySelector('#score').textContent = '0';
    document.querySelector('#high-score').textContent = getHighScore() || ui.noHighScore;
    scene.classList.remove('revealed');
    buildBoard();
    updateProgress();
  }

  function openQuestion(index) {
    if (!started || opened.has(index) || solved) return;
    currentTile = index;
    selected = null;
    const question = questions[index];
    const subject = subjects[question.subject];
    document.querySelector('#modal-icon').textContent = subject.icon;
    document.querySelector('#modal-subject').textContent = subject.name;
    document.querySelector('#question-count').textContent = ui.questionCount(index + 1, questions.length);
    document.querySelector('#question-title').textContent = question.text;
    const answerType = question.answerType || 'choice';
    const modeLabel = document.querySelector('#answer-mode');
    modeLabel.textContent = answerType === 'text' ? 'Gõ câu trả lời' : 'Chọn một đáp án';
    const feedback = document.querySelector('#feedback');
    feedback.textContent = '';
    feedback.className = 'feedback';
    const answerArea = document.querySelector('#answer-area');
    answerArea.replaceChildren();
    // answerType trong JSON quyết định hiển thị lựa chọn hay ô nhập câu trả lời.
    if (answerType === 'text') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'answer-input';
      input.id = 'short-answer';
      input.autocomplete = 'off';
      input.placeholder = 'Gõ câu trả lời của con';
      input.setAttribute('aria-label', 'Gõ câu trả lời');
      input.addEventListener('input', () => { selected = input.value.trim(); });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          acceptAnswer();
        }
      });
      answerArea.append(input);
    } else {
      question.options.forEach((option, optionIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'answer-option';
        button.textContent = `${String.fromCharCode(65 + optionIndex)}. ${option}`;
        button.addEventListener('click', () => {
          answerArea.querySelectorAll('.answer-option').forEach(item => item.classList.remove('selected'));
          button.classList.add('selected');
          selected = optionIndex;
        });
        answerArea.append(button);
      });
    }
    modal.hidden = false;
    (answerArea.querySelector('.answer-option') || answerArea.querySelector('.answer-input'))?.focus();
  }

  // Mở ngẫu nhiên một ô chữ sau khi học sinh trả lời đúng.
  function revealLetter() {
    const hiddenSlots = [...document.querySelectorAll('.letter-slot.blank')];
    if (!hiddenSlots.length) return;
    const slot = hiddenSlots[Math.floor(Math.random() * hiddenSlots.length)];
    const index = Number(slot.dataset.letter);
    slot.textContent = letters[index];
    slot.classList.remove('blank');
  }

  function acceptAnswer() {
    const feedback = document.querySelector('#feedback');
    const question = currentTile === null ? null : questions[currentTile];
    const answerType = question?.answerType || 'choice';
    if (currentTile === null || (answerType === 'choice' && selected === null)
      || (answerType === 'text' && !String(selected ?? '').trim())) {
      feedback.textContent = ui.chooseAnswer;
      return;
    }
    const isCorrect = answerType === 'text'
      ? normalize(selected) === normalize(question.answer)
      : selected === question.answer;
    if (!isCorrect) {
      feedback.textContent = ui.wrongAnswer;
      return;
    }
    modal.hidden = true;
    opened.add(currentTile);
    if (opened.size >= 2) keyScore = Math.floor(keyScore / 2);
    tilesEl.querySelector(`[data-index="${currentTile}"]`)?.classList.add('open');
    revealLetter();
    updateProgress();
    document.querySelector('#score').textContent = String(opened.size * 10);
    document.querySelector('#ai-hint').textContent = opened.size === 1
      ? gameData.hints.afterFirstReveal
      : opened.size >= 3 ? gameData.hints.afterSeveralReveals : gameData.hints.initial;
    if (opened.size === questions.length) {
      scene.classList.add('revealed');
      document.querySelector('#scene-caption').textContent = ui.openedCaption;
    }
  }

  // Chuẩn hóa để bỏ dấu, khoảng trắng và dấu câu khi so sánh đáp án gõ.
  // Chữ số được giữ lại để tránh nhận nhầm các đáp án số khác nhau.
  function normalize(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }

  // Mở toàn bộ tranh/chữ cái và tính điểm thưởng khi đoán đúng từ khóa.
  function solve(earlyGuess) {
    if (solved) return;
    solved = true;
    document.querySelectorAll('.letter-slot').forEach(slot => {
      const index = Number(slot.dataset.letter);
      slot.textContent = letters[index];
      slot.classList.remove('blank');
    });
    document.querySelectorAll('.tile').forEach(tile => tile.classList.add('open'));
    scene.classList.add('revealed');
    document.querySelector('#scene-caption').textContent = ui.solvedCaption;
    // Nếu đoán đúng ngay từ đầu, thưởng key_score cộng điểm của toàn bộ câu hỏi.
    // Nếu đã trả lời câu hỏi, cộng điểm câu đúng với key_score còn lại.
    const total = opened.size === 0
      ? keyScore + questions.length * 10
      : opened.size * 10 + keyScore;
    document.querySelector('#score').textContent = String(total);
    document.querySelector('#progress-label').textContent = `${questions.length}/${questions.length}`;
    document.querySelector('#progress').style.width = '100%';
    const highScore = Math.max(getHighScore(), total);
    setHighScore(highScore);
    document.querySelector('#high-score').textContent = String(highScore);
    document.querySelector('#ai-hint').textContent = gameData.hints.solved;
    modal.hidden = true;
    guessModal.hidden = true;
    document.querySelector('#win-copy').textContent = earlyGuess ? ui.winEarly : ui.winComplete;
    document.querySelector('#win-toast').hidden = false;
    setTimeout(() => { document.querySelector('#win-toast').hidden = true; }, 5000);
  }

  // Kiểm tra cấu trúc JSON trước khi dựng bàn chơi để báo lỗi dữ liệu rõ ràng.
  try {
    if (typeof keyword !== 'string' || !keyword.trim()
      || !Array.isArray(questions) || !questions.length
      || !gameData.hints?.initial || !subjects || typeof subjects !== 'object') {
      throw new Error('Missing keyword, subjects, questions, or hints in data/data.json');
    }
    questions.forEach((question, index) => {
      const subject = subjects[question.subject];
      const answerType = question.answerType || 'choice';
      const isChoiceValid = answerType === 'choice'
        && Array.isArray(question.options)
        && Number.isInteger(question.answer)
        && question.answer >= 0 && question.answer < question.options.length;
      const isTextValid = answerType === 'text'
        && typeof question.answer === 'string' && question.answer.trim().length > 0;
      if (!question.subject || !subject?.name || !subject?.label || !subject?.icon
        || !question.text || (!isChoiceValid && !isTextValid)) {
        throw new Error(`Invalid question data at index ${index}`);
      }
    });
    buildBoard();
  } catch (error) {
    console.error('Invalid game content:', error);
    const title = document.querySelector('.ready-card h2');
    const message = document.querySelector('.ready-card p');
    if (title) title.textContent = ui.initTitle;
    if (message) message.textContent = ui.initMessage;
    return;
  }

  document.querySelector('#high-score').textContent = getHighScore() || ui.noHighScore;
  updateProgress();
  document.querySelector('#scene-caption').textContent = ui.startCaption;
  document.querySelector('#guess-hint').textContent = gameData.hints.initial;
  document.querySelector('#ai-hint').textContent = gameData.hints.initial;

  // Nối các nút giao diện với thao tác bắt đầu, trả lời, đóng hộp thoại và đoán từ khóa.
  startButton.addEventListener('click', () => {
    if (started) return resetGame();
    started = true;
    document.querySelector('#ready-overlay').hidden = true;
    document.querySelector('#start-label').textContent = 'Chơi lại';
    document.querySelector('#ai-hint').textContent = ui.started;
  });
  document.querySelector('#check-answer').addEventListener('click', acceptAnswer);
  document.querySelector('#close-quiz').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
  document.querySelector('#guess-open').addEventListener('click', () => {
    if (!started || solved) return;
    document.querySelector('#guess-feedback').textContent = '';
    guessModal.hidden = false;
    document.querySelector('#guess-input').focus();
  });
  document.querySelector('#close-guess').addEventListener('click', () => { guessModal.hidden = true; });
  guessModal.addEventListener('click', event => { if (event.target === guessModal) guessModal.hidden = true; });
  document.querySelector('#guess-form').addEventListener('submit', event => {
    event.preventDefault();
    const guess = document.querySelector('#guess-input').value.trim();
    const feedback = document.querySelector('#guess-feedback');
    if (!guess) {
      feedback.textContent = ui.emptyGuess;
      return;
    }
    if (normalize(guess) === normalize(keyword)) {
      solve(opened.size < questions.length);
      return;
    }
    guessCount += 1;
    feedback.textContent = ui.wrongGuess;
    document.querySelector('#guess-hint').textContent = guessCount === 1
      ? gameData.hints.firstWrongGuess
      : gameData.hints.laterWrongGuess || gameData.hints.afterWrongGuess;
    document.querySelector('#ai-hint').textContent = gameData.hints.afterWrongGuess;
    document.querySelector('#guess-input').select();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      modal.hidden = true;
      guessModal.hidden = true;
    }
  });
})().catch(error => {
  console.error('Game initialization failed:', error);
  const title = document.querySelector('.ready-card h2');
  const message = document.querySelector('.ready-card p');
  if (title) title.textContent = 'Không thể khởi tạo trò chơi';
  if (message) message.textContent = 'Vui lòng kiểm tra định dạng dữ liệu trong data/data.json.';
});
