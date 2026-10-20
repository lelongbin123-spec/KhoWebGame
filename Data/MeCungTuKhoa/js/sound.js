/**
 * sound.js - Quản lý phát toàn bộ hiệu ứng âm thanh bằng các tệp trong thư mục assets/audio
 */

class SoundManager {
  constructor() {
    this.enabled = true;

    // Đường dẫn các tệp âm thanh trong thư mục assets/audio
    this.audioFiles = {
      select: 'assets/audio/bubblepop.m4a',
      success: 'assets/audio/showdapan.m4a',
      error: 'assets/audio/incorrect.m4a',
      sparkle: 'assets/audio/Idea_sound.m4a',
      victory: 'assets/audio/complete.m4a',
      restart: 'assets/audio/bubblepop.m4a'
    };

    // Bộ nhớ đệm các đối tượng Audio để tối ưu thời gian phản hồi
    this.audioCache = {};
    this.initAudioCache();
  }

  /**
   * Tải trước (preload) các tệp âm thanh để sẵn sàng phát tức thì không có độ trễ
   */
  initAudioCache() {
    for (const [key, path] of Object.entries(this.audioFiles)) {
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        this.audioCache[key] = audio;
      } catch (err) {
        console.warn(`[SoundManager] Không thể tải trước âm thanh ${path}:`, err);
      }
    }
  }

  /**
   * Mở khóa AudioContext / Audio playback sau cử chỉ tương tác đầu tiên của người dùng
   */
  init() {
    for (const key in this.audioCache) {
      const audio = this.audioCache[key];
      if (audio && typeof audio.load === 'function' && audio.readyState === 0) {
        audio.load();
      }
    }
  }

  /**
   * Phát âm thanh theo khóa định danh, hỗ trợ tạo bản sao để âm thanh có thể chồng âm mượt mà
   * @param {string} key - Tên khóa ('select', 'success', 'error', 'sparkle', 'victory', 'restart')
   * @param {number} [volume=0.85] - Mức âm lượng (từ 0.0 đến 1.0)
   */
  play(key, volume = 0.85) {
    if (!this.enabled) return;

    try {
      const cached = this.audioCache[key];
      let soundToPlay = null;

      if (cached && typeof cached.cloneNode === 'function') {
        // Sao chép đối tượng Audio để có thể phát lặp/chồng âm liên tục khi kéo chuột nhanh
        soundToPlay = cached.cloneNode(true);
      } else if (cached && typeof cached.play === 'function') {
        cached.currentTime = 0;
        soundToPlay = cached;
      } else {
        const path = this.audioFiles[key];
        if (path && typeof Audio === 'function') {
          soundToPlay = new Audio(path);
        }
      }

      if (soundToPlay) {
        soundToPlay.volume = Math.max(0, Math.min(1, volume));
        if (typeof soundToPlay.addEventListener === 'function') {
          soundToPlay.addEventListener('ended', () => {
            soundToPlay.src = '';
            soundToPlay = null;
          }, { once: true });
        }
        const playPromise = soundToPlay.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            // Trình duyệt có thể chặn autoplay nếu học sinh chưa nhấn bất kỳ đâu trên trang
          });
        }
      }
    } catch (err) {
      console.warn(`[SoundManager] Lỗi phát âm thanh '${key}':`, err);
    }
  }

  /**
   * Âm thanh gõ nhẹ bong bóng (bubblepop.m4a) khi rê chuột qua từng ô chữ cái
   */
  playSelect() {
    this.play('select', 0.6);
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

if (typeof window !== 'undefined') {
  window.SoundManager = SoundManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundManager;
}

