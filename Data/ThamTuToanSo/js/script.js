// =============================================
// THÁM TỬ AN TOÀN SỐ - Game Logic
// =============================================

let gameData         = null;
let currentScenarios = [];
let currentIndex     = 0;
let score            = 0;
let correctCount     = 0;
let wrongCount       = 0;

// Preload âm thanh
const audioAssets = {
    'correct': new Audio('assets/audio/correct.m4a'),
    'wrong': new Audio('assets/audio/incorrect.m4a'),
    'click': new Audio('assets/audio/click.m4a'),
    'message': new Audio('assets/audio/mess_sound.mp3'),
};

function playSound(type) {
    const sound = audioAssets[type];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.error("Không thể phát âm thanh:", e));
    }
}

// --- Tải dữ liệu từ data.json (ngầm, không hiển thị gì lên màn start) ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('data/data.json');
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        gameData = await res.json();
        // Cập nhật tên AI trên header game
        const aiCharEl = document.querySelector('.header-title');
        if (aiCharEl) aiCharEl.textContent = gameData.aiCharacter;
        // Điền danh sách nhiệm vụ
        const missionList = document.getElementById('mission-list');
        if (missionList && gameData.missions) {
            missionList.innerHTML = '';
            gameData.missions.forEach(m => {
                const li = document.createElement('li');
                li.textContent = m;
                missionList.appendChild(li);
            });
        }
    } catch (e) {
        console.error('Lỗi tải data.json:', e);
        alert('⚠️ Không tải được dữ liệu! Vui lòng chạy qua local server.');
    }
});

// --- Bắt đầu game – đọc lớp từ combobox ---
function startGame() {
    if (!gameData) return alert('Dữ liệu chưa tải xong, hãy thử lại!');

    const gradeId   = document.getElementById('grade-combo').value;
    const gradeData = gameData.grades.find(g => g.Id === gradeId);
    if (!gradeData) return;

    currentScenarios = [...gradeData.scenarios];
    shuffleArray(currentScenarios);
    currentIndex  = 0;
    score         = 0;
    correctCount  = 0;
    wrongCount    = 0;

    // Cập nhật header game
    document.getElementById('grade-label').textContent =
        `${gradeData.label} – ${gradeData.topic}`;

    updateScoreUI();
    updateProgressUI();
    updateStatUI();

    switchScreen('start-screen', 'chat-screen');
    showScenario(currentIndex);
}

// --- Hiển thị tình huống ---
function showScenario(index) {
    const scenario = currentScenarios[index];
    const bubble   = document.getElementById('scenario-bubble');

    bubble.style.transition = 'none';
    bubble.style.opacity    = '1';
    bubble.style.transform  = 'translateY(0)';
    
    // Hiển thị ... đang gõ bên trong bong bóng
    bubble.innerHTML = `
        <div class="typing-dots-inline">
            <span></span><span></span><span></span>
        </div>
    `;

    setTimeout(() => {
        bubble.textContent = scenario.text;
        // Thêm hiệu ứng nhẹ khi chữ hiện ra
        bubble.style.opacity = '0.5';
        playSound('message');
        setTimeout(() => {
            bubble.style.transition = 'opacity 0.4s';
            bubble.style.opacity    = '1';
        }, 50);
        scrollChatToBottom();
    }, 1500); // 1.5 giây giả lập "đang gõ"

    updateProgressUI();
    setBtnsDisabled(false);
}

// --- Xử lý khi bấm nút ---
function handleChoice(action) {
    setBtnsDisabled(true);

    const scenario  = currentScenarios[currentIndex];
    const isCorrect = (action === scenario.correctAction);
    const btn = action === 'green' ? document.getElementById('btn-green') : document.getElementById('btn-red');

    if (isCorrect) { 
        score += 10; 
        correctCount++; 
    } else { 
        wrongCount++; 
    }

    updateScoreUI();
    updateStatUI();

    showFeedback(isCorrect, scenario.feedback[action]);
}

// --- Popup phản hồi ---
function showFeedback(isCorrect, feedbackText) {
    const overlay = document.getElementById('feedback-overlay');
    const icon    = document.getElementById('feedback-icon');
    const title   = document.getElementById('feedback-title');
    const text    = document.getElementById('feedback-text');

    if (isCorrect) {
        icon.src  = 'assets/images/Robot_happy.jpg';
        title.textContent = 'Tuyệt vời! Đúng rồi!';
        title.style.color = '#16a34a';
        playSound('correct');

    } else {
        icon.src  = 'assets/images/Robot_buon.jpg';
        title.textContent = 'Chưa đúng, thử lại nhé!';
        title.style.color = '#dc2626';
        playSound('wrong');
    }

    text.innerHTML = `<strong style="color: #4f46e5;">💡 Lời khuyên của Vệ Sĩ AI:</strong><br><br>${feedbackText}`;
    overlay.classList.remove('hidden');
}

// --- Câu tiếp theo ---
function nextScenario() {
    document.getElementById('feedback-overlay').classList.add('hidden');
    currentIndex++;

    if (currentIndex >= currentScenarios.length) {
        showEndScreen();
    } else {
        showScenario(currentIndex);
    }
}

// --- Màn hình kết thúc ---
function showEndScreen() {

    playSound('finish'); // Hãy chắc chắn bạn đã load 'finish' audio nếu cần
    const total = currentScenarios.length;
    const pct   = Math.round((correctCount / total) * 100);

    document.getElementById('end-score-display').textContent = score;
    document.getElementById('end-message').textContent =
        `Con đã trả lời đúng ${correctCount}/${total} câu (${pct}%)!`;

    const badgeEl = document.getElementById('end-badge');
    if (pct === 100)    badgeEl.textContent = '🥇 Thám tử xuất sắc!';
    else if (pct >= 70) badgeEl.textContent = '🥈 Thám tử can đảm!';
    else                badgeEl.textContent = '🥉 Thám tử tập sự – Cố lên!';

    document.getElementById('end-overlay').classList.remove('hidden');

}

// --- Chơi lại ---
function replayGame() {
    document.getElementById('end-overlay').classList.add('hidden');
    startGame();
}

// --- Về trang chủ ---
function goBack() {
    document.getElementById('end-overlay').classList.add('hidden');
    document.getElementById('feedback-overlay').classList.add('hidden');
    switchScreen('chat-screen', 'start-screen');
}

// =============================================
// HÀM HỖ TRỢ
// =============================================
function switchScreen(fromId, toId) {
    document.getElementById(fromId).classList.remove('active');
    document.getElementById(toId).classList.add('active');
}

function setBtnsDisabled(disabled) {
    ['btn-green','btn-red'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled      = disabled;
            btn.style.opacity = disabled ? '0.6' : '1';
        }
    });
}

function updateScoreUI() { 
    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) scoreDisplay.textContent = score; 
}
function updateStatUI()    {
    const correctEl = document.getElementById('correct-count');
    const wrongEl = document.getElementById('wrong-count');
    if (correctEl) correctEl.textContent = correctCount;
    if (wrongEl) wrongEl.textContent   = wrongCount;
}
function updateProgressUI() {
    const total = currentScenarios.length;
    const pct   = total > 0 ? Math.round((currentIndex / total) * 100) : 0;
    
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressText) progressText.textContent  = `${currentIndex} / ${total}`;
    if (progressFill) progressFill.style.width  = pct + '%';
}

function scrollChatToBottom() {
    const cb = document.getElementById('chat-box');
    if (cb) cb.scrollTop = cb.scrollHeight;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}