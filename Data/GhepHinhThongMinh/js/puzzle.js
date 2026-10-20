// puzzle.js - Quản lý khung tranh, cắt ảnh mảnh ghép & khay chứa
const PuzzleManager = {
    currentLevelConfig: null,
    themeImage: '',
    cols: 2,
    rows: 2,
    totalPieces: 4,
    placedPiecesCount: 0,
    allowRotation: false,
    boardSlots: [],
    piecesData: [],
    trayOrder: [],

    // DOM Elements
    puzzleBoard: null,
    boardGhostImage: null,
    boardSlotsGrid: null,
    boardPlacedLayer: null,
    boardCompleteImage: null,
    boardCompleteImg: null,
    piecesTrayGrid: null,
    sampleThumbnail: null,

    init() {
        this.puzzleBoard = document.getElementById('puzzle-board');
        this.boardGhostImage = document.getElementById('board-ghost-image');
        this.boardSlotsGrid = document.getElementById('board-slots-grid');
        this.boardPlacedLayer = document.getElementById('board-placed-layer');
        this.boardCompleteImage = document.getElementById('board-complete-image');
        this.boardCompleteImg = document.getElementById('board-complete-img');
        this.piecesTrayGrid = document.getElementById('pieces-tray-grid');
        this.sampleThumbnail = document.getElementById('sample-thumbnail');
    },

    buildBoard(levelConfig, imageSrc, savedState = null) {
        this.currentLevelConfig = levelConfig;
        this.themeImage = imageSrc
            || (levelConfig && (levelConfig.img || levelConfig.src))
            || (typeof GameManager !== 'undefined' && GameManager.getImageSrc && GameManager.getImageSrc())
            || 'assets/images/Pic1.png';
        this.cols = levelConfig.cols || 2;
        this.rows = levelConfig.rows || 2;
        this.totalPieces = levelConfig.totalPieces || (this.cols * this.rows);
        this.placedPiecesCount = 0;
        this.boardSlots = [];
        this.piecesData = [];
        this.trayOrder = [];

        // Kiểm tra biến allowRotation từ cấu hình level trong data.json hoặc settings toàn cục
        this.allowRotation = Boolean(
            (levelConfig && typeof levelConfig.allowRotation !== 'undefined')
                ? levelConfig.allowRotation
                : (typeof GameManager !== 'undefined' && GameManager.settings && GameManager.settings.allowRotation)
        );

        this.updateProgressUI();

        // Cập nhật ảnh cho giao diện
        if (this.sampleThumbnail) {
            this.sampleThumbnail.src = this.themeImage;
        }
        if (this.boardCompleteImg) {
            this.boardCompleteImg.src = this.themeImage;
        }
        if (this.boardGhostImage) {
            this.boardGhostImage.style.backgroundImage = `url('${this.themeImage}')`;

            // Ẩn ảnh mờ phía sau khung tranh
            this.boardGhostImage.style.opacity = '0';
        }
        if (this.boardCompleteImage) {
            this.boardCompleteImage.classList.remove('show-victory');
        }

        // Hủy bất kỳ thao tác kéo nào đang dở dang và dọn sạch các mảnh còn vương trên body
        if (typeof DragDropManager !== 'undefined') {
            DragDropManager.cancelCurrentDrag();
        }
        document.querySelectorAll('body > .puzzle-piece').forEach(el => el.remove());

        // Xóa sạch các lớp cũ
        this.boardSlotsGrid.innerHTML = '';
        this.boardPlacedLayer.innerHTML = '';
        this.piecesTrayGrid.innerHTML = '';

        // Kích thước khung tranh
        const boardRect = this.puzzleBoard.getBoundingClientRect();
        const boardWidth = boardRect.width || 540;
        const boardHeight = boardRect.height || 383;

        const pieceWidth = boardWidth / this.cols;
        const pieceHeight = boardHeight / this.rows;

        // Thiết lập CSS grid cho khung đích
        this.boardSlotsGrid.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
        this.boardSlotsGrid.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;

        // 1. Tạo các ô đích trên khung tranh
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const slotIndex = r * this.cols + c;
                const slotEl = document.createElement('div');
                slotEl.className = 'board-slot';
                slotEl.dataset.slotIndex = slotIndex;
                slotEl.dataset.row = r;
                slotEl.dataset.col = c;

                this.boardSlotsGrid.appendChild(slotEl);

                this.boardSlots.push({
                    id: slotIndex,
                    row: r,
                    col: c,
                    element: slotEl,
                    isFilled: false,
                    placedElement: null
                });
            }
        }

        // Kích thước mảnh ghép trên khay (2 cột gọn gàng, co giãn theo chiều rộng khay)
        const trayGridRect = this.piecesTrayGrid.getBoundingClientRect();
        const availableColW = trayGridRect.width > 0 ? Math.floor((trayGridRect.width - 24) / 2) : 105;
        const maxTrayCap = this.cols >= 4 ? 100 : 150;
        const trayW = Math.max(60, Math.min(maxTrayCap, availableColW));
        const pieceAspect = pieceWidth / pieceHeight;
        const trayH = Math.round(trayW / pieceAspect);

        // Nếu cho phép xoay, kích thước ô khay là hình vuông để mảnh khi xoay 90/270 độ không bị tràn viền
        const slotDim = this.allowRotation ? Math.max(trayW, trayH) : null;

        // 2. Tạo dữ liệu các mảnh ghép kèm góc xoay (khôi phục từ savedState nếu có)
        const possibleAngles = [0, 90, 180, 270];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const pieceIndex = r * this.cols + c;
                let initialRotation = 0;
                let isPlaced = false;

                if (savedState && Array.isArray(savedState.pieces)) {
                    const sp = savedState.pieces.find(p => p.id === pieceIndex);
                    if (sp) {
                        initialRotation = sp.rotation !== undefined ? sp.rotation : 0;
                        isPlaced = Boolean(sp.isPlaced);
                    }
                } else if (this.allowRotation) {
                    initialRotation = possibleAngles[Math.floor(Math.random() * possibleAngles.length)];
                }

                this.piecesData.push({
                    id: pieceIndex,
                    row: r,
                    col: c,
                    width: pieceWidth,
                    height: pieceHeight,
                    trayWidth: trayW,
                    trayHeight: trayH,
                    rotation: initialRotation,
                    isPlaced: isPlaced,
                    element: null,
                    traySlotElement: null,
                    rotateBadge: null
                });
            }
        }

        // Đảm bảo khi chơi mới và cho phép xoay, có ít nhất một vài mảnh ghép chắc chắn bị xoay chiều
        if (!savedState && this.allowRotation && this.piecesData.length > 0 && this.piecesData.every(p => p.rotation % 360 === 0)) {
            const nonZeroAngles = [90, 180, 270];
            const randIdx = Math.floor(Math.random() * this.piecesData.length);
            this.piecesData[randIdx].rotation = nonZeroAngles[Math.floor(Math.random() * nonZeroAngles.length)];
        }

        // 3. Xáo trộn hoặc khôi phục thứ tự các mảnh trong khay
        let shuffledPieces = [];
        if (savedState && Array.isArray(savedState.trayOrder) && savedState.trayOrder.length > 0) {
            shuffledPieces = savedState.trayOrder
                .map(id => this.piecesData.find(p => p.id === id))
                .filter(Boolean);
            this.piecesData.forEach(p => {
                if (!shuffledPieces.includes(p)) shuffledPieces.push(p);
            });
        } else {
            shuffledPieces = [...this.piecesData];
            for (let i = shuffledPieces.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledPieces[i], shuffledPieces[j]] = [shuffledPieces[j], shuffledPieces[i]];
            }
        }
        this.trayOrder = shuffledPieces.map(p => p.id);

        // 4. Render các mảnh ghép vào khay và khôi phục các mảnh đã ghép đúng
        shuffledPieces.forEach(pieceData => {
            const traySlot = document.createElement('div');
            traySlot.className = 'tray-slot';
            traySlot.style.width = slotDim ? `${slotDim}px` : `${trayW}px`;
            traySlot.style.height = slotDim ? `${slotDim}px` : `${trayH}px`;
            this.piecesTrayGrid.appendChild(traySlot);
            pieceData.traySlotElement = traySlot;

            if (pieceData.isPlaced) {
                // Mảnh đã ghép đúng từ trước: khôi phục hiển thị trên khung tranh
                traySlot.style.opacity = '0.3';

                const pieceL = pieceData.col * pieceWidth;
                const pieceT = pieceData.row * pieceHeight;

                const placedEl = document.createElement('div');
                placedEl.className = 'placed-piece';
                placedEl.style.width = `${pieceWidth}px`;
                placedEl.style.height = `${pieceHeight}px`;
                placedEl.style.left = `${pieceL}px`;
                placedEl.style.top = `${pieceT}px`;
                placedEl.style.backgroundImage = `url('${this.themeImage}')`;
                placedEl.style.backgroundSize = `${boardWidth}px ${boardHeight}px`;
                placedEl.style.backgroundPosition = `-${pieceL}px -${pieceT}px`;

                const targetSlot = this.boardSlots.find(s => s.id === pieceData.id);
                if (targetSlot) {
                    targetSlot.isFilled = true;
                    if (targetSlot.element) targetSlot.element.classList.add('is-filled');
                    targetSlot.placedElement = placedEl;
                }

                this.boardPlacedLayer.appendChild(placedEl);
                this.placedPiecesCount++;
            } else {
                // Mảnh chưa ghép: render vào ô khay
                const pieceEl = document.createElement('div');
                pieceEl.className = 'puzzle-piece';
                pieceEl.dataset.pieceId = pieceData.id;
                pieceEl.style.width = `${trayW}px`;
                pieceEl.style.height = `${trayH}px`;

                pieceEl.style.backgroundImage = `url('${this.themeImage}')`;
                pieceEl.style.backgroundSize = `${trayW * this.cols}px ${trayH * this.rows}px`;
                pieceEl.style.backgroundPosition = `-${pieceData.col * trayW}px -${pieceData.row * trayH}px`;

                // Áp dụng góc xoay qua biến CSS Custom Property
                pieceEl.style.setProperty('--piece-rotation', `${pieceData.rotation}deg`);

                // Nếu cấp độ bật xoay mảnh: gắn badge xoay chiều để học sinh dễ nhận biết
                if (this.allowRotation) {
                    const badge = document.createElement('span');
                    badge.className = 'piece-rotate-badge';
                    badge.title = 'Bấm để xoay mảnh ghép';
                    badge.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';

                    if (pieceData.rotation % 360 === 0) {
                        badge.classList.add('correct-orientation');
                    }
                    pieceEl.appendChild(badge);
                    pieceData.rotateBadge = badge;
                }

                // Gắn sự kiện kéo thả từ DragDropManager
                if (typeof DragDropManager !== 'undefined') {
                    pieceEl.addEventListener('pointerdown', (e) => DragDropManager.onPointerDown(e, pieceData));
                }

                traySlot.appendChild(pieceEl);
                pieceData.element = pieceEl;
            }
        });

        // Cập nhật thanh tiến trình theo số mảnh đã ghép
        this.updateProgressUI();
    },

    // Cố định mảnh ghép vào khung tranh khi ghép đúng
    placePiece(pieceData, targetSlot) {
        const pieceEl = pieceData.element;
        targetSlot.isFilled = true;
        if (targetSlot.element) {
            targetSlot.element.classList.add('is-filled');
        }
        pieceData.isPlaced = true;

        const boardRect = this.puzzleBoard.getBoundingClientRect();
        const pieceW = boardRect.width / this.cols;
        const pieceH = boardRect.height / this.rows;
        const pieceL = pieceData.col * pieceW;
        const pieceT = pieceData.row * pieceH;

        const placedEl = document.createElement('div');
        placedEl.className = 'placed-piece snap-success-anim';
        placedEl.style.width = `${pieceW}px`;
        placedEl.style.height = `${pieceH}px`;
        placedEl.style.left = `${pieceL}px`;
        placedEl.style.top = `${pieceT}px`;

        placedEl.style.backgroundImage = `url('${this.themeImage}')`;
        placedEl.style.backgroundSize = `${boardRect.width}px ${boardRect.height}px`;
        placedEl.style.backgroundPosition = `-${pieceL}px -${pieceT}px`;

        targetSlot.placedElement = placedEl;
        this.boardPlacedLayer.appendChild(placedEl);

        // Kích hoạt chuỗi hiệu ứng rực rỡ khi ghép đúng: sóng xung kích + ngôi sao tung bay + robot nhún nhảy
        this.triggerSnapEffect(pieceL + pieceW / 2, pieceT + pieceH / 2, pieceW, pieceH);

        if (pieceEl.parentElement) {
            pieceEl.parentElement.removeChild(pieceEl);
        }
        if (pieceData.traySlotElement) {
            pieceData.traySlotElement.style.opacity = '0.3';
        }

        this.placedPiecesCount++;
        this.updateProgressUI();

        // Kiểm tra xem đã hoàn thành toàn bộ tranh chưa
        if (this.placedPiecesCount >= this.totalPieces) {
            if (typeof GameManager !== 'undefined') {
                GameManager.handleVictory();
            }
        } else {
            // Tự động lưu tiến trình sau mỗi mảnh ghép đúng
            if (typeof StorageManager !== 'undefined') {
                StorageManager.saveCurrentGameState();
            } else if (typeof GameManager !== 'undefined' && GameManager.saveGameState) {
                GameManager.saveGameState();
            }
        }
    },

    // Hiệu ứng rực rỡ khi học sinh ghép đúng mảnh
    triggerSnapEffect(centerX, centerY, pieceW, pieceH) {
        if (!this.puzzleBoard) return;

        // 1. Sóng xung kích phát sáng lan tỏa (Ripple wave)
        const ripple = document.createElement('div');
        ripple.className = 'snap-ripple-effect';
        ripple.style.left = `${centerX}px`;
        ripple.style.top = `${centerY}px`;
        ripple.style.width = `${pieceW * 0.9}px`;
        ripple.style.height = `${pieceH * 0.9}px`;
        this.puzzleBoard.appendChild(ripple);

        // 2. Chùm ngôi sao và tia sáng bung nở (Sparkles burst)
        const sparklesContainer = document.createElement('div');
        sparklesContainer.className = 'snap-sparkles-container';
        sparklesContainer.style.left = `${centerX}px`;
        sparklesContainer.style.top = `${centerY}px`;

        const starSymbols = ['⭐', '✨', '🌟', '💫', '🎉'];
        const particleCount = 8;

        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
            const dist = Math.min(pieceW, pieceH) * 0.55 + Math.random() * 20;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;
            const symbol = starSymbols[i % starSymbols.length];
            const size = 15 + Math.random() * 9;
            const rot = (Math.random() * 360) - 180;

            const star = document.createElement('span');
            star.className = 'snap-sparkle-star';
            star.textContent = symbol;
            star.style.fontSize = `${size}px`;
            star.style.setProperty('--tx', `${tx}px`);
            star.style.setProperty('--ty', `${ty}px`);
            star.style.setProperty('--rot', `${rot}deg`);
            star.style.animationDelay = `${Math.random() * 0.06}s`;

            sparklesContainer.appendChild(star);
        }

        this.puzzleBoard.appendChild(sparklesContainer);

        // 3. Robot mascot bật nhảy vui sướng
        const robotImg = document.getElementById('robot-mascot-img');
        if (robotImg) {
            robotImg.classList.remove('mascot-bounce');
            void robotImg.offsetWidth;
            robotImg.classList.add('mascot-bounce');
        }

        // Tự động thu dọn DOM sau khi animation kết thúc
        setTimeout(() => {
            if (ripple.parentElement) ripple.parentElement.removeChild(ripple);
            if (sparklesContainer.parentElement) sparklesContainer.parentElement.removeChild(sparklesContainer);
        }, 850);
    },

    // Trượt lùi mảnh ghép về khay chứa khi ghép sai
    returnPiece(pieceData) {
        const pieceEl = pieceData.element;
        if (!pieceEl) return;

        if (pieceData.returnTimeoutId) {
            clearTimeout(pieceData.returnTimeoutId);
            pieceData.returnTimeoutId = null;
        }

        pieceEl.classList.remove('is-dragging');
        pieceEl.classList.add('sliding-back');
        pieceEl.style.pointerEvents = 'none';

        if (pieceData.traySlotElement) {
            const traySlotRect = pieceData.traySlotElement.getBoundingClientRect();
            pieceEl.style.left = `${traySlotRect.left}px`;
            pieceEl.style.top = `${traySlotRect.top}px`;
        }
        pieceEl.style.width = `${pieceData.trayWidth}px`;
        pieceEl.style.height = `${pieceData.trayHeight}px`;
        pieceEl.style.backgroundSize = `${pieceData.trayWidth * this.cols}px ${pieceData.trayHeight * this.rows}px`;
        pieceEl.style.backgroundPosition = `-${pieceData.col * pieceData.trayWidth}px -${pieceData.row * pieceData.trayHeight}px`;

        pieceData.returnTimeoutId = setTimeout(() => {
            pieceData.returnTimeoutId = null;
            pieceEl.classList.remove('sliding-back');
            pieceEl.style.position = 'relative';
            pieceEl.style.left = '';
            pieceEl.style.top = '';
            pieceEl.style.pointerEvents = '';
            if (pieceData.traySlotElement) {
                pieceData.traySlotElement.appendChild(pieceEl);
            }
        }, 300);
    },

    // Xoay mảnh ghép thêm 90 độ khi học sinh click vào mảnh trong khay
    rotatePiece(pieceData) {
        if (!this.allowRotation || pieceData.isPlaced) return;

        // Tăng 90 độ theo chiều kim đồng hồ
        pieceData.rotation = (pieceData.rotation || 0) + 90;
        const pieceEl = pieceData.element;

        if (pieceEl) {
            pieceEl.style.setProperty('--piece-rotation', `${pieceData.rotation}deg`);

            // Kích hoạt hiệu ứng pop xoay sống động
            pieceEl.classList.remove('is-rotating');
            void pieceEl.offsetWidth; // Force reflow
            pieceEl.classList.add('is-rotating');
        }

        if (typeof SoundManager !== 'undefined') {
            SoundManager.play('click');
        }

        this.updateRotateBadge(pieceData);

        // Tự động lưu lại góc xoay mới vào LocalStorage
        if (typeof StorageManager !== 'undefined') {
            StorageManager.saveCurrentGameState();
        } else if (typeof GameManager !== 'undefined' && GameManager.saveGameState) {
            GameManager.saveGameState();
        }
    },

    updateRotateBadge(pieceData) {
        if (!pieceData.rotateBadge) return;
        const isCorrect = (pieceData.rotation % 360 === 0);
        pieceData.rotateBadge.classList.toggle('correct-orientation', isCorrect);
    },

    adjustResponsiveLayout() {
        if (!this.puzzleBoard || !this.currentLevelConfig) return;
        const boardRect = this.puzzleBoard.getBoundingClientRect();
        if (!boardRect.width || !boardRect.height) return;

        const targetW = boardRect.width / this.cols;
        const targetH = boardRect.height / this.rows;

        // 1. Cập nhật kích thước các mảnh đã ghép đúng trên khung tranh
        this.boardSlots.forEach((slot) => {
            if (slot.isFilled && slot.placedElement) {
                slot.placedElement.style.width = `${targetW}px`;
                slot.placedElement.style.height = `${targetH}px`;
                slot.placedElement.style.left = `${slot.col * targetW}px`;
                slot.placedElement.style.top = `${slot.row * targetH}px`;
                slot.placedElement.style.backgroundSize = `${boardRect.width}px ${boardRect.height}px`;
                slot.placedElement.style.backgroundPosition = `-${slot.col * targetW}px -${slot.row * targetH}px`;
            }
        });

        // 2. Cập nhật kích thước các ô và mảnh ghép trên khay
        const trayGridRect = this.piecesTrayGrid ? this.piecesTrayGrid.getBoundingClientRect() : null;
        const availableColW = (trayGridRect && trayGridRect.width > 0) ? Math.floor((trayGridRect.width - 24) / 2) : 105;
        const maxTrayCap = this.cols >= 4 ? 100 : 150;
        const trayW = Math.max(60, Math.min(maxTrayCap, availableColW));
        const pieceAspect = targetW / targetH;
        const trayH = Math.round(trayW / pieceAspect);
        const slotDim = this.allowRotation ? Math.max(trayW, trayH) : null;

        this.piecesData.forEach(p => {
            p.width = targetW;
            p.height = targetH;
            p.trayWidth = trayW;
            p.trayHeight = trayH;

            if (p.traySlotElement) {
                p.traySlotElement.style.width = slotDim ? `${slotDim}px` : `${trayW}px`;
                p.traySlotElement.style.height = slotDim ? `${slotDim}px` : `${trayH}px`;
            }

            if (!p.isPlaced && p.element && !p.element.classList.contains('is-dragging')) {
                p.element.style.width = `${trayW}px`;
                p.element.style.height = `${trayH}px`;
                p.element.style.backgroundSize = `${trayW * this.cols}px ${trayH * this.rows}px`;
                p.element.style.backgroundPosition = `-${p.col * trayW}px -${p.row * trayH}px`;
                p.element.style.setProperty('--piece-rotation', `${p.rotation}deg`);
                this.updateRotateBadge(p);
            }
        });
    },

    updateProgressUI() {
        const barEl = document.getElementById('progress-bar');
        const counterEl = document.getElementById('progress-counter');
        const pct = this.totalPieces > 0 ? Math.round((this.placedPiecesCount / this.totalPieces) * 100) : 0;

        if (barEl) {
            barEl.style.width = `${pct}%`;
            barEl.classList.remove('progress-pulse');
            void barEl.offsetWidth;
            barEl.classList.add('progress-pulse');
        }
        if (counterEl) {
            counterEl.innerText = `${this.placedPiecesCount}/${this.totalPieces} mảnh`;
        }
    }
};

