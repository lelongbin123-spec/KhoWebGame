/**
 * scoreManager.js - Quản lý toàn bộ điểm số trò chơi Mê Cung Từ Khóa
 * Tính toán 100đ chia đều cho tổng các từ khóa của tất cả các màn chơi kết hợp
 */

class ScoreManager {
  constructor(options = {}) {
    // Tham chiếu các phần tử DOM hiển thị điểm
    this.scoreTextEl = options.scoreTextEl || ((typeof document !== 'undefined' && typeof document.getElementById === 'function') ? document.getElementById('scoreText') : null);
    this.finalScoreEl = options.finalScoreEl || ((typeof document !== 'undefined' && typeof document.getElementById === 'function') ? document.getElementById('finalScore') : null);
    this.maxScoreTextEl = options.maxScoreTextEl || ((typeof document !== 'undefined' && typeof document.getElementById === 'function') ? document.getElementById('maxScoreText') : null);
    this.finalMaxScoreEl = options.finalMaxScoreEl || ((typeof document !== 'undefined' && typeof document.getElementById === 'function') ? document.getElementById('finalMaxScore') : null);
    this.scoreBadge = options.scoreBadge || ((typeof document !== 'undefined' && typeof document.getElementById === 'function') ? document.getElementById('scoreBadge') : null);
    
    // Mức điểm tối đa từ data.json (mặc định 100đ cho toàn bộ trò chơi)
    this.maxScore = (typeof options.maxScore === 'number' && options.maxScore > 0) ? options.maxScore : 100;
    
    // Điểm số tích lũy hiện tại của trò chơi (từ 0 đến maxScore)
    this.currentScore = 0;
    
    // Tổng số từ khóa của toàn bộ game (tất cả các màn gộp lại)
    this.totalGameWords = 0;

    // Số từ khóa đã tìm được trong toàn bộ game
    this.globalFoundWordsCount = 0;
    
    // Danh sách điểm phân bổ đều cho từng từ khóa (tổng đúng bằng maxScore 100đ)
    this.wordPointsMap = [];

    // Mốc điểm tích lũy tại thời điểm bắt đầu mỗi màn chơi (để khôi phục chính xác khi làm mới màn)
    this.missionStartScores = [0];

    // Lịch sử chi tiết điểm của từng từ khóa đã giải
    this.wordsHistory = [];
  }

  /**
   * Tương thích ngược: truy cập số từ đã tìm được
   */
  get foundWordsCount() {
    return this.globalFoundWordsCount;
  }
  set foundWordsCount(val) {
    this.globalFoundWordsCount = val;
  }

  /**
   * Tương thích ngược: truy cập tổng số từ khóa
   */
  get totalWords() {
    return this.totalGameWords;
  }
  set totalWords(val) {
    this.totalGameWords = val;
  }

  /**
   * Thiết lập mức điểm tối đa (lấy theo thẻ maxScore trong data.json, mặc định 100đ)
   * @param {number} maxScore - Mức điểm tối đa (vd: 100)
   */
  setMaxScore(maxScore) {
    if (typeof maxScore === 'number' && maxScore > 0) {
      this.maxScore = maxScore;
    } else {
      this.maxScore = 100;
    }
    // Cập nhật lại phân bổ điểm nếu đã có tổng từ khóa
    if (this.totalGameWords > 0) {
      this.recalculatePointsDistribution();
    }
  }

  /**
   * Tính toán phân bổ điểm đều cho từng từ khóa của toàn bộ trò chơi
   * Sử dụng công thức lũy kế làm tròn để tổng điểm các từ luôn bằng chính xác maxScore (100đ)
   */
  recalculatePointsDistribution() {
    this.wordPointsMap = [];
    const count = Math.max(1, this.totalGameWords);
    let prevTarget = 0;

    for (let i = 1; i <= count; i++) {
      const target = Math.round((i / count) * this.maxScore);
      const pts = target - prevTarget;
      this.wordPointsMap.push(pts);
      prevTarget = target;
    }
  }

  /**
   * Tính mốc điểm chuẩn dựa trên số từ khóa đã tìm được
   * @param {number} foundCount - Số từ đã tìm được
   * @returns {number} Điểm số tương ứng
   */
  getTargetScore(foundCount) {
    const count = Math.max(1, this.totalGameWords);
    const clamped = Math.max(0, Math.min(foundCount, count));
    return Math.round((clamped / count) * this.maxScore);
  }

  /**
   * Khởi tạo toàn bộ trò chơi với tổng số từ khóa của TẤT CẢ các màn chơi
   * @param {number} totalGameWords - Tổng số từ khóa của toàn bộ các màn chơi (vd: 12 từ)
   * @param {number} [maxScore] - Mức điểm tối đa của toàn bộ trò chơi (mặc định 100đ)
   */
  initGame(totalGameWords, maxScore = null) {
    if (maxScore !== null && maxScore !== undefined) {
      this.setMaxScore(maxScore);
    }
    this.totalGameWords = Math.max(1, totalGameWords || 1);
    this.globalFoundWordsCount = 0;
    this.currentScore = 0;
    this.missionStartScores = [0];
    this.wordsHistory = [];

    this.recalculatePointsDistribution();
    this.updateUI();
  }

  /**
   * Khởi tạo tính điểm cho một màn chơi:
   * Nếu keepScore = true, lưu lại mốc điểm tích lũy từ các màn trước.
   * Nếu keepScore = false (chơi lại màn này), khôi phục mốc điểm về lúc bắt đầu màn này.
   * @param {number} missionWordsCount - Số từ khóa của màn chơi hiện tại
   * @param {number} [priorWordsCount=0] - Tổng số từ khóa của các màn chơi đã vượt qua trước đó
   * @param {boolean} [keepScore=false] - Giữ lại điểm tích lũy hiện có
   * @param {number} [missionIndex=0] - Chỉ số màn chơi hiện tại
   */
  initMission(missionWordsCount, priorWordsCount = 0, keepScore = false, missionIndex = 0) {
    if (!this.totalGameWords || this.totalGameWords <= 0) {
      this.totalGameWords = Math.max(1, missionWordsCount || 1);
      this.recalculatePointsDistribution();
    }

    if (keepScore) {
      // Sang màn mới: ghi nhận mốc điểm của màn này
      this.missionStartScores[missionIndex] = this.currentScore;
    } else {
      // Làm mới màn này: quay về điểm tại mốc bắt đầu của màn này
      this.globalFoundWordsCount = Math.max(0, priorWordsCount);
      if (typeof this.missionStartScores[missionIndex] === 'number') {
        this.currentScore = this.missionStartScores[missionIndex];
      } else {
        this.currentScore = 0;
      }
      this.wordsHistory = this.wordsHistory.slice(0, this.globalFoundWordsCount);
    }

    this.updateUI();
  }

  /**
   * Khôi phục trạng thái điểm số đã lưu từ trước (LocalStorage)
   * @param {number} globalFoundCount - Số từ khóa đã tìm được trong toàn bộ game
   * @param {number} currentScore - Điểm số đã tích lũy
   */
  restoreState(globalFoundCount, currentScore) {
    this.globalFoundWordsCount = Math.max(0, (typeof globalFoundCount === 'number' ? globalFoundCount : 0));
    if (typeof currentScore === 'number') {
      this.currentScore = Math.max(0, Math.min(this.maxScore, currentScore));
    } else {
      this.currentScore = this.getTargetScore(this.globalFoundWordsCount);
    }
    this.updateUI();
  }

  /**
   * Lấy số điểm chuẩn phân bổ cho từ khóa thứ `wordIndex` (1-indexed)
   * @param {number} wordIndex - Thứ tự từ khóa trong toàn bộ game
   * @returns {number} Số điểm chuẩn
   */
  getPointsForWord(wordIndex) {
    const idx = wordIndex - 1;
    if (idx >= 0 && idx < this.wordPointsMap.length) {
      return this.wordPointsMap[idx];
    }
    return Math.round(this.maxScore / Math.max(1, this.totalGameWords));
  }

  /**
   * Ghi nhận tìm thấy một từ khóa:
   * - Nếu từ đó tự tìm (không show hint): nhận 100% điểm chuẩn của từ đó.
   * - Nếu từ đó có show hint: điểm số bị giảm 50% (chỉ khi hoàn thành hết không hint mới đạt 100đ tối đa).
   * @param {HTMLElement} [targetCell] - Ô chữ cái cuối cùng của từ khóa trên bảng
   * @param {boolean} [hasHint=false] - Từ khóa này có bị show hint hay không
   * @returns {number} Số điểm thực nhận
   */
  recordWordFound(targetCell = null, hasHint = false) {
    this.globalFoundWordsCount++;
    const basePts = this.getPointsForWord(this.globalFoundWordsCount);

    // Tính điểm thực nhận: nếu có show hint thì giảm 50% điểm của từ khóa đó
    let actualPts = basePts;
    if (hasHint) {
      actualPts = Math.max(1, Math.round(basePts * 0.5));
    }

    this.currentScore = Math.min(this.maxScore, this.currentScore + actualPts);

    this.wordsHistory.push({
      wordIndex: this.globalFoundWordsCount,
      basePts,
      actualPts,
      hasHint: Boolean(hasHint)
    });

    // Cập nhật giao diện và hiệu ứng số điểm cộng
    this.updateUI();
    this.showScoreBadgePlus(actualPts, hasHint);

    return actualPts;
  }

  /**
   * Kiểm tra xem học sinh có từng sử dụng gợi ý ở bất kỳ từ nào không
   * @returns {boolean} True nếu có ít nhất 1 từ dùng gợi ý
   */
  hasAnyHintUsed() {
    return this.wordsHistory.some(w => w.hasHint);
  }
  updateUI() {
    if (this.scoreTextEl) {
      this.scoreTextEl.textContent = this.currentScore;
    }
    if (this.finalScoreEl) {
      this.finalScoreEl.textContent = this.currentScore;
    }
    if (this.maxScoreTextEl) {
      this.maxScoreTextEl.textContent = this.maxScore;
    }
    if (this.finalMaxScoreEl) {
      this.finalMaxScoreEl.textContent = this.maxScore;
    }
  }

  /**
   * Kích hoạt hiệu ứng rung lên tại khung hiển thị điểm số
   */
  triggerScoreImpact() {
    this.updateUI();
    const scoreBadge = this.scoreBadge || ((typeof document !== 'undefined' && typeof document.getElementById === 'function') 
      ? document.getElementById('scoreBadge') 
      : null);
    if (scoreBadge && scoreBadge.classList) {
      scoreBadge.classList.remove('score-bump');
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          scoreBadge.classList.add('score-bump');
        });
      } else {
        scoreBadge.classList.add('score-bump');
      }
    }
  }

  /**
   * Hiển thị số điểm cộng (+X điểm) ngay trên khung hiển thị điểm số
   * @param {number} pts - Số điểm vừa được cộng
   * @param {boolean} [hasHint=false] - Từ khóa này có dùng gợi ý hay không
   */
  showScoreBadgePlus(pts, hasHint = false) {
    const scoreBadge = this.scoreBadge || ((typeof document !== 'undefined' && typeof document.getElementById === 'function') 
      ? document.getElementById('scoreBadge') 
      : null);

    if (!scoreBadge) {
      this.updateUI();
      return;
    }

    // Kích hoạt rung và phát sáng khung điểm số (đã bao gồm updateUI)
    this.triggerScoreImpact();

    // Dọn dẹp hiệu ứng cũ nếu còn trước khi tạo mới
    const oldPlusList = scoreBadge.querySelectorAll ? scoreBadge.querySelectorAll('.score-badge-plus') : [];
    if (oldPlusList && oldPlusList.length > 0) {
      oldPlusList.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    }

    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;

    // Tạo phần tử hiển thị +X điểm bay lên ngay trên khung điểm
    const plusEl = document.createElement('div');
    plusEl.className = 'score-badge-plus';
    if (hasHint) {
      plusEl.classList.add('has-hint');
      plusEl.textContent = `+${pts}đ (Gợi ý)`;
    } else {
      plusEl.textContent = `+${pts}đ ✨`;
    }
    scoreBadge.appendChild(plusEl);

    // Tự động dọn dẹp sau khi animation hoàn tất (850ms)
    setTimeout(() => {
      if (plusEl.parentNode) {
        plusEl.parentNode.removeChild(plusEl);
      }
    }, 850);
  }

  /**
   * Tương thích ngược: chuyển tiếp cuộc gọi showFloatingScore sang showScoreBadgePlus
   */
  showFloatingScore(pts, targetCell = null) {
    this.showScoreBadgePlus(pts);
  }

  /**
   * Đặt lại điểm số của toàn bộ trò chơi về 0
   */
  reset() {
    this.currentScore = 0;
    this.globalFoundWordsCount = 0;
    this.updateUI();
  }

  /**
   * Lấy số điểm hiện tại của trò chơi (từ 0 đến 100)
   * @returns {number}
   */
  getScore() {
    return this.currentScore;
  }

  /**
   * Lấy số điểm tối đa của toàn bộ trò chơi (mặc định 100đ)
   * @returns {number}
   */
  getMaxScore() {
    return this.maxScore;
  }

  /**
   * Lấy tổng số từ khóa đã tìm được trong toàn bộ game
   * @returns {number}
   */
  getGlobalFoundWordsCount() {
    return this.globalFoundWordsCount;
  }

  /**
   * Lấy tổng số từ khóa của toàn bộ game
   * @returns {number}
   */
  getTotalGameWords() {
    return this.totalGameWords;
  }
}

// Xuất ra phạm vi toàn cục (Global Scope) và module.exports
if (typeof window !== 'undefined') {
  window.ScoreManager = ScoreManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScoreManager;
}
