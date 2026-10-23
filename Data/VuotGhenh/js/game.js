import { TypingController } from "./typingController.js";
import { RockManager } from "./rockManager.js";
import { PlayerController } from "./playerController.js";
import { SoundManager } from "./sound.js";
import { StorageManager } from "./storageManager.js";

const BACKGROUNDS = [
  "assets/images/Background1.jpg",
  "assets/images/Background2.jpg",
  "assets/images/Background3.jpg"
];

export class Game {
  /**
   * Khởi tạo trò chơi với dữ liệu cấu hình
   */
  constructor(config) {
    this.config = config;
    this.storage = StorageManager;
    this.state = "READY";
    this.score = 0;
    this.rocksPassed = 0;
    this.elapsed = 0;
    this.remaining = 10;
    this.lastFrame = 0;
    this.rafId = null;
    this.toastTimer = null;
    this.endTimer = null;
    this.sound = new SoundManager();
    this.progression = [];
    this.currentBackground = BACKGROUNDS[0];

    // Cache kích thước scene để tối ưu hiệu năng
    this.sceneWidth = 800;
    this.sceneHeight = 600;
    this.dangerY = 560;

    // Cache hiển thị UI tránh ghi DOM thừa
    this.lastTimeText = "";
    this.lastIsWarning = false;

    this.el = {
      scene: document.querySelector(".scene"),
      rocksLayer: document.getElementById("rocksLayer"),
      player: document.getElementById("player"),
      score: document.getElementById("score"),
      levelLabel: document.getElementById("levelLabel"),
      levelSubtitle: document.getElementById("levelSubtitle"),
      passedCount: document.getElementById("passedCount"),
      passedWords: document.getElementById("passedWords"),
      typedValue: document.getElementById("typedValue"),
      timeText: document.getElementById("timeText"),
      timeBar: document.getElementById("timeBar"),
      feedback: document.getElementById("feedback"),
      overlay: document.getElementById("overlay"),
      modal: document.getElementById("modal"),
      levelSelectView: document.getElementById("levelSelectView"),
      levelCards: document.getElementById("levelCards"),
      endView: document.getElementById("endView"),
      endMascotImg: document.getElementById("endMascotImg"),
      modalTitle: document.getElementById("modalTitle"),
      modalMessage: document.getElementById("modalMessage"),
      endStars: document.getElementById("endStars"),
      startBtn: document.getElementById("startBtn"),
      backToLevelsBtn: document.getElementById("backToLevelsBtn"),
      restartBtn: document.getElementById("restartBtn"),
      soundBtn: document.getElementById("soundBtn"),
      soundIcon: document.getElementById("soundIcon"),
      toast: document.getElementById("toast"),
      playerBubble: document.getElementById("playerBubble")
    };

    this.measureScene();

    this.buildProgression();
    this.remaining = this.getTypingTime();

    this.rocks = new RockManager({
      layer: this.el.rocksLayer,
      scene: this.el.scene,
      config: config.settings
    });
    this.player = new PlayerController(this.el.player, this.el.scene);
    this.typing = new TypingController({
      onCorrect: () => this.handleCorrect(),
      onWrong: () => this.handleWrong(),
      onInput: value => this.renderInput(value),
      onKeyType: () => this.sound.playSelect()
    });

    this.loop = this.loop.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /**
   * Đo kích thước khung cảnh và cập nhật vị trí đường nguy hiểm
   */
  measureScene() {
    if (!this.el.scene) return;
    this.sceneWidth = this.el.scene.clientWidth || 800;
    this.sceneHeight = this.el.scene.clientHeight || 600;
    const ratio = Number(this.config.settings?.dangerLineRatio) || 0.85;
    this.dangerY = this.sceneHeight * ratio;

    this.el.scene.style.setProperty("--danger-top", `${(ratio * 100).toFixed(1)}%`);
  }

  /**
   * Dừng vòng lặp game loop
   */
  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Lấy số lượng từ khóa mục tiêu cần hoàn thành trong màn chơi
   */
  getTotalCount(level) {
    const raw = level?.Total ?? level?.total ?? this.config.settings?.Total ?? this.config.settings?.total ?? this.config.Total ?? this.config.total;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : (Array.isArray(level?.targets) && level.targets.length > 0 ? level.targets.length : 10);
  }

  /**
   * Sinh danh sách từ khóa ngẫu nhiên theo số lượng yêu cầu
   */
  generateTargets(targetsPool, totalCount) {
    if (!Array.isArray(targetsPool) || targetsPool.length === 0) return [];
    const pool = targetsPool
      .map(t => String(t ?? "").trim().toUpperCase())
      .filter(t => t.length > 0);
    if (pool.length === 0 || totalCount <= 0) return [];

    const shuffle = arr => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    if (pool.length >= totalCount) {
      return shuffle(pool).slice(0, totalCount);
    }

    // Khi danh sách từ ít hơn totalCount, lặp lại ngẫu nhiên không trùng từ liền kề
    const result = [];
    let lastItem = null;
    while (result.length < totalCount) {
      const batch = shuffle(pool);
      if (pool.length > 1 && batch[0] === lastItem) {
        const swapIdx = Math.floor(Math.random() * (batch.length - 1)) + 1;
        [batch[0], batch[swapIdx]] = [batch[swapIdx], batch[0]];
      }
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        result.push(item);
        lastItem = item;
        if (result.length === totalCount) break;
      }
    }
    return result;
  }

  /**
   * Lấy cấu hình của màn chơi đang chọn
   */
  getSelectedLevel() {
    const levels = Array.isArray(this.config.data) ? this.config.data : [];
    return levels.find(level => String(level.id) === String(this.selectedLevelId)) || levels[0];
  }

  /**
   * Lấy thời gian gõ cơ bản của màn chơi
   */
  getBaseTypingTime(level) {
    const lvl = level || this.getSelectedLevel();
    const raw = lvl?.baseTypingTime ?? this.config.settings?.baseTypingTime;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : 10;
  }

  /**
   * Tính thời gian gõ cho từ hiện tại (giảm dần theo số bậc đã vượt)
   */
  getTypingTime() {
    const base = this.getBaseTypingTime();
    const s = this.config.settings || {};
    const minTime = Number(s.minTypingTime) || 6;
    const decrease = Number(s.timeDecrease) || 0;
    return Math.max(minTime, base - this.rocksPassed * decrease);
  }

  /**
   * Xây dựng danh sách tiến trình các từ khóa của màn chơi
   */
  buildProgression() {
    const levels = Array.isArray(this.config.data) ? this.config.data : [];
    const selected = levels.find(level => String(level.id) === String(this.selectedLevelId)) || levels[0];
    this.selectedLevelId = selected?.id ?? 1;
    const totalCount = this.getTotalCount(selected);
    const targets = this.generateTargets(selected?.targets, totalCount);
    const baseTime = this.getBaseTypingTime(selected);

    this.progression = targets.map(target => {
      const text = String(target).trim().toUpperCase();
      return {
        target: text,
        levelIndex: Math.max(0, levels.indexOf(selected)),
        levelId: selected?.id ?? 1,
        levelName: selected?.name || "Màn chơi",
        typingMode: selected?.typingMode || (text.length > 1 ? "word" : "letter"),
        speedMultiplier: Number(selected?.speedMultiplier) || 1,
        baseTypingTime: baseTime
      };
    });
  }

  /**
   * Hiển thị danh sách các màn chơi lên giao diện chọn màn
   */
  renderLevelSelect() {
    const levels = Array.isArray(this.config.data) ? this.config.data : [];
    this.el.levelCards.innerHTML = "";

    // Hiển thị nút tiếp tục ván chơi nếu có tiến trình dở dang trong vòng 30 phút
    if (this.storage.hasUnfinishedGame()) {
      const saved = this.storage.load();
      if (saved) {
        const resumeBox = document.createElement("div");
        resumeBox.className = "resume-game-card";
        resumeBox.innerHTML = `
          <div class="resume-game-info">
            <span class="resume-chip">⚡ VÁN CHƠI DỞ DANG</span>
            <strong class="resume-title">MÀN ${String(saved.levelId).padStart(2, "0")}: ${this.escapeHtml(saved.levelName)}</strong>
            <span class="resume-desc">Đã vượt: ${saved.currentStep}/${saved.totalSteps} bậc · Điểm: ${saved.score}</span>
          </div>
          <button type="button" class="resume-play-btn" title="Tiếp tục ván chơi này">
            <span>Tiếp tục</span>
          </button>
        `;
        resumeBox.querySelector(".resume-play-btn").addEventListener("click", () => {
          this.restoreGame(saved);
        });
        this.el.levelCards.appendChild(resumeBox);
      }
    }

    const levelThemes = [
      { bg: "linear-gradient(135deg, #e6f9ff, #cbf1ff)", border: "#93e0fe" },
      { bg: "linear-gradient(135deg, #fff7e6, #ffe8bf)", border: "#ffd180" },
      { bg: "linear-gradient(135deg, #f3ebff, #e1ccff)", border: "#cca3ff" },
      { bg: "linear-gradient(135deg, #e8faea, #c8f5ce)", border: "#92e89f" }
    ];

    levels.forEach((level, index) => {
      const theme = levelThemes[index % levelThemes.length];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level-card-button";
      if (String(level.id) === String(this.selectedLevelId)) {
        button.classList.add("is-selected");
      }
      button.style.background = theme.bg;
      button.style.borderColor = theme.border;

      const total = this.getTotalCount(level);
      const modeText = level.typingMode === "letter" ? "Chữ cái" : "Từ vựng";

      button.innerHTML = `
        <div class="level-card-copy">
          <div class="level-card-title-row">
            <strong class="level-card-num">MÀN ${String(level.id).padStart(2, "0")}</strong>
            <span class="level-chip">${modeText}</span>
          </div>
          <span class="level-card-name">${this.escapeHtml(level.name || "Khám phá")}</span>
        </div>
        <div class="level-count-badge">
          <strong>${total}</strong>
          <span>bậc</span>
        </div>
      `;
      button.addEventListener("click", () => {
        this.storage.clear();
        this.selectedLevelId = level.id;
        this.start();
      });
      this.el.levelCards.appendChild(button);
    });
    if (this.el.modal) this.el.modal.classList.add("in-level-select");
    this.el.levelSelectView.classList.remove("hidden");
    this.el.endView.classList.add("hidden");
    this.el.overlay.classList.remove("hidden");
  }

  /**
   * Mã hóa ký tự đặc biệt để phòng ngừa lỗi XSS
   */
  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  /**
   * Khởi tạo sự kiện nút bấm, phím bấm, âm thanh và giao diện ban đầu
   */
  init() {
    // Hiển thị lại đúng hình nền của ván chơi dở dang nếu có
    if (this.storage.hasUnfinishedGame()) {
      const saved = this.storage.load();
      if (saved?.background) {
        this.setBackground(saved.background);
      } else {
        this.randomizeBackground();
      }
    } else {
      this.randomizeBackground();
    }

    this.el.startBtn.addEventListener("click", () => {
      this.start();
    });

    if (this.el.backToLevelsBtn) {
      this.el.backToLevelsBtn.addEventListener("click", () => {
        this.state = "READY";
        this.renderLevelSelect();
      });
    }

    if (this.el.restartBtn) {
      this.el.restartBtn.addEventListener("click", () => {
        this.storage.clear();
        this.start();
      });
    }

    if (this.el.soundBtn) {
      this.el.soundBtn.addEventListener("click", () => {
        this.sound.enabled = !this.sound.enabled;
        this.el.soundBtn.setAttribute("aria-pressed", String(this.sound.enabled));
        this.el.soundBtn.title = this.sound.enabled ? "Tắt âm thanh" : "Bật âm thanh";
        const iconSpan = document.getElementById("soundIcon");
        if (iconSpan) {
          iconSpan.textContent = this.sound.enabled ? "🔊" : "🔇";
        } else {
          this.el.soundBtn.textContent = this.sound.enabled ? "🔊" : "🔇";
        }
      });
    }

    if (this.el.scene) {
      this.el.scene.addEventListener("pointerdown", () => {
        if (this.state === "PLAYING") {
          this.typing.focus();
        }
      });
    }

    window.addEventListener("resize", this.onResize, { passive: true });

    // Tự động lưu tiến trình khi người dùng tắt trình duyệt hoặc chuyển tab
    window.addEventListener("beforeunload", () => {
      if (this.state === "PLAYING" && this.rocksPassed > 0) {
        this.storage.saveGameState(this);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "PLAYING" && this.rocksPassed > 0) {
        this.storage.saveGameState(this);
      }
    });

    this.typing.enable();
    this.buildProgression();
    this.remaining = this.getTypingTime();
    this.prepareScene();
    this.typing.setLocked(true);
    this.updateTimerUI();
    this.renderHUD();
    this.renderLevelSelect();
  }

  /**
   * Thiết lập hình nền xác định cho khung cảnh
   */
  setBackground(bg) {
    if (!bg) return;
    // Chuyển đường dẫn PNG đã lưu ở phiên bản cũ sang JPEG.
    const legacyBackground = String(bg).replace(/\.png$/i, ".jpg");
    const background = BACKGROUNDS.find(path => path === bg || path === legacyBackground);
    if (!background) return;

    this.currentBackground = background;
    if (this.el.scene) {
      this.el.scene.style.backgroundImage = `url("${background}")`;
    }
  }

  /**
   * Đổi ngẫu nhiên hình nền cho khung cảnh
   */
  randomizeBackground() {
    const bg = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
    this.setBackground(bg);
  }

  /**
   * Chuẩn bị khung cảnh, đường đá và đặt nhân vật lên bậc đầu tiên
   */
  prepareScene() {
    this.measureScene();
    this.rocks.createInitialPath(this.progression);
    const rock = this.rocks.currentRock;
    if (rock) this.player.placeOnRock(rock);
    this.updateCamera();
  }

  /**
   * Bắt đầu một ván chơi mới
   */
  start() {
    this.stopLoop();
    clearTimeout(this.endTimer);
    this.endTimer = null;
    this.storage.clear();
    this.buildProgression();
    if (!this.progression.length) {
      this.renderLevelSelect();
      return;
    }
    this.randomizeBackground();
    this.sound.playRestart();
    this.state = "PLAYING";
    this.score = 0;
    this.rocksPassed = 0;
    this.elapsed = 0;
    this.remaining = this.getTypingTime();
    this.prepareScene();

    const target = this.rocks.targetRock;
    if (target) {
      this.typing.setTarget(target.letter);
    }
    this.typing.setLocked(false);
    this.typing.focus();
    this.updateTypingFeedback("");
    this.el.overlay.classList.add("hidden");
    this.setFeedback("Gõ chữ trên đá rồi nhấn Enter để nhảy", "info");
    this.updateTimerUI(true);
    this.renderHUD();
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Khôi phục ván chơi dở dang từ LocalStorage
   */
  restoreGame(saved) {
    this.stopLoop();
    clearTimeout(this.endTimer);
    this.endTimer = null;

    this.selectedLevelId = saved.levelId;
    const levels = Array.isArray(this.config.data) ? this.config.data : [];
    const selected = levels.find(l => String(l.id) === String(this.selectedLevelId)) || levels[0];
    this.selectedLevelId = selected?.id ?? 1;

    if (Array.isArray(saved.progressionTargets) && saved.progressionTargets.length > 0) {
      const baseTime = this.getBaseTypingTime(selected);
      this.progression = saved.progressionTargets.map(target => {
        const text = String(target).trim().toUpperCase();
        return {
          target: text,
          levelIndex: Math.max(0, levels.indexOf(selected)),
          levelId: selected?.id ?? 1,
          levelName: selected?.name || "Màn chơi",
          typingMode: selected?.typingMode || (text.length > 1 ? "word" : "letter"),
          speedMultiplier: Number(selected?.speedMultiplier) || 1,
          baseTypingTime: baseTime
        };
      });
    } else {
      this.buildProgression();
    }

    this.rocksPassed = Math.max(0, Math.min(Number(saved.currentStep) || 0, this.progression.length - 1));
    this.score = Number(saved.score) || 0;
    this.elapsed = 0;
    this.remaining = typeof saved.timeLeft === 'number' && saved.timeLeft > 0 ? saved.timeLeft : this.getTypingTime();

    if (saved.background) {
      this.setBackground(saved.background);
    } else {
      this.randomizeBackground();
    }
    this.sound.playRestart();
    this.state = "PLAYING";

    this.measureScene();
    this.rocks.createInitialPath(this.progression, this.rocksPassed);
    const rock = this.rocks.currentRock;
    if (rock) {
      this.player.placeOnRock(rock);
    }
    const target = this.rocks.targetRock;
    if (target) {
      this.typing.setTarget(target.letter);
    }
    this.updateCamera();

    this.typing.setLocked(false);
    this.typing.focus();
    this.updateTypingFeedback("");
    this.el.overlay.classList.add("hidden");
    this.setFeedback("Tiếp tục vượt ghềnh! Gõ chữ trên đá rồi nhấn Enter", "good");
    this.updateTimerUI(true);
    this.renderHUD();
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
    this.showToast("Đã khôi phục ván chơi!", "good");
  }

  /**
   * Lấy thông tin từ khóa của bậc đá hiện tại
   */
  getCurrentProgressionItem() {
    return this.progression[this.rocksPassed] || this.progression[this.progression.length - 1];
  }

  /**
   * Giữ nhân vật trong khung nhìn an toàn và đẩy các bậc đá xuống dưới
   */
  updateCamera() {
    const thresholdRatio = Number(this.config.settings?.cameraThresholdRatio) || 0.2;
    const cameraThresholdY = this.sceneHeight * thresholdRatio;

    if (this.player.y < cameraThresholdY) {
      const diff = cameraThresholdY - this.player.y;

      this.player.y = cameraThresholdY;
      if (this.player.isJumping) {
        this.player.jumpStartY += diff;
      }
      this.player.render();

      this.rocks.shiftY(diff);
    }
  }

  /**
   * Vòng lặp chính của trò chơi (Game Loop)
   */
  loop(now) {
    if (this.state !== "PLAYING" && this.state !== "COMPLETING") return;

    // Giới hạn delta time an toàn từ 0 đến 0.05s tránh nhảy vọt khung hình khi chuyển tab
    const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.elapsed += delta;
    this.remaining -= delta;

    // Tốc độ rơi cập nhật theo màn chơi
    const currentItem = this.getCurrentProgressionItem();
    const speedMultiplier = Number(currentItem?.speedMultiplier) || 1;
    const speed = this.config.settings.baseFallSpeed * speedMultiplier;

    // Cập nhật vị trí các viên đá và nhân vật (chỉ dùng CSS GPU transform)
    this.rocks.update(delta, speed);
    this.player.update(delta);

    // Cập nhật camera giữ nhân vật trong ngưỡng an toàn 40%
    this.updateCamera();

    // Cập nhật thanh đếm ngược với scaleX (GPU accelerated)
    this.updateTimerUI();

    // Dùng this.dangerY đã được lưu đệm, chỉ kiểm tra khi đang chơi bình thường
    if (this.state === "PLAYING") {
      if (this.rocks.isCurrentRockDangerous(this.dangerY)) {
        this.endGame("danger");
        return;
      }
      if (this.remaining <= 0) {
        this.endGame("timeout");
        return;
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Xử lý khi người chơi gõ đúng từ khóa
   */
  handleCorrect() {
    if (this.state !== "PLAYING" || this.player.isJumping) return;
    this.typing.setLocked(true);

    this.rocksPassed++;
    const totalRocks = this.progression.length;
    const maxScore = this.config.maxScore || 100;
    this.score = Math.min(maxScore, Math.round((this.rocksPassed / totalRocks) * maxScore));

    // Lưu tiến trình ván chơi vào LocalStorage
    this.storage.saveGameState(this);

    // Đánh dấu bậc đá hiện tại đã vượt qua (chuyển sang Rock_.png)
    this.rocks.markCurrentRockPassed();

    // Xóa phản hồi gõ phím khi đã nhấn Enter đúng
    this.updateTypingFeedback("");

    this.sound.playSuccess();
    this.showToast("Đúng rồi!", "good");
    this.setFeedback("Xuất sắc! Nhảy lên nào!", "good");

    // Hiệu ứng hạt bụi giậm chân bật nhảy nhẹ nhàng ngay dưới chân nhân vật
    this.createJumpParticles(this.player.x, this.player.y);

    const isLastWord = this.rocksPassed >= this.progression.length;

    let nextRock = this.rocks.rocks[this.rocks.currentIndex + 1];
    if (!nextRock && isLastWord) {
      // Đề phòng trường hợp hiếm chưa có bậc đích, tạo ngay bậc đích
      const curY = this.player.y || (this.rocks.currentRock ? this.rocks.currentRock.y : 300);
      const rockGap = Number(this.config.settings?.rockVerticalGap) || 100;
      this.rocks.addFinishRock(this.rocks.sceneWidth * 0.5, curY - rockGap);
      this.rocks.hasFinishRock = true;
      this.rocks.renderPositions();
      this.rocks.updateCurrentRockVisuals();
      nextRock = this.rocks.rocks[this.rocks.currentIndex + 1];
    }

    if (!nextRock) {
      if (isLastWord) {
        this.endGame("victory");
      } else {
        this.endGame("danger");
      }
      return;
    }

    const prevLevelId = this.progression[this.rocksPassed - 1]?.levelId;
    const nextItem = this.progression[this.rocksPassed];
    const jumpDuration = this.config.settings.jumpDuration || 0.45;

    if (isLastWord) {
      this.state = "COMPLETING";
      this.score = maxScore;
      this.renderHUD();
      this.setFeedback("Tuyệt vời! Bật nhảy về đích nào!", "good");
    } else {
      this.setFeedback("Xuất sắc! Nhảy lên nào!", "good");
    }

    // Nhảy sang bậc tiếp theo với quỹ đạo vòm parabol
    this.player.jumpTo(nextRock, jumpDuration, () => {
      // Nếu là bước nhảy hoàn thành từ khóa cuối cùng
      if (isLastWord) {
        this.rocks.advance();
        const current = this.rocks.currentRock;
        if (current) this.player.placeOnRock(current);

        // Nếu bậc tiếp theo là Bậc Đích, thực hiện cú nhảy vinh quang về Đích
        const finishRock = this.rocks.targetRock;
        if (finishRock && finishRock.isFinish) {
          this.setFeedback("Vinh quang về đích!", "good");
          this.player.jumpTo(finishRock, jumpDuration, () => {
            this.rocks.advance();
            if (this.rocks.currentRock) this.player.placeOnRock(this.rocks.currentRock);
            this.completeVictory(maxScore);
          });
        } else {
          this.completeVictory(maxScore);
        }
        return;
      }

      if (this.state !== "PLAYING") return;
      this.rocks.advance();
      const current = this.rocks.currentRock;
      if (current) this.player.placeOnRock(current);

      // Nếu chuyển sang màn mới, phát âm thanh chúc mừng
      if (nextItem && nextItem.levelId !== prevLevelId) {
        this.sound.playVictory();
        this.showToast(`Lên ${nextItem.levelName}!`, "good");
      }

      const nextTarget = this.rocks.targetRock;
      if (nextTarget) {
        this.typing.setTarget(nextTarget.letter);
        this.typing.setLocked(false);
        this.typing.focus();
        this.remaining = this.getTypingTime();
        this.updateTimerUI(true);
        this.setFeedback("Gõ chữ trên đá rồi nhấn Enter để nhảy", "info");
      }
      this.updateTypingFeedback("");
      this.renderHUD();
    });
    this.renderHUD();
  }

  /**
   * Hoàn thành ván chơi chiến thắng
   */
  completeVictory(maxScore) {
    this.score = maxScore;
    this.renderHUD();
    this.setFeedback("Chúc mừng con đã về đích!", "good");
    this.sound.playVictory();
    this.player.celebrate();

    // Bung hiệu ứng hạt chúc mừng khi đáp xuống Bậc Đích
    this.createJumpParticles(this.player.x, this.player.y);
    setTimeout(() => this.createJumpParticles(this.player.x - 25, this.player.y - 10), 160);
    setTimeout(() => this.createJumpParticles(this.player.x + 25, this.player.y - 10), 320);

    this.endTimer = setTimeout(() => {
      this.endGame("victory");
    }, 950);
  }

  /**
   * Xử lý khi người chơi gõ sai từ khóa
   */
  handleWrong() {
    if (this.state !== "PLAYING" || this.player.isJumping) return;
    this.sound.playError();
    this.showToast("Thử lại nhé!", "bad");
    this.setFeedback("Chưa đúng rồi, thử lại nhé!", "bad");

    // Hiệu ứng rung đỏ trực tiếp trên bậc đá mục tiêu
    const targetRock = this.rocks.targetRock;
    if (targetRock && targetRock.element) {
      targetRock.element.classList.remove("typing-wrong");
      void targetRock.element.offsetWidth;
      targetRock.element.classList.add("typing-wrong");
    }

    // Hiệu ứng rung đỏ trên bong bóng nhân vật
    if (this.el.playerBubble) {
      this.el.playerBubble.classList.remove("typing-wrong");
      void this.el.playerBubble.offsetWidth;
      this.el.playerBubble.classList.add("typing-wrong");
    }

    if (this.player.imgElement) {
      this.player.imgElement.animate(
        [{ transform: "translateX(-8px) rotate(-3deg)" },
         { transform: "translateX(8px) rotate(3deg)" },
         { transform: "translateX(-4px)" },
         { transform: "translateX(0)" }],
        { duration: 220 }
      );
    }
  }

  /**
   * Cập nhật phản hồi gõ phím trực tiếp lên bậc đá mục tiêu và bong bóng nhân vật
   */
  updateTypingFeedback(value) {
    const targetRock = this.rocks.targetRock;
    const targetText = this.typing.target || targetRock?.letter || "";
    const cleanValue = String(value || "").toUpperCase();

    // 1. Cập nhật bong bóng trên đầu nhân vật theo thời gian thực
    if (this.el.playerBubble) {
      if (cleanValue.length > 0) {
        this.el.playerBubble.classList.remove("hidden");
        const textSpan = this.el.playerBubble.querySelector(".bubble-text");
        if (textSpan) textSpan.textContent = cleanValue;

        const isPrefixMatch = targetText.startsWith(cleanValue);
        this.el.playerBubble.classList.toggle("typing-correct", isPrefixMatch);
        this.el.playerBubble.classList.toggle("typing-wrong", !isPrefixMatch);
      } else {
        this.el.playerBubble.classList.add("hidden");
        const textSpan = this.el.playerBubble.querySelector(".bubble-text");
        if (textSpan) textSpan.textContent = "";
        this.el.playerBubble.classList.remove("typing-correct", "typing-wrong");
      }
    }

    // 2. Cập nhật màu sắc trực tiếp trên chữ của bậc đá mục tiêu
    if (targetRock && targetRock.element) {
      targetRock.element.classList.remove("typing-correct", "typing-wrong");

      if (cleanValue.length > 0) {
        const isPrefixMatch = targetText.startsWith(cleanValue);
        if (isPrefixMatch) {
          targetRock.element.classList.add("typing-correct");
        } else {
          targetRock.element.classList.add("typing-wrong");
        }
      }
    }

    // 3. Cập nhật khung nhập liệu góc màn hình
    if (this.el.typedValue) {
      this.el.typedValue.textContent = cleanValue || "_";
    }
  }

  /**
   * Hiển thị từ đang gõ lên khung nhập liệu và đồng bộ phản hồi
   */
  renderInput(value) {
    this.updateTypingFeedback(value);
  }

  /**
   * Cập nhật thanh đếm ngược thời gian
   */
  updateTimerUI(force = false) {
    const totalTime = this.getTypingTime();
    const ratio = Math.max(0, Math.min(1, this.remaining / totalTime));

    this.el.timeBar.style.transform = `scaleX(${ratio.toFixed(3)})`;

    const isWarning = ratio < 0.3;
    if (force || isWarning !== this.lastIsWarning) {
      this.lastIsWarning = isWarning;
      this.el.timeBar.classList.toggle("warning", isWarning);
    }

    const text = `${Math.max(0, this.remaining).toFixed(1)}s`;
    if (force || text !== this.lastTimeText) {
      this.lastTimeText = text;
      this.el.timeText.textContent = text;
    }
  }

  /**
   * Cập nhật thông tin điểm số, tên màn và danh sách từ đã vượt
   */
  renderHUD(speedMultiplier) {
    const currentItem = this.getCurrentProgressionItem();
    const multiplier = speedMultiplier ?? (Number(currentItem?.speedMultiplier) || 1);

    this.el.score.textContent = this.score;
    if (currentItem) {
      if (this.el.levelLabel) this.el.levelLabel.textContent = String(currentItem.levelId).padStart(2, "0");
      if (this.el.levelSubtitle) this.el.levelSubtitle.textContent = currentItem.levelName;
    }
    if (this.el.passedCount) this.el.passedCount.textContent = `${this.rocksPassed}/${this.progression.length} bậc`;

    if (this.el.passedWords) {
      const completed = this.progression.slice(0, this.rocksPassed).map(item => item.target);
      this.el.passedWords.textContent = completed.length > 0 ? `Đã vượt: ${completed.join(" · ")}` : "Bắt đầu vượt ghềnh";
    }
  }

  /**
   * Hiển thị thông điệp hướng dẫn hoặc phản hồi
   */
  setFeedback(message, type) {
    this.el.feedback.textContent = message;
    this.el.feedback.className = `feedback ${type}`.trim();
  }

  /**
   * Hiển thị thông báo Toast nhanh
   */
  showToast(message, type) {
    clearTimeout(this.toastTimer);
    this.el.toast.textContent = message;
    this.el.toast.className = `toast show ${type}`;
    this.toastTimer = setTimeout(() => {
      this.el.toast.className = "toast";
    }, 900);
  }

  /**
   * Hiển thị hộp thoại Modal toàn màn hình
   */
  showOverlay({ title, message, button }) {
    this.el.modalTitle.textContent = title;
    this.el.modalMessage.textContent = message;
    this.el.startBtn.textContent = button;
    this.el.overlay.classList.remove("hidden");
  }

  /**
   * Kết thúc ván chơi (thắng, rơi xuống nước hoặc hết giờ)
   */
  endGame(reason) {
    if (this.state !== "PLAYING" && this.state !== "COMPLETING") return;
    this.state = "GAME_OVER";
    this.storage.clear();
    clearTimeout(this.endTimer);
    this.endTimer = null;
    this.stopLoop();
    this.typing.setLocked(true);

    const victory = reason === "victory";
    const levelObj = this.config.data?.find(l => String(l.id) === String(this.selectedLevelId));
    const levelName = levelObj?.name ? `Màn ${this.selectedLevelId} (${levelObj.name})` : `Màn ${this.selectedLevelId}`;

    if (this.el.endStars) {
      if (victory) {
        this.el.endStars.innerHTML = `<span class="achievement-pill gold">HOÀN THÀNH XUẤT SẮC</span>`;
      } else if (this.score >= 50) {
        this.el.endStars.innerHTML = `<span class="achievement-pill blue">KẾT QUẢ TỐT</span>`;
      } else {
        this.el.endStars.innerHTML = `<span class="achievement-pill gray">CẦN CỐ GẮNG HƠN</span>`;
      }
    }

    if (this.el.endMascotImg) {
      this.el.endMascotImg.src = victory ? "assets/images/Robot_happy.jpg" : "assets/images/Robot_buon.jpg";
      this.el.endMascotImg.alt = victory ? "Robot vui mừng" : "Robot buồn";
    }
    const mascotRing = this.el.modal?.querySelector(".mascot-ring");
    if (mascotRing) {
      mascotRing.classList.toggle("is-sad", !victory);
    }

    if (victory) {
      this.sound.playVictory();
      this.el.modalTitle.textContent = "Chiến Thắng Rực Rỡ!";
      this.el.modalMessage.textContent = `Bé đã vượt hết ${levelName} và đạt ${this.score} điểm xuất sắc!`;
      this.setFeedback("Giỏi quá! Bé đã về đích an toàn!", "good");
    } else {
      this.sound.playError();
      this.el.modalTitle.textContent = reason === "danger" ? "Rơi vào khu vực nguy hiểm mất rồi!" : "Hết giờ mất rồi!";
      this.el.modalMessage.textContent = `Bé đạt được ${this.score} điểm. Thử lại nhé!`;
      this.setFeedback(reason === "danger" ? "Cố lên! Nhanh tay hơn chút nhé!" : "Nhanh tay gõ phím nào!", "bad");
    }

    if (this.el.modal) this.el.modal.classList.remove("in-level-select");
    this.el.levelSelectView.classList.add("hidden");
    this.el.endView.classList.remove("hidden");
    this.el.startBtn.innerHTML = `<span>Chơi lại màn này</span>`;
    this.el.overlay.classList.remove("hidden");
  }

  /**
   * Cập nhật lại khung cảnh khi thay đổi kích thước cửa sổ
   */
  onResize() {
    this.measureScene();
    if (this.state === "PLAYING" || this.state === "COMPLETING") {
      this.rocks.resize();
      const current = this.rocks.currentRock;
      if (!this.player.isJumping && current) this.player.placeOnRock(current);
      this.updateCamera();
    } else {
      this.prepareScene();
    }
  }

  /**
   * Tạo hiệu ứng hạt phát sáng khi nhân vật nhảy
   */
  createJumpParticles(x, y) {
    if (!this.el.scene) return;

    // 1. Vòng shockwave sáng rõ dưới đế chân tiếp xúc mặt đá
    const ring = document.createElement("div");
    ring.className = "jump-shockwave";
    ring.style.left = `${Math.round(x)}px`;
    ring.style.top = `${Math.round(y - 2)}px`;
    this.el.scene.appendChild(ring);
    setTimeout(() => {
      ring.remove();
    }, 420);

    // 2. Cụm 20 hạt tinh thể năng lượng phát sáng rõ nét
    const colors = ["#ffffff", "#00f0ff", "#ffe600", "#38c8e8", "#ff9f43", "#70e000"];
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement("div");
      p.className = "jump-particle";
      const size = Math.floor(Math.random() * 5) + 6; // Kích thước hạt từ 6px đến 10px rõ ràng
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;

      const color = colors[i % colors.length];
      p.style.backgroundColor = color;
      p.style.color = color;
      p.style.boxShadow = `0 0 8px ${color}, 0 0 14px ${color}`;
      p.style.left = `${Math.round(x)}px`;
      p.style.top = `${Math.round(y - 5)}px`;

      // Hạt bung tỏa hình cánh quạt mạnh mẽ sang hai bên và vút lên
      const angle = (Math.PI * 0.15) + (Math.random() * Math.PI * 0.7);
      const side = (i % 2 === 0) ? 1 : -1;
      const distance = Math.random() * 45 + 18;

      const speedX = Math.cos(angle) * distance * side;
      const speedY = -Math.sin(angle) * (Math.random() * 28 + 10);

      p.style.setProperty("--dx", `${speedX.toFixed(1)}px`);
      p.style.setProperty("--dy", `${speedY.toFixed(1)}px`);

      this.el.scene.appendChild(p);

      setTimeout(() => {
        p.remove();
      }, 550);
    }
  }
}
