// storageManager.js - Quản lý lưu trữ và khôi phục trạng thái trò chơi vào LocalStorage
const StorageManager = {
    STORAGE_KEY: 'ghep_hinh_saved_game',
    
    // Thời hạn tối đa cho dữ liệu lưu trữ: 30 phút (30 * 60 * 1000 = 1.800.000 ms)
    MAX_SESSION_AGE: 30 * 60 * 1000,

    // Kiểm tra xem timestamp đã quá hạn 30 phút chưa
    isExpired(timestamp) {
        if (!timestamp) return true;
        return (Date.now() - timestamp) > this.MAX_SESSION_AGE;
    },

    // Kiểm tra và xóa sạch LocalStorage nếu dữ liệu đã lưu hơn 30 phút
    checkAndClearExpired() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data && data.timestamp && this.isExpired(data.timestamp)) {
                console.log('⏰ Dữ liệu LocalStorage đã lưu hơn 30 phút, tự động xóa sạch.');
                this.clear();
                return true;
            }
        } catch (e) {
            this.clear();
        }
        return false;
    },

    // Lưu đối tượng trạng thái vào LocalStorage (Lưu trữ cục bộ) kèm timestamp
    save(state) {
        if (!state) return false;
        try {
            // Đảm bảo luôn có mốc thời gian lưu
            state.timestamp = state.timestamp || Date.now();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
            // Dọn dẹp session cũ nếu có
            try { sessionStorage.removeItem(this.STORAGE_KEY); } catch (e) {}
            return true;
        } catch (e) {
            console.warn('⚠️ [StorageManager] Không thể lưu tiến trình vào LocalStorage:', e);
            return false;
        }
    },

    // Đọc trạng thái ván chơi đã lưu từ LocalStorage (tự động xóa sạch nếu đã lưu hơn 30 phút)
    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return null;

            const data = JSON.parse(raw);
            if (!data || !data.level || !Array.isArray(data.pieces)) return null;

            // KIỂM TRA THỜI GIAN LƯU: Nếu quá 30 phút -> XÓA SẠCH LocalStorage và trả về null
            if (this.isExpired(data.timestamp)) {
                console.log('⏰ Tiến trình ván chơi đã lưu hơn 30 phút, tự động xóa sạch LocalStorage để trở về mặc định.');
                this.clear();
                return null;
            }

            return data;
        } catch (e) {
            console.warn('⚠️ [StorageManager] Lỗi đọc dữ liệu từ LocalStorage:', e);
            return null;
        }
    },

    // Xóa dữ liệu ván chơi đã lưu trong LocalStorage
    clear() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            try { sessionStorage.removeItem(this.STORAGE_KEY); } catch (e) {}
            return true;
        } catch (e) {
            console.warn('⚠️ [StorageManager] Lỗi xóa dữ liệu LocalStorage:', e);
            return false;
        }
    },

    // Kiểm tra xem có ván chơi dở dang chưa hoàn thành không (chỉ chấp nhận trong vòng 30 phút)
    hasUnfinishedGame() {
        const data = this.load();
        if (!data || !Array.isArray(data.pieces)) return false;
        return data.pieces.some(p => !p.isPlaced);
    },

    // Thu thập toàn bộ trạng thái hiện tại từ các module và lưu vào LocalStorage
    saveCurrentGameState() {
        // Nếu game đã kết thúc hoàn thành: XÓA sạch LocalStorage
        if (typeof GameManager === 'undefined' || GameManager.isGameOver) {
            this.clear();
            return false;
        }
        if (typeof PuzzleManager === 'undefined' || !PuzzleManager.piecesData || PuzzleManager.piecesData.length === 0) {
            return false;
        }

        // Nếu tất cả mảnh đã ghép xong (bé đã hoàn thành game): XÓA sạch LocalStorage
        const hasUnplaced = PuzzleManager.piecesData.some(p => !p.isPlaced);
        if (!hasUnplaced) {
            this.clear();
            return false;
        }

        const state = {
            level: GameManager.currentLevel || 1,
            imageSrc: (GameManager.getImageSrc && GameManager.getImageSrc()) || 'assets/images/Pic1.png',
            trayOrder: PuzzleManager.trayOrder || [],
            pieces: PuzzleManager.piecesData.map(p => ({
                id: p.id,
                rotation: p.rotation || 0,
                isPlaced: Boolean(p.isPlaced)
            })),
            elapsedSeconds: (typeof ScoreManager !== 'undefined') ? ScoreManager.elapsedSeconds : 0,
            wrongDrops: (typeof ScoreManager !== 'undefined') ? ScoreManager.wrongDrops : 0,
            timestamp: Date.now()
        };

        return this.save(state);
    }
};

// Tự động kiểm tra và dọn dẹp LocalStorage quá 30 phút ngay khi nạp trang
if (typeof window !== 'undefined') {
    StorageManager.checkAndClearExpired();
    // Kiểm tra lại khi người dùng quay lại tab trình duyệt
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            StorageManager.checkAndClearExpired();
        }
    });
}
