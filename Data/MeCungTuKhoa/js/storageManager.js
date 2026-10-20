/**
 * storageManager.js - Quản lý lưu trữ và khôi phục trạng thái trò chơi Mê Cung Từ Khóa vào LocalStorage
 */
const StorageManager = {
  STORAGE_KEY: 'me_cung_tu_khoa_saved_game',

  // Thời hạn tối đa cho dữ liệu lưu trữ: 30 phút (30 * 60 * 1000 = 1.800.000 ms)
  MAX_SESSION_AGE: 30 * 60 * 1000,

  /**
   * Kiểm tra xem timestamp đã quá hạn 30 phút chưa
   * @param {number} timestamp - Mốc thời gian lưu (ms)
   * @returns {boolean} True nếu đã hết hạn
   */
  isExpired(timestamp) {
    if (!timestamp) return true;
    return (Date.now() - timestamp) > this.MAX_SESSION_AGE;
  },

  /**
   * Kiểm tra và xóa sạch LocalStorage nếu dữ liệu đã lưu hơn 30 phút
   * @returns {boolean} True nếu vừa xóa dữ liệu hết hạn
   */
  checkAndClearExpired() {
    try {
      if (typeof localStorage === 'undefined') return false;
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data && data.timestamp && this.isExpired(data.timestamp)) {
        console.log('⏰ Dữ liệu LocalStorage đã lưu hơn 30 phút, tự động xóa sạch để đảm bảo ván chơi mới.');
        this.clear();
        return true;
      }
    } catch (e) {
      this.clear();
    }
    return false;
  },

  /**
   * Lưu đối tượng trạng thái vào LocalStorage kèm timestamp
   * @param {Object} state - Trạng thái cần lưu
   * @returns {boolean} True nếu lưu thành công
   */
  save(state) {
    if (!state) return false;
    try {
      if (typeof localStorage === 'undefined') return false;
      state.timestamp = Date.now();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('⚠️ [StorageManager] Không thể lưu tiến trình vào LocalStorage:', e);
      return false;
    }
  },

  /**
   * Đọc trạng thái ván chơi đã lưu từ LocalStorage (tự động xóa sạch nếu đã lưu hơn 30 phút)
   * @returns {Object|null} Dữ liệu ván chơi hoặc null nếu không có/hết hạn
   */
  load() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (!data || typeof data.missionIndex !== 'number' || !Array.isArray(data.activeGrid)) {
        return null;
      }

      // KIỂM TRA THỜI GIAN LƯU: Nếu quá 30 phút -> xóa sạch và trả về null
      if (this.isExpired(data.timestamp)) {
        console.log('⏰ Tiến trình ván chơi đã lưu hơn 30 phút, tự động xóa sạch LocalStorage.');
        this.clear();
        return null;
      }

      return data;
    } catch (e) {
      console.warn('⚠️ [StorageManager] Lỗi đọc dữ liệu từ LocalStorage:', e);
      return null;
    }
  },

  /**
   * Xóa dữ liệu ván chơi đã lưu trong LocalStorage
   * @returns {boolean} True nếu xóa thành công
   */
  clear() {
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (e) {
      console.warn('⚠️ [StorageManager] Lỗi xóa dữ liệu LocalStorage:', e);
      return false;
    }
  },

  /**
   * Kiểm tra xem có ván chơi dở dang chưa hoàn thành không (chỉ chấp nhận trong vòng 30 phút)
   * @returns {boolean} True nếu có ván chơi chưa hoàn thành
   */
  hasUnfinishedGame() {
    const data = this.load();
    if (!data || typeof data.missionIndex !== 'number' || !Array.isArray(data.activeGrid)) {
      return false;
    }
    const total = Array.isArray(data.keywords) ? data.keywords.length : 0;
    const found = Array.isArray(data.foundWords) ? data.foundWords.length : 0;
    return total > 0 && found < total;
  },

  /**
   * Thu thập toàn bộ trạng thái hiện tại từ trò chơi WordMazeGame và lưu vào LocalStorage
   * @param {Object} game - Phiên bản trò chơi WordMazeGame đang chạy
   * @returns {boolean} True nếu lưu thành công
   */
  saveGameState(game) {
    if (!game || !game.currentMission || !game.activeGrid || game.activeGrid.length === 0) {
      return false;
    }

    // Nếu là nhiệm vụ cuối cùng và đã tìm đủ tất cả từ khóa: xóa dữ liệu lưu (hoàn thành trò chơi)
    const isLastMission = (game.currentMissionIndex === (game.missions ? game.missions.length - 1 : -1));
    const totalWords = (game.currentMission.keywords && game.currentMission.keywords.length) || 0;
    const foundWordsCount = game.foundWords ? game.foundWords.size : 0;

    if (isLastMission && totalWords > 0 && foundWordsCount >= totalWords) {
      this.clear();
      return false;
    }

    const state = {
      missionIndex: game.currentMissionIndex,
      activeGrid: game.activeGrid,
      keywords: (game.currentMission.keywords || []).map(kw => ({
        word: kw.word,
        display: kw.display || kw.word,
        cleanWord: kw.cleanWord,
        altCleanWords: kw.altCleanWords,
        row: kw.row,
        col: kw.col,
        dr: kw.dr,
        dc: kw.dc,
        dirName: kw.dirName,
        dirArrow: kw.dirArrow,
        chars: kw.chars,
        cells: kw.cells,
        colorIndex: kw.colorIndex,
        found: Boolean(kw.found),
        hasHint: Boolean(kw.hasHint || kw.hintUsed)
      })),
      foundWords: Array.from(game.foundWords || []),
      score: game.scoreManager ? game.scoreManager.getScore() : 0,
      globalFoundWordsCount: game.scoreManager ? game.scoreManager.getGlobalFoundWordsCount() : 0,
      savedMissionsKeywords: game.savedMissionsKeywords || null,
      timestamp: Date.now()
    };

    return this.save(state);
  }
};

// Xuất ra window và module.exports
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
  StorageManager.checkAndClearExpired();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        StorageManager.checkAndClearExpired();
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}

