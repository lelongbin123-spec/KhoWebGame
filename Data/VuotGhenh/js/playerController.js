export class PlayerController {
  /**
   * Khởi tạo bộ điều khiển nhân vật
   */
  constructor(element, scene) {
    this.element = element;
    this.scene = scene;
    this.imgElement = element.querySelector(".player-img");
    this.shadowElement = element.querySelector(".player-shadow");

    this.x = 0;
    this.y = 0;
    this.lastRenderX = null;
    this.lastRenderY = null;

    this.isJumping = false;
    this.currentRock = null;
    this.targetRock = null;
    this.onComplete = null;

    this.jumpElapsed = 0;
    this.jumpDuration = 0.45;
    this.jumpStartX = 0;
    this.jumpStartY = 0;
    this.jumpHeight = 65;
    this.jumpDirection = 1;

    this.landingTimer = null;

    if (this.element.parentElement !== this.scene) {
      this.scene.appendChild(this.element);
    }
  }

  /**
   * Đặt nhân vật đứng lên bậc đá
   */
  placeOnRock(rock) {
    if (!rock) return;
    this.clearLandingTimer();

    this.currentRock = rock;
    this.targetRock = null;
    this.isJumping = false;
    this.onComplete = null;

    this.x = rock.x;
    this.y = rock.y - 10;

    if (this.imgElement) {
      this.imgElement.style.transform = "";
    }
    if (this.shadowElement) {
      this.shadowElement.style.transform = "translateX(-50%)";
      this.shadowElement.style.opacity = "1";
    }

    this.element.classList.remove("jumping");
    this.render();
  }

  /**
   * Kích hoạt cú nhảy sang bậc đá tiếp theo
   */
  jumpTo(rock, duration, onComplete) {
    if (!rock) return false;
    if (typeof duration === "function") {
      onComplete = duration;
      duration = 0.45;
    }

    this.clearLandingTimer();

    this.targetRock = rock;
    this.isJumping = true;
    this.onComplete = onComplete;
    this.jumpElapsed = 0;
    this.jumpDuration = Math.max(0.2, Number(duration) || 0.45);
    this.jumpStartX = this.x;
    this.jumpStartY = this.y;

    this.jumpDirection = rock.x >= this.x ? 1 : -1;

    const dx = rock.x - this.x;
    const dy = rock.y - 18 - this.y;
    const dist = Math.hypot(dx, dy);
    this.jumpHeight = Math.min(85, Math.max(52, dist * 0.38));

    this.element.classList.add("jumping");
    return true;
  }

  /**
   * Hủy bộ đếm thời gian hiệu ứng tiếp đất
   */
  clearLandingTimer() {
    if (this.landingTimer) {
      clearTimeout(this.landingTimer);
      this.landingTimer = null;
    }
  }

  /**
   * Cập nhật chuyển động của nhân vật theo từng khung hình
   */
  update(deltaSeconds = 0.016) {
    if (this.isJumping) {
      if (!this.targetRock) return;

      this.jumpElapsed += deltaSeconds;
      const t = Math.min(1, this.jumpElapsed / this.jumpDuration);

      // Tọa độ mục tiêu động theo bậc đá đích đang rơi
      const dynTargetX = this.targetRock.x;
      const dynTargetY = this.targetRock.y - 18;

      // Trục ngang X: lướt mượt mà sang bậc đích
      this.x = this.jumpStartX + (dynTargetX - this.jumpStartX) * t;

      // Trục dọc Y (mặt nền tảng): theo bậc đá đang rơi
      this.y = this.jumpStartY + (dynTargetY - this.jumpStartY) * t;

      // Vòng cung parabol bật nhảy lên cao (đỉnh cao nhất tại giữa cú nhảy t = 0.5)
      const sinT = Math.sin(Math.PI * t);
      const arc = sinT * this.jumpHeight;

      // Cảm giác cơ thể nhảy (squash, stretch & tilt theo hướng bay):
      if (this.imgElement) {
        const tilt = sinT * 9 * this.jumpDirection;
        const stretchY = 1 + sinT * 0.12;
        const squashX = 1 - sinT * 0.07;
        this.imgElement.style.transform = `translateY(-${arc.toFixed(1)}px) scale(${squashX.toFixed(2)}, ${stretchY.toFixed(2)}) rotate(${tilt.toFixed(1)}deg)`;
      }

      // Bóng nhân vật ở dưới mặt đất: thu nhỏ và mờ đi khi người bay lên cao
      if (this.shadowElement) {
        const arcRatio = arc / this.jumpHeight;
        const shadowScale = Math.max(0.45, 1 - arcRatio * 0.45);
        const shadowOpacity = Math.max(0.18, 1 - arcRatio * 0.72);
        this.shadowElement.style.transform = `translateX(-50%) scale(${shadowScale.toFixed(2)})`;
        this.shadowElement.style.opacity = shadowOpacity.toFixed(2);
      }

      this.render();

      // Kết thúc cú nhảy khi tiếp đất
      if (t >= 1) {
        this.isJumping = false;
        this.currentRock = this.targetRock;
        this.targetRock = null;
        this.x = dynTargetX;
        this.y = dynTargetY;

        this.element.classList.remove("jumping");

        // Phản lực tiếp đất (landing squash nhẹ)
        if (this.imgElement) {
          this.imgElement.style.transform = "translateY(0) scale(1.14, 0.88)";
          this.landingTimer = setTimeout(() => {
            if (!this.isJumping && this.imgElement) {
              this.imgElement.style.transform = "";
            }
            this.landingTimer = null;
          }, 130);
        }

        if (this.shadowElement) {
          this.shadowElement.style.transform = "translateX(-50%)";
          this.shadowElement.style.opacity = "1";
        }

        this.render();

        const cb = this.onComplete;
        this.onComplete = null;
        if (typeof cb === "function") {
          cb();
        }
      }
    } else {
      // Stick to current rock (bám chắc theo bậc đá hiện tại đang rơi)
      if (this.currentRock) {
        this.x = this.currentRock.x;
        this.y = this.currentRock.y - 18;
      }
      this.render();
    }
  }

  /**
   * Cập nhật vị trí hiển thị nhân vật trên màn hình
   */
  render() {
    const rx = Math.round(this.x * 10) / 10;
    const ry = Math.round(this.y * 10) / 10;
    if (rx !== this.lastRenderX || ry !== this.lastRenderY) {
      this.lastRenderX = rx;
      this.lastRenderY = ry;
      this.element.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -100%)`;
    }
  }

  /**
   * Hoạt họa nhảy ăn mừng khi về đích
   */
  celebrate() {
    this.clearLandingTimer();
    if (!this.imgElement) return;
    this.imgElement.animate([
      { transform: "translateY(0) scale(1.1, 0.9)" },
      { transform: "translateY(-30px) scale(0.94, 1.12)" },
      { transform: "translateY(0) scale(1.1, 0.9)" },
      { transform: "translateY(-18px) scale(0.96, 1.06)" },
      { transform: "translateY(0) scale(1, 1)" }
    ], {
      duration: 750,
      easing: "ease-out"
    });
  }
}
