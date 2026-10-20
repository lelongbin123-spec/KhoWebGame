// ====================================================
// MODE1.JS - CHẾ ĐỘ 01: NGHE ÂM ĐOÁN BÓNG (LISTEN MODE)
// ====================================================

import { state, els } from "./state.js";
import {
  playSfx,
  getSoundAudio,
  stopSoundPlayback,
  speakVietnamese
} from "./audio.js";
import { showScreen, toast, setMascot, showResult } from "./ui.js";
import { resetScore, updateScore, calculateItemPoints } from "./scoreManager.js";
import { loadGameData } from "./data.js";

const CARD_PALETTES = [
  { color: "#FF5A5F", bgColor: "#FFF0F3" },
  { color: "#00B4D8", bgColor: "#E0F7FA" },
  { color: "#FFB703", bgColor: "#FFF8E1" },
  { color: "#9D4EDD", bgColor: "#F3E8FF" },
  { color: "#FF4D8D", bgColor: "#FFE5EE" },
  { color: "#06D6A0", bgColor: "#E8F8F5" }
];

export async function startListenMode() {
  if (!state.rounds || state.rounds.length === 0) {
    await loadGameData();
  }
  if (!state.rounds || state.rounds.length === 0) {
    toast("Chưa tải được dữ liệu từ data.json!");
    return;
  }
  stopSoundPlayback();
  state.mode = "listen";
  state.isCompleted = false;
  state.questionIndex = 0;
  resetScore();
  state.correct = 0;
  state.questions = generateQuestions();
  state.questions.forEach((q) => { q.scored = false; });
  showScreen(els.listenScreen);
  renderQuestion();
}

// Tạo bộ câu hỏi ngẫu nhiên từ data.json, mỗi câu có 4 lựa chọn sinh động
export function generateQuestions() {
  if (!state.rounds || state.rounds.length === 0) return [];
  const shuffledItems = [...state.rounds].sort(() => Math.random() - 0.5);
  return shuffledItems.map((target) => {
    // 3 đáp án nhiễu khác với target
    const distractors = state.rounds
      .filter((item) => String(item.id) !== String(target.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const choices = [target, ...distractors].sort(() => Math.random() - 0.5);
    return { target, choices };
  });
}

export function renderQuestion() {
  const currentQ = state.questions[state.questionIndex];
  if (!currentQ) return showResult();

  state.answered = false;
  stopSoundPlayback();

  // Cập nhật tiến trình
  const total = state.questions.length;
  const current = state.questionIndex + 1;
  if (els.counter) els.counter.textContent = `${current} / ${total}`;
  if (els.progress) els.progress.style.width = `${(current / total) * 100}%`;

  // Reset trạng thái trợ lý & phản hồi
  setMascot("happy", "Bé nghe thấy tiếng gì? 👇");
  if (els.feedback) els.feedback.className = "feedback";
  if (els.feedbackIcon) els.feedbackIcon.textContent = "💡";
  if (els.feedbackText) els.feedbackText.textContent = "Bấm nghe rồi chọn hình nhé!";
  if (els.next) els.next.hidden = true;

  // Dựng 4 thẻ lựa chọn đầy màu sắc
  if (!els.answerGrid) return;
  els.answerGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  currentQ.choices.forEach((choice, idx) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-card";
    button.dataset.answer = choice.id;

    // Phối màu sắc sinh động, thu hút học sinh lớp 1
    const palette = CARD_PALETTES[(Number(choice.id) - 1) % CARD_PALETTES.length] || CARD_PALETTES[idx % CARD_PALETTES.length];
    const cardColor = choice.color || palette.color;
    const cardBg = choice.bgColor || palette.bgColor;

    button.style.borderColor = cardColor;
    button.style.backgroundColor = cardBg;

    const imgSrc = choice.src || choice.image || "";
    const visualHtml = imgSrc
      ? `<img src="${imgSrc}" alt="${choice.label}" class="card-img" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'animal\\'>${choice.emoji || '❓'}</span>';" />`
      : `<span class="animal" aria-hidden="true">${choice.emoji || "❓"}</span>`;

    button.innerHTML = `
      <div class="card-emoji-wrap">
        ${visualHtml}
      </div>
      <span class="answer-name" style="color: ${cardColor};">${choice.label}</span>
    `;

    button.addEventListener("click", () => {
      playSfx("click");
      checkAnswer(choice.id, button);
    });

    fragment.appendChild(button);
  });

  els.answerGrid.appendChild(fragment);
}

// Phát âm thanh của câu hỏi hiện tại kèm hiệu ứng sóng âm
export function playCurrentSound() {
  const currentQ = state.questions[state.questionIndex];
  if (!currentQ || !state.soundEnabled) return;

  stopSoundPlayback();
  state.audioPlaying = true;

  // Hiệu ứng loa thần kỳ & dải sóng âm
  if (els.soundOrb) els.soundOrb.classList.add("playing");
  if (els.waveformBars) els.waveformBars.classList.add("animating");
  if (els.playSound) {
    els.playSound.innerHTML = "<span class=\"btn-icon\">♫</span> Đang phát...";
  }

  setMascot("happy", "Đang phát âm thanh... 🎧");

  // Kích hoạt dải sóng âm thanh ngẫu nhiên nhảy múa theo nhạc
  if (els.waveformBars) {
    const bars = els.waveformBars.querySelectorAll(".wf-bar");
    state.waveformInterval = setInterval(() => {
      bars.forEach((bar) => {
        const randH = 20 + Math.floor(Math.random() * 75);
        bar.style.setProperty("--h", `${randH}%`);
      });
    }, 120);
  }

  const finishPlayback = () => {
    stopSoundPlayback();
    if (!state.answered) {
      setMascot("happy", "Bé nghe thấy tiếng gì? 👇");
    }
  };

  // Phát file âm thanh thực tế từ thư mục assets/sound/
  const soundFile = currentQ.target.sound || currentQ.target.soundPattern;
  if (soundFile) {
    try {
      const audio = getSoundAudio(soundFile);
      state.currentAudio = audio;
      audio.currentTime = 0;

      audio.onended = () => {
        if (state.currentAudio === audio) finishPlayback();
      };

      audio.onerror = (e) => {
        console.warn("Không phát được file audio trong assets:", soundFile, e);
        toast("Không tìm thấy hoặc lỗi tải tệp âm thanh!");
        finishPlayback();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Trình duyệt chặn autoplay hoặc lỗi audio.play():", err);
          if (err && err.name === "NotAllowedError") {
            toast("Bé hãy bấm vào màn hình để cho phép phát âm thanh nhé! 🔊");
          } else {
            toast("Không thể phát tệp âm thanh này!");
          }
          finishPlayback();
        });
      }

      // Timeout an toàn tối đa 7 giây
      state.audioStopTimer = setTimeout(() => {
        if (state.currentAudio === audio) finishPlayback();
      }, 7000);

    } catch (err) {
      console.warn("Lỗi khi mở audio:", err);
      toast("Lỗi phát âm thanh!");
      finishPlayback();
    }
  } else {
    toast("Câu hỏi này chưa có đường dẫn âm thanh!");
    finishPlayback();
  }
}

// Kiểm tra câu trả lời
export function checkAnswer(answerId, button) {
  if (state.answered) return;
  const currentQ = state.questions[state.questionIndex];
  const isCorrect = String(answerId) === String(currentQ.target.id);

  if (isCorrect) {
    stopSoundPlayback();
    state.answered = true;
    playSfx("correct");

    // Tính điểm qua scoreManager (dựa trên số câu thực tế từ data.json)
    const total = (state.questions && state.questions.length) || (state.rounds && state.rounds.length) || 1;
    const points = calculateItemPoints(state.questionIndex, total);

    // ĐẢM BẢO KHÔNG CỘNG ĐIỂM LẶP: Mỗi câu hỏi chỉ cộng điểm đúng 1 lần
    if (!currentQ.scored) {
      currentQ.scored = true;
      updateScore(points);
      state.correct += 1;
    }

    button.classList.add("correct");
    els.answerGrid.querySelectorAll("button").forEach((btn) => (btn.disabled = true));

    setMascot("happy", `🎉 Đúng rồi! Giỏi quá! +${points} ⭐`);
    if (els.feedback) els.feedback.className = "feedback good";
    if (els.feedbackIcon) els.feedbackIcon.textContent = "🌟";
    if (els.feedbackText) els.feedbackText.textContent = "Chính xác! Bé giỏi quá!";

    speakVietnamese("Đúng rồi! Bé giỏi quá!");

    if (els.next) {
      els.next.textContent =
        state.questionIndex === state.questions.length - 1
          ? "Xem kết quả 🏆"
          : "Câu tiếp theo →";
      els.next.hidden = false;
    }

  } else {
    playSfx("incorrect");
    button.classList.add("wrong");

    setMascot("sad", `💡 Gợi ý: ${currentQ.target.hint}`);
    if (els.feedback) els.feedback.className = "feedback try";
    if (els.feedbackIcon) els.feedbackIcon.textContent = "🤔";
    if (els.feedbackText) {
      els.feedbackText.textContent = `Thử lại nhé! 💡 ${currentQ.target.hint}`;
    }
    speakVietnamese(`Thử lại nhé! ${currentQ.target.hint}`);

    // Sau 3.5 giây đổi lại robot vui
    setTimeout(() => {
      if (!state.answered) {
        setMascot("happy", "Bé nghe thấy tiếng gì? 👇");
      }
    }, 3500);

    setTimeout(() => button.classList.remove("wrong"), 500);
  }
}

