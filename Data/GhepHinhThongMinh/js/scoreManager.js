// scoreManager.js - Quản lý tính điểm, đếm thời gian và hiển thị thống kê kết quả
const ScoreManager = {
    startTime: 0,
    endTime: 0,
    elapsedSeconds: 0,
    timerInterval: null,
    wrongDrops: 0,
    timerDigitsEl: null,
    isTimerRunning: false,

    initialized: false,
    counterRafId: null,
    counterTimeoutId: null,
    starTimeoutIds: [],

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.timerDigitsEl = document.getElementById('header-timer-digits');
        this.reset();
    },

    // Bắt đầu tính giờ cho màn chơi mới (hỗ trợ khôi phục khi F5)
    start(initialSeconds = 0, initialWrongDrops = 0) {
        this.reset();
        this.elapsedSeconds = initialSeconds || 0;
        this.wrongDrops = initialWrongDrops || 0;
        this.startTime = Date.now() - (this.elapsedSeconds * 1000);
        this.endTime = 0;
        this.isTimerRunning = true;
        this.updateHeaderTimerDisplay();

        this.timerInterval = setInterval(() => {
            if (!this.isTimerRunning) return;
            this.elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.startTime) / 1000));
            this.updateHeaderTimerDisplay();
        }, 1000);
    },

    // Dừng đồng hồ đếm thời gian khi hoàn thành màn chơi
    stop() {
        this.isTimerRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.startTime > 0 && !this.endTime) {
            this.endTime = Date.now();
            this.elapsedSeconds = Math.max(1, Math.round((this.endTime - this.startTime) / 1000));
            this.updateHeaderTimerDisplay();
        }
    },

    clearVictoryAnimations() {
        if (this.counterTimeoutId) {
            clearTimeout(this.counterTimeoutId);
            this.counterTimeoutId = null;
        }
        if (this.counterRafId) {
            cancelAnimationFrame(this.counterRafId);
            this.counterRafId = null;
        }
        if (this.starTimeoutIds && this.starTimeoutIds.length > 0) {
            this.starTimeoutIds.forEach(id => clearTimeout(id));
            this.starTimeoutIds = [];
        }
    },

    // Đặt lại dữ liệu ban đầu
    reset() {
        this.isTimerRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.clearVictoryAnimations();
        this.startTime = 0;
        this.endTime = 0;
        this.elapsedSeconds = 0;
        this.wrongDrops = 0;
        this.updateHeaderTimerDisplay();
    },

    // Ghi nhận một lượt kéo thả sai (vị trí hoặc chiều xoay)
    recordWrongDrop() {
        this.wrongDrops++;
        if (typeof StorageManager !== 'undefined') {
            StorageManager.saveCurrentGameState();
        } else if (typeof GameManager !== 'undefined' && GameManager.saveGameState) {
            GameManager.saveGameState();
        }
    },

    // Cập nhật số hiển thị trên đồng hồ header (định dạng mm:ss)
    updateHeaderTimerDisplay() {
        if (!this.timerDigitsEl) {
            this.timerDigitsEl = document.getElementById('header-timer-digits');
        }
        if (!this.timerDigitsEl) return;

        const sec = this.elapsedSeconds || 0;
        const mins = Math.floor(sec / 60);
        const remSec = sec % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
        this.timerDigitsEl.innerText = formatted;
    },

    // SUY LUẬN CÔNG THỨC TÍNH ĐIỂM (100 ĐIỂM CHUẨN)
    calculateScore(totalPieces = 4, allowRotation = false) {
        const elapsedSec = Math.max(1, this.elapsedSeconds);
        const wrongCount = this.wrongDrops || 0;

        // 1. Điểm chính xác (Tối đa 60 điểm - 60% trọng số)
        const totalAttempts = totalPieces + wrongCount;
        const accuracyRate = totalAttempts > 0 ? (totalPieces / totalAttempts) : 1;
        const accuracyScore = Math.round(60 * accuracyRate);

        // 2. Điểm thời gian (Tối đa 40 điểm - 40% trọng số)
        let targetTime = 30; // Cấp 1 (4 mảnh): 30s
        if (totalPieces >= 9) targetTime = 80;      // Cấp 3 (9 mảnh): 80s
        else if (totalPieces >= 6) targetTime = 50; // Cấp 2 (6 mảnh): 50s

        const maxTime = targetTime * 2.5;
        let timeScore = 40;
        if (elapsedSec > targetTime) {
            const timePenaltyFactor = Math.min(1, (elapsedSec - targetTime) / (maxTime - targetTime));
            timeScore = Math.round(40 * (1 - 0.75 * timePenaltyFactor));
        }
        timeScore = Math.max(10, timeScore);

        // 3. Thưởng độ khó (Thêm 5 điểm nếu có tính năng xoay mảnh ghép)
        const difficultyBonus = allowRotation ? 5 : 0;

        const totalScore = Math.min(100, accuracyScore + timeScore + difficultyBonus);

        // Xếp hạng sao
        let stars = 1;
        if (totalScore >= 80) {
            stars = 3;
        } else if (totalScore >= 60) {
            stars = 2;
        }
        // Định dạng thời gian và độ chính xác khi end game
        const mins = Math.floor(elapsedSec / 60);
        const secs = elapsedSec % 60;
        const timeFormatted = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`;
        const accuracyPct = Math.round(accuracyRate * 100);

        return {
            totalScore,
            stars,
            elapsedSec,
            timeFormatted,
            accuracyPct,
            wrongCount,
            accuracyScore,
            timeScore
        };
    },

    // 1. Chuẩn bị bảng kết quả tĩnh trước khi hiện modal (tiêu đề, thời gian, % chính xác, reset điểm và sao về ban đầu)
    prepareVictoryModal(scoreData) {
        this.clearVictoryAnimations();

        // Tiêu đề theo số sao
        const headingEl = document.getElementById('victory-heading');
        if (headingEl) {
            if (scoreData.stars === 3) headingEl.innerText = '🎉 Tuyệt Vời! 3 Sao Xuất Sắc!';
            else if (scoreData.stars === 2) headingEl.innerText = '👏 Giỏi Lắm! Bé Đạt 2 Sao!';
            else headingEl.innerText = '✨ Hoan Hô! Bé Đã Hoàn Thành!';
        }

        // Đặt lại trạng thái 3 ngôi sao (xóa active, chờ modal hiện mới búng nở)
        const starItems = document.querySelectorAll('.victory-stars .star-item');
        starItems.forEach(starEl => {
            starEl.classList.remove('active');
        });

        // Cập nhật các chỉ số chi tiết (Thời gian & Độ chính xác)
        const timeEl = document.getElementById('victory-stat-time');
        if (timeEl) timeEl.innerText = scoreData.timeFormatted;

        const accEl = document.getElementById('victory-stat-accuracy');
        if (accEl) accEl.innerText = `${scoreData.accuracyPct}%`;

        // Đặt điểm hiển thị về 0 để chuẩn bị chạy nhảy số
        const scoreEl = document.getElementById('victory-total-score');
        if (scoreEl) {
            scoreEl.innerText = '0';
        }
    },

    // 2. KÍCH HOẠT HIỆU ỨNG SAO VÀ NHẢY SCORE KHI MODAL ĐÃ HIỆN TRÊN MÀN HÌNH
    playVictoryAnimations(scoreData) {
        this.clearVictoryAnimations();

        const starItems = document.querySelectorAll('.victory-stars .star-item');
        starItems.forEach(starEl => starEl.classList.remove('active'));

        // A. Hiệu ứng búng nở từng ngôi sao vàng (bắt đầu sau 250ms kể từ khi modal hiện)
        const starDelayBase = 250;
        const starDelayStep = 280;

        for (let index = 0; index < scoreData.stars; index++) {
            const starEl = starItems[index];
            if (!starEl) continue;

            const tId = setTimeout(() => {
                starEl.classList.add('active');
                if (typeof SoundManager !== 'undefined') {
                    SoundManager.play('click');
                }
            }, starDelayBase + index * starDelayStep);

            this.starTimeoutIds.push(tId);
        }

        // B. Hiệu ứng nhảy số điểm cuốn hút từ 0 -> Tổng điểm (bắt đầu đồng bộ sau 300ms)
        const scoreEl = document.getElementById('victory-total-score');
        if (scoreEl) {
            scoreEl.innerText = '0';
            const targetScore = scoreData.totalScore;
            const duration = 1200; // Nhảy số trong 1.2s mượt mà

            this.counterTimeoutId = setTimeout(() => {
                this.counterTimeoutId = null;
                const startTime = performance.now();

                const animateCounter = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const easeOut = 1 - Math.pow(1 - progress, 3);
                    const currentVal = Math.round(easeOut * targetScore);
                    scoreEl.innerText = currentVal.toLocaleString('vi-VN');

                    if (progress < 1) {
                        this.counterRafId = requestAnimationFrame(animateCounter);
                    } else {
                        this.counterRafId = null;
                        scoreEl.innerText = targetScore.toLocaleString('vi-VN');
                    }
                };

                this.counterRafId = requestAnimationFrame(animateCounter);
            }, 300);
        }
    },

    // Hàm gọi gộp để tương thích
    renderVictoryStats(scoreData) {
        this.prepareVictoryModal(scoreData);
        this.playVictoryAnimations(scoreData);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ScoreManager.init();
});
