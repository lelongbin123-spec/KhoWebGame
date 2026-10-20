// dragdrop.js - Xử lý tương tác Kéo - Thả chuột (Pointer Events), Click xoay & Nam châm hút (Magnet Snap)
// Tối ưu hóa hiệu năng cao: rAF Throttling, Zero Layout Thrashing, Memory Safe
const DragDropManager = {
    snapDistance: 60,
    dragThreshold: 6, // Di chuyển hơn 6px mới tính là kéo, dưới 6px là click chuột
    initialized: false,

    dragState: {
        activePiece: null,
        pieceElement: null,
        pointerId: null,
        startX: 0,
        startY: 0,
        pointerDownX: 0,
        pointerDownY: 0,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,

        // Cached layout values (tránh layout thrashing trong pointermove)
        targetSlot: null,
        targetSlotCenterX: 0,
        targetSlotCenterY: 0,
        targetSlotSnapThreshold: 0,
        hoveredSlot: null,          // Ô đang được kéo qua (bất kỳ ô nào)
        allSlotRects: [],           // Cache tọa độ tất cả ô (tính 1 lần khi startDrag)
        pieceW: 0,
        pieceH: 0,
        nextX: 0,
        nextY: 0,
        rafPending: false
    },

    init(snapDistance = 60) {
        this.snapDistance = snapDistance;
        if (this.initialized) return;
        this.initialized = true;

        // Bắt sự kiện kéo chuột/chạm toàn cục đúng một lần duy nhất
        window.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: true });
        window.addEventListener('pointerup', (e) => this.onPointerUp(e));
        window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    },

    onPointerDown(e, pieceData) {
        if (pieceData.isPlaced) return;
        if (typeof GameManager !== 'undefined' && GameManager.isGameOver) return;
        if (e.button !== undefined && e.button !== 0) return; // Chỉ nhận chuột trái hoặc touch

        if (typeof SoundManager !== 'undefined') {
            SoundManager.resumeContext();
        }

        const pieceEl = pieceData.element;
        const rect = pieceEl.getBoundingClientRect();

        this.dragState.activePiece = pieceData;
        this.dragState.pieceElement = pieceEl;
        this.dragState.pointerId = e.pointerId;
        this.dragState.startX = rect.left;
        this.dragState.startY = rect.top;
        this.dragState.pointerDownX = e.clientX;
        this.dragState.pointerDownY = e.clientY;
        this.dragState.offsetX = e.clientX - rect.left;
        this.dragState.offsetY = e.clientY - rect.top;
        this.dragState.isDragging = false;
        this.dragState.nextX = rect.left;
        this.dragState.nextY = rect.top;

        try {
            pieceEl.setPointerCapture(e.pointerId);
        } catch (err) {}
    },

    // Kích hoạt trạng thái kéo khi di chuyển vượt ngưỡng dragThreshold
    startDrag(e) {
        this.dragState.isDragging = true;
        const pieceData = this.dragState.activePiece;
        const pieceEl = this.dragState.pieceElement;

        if (typeof SoundManager !== 'undefined') {
            SoundManager.play('click');
        }

        const rect = pieceEl.getBoundingClientRect();
        this.dragState.offsetX = e.clientX - rect.left;
        this.dragState.offsetY = e.clientY - rect.top;
        this.dragState.nextX = rect.left;
        this.dragState.nextY = rect.top;

        pieceEl.classList.remove('piece-wrong-drop', 'sliding-back');
        pieceEl.classList.add('is-dragging');
        document.body.appendChild(pieceEl);

        pieceEl.style.left = `${rect.left}px`;
        pieceEl.style.top = `${rect.top}px`;

        // Tính và cache trước kích thước khung tranh và ô đích 1 LẦN DUY NHẤT
        if (typeof PuzzleManager !== 'undefined' && PuzzleManager.puzzleBoard) {
            const boardRect = PuzzleManager.puzzleBoard.getBoundingClientRect();
            const cols = PuzzleManager.cols;
            const rows = PuzzleManager.rows;
            const targetW = boardRect.width / cols;
            const targetH = boardRect.height / rows;

            this.dragState.pieceW = targetW;
            this.dragState.pieceH = targetH;

            pieceEl.style.width = `${targetW}px`;
            pieceEl.style.height = `${targetH}px`;
            pieceEl.style.backgroundSize = `${boardRect.width}px ${boardRect.height}px`;
            pieceEl.style.backgroundPosition = `-${pieceData.col * targetW}px -${pieceData.row * targetH}px`;

            // Cache trước tâm của ô đích trên khung tranh
            const targetSlot = PuzzleManager.boardSlots.find(s => s.id === pieceData.id);
            this.dragState.targetSlot = targetSlot;

            if (targetSlot && targetSlot.element) {
                const slotRect = targetSlot.element.getBoundingClientRect();
                this.dragState.targetSlotCenterX = slotRect.left + slotRect.width / 2;
                this.dragState.targetSlotCenterY = slotRect.top + slotRect.height / 2;
                this.dragState.targetSlotSnapThreshold = Math.max(
                    this.snapDistance,
                    Math.min(slotRect.width, slotRect.height) * 0.45
                );
            }

            // Cache tọa độ tất cả ô (dùng cho hover highlight bất kỳ ô nào)
            this.dragState.allSlotRects = PuzzleManager.boardSlots
                .filter(s => s.element && !s.isFilled)
                .map(s => {
                    const r = s.element.getBoundingClientRect();
                    return {
                        slot: s,
                        left: r.left,
                        top: r.top,
                        right: r.right,
                        bottom: r.bottom,
                        cx: r.left + r.width / 2,
                        cy: r.top + r.height / 2
                    };
                });
            this.dragState.hoveredSlot = null;
        }
    },

    onPointerMove(e) {
        if (!this.dragState.activePiece || e.pointerId !== this.dragState.pointerId) return;

        // Nếu chưa bắt đầu kéo, kiểm tra xem con trỏ đã di chuyển vượt ngưỡng chưa
        if (!this.dragState.isDragging) {
            const dx = e.clientX - this.dragState.pointerDownX;
            const dy = e.clientY - this.dragState.pointerDownY;
            if (Math.hypot(dx, dy) >= this.dragThreshold) {
                this.startDrag(e);
            } else {
                return;
            }
        }

        // Lưu vị trí con trỏ mới nhất
        this.dragState.nextX = e.clientX - this.dragState.offsetX;
        this.dragState.nextY = e.clientY - this.dragState.offsetY;

        // Cập nhật DOM theo nhịp khung hình màn hình (requestAnimationFrame - 60fps)
        if (!this.dragState.rafPending) {
            this.dragState.rafPending = true;
            requestAnimationFrame(() => this.updateDragFrame());
        }
    },

    updateDragFrame() {
        this.dragState.rafPending = false;
        if (!this.dragState.isDragging || !this.dragState.pieceElement) return;

        const pieceEl = this.dragState.pieceElement;
        const curX = this.dragState.nextX;
        const curY = this.dragState.nextY;

        pieceEl.style.left = `${curX}px`;
        pieceEl.style.top = `${curY}px`;

        // Kiểm tra nam châm hút dựa trên các tọa độ đã được cache (KHÔNG gọi getBoundingClientRect!)
        this.checkMagnetHover(curX, curY);
    },

    checkMagnetHover(pieceLeft, pieceTop) {
        const pieceData = this.dragState.activePiece;
        if (!pieceData) return;

        const pW = this.dragState.pieceW;
        const pH = this.dragState.pieceH;
        const pCX = pieceLeft + pW / 2;
        const pCY = pieceTop + pH / 2;

        // Tìm ô đang được bay qua (tâm mảnh nằm trong bounding box của ô)
        let newHovered = null;
        for (const sr of this.dragState.allSlotRects) {
            if (pCX >= sr.left && pCX <= sr.right && pCY >= sr.top && pCY <= sr.bottom) {
                newHovered = sr.slot;
                break;
            }
        }

        // Xóa highlight ô cũ nếu đổi ô
        if (this.dragState.hoveredSlot && this.dragState.hoveredSlot !== newHovered) {
            this.dragState.hoveredSlot.element.classList.remove('slot-hover', 'slot-hover-correct', 'slot-hover-wrong', 'magnet-hover', 'rotate-needed-hover');
        }

        this.dragState.hoveredSlot = newHovered;

        if (newHovered && newHovered.element) {
            // Xác định đây có phải ô đúng của mảnh không
            const isCorrectSlot = (newHovered.id === pieceData.id);
            const isCorrectOrientation = !PuzzleManager.allowRotation || (pieceData.rotation % 360 === 0);

            newHovered.element.classList.remove('slot-hover', 'slot-hover-correct', 'slot-hover-wrong', 'magnet-hover', 'rotate-needed-hover');

            if (isCorrectSlot && isCorrectOrientation) {
                // Ô đúng + chiều đúng → hiệu ứng xanh (magnet)
                newHovered.element.classList.add('slot-hover', 'slot-hover-correct', 'magnet-hover');
            } else if (isCorrectSlot && !isCorrectOrientation) {
                // Ô đúng nhưng sai chiều → hiệu ứng vàng
                newHovered.element.classList.add('slot-hover', 'rotate-needed-hover');
            } else {
                // Ô sai → hiệu ứng đỏ nhạt
                newHovered.element.classList.add('slot-hover', 'slot-hover-wrong');
            }
        }
    },

    onPointerUp(e) {
        if (!this.dragState.activePiece || e.pointerId !== this.dragState.pointerId) return;

        const pieceData = this.dragState.activePiece;
        const pieceEl = this.dragState.pieceElement;
        const wasDragging = this.dragState.isDragging;

        try {
            pieceEl.releasePointerCapture(e.pointerId);
        } catch (err) {}

        // TRƯỜNG HỢP 1: HỌC SINH CHỈ CLICK VÀO MẢNH GHÉP (KHÔNG KÉO)
        if (!wasDragging) {
            // Nếu mảnh đang ở trạng thái floating sai vị trí (nằm trên body),
            // giữ nguyên vị trí đó và không xử lý gì thêm
            const isWrongDropped = pieceEl.parentElement === document.body;
            if (isWrongDropped) {
                // Đảm bảo class piece-wrong-drop vẫn còn để giữ position: fixed
                pieceEl.classList.add('piece-wrong-drop');
                this.resetDragState();
                // Xoay nếu allowRotation
                if (typeof PuzzleManager !== 'undefined' && PuzzleManager.allowRotation) {
                    PuzzleManager.rotatePiece(pieceData);
                }
                return;
            }

            this.resetDragState();

            // Nếu cấp độ bật tính năng xoay: chỉ cần click vào mảnh ghép là xoay chiều được
            if (typeof PuzzleManager !== 'undefined' && PuzzleManager.allowRotation) {
                PuzzleManager.rotatePiece(pieceData);
            } else {
                if (typeof SoundManager !== 'undefined') {
                    SoundManager.play('click');
                }
            }
            return;
        }

        // TRƯỜNG HỢP 2: ĐANG KÉO THẢ MẢNH GHÉP (DRAG & DROP)
        // Xóa toàn bộ class highlight trên mọi ô
        if (typeof PuzzleManager !== 'undefined') {
            PuzzleManager.boardSlots.forEach(s => {
                if (s.element) {
                    s.element.classList.remove('slot-hover', 'slot-hover-correct', 'slot-hover-wrong', 'magnet-hover', 'rotate-needed-hover');
                }
            });
        }

        const targetSlot = this.dragState.targetSlot || (PuzzleManager.boardSlots.find(s => s.id === pieceData.id));
        const droppedOnSlot = this.dragState.hoveredSlot; // Ô mà mảnh đang nằm lên khi thả

        const isCorrectOrientation = !PuzzleManager.allowRotation || (pieceData.rotation % 360 === 0);
        // Ghép đúng: thả đúng vào ô của mảnh VÀ chiều xoay đúng
        const isCorrectDrop = droppedOnSlot && (droppedOnSlot.id === pieceData.id) && isCorrectOrientation;

        if (isCorrectDrop) {
            // GHÉP ĐÚNG → âm thanh đúng + cố định mảnh vào khung tranh
            if (typeof SoundManager !== 'undefined') {
                SoundManager.play('correct');
            }

            PuzzleManager.placePiece(pieceData, targetSlot);

            // Xóa highlight gợi ý và reset đồng hồ 10 giây
            if (typeof AIHelper !== 'undefined') {
                AIHelper.clearHint();
                AIHelper.resetTimer();

                // Lời khen ngẫu nhiên từ data.json
                if (GameManager.gameData && GameManager.gameData.voiceLines && GameManager.gameData.voiceLines.correct) {
                    const praises = GameManager.gameData.voiceLines.correct;
                    const randomPraise = praises[Math.floor(Math.random() * praises.length)];
                    AIHelper.setSpeech(randomPraise);
                }
            }

            this.resetDragState();
        } else {
            // GHÉP SAI HOẶC THẢ NGOÀI Ô
            if (typeof SoundManager !== 'undefined') {
                SoundManager.play('wrong');
            }

            // Ghi nhận số lần ghép sai vào thống kê tính điểm
            if (typeof ScoreManager !== 'undefined') {
                ScoreManager.recordWrongDrop();
            }

            if (!droppedOnSlot) {
                // TRƯỜNG HỢP A: Thả không trúng ô nào → trượt lùi về khay ban đầu
                this.resetDragState();
                PuzzleManager.returnPiece(pieceData);
            } else {
                // TRƯỜNG HỢP B: Thả trúng ô (sai ô hoặc sai chiều xoay) → mảnh ở lại vị trí thả

                // Nếu thả đúng ô nhưng sai chiều xoay: AI nhắc bé click xoay mảnh
                const droppedOnCorrectSlot = (droppedOnSlot.id === pieceData.id);
                if (droppedOnCorrectSlot && !isCorrectOrientation && typeof AIHelper !== 'undefined') {
                    const rotateHintMsg = (GameManager.gameData && GameManager.gameData.voiceLines && GameManager.gameData.voiceLines.rotateHint)
                        ? GameManager.gameData.voiceLines.rotateHint
                        : 'Bé hãy bấm vào mảnh ghép để xoay cho đúng chiều nhé!';
                    AIHelper.setSpeech(rotateHintMsg, true);
                    if (GameManager.settings && GameManager.settings.autoVoice && typeof SoundManager !== 'undefined') {
                        SoundManager.speak(rotateHintMsg);
                    }
                }

                // Mảnh ở lại tại vị trí thả (body), sẵn sàng kéo tiếp
                pieceEl.classList.remove('is-dragging', 'sliding-back');
                pieceEl.classList.add('piece-wrong-drop');
                pieceEl.style.pointerEvents = '';

                this.resetDragState();
            }
        }
    },

    // Hủy trạng thái kéo hiện tại an toàn (ví dụ khi bé đang kéo mà bấm Chơi lại / Đổi cấp độ)
    cancelCurrentDrag() {
        // Dọn tất cả mảnh đang ở trạng thái sai (piece-wrong-drop) nằm trên body → trả về khay
        if (typeof PuzzleManager !== 'undefined') {
            document.querySelectorAll('body > .puzzle-piece.piece-wrong-drop').forEach(el => {
                const pid = parseInt(el.dataset.pieceId, 10);
                const pd = PuzzleManager.piecesData.find(p => p.id === pid);
                if (pd && pd.traySlotElement) {
                    el.classList.remove('piece-wrong-drop', 'is-dragging', 'sliding-back');
                    el.style.position = 'relative';
                    el.style.left = '';
                    el.style.top = '';
                    el.style.width = `${pd.trayWidth}px`;
                    el.style.height = `${pd.trayHeight}px`;
                    pd.traySlotElement.appendChild(el);
                } else {
                    el.remove();
                }
            });
        }

        if (!this.dragState.activePiece) return;

        const pieceData = this.dragState.activePiece;
        const pieceEl = this.dragState.pieceElement;

        if (this.dragState.pointerId !== null && pieceEl) {
            try {
                pieceEl.releasePointerCapture(this.dragState.pointerId);
            } catch (e) {}
        }

        if (typeof PuzzleManager !== 'undefined' && PuzzleManager.boardSlots) {
            PuzzleManager.boardSlots.forEach(s => {
                if (s.element) {
                    s.element.classList.remove('slot-hover', 'slot-hover-correct', 'slot-hover-wrong', 'magnet-hover', 'rotate-needed-hover');
                }
            });
        }

        if (pieceEl && pieceEl.parentElement === document.body) {
            pieceEl.classList.remove('is-dragging', 'sliding-back', 'piece-wrong-drop');
            if (pieceData.traySlotElement) {
                pieceData.traySlotElement.appendChild(pieceEl);
                pieceEl.style.position = 'relative';
                pieceEl.style.left = '';
                pieceEl.style.top = '';
                pieceEl.style.width = `${pieceData.trayWidth}px`;
                pieceEl.style.height = `${pieceData.trayHeight}px`;
            } else {
                pieceEl.remove();
            }
        }

        this.resetDragState();
    },

    resetDragState() {
        this.dragState.activePiece = null;
        this.dragState.pieceElement = null;
        this.dragState.pointerId = null;
        this.dragState.isDragging = false;
        this.dragState.targetSlot = null;
        this.dragState.targetSlotCenterX = 0;
        this.dragState.targetSlotCenterY = 0;
        this.dragState.targetSlotSnapThreshold = 0;
        this.dragState.hoveredSlot = null;
        this.dragState.allSlotRects = [];
        this.dragState.pieceW = 0;
        this.dragState.pieceH = 0;
        this.dragState.nextX = 0;
        this.dragState.nextY = 0;
        this.dragState.rafPending = false;
    }
};
