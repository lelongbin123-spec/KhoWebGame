// aiHelper.js - Xử lý AI Trợ thủ thời gian & Quy tắc đếm ngược 10 giây (10s Rule)
const AIHelper = {
    hintTimer: null,
    hintSecondsLeft: 10,
    timeout: 10,
    isHintActive: false,
    hintPieceId: null,

    // DOM Elements
    timerEl: null,
    speechTextEl: null,
    speechBubbleEl: null,

    init() {
        this.timerEl = document.getElementById('timer-seconds-text');
        this.speechTextEl = document.getElementById('ai-speech-text');
        this.speechBubbleEl = document.getElementById('ai-speech-bubble');
    },

    setSpeech(text, isHint = false) {
        if (this.speechTextEl) {
            this.speechTextEl.innerText = text;
        }
        if (this.speechBubbleEl) {
            this.speechBubbleEl.classList.toggle('active-hint', isHint);
        }
    },

    startTimer(timeout = 10) {
        this.stopTimer();
        this.timeout = timeout;
        this.hintSecondsLeft = timeout;
        this.isHintActive = false;
        this.updateTimerUI();

        this.hintTimer = setInterval(() => {
            if (typeof GameManager !== 'undefined' && GameManager.isGameOver) {
                this.stopTimer();
                return;
            }

            this.hintSecondsLeft--;
            this.updateTimerUI();

            if (this.hintSecondsLeft <= 0) {
                this.stopTimer();
                this.triggerHint();
            }
        }, 1000);
    },

    resetTimer() {
        this.startTimer(this.timeout);
    },

    stopTimer() {
        if (this.hintTimer) {
            clearInterval(this.hintTimer);
            this.hintTimer = null;
        }
    },

    updateTimerUI() {
        if (!this.timerEl) return;
        const sec = Math.max(0, this.hintSecondsLeft);
        this.timerEl.innerText = `${sec}s`;
        if (this.timerEl.parentElement) {
            this.timerEl.parentElement.classList.toggle('urgent', sec <= 3 && sec > 0);
        }
    },

    // Kích hoạt gợi ý khi sau 10s không ghép được lượt nào
    triggerHint() {
        if (typeof GameManager !== 'undefined' && GameManager.isGameOver) return;
        if (typeof PuzzleManager === 'undefined') return;

        const unplacedPieces = PuzzleManager.piecesData.filter(p => !p.isPlaced);
        if (unplacedPieces.length === 0) return;

        const hintPiece = unplacedPieces[0];
        this.hintPieceId = hintPiece.id;
        this.isHintActive = true;

        // Phát âm thanh gợi ý
        if (typeof SoundManager !== 'undefined') {
            SoundManager.play('hint');
        }

        // Lấy câu thoại gợi ý từ data.json (nếu mảnh đang xoay sai chiều thì nhắc bé xoay)
        let hintMsg = (GameManager.gameData && GameManager.gameData.voiceLines && GameManager.gameData.voiceLines.hint)
            ? GameManager.gameData.voiceLines.hint
            : 'Bé ơi, thử ghép mảnh này vào đây xem nhé!';

        if (PuzzleManager.allowRotation && (hintPiece.rotation % 360 !== 0)) {
            hintMsg = (GameManager.gameData && GameManager.gameData.voiceLines && GameManager.gameData.voiceLines.rotateHint)
                ? GameManager.gameData.voiceLines.rotateHint
                : 'Bé hãy bấm vào mảnh ghép để xoay cho đúng chiều nhé!';
        }

        this.setSpeech(hintMsg, true);

        // Đọc giọng AI tiếng Việt
        if (GameManager.settings && GameManager.settings.autoVoice && typeof SoundManager !== 'undefined') {
            SoundManager.speak(hintMsg);
        }

        // 1. Highlight viền vàng mảnh trên khay
        if (hintPiece.element) {
            hintPiece.element.classList.add('ai-hint-piece');
        }

        // 2. Highlight viền vàng ô đích trên khung tranh
        const targetSlot = PuzzleManager.boardSlots.find(s => s.id === hintPiece.id);
        if (targetSlot && targetSlot.element) {
            targetSlot.element.classList.add('ai-hint-slot');
        }
    },

    clearHint() {
        this.isHintActive = false;
        this.hintPieceId = null;

        document.querySelectorAll('.ai-hint-piece').forEach(el => {
            el.classList.remove('ai-hint-piece');
        });

        document.querySelectorAll('.ai-hint-slot').forEach(el => {
            el.classList.remove('ai-hint-slot');
        });

        if (this.speechBubbleEl) {
            this.speechBubbleEl.classList.remove('active-hint');
        }
    }
};

