/**
 * sound.js - Tạo audio pool theo nhu cầu để không tải âm thanh khi mới mở game.
 */
class SoundManager {
  constructor() {
    this.enabled = true;
    this.poolSizePerSound = 3;

    // Đường dẫn các tệp âm thanh trong thư mục assets/audio
    this.audioFiles = {
      select: 'assets/audio/bubblepop.m4a',
      success: 'assets/audio/showdapan.m4a',
      error: 'assets/audio/incorrect.m4a',
      sparkle: 'assets/audio/Idea_sound.m4a',
      victory: 'assets/audio/complete.m4a',
      restart: 'assets/audio/bubblepop.m4a'
    };

    // Mỗi pool được tạo lười: chỉ tạo Audio khi hiệu ứng thực sự được gọi.
    this.pools = Object.create(null);
  }

  /**
   * Phát âm thanh qua Audio Pool, tái sử dụng các instance sẵn có không tạo mới
   * @param {string} key - Tên khóa ('select', 'success', 'error', 'sparkle', 'victory', 'restart')
   * @param {number} [volume=0.85] - Mức âm lượng (từ 0.0 đến 1.0)
   */
  play(key, volume = 0.85) {
    if (!this.enabled) return;

    try {
      const path = this.audioFiles[key];
      if (!path || typeof Audio === 'undefined') return;
      const pool = this.pools[path] || (this.pools[path] = []);

      // Tìm một audio instance rảnh (đang dừng hoặc đã kết thúc)
      let target = pool.find(a => a.paused || a.ended);

      // Chỉ mở rộng pool đến giới hạn khi nhiều âm thanh cùng phát.
      if (!target && pool.length < this.poolSizePerSound) {
        target = new Audio(path);
        target.preload = 'auto';
        pool.push(target);
      }

      // Nếu tất cả đang phát, tái sử dụng instance đã phát lâu nhất
      if (!target) {
        let maxTime = -1;
        target = pool[0];
        for (let i = 0; i < pool.length; i++) {
          if (pool[i].currentTime > maxTime) {
            maxTime = pool[i].currentTime;
            target = pool[i];
          }
        }
      }

      if (target) {
        target.volume = Math.max(0, Math.min(1, volume));
        if (target.readyState > 0) target.currentTime = 0;
        const playPromise = target.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Trình duyệt có thể hoãn phát nếu người dùng chưa tương tác trang
          });
        }
      }
    } catch (err) {
      console.warn(`[SoundManager] Lỗi phát âm thanh '${key}':`, err);
    }
  }

  /**
   * Âm thanh gõ nhẹ bong bóng khi gõ phím hoặc chọn ô (bubblepop.m4a)
   */
  playSelect() {
    this.play('select', 0.55);
  }

  /**
   * Âm thanh hân hoan khi tìm đúng từ khóa (showdapan.m4a)
   */
  playSuccess() {
    this.play('success', 0.9);
  }

  /**
   * Âm thanh báo sai khi kéo nối không trùng từ khóa (incorrect.m4a)
   */
  playError() {
    this.play('error', 0.75);
  }

  /**
   * Âm thanh gợi ý thông minh từ thám tử robot (Idea_sound.m4a)
   */
  playSparkle() {
    this.play('sparkle', 0.85);
  }

  /**
   * Âm nhạc chiến thắng khi hoàn thành nhiệm vụ (complete.m4a)
   */
  playVictory() {
    this.play('victory', 1.0);
  }

  /**
   * Âm thanh vui tươi khi bấm nút chơi lại màn này (bubblepop.m4a)
   */
  playRestart() {
    this.play('restart', 0.8);
  }
}

export { SoundManager };
