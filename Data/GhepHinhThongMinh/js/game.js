// game.js - Bộ điều phối chính của trò chơi (Main Game Controller)
const GameManager = {
    gameData: null,
    currentLevel: 1,
    isGameOver: false,
    settings: {
        hintTimeout: 10,
        snapDistance: 60,
        autoVoice: true
    },
    victoryTimeoutId: null,

    async init() {
        // Khởi tạo các module con
        if (typeof SoundManager !== 'undefined') SoundManager.init();
        if (typeof ScoreManager !== 'undefined') ScoreManager.init();
        if (typeof AIHelper !== 'undefined') AIHelper.init();
        if (typeof PuzzleManager !== 'undefined') PuzzleManager.init();

        // Nạp dữ liệu từ data/data.json
        await this.loadGameData();

        // Khởi tạo DragDropManager với ngưỡng snapDistance từ data.json
        if (typeof DragDropManager !== 'undefined') {
            DragDropManager.init(this.settings.snapDistance);
        }

        // Bắt sự kiện các nút điều khiển
        this.bindEvents();

        // Kiểm tra xem có ván chơi dở dang được lưu trong LocalStorage không (khi bé F5 reload trang)
        const savedState = this.getSavedGameState();
        const hasUnfinishedGame = savedState && savedState.pieces && savedState.pieces.some(p => !p.isPlaced);

        if (hasUnfinishedGame) {
            console.log('🔄 Tìm thấy tiến trình chơi trước đó, đang khôi phục...');
            this.restoreSavedGame(savedState);
        } else {
            this.clearSavedGameState();
            // Hiển thị màn hình chọn cấp độ lúc bắt đầu vào game (chưa load mảnh ghép và chưa tính giờ)
            this.showLevelSelect();
        }
    },

    getLevels() {
        return (this.gameData && (this.gameData.data || this.gameData.levels)) || [];
    },

    getImageSrc() {
        return (this.gameData && this.gameData.src) || 'assets/images/Pic1.png';
    },

    async loadGameData() {
        try {
            const response = await fetch('data/data.json');
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            this.gameData = await response.json();
            console.log('✅ Đã nạp thành công data/data.json:', this.gameData);

            // Nạp settings
            if (this.gameData.settings) {
                this.settings = Object.assign(this.settings, this.gameData.settings);
            }

            // Nạp ảnh robot vào game và màn hình chọn level
            if (this.gameData.mascotImage) {
                const robotImg = document.getElementById('robot-mascot-img');
                if (robotImg) robotImg.src = this.gameData.mascotImage;

                const selectRobotImg = document.getElementById('level-select-robot-img');
                if (selectRobotImg) selectRobotImg.src = this.gameData.mascotImage;
            }

            // Nạp tranh mẫu ban đầu
            const sampleThumb = document.getElementById('sample-thumbnail');
            if (sampleThumb) {
                sampleThumb.src = this.getImageSrc();
            }

            // Tạo các thẻ chọn cấp độ ở màn hình chọn level
            this.renderLevelSelectCards();
        } catch (error) {
            console.error('❌ Lỗi tải file data/data.json:', error);
        }
    },

    // Hiển thị màn hình chọn cấp độ
    showLevelSelect() {
        // Hủy thao tác kéo nếu đang dở dang
        if (typeof DragDropManager !== 'undefined') {
            DragDropManager.cancelCurrentDrag();
        }

        // Tạm dừng tính giờ và AI helper nếu đang chạy
        if (typeof ScoreManager !== 'undefined') {
            ScoreManager.stop();
        }
        if (typeof AIHelper !== 'undefined') {
            AIHelper.stopTimer();
        }

        // Đóng modal chiến thắng nếu đang mở
        const victoryModal = document.getElementById('modal-victory');
        if (victoryModal) victoryModal.classList.remove('active');

        // Mở modal chọn level
        const selectModal = document.getElementById('modal-level-select');
        if (selectModal) {
            selectModal.classList.add('active');
        }
    },

    // Đóng màn hình chọn cấp độ
    hideLevelSelect() {
        const selectModal = document.getElementById('modal-level-select');
        if (selectModal) {
            selectModal.classList.remove('active');
        }
    },

    // Render danh sách các thẻ cấp độ ở màn hình chọn level (tinh gọn, súc tích)
    renderLevelSelectCards() {
        const container = document.getElementById('level-select-cards');
        if (!container) return;

        const levels = this.getLevels();
        if (levels.length === 0) return;

        container.innerHTML = '';

        const levelThemes = {
            1: { colorClass: 'level-easy' },
            2: { colorClass: 'level-medium' },
            3: { colorClass: 'level-hard' }
        };

        levels.forEach((lvl) => {
            const card = document.createElement('div');
            const theme = levelThemes[lvl.level] || { colorClass: 'level-easy' };
            card.className = `level-select-card ${theme.colorClass}`;
            card.dataset.level = lvl.level;

            const badgeName = lvl.badge || `Cấp ${lvl.level}`;
            const pieces = lvl.totalPieces || (lvl.rows * lvl.cols);
            const rotateIcon = lvl.allowRotation 
                ? ' • <i class="fa-solid fa-arrows-rotate" title="Có xoay mảnh"></i>' 
                : '';

            card.innerHTML = `
                <div class="level-card-badge">${badgeName}</div>
                <div class="level-card-pieces">
                    <span class="level-piece-num">${pieces}</span>
                    <span class="level-piece-unit">mảnh</span>
                </div>
                <div class="level-card-grid">Lưới ${lvl.rows}x${lvl.cols}${rotateIcon}</div>
            `;

            // Bấm trực tiếp vào thẻ để bắt đầu chơi ngay
            card.addEventListener('click', () => {
                if (typeof SoundManager !== 'undefined') SoundManager.play('click');
                this.startLevel(lvl.level);
            });

            container.appendChild(card);
        });
    },

    // Chọn cấp độ và bắt đầu chơi: load ảnh, tạo mảnh ghép, bắt đầu timer
    startLevel(levelNumber) {
        this.hideLevelSelect();
        this.switchLevel(levelNumber);
    },

    // Cập nhật thông tin cấp độ hiện tại trên bảng điều khiển bên trái
    updateCurrentLevelDisplay(levelConfig) {
        const badgeEl = document.getElementById('current-level-badge');
        const infoEl = document.getElementById('current-level-info');
        const cardEl = document.getElementById('current-level-card');

        if (!levelConfig) return;

        const badgeName = levelConfig.badge || `Cấp ${levelConfig.level}`;
        const pieces = levelConfig.totalPieces || (levelConfig.rows * levelConfig.cols);
        const rotateIcon = levelConfig.allowRotation ? ' • <i class="fa-solid fa-arrows-rotate" title="Có xoay mảnh"></i> Xoay' : '';

        if (badgeEl) {
            badgeEl.innerText = badgeName;
            badgeEl.className = `current-level-badge diff-lvl-${levelConfig.level}`;
        }

        if (infoEl) {
            infoEl.innerHTML = `${pieces} mảnh (${levelConfig.rows}x${levelConfig.cols})${rotateIcon}`;
        }

        if (cardEl) {
            cardEl.className = `panel-card current-level-card current-theme-lvl-${levelConfig.level}`;
        }
    },

    // Lưu trạng thái ván chơi hiện tại vào LocalStorage thông qua StorageManager
    saveGameState() {
        if (typeof StorageManager !== 'undefined') {
            return StorageManager.saveCurrentGameState();
        }
    },

    // Lấy dữ liệu ván chơi đã lưu từ LocalStorage
    getSavedGameState() {
        if (typeof StorageManager !== 'undefined') {
            return StorageManager.load();
        }
        return null;
    },

    // Xóa dữ liệu ván chơi đã lưu
    clearSavedGameState() {
        if (typeof StorageManager !== 'undefined') {
            return StorageManager.clear();
        }
    },

    // Khôi phục ván chơi dở dang sau khi F5
    restoreSavedGame(savedState) {
        const levels = this.getLevels();
        if (levels.length === 0) return;

        const levelConfig = levels.find(l => l.level === savedState.level) || levels[0];
        this.currentLevel = levelConfig.level;
        this.isGameOver = false;

        // Xóa hẹn giờ mở modal nếu có
        if (this.victoryTimeoutId) {
            clearTimeout(this.victoryTimeoutId);
            this.victoryTimeoutId = null;
        }

        // Đóng các modal
        this.hideLevelSelect();
        const victoryModal = document.getElementById('modal-victory');
        if (victoryModal) victoryModal.classList.remove('active');

        // Cập nhật thông tin cấp độ đang chơi trên khung bên trái
        this.updateCurrentLevelDisplay(levelConfig);

        // Khôi phục đồng hồ tính giờ và số lần sai
        if (typeof ScoreManager !== 'undefined') {
            ScoreManager.start(savedState.elapsedSeconds || 0, savedState.wrongDrops || 0);
        }

        // Dựng lại khung tranh và khay chứa với dữ liệu đã lưu
        if (typeof PuzzleManager !== 'undefined') {
            PuzzleManager.buildBoard(levelConfig, savedState.imageSrc || this.getImageSrc(), savedState);
        }

        // Bắt đầu đếm ngược cho AI gợi ý
        if (typeof AIHelper !== 'undefined') {
            AIHelper.clearHint();
            AIHelper.startTimer(this.settings.hintTimeout || 10);
            AIHelper.setSpeech('Tiếp tục ghép tranh nhé bé ơi!');
        }
    },

    bindEvents() {
        // Nút chơi lại trên top bar: Chỉ reset lại màn chơi hiện tại (không mở màn chọn level)
        const btnRestart = document.getElementById('btn-restart');
        if (btnRestart) {
            btnRestart.addEventListener('click', () => {
                if (typeof SoundManager !== 'undefined') SoundManager.play('click');
                this.switchLevel(this.currentLevel);
            });
        }

        // Nút chơi lại trong hộp thoại chiến thắng: Khi hoàn thành game thì mới xóa LocalStorage và mở lại màn chọn level
        const btnReplay = document.getElementById('btn-victory-replay');
        if (btnReplay) {
            btnReplay.addEventListener('click', () => {
                if (typeof SoundManager !== 'undefined') SoundManager.play('click');
                document.getElementById('modal-victory').classList.remove('active');
                this.clearSavedGameState();
                this.showLevelSelect();
            });
        }

        // Tự động căn chỉnh lại các mảnh ghép khi co giãn màn hình hoặc toàn màn hình
        let resizeTimer = null;
        const handleResize = () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (typeof PuzzleManager !== 'undefined') {
                    PuzzleManager.adjustResponsiveLayout();
                }
            }, 50);
        };

        window.addEventListener('resize', handleResize);
        document.addEventListener('fullscreenchange', handleResize);
        document.addEventListener('webkitfullscreenchange', handleResize);

        // Tự động lưu tiến trình khi người dùng tắt tab hoặc bấm F5 tải lại trang
        window.addEventListener('beforeunload', () => {
            if (!this.isGameOver && this.currentLevel) {
                this.saveGameState();
            }
        });
    },
 
    // Chuyển sang cấp độ tương ứng (load ảnh và dựng mảnh ghép)
    switchLevel(levelNumber) {
        const levels = this.getLevels();
        if (levels.length === 0) return;

        this.currentLevel = levelNumber;
        this.isGameOver = false;

        // Xóa hẹn giờ mở modal nếu người chơi vừa thắng xong bấm chơi lại ngay
        if (this.victoryTimeoutId) {
            clearTimeout(this.victoryTimeoutId);
            this.victoryTimeoutId = null;
        }

        // Bắt đầu bấm giờ và đặt lại điểm số màn mới
        if (typeof ScoreManager !== 'undefined') {
            ScoreManager.start();
        }

        const levelConfig = levels.find(l => l.level === levelNumber) || levels[0];

        // Cập nhật thông tin cấp độ đang chơi trên khung bên trái
        this.updateCurrentLevelDisplay(levelConfig);

        // Đóng hộp thoại chiến thắng nếu đang mở
        const victoryModal = document.getElementById('modal-victory');
        if (victoryModal) victoryModal.classList.remove('active');

        // Dựng bàn cờ và mảnh ghép cho cấp độ này với ảnh tương ứng
        if (typeof PuzzleManager !== 'undefined') {
            PuzzleManager.buildBoard(levelConfig, this.getImageSrc());
        }

        // Bắt đầu đếm ngược 10s cho AI gợi ý
        if (typeof AIHelper !== 'undefined') {
            AIHelper.clearHint();
            AIHelper.startTimer(this.settings.hintTimeout || 10);
            AIHelper.setSpeech('Kéo mảnh ghép vào khung tranh nhé!');
        }

        // Tự động lưu trạng thái ván mới vào LocalStorage
        this.saveGameState();
    },

    // Xử lý khi ghép xong toàn bộ mảnh - KẾT THÚC GAME LUÔN, KHÔNG QUA MÀN
    handleVictory() {
        this.isGameOver = true;

        // Xóa trạng thái đang chơi dở trong LocalStorage vì bé đã hoàn thành ván này
        this.clearSavedGameState();

        // Dừng đếm thời gian
        if (typeof ScoreManager !== 'undefined') {
            ScoreManager.stop();
        }

        if (typeof AIHelper !== 'undefined') {
            AIHelper.stopTimer();
        }

        // Hiển thị bức tranh hoàn chỉnh sắc nét
        const boardComplete = document.getElementById('board-complete-image');
        if (boardComplete) boardComplete.classList.add('show-victory');

        const boardGhost = document.getElementById('board-ghost-image');
        if (boardGhost) boardGhost.style.opacity = '0';

        // Tính toán điểm số & chuẩn bị giao diện modal chiến thắng (chưa chạy animation vội)
        let scoreData = null;
        if (typeof ScoreManager !== 'undefined') {
            const totalPieces = (typeof PuzzleManager !== 'undefined' && PuzzleManager.totalPieces) || 4;
            const allowRotation = typeof PuzzleManager !== 'undefined' && PuzzleManager.allowRotation;
            scoreData = ScoreManager.calculateScore(totalPieces, allowRotation);
            ScoreManager.prepareVictoryModal(scoreData);
        }

        // Lời chúc mừng từ data.json
        const victoryMsg = (this.gameData && this.gameData.voiceLines && this.gameData.voiceLines.congrats)
            ? this.gameData.voiceLines.congrats
            : 'Chúc mừng bé đã hoàn thành bức tranh tuyệt đẹp!';

        if (typeof AIHelper !== 'undefined') {
            AIHelper.setSpeech(victoryMsg);
        }

        if (this.settings.autoVoice && typeof SoundManager !== 'undefined') {
            SoundManager.speak(victoryMsg);
        }

        // Âm thanh hoàn thành tranh
        if (typeof SoundManager !== 'undefined') {
            SoundManager.play('complete');
        }

        // Cập nhật ảnh vào modal chiến thắng
        const victoryArtwork = document.getElementById('victory-artwork-img');
        if (victoryArtwork) {
            victoryArtwork.src = this.getImageSrc();
        }

        // Sau 850ms (đủ để bé ngắm bức tranh hoàn chỉnh): HIỆN BẢNG MODAL VÀ KÍCH HOẠT HIỆU ỨNG SAO & NHẢY SCORE
        if (this.victoryTimeoutId) {
            clearTimeout(this.victoryTimeoutId);
        }
        this.victoryTimeoutId = setTimeout(() => {
            this.victoryTimeoutId = null;
            const victoryModal = document.getElementById('modal-victory');
            if (victoryModal) {
                victoryModal.classList.add('active');
            }

            // Âm thanh kết thúc rộn rã khi bảng kết quả bật lên
            if (typeof SoundManager !== 'undefined') {
                SoundManager.play('finish');
            }

            // KHI BẢNG ĐÃ XUẤT HIỆN TRÊN MÀN HÌNH -> KÍCH HOẠT HIỆU ỨNG SAO VÀ NHẢY ĐIỂM
            if (typeof ScoreManager !== 'undefined' && scoreData) {
                ScoreManager.playVictoryAnimations(scoreData);
            }
        }, 850);
    }
};

// Khởi động khi tải xong trang
window.addEventListener('DOMContentLoaded', () => {
    GameManager.init();
});
