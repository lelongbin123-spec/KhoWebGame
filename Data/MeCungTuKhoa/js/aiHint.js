
 //AiDetective - Module trí tuệ nhân tạo "Thám tử thời gian" & hệ thống gợi ý
 //Theo dõi thao tác kéo sai của học sinh, tạo gợi ý trực quan (Visual Hint - ô chữ cái đầu lấp lánh)
 //và đưa ra câu gợi ý liên tưởng lịch sử - địa lý theo đúng yêu cầu NoteGame.txt.
class AiDetective {
  constructor(soundManager) {
    this.sound = soundManager;
    this.consecutiveFailures = 0;
    this.failureThreshold = 2; // Kích hoạt AI trợ giúp sau 2 lần kéo sai liên tiếp
    this.activeSparkleCell = null;
    
    // Tham chiếu các phần tử DOM
    this.hintCard = document.getElementById('hintCard');
    this.hintText = document.getElementById('hintText');
    this.standbyMessage = 'Thám tử đang quan sát. Tự tìm để đạt 100đ tối đa! (Bấm vào đây hoặc quét sai 2 lần để nhận gợi ý -50% điểm)';
  }

  // Đặt lại trạng thái AI khi chuyển màn hoặc bắt đầu lại
  reset() {
    this.consecutiveFailures = 0;
    this.clearSparkle();
    if (this.hintCard) {
      this.hintCard.classList.remove('hint-active');
    }
    if (this.hintText) {
      this.hintText.textContent = this.standbyMessage;
    }
  }

  // Ghi nhận học sinh đã tìm đúng từ khóa: dọn sạch gợi ý và trở về trạng thái chờ
  recordSuccess() {
    this.consecutiveFailures = 0;
    this.clearSparkle();
    if (this.hintCard) {
      this.hintCard.classList.remove('hint-active');
    }
    if (this.hintText) {
      this.hintText.textContent = '⭐ Rất giỏi! Hãy tiếp tục tự tìm từ khóa tiếp theo để giành điểm tối đa nhé!';
    }
  }

  // Ghi nhận thao tác kéo chọn sai và tự động kích hoạt gợi ý khi đạt đủ 2 lần liên tiếp
  recordFailure(currentKeywords, foundWords, getCellFn) {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.triggerHint(currentKeywords, foundWords, getCellFn, false);
    }
  }

  // Kích hoạt gợi ý: làm sáng lấp lánh ô chữ đầu, đánh dấu từ khóa đã dùng gợi ý (-50% điểm)
  triggerHint(currentKeywords, foundWords, getCellFn, isManual = false) {
    // Tìm từ khóa tiếp theo chưa được giải
    const targetKw = currentKeywords.find(kw => !foundWords.has(kw.display || kw.word));
    if (!targetKw) return;

    // Đánh dấu từ khóa này ĐÃ BỊ SHOW HINT (ảnh hưởng tới điểm số, chỉ nhận 50% điểm)
    targetKw.hasHint = true;
    targetKw.hintUsed = true;

    this.clearSparkle();

    // Gợi ý trực quan (Visual Hint): làm ô chữ cái đầu tiên phát sáng lấp lánh ánh kim
    const r = targetKw.start ? targetKw.start.r : targetKw.row;
    const c = targetKw.start ? targetKw.start.c : targetKw.col;
    const firstCell = getCellFn(r, c);
    if (firstCell) {
      firstCell.classList.add('ai-hint-sparkle');
      this.activeSparkleCell = firstCell;
    }

    // Phát âm thanh chuông lấp lánh ma thuật
    if (this.sound) {
      this.sound.playSparkle();
    }

    // Cập nhật lại danh sách từ khóa hiển thị icon bóng đèn đang gợi ý
    if (typeof window !== 'undefined' && window.__wordMazeGame && window.__wordMazeGame.grid) {
      window.__wordMazeGame.grid.renderKeywordsList(currentKeywords, foundWords);
    }

    // Nội dung gợi ý nhắc nhở điểm số rõ ràng
    const wittyPrefixes = [
      "🕵️ Thám tử gợi ý:",
      "✨ Mẹo nhỏ từ thám tử:",
      "🔍 Manh mối thời gian:"
    ];
    const prefix = wittyPrefixes[Math.floor(Math.random() * wittyPrefixes.length)];
    const dirInfo = (targetKw.dirName && targetKw.dirArrow)
      ? ` theo hướng ${targetKw.dirName} ${targetKw.dirArrow}`
      : '';
    const hintBody = targetKw.aiHint || targetKw.hint || targetKw.clue;
    const message = hintBody
      ? `${prefix} "${hintBody}" (Chữ cái đầu đang lấp lánh${dirInfo} - Từ này sẽ nhận 50% điểm nhé!)`
      : `Hãy bắt đầu từ ô chữ cái đang lấp lánh${dirInfo}! (Từ này sẽ nhận 50% điểm nhé)`;

    if (this.hintText) {
      this.hintText.textContent = message;
    }

    // Hiệu ứng kích hoạt thẻ gợi ý và thu hút sự chú ý của học sinh
    if (this.hintCard) {
      this.hintCard.classList.add('hint-active');
      this.hintCard.style.transform = 'scale(1.03)';
      setTimeout(() => {
        if (this.hintCard) this.hintCard.style.transform = '';
      }, 250);
    }
  }


   // Xóa hiệu ứng lấp lánh trên ô chữ cái đang gợi ý

  clearSparkle() {
    if (this.activeSparkleCell) {
      this.activeSparkleCell.classList.remove('ai-hint-sparkle');
      this.activeSparkleCell = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.AiDetective = AiDetective;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AiDetective;
}
