let score = 0;
let totalDragged = 0;
let seconds = 0;
let timerInterval;
let gameStartTime = 0;

let cardData = [];   // Danh sách các thẻ từ JSON
let groupsData = []; // Danh sách các giỏ từ JSON
let totalCards = 0;  // Tổng số thẻ
let gameHint = '';
let gameNote = '';
let isBgmMuted = false;

let aiAccuracy = 0; // Biến lưu tỷ lệ % độ thông minh của AI

let dragStartTime = 0;       // Thời điểm bắt đầu kéo thẻ
let correctDragTimes = [];  // Lưu danh sách thời gian các lần kéo ĐÚNG (tính theo giây)

//Hàm format thời gian từ giây sang định dạng mm:ss
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const secondsPart = totalSeconds % 60;

    return [minutes, secondsPart]
        .map(value => String(value).padStart(2, '0'))
        .join(':') + 's';
}

const effectSound = new Audio('media/starding.m4a');
const finishSound = new Audio('media/finish.m4a');
const incorrectSound = new Audio('media/incorrect.m4a');

// Khai báo phần tử audio nhạc nền
const bgmSound = document.getElementById('bgmSound');
const bgmToggle = document.getElementById('bgmToggle');
const bgmIcon = document.getElementById('bgmIcon');

// Cập nhật trạng thái nút nhạc nền
function updateBgmButton() {
    if (!bgmToggle || !bgmIcon) return;

    const isPlaying = bgmSound && !bgmSound.paused && !isBgmMuted;
    bgmToggle.setAttribute('aria-label', isBgmMuted ? 'Bật nhạc nền' : 'Tắt nhạc nền');
    bgmToggle.setAttribute('title', isBgmMuted ? 'Bật nhạc nền' : 'Tắt nhạc nền');
    bgmToggle.setAttribute('aria-pressed', String(isBgmMuted));
    bgmToggle.classList.toggle('is-muted', isBgmMuted);
    bgmToggle.classList.toggle('is-playing', isPlaying);
    bgmToggle.classList.toggle('is-on', !isBgmMuted);
}

//Hàm bật/tắt nhạc nền
function toggleBgm() {
    isBgmMuted = !isBgmMuted;

    if (bgmSound) {
        if (isBgmMuted) {
            bgmSound.pause();
        } else {
            bgmSound.play().catch(err => console.log("Cần tương tác người dùng để phát BGM:", err));
        }
    }

    updateBgmButton();
}

bgmToggle?.addEventListener('click', toggleBgm);
bgmSound?.addEventListener('play', updateBgmButton);
bgmSound?.addEventListener('pause', updateBgmButton);
bgmSound?.addEventListener('ended', updateBgmButton);
updateBgmButton();

// Hàm tải dữ liệu từ file data.json
async function loadGameData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`Không thể tải data.json: ${response.status}`);
        }
        const data = await response.json();

        cardData = data.rows;
        groupsData = data.groups;
        totalCards = cardData.length;
        gameHint = data.hint || '';
        gameNote = data.note || '';

        renderBaskets();
        initGame();
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
    }
}

// Hàm tạo các giỏ hàng
function renderBaskets() {
    const basketContainer = document.querySelector('.basket-container');
    basketContainer.innerHTML = '';

    groupsData.forEach(group => {
        const basketSlot = document.createElement('div');
        basketSlot.className = 'basket-slot';

        const basketTitle = document.createElement('h2');
        basketTitle.className = 'basket-title';
        basketTitle.textContent = group.name;

        const basket = document.createElement('div');
        basket.className = 'basket';
        basket.dataset.groupId = group.Id;
        basket.innerHTML = `
            <span class="basket-hint">Kéo vật phẩm vào đây</span>
            <ul class="basket-items"></ul>
        `;

        basketSlot.append(basketTitle, basket);
        basketContainer.appendChild(basketSlot);
    });
}

// Hàm khởi tạo / Khai cuộc trò chơi
function initGame() {
    hideVictoryModal(); // Ẩn popup nếu đang mở
    resetBasketItems();

    // Đặt lại các thông số game & AI
    score = 0;
    totalDragged = 0;
    seconds = 0;
    gameStartTime = Date.now();
    aiAccuracy = 0;
    correctDragTimes = []; // Reset danh sách thời gian kéo

    // Cập nhật hiển thị AI ban đầu
    updateAIDisplay(0);

    // Phát nhạc nền từ đầu
    if (bgmSound && !isBgmMuted) {
        bgmSound.currentTime = 0;
        bgmSound.volume = 0.3;
        bgmSound.play().catch(err => console.log("Cần tương tác người dùng để phát BGM:", err));
    } else if (bgmSound) {
        bgmSound.pause();
    }

    document.getElementById('score').innerText = score;
    document.getElementById('timer').innerText = formatTime(seconds);

    // Bộ đếm thời gian tổng
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds++;
        document.getElementById('timer').innerText = formatTime(seconds);
    }, 1000);

    // Tạo danh sách thẻ kéo thả
    const cardContainer = document.getElementById('cardContainer');
    cardContainer.innerHTML = '';

    cardData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.id = `card-${item.Id}`;

        card.innerHTML = `
            <span class="card-text">${item.Text}</span>
            <img class="card-img" src="${item.src}" alt="${item.Text}" draggable="false">
        `;

        // LẮNG NGHE SỰ KIỆN POINTER (DÙNG CHO CẢ CHUỘT VÀ CẢM ỨNG)
        setupPointerEvents(card, item);

        cardContainer.appendChild(card);
    });
}

// Hàm thiết lập sự kiện pointer cho thẻ
function setupPointerEvents(card, cardItem) {
    let cloneCard = null;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    card.addEventListener('pointerdown', (e) => {
        // Chỉ nhận chuột trái (button 0) hoặc cảm ứng
        if (e.button !== undefined && e.button !== 0) return;

        isDragging = true;
        dragStartTime = Date.now();

        // 1. Lấy vị trí và kích thước thực tế của thẻ gốc trên màn hình
        const rect = card.getBoundingClientRect();

        // 2. Tính khoảng lệch chính xác giữa điểm chạm và góc trên-trái của thẻ
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // 3. Tạo bản sao (Clone) để di chuyển, tránh làm hỏng layout của container
        cloneCard = card.cloneNode(true);
        cloneCard.id = `${card.id}-clone`;
        
        // Thiết lập css cho bản sao
        Object.assign(cloneCard.style, {
            position: 'fixed',
            left: `${e.clientX - offsetX}px`,
            top: `${e.clientY - offsetY}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            zIndex: '9999',
            opacity: '0.9',
            pointerEvents: 'none', // Cho phép elementFromPoint xuyên qua bản sao
            transform: 'scale(1.05)', // Hiệu ứng phóng nhẹ khi kéo
            transition: 'transform 0.1s ease',
            margin: '0',
            boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
        });

        document.body.appendChild(cloneCard);

        // 4. Làm mờ thẻ gốc ở danh sách
        card.style.opacity = '0.3';

        // Khóa Pointer Capture trên thẻ gốc
        try {
            card.setPointerCapture(e.pointerId);
        } catch (err) {
            console.log("PointerCapture failed:", err);
        }
    });

    card.addEventListener('pointermove', (e) => {
        if (!isDragging || !cloneCard) return;

        // Di chuyển bản sao theo con trỏ/ngón tay chuẩn tọa độ 100%
        cloneCard.style.left = `${e.clientX - offsetX}px`;
        cloneCard.style.top = `${e.clientY - offsetY}px`;

        // Highlight giỏ hàng bên dưới vị trí con trỏ
        const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
        const basket = elemBelow ? elemBelow.closest('.basket') : null;

        document.querySelectorAll('.basket').forEach(b => b.classList.remove('drag-over'));
        if (basket) {
            basket.classList.add('drag-over');
        }
    });

    const handlePointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;

        // Xóa thẻ bản sao
        if (cloneCard) {
            cloneCard.remove();
            cloneCard = null;
        }

        // Bỏ highlight các giỏ
        document.querySelectorAll('.basket').forEach(b => b.classList.remove('drag-over'));

        const dragEndTime = Date.now();
        const dragDuration = (dragEndTime - dragStartTime) / 1000;

        // Kiểm tra giỏ hàng bên dưới điểm thả
        const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
        const basket = elemBelow ? elemBelow.closest('.basket') : null;

        if (basket) {
            const basketGroupId = parseInt(basket.dataset.groupId);

            if (cardItem.correctGroup === basketGroupId) {
                // --- KÉO ĐÚNG ---
                score += 10;

                const basketItems = basket.querySelector('.basket-items');
                const basketHint = basket.querySelector('.basket-hint');
                if (basketItems) {
                    const itemElement = document.createElement('li');
                    const itemImage = document.createElement('img');
                    itemImage.src = cardItem.src;
                    itemImage.alt = '';
                    itemImage.draggable = false;

                    const itemName = document.createElement('span');
                    itemName.textContent = cardItem.Text;

                    itemElement.append(itemImage, itemName);
                    basketItems.appendChild(itemElement);
                }
                if (basketHint) basketHint.hidden = true;

                updateAIModel(true, dragDuration);

                effectSound.currentTime = 0;
                effectSound.play().catch(err => console.log("Lỗi âm thanh:", err));

                const basketRect = basket.getBoundingClientRect();
                const basketCenterX = basketRect.left + basketRect.width / 2;
                const basketCenterY = basketRect.top + basketRect.height / 2;

                createParticles(basketCenterX, basketCenterY);

                // Xóa hẳn thẻ gốc
                card.remove();
                totalDragged++;
            } else {
                // --- KÉO SAI ---
                card.style.opacity = '1'; // Khôi phục thẻ gốc
                score = Math.max(0, score - 5);

                updateAIModel(false, dragDuration);

                incorrectSound.currentTime = 0;
                incorrectSound.play().catch(err => console.log("Lỗi âm thanh:", err));
            }
        } else {
            // --- THẢ NGOÀI GIỎ ---
            card.style.opacity = '1'; // Khôi phục thẻ gốc
        }

        document.getElementById('score').innerText = score;

        if (totalDragged === totalCards) {
            clearInterval(timerInterval);
            setTimeout(() => {
                showVictoryModal();
            }, 1000);
        }
    };

    card.addEventListener('pointerup', handlePointerUp);
    card.addEventListener('pointercancel', handlePointerUp);
}

// Xóa danh sách vật phẩm trong giỏ khi bắt đầu ván mới
function resetBasketItems() {
    document.querySelectorAll('.basket').forEach(basket => {
        const items = basket.querySelector('.basket-items');
        const hint = basket.querySelector('.basket-hint');

        if (items) items.innerHTML = '';
        if (hint) hint.hidden = false;
    });
}

// HÀM TÍNH TOÁN VÀ CẬP NHẬT ĐỘ THÔNG MINH CỦA AI
function updateAIModel(isCorrect, dragDurationInSeconds) {
    if (isCorrect) {
        correctDragTimes.push(dragDurationInSeconds);

        const avgTime = correctDragTimes.reduce((a, b) => a + b, 0) / correctDragTimes.length;
        let speedScore = Math.max(0, 100 - (avgTime - 1.5) * 20);
        let accuracyScore = (correctDragTimes.length / (totalDragged + 1)) * 100;

        aiAccuracy = Math.round((accuracyScore * 0.7) + (speedScore * 0.3));
    } else {
        aiAccuracy = Math.max(0, aiAccuracy - 15);
    }

    aiAccuracy = Math.min(100, Math.max(0, aiAccuracy));
    updateAIDisplay(aiAccuracy);
}

// HÀM HIỂN THỊ ĐỘ CHÍNH XÁC AI LÊN GIAO DIỆN
function updateAIDisplay(value) {
    const aiAccuracyElem = document.getElementById('aiAccuracy');
    const aiProgressFill = document.getElementById('aiProgressFill');

    if (aiAccuracyElem) aiAccuracyElem.innerText = `${value}%`;
    if (aiProgressFill) aiProgressFill.style.width = `${value}%`;
}

// Hàm tạo hiệu ứng hạt lấp lánh
function createParticles(x, y, options = {}) {
    const colors = ['#FFD700', '#FF5722', '#4CAF50', '#00BCD4', '#E91E63', '#9C27B0'];
    const particleCount = options.count ?? 25;
    const minVelocity = options.minVelocity ?? 80;
    const velocityRange = options.velocityRange ?? 120;
    const duration = options.duration ?? 800;
    const animationDuration = options.animationDuration ?? 1500;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const size = Math.random() * 12 + 12;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.animationDuration = `${animationDuration}ms`;

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * velocityRange + minVelocity;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity;

        particle.style.setProperty('--dx', `${dx}px`);
        particle.style.setProperty('--dy', `${dy}px`);

        document.body.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, duration);
    }
}

// Hàm hiển thị popup gợi ý
function showHintModal() {
    const hintModal = document.getElementById('hintModal');
    const hintContent = document.getElementById('hintContent');
    const noteContent = document.getElementById('noteContent');
    if (hintModal && hintContent && noteContent) {
        hintContent.textContent = gameHint;
        noteContent.textContent = gameNote;
        hintModal.style.display = 'flex';
    }
}

// Quản lý Popup end game
function showVictoryModal() {
    if (bgmSound) {
        bgmSound.pause();
        bgmSound.currentTime = 0;
    }

    document.getElementById('modalTime').innerText = formatTime(seconds);
    document.getElementById('modalScore').innerText = score;
    document.getElementById('modalMaxScore').innerText = totalCards * 10;
    document.getElementById('modalAIAccuracy').innerText = `${aiAccuracy}%`;

    const completionTime = (Date.now() - gameStartTime) / 1000;
    const maxScore = totalCards * 10;
    const feedback = document.getElementById('modalFeedback');
    if (feedback) {
        if (score === maxScore && completionTime < 30) {
            feedback.textContent = '👏 Tuyệt vời! Bạn đạt điểm tối đa và hoàn thành trong chưa đầy 30 giây!';
        } else {
            feedback.textContent = '💡 Hãy thử lại và cố gắng đạt điểm tối đa trong thời gian nhanh hơn nhé!';
        }
    }
    
    document.getElementById('victoryModal').style.display = 'flex';

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const finaleOptions = {
        count: 55,
        minVelocity: 140,
        velocityRange: 220,
        duration: 2800,
        animationDuration: 2800
    };

    createParticles(centerX, centerY, finaleOptions);
    createParticles(centerX - 180, centerY - 90, finaleOptions);
    createParticles(centerX + 180, centerY - 90, finaleOptions);

    finishSound.play().catch(error => {
        console.log("Trình duyệt chặn tự động phát âm thanh:", error);
    });
}

// Hàm ẩn popup gợi ý
function closeHintModal() {
    const hintModal = document.getElementById('hintModal');
    if (hintModal) {
        hintModal.style.display = 'none';
    }
}

// Ẩn popup end game
function hideVictoryModal() {
    const modal = document.getElementById('victoryModal');
    if (modal) modal.style.display = 'none';
}

// Gán sự kiện nút Reset
const resetBtn = document.getElementById('resetBtn');
if (resetBtn) {
    resetBtn.addEventListener('click', initGame);
}

// Gán sự kiện nút Chơi lại trong modal
const playAgainBtn = document.getElementById('playAgainBtn');
if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
        hideVictoryModal();
        initGame();
    });
}

// Bắt đầu tải dữ liệu
loadGameData();