export class RockManager {
  /**
   * Khởi tạo bộ quản lý bậc đá
   */
  constructor({ layer, scene, config }) {
    this.layer = layer;
    this.scene = scene;
    this.config = config;
    this.rocks = [];
    this.currentIndex = 0;
    this.nextId = 0;
    this.progression = [];
    this.nextProgressionIndex = 0;
    this.sceneWidth = 0;
    this.sceneHeight = 0;
    this.currentSpeed = 60;
    this.hasFinishRock = false;

    // Bộ nhớ đệm DOM element tái sử dụng
    this.elementPool = [];
  }

  /**
   * Tạo đường đi bậc đá ban đầu
   */
  createInitialPath(progression, startIndex = 0) {
    this.layer.innerHTML = "";
    this.rocks = [];
    this.elementPool = [];
    this.currentIndex = 0;
    this.nextId = 0;
    this.hasFinishRock = false;
    this.progression = progression || [];
    this.nextProgressionIndex = startIndex;
    this.measure();

    const startYRatio = Number(this.config.startRockYRatio ?? this.config.startRockY) || 0.50;
    const baseY = this.sceneHeight * startYRatio;

    // Nếu bắt đầu mới từ đầu (startIndex === 0), tạo bậc xuất phát ban đầu để nhân vật đứng
    if (startIndex === 0) {
      this.addStartRock(this.getX(0), baseY);
    } else {
      // Khi khôi phục ván chơi dở dang, tạo lại bậc đã vượt trước đó để nhân vật đứng
      const prevWord = this.progression[startIndex - 1];
      this.addRock(prevWord, this.getX(startIndex), baseY);
      if (this.rocks[0]) this.rocks[0].passed = false;
    }

    const remainingCount = Math.max(0, this.progression.length - startIndex);
    const initialCount = Math.min(remainingCount, 8);
    const stepOffset = startIndex === 0 ? 1 : startIndex + 1;

    for (let i = 0; i < initialCount; i++) {
      const item = this.progression[this.nextProgressionIndex++];
      const x = this.getX(stepOffset + i);
      const y = baseY - (i + 1) * this.config.rockVerticalGap;
      this.addRock(item, x, y);
    }

    if (this.nextProgressionIndex >= this.progression.length && !this.hasFinishRock) {
      this.hasFinishRock = true;
      let minY = Infinity;
      for (let j = 0; j < this.rocks.length; j++) {
        if (!this.rocks[j].passed && this.rocks[j].y < minY) {
          minY = this.rocks[j].y;
        }
      }
      const finishY = Number.isFinite(minY) ? minY - this.config.rockVerticalGap : 90;
      this.addFinishRock(this.sceneWidth * 0.5, finishY);
    }

    this.renderPositions();
    this.updateCurrentRockVisuals();
  }

  /**
   * Đo kích thước khung cảnh
   */
  measure() {
    const rect = this.scene ? this.scene.getBoundingClientRect() : {};
    this.sceneWidth = rect.width || this.scene?.clientWidth || 800;
    this.sceneHeight = rect.height || this.scene?.clientHeight || 600;
  }

  /**
   * Tính tọa độ X từ mảng vị trí cố định cho bậc đá
   */
  getX(index) {
    const w = this.sceneWidth || 800;
    const points = [0.15, 0.29, 0.43, 0.57, 0.71, 0.85, 0.71, 0.57, 0.43, 0.29];
    return Math.max(65, Math.min(w - 65, w * points[index % points.length]));
  }

  /**
   * Lấy hoặc tạo phần tử DOM cho bậc đá
   */
  getOrCreateRockElement(text) {
    let element = this.elementPool.pop();
    if (!element) {
      element = document.createElement("div");

      // Mũi tên nhỏ nhấp nháy chỉ vào bậc đá mục tiêu
      const arrow = document.createElement("span");
      arrow.className = "target-arrow";
      arrow.textContent = "▼";
      arrow.setAttribute("aria-hidden", "true");
      element.appendChild(arrow);

      // Nhãn chữ cái hoặc từ khóa
      const textSpan = document.createElement("span");
      textSpan.className = "rock-text";
      element.appendChild(textSpan);

      this.layer.appendChild(element);
    }
    element.className = "rock";
    const textSpan = element.querySelector(".rock-text");
    if (textSpan) {
      textSpan.textContent = text || "";
      textSpan.style.color = "";
    } else {
      element.textContent = text || "";
    }
    element.setAttribute("aria-label", text ? `Bậc đá ${text}` : "Bậc xuất phát");
    return element;
  }

  /**
   * Tạo bậc xuất phát ban đầu cho nhân vật đứng
   */
  addStartRock(x, y) {
    const element = this.getOrCreateRockElement("");
    element.classList.add("rock-start");

    this.rocks.push({
      id: this.nextId++,
      letter: "",
      data: { isStart: true },
      isStart: true,
      isFinish: false,
      x,
      y,
      passed: false,
      fallVelocity: 0,
      element
    });
  }

  /**
   * Thêm bậc đá mới vào danh sách
   */
  addRock(item, x, y) {
    const text = typeof item === "string" ? item : (item?.target || "");
    const element = this.getOrCreateRockElement(text);

    this.rocks.push({
      id: this.nextId++,
      letter: text,
      data: item,
      isFinish: false,
      x,
      y,
      passed: false,
      fallVelocity: 0,
      element
    });
  }

  /**
   * Tạo bậc về đích ở đỉnh thang
   */
  addFinishRock(x, y) {
    const element = this.getOrCreateRockElement("ĐÍCH");
    element.className = "rock rock-finish";
    element.setAttribute("aria-label", "Bậc Về Đích");

    this.rocks.push({
      id: this.nextId++,
      letter: "ĐÍCH",
      data: { target: "ĐÍCH", isFinish: true },
      isFinish: true,
      x,
      y,
      passed: false,
      fallVelocity: 0,
      element
    });
  }

  /**
   * Cập nhật vị trí hiển thị các bậc đá
   */
  renderPositions() {
    for (let i = 0; i < this.rocks.length; i++) {
      const rock = this.rocks[i];
      const rx = Math.round(rock.x * 10) / 10;
      const ry = Math.round(rock.y * 10) / 10;
      rock.element.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    }
  }

  /**
   * Cập nhật trạng thái hiển thị của các bậc đá
   */
  updateCurrentRockVisuals() {
    for (let index = 0; index < this.rocks.length; index++) {
      const rock = this.rocks[index];
      const isStanding = index === this.currentIndex;
      const isTarget = index === this.currentIndex + 1;
      const isPassed = index < this.currentIndex || Boolean(rock.passed);

      // Bậc đang đứng: tắt viền sáng
      rock.element.classList.toggle("standing", isStanding);

      // Bậc mục tiêu tiếp theo: bật viền sáng vàng, hiện mũi tên, phóng to chữ
      rock.element.classList.toggle("target-rock", isTarget);
      rock.element.classList.toggle("current", isTarget);

      // Bậc đã hoàn thành trước đó
      rock.element.classList.toggle("passed", isPassed && !isStanding && !isTarget);

      if (rock.isFinish) {
        rock.element.classList.add("rock-finish");
      }

      // Xóa luôn ký tự trên bậc đã hoàn thành (đang đứng hoặc đã vượt qua), không làm mờ
      const textSpan = rock.element.querySelector(".rock-text");
      if (textSpan && !rock.isFinish) {
        if (isStanding || isPassed) {
          textSpan.textContent = "";
        } else if (isTarget || index > this.currentIndex) {
          textSpan.textContent = rock.letter || "";
        }
      }
    }
  }

  /**
   * Đánh dấu bậc đá hiện tại đã vượt qua
   */
  markCurrentRockPassed() {
    const rock = this.currentRock;
    if (rock) {
      rock.passed = true;
      rock.fallVelocity = Math.max(180, (this.currentSpeed || 60) * 2.5);
      rock.element.classList.add("passed");
      rock.element.classList.remove("target-rock", "current");
      if (!rock.isFinish) {
        const textSpan = rock.element.querySelector(".rock-text");
        if (textSpan) textSpan.textContent = "";
      }
    }
  }

  /**
   * Lấy bậc đá nhân vật đang đứng
   */
  get currentRock() {
    return this.rocks[this.currentIndex] ?? null;
  }

  /**
   * Lấy bậc đá mục tiêu tiếp theo cần nhảy tới
   */
  get targetRock() {
    return this.rocks[this.currentIndex + 1] ?? null;
  }

  /**
   * Cập nhật vị trí rơi của các bậc đá theo từng khung hình
   */
  update(deltaSeconds, speed) {
    this.currentSpeed = speed;
    const baseStep = speed * deltaSeconds;
    const maxY = this.sceneHeight + 100;

    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const rock = this.rocks[i];

      if (rock.passed) {
        rock.fallVelocity = (rock.fallVelocity || Math.max(180, speed * 2.5)) + 900 * deltaSeconds;
        rock.y += rock.fallVelocity * deltaSeconds;
      } else {
        rock.y += baseStep;
      }

      if (rock.y > maxY) {
        if (rock.element) {
          rock.element.remove();
        }
        this.rocks.splice(i, 1);
        if (i < this.currentIndex) {
          this.currentIndex--;
        }
        continue;
      }

      const rx = Math.round(rock.x * 10) / 10;
      const ry = Math.round(rock.y * 10) / 10;
      rock.element.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    }
  }

  /**
   * Chuyển sang bậc đá tiếp theo
   */
  advance() {
    if (this.currentRock) {
      this.currentRock.passed = true;
      if (!this.currentRock.fallVelocity) {
        this.currentRock.fallVelocity = Math.max(180, (this.currentSpeed || 60) * 2.5);
      }
    }
    this.currentIndex++;

    if (this.nextProgressionIndex < this.progression.length) {
      const nextItem = this.progression[this.nextProgressionIndex++];
      let minY = Infinity;
      for (let i = 0; i < this.rocks.length; i++) {
        if (!this.rocks[i].passed && this.rocks[i].y < minY) {
          minY = this.rocks[i].y;
        }
      }
      if (!Number.isFinite(minY)) {
        minY = (this.currentRock ? this.currentRock.y : this.sceneHeight * 0.5) - this.config.rockVerticalGap;
      } else {
        minY -= this.config.rockVerticalGap;
      }
      this.addRock(nextItem, this.getX(this.nextId), minY);
    } else if (!this.hasFinishRock) {
      this.hasFinishRock = true;
      let minY = Infinity;
      for (let i = 0; i < this.rocks.length; i++) {
        if (!this.rocks[i].passed && this.rocks[i].y < minY) {
          minY = this.rocks[i].y;
        }
      }
      const finishY = Number.isFinite(minY) ? minY - this.config.rockVerticalGap : 90;
      this.addFinishRock(this.sceneWidth * 0.5, finishY);
    }

    this.renderPositions();
    this.updateCurrentRockVisuals();
    return this.currentRock;
  }

  /**
   * Kiểm tra bậc đá hiện tại có chạm vạch nguy hiểm không
   */
  isCurrentRockDangerous(dangerY) {
    return Boolean(this.currentRock && !this.currentRock.passed && this.currentRock.y >= dangerY);
  }

  /**
   * Đẩy các bậc đá xuống dưới khi camera cuộn
   */
  shiftY(diff) {
    if (!diff || diff <= 0) return;
    const maxY = this.sceneHeight + 100;
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const rock = this.rocks[i];
      rock.y += diff;
      if (rock.passed && rock.y > maxY) {
        if (rock.element) {
          rock.element.remove();
        }
        this.rocks.splice(i, 1);
        if (i < this.currentIndex) {
          this.currentIndex--;
        }
      }
    }
    this.renderPositions();
  }

  /**
   * Căn chỉnh lại vị trí bậc đá khi đổi kích thước màn hình
   */
  resize() {
    this.measure();
    for (let i = 0; i < this.rocks.length; i++) {
      const rock = this.rocks[i];
      if (rock.isFinish) {
        rock.x = this.sceneWidth * 0.5;
      } else {
        rock.x = Math.max(65, Math.min(this.sceneWidth - 65, rock.x));
      }
    }
    this.renderPositions();
  }

  /**
   * Dọn dẹp và xóa toàn bộ bậc đá
   */
  destroy() {
    this.layer.innerHTML = "";
    this.rocks = [];
    this.elementPool = [];
    this.hasFinishRock = false;
  }
}
