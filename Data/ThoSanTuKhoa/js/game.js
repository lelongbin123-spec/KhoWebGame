const wrongIndicator = document.getElementById('wrong-click-indicator');
const canvasWrapper = document.getElementById('canvas-wrapper');
const headerSection = document.getElementById('header-section');
const robotContainer = document.getElementById('robot-container');

let levelData = null;
let hintTimeout = null;
let currentQuestionItem = null;
let isGameStarted = false;

let timerInterval = null;
let secondsRemaining = 60;
let score = 0;

// Kích thước tự nhiên của ảnh nền – dùng để tính cover-transform chính xác
let bgImgW = 0;
let bgImgH = 0;


function getDialog(key, replacements = {}) {
    let text = "";
    if (levelData && levelData.robot_dialog && levelData.robot_dialog[key]) {
        text = levelData.robot_dialog[key];
    } else {
        const defaults = {
            wrong_item: "Đó là \"{clicked}\". Hãy tìm \"{target}\"!",
            wrong_background: "Sai rồi! Không có gì ở đó cả. Tìm lại nhé!",
            game_complete: "Tuyệt vời! Bạn đã hoàn thành xuất sắc!",
            next_question: "Hãy tìm cho tôi đồ vật \"{target}\" nhé!",
            correct_click: "Tuyệt vời! Bạn đã tìm đúng rồi!",
            already_found: "Bạn đã tìm thấy \"{clicked}\" rồi mà!",
            hint: "Gợi ý: Tìm đồ vật \"{target}\" ở quanh khu vực được phóng to nhé!"
        };
        text = defaults[key] || "";
    }
    
    for (const [k, v] of Object.entries(replacements)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

// Start Game Button Logic
document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('start-overlay').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('start-overlay').style.display = 'none';
    }, 500);
    isGameStarted = true;
    document.body.classList.add('hide-cursor');
    startTimer();
    pickNextQuestion();
});

// Custom Cursor & Click Ripple Logic
document.addEventListener('mousemove', (e) => {
    const cursor = document.getElementById('custom-cursor');
    if (cursor) {
        // Sử dụng transform (GPU) thay vì left/top (CPU) để con trỏ mượt mà tuyệt đối không bị khựng
        cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }
});

canvasWrapper.addEventListener('click', (e) => {
    // Ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);

    if (!isGameStarted) return;

    if (e.target === canvasWrapper) {
        if (currentQuestionItem) {
            updateRobotUI('wrong', getDialog('wrong_background'));
        }
        handleWrongClick(e.clientX, e.clientY);
    }
});

// Chọn câu hỏi tiếp theo
function pickNextQuestion() {
    const unfound = levelData.data.filter(obj => !obj.isFound);
    if (unfound.length === 0) {
        updateRobotUI('correct', getDialog('game_complete'));
        checkWin();
        return;
    }
    
    const idx = Math.floor(Math.random() * unfound.length);
    currentQuestionItem = unfound[idx];
    updateRobotUI('normal', getDialog('next_question', { target: currentQuestionItem.word.toUpperCase() }));
    speakWord(currentQuestionItem.word);
    resetHintTimer();
}

// Lấy dữ liệu
fetch('data/data.json')
    .then(response => response.json())
    .then(data => {
        levelData = data;

        // Áp dụng hình nền từ data.src (nếu có)
        const bgSrc = levelData.src || 'assets/images/BG.png';
        const canvasBg = document.getElementById('canvas-wrapper');
        if (canvasBg) {
            canvasBg.style.backgroundImage = `url('${bgSrc}')`;
        }

        // Khởi tạo trạng thái isFound cho tất cả đồ vật
        levelData.data.forEach(obj => obj.isFound = false);

        // Load ảnh nền để lấy kích thước tự nhiên → tính cover-transform chính xác
        const _bgLoader = new Image();
        _bgLoader.onload = function () {
            bgImgW = this.naturalWidth;
            bgImgH = this.naturalHeight;
            initGame();
        };
        _bgLoader.onerror = function () {
            initGame(); // fallback nếu không đọc được ảnh
        };
        _bgLoader.src = bgSrc;
    })
    .catch(err => {
        console.error('Lỗi tải data.json', err);
        alert('Không thể tải dữ liệu màn chơi. Vui lòng kiểm tra lại file data.json!');
    });


function updateScore() {
    document.getElementById('score').textContent = score;
    if (levelData && levelData.data) {
        document.getElementById('total-score').textContent = levelData.data.length;
    }
}

function updateTimer() {
    secondsRemaining--;
    document.getElementById('timer').textContent = secondsRemaining;
    
    const timerBox = document.querySelector('.timer-container');
    if (secondsRemaining <= 10 && secondsRemaining > 0) {
        if (timerBox) timerBox.classList.add('timer-warning');
    } else {
        if (timerBox) timerBox.classList.remove('timer-warning');
    }
    
    if (secondsRemaining <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        endGame(false);
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    secondsRemaining = 60;
    document.getElementById('timer').textContent = '60';
    
    const timerBox = document.querySelector('.timer-container');
    if (timerBox) timerBox.classList.remove('timer-warning');
    
    timerInterval = setInterval(updateTimer, 1000);
}



let robotTypingInterval = null;

function updateRobotUI(state, text) {
    const robotImg = document.getElementById('robot-img');
    const robotText = document.getElementById('robot-text');
    if(!robotImg || !robotText) return;
    
    robotText.className = state;
    robotText.innerHTML = '';
    
    if (robotTypingInterval) clearInterval(robotTypingInterval);
    
    const words = text.split(' ');
    let i = 0;
    robotTypingInterval = setInterval(() => {
        if (i < words.length) {
            robotText.innerHTML += (i > 0 ? ' ' : '') + words[i];
            i++;
        } else {
            clearInterval(robotTypingInterval);
        }
    }, 60); // 60ms cho mỗi từ
    
    robotImg.src = state === 'wrong' ? 'assets/images/Robot_buon.jpg' : 'assets/images/Robot_happy.jpg';
    
    robotImg.classList.remove('bounce');
    void robotImg.offsetWidth;
    robotImg.classList.add('bounce');
    setTimeout(() => robotImg.classList.remove('bounce'), 300);
}

function initGame(isReset = false) {
    score = 0;
    updateScore();
    
    // Clear old elements
    Array.from(canvasWrapper.children).forEach(child => {
        if (child.id !== 'wrong-click-indicator') {
            child.remove();
        }
    });
    
    // Clear inventory tray
    const tray = document.getElementById('inventory-tray');
    if (tray) tray.innerHTML = '';

    // Dùng kích thước thực của canvas game
    const cw = canvasWrapper.offsetWidth;
    const ch = canvasWrapper.offsetHeight;
    const topSafe = headerSection ? headerSection.offsetHeight + 20 : 100;
    const bottomSafe = robotContainer ? robotContainer.offsetHeight + 40 : 150;

    // Kích thước canvas editor từ JSON
    const editorW = levelData.editor_canvas_width  || cw;
    const editorH = levelData.editor_canvas_height || ch;

    // ── Cover-transform chính xác ──────────────────────────────────────────
    // background-size: cover scale ảnh sao cho cả 2 chiều >= kích thước container,
    // ảnh được căn giữa → có thể bị crop. Cần tính đúng để vị trí khớp ảnh nền.
    let cvtPos;   // (xe, ye) → {x, y} trong game canvas
    let sizeScale; // tỉ lệ scale đồng nhất (giữ đúng aspect ratio vật thể)

    if (bgImgW > 0 && bgImgH > 0) {
        // Cover scale factor cho mỗi canvas
        const s_e = Math.max(editorW / bgImgW, editorH / bgImgH);
        const s_g = Math.max(cw      / bgImgW, ch      / bgImgH);
        // Offset ảnh trong mỗi canvas (âm = ảnh bị crop ngoài viền)
        const ox_e = (editorW - bgImgW * s_e) / 2;
        const oy_e = (editorH - bgImgH * s_e) / 2;
        const ox_g = (cw      - bgImgW * s_g) / 2;
        const oy_g = (ch      - bgImgH * s_g) / 2;
        sizeScale = s_g / s_e; // tỉ lệ scale đồng nhất
        cvtPos = (xe, ye) => ({
            x: (xe - ox_e) / s_e * s_g + ox_g,
            y: (ye - oy_e) / s_e * s_g + oy_g
        });
    } else {
        // Fallback khi không load được ảnh: dùng scaleX đồng nhất
        const s = cw / editorW;
        sizeScale = s;
        cvtPos = (xe, ye) => ({ x: xe * s, y: ye * s });
    }

    levelData.data.forEach(obj => {
        const img = document.createElement('img');
        img.src = obj.imgSrc || obj.src;   // hỗ trợ cả hai field
        img.className = 'game-item';

        // Kích thước vật thể với tỉ lệ scale đồng nhất (giữ đúng aspect ratio)
        const w = obj.width  * sizeScale;
        const h = obj.height * sizeScale;

        if (obj.x_percent !== undefined && obj.y_percent !== undefined) {
            // Chuyển tọa độ editor (pixel) → game canvas qua cover-transform
            const xe = (obj.x_percent / 100) * editorW;
            const ye = (obj.y_percent / 100) * editorH;
            const { x, y } = cvtPos(xe, ye);
            obj.x = x;
            obj.y = y;
        } else {
            // Fallback: Random nếu không có vị trí cố định
            const maxLeft = Math.max(0, cw - w - 20);
            const maxTop  = Math.max(topSafe, ch - h - bottomSafe);
            obj.x = 10 + Math.random() * maxLeft;
            obj.y = topSafe + Math.random() * (maxTop - topSafe);
        }

        obj.w = w;
        obj.h = h;

        img.style.left   = obj.x + 'px';
        img.style.top    = obj.y + 'px';
        img.style.width  = w + 'px';
        img.style.height = h + 'px';
        
        obj.element = img;

        img.addEventListener('click', (e) => {
            e.stopPropagation(); // Ngăn sự kiện lan ra canvasWrapper (nhấp sai)
            if (!isGameStarted) return;

            if (obj.isFound) {
                updateRobotUI('normal', getDialog('already_found', { clicked: obj.word.toUpperCase() }));
                // Phát lại âm thanh từ vựng nếu muốn
                setTimeout(() => speakWord(obj.word), 0);
                return;
            }
            
            setTimeout(() => speakWord(obj.word), 0);
            
            if (obj === currentQuestionItem) {
                handleCorrectClick(obj, img);
            } else {
                updateRobotUI('wrong', getDialog('wrong_item', { 
                    clicked: obj.word.toUpperCase(), 
                    target: currentQuestionItem.word.toUpperCase() 
                }));
                handleWrongClick(e.clientX, e.clientY);
            }
        });
        
        canvasWrapper.appendChild(img);
    });

    if (isReset) {
        startTimer();
        pickNextQuestion();
    }
}

function handleCorrectClick(item, imgElement) {
    updateRobotUI('correct', getDialog('correct_click'));
    item.isFound = true;
    item.foundTime = performance.now();
    
    score++;
    updateScore();
    playSound('correct');
    
    // Đánh dấu đồ vật đã tìm thấy
    imgElement.classList.add('found');
    imgElement.classList.add('found-glowing');
    
    // Tạo 4 ngôi sao lấp lánh xung quanh đồ vật
    const rect = imgElement.getBoundingClientRect();
    for(let i = 0; i < 4; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'star-sparkle';
        
        // Phát tán ngôi sao ra 4 góc xung quanh đồ vật
        const offsetX = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 30 + 10);
        const offsetY = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 30 + 10);
        
        sparkle.style.left = (rect.left + rect.width / 2 + offsetX - 20) + 'px';
        sparkle.style.top = (rect.top + rect.height / 2 + offsetY - 20) + 'px';
        
        document.body.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 1000);
    }
    
    // Kích hoạt hiệu ứng thu thập đồ vật bay về góc trái dưới
    flyToInventory(item, imgElement);
    
    setTimeout(() => {
        imgElement.classList.remove('found-glowing');
        pickNextQuestion();
    }, 1500);
}

function flyToInventory(item, sourceImg) {
    // 1. Tạo hình ảnh clone để bay
    const clone = document.createElement('img');
    clone.src = sourceImg.src;
    const rect = sourceImg.getBoundingClientRect();
    
    clone.style.position = 'fixed';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.zIndex = '9999';
    clone.style.transition = 'all 1s cubic-bezier(0.25, 1, 0.5, 1)';
    clone.style.objectFit = 'contain';
    
    // Trạng thái ban đầu trước khi bay (để có thể animate)
    clone.style.transform = 'rotate(0deg)';
    clone.style.filter = 'drop-shadow(0 0 10px #ffeb3b) brightness(1)';
    document.body.appendChild(clone);
    
    // 2. Tạo khung hiển thị (slot) trong inventory (ẩn đi để giữ chỗ)
    const tray = document.getElementById('inventory-tray');
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.style.visibility = 'hidden';
    
    const slotImg = document.createElement('img');
    slotImg.src = item.imgSrc || item.src;
    const slotText = document.createElement('span');
    slotText.textContent = item.word;
    
    slot.appendChild(slotImg);
    slot.appendChild(slotText);
    tray.appendChild(slot);
    
    // 3. Chờ trình duyệt render xong slot để lấy tọa độ đích, sau đó cho clone bay tới
    requestAnimationFrame(() => {
        const targetRect = slotImg.getBoundingClientRect();
        
        // Cần delay 1 chút để transition kịp bắt giá trị ban đầu
        setTimeout(() => {
            clone.style.left = targetRect.left + 'px';
            clone.style.top = targetRect.top + 'px';
            clone.style.width = targetRect.width + 'px';
            clone.style.height = targetRect.height + 'px';
            // Hiệu ứng vật thể xoáy vòng và sáng chói khi đang bay
            clone.style.transform = 'rotate(720deg)';
            clone.style.filter = 'drop-shadow(0 0 30px #00ff00) brightness(1.5)';
        }, 50);
        
        // 4. Khi bay xong, hiện slot thật và xóa clone
        setTimeout(() => {
            clone.remove();
            slot.style.visibility = 'visible';
            slot.style.animation = 'popIn 0.3s forwards';
        }, 1050);
    });
}

function handleWrongClick(x, y) {
    playSound('wrong');
    wrongIndicator.style.left = `${x}px`;
    wrongIndicator.style.top = `${y}px`;
    
    wrongIndicator.classList.remove('shake-anim');
    void wrongIndicator.offsetWidth; 
    wrongIndicator.classList.add('shake-anim');
    
    setTimeout(() => {
        wrongIndicator.classList.remove('shake-anim');
        wrongIndicator.style.opacity = '0';
    }, 500);
}

// 6. AI Gợi ý & Phát âm
let lastSpokenWord = '';
let lastSpeakTime = 0;
let speechDebounceTimer = null;

function speakWord(word, force = false) {
    const now = Date.now();
    
    if (!force && word === lastSpokenWord && now - lastSpeakTime < 1000) {
        return;
    }

    // Xóa bộ đếm cũ nếu có lệnh đọc mới đến quá nhanh
    if (speechDebounceTimer) clearTimeout(speechDebounceTimer);
    
    // Đợi 50ms trước khi thực sự gọi API đọc giọng nói. 
    // Tránh việc lướt chuột qua 10 vật thể bị khựng máy 10 lần liên tục.
    speechDebounceTimer = setTimeout(() => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
            
            lastSpokenWord = word;
            lastSpeakTime = Date.now();
        }
    }, 50);
}

function resetHintTimer() {
    if (hintTimeout) clearTimeout(hintTimeout);
    const timeToHint = (levelData.ai_hint_time || 10) * 1000;
    
    hintTimeout = setTimeout(() => {
        if (currentQuestionItem && !currentQuestionItem.isFound) {
            showAIHint(currentQuestionItem);
        }
    }, timeToHint);
}

function showAIHint(item) {
    let cx = item.x + item.w / 2;
    let cy = item.y + item.h / 2;
    
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // 1. Tính khoảng cách cần dịch chuyển để vật thể nằm giữa tuyệt đối
    let tx = (vw / 2) - cx;
    let ty = (vh / 2) - cy;
    
    // 2. Thuật toán Scale Động: Tính mức zoom cần thiết để đưa vật ra giữa mà KHÔNG lộ viền
    let reqScaleX = Math.max(vw / (2 * cx), vw / (2 * (vw - cx)));
    let reqScaleY = Math.max(vh / (2 * cy), vh / (2 * (vh - cy)));
    let requiredScale = Math.max(reqScaleX, reqScaleY);
    
    // Giới hạn zoom từ 1.6x đến 3.0x theo như lựa chọn hợp lý nhất
    let scale = Math.max(1.6, Math.min(requiredScale, 3.0));
    
    // 3. Khóa lại tx, ty dựa trên Scale mới để đảm bảo tuyệt đối không hở viền màn hình
    const maxTx = (scale - 1) * cx;
    const minTx = (scale - 1) * (cx - vw);
    const maxTy = (scale - 1) * cy;
    const minTy = (scale - 1) * (cy - vh);
    
    tx = Math.max(minTx, Math.min(tx, maxTx));
    ty = Math.max(minTy, Math.min(ty, maxTy));
    
    canvasWrapper.style.transformOrigin = `${cx}px ${cy}px`;
    canvasWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    
    if (item.element) {
        item.element.classList.add('hint-glow');
    }
    
    speakWord(item.word);
    updateRobotUI('normal', getDialog('hint', { target: item.word.toUpperCase() }));
    
    setTimeout(() => {
        if (item.element) {
            item.element.classList.remove('hint-glow');
        }
        canvasWrapper.style.transform = 'translate(0px, 0px) scale(1)';
        resetHintTimer();
        updateRobotUI('normal', getDialog('next_question', { target: item.word.toUpperCase() }));
    }, 3000);
}

// Preload các tệp âm thanh từ thư mục assets để phát ngay lập tức khi cần
const audioAssets = {
    'correct': new Audio('assets/audio/correct.m4a'),
    'wrong': new Audio('assets/audio/incorrect.m4a'),
    'finish': new Audio('assets/audio/finish.m4a')
};

function playSound(type) {
    const sound = audioAssets[type];
    if (sound) {
        // Reset thời gian về 0 để có thể phát đè liên tục nếu người chơi click nhanh
        sound.currentTime = 0;
        sound.play().catch(e => console.error("Không thể phát âm thanh:", e));
    }
}

function endGame(isWin) {
    if (timerInterval) clearInterval(timerInterval);
    if (hintTimeout) clearTimeout(hintTimeout);
    isGameStarted = false;
    
    const timerBox = document.querySelector('.timer-container');
    if (timerBox) timerBox.classList.remove('timer-warning');
    
    setTimeout(() => {
        const endScreen = document.getElementById('end-game-overlay');
        const timeTaken = 60 - secondsRemaining;
        document.getElementById('final-time').textContent = timeTaken + "s";

        const totalObjects = levelData.data.length;
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) finalScoreEl.textContent = `${score}/${totalObjects}`;
        
        const eyebrowEl = document.getElementById('end-game-eyebrow');
        const titleEl = document.getElementById('end-game-title');
        
        if (!isWin) {
            playSound('wrong');
            eyebrowEl.textContent = "HẾT THỜI GIAN";
            eyebrowEl.style.color = "#dc3545";
            titleEl.textContent = "Rất tiếc! Bạn chưa tìm được tất cả đồ vật!";
            if (finalScoreEl) finalScoreEl.style.color = "#dc3545";
        } else {
            playSound('finish');
            eyebrowEl.textContent = "NHIỆM VỤ HOÀN THÀNH";
            eyebrowEl.style.color = "#ff9800";
            titleEl.textContent = "Tuyệt vời! Bạn đã tìm được tất cả đồ vật!";
            if (finalScoreEl) finalScoreEl.style.color = "#28a745";
        }
        
        // Khôi phục con trỏ chuột mặc định khi show màn hình End Game
        document.body.classList.remove('hide-cursor');
        
        endScreen.style.display = 'flex';
        setTimeout(() => {
            endScreen.classList.add('visible');
            if (isWin) createConfetti();
        }, 50);
    }, 1000);
}

function checkWin() {
    const isWin = levelData.data.every(item => item.isFound);
    if (isWin) {
        endGame(true);
    }
}

function createConfetti() {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
    const amount = 100;
    
    const overlay = document.getElementById('end-game-overlay');
    for (let i = 0; i < amount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        // Gắn vào overlay để đảm bảo nó nằm trên cùng
        if (overlay) {
            overlay.appendChild(confetti);
        } else {
            document.body.appendChild(confetti);
        }
        
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        const fallDuration = Math.random() * 3 + 2;
        const sideDelay = Math.random() * 2;
        
        confetti.style.animation = `fall ${fallDuration}s linear forwards, sideWays ${sideDelay}s ease-in-out infinite alternate`;
        
        setTimeout(() => {
            confetti.remove();
        }, fallDuration * 1000);
    }
}

document.getElementById('play-again-btn').addEventListener('click', () => {
    document.getElementById('end-game-overlay').style.display = 'none';
    document.getElementById('end-game-overlay').classList.remove('visible');
    
    const eyebrowEl = document.getElementById('end-game-eyebrow');
    if (eyebrowEl) eyebrowEl.style.color = "#888";
    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) finalScoreEl.style.color = "#ff6d00";

    score = 0;
    levelData.data.forEach(obj => obj.isFound = false);
    
    // Bật lại con trỏ chuột tùy chỉnh của game
    document.body.classList.add('hide-cursor');
    isGameStarted = true;
    
    initGame(true);
});

document.getElementById('btn-reset').addEventListener('click', () => {
    if (document.getElementById('start-overlay').style.display !== 'none') return; // Chặn nếu màn hình start đang bật
    
    document.getElementById('end-game-overlay').style.display = 'none';
    document.getElementById('end-game-overlay').classList.remove('visible');
    
    isGameStarted = true;
    score = 0;
    if (levelData && levelData.data) {
        levelData.data.forEach(obj => obj.isFound = false);
    }
    
    document.body.classList.add('hide-cursor');
    initGame(true);
});

document.getElementById('btn-close-end-game').addEventListener('click', () => {
    document.getElementById('end-game-overlay').style.display = 'none';
    document.getElementById('end-game-overlay').classList.remove('visible');
});
