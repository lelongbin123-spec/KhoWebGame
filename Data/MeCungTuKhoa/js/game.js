/**
 * MÊ CUNG TỪ KHÓA - SĂN CHỮ VƯỢT VÒNG THỜI GIAN
 * Bộ điều khiển trò chơi chính (Main Controller Engine)
 * Tải dữ liệu các màn chơi từ data/data.json, sinh lưới ô theo thẻ "size"
 * và tự động thích ứng với cấu trúc DOM của index.html.
 */

class WordMazeGame {
  constructor() {
    this.missions = [];
    this.rawMissions = [];
    this.currentMissionIndex = 0;
    this.currentMission = null;
    this.activeGrid = [];
    this.foundWords = new Set();
    this.autoNextTimer = null;
    this.savedMissionsKeywords = {};

    // Trạng thái thao tác rê chuột kéo chọn (Drag-select)
    this.isDragging = false;
    this.startCell = null;
    this.selectedCells = [];
    this.lastDragCellKey = null;

    // Tham chiếu các phần tử giao diện DOM theo index.html
    const getEl = id => (typeof document !== 'undefined' && typeof document.getElementById === 'function') 
      ? document.getElementById(id) 
      : null;

    this.gridElement = getEl('matrixGrid');
    this.keywordsListElement = getEl('keywordsList');
    this.clueDescription = getEl('clueDescription');
    this.hintText = getEl('hintText');
    this.hintCard = getEl('hintCard');
    this.missionTag = getEl('missionTag');
    this.gridSizeBadge = getEl('gridSizeBadge');
    this.restartBtn = getEl('restartBtn');
    this.detectiveStatus = getEl('detectiveStatus');
    this.detectiveAvatar = getEl('detectiveAvatar');
    this.victoryModal = getEl('victoryModal');
    this.nextLevelBtn = getEl('nextLevelBtn');
    this.replayBtn = getEl('replayBtn');
    this.confettiContainer = getEl('confettiContainer');

    this.endGameModal = getEl('endGameModal');
    this.endGameRestartBtn = getEl('endGameRestartBtn');
    this.endGameReviewBtn = getEl('endGameReviewBtn');
    this.endGameConfettiContainer = getEl('endGameConfettiContainer');

    // Khởi tạo các module chuyên trách
    this.sound = new SoundManager();
    this.ai = new AiDetective(this.sound);
    this.scoreManager = new ScoreManager({
      scoreTextEl: getEl('scoreText'),
      finalScoreEl: getEl('finalScore'),
      maxScoreTextEl: getEl('maxScoreText'),
      finalMaxScoreEl: getEl('finalMaxScore'),
      scoreBadge: getEl('scoreBadge'),
      maxScore: 100
    });

    this.grid = new GridManager(this.gridElement, this.keywordsListElement);

    if (typeof window !== 'undefined') {
      window.__wordMazeGame = this;
    }

    this.init();
  }

  /**
   * Điểm số hiện tại của trò chơi (tương thích ngược)
   */
  get score() {
    return this.scoreManager ? this.scoreManager.getScore() : 0;
  }

  /**
   * Khởi tạo trò chơi: gắn sự kiện và fetch dữ liệu từ data.json
   */
  async init() {
    this.setupEventListeners();
    await this.fetchDataAndStart();
  }

  /**
   * Tính tổng số từ khóa của toàn bộ các màn chơi gộp lại
   * @returns {number}
   */
  getTotalGameWords() {
    if (!this.missions || this.missions.length === 0) return 0;
    return this.missions.reduce((sum, m) => sum + ((m.keywords && m.keywords.length) ? m.keywords.length : 0), 0);
  }

  /**
   * Tính tổng số từ khóa của các màn chơi trước màn chơi `missionIndex`
   * @param {number} missionIndex - Thứ tự màn chơi hiện tại (0-indexed)
   * @returns {number}
   */
  getPriorWordsCount(missionIndex) {
    if (!this.missions || missionIndex <= 0) return 0;
    let count = 0;
    for (let i = 0; i < missionIndex && i < this.missions.length; i++) {
      const m = this.missions[i];
      count += (m.keywords && m.keywords.length) ? m.keywords.length : 0;
    }
    return count;
  }

  /**
   * Lấy danh sách từ khóa của một nhiệm vụ (từ bộ nhớ đệm đã giải hoặc từ danh sách nhiệm vụ)
   * @param {number} mIdx - Chỉ số màn chơi (0-indexed)
   * @returns {Array} Danh sách từ khóa
   */
  getMissionKeywords(mIdx) {
    if (mIdx === this.currentMissionIndex && this.currentMission && this.currentMission.keywords) {
      return this.currentMission.keywords;
    }
    if (this.savedMissionsKeywords && this.savedMissionsKeywords[mIdx]) {
      return this.savedMissionsKeywords[mIdx];
    }
    const rawTemplate = (this.rawMissions && this.rawMissions[mIdx])
      ? this.rawMissions[mIdx]
      : (this.missions && this.missions[mIdx]);
    if (rawTemplate && rawTemplate.keywords) {
      return rawTemplate.keywords;
    }
    return [];
  }

  /**
   * Tải dữ liệu các màn chơi bất đồng bộ từ data/data.json
   */
  async fetchDataAndStart() {
    try {
      const response = await fetch('./data/data.json');
      if (!response.ok) {
        throw new Error(`Mã lỗi HTTP: ${response.status}`);
      }
      const data = await response.json();
      
      // Lấy danh sách nhiệm vụ từ data.json (thẻ "data" hoặc "missions")
      this.missions = data.data || data.missions || [];
      // Lưu bản sao nguyên gốc của các nhiệm vụ để nạp lại mỗi màn chơi hoàn toàn độc lập
      this.rawMissions = JSON.parse(JSON.stringify(this.missions));

      // Lấy mức điểm tối đa từ thẻ "maxScore" trong data.json (mặc định 100đ)
      const maxScore = (typeof data.maxScore === 'number' && data.maxScore > 0) ? data.maxScore : 100;

      // Khởi tạo ScoreManager phân bổ đều 100đ cho tổng số từ khóa của tất cả các màn chơi
      const totalGameWords = this.getTotalGameWords();
      this.scoreManager.initGame(totalGameWords, maxScore);

      // Cập nhật tiêu đề và mô tả trò chơi từ data.json nếu có
      if (data.title) {
        const headerTitleEl = document.querySelector('.header-title');
        if (headerTitleEl) headerTitleEl.textContent = data.title.toUpperCase();
      }
      if (data.description) {
        const headerSubtitleEl = document.querySelector('.header-subtitle');
        if (headerSubtitleEl) headerSubtitleEl.textContent = data.description;
      }
      
      if (this.missions.length > 0) {
        // Kiểm tra xem có ván chơi dở dang chưa hoàn thành trong LocalStorage không
        if (typeof StorageManager !== 'undefined' && StorageManager.hasUnfinishedGame()) {
          const savedState = StorageManager.load();
          if (savedState && this.restoreGameState(savedState)) {
            console.log('🔄 Đã khôi phục ván chơi dở dang từ LocalStorage.');
            return;
          }
        }
        // Nạp màn chơi đầu tiên ở trạng thái mới toanh nếu không có lưu hoặc khôi phục lỗi
        this.loadMission(0, false);
      } else {
        console.error('Không tìm thấy dữ liệu nhiệm vụ trong data.json');
      }
    } catch (err) {
      console.error('Lỗi khi tải data/data.json:', err);
      // Thông báo hướng dẫn nếu người dùng mở trực tiếp qua file://
      if (window.location.protocol === 'file:') {
        alert('Lưu ý: Trình duyệt đang chạy trực tiếp giao thức file:// có thể chặn fetch() data.json do chính sách bảo mật CORS. Hãy chạy qua web server cục bộ (vd: Live Server, npx serve, hoặc python -m http.server).');
      }
    }
  }

  /**
   * Sinh ma trận chữ cái N × N và đặt 100% từ khóa theo thuật toán Word Search
   * Kích thước size ma trận lấy theo thẻ "size" trong data.json
   */
  buildMatrixForMission(mission) {
    const result = GameUtils.buildLevelMatrix(mission);
    // Lưu lại vị trí các từ khóa đã đặt lên bảng ma trận
    this.currentMission.keywords = result.placements;
    return result.board;
  }

  /**
   * Đăng ký các sự kiện tương tác chuột, cảm ứng và các nút điều khiển
   * Đảm bảo kiểm tra tồn tại an toàn theo cấu trúc index.html
   */
  setupEventListeners() {
    if (this.gridElement) {
      // Chặn menu chuột phải mặc định trong khu vực bảng chữ cái
      this.gridElement.addEventListener('contextmenu', e => e.preventDefault());

      // Sự kiện rê chuột kéo chọn (Drag-select)
      this.gridElement.addEventListener('mousedown', e => this.handleDragStart(e));
      window.addEventListener('mousemove', e => this.handleDragMove(e));
      window.addEventListener('mouseup', () => this.handleDragEnd());

      // Sự kiện cảm ứng dành cho màn hình cảm ứng / máy tính bảng
      this.gridElement.addEventListener('touchstart', e => this.handleTouchStart(e), { passive: false });
      window.addEventListener('touchmove', e => this.handleTouchMove(e), { passive: false });
      window.addEventListener('touchend', () => this.handleDragEnd());
    }

    // Thẻ Gợi ý thông minh: cho phép click để chủ động nhận gợi ý từ Thám tử AI (-50% điểm cho từ đó)
    if (this.hintCard) {
      this.hintCard.style.cursor = 'pointer';
      this.hintCard.title = 'Bấm để nhận gợi ý từ Thám tử AI (từ này sẽ nhận 50% điểm)';
      this.hintCard.addEventListener('click', () => {
        if (this.currentMission && this.currentMission.keywords && this.foundWords.size < this.currentMission.keywords.length) {
          this.ai.triggerHint(
            this.currentMission.keywords,
            this.foundWords,
            (r, c) => this.grid.getCell(r, c),
            true
          );
        }
      });
    }

    // Nút "Chơi lại" trên thanh tiêu đề: làm mới màn chơi ngay lập tức kèm âm thanh và hiệu ứng
    if (this.restartBtn) {
      this.restartBtn.addEventListener('click', () => {
        this.clearAutoNextTimer();
        this.sound.playRestart();
        this.restartBtn.classList.add('spinning');
        setTimeout(() => {
          if (this.restartBtn) this.restartBtn.classList.remove('spinning');
        }, 650);
        this.setDetectiveStatus('🔄 Đã làm mới màn chơi!');
        this.loadMission(this.currentMissionIndex, false);
      });
    }

    // Các nút trong hộp thoại Cánh cổng thời gian (Chiến thắng)
    if (this.replayBtn && this.victoryModal) {
      this.replayBtn.addEventListener('click', () => {
        this.clearAutoNextTimer();
        this.victoryModal.classList.remove('active');
        this.loadMission(this.currentMissionIndex, false);
      });
    }

    if (this.nextLevelBtn && this.victoryModal) {
      this.nextLevelBtn.addEventListener('click', () => {
        this.clearAutoNextTimer();
        this.victoryModal.classList.remove('active');
        const nextIdx = (this.currentMissionIndex + 1) % this.missions.length;
        const isReplayFromStart = (this.currentMissionIndex === this.missions.length - 1);
        this.loadMission(nextIdx, !isReplayFromStart);
      });
    }

    // Các nút trong hộp thoại Kết Thúc Trò Chơi (End Game - Đại Thắng Phá Đảo)
    if (this.endGameRestartBtn && this.endGameModal) {
      this.endGameRestartBtn.addEventListener('click', () => {
        this.clearAutoNextTimer();
        this.endGameModal.classList.remove('active');
        if (typeof StorageManager !== 'undefined') {
          StorageManager.clear();
        }
        this.sound.playRestart();
        this.setDetectiveStatus('🔄 Bắt đầu chuyến phiêu lưu mới!');
        this.loadMission(0, false);
      });
    }

    if (this.endGameReviewBtn && this.endGameModal) {
      this.endGameReviewBtn.addEventListener('click', () => {
        this.clearAutoNextTimer();
        this.endGameModal.classList.remove('active');
        this.setDetectiveStatus('🔍 Đang xem lại bảng mật mã');
      });
    }
  }

  clearAutoNextTimer() {
    if (this.autoNextTimer) {
      clearInterval(this.autoNextTimer);
      this.autoNextTimer = null;
    }
  }

  /**
   * Cập nhật trạng thái sinh động của Thám tử thời gian
   */
  setDetectiveStatus(text, duration = 2800) {
    if (!this.detectiveStatus) return;
    this.detectiveStatus.textContent = text;
    this.detectiveStatus.classList.add('highlight');
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      if (this.detectiveStatus) {
        this.detectiveStatus.textContent = 'Đang tuần tra';
        this.detectiveStatus.classList.remove('highlight');
      }
    }, duration);
  }

  /**
   * Nạp dữ liệu màn chơi được chỉ định - khởi tạo mới hoàn toàn
   * @param {number} index - Vị trí màn chơi trong mảng missions
   * @param {boolean} keepScore - Giữ lại điểm tích lũy khi chuyển màn tự động
   */
  loadMission(index, keepScore = false) {
    if (!this.missions || !this.missions[index]) return;

    this.clearAutoNextTimer();

    // Đóng các modal chiến thắng hoặc kết thúc game nếu đang mở
    if (this.victoryModal) this.victoryModal.classList.remove('active');
    if (this.endGameModal) this.endGameModal.classList.remove('active');

    this.currentMissionIndex = index;
    if (!keepScore && index === 0) {
      this.savedMissionsKeywords = {};
    }
    // Nạp đối tượng nhiệm vụ mới từ bản sao nguyên gốc để tránh bị ghi đè thuộc tính
    const rawTemplate = (this.rawMissions && this.rawMissions[index]) 
      ? this.rawMissions[index] 
      : this.missions[index];
    this.currentMission = JSON.parse(JSON.stringify(rawTemplate));
    this.foundWords.clear();
    this.ai.reset();

    // Dọn sạch pháo giấy cũ nếu có để giải phóng bộ nhớ
    if (this.confettiContainer) this.confettiContainer.innerHTML = '';
    if (this.endGameConfettiContainer) this.endGameConfettiContainer.innerHTML = '';

    // 1. Sinh ma trận chữ cái và đặt 100% từ khóa theo thuật toán Word Search
    this.activeGrid = this.buildMatrixForMission(this.currentMission);
    const actualSize = this.activeGrid.length;
    this.currentMission.size = actualSize;

    // 2. Cập nhật huy hiệu hiển thị kích thước bảng ma trận (vd: 10 × 10 hoặc 8 × 8)
    if (this.gridSizeBadge) {
      this.gridSizeBadge.textContent = `${actualSize} × ${actualSize}`;
    }

    // 3. Vẽ ma trận các ô chữ lên giao diện
    this.grid.renderMatrix(this.activeGrid);

    // 4. Hiển thị thông tin nhiệm vụ và câu đố
    if (this.missionTag) {
      this.missionTag.textContent = `${this.currentMission.title}`;
      if (this.currentMission.location) {
        this.missionTag.title = `${this.currentMission.title}: ${this.currentMission.location}`;
      }
    }
    if (this.clueDescription) this.clueDescription.textContent = this.currentMission.clue;
    // Thẻ gợi ý do AiDetective quản lý, ở trạng thái chờ và chỉ hiển thị khi học sinh quét sai 2 lần liên tiếp

    // 5. Quản lý điểm số qua ScoreManager: 100đ chia đều cho tổng từ khóa toàn bộ các màn
    const currentMissionWords = (this.currentMission.keywords && this.currentMission.keywords.length) || 4;
    const priorWords = this.getPriorWordsCount(index);
    this.scoreManager.initMission(currentMissionWords, priorWords, keepScore, index);

    // 6. Hiển thị danh sách từ khóa ở trạng thái chưa tìm (dấu chấm xám tròn)
    this.grid.renderKeywordsList(this.currentMission.keywords, this.foundWords);

    // 7. Lưu trạng thái khởi tạo của màn chơi vào LocalStorage
    if (typeof StorageManager !== 'undefined') {
      StorageManager.saveGameState(this);
    }
  }

  /**
   * Khôi phục toàn bộ trạng thái màn chơi từ dữ liệu đã lưu trong LocalStorage
   * @param {Object} savedState - Dữ liệu trạng thái ván chơi đã lưu
   * @returns {boolean} True nếu khôi phục thành công
   */
  restoreGameState(savedState) {
    try {
      if (!savedState || typeof savedState.missionIndex !== 'number') return false;
      const idx = savedState.missionIndex;
      if (!this.missions || !this.missions[idx]) return false;
      if (!Array.isArray(savedState.activeGrid) || savedState.activeGrid.length === 0) return false;
      if (!Array.isArray(savedState.keywords) || savedState.keywords.length === 0) return false;

      this.clearAutoNextTimer();

      this.currentMissionIndex = idx;
      const rawTemplate = (this.rawMissions && this.rawMissions[idx])
        ? this.rawMissions[idx]
        : this.missions[idx];
      this.currentMission = JSON.parse(JSON.stringify(rawTemplate));

      // 1. Khôi phục ma trận chữ cái và vị trí từ khóa chính xác như lúc lưu
      this.activeGrid = savedState.activeGrid;
      this.currentMission.keywords = savedState.keywords;
      const actualSize = this.activeGrid.length;
      this.currentMission.size = actualSize;

      // 2. Khôi phục tập hợp từ khóa đã tìm được
      this.foundWords = new Set(savedState.foundWords || []);
      this.ai.reset();

      // Dọn sạch pháo giấy cũ nếu có
      if (this.confettiContainer) this.confettiContainer.innerHTML = '';

      // 3. Cập nhật huy hiệu kích thước bảng ma trận (vd: 8 × 8)
      if (this.gridSizeBadge) {
        this.gridSizeBadge.textContent = `${actualSize} × ${actualSize}`;
      }

      // 4. Vẽ lại bảng ma trận ô chữ
      this.grid.renderMatrix(this.activeGrid);

      // 5. Tô màu lại các ô chữ cái của các từ đã tìm thấy trước đó
      this.currentMission.keywords.forEach(kw => {
        const kwIdentifier = kw.display || kw.word;
        if (this.foundWords.has(kwIdentifier)) {
          kw.found = true;
          if (Array.isArray(kw.cells) && kw.cells.length > 0) {
            const cellElements = kw.cells
              .map(pos => this.grid.getCell(pos.r, pos.c))
              .filter(Boolean);
            if (cellElements.length > 0) {
              const colorIdx = typeof kw.colorIndex === 'number' ? kw.colorIndex : 0;
              this.grid.markCellsFound(cellElements, colorIdx);
            }
          }
        }
      });

      // 6. Hiển thị thông tin tiêu đề và mật thư nhiệm vụ
      if (this.missionTag) {
        this.missionTag.textContent = `${this.currentMission.title}`;
        if (this.currentMission.location) {
          this.missionTag.title = `${this.currentMission.title}: ${this.currentMission.location}`;
        }
      }
      if (this.clueDescription) {
        this.clueDescription.textContent = this.currentMission.clue;
      }

      // 7. Khôi phục điểm số trong ScoreManager (tính theo tổng từ khóa toàn game)
      const currentMissionWords = this.currentMission.keywords.length;
      const priorWords = this.getPriorWordsCount(idx);
      const globalFoundCount = (typeof savedState.globalFoundWordsCount === 'number')
        ? savedState.globalFoundWordsCount
        : (priorWords + this.foundWords.size);

      this.scoreManager.initMission(currentMissionWords, priorWords, true);
      this.scoreManager.restoreState(globalFoundCount, savedState.score);

      // Khôi phục bộ nhớ đệm từ khóa các màn trước
      if (savedState.savedMissionsKeywords) {
        this.savedMissionsKeywords = savedState.savedMissionsKeywords;
      }

      // 8. Cập nhật thanh tiến độ và danh sách từ khóa bên cột trái
      this.grid.renderKeywordsList(this.currentMission.keywords, this.foundWords);

      // 9. Cập nhật trạng thái thám tử thời gian
      this.setDetectiveStatus('🔄 Đã khôi phục ván chơi!');

      return true;
    } catch (err) {
      console.error('Lỗi khi khôi phục trạng thái từ LocalStorage:', err);
      return false;
    }
  }

  // --- Xử lý sự kiện kéo chọn chuột (Drag-Select) ---

  handleDragStart(e) {
    const cell = e.target.closest('.tile-cell');
    if (!cell) return;
    this.sound.init();
    this.isDragging = true;
    this.startCell = {
      r: parseInt(cell.dataset.row, 10),
      c: parseInt(cell.dataset.col, 10)
    };
    this.lastDragCellKey = `${this.startCell.r},${this.startCell.c}`;
    this.updateSelection(this.startCell.r, this.startCell.c);
    this.sound.playSelect();
  }

  handleDragMove(e) {
    if (!this.isDragging) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;
    const cell = target.closest('.tile-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    const key = `${r},${c}`;
    // Bỏ qua nếu chuột vẫn đang di chuyển trong cùng 1 ô (giảm 90% tải tính toán và loại bỏ giật lag)
    if (this.lastDragCellKey === key) return;
    this.lastDragCellKey = key;
    this.updateSelection(r, c);
  }

  handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;
    const cell = target.closest('.tile-cell');
    if (cell) {
      this.handleDragStart({ target: cell });
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    if (!this.isDragging || e.touches.length === 0) return;
    const touch = e.touches[0];
    this.handleDragMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  updateSelection(endR, endC) {
    const size = this.activeGrid ? this.activeGrid.length : 8;
    const lineCells = GameUtils.getCellsInLine(
      this.startCell.r,
      this.startCell.c,
      endR,
      endC,
      size,
      (r, c) => this.grid.getCell(r, c)
    );

    this.selectedCells = lineCells;
    this.grid.setSelectingCells(lineCells);
  }

  handleDragEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.lastDragCellKey = null;

    if (this.selectedCells.length > 0) {
      const letters = this.selectedCells.map(c => c.dataset.letter).join('');
      const reverseLetters = [...letters].reverse().join('');
      this.checkWordMatch(letters, reverseLetters, this.selectedCells);
    }

    this.grid.clearSelecting();
    this.selectedCells = [];
  }

  checkWordMatch(rawWord1, rawWord2, cells) {
    const clean1 = GameUtils.normalizeVietnamese(rawWord1);
    const clean2 = GameUtils.normalizeVietnamese(rawWord2);

    let matchedKw = null;
    for (const kw of this.currentMission.keywords) {
      const kwIdentifier = kw.display || kw.word;
      if (this.foundWords.has(kwIdentifier)) continue;

      const targets = [
        GameUtils.normalizeVietnamese(kw.cleanWord || kw.word),
        GameUtils.normalizeVietnamese(kw.display || kw.word)
      ];
      if (kw.altCleanWords) {
        kw.altCleanWords.forEach(alt => targets.push(GameUtils.normalizeVietnamese(alt)));
      }

      // Kiểm tra cả chiều xuôi và chiều ngược
      const isMatch = targets.some(target => 
        GameUtils.matchFuzzy(target, clean1) || GameUtils.matchFuzzy(target, clean2)
      );

      if (isMatch) {
        matchedKw = kw;
        break;
      }
    }

    if (matchedKw) {
      // Tìm thấy từ khóa chính xác!
      const kwIdentifier = matchedKw.display || matchedKw.word;
      this.foundWords.add(kwIdentifier);
      matchedKw.found = true;
      this.ai.recordSuccess();
      this.setDetectiveStatus('⭐ Quá xuất sắc!');

      // Xác định chỉ số màu phân biệt riêng cho từ khóa này theo thứ tự danh sách (kết hợp độ dời màn chơi)
      const kwIndex = this.currentMission.keywords.indexOf(matchedKw);
      const priorWords = this.getPriorWordsCount(this.currentMissionIndex);
      const colorPaletteLen = (typeof WORD_COLORS !== 'undefined' && WORD_COLORS.length) ? WORD_COLORS.length : 8;
      const colorIndex = (typeof matchedKw.colorIndex === 'number')
        ? matchedKw.colorIndex
        : ((priorWords + (kwIndex >= 0 ? kwIndex : this.foundWords.size - 1)) % colorPaletteLen);
      matchedKw.colorIndex = colorIndex;

      // Đổi màu các ô chữ cái sang màu riêng biệt tương ứng của từ khóa
      this.grid.markCellsFound(cells, colorIndex);

      // Cập nhật lại danh sách từ khóa kèm màu sắc tương ứng
      this.grid.renderKeywordsList(this.currentMission.keywords, this.foundWords);

      // Lưu lại danh sách từ khóa đã giải của màn này vào bộ nhớ lịch sử kèm trạng thái hint
      if (!this.savedMissionsKeywords) this.savedMissionsKeywords = {};
      this.savedMissionsKeywords[this.currentMissionIndex] = this.currentMission.keywords.map(kw => ({
        word: kw.word,
        display: kw.display || kw.word,
        colorIndex: kw.colorIndex,
        hasHint: Boolean(kw.hasHint || kw.hintUsed)
      }));

      // Phát âm thanh chiến thắng và cộng điểm qua ScoreManager (có kiểm tra hint)
      this.sound.playSuccess();
      const lastCell = cells[cells.length - 1];
      const hasHint = Boolean(matchedKw.hasHint || matchedKw.hintUsed);
      this.scoreManager.recordWordFound(lastCell, hasHint);

      // Cập nhật biểu cảm robot vui mừng
      if (this.detectiveAvatar) this.detectiveAvatar.src = 'assets/images/Robot_happy.jpg';

      // Lưu trạng thái tiến trình mới nhất vào LocalStorage ngay khi tìm thấy 1 từ
      if (typeof StorageManager !== 'undefined') {
        StorageManager.saveGameState(this);
      }

      // Kiểm tra nếu tìm đủ tất cả từ khóa thì mở Cánh cổng thời gian hoặc End Game
      if (this.foundWords.size === this.currentMission.keywords.length) {
        const isLastMission = (this.currentMissionIndex === this.missions.length - 1);
        if (isLastMission) {
          setTimeout(() => this.showEndGameModal(), 600);
        } else {
          setTimeout(() => this.showVictory(), 600);
        }
      }
    } else {
      // Kéo sai: phát âm thanh lỗi và ghi nhận cho thám tử AI
      if (cells.length > 1) {
        this.sound.playError();
        this.setDetectiveStatus('🤔 Cố lên bạn ơi!');

        // Biểu cảm robot buồn nhẹ khi học sinh kéo sai
        if (this.detectiveAvatar) {
          this.detectiveAvatar.src = 'assets/images/Robot_buon.jpg';
          if (this._avatarTimer) clearTimeout(this._avatarTimer);
          this._avatarTimer = setTimeout(() => {
            if (this.detectiveAvatar) this.detectiveAvatar.src = 'assets/images/Robot_happy.jpg';
          }, 1800);
        }

        this.ai.recordFailure(
          this.currentMission.keywords,
          this.foundWords,
          (r, c) => this.grid.getCell(r, c)
        );
      }
    }
  }

  /**
   * Tạo pháo giấy chúc mừng rực rỡ khi mở khóa Cánh cổng thời gian
   */
  createConfetti() {
    const container = this.confettiContainer;
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#8b5cf6', '#eab308'];
    for (let i = 0; i < 26; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.animationDuration = `${1.6 + Math.random() * 0.8}s`;
      container.appendChild(piece);
    }
    // Dọn dẹp pháo giấy sau 2.8s để tránh tốn tài nguyên GPU
    if (this._confettiTimer) clearTimeout(this._confettiTimer);
    this._confettiTimer = setTimeout(() => {
      if (container) container.innerHTML = '';
    }, 2800);
  }

  /**
   * Tạo pháo giấy chúc mừng màn hình End Game phá đảo
   */
  createEndGameConfetti() {
    const container = this.endGameConfettiContainer;
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#8b5cf6', '#eab308'];
    for (let i = 0; i < 36; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 0.45}s`;
      piece.style.animationDuration = `${1.6 + Math.random() * 0.9}s`;
      container.appendChild(piece);
    }
    if (this._endConfettiTimer) clearTimeout(this._endConfettiTimer);
    this._endConfettiTimer = setTimeout(() => {
      if (container) container.innerHTML = '';
    }, 3200);
  }

  /**
   * Hiển thị các từ khóa đã giải được dạng huy hiệu màu sắc sinh động trong modal chiến thắng
   * Ở màn 2 sẽ thống kê cả từ khóa của màn 1 và màn 2, bố cục dàn trải gọn gàng TUYỆT ĐỐI KHÔNG SCROLL
   */
  /**
   * Tạo thẻ nhiệm vụ và danh sách từ khóa theo chung 1 form chuẩn thống nhất
   * @param {number} missionIndex - Thứ tự nhiệm vụ
   * @param {Object} mission - Dữ liệu nhiệm vụ
   * @returns {HTMLElement} Thẻ nhiệm vụ
   */
  createMissionSummaryCard(missionIndex, mission) {
    const card = document.createElement('div');
    card.className = 'end-game-mission-card';

    const missionKeywords = this.getMissionKeywords(missionIndex) || mission.keywords || [];

    let chipsHtml = '';
    missionKeywords.forEach((kw, kIdx) => {
      const text = kw.display || kw.word;
      const colorPaletteLen = (typeof WORD_COLORS !== 'undefined' && WORD_COLORS.length) ? WORD_COLORS.length : 8;
      const colorIdx = (typeof kw.colorIndex === 'number') 
        ? kw.colorIndex 
        : kIdx;
      const palette = (typeof WORD_COLORS !== 'undefined' && WORD_COLORS[colorIdx % colorPaletteLen])
        ? WORD_COLORS[colorIdx % colorPaletteLen]
        : { start: '#10b981', lightBg: '#ecfdf5', text: '#047857', border: '#059669' };

      const isHintUsed = Boolean(kw.hasHint || kw.hintUsed);
      const hintBadge = isHintUsed
        ? `<span class="end-kw-hint-tag" title="Từ này đã nhận gợi ý (50% điểm)">💡</span>`
        : '';

      chipsHtml += `<div class="end-kw-item ${isHintUsed ? 'is-hint-word' : ''}" style="background:${palette.lightBg}; border-color:${palette.border}; color:${palette.text}; animation-delay:${(missionIndex * 0.08 + kIdx * 0.03)}s;">
        <span class="end-kw-check" style="background:${palette.start};">✓</span>
        <span class="end-kw-text">${text}</span>
        ${hintBadge}
      </div>`;
    });

    card.innerHTML = `
      <div class="end-mission-header">
        <span class="end-mission-badge">Nhiệm vụ 0${missionIndex + 1}</span>
        <span class="end-mission-loc" title="${mission.location || ''}">${mission.location || ''}</span>
      </div>
      <div class="end-mission-chips">${chipsHtml}</div>
    `;

    return card;
  }

  /**
   * Hiển thị bảng tổng hợp từ khóa qua các màn theo form chuẩn thống nhất (không scroll)
   */
  renderVictoryKeywords() {
    const container = document.getElementById('victoryKeywordsChips');
    if (!container) return;
    container.innerHTML = '';

    const completedMissions = this.currentMissionIndex + 1;
    if (completedMissions === 1) {
      container.style.gridTemplateColumns = 'minmax(220px, 340px)';
      container.style.justifyContent = 'center';
    } else {
      container.style.gridTemplateColumns = `repeat(${completedMissions}, 1fr)`;
      container.style.justifyContent = 'stretch';
    }

    for (let mIdx = 0; mIdx <= this.currentMissionIndex; mIdx++) {
      const mission = this.missions[mIdx];
      if (!mission) continue;
      container.appendChild(this.createMissionSummaryCard(mIdx, mission));
    }
  }

  /**
   * Tạo HTML hiển thị cụm sao thành tích (hoạt hình pop-in, sao active và inactive)
   * @param {number} activeCount - Số sao đạt được (1 - 3)
   * @param {number} [total=3] - Tổng số sao (mặc định 3)
   * @returns {string} Chuỗi HTML các ngôi sao
   */
  renderStarsHtml(activeCount, total = 3) {
    let html = '';
    const clamped = Math.max(1, Math.min(activeCount, total));
    for (let i = 1; i <= total; i++) {
      const isActive = i <= clamped;
      const delay = (i * 0.12).toFixed(2);
      html += `<span class="star-item ${isActive ? 'active' : 'inactive'}" style="animation-delay: ${delay}s;" title="${isActive ? 'Sao vàng thành tích' : 'Chưa đạt'}">⭐</span>`;
    }
    return html;
  }

  /**
   * Tính toán đánh giá danh hiệu, số sao, cúp và câu khen ngợi dựa trên điểm số cuối cùng
   * @param {number} score - Điểm số đạt được
   * @param {number} maxScore - Điểm số tối đa (100đ)
   * @returns {object} Thông tin hiển thị chi tiết
   */
  getEndGameEvaluation(score, maxScore) {
    const ratio = maxScore > 0 ? (score / maxScore) : 0;

    // Mức 1: Điểm tối đa tuyệt đối 100đ (Tự tìm 100% từ khóa, không xem gợi ý)
    if (score >= maxScore || ratio >= 1.0) {
      return {
        stars: 3,
        trophy: '🏆',
        title: 'ĐẠI THẮNG TUYỆT ĐỐI! 100 ĐIỂM! 🎉',
        rankTitle: 'SIÊU THÁM TỬ HUYỀN THOẠI',
        rankBg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        rankBorder: '#f59e0b',
        rankColor: '#92400e'
      };
    }

    // Mức 2: Xuất sắc (75 - 99đ, chỉ dùng 1 - 4 gợi ý)
    if (score >= 75 || ratio >= 0.75) {
      return {
        stars: 2,
        trophy: '🥇',
        title: 'XUẤT SẮC! BẠN ĐÃ PHÁ ĐẢO MÊ CUNG! 👏',
        rankTitle: 'THÁM TỬ TÀI BA THÔNG THÁI',
        rankBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        rankBorder: '#f59e0b',
        rankColor: '#b45309'
      };
    }

    // Mức 3: Hoàn thành tốt mê cung (dưới 75đ)
    return {
      stars: 1,
      trophy: '🥈',
      title: 'RẤT GIỎI! BẠN ĐÃ VƯỢT QUA MÊ CUNG! 🌟',
      rankTitle: 'THÁM TỬ NHANH TRÍ CHĂM CHỈ',
      rankBg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      rankBorder: '#0284c7',
      rankColor: '#0369a1'
    };
  }

  /**
   * Hiển thị bảng tổng kết hành trình toàn bộ các màn chơi trong modal End Game (chung form với victory)
   */
  renderEndGameSummary() {
    const totalScoreEl = document.getElementById('endGameTotalScore');
    const maxScoreEl = document.getElementById('endGameMaxScore');
    const totalKeywordsEl = document.getElementById('endGameTotalKeywords');
    const missionsCountEl = document.getElementById('endGameMissionsCount');
    const listEl = document.getElementById('endGameMissionsList');

    const totalGameWords = this.getTotalGameWords();
    const currentScore = this.scoreManager.getScore();
    const maxScore = this.scoreManager.getMaxScore();

    if (totalScoreEl) totalScoreEl.textContent = currentScore;
    if (maxScoreEl) maxScoreEl.textContent = maxScore;
    if (totalKeywordsEl) totalKeywordsEl.textContent = `${totalGameWords}/${totalGameWords}`;
    if (missionsCountEl) missionsCountEl.textContent = `${this.missions.length}/${this.missions.length}`;

    // Cập nhật cúp, sao và câu khen ngợi theo điểm số
    const evalData = this.getEndGameEvaluation(currentScore, maxScore);

    const trophyEl = document.getElementById('endGameTrophy');
    const starsEl = document.getElementById('endGameStars');
    const titleEl = document.getElementById('endGameTitle');
    const rankTitleEl = document.getElementById('endGameRankTitle');
    const rankBadgeEl = document.getElementById('endGameRankBadge');

    if (trophyEl) trophyEl.textContent = evalData.trophy;
    if (starsEl) {
      starsEl.innerHTML = this.renderStarsHtml(evalData.stars, 3);
    }
    if (titleEl) titleEl.textContent = evalData.title;
    if (rankTitleEl) rankTitleEl.textContent = evalData.rankTitle;
    if (rankBadgeEl) {
      rankBadgeEl.style.background = evalData.rankBg;
      rankBadgeEl.style.borderColor = evalData.rankBorder;
      rankBadgeEl.style.color = evalData.rankColor;
    }

    if (!listEl) return;
    listEl.innerHTML = '';

    this.missions.forEach((mission, mIdx) => {
      listEl.appendChild(this.createMissionSummaryCard(mIdx, mission));
    });
  }

  /**
   * Hiển thị màn hình End Game phá đảo và thống kê toàn diện trò chơi
   */
  showEndGameModal() {
    this.clearAutoNextTimer();
    this.sound.playVictory();
    this.createEndGameConfetti();

    const currentScore = this.scoreManager.getScore();
    const maxScore = this.scoreManager.getMaxScore();
    const evalData = this.getEndGameEvaluation(currentScore, maxScore);

    this.setDetectiveStatus(evalData.stars === 3 ? '🏆 Đại thắng tuyệt đối 100 điểm!' : '🌟 Chúc mừng bạn đã phá đảo mê cung!');

    if (this.detectiveAvatar) {
      this.detectiveAvatar.src = 'assets/images/Robot_happy.jpg';
    }

    // Xóa sạch LocalStorage khi đã hoàn thành toàn bộ game
    if (typeof StorageManager !== 'undefined') {
      StorageManager.clear();
    }

    this.renderEndGameSummary();

    if (this.endGameModal) {
      this.endGameModal.classList.add('active');
    }
  }

  showVictory() {
    this.clearAutoNextTimer();
    this.sound.playVictory();
    this.createConfetti();
    this.setDetectiveStatus('🏆 Xuất sắc mở cổng!');

    const victoryTitle = document.getElementById('victoryTitle') || document.querySelector('.victory-title');
    const finalScoreEl = document.getElementById('finalScore');
    const finalMaxScoreEl = document.getElementById('finalMaxScore');
    const finalKeywordsCountEl = document.getElementById('finalKeywordsCount');
    const finalMissionsCountEl = document.getElementById('finalMissionsCount');
    const victoryStarsEl = document.getElementById('victoryStars');
    const victoryPortalCore = document.getElementById('victoryPortalCore');
    const victoryPortalRing1 = document.getElementById('victoryPortalRing1');

    // Cập nhật các thông số kết quả sinh động (thống nhất chung 1 form)
    const priorWords = this.getPriorWordsCount(this.currentMissionIndex);
    const totalFoundSoFar = priorWords + this.foundWords.size;
    const totalGameWords = this.getTotalGameWords();

    if (finalScoreEl) finalScoreEl.textContent = this.scoreManager.getScore();
    if (finalMaxScoreEl) finalMaxScoreEl.textContent = this.scoreManager.getMaxScore();
    if (finalKeywordsCountEl) {
      finalKeywordsCountEl.textContent = `${totalFoundSoFar}/${totalGameWords}`;
    }
    if (finalMissionsCountEl) {
      finalMissionsCountEl.textContent = `${this.currentMissionIndex + 1}/${this.missions.length}`;
    }

    // Đánh giá màn chơi hiện tại theo số gợi ý đã dùng
    const currentKeywords = this.getMissionKeywords(this.currentMissionIndex) || [];
    const hintsUsedInMission = currentKeywords.filter(k => Boolean(k.hasHint || k.hintUsed)).length;

    let starsCount = 3;
    let praiseText = 'XUẤT SẮC! CÁNH CỔNG THỜI GIAN ĐÃ MỞ!';
    let coreIcon = '🌀';
    let ringColor = '#1fb0d3';

    if (hintsUsedInMission === 0) {
      starsCount = 3;
      praiseText = 'XUẤT SẮC! BẠN TỰ TÌM HOÀN HẢO! ✨';
      coreIcon = '🌟';
      ringColor = '#f59e0b';
    } else if (hintsUsedInMission === 1) {
      starsCount = 2;
      praiseText = 'RẤT GIỎI! CÁNH CỔNG THỜI GIAN ĐÃ MỞ! 🚀';
      coreIcon = '🌀';
      ringColor = '#0284c7';
    } else {
      starsCount = 1;
      praiseText = 'CHÚC MỪNG! BẠN ĐÃ VƯỢT QUA NHIỆM VỤ! 👏';
      coreIcon = '🌀';
      ringColor = '#059669';
    }

    if (victoryTitle) victoryTitle.textContent = praiseText;
    if (victoryStarsEl) victoryStarsEl.innerHTML = this.renderStarsHtml(starsCount, 3);
    if (victoryPortalCore) victoryPortalCore.textContent = coreIcon;
    if (victoryPortalRing1) victoryPortalRing1.style.borderColor = ringColor;

    // Cập nhật danh sách các từ khóa đã tìm được theo chung 1 form chuẩn
    this.renderVictoryKeywords();

    const nextMissionNum = this.currentMissionIndex + 2;
    if (this.nextLevelBtn) {
      this.nextLevelBtn.textContent = `Khám phá Nhiệm vụ số 0${nextMissionNum} ➔`;
    }

    if (this.victoryModal) {
      this.victoryModal.classList.add('active');
    }
  }
}

// Xuất lớp trò chơi ra đối tượng window và module.exports
if (typeof window !== 'undefined') {
  window.WordMazeGame = WordMazeGame;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WordMazeGame;
}

// Khởi tạo trò chơi sau khi cây DOM đã sẵn sàng
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new WordMazeGame();
  });
}
