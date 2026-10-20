// ====================================================
// UI.JS - QUẢN LÝ GIAO DIỆN, ROBOT TRỢ LÝ, ĐIỂM SỐ & TOAST
// ====================================================

import { state, els, screens } from "./state.js";
import { playSfx, stopSoundPlayback } from "./audio.js";

// Chuyển đổi màn hình hiển thị
export function showScreen(screen) {
  screens.forEach((item) => item.classList.toggle("active", item === screen));
}

// Thông báo dạng viên nang (Toast alert)
let toastTimer = null;
export function toast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2800);
}

import {
  updateScore,
  resetScore,
  setMaxScore,
  getMaxScore,
  calculateItemPoints,
  getScoreRating,
  applyScoreResult
} from "./scoreManager.js";

// Tái xuất các hàm liên quan đến điểm để giữ tương thích
export {
  updateScore,
  resetScore,
  setMaxScore,
  getMaxScore,
  calculateItemPoints,
  getScoreRating,
  applyScoreResult
};

// Thiết lập cảm xúc và lời thoại của bạn Trợ lý AI (Robot)
export function setMascot(emotion, message) {
  if (els.mascotImg) {
    if (emotion === "happy") {
      els.mascotImg.src = "assets/images/Robot_happy.jpg";
    } else if (emotion === "sad") {
      els.mascotImg.src = "assets/images/Robot_buon.jpg";
    }
  }
  if (els.mascotMsg) {
    els.mascotMsg.textContent = message;
  }
}

// Hiển thị màn hình kết quả tổng kết sau khi hoàn thành lượt chơi
export function showResult() {
  stopSoundPlayback();
  playSfx("start");
  state.isCompleted = true;
  showScreen(els.resultScreen);

  // Hiển thị điểm số & đánh giá sao qua scoreManager
  applyScoreResult();

  if (els.resultDetail) {
    if (state.mode === "copy") {
      const total = (state.challenges && state.challenges.length) || 0;
      els.resultDetail.textContent = `Bắt chước thành công ${state.correct}/${total} con vật`;
    } else {
      const total = (state.questions && state.questions.length) || (state.rounds && state.rounds.length) || 0;
      els.resultDetail.textContent = `Đúng ${state.correct}/${total} câu`;
    }
  }
}

