export class TypingController {
  /**
   * Khởi tạo bộ điều khiển gõ phím
   */
  constructor({ onCorrect, onWrong, onInput, onKeyType }) {
    this.target = "";
    this.input = "";
    this.enabled = false;
    this.locked = false;
    this.onCorrect = onCorrect;
    this.onWrong = onWrong;
    this.onInput = onInput;
    this.onKeyType = onKeyType;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleVirtualInput = this.handleVirtualInput.bind(this);

    // Tạo hidden input để kích hoạt bàn phím cảm ứng trên Mobile / Tablet
    this.hiddenInput = this.createHiddenInput();
  }

  /**
   * Tạo thẻ input ẩn để mở bàn phím ảo trên mobile
   */
  createHiddenInput() {
    let input = document.getElementById("hiddenTypingInput");
    if (!input) {
      input = document.createElement("input");
      input.id = "hiddenTypingInput";
      input.type = "text";
      input.autocomplete = "off";
      input.autocapitalize = "characters";
      input.spellcheck = false;
      input.style.cssText = "position:fixed;opacity:0;pointer-events:none;top:-9999px;left:-9999px;width:1px;height:1px;";
      document.body.appendChild(input);
    }
    input.addEventListener("input", this.handleVirtualInput);
    return input;
  }

  /**
   * Bật lắng nghe sự kiện phím
   */
  enable() {
    if (this.enabled) return;
    window.addEventListener("keydown", this.handleKeyDown);
    this.enabled = true;
  }

  /**
   * Tắt lắng nghe sự kiện phím
   */
  disable() {
    if (!this.enabled) return;
    window.removeEventListener("keydown", this.handleKeyDown);
    this.enabled = false;
    if (this.hiddenInput) {
      this.hiddenInput.blur();
    }
  }

  /**
   * Focus vào input để mở bàn phím ảo
   */
  focus() {
    if (this.hiddenInput && !this.locked) {
      try {
        this.hiddenInput.focus();
      } catch {
        // Bỏ qua nếu trình duyệt chặn focus
      }
    }
  }

  /**
   * Đặt từ mục tiêu mới cần gõ
   */
  setTarget(target) {
    this.target = String(target ?? "").trim().toUpperCase();
    this.input = "";
    this.locked = false;
    if (this.hiddenInput) {
      this.hiddenInput.value = "";
    }
    this.onInput?.(this.input);
  }

  /**
   * Khóa hoặc mở khóa quyền gõ phím
   */
  setLocked(value) {
    this.locked = value;
    if (value && this.hiddenInput) {
      this.hiddenInput.blur();
    }
  }

  /**
   * Xóa nội dung đang gõ
   */
  clear() {
    this.input = "";
    if (this.hiddenInput) {
      this.hiddenInput.value = "";
    }
    this.onInput?.(this.input);
  }

  /**
   * Xử lý nhập liệu từ bàn phím ảo
   */
  handleVirtualInput(event) {
    if (this.locked || !this.target) return;
    const raw = String(event.target.value || "").toUpperCase();
    const clean = raw.replace(/[^\p{L}\p{N}\s]/gu, "").slice(0, this.target.length);
    this.input = clean;
    event.target.value = clean;
    this.onInput?.(this.input);
    this.onKeyType?.();
  }

  /**
   * Xử lý nhấn phím vật lý
   */
  handleKeyDown(event) {
    if (this.locked || !this.target) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;

    if (event.key === "Enter") {
      event.preventDefault();
      if (!this.input) return;
      if (this.input === this.target) {
        this.locked = true;
        this.onCorrect?.(this.target);
      } else {
        this.onWrong?.(this.input);
        this.clear();
      }
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (this.input.length > 0) {
        this.input = this.input.slice(0, -1);
        if (this.hiddenInput) this.hiddenInput.value = this.input;
        this.onInput?.(this.input);
        this.onKeyType?.();
      }
      return;
    }

    // Cho phép nhập ký tự chữ cái, số, khoảng trắng (nếu target có khoảng trắng)
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey) {
      const char = event.key.toUpperCase();
      // Ngăn bấm dấu cách vô ích nếu mục tiêu không có khoảng trắng
      if (char === " " && !this.target.includes(" ")) {
        event.preventDefault();
        return;
      }

      if (/^[\p{L}\p{N}\s]$/u.test(char)) {
        event.preventDefault();
        if (this.input.length >= this.target.length) return;
        this.input += char;
        if (this.hiddenInput) this.hiddenInput.value = this.input;
        this.onInput?.(this.input);
        this.onKeyType?.();
      }
    }
  }
}
