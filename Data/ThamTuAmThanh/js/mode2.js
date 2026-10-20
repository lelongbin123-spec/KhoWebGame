// ====================================================
// MODE2.JS - CHẾ ĐỘ 02: THỬ TÀI BẮT CHƯỚC (VOICE / MIMIC MODE)
// ====================================================

import { state, els } from "./state.js";
import { playSfx, stopSoundPlayback, speakVietnamese } from "./audio.js";
import { showScreen, toast, setMascot, showResult } from "./ui.js";
import { resetScore, updateScore, calculateItemPoints } from "./scoreManager.js";
import { loadGameData } from "./data.js";
import {
  TARGET_CONFIDENCE_THRESHOLD,
  isTmModelLoaded,
  getTmRecognizer,
  startTmListening,
  validateAllTargetMappings
} from "./classifier.js";

export async function startCopyMode() {
  if (!state.challenges || state.challenges.length === 0) {
    await loadGameData();
  }
  if (!state.challenges || state.challenges.length === 0) {
    toast("Chưa tải được dữ liệu từ data.json!");
    return;
  }
  stopSoundPlayback();
  stopMic();
  state.mode = "copy";
  state.isCompleted = false;
  state.challengeIndex = 0;
  resetScore();
  state.correct = 0;
  if (Array.isArray(state.challenges)) {
    state.challenges.forEach((ch) => { ch.scored = false; });
  }

  // Xác thực và chuẩn hóa ánh xạ mục tiêu JSON với nhãn của mô hình AI
  if (isTmModelLoaded() && getTmRecognizer()) {
    validateAllTargetMappings(getTmRecognizer().wordLabels(), state.challenges);
  }

  showScreen(els.copyScreen);
  renderChallenge();
}

export function renderChallenge() {
  if (!state.challenges || state.challenges.length === 0) return;
  state.targetRecognized = false;
  const ch = state.challenges[state.challengeIndex];
  const imgSrc = ch.src || ch.image || "";
  const chLabel = ch.label || ch.name || "";

  // Cập nhật tiến trình cho Chế độ 2 động từ data.json
  const total = (state.challenges && state.challenges.length) || 1;
  const current = state.challengeIndex + 1;
  if (els.challengeCounter) els.challengeCounter.textContent = `${current} / ${total}`;
  if (els.challengeProgressFill) {
    els.challengeProgressFill.style.width = `${(current / total) * 100}%`;
  }

  if (els.copyCharacter) {
    if (imgSrc) {
      els.copyCharacter.innerHTML = `<img src="${imgSrc}" alt="${chLabel}" class="character-img" />`;
    } else {
      els.copyCharacter.textContent = ch.emoji || "❓";
    }
    els.copyCharacter.classList.remove("listening");
    els.copyCharacter.classList.remove("dancing");
  }

  if (els.copyChallenge) {
    els.copyChallenge.textContent = `Bắt chước tiếng: ${chLabel}`;
  }
  if (els.micStatus) {
    els.micStatus.textContent = "Micro đang tắt";
  }
  if (els.micBtn) {
    els.micBtn.disabled = false;
    els.micBtn.innerHTML = "<span class=\"mic-icon\">🎙️</span> Bắt đầu nói";
  }
  
  // Đặt lại các thước đo
  updateConfidenceMeter(0, "Bấm \"Bắt đầu nói\" rồi bắt chước tiếng kêu nhé!");
  if (els.voiceMeterFill) els.voiceMeterFill.style.width = "0%";
  if (els.voiceLevelText) els.voiceLevelText.textContent = "0%";
  state.targetRecognized = false;
}

export async function startMic() {
  if (state.targetRecognized) {
    renderChallenge();
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (els.micStatus) els.micStatus.textContent = "Trình duyệt chưa hỗ trợ micro.";
    return;
  }

  try {
    playSfx("click");
    stopMic();
    state.targetRecognized = false;
    state.micActive = true;

    if (els.copyCharacter) {
      els.copyCharacter.classList.remove("dancing");
      els.copyCharacter.classList.add("listening");
    }
    if (els.micStatus) els.micStatus.textContent = "🎙️ Đang nghe bé nói...";
    if (els.micBtn) {
      els.micBtn.disabled = true;
      els.micBtn.innerHTML = "<span class=\"mic-icon\">👂</span> Đang nghe...";
    }
    const currentTarget = state.challenges[state.challengeIndex];
    const chLabel = currentTarget ? currentTarget.label : "";
    updateConfidenceMeter(0, `AI đang lắng nghe... Bé hãy bắt chước tiếng ${chLabel} nhé! 🎙️`);

    let lastSpeakingState = null;
    const callbacks = {
      onVolume: (volumePercent) => {
        if (els.voiceMeterFill) els.voiceMeterFill.style.width = volumePercent + "%";
        if (els.voiceLevelText) els.voiceLevelText.textContent = volumePercent + "%";
        if (els.micStatus && state.micActive && !state.targetRecognized) {
          const isSpeaking = volumePercent > 12;
          if (isSpeaking !== lastSpeakingState) {
            lastSpeakingState = isSpeaking;
            if (isSpeaking) {
              els.micStatus.innerHTML = `🎙️ <strong style="color: #059669;">Đang thu âm:</strong> Đang nhận âm thanh...`;
            } else {
              els.micStatus.innerHTML = `🎙️ <strong>Micro đang bật...</strong> (Bé hãy kêu tiếng ${chLabel} nhé!)`;
            }
          }
        }
      },
      onConfidence: (confidencePercent, hintText) => {
        updateConfidenceMeter(confidencePercent, hintText);
      },
      onRecognized: (target, confidence) => {
        onTargetRecognized(target, confidence);
      },
      onError: (message) => {
        if (els.micStatus) els.micStatus.textContent = message;
        updateConfidenceMeter(0, message);
        stopMic();
      }
    };

    // Chỉ sử dụng duy nhất 1 luồng: Mô hình Google Teachable Machine Audio
    if (!isTmModelLoaded() || !getTmRecognizer()) {
      toast("Chưa tải được mô hình Teachable Machine! Hãy kiểm tra thư mục model/.");
      if (els.micStatus) els.micStatus.textContent = "Chưa kết nối mô hình Teachable Machine.";
      updateConfidenceMeter(0, "Chưa nạp được mô hình AI. Hãy kiểm tra thư mục model/!");
      stopMic();
      return;
    }

    await startTmListening(currentTarget, callbacks);

    // Đặt timeout an toàn 10 giây nếu bé chưa phát âm đạt
    state.micTimeout = setTimeout(() => {
      if (!state.targetRecognized && state.micActive) {
        console.warn(`[Chế độ 2] Hết 12 giây - Bé chưa đạt mốc ${TARGET_CONFIDENCE_THRESHOLD}% cho "${currentTarget.label}". Mời bé thử lại!`);
        stopMic();
        if (els.micStatus) els.micStatus.innerHTML = "💡 Bé thử kêu to và rõ hơn chút nữa nhé!";
        updateConfidenceMeter(0, `Chưa đạt ${TARGET_CONFIDENCE_THRESHOLD}%. Hãy bấm nói lại to và rõ nhé!`);
        setMascot("sad", "Bé thử kêu to và rõ hơn chút nữa nhé! 💡");
        playSfx("incorrect");
      }
    }, 12000);

  } catch (err) {
    console.warn("Lỗi micro:", err);
    if (els.micStatus) els.micStatus.textContent = "Chưa cấp quyền micro hoặc lỗi mic.";
    stopMic();
  }
}

export function onTargetRecognized(currentTarget, confidence) {
  if (state.targetRecognized) return;
  state.targetRecognized = true;

  console.log(
    `%c[ĐẠT CHUẨN XUẤT SẮC] Mục tiêu: ${currentTarget.label} | Độ chính xác: ${confidence}% (≥ ${TARGET_CONFIDENCE_THRESHOLD}% ngưỡng đạt)!`,
    "background: #10B981; color: #FFFFFF; font-size: 13px; font-weight: bold; padding: 4px 8px; border-radius: 4px;"
  );

  clearTimeout(state.micTimeout);
  stopMic();

  // 1. Hiển thị độ chính xác đạt chuẩn (>= 75%)
  updateConfidenceMeter(confidence, `🎯 Chuẩn xác (${confidence}% ≥ ${TARGET_CONFIDENCE_THRESHOLD}%)! Bé bắt chước siêu quá!`);
  if (els.aiConfidenceFill) els.aiConfidenceFill.classList.add("success");

  // 2. Nhân vật hoạt hình NHẢY MÚA (Dancing animation)
  if (els.copyCharacter) {
    els.copyCharacter.classList.remove("listening");
    els.copyCharacter.classList.add("dancing");
  }

  // 5. Cộng điểm thưởng qua scoreManager (tính động theo số lượng từ data.json)
  const total = (state.challenges && state.challenges.length) || 1;
  const points = calculateItemPoints(state.challengeIndex, total);

  if (!currentTarget.scored) {
    currentTarget.scored = true;
    updateScore(points);
    state.correct += 1;
  }

  // 3. Hiệu ứng Robot vui (Robot_happy.jpg)
  setMascot("happy", `🎉 Xuất sắc! Bé bắt chước ${currentTarget.label} chuẩn ${confidence}%! +${points} ⭐`);

  // 4. Phát âm thanh hoan hô chúc mừng
  playSfx("correct");
  speakVietnamese("Bé bắt chước giỏi quá! Hoan hô!");

  if (els.micStatus) {
    els.micStatus.innerHTML = `🎉 <strong>Hoàn thành xuất sắc!</strong> Độ chính xác: <strong>${confidence}%</strong> (&ge;${TARGET_CONFIDENCE_THRESHOLD}%)! +${points} ⭐`;
  }
  if (els.micBtn) {
    els.micBtn.disabled = false;
    els.micBtn.innerHTML = "<span class=\"mic-icon\">✨</span> Luyện tập lại";
  }

  // Sau 3.2 giây tự động chuyển sang con vật tiếp theo hoặc chuyển sang màn kết thúc
  state.autoNextTimeout = setTimeout(() => {
    if (state.mode === "copy" && state.targetRecognized) {
      if (state.challengeIndex + 1 >= state.challenges.length) {
        showResult();
      } else {
        state.challengeIndex += 1;
        renderChallenge();
      }
    }
  }, 3200);
}

export function stopMic() {
  state.micActive = false;
  clearTimeout(state.micTimeout);
  clearTimeout(state.autoNextTimeout);
  const recognizer = getTmRecognizer();
  if (recognizer && recognizer.isListening()) {
    try { recognizer.stopListening(); } catch (_) {}
  }

  if (state.micStream) {
    state.micStream.getTracks().forEach((track) => track.stop());
    state.micStream = null;
  }

  if (els.copyCharacter) {
    els.copyCharacter.classList.remove("listening");
  }

  if (els.micBtn && !state.targetRecognized) {
    els.micBtn.disabled = false;
    els.micBtn.innerHTML = "<span class=\"mic-icon\">🎙️</span> Bắt đầu nói";
  }
}

export function updateConfidenceMeter(percent, hintText) {
  const val = Math.max(0, Math.min(100, percent));
  if (els.aiConfidenceFill) {
    els.aiConfidenceFill.style.width = val + "%";
    if (val >= TARGET_CONFIDENCE_THRESHOLD) {
      els.aiConfidenceFill.classList.add("success");
    } else {
      els.aiConfidenceFill.classList.remove("success");
    }
  }
  if (els.aiConfidenceText) {
    els.aiConfidenceText.textContent = val + "%";
  }
  if (els.aiConfidenceHint && hintText) {
    els.aiConfidenceHint.textContent = hintText;
  }
}

