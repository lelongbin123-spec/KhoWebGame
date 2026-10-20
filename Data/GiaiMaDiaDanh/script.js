// ============================================================
// DỮ LIỆU VÀ TRẠNG THÁI TRÒ CHƠI
// ============================================================
// Mảng này được đổ dữ liệu từ data.json khi trang hoàn tất tải.
// Dùng mảng dùng chung để các hàm xử lý trạm có thể truy cập dữ liệu.
const STATIONS_DATA = [];

// Lưu sẵn các phần tử DOM thường dùng để tránh gọi getElementById nhiều lần.
const elements = {
    modal: document.getElementById('modal-overlay'),
    title: document.getElementById('modal-title'),
    question: document.getElementById('question-text'),
    hint1: document.getElementById('hint-1-text'),
    hint2: document.getElementById('hint-2'),
    input: document.getElementById('answer-input'),
    inputContainer: document.getElementById('input-container'),
    victory: document.getElementById('victory-badge'),
    feedback: document.getElementById('ai-feedback'),
    message: document.getElementById('ai-message'),
    icon: document.getElementById('ai-icon'),
    unlockedCount: document.getElementById('unlocked-count'),
    totalScore: document.getElementById('total-score'),
    hint1Card: document.getElementById('hint-1'),
    failure: document.getElementById('failure-badge'),
    timer: document.getElementById('game-timer'),
    headerReplay: document.getElementById('header-replay-button'),
    endGame: document.getElementById('end-game-overlay'),
    finalTime: document.getElementById('final-time'),
    finalScore: document.getElementById('final-score'),
    endGameEyebrow: document.getElementById('end-game-eyebrow'),
    endGameTitle: document.getElementById('end-game-title'),
    endGameMessage: document.getElementById('end-game-message'),
    mapStage: document.querySelector('.map-stage')
};

// Trạm đang mở trong modal và tổng số trạm đã được giải.
let currentStationIndex = null;
let totalUnlocked = 0;
let totalScore = 0;
let gameStartedAt = null;
let timerInterval = null;
const GAME_SOUNDS = {
    correct: new Audio('Media/correct.m4a'),
    wrong: new Audio('Media/incorrect.m4a'),
    endSuccess: new Audio('Media/finish.m4a'),
    endIncomplete: new Audio('Media/finish.m4a')
};

function playGameSound(type) {
    const audio = GAME_SOUNDS[type];
    if (!audio) return;
    try {
        audio.pause();
        audio.currentTime = 0;
        const playback = audio.play();
        if (playback?.catch) playback.catch(() => {});
    } catch (error) {
        // Audio playback is optional; a missing or blocked file should not interrupt play.
    }
}

Object.values(GAME_SOUNDS).forEach(audio => { audio.preload = 'auto'; });

function formatElapsedTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
        ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateGameTimer() {
    if (gameStartedAt === null) return;
    const elapsedSeconds = Math.floor((Date.now() - gameStartedAt) / 1000);
    elements.timer.textContent = formatElapsedTime(elapsedSeconds);
}

function startGameTimer() {
    if (gameStartedAt !== null || totalUnlocked === STATIONS_DATA.length) return;
    gameStartedAt = Date.now();
    updateGameTimer();
    timerInterval = setInterval(updateGameTimer, 1000);
}

function stopGameTimer() {
    updateGameTimer();
    clearInterval(timerInterval);
    timerInterval = null;
}

function createLighthousePin(station, index) {
    const pin = document.createElement('button');
    pin.className = 'lighthouse-pin';
    pin.id = `pin-${station.id}`;
    pin.type = 'button';
    pin.setAttribute('aria-label', 'Mở câu đố địa danh trên bản đồ');
    pin.setAttribute('aria-pressed', 'false');
    pin.style.left = station.lighthouse.position.left;
    pin.style.top = station.lighthouse.position.top;
    pin.addEventListener('click', () => openStation(index));

    const icon = document.createElement('img');
    icon.className = 'pin-icon';
    icon.src = 'Img/Icon_haidang.png';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    pin.append(icon);
    elements.mapStage.appendChild(pin);
    return pin;
}

// ============================================================
// TẢI DỮ LIỆU TRẠM
// ============================================================
// Đọc danh sách địa danh từ file JSON, sau đó đồng bộ điểm số
// và trạng thái các ngọn hải đăng đã được mở khóa trên bản đồ.
async function loadStations() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const rawStations = await response.json();
        const stations = rawStations.map(station => ({
            ...station,
            id: station.id ?? station.Id,
            title: station.title ?? station.type,
            question: station.question ?? station.Text
        }));
        STATIONS_DATA.push(...stations);
        const pins = stations.map(createLighthousePin);
        totalUnlocked = stations.filter(station => station.unlocked).length;
        totalScore = stations.length - stations.filter(station => station.failed).length;
        elements.unlockedCount.textContent = totalUnlocked;
        elements.totalScore.textContent = totalScore;

        // Khôi phục trạng thái sáng cho các pin đã mở khóa từ dữ liệu ban đầu.
        stations.forEach((station, index) => {
            if (station.unlocked) pins[index].classList.add('unlocked');
        });
    } catch (error) {
        console.error('Không thể tải dữ liệu trạm:', error);
    }
}

// ============================================================
// CHUẨN HÓA VÀ SO SÁNH CÂU TRẢ LỜI
// ============================================================
// Đưa câu trả lời về cùng một dạng: chữ thường, bỏ dấu tiếng Việt,
// bỏ ký tự đặc biệt và xóa khoảng trắng thừa ở hai đầu.
function normalizeText(text) {
    return text.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

// Tính số thao tác ít nhất để biến chuỗi thứ nhất thành chuỗi thứ hai.
// Kết quả nhỏ giúp nhận diện trường hợp người chơi gõ sai chính tả nhẹ.
function getLevenshteinDistance(first, second) {
    const rows = Array.from({ length: second.length + 1 }, (_, index) => [index]);
    for (let column = 0; column <= first.length; column++) rows[0][column] = column;

    for (let row = 1; row <= second.length; row++) {
        for (let column = 1; column <= first.length; column++) {
            rows[row][column] = second[row - 1] === first[column - 1]
                ? rows[row - 1][column - 1]
                : Math.min(
                    rows[row - 1][column - 1] + 1,
                    rows[row][column - 1] + 1,
                    rows[row - 1][column] + 1
                );
        }
    }
    return rows[second.length][first.length];
}

// Chấm câu trả lời theo thứ tự: rỗng, đúng hoàn toàn, từ đồng nghĩa,
// chứa từ khóa, gần đúng do sai chính tả, rồi mới kết luận là sai.
function analyzeAnswerWithAI(userInput, station) {
    const answer = normalizeText(userInput);
    const primaryAnswer = normalizeText(station.primaryAnswer);

    if (!answer) return { status: 'EMPTY', message: 'Bạn chưa nhập câu trả lời kìa!' };
    if (answer === primaryAnswer) return { status: 'CORRECT', message: 'Tuyệt vời! Đáp án hoàn toàn chính xác!' };

    if (station.synonyms.some(synonym => answer === normalizeText(synonym))) {
        return {
            status: 'CORRECT_SYNONYM',
            message: `Chính xác! **${userInput}** cũng chính là **${station.primaryAnswer}**!`
        };
    }

    if (station.keywords.some(keyword => answer.includes(normalizeText(keyword)))) {
        return { status: 'CORRECT', message: `Chính xác! Đáp án chuẩn là **${station.primaryAnswer}**.` };
    }

    if (answer.length > 3 && getLevenshteinDistance(answer, primaryAnswer) <= 2) {
        return {
            status: 'NEARLY_CORRECT',
            message: `Gần đúng rồi! Có vẻ bạn bị gõ nhầm một chút chính tả. Hãy thử lại xem: "${station.primaryAnswer}"`
        };
    }

    return { status: 'WRONG', message: 'Chưa chính xác rồi. Bạn hãy đọc kĩ lại gợi ý và thử lại nhé!' };
}

// ============================================================
// ĐIỀU KHIỂN MODAL VÀ NHẬP CÂU TRẢ LỜI
// ============================================================
// Mở thông tin của một trạm, làm mới ô nhập và hiển thị đúng trạng thái
// câu hỏi hoặc chiến thắng dựa trên dữ liệu hiện tại của trạm.
function openStation(index) {
    const station = STATIONS_DATA[index];
    if (!station) return;

    if (!station.unlocked && !station.failed) startGameTimer();
    document.querySelector('.lighthouse-pin.selected')?.classList.remove('selected');
    document.querySelector('.lighthouse-pin[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
    const selectedPin = document.getElementById(`pin-${station.id}`);
    selectedPin?.classList.add('selected');
    selectedPin?.setAttribute('aria-pressed', 'true');
    currentStationIndex = index;
    elements.title.textContent = station.unlocked ? `📍 ${station.title}` : '📍 ĐỊA DANH BÍ ẨN';
    elements.question.textContent = station.question;
    elements.hint1.textContent = station.hint1;
    elements.input.value = '';
    hideAIFeedback();
    if (station.failed) showFailureState();
    else if (station.unlocked) showVictoryState();
    else showQuestionState();
    updateHint2Status(station);
    elements.modal.classList.add('active');
}

// Đóng cửa sổ thông tin trạm.
function closeModal() {
    elements.modal.classList.remove('active');
    const selectedPin = document.getElementById(`pin-${STATIONS_DATA[currentStationIndex]?.id}`);
    selectedPin?.classList.remove('selected');
    selectedPin?.setAttribute('aria-pressed', 'false');
}

// Cho phép nhấn Enter thay cho nút Gửi trong form trả lời.
function handleKeyPress(event) {
    if (event.key === 'Enter') submitAnswer();
}

// Xử lý một lần trả lời của người chơi: chấm điểm, cập nhật số lần sai,
// bật đèn trên bản đồ và chuyển sang màn hình chiến thắng nếu đúng.
function submitAnswer() {
    const station = STATIONS_DATA[currentStationIndex];
    if (!station || station.unlocked || station.failed) return;

    const result = analyzeAnswerWithAI(elements.input.value, station);
    const isCorrect = result.status === 'CORRECT' || result.status === 'CORRECT_SYNONYM';

    if (isCorrect) {
        playGameSound('correct');
        station.unlocked = true;
        elements.title.textContent = `📍 ${station.title}`;
        totalUnlocked++;
        elements.unlockedCount.textContent = totalUnlocked;
        document.getElementById(`pin-${station.id}`)?.classList.add('unlocked');
        const gameResolved = STATIONS_DATA.every(item => item.unlocked || item.failed);
        if (gameResolved) stopGameTimer();
        showAIFeedback(result.message, 'success', '🎉');
        setTimeout(() => {
            if (gameResolved) {
                showEndGame();
            } else if (currentStationIndex === STATIONS_DATA.indexOf(station) && elements.modal.classList.contains('active')) {
                showVictoryState();
            }
        }, 1000);
        return;
    }

    if (result.status === 'EMPTY') {
        showAIFeedback(result.message, 'info', 'ℹ️');
        return;
    }

    playGameSound('wrong');
    station.attempts++;
    // Mỗi loại kết quả dùng màu và biểu tượng khác nhau để người chơi
    // nhận biết nhanh trạng thái câu trả lời.
    const feedback = {
        NEARLY_CORRECT: ['warning', '💡'],
        WRONG: ['warning', '🤖']
    }[result.status];
    showAIFeedback(result.message, feedback[0], feedback[1]);
    updateHint2Status(station);

    if (station.attempts >= 3) {
        station.failed = true;
        totalScore = Math.max(0, totalScore - 1);
        elements.totalScore.textContent = totalScore;
        document.getElementById(`pin-${station.id}`)?.classList.add('failed');
        elements.message.textContent = 'Em đã trả lời sai 3 lần. Trạm này chưa được giải và bị trừ 1 điểm.';
        showFailureState();

        if (STATIONS_DATA.every(item => item.unlocked || item.failed)) {
            stopGameTimer();
            setTimeout(showEndGame, 1000);
        }
    }
}

function showEndGame() {
    closeModal();
    const allLighthousesLit = STATIONS_DATA.every(station => station.unlocked);
    elements.endGameEyebrow.textContent = allLighthousesLit ? 'NHIỆM VỤ HOÀN THÀNH' : 'ĐÃ KẾT THÚC LƯỢT CHƠI';
    elements.endGameTitle.textContent = allLighthousesLit ? 'Tất cả hải đăng đã sáng!' : 'Lượt chơi đã kết thúc';
    elements.endGameMessage.textContent = allLighthousesLit
        ? `Chúc mừng em đã giải mã thành công cả ${STATIONS_DATA.length} địa danh Việt Nam.`
        : `Em đã giải được ${totalUnlocked}/${STATIONS_DATA.length} trạm. Hãy chơi lại để thắp sáng các hải đăng còn lại!`;
    elements.finalScore.textContent = `${totalScore}/${STATIONS_DATA.length}`;
    elements.endGame.classList.add('active');
    elements.endGame.setAttribute('aria-hidden', 'false');
    elements.finalTime.textContent = elements.timer.textContent;
    elements.endGame.querySelector('.end-game-button:not(.secondary)').focus();
    requestAnimationFrame(() => playGameSound(allLighthousesLit ? 'endSuccess' : 'endIncomplete'));
}

function closeEndGame() {
    elements.endGame.classList.remove('active');
    elements.endGame.setAttribute('aria-hidden', 'true');
    if (STATIONS_DATA.length && STATIONS_DATA.every(station => station.unlocked || station.failed)) {
        elements.headerReplay.hidden = false;
    }
}

function restartGame() {
    clearInterval(timerInterval);
    timerInterval = null;
    gameStartedAt = null;
    totalUnlocked = 0;
    currentStationIndex = null;

    STATIONS_DATA.forEach(station => {
        station.unlocked = false;
        station.failed = false;
        station.attempts = 0;
        const pin = document.getElementById(`pin-${station.id}`);
        pin?.classList.remove('unlocked', 'selected', 'failed');
        pin?.setAttribute('aria-pressed', 'false');
    });

    elements.unlockedCount.textContent = '0';
    totalScore = STATIONS_DATA.length;
    elements.totalScore.textContent = totalScore;
    elements.timer.textContent = '00:00';
    elements.input.value = '';
    elements.hint1Card.classList.add('hidden');
    elements.hint2.classList.add('hidden');
    hideAIFeedback();
    showQuestionState();
    elements.modal.classList.remove('active');
    elements.headerReplay.hidden = true;
    closeEndGame();
}

// Hiển thị hoặc khóa mảnh ghép thứ hai theo số lần trả lời sai.
function updateHint2Status(station) {
    elements.hint1Card.classList.toggle('hidden', station.attempts < 1);
    if (station.attempts >= 2) {
        elements.hint2.classList.remove('hidden', 'locked');
        elements.hint2.innerHTML = `💡 <b>Gợi ý 2:</b> <span>${station.hint2}</span>`;
        return;
    }

    elements.hint2.classList.add('hidden');
}

// Hiển thị thông báo kết quả với kiểu màu và biểu tượng tương ứng.
function showAIFeedback(message, type, icon) {
    elements.feedback.className = `ai-feedback active ${type}`;
    elements.message.textContent = message;
    elements.icon.textContent = icon;
}

// Ẩn thông báo cũ khi người chơi mở một trạm mới.
function hideAIFeedback() {
    elements.feedback.className = 'ai-feedback';
}

// Chuyển modal sang trạng thái đã giải đúng.
function showVictoryState() {
    elements.inputContainer.style.display = 'none';
    elements.victory.style.display = 'block';
    elements.failure.style.display = 'none';
}

// Chuyển modal về trạng thái cho phép nhập câu trả lời.
function showQuestionState() {
    elements.inputContainer.style.display = 'flex';
    elements.victory.style.display = 'none';
    elements.failure.style.display = 'none';
}

function showFailureState() {
    elements.inputContainer.style.display = 'none';
    elements.victory.style.display = 'none';
    elements.failure.style.display = 'block';
}

// Khởi động việc tải dữ liệu ngay sau khi script được thực thi.
loadStations();
