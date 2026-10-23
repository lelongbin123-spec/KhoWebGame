/**
 * storageManager.js - Quản lý lưu trữ và khôi phục trạng thái trò chơi Vượt Ghềnh vào LocalStorage
 */
const StorageManager = {
  STORAGE_KEY: 'VuotGhenh_game',

  // Thời hạn tối đa cho dữ liệu lưu trữ: 30 phút (30 * 60 * 1000 = 1.800.000 ms)
  MAX_SESSION_AGE: 30 * 60 * 1000,

  /**
   * Kiểm tra mốc thời gian lưu đã quá hạn 30 phút chưa
   */
  isExpired(timestamp) {
    if (!timestamp) return true;
    return (Date.now() - timestamp) > this.MAX_SESSION_AGE;
  },

  /**
   * Tự động xóa dữ liệu LocalStorage nếu đã lưu hơn 30 phút
   */
  checkAndClearExpired() {
    try {
      if (typeof localStorage === 'undefined') return false;
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data && data.timestamp && this.isExpired(data.timestamp)) {
        this.clear();
        return true;
      }
    } catch {
      this.clear();
    }
    return false;
  },

  /**
   * Lưu đối tượng trạng thái vào LocalStorage
   */
  save(state) {
    if (!state) return false;
    try {
      if (typeof localStorage === 'undefined') return false;
      state.timestamp = Date.now();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('[StorageManager] Không thể lưu vào LocalStorage:', e);
      return false;
    }
  },

  /**
   * Đọc dữ liệu ván chơi đã lưu từ LocalStorage
   */
  load() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (!data || typeof data.levelIndex !== 'number' || typeof data.currentStep !== 'number') {
        return null;
      }

      // Xóa nếu quá 30 phút
      if (this.isExpired(data.timestamp)) {
        this.clear();
        return null;
      }

      return data;
    } catch (e) {
      console.warn('[StorageManager] Lỗi đọc dữ liệu từ LocalStorage:', e);
      return null;
    }
  },

  /**
   * Xóa sạch dữ liệu ván chơi trong LocalStorage
   */
  clear() {
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (e) {
      console.warn('[StorageManager] Lỗi xóa LocalStorage:', e);
      return false;
    }
  },

  /**
   * Kiểm tra xem có ván chơi dở dang chưa hoàn thành không
   */
  hasUnfinishedGame() {
    const data = this.load();
    if (!data || typeof data.levelIndex !== 'number') {
      return false;
    }
    const totalSteps = data.totalSteps || 10;
    const currentStep = data.currentStep || 0;
    return (currentStep > 0 || data.levelIndex > 0) && currentStep < totalSteps;
  },

  /**
   * Thu thập toàn bộ trạng thái hiện tại từ trò chơi và lưu vào LocalStorage
   */
  saveGameState(game) {
    if (!game) return false;

    // Xác định thông tin màn chơi
    const levels = Array.isArray(game.config?.data) ? game.config.data : [];
    let levelIndex = 0;
    if (game.selectedLevelId !== undefined) {
      const foundIdx = levels.findIndex(l => String(l.id) === String(game.selectedLevelId));
      if (foundIdx >= 0) levelIndex = foundIdx;
    } else if (typeof game.currentLevelIndex === 'number') {
      levelIndex = game.currentLevelIndex;
    } else if (typeof game.levelIndex === 'number') {
      levelIndex = game.levelIndex;
    }

    const levelObj = levels[levelIndex] || {};
    const levelId = game.selectedLevelId ?? levelObj.id ?? (levelIndex + 1);
    const totalLevels = levels.length > 0 ? levels.length : (Array.isArray(game.levels) ? game.levels.length : 1);
    const currentStep = game.rocksPassed ?? game.currentStep ?? 0;
    const totalSteps = Array.isArray(game.progression) ? game.progression.length : (game.totalSteps ?? 10);

    // Màn cuối cùng và đã vượt hết các bậc: xóa lưu (hoàn thành trò chơi)
    const isLastLevel = (levelIndex >= totalLevels - 1);
    if (isLastLevel && totalSteps > 0 && currentStep >= totalSteps) {
      this.clear();
      return false;
    }

    // Nếu game over hoặc thua, xóa lưu
    if (game.state === "GAME_OVER" || game.isGameOver) {
      this.clear();
      return false;
    }

    const passedWords = Array.isArray(game.progression)
      ? game.progression.slice(0, currentStep).map(item => item.target)
      : (Array.isArray(game.passedWords) ? game.passedWords : []);

    const targetText = game.rocks?.currentRock?.letter || game.targetText || '';
    const timeLeft = typeof game.remaining === 'number' ? game.remaining : (typeof game.timeLeft === 'number' ? game.timeLeft : null);
    const progressionTargets = Array.isArray(game.progression) ? game.progression.map(p => p.target) : [];

    const background = game.currentBackground || (game.el?.scene?.style?.backgroundImage
      ? game.el.scene.style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '')
      : null);

    const state = {
      levelId: levelId,
      levelIndex: levelIndex,
      levelName: levelObj.name || game.levelName || 'Màn chơi',
      score: typeof game.score === 'number' ? game.score : 0,
      currentStep: currentStep,
      totalSteps: totalSteps,
      passedWords: passedWords,
      targetText: targetText,
      timeLeft: timeLeft,
      progressionTargets: progressionTargets,
      background: background,
      timestamp: Date.now()
    };

    return this.save(state);
  }
};

// Khởi chạy dọn dẹp dữ liệu hết hạn
if (typeof window !== 'undefined') {
  StorageManager.checkAndClearExpired();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        StorageManager.checkAndClearExpired();
      }
    });
  }
}

export { StorageManager };
