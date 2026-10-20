// ====================================================
// SCOREMANAGER.JS - QUẢN LÝ ĐIỂM SỐ, PHÂN BỔ ĐIỂM & ĐÁNH GIÁ KẾT QUẢ
// ====================================================

import { state, els } from "./state.js";

// Thang điểm tối đa cho mỗi chế độ chơi (mặc định 100, có thể cấu hình từ data.json)
export let MAX_SCORE = 100;

export function setMaxScore(val) {
  if (typeof val === "number" && val > 0) {
    MAX_SCORE = val;
    state.maxScore = val;
  }
}

export function getMaxScore() {
  return typeof state.maxScore === "number" && state.maxScore > 0 ? state.maxScore : MAX_SCORE;
}

// Lấy điểm số hiện tại
export function getScore() {
  return state.score;
}

// Đặt lại điểm số về 0 và cập nhật UI
export function resetScore() {
  state.score = 0;
  if (els.topScore) {
    els.topScore.textContent = "0";
  }
}

// Cập nhật điểm số và kích hoạt hiệu ứng pop-up ngôi sao bay +⭐
export function updateScore(addPoints = 0) {
  const max = getMaxScore();
  state.score = Math.min(max, state.score + addPoints);
  if (els.topScore) {
    els.topScore.textContent = state.score;
  }

  if (addPoints > 0 && els.scorePopupContainer) {
    showScorePopup(addPoints);
  }
}

// Hiển thị hiệu ứng pop-up điểm bay
export function showScorePopup(points) {
  if (!els.scorePopupContainer) return;
  const popup = document.createElement("div");
  popup.className = "score-popup";
  popup.textContent = `+${points} ⭐`;
  els.scorePopupContainer.appendChild(popup);
  setTimeout(() => popup.remove(), 1200);
}

/**
 * Tính toán phân bổ điểm số đồng đều cho từng câu/thử thách
 * Đảm bảo tổng số điểm khi hoàn thành tất cả các mục luôn bằng đúng 100 điểm (MAX_SCORE)
 * @param {number} currentIndex - Vị trí câu hỏi/thử thách hiện tại (0-indexed)
 * @param {number} totalItems - Tổng số câu hỏi/thử thách trong lượt chơi
 * @returns {number} Số điểm nhận được cho lượt này
 */
export function calculateItemPoints(currentIndex, totalItems) {
  const total = totalItems || 1;
  const max = getMaxScore();
  const basePoints = Math.floor(max / total);
  // Câu cuối cùng bù phần dư để tổng chính xác là max điểm
  return currentIndex === total - 1
    ? max - basePoints * (total - 1)
    : basePoints;
}

/**
 * Đánh giá số sao và lời khen ngợi dựa trên thang điểm tối đa (mặc định 100)
 * @param {number} score - Điểm số cần đánh giá
 * @returns {{ stars: number, message: string, opacities: number[] }}
 */
export function getScoreRating(score = state.score) {
  const max = getMaxScore();
  const ratio = max > 0 ? score / max : 0;
  if (ratio >= 0.8) {
    return {
      stars: 3,
      message: "Bé xuất sắc lắm! 🌟",
      opacities: [1, 1, 1]
    };
  }
  if (ratio >= 0.5) {
    return {
      stars: 2,
      message: "Bé làm tốt lắm! 👏",
      opacities: [1, 1, 0.25]
    };
  }
  return {
    stars: 1,
    message: "Cố lên nhé! Bé hãy thử lại nha! 💪",
    opacities: [1, 0.25, 0.25]
  };
}

/**
 * Áp dụng hiển thị điểm số và số sao lên màn hình kết quả
 */
export function applyScoreResult() {
  if (els.finalScore) {
    els.finalScore.textContent = state.score;
  }

  const rating = getScoreRating(state.score);

  if (els.resultMessage) {
    els.resultMessage.textContent = rating.message;
  }

  if (els.starRatingBox) {
    const starEls = els.starRatingBox.querySelectorAll(".rating-star");
    starEls.forEach((star, idx) => {
      star.style.opacity = String(rating.opacities[idx] ?? 0.25);
    });
  }
}

