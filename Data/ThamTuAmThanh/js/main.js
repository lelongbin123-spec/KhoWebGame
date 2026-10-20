// ====================================================
// MAIN.JS - ĐIỂM KHỞI ĐẦU ỨNG DỤNG & GẮN SỰ KIỆN TƯƠNG TÁC
// ====================================================

import { state, els } from "./state.js";
import {
  playSfx,
  stopSoundPlayback
} from "./audio.js";
import { showScreen, toast, showResult } from "./ui.js";
import { resetScore, updateScore } from "./scoreManager.js";
import { loadGameData } from "./data.js";
import { startListenMode, renderQuestion, playCurrentSound } from "./mode1.js";
import { startCopyMode, renderChallenge, startMic, stopMic } from "./mode2.js";
import {
  initTrainerLabels,
  getTrainerLabels,
  addTrainerLabel,
  removeTrainerLabel,
  getOrCreateTransferRecognizer,
  collectAudioSample,
  clearSamplesForLabel,
  clearAllTrainerSamples,
  validateTrainingRequirements,
  startModelTraining,
  initializeProjectTraining,
  exportTrainerDatasetBin,
  importTrainerDatasetBin,
  loadSavedCustomModel,
  removeLegacyTrainerDatabase,
  getLabelIcon,
  getLabelDisplayName,
  getSampleCounts,
  BACKGROUND_NOISE_TAG
} from "./trainer.js";

let projectAutoTraining = false;
let projectAutoTrainingProgress = null;
let projectAutoTrainingResult = null;

// Quay về màn hình trang chủ (Chỉ cho phép khi đã hoàn thành thử thách)
export function goHome(force = false) {
  if (!force && state.mode !== null && !state.isCompleted) {
    toast("Bé hãy hoàn thành thử thách để xem kết quả nhé! 🌟");
    return;
  }
  stopSoundPlayback();
  stopMic();
  state.mode = null;
  state.isCompleted = false;
  playSfx("click");
  showScreen(els.homeScreen);
}

// ----------------------------------------------------
// GẮN SỰ KIỆN TƯƠNG TÁC (EVENT LISTENERS)
// ----------------------------------------------------

// 1. Chọn chế độ chơi từ trang chủ
document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    playSfx("click");
    if (button.dataset.mode === "listen") {
      startListenMode();
    } else {
      startCopyMode();
    }
  });
});

// 2. Nút điều hướng về trang chủ
document.querySelectorAll("[data-go-home]").forEach((btn) => {
  btn.addEventListener("click", () => goHome(false));
});

if (els.homeBtn) {
  els.homeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    goHome(false);
  });
}

if (els.homeFromResultBtn) {
  els.homeFromResultBtn.addEventListener("click", () => {
    goHome(true);
  });
}

// 3. Nút chơi lại từ màn hình kết quả
if (els.replayBtn) {
  els.replayBtn.addEventListener("click", () => {
    playSfx("click");
    state.isCompleted = false;
    if (state.mode === "copy") {
      startCopyMode();
    } else {
      startListenMode();
    }
  });
}

// 4. Phát âm thanh trong Chế độ 1 (Loa thần kỳ & Nút bấm)
if (els.playSound) {
  els.playSound.addEventListener("click", () => {
    playSfx("click");
    playCurrentSound();
  });
}

if (els.soundOrb) {
  els.soundOrb.addEventListener("click", () => {
    playSfx("click");
    playCurrentSound();
  });
}

// 5. Chuyển sang câu hỏi tiếp theo trong Chế độ 1
if (els.next) {
  els.next.addEventListener("click", () => {
    playSfx("click");
    state.questionIndex += 1;
    if (state.questionIndex >= state.questions.length) {
      showResult();
    } else {
      renderQuestion();
    }
  });
}


// 7. Micro & Thử thách trong Chế độ 2
if (els.micBtn) {
  els.micBtn.addEventListener("click", startMic);
}

if (els.nextChallengeBtn) {
  els.nextChallengeBtn.addEventListener("click", () => {
    playSfx("click");
    stopMic();
    if (state.challenges && state.challenges.length > 0) {
      if (state.challengeIndex + 1 >= state.challenges.length) {
        if (state.correct >= state.challenges.length) {
          showResult();
          return;
        }
        state.challengeIndex = 0;
      } else {
        state.challengeIndex += 1;
      }
      renderChallenge();
    }
  });
}

// 8. Hộp thoại cài đặt Google Teachable Machine Model URL
function renderTrainerCards(activeLabel = null) {
  if (!els.trainerCardsGrid) return;
  const labels = getTrainerLabels();
  const counts = getSampleCounts();

  els.trainerCardsGrid.innerHTML = "";

  labels.forEach(label => {
    const isNoise = label === BACKGROUND_NOISE_TAG;
    const count = counts[label] || 0;
    const icon = getLabelIcon(label);
    const displayName = getLabelDisplayName(label);

    const card = document.createElement("div");
    card.className = "trainer-card" + (isNoise ? " is-noise" : "") + (label === activeLabel ? " is-active-target" : "");
    card.id = `trainerCard_${encodeURIComponent(label)}`;

    let badgeClass = "";
    if (count >= 3) {
      badgeClass = "optimal";
    } else if (count > 0) {
      badgeClass = "has-samples";
    }

    card.innerHTML = `
      <div class="trainer-card-info">
        <span class="trainer-card-icon">${icon}</span>
        <div class="trainer-card-text">
          <div class="trainer-card-title">${displayName}</div>
          <span class="trainer-card-badge ${badgeClass}" id="badge_${encodeURIComponent(label)}">
            ${count > 0 ? `${count} mẫu âm thanh` : "Chưa có mẫu"}
          </span>
        </div>
      </div>
      <div class="trainer-card-actions">
        <button type="button" class="btn-record-sample" data-label="${label}" title="Thu 1 mẫu âm thanh ~1 giây">
          🎙️ Thu 1s
        </button>
        ${count > 0 ? `<button type="button" class="btn-clear-sample" data-clear-label="${label}" title="Xóa mẫu của nhãn này">✕</button>` : ""}
        ${!isNoise ? `<button type="button" class="btn-remove-label" data-remove-label="${label}" title="Xóa nhãn khỏi danh sách">🗑️</button>` : ""}
      </div>
    `;

    els.trainerCardsGrid.appendChild(card);
  });

  updateTrainerStatus();
}

function updateTrainerStatus() {
  if (!els.trainerStatusAlert || !els.trainerStatusMsg) return;
  const check = validateTrainingRequirements();
  if (check.ready) {
    els.trainerStatusAlert.className = "trainer-status-alert ready";
    if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "✅";
    els.trainerStatusMsg.textContent = `Đã sẵn sàng! Có ${check.bgCount} mẫu tạp âm và ${check.animalCount} tiếng con vật. Bấm "Huấn Luyện AI" để bắt đầu!`;
    if (els.trainerStartTrainBtn) {
      els.trainerStartTrainBtn.disabled = false;
      els.trainerStartTrainBtn.style.opacity = "1";
    }
  } else {
    els.trainerStatusAlert.className = "trainer-status-alert";
    if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "💡";
    els.trainerStatusMsg.textContent = check.message;
    if (els.trainerStartTrainBtn) {
      els.trainerStartTrainBtn.disabled = false;
    }
  }
}

export async function openTrainerModal(targetAnimalLabel = null) {
  playSfx("click");
  stopSoundPlayback();
  stopMic();

  if (els.tmTrainerModal) {
    els.tmTrainerModal.hidden = false;
  }
  if (els.trainerProgressPanel) els.trainerProgressPanel.hidden = true;
  if (els.trainerApplyPlayBtn) els.trainerApplyPlayBtn.hidden = true;
  if (els.trainerStartTrainBtn) {
    els.trainerStartTrainBtn.hidden = false;
    els.trainerStartTrainBtn.disabled = true;
  }

  // 1. Hiển thị thông báo trạng thái đang tải mô hình từ dự án
  if (els.trainerStatusAlert) {
    els.trainerStatusAlert.className = "trainer-status-alert";
    if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "⏳";
    if (els.trainerStatusMsg) {
      els.trainerStatusMsg.textContent = "Đang tải mô hình AI từ thư mục dự án (base_model/)... Vui lòng đợi trong giây lát!";
    }
  }

  // Khởi tạo và hiển thị sơ bộ danh sách thẻ
  initTrainerLabels();
  renderTrainerCards(targetAnimalLabel);

  // Tạm thời vô hiệu hóa các nút thu âm trong lúc đang nạp mô hình nền tảng
  const recBtns = els.trainerCardsGrid ? els.trainerCardsGrid.querySelectorAll(".btn-record-sample") : [];
  recBtns.forEach(b => {
    b.disabled = true;
    b.title = "Đang nạp mô hình nền tảng từ dự án...";
  });

  try {
    // 2. TẢI MÔ HÌNH TRONG DỰ ÁN RỒI MỚI CHO PHÉP THU ÂM HOẶC HUẤN LUYỆN
    await getOrCreateTransferRecognizer();

    // 3. Sau khi mô hình dự án đã sẵn sàng, tái khởi tạo nhãn chuẩn xác và hiển thị đầy đủ
    initTrainerLabels();
    renderTrainerCards(targetAnimalLabel);

    if (projectAutoTraining) {
      if (els.trainerProgressPanel) els.trainerProgressPanel.hidden = false;
      if (els.trainerStartTrainBtn) els.trainerStartTrainBtn.disabled = true;
      if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "⚡";
      if (els.trainerStatusMsg) els.trainerStatusMsg.textContent = "Đang tự huấn luyện từ bộ mẫu đã nạp của dự án...";
      if (projectAutoTrainingProgress) updateProjectTrainingProgress(projectAutoTrainingProgress);
    } else if (projectAutoTrainingResult && projectAutoTrainingResult.success) {
      if (els.trainerStartTrainBtn) els.trainerStartTrainBtn.hidden = true;
      if (els.trainerApplyPlayBtn) els.trainerApplyPlayBtn.hidden = false;
      if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "🎉";
      if (els.trainerStatusMsg) els.trainerStatusMsg.textContent = "Model đã tự huấn luyện từ dataset dự án và sẵn sàng chơi!";
    } else {
      if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "💡";
      if (els.trainerStatusMsg) {
        els.trainerStatusMsg.textContent = "Mô hình và bộ mẫu dự án đã sẵn sàng! Bé hãy thu thêm mẫu rồi bấm Cập nhật nhé!";
      }
      if (els.trainerStartTrainBtn) els.trainerStartTrainBtn.disabled = false;
    }
  } catch (err) {
    console.error("Lỗi tải mô hình dự án cho xưởng luyện:", err);
    if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "⚠️";
    if (els.trainerStatusMsg) {
      els.trainerStatusMsg.textContent = "Lỗi nạp mô hình dự án: " + (err.message || err);
    }
    toast("Không thể nạp mô hình dự án: " + (err.message || err));
  }

  // Cuộn mượt đến thẻ mục tiêu nếu được mở từ câu hỏi đang chơi
  if (targetAnimalLabel) {
    setTimeout(() => {
      const card = document.getElementById(`trainerCard_${encodeURIComponent(targetAnimalLabel)}`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  }
}

function updateProjectTrainingProgress(progress) {
  projectAutoTrainingProgress = progress;
  if (els.trainerProgressPanel) els.trainerProgressPanel.hidden = false;
  const percent = Math.round((progress.epoch / progress.totalEpochs) * 100);
  if (els.trainerProgressBar) {
    els.trainerProgressBar.style.width = `${percent}%`;
  }
  if (els.trainerProgressPercent) {
    els.trainerProgressPercent.textContent = `${percent}%`;
  }
  if (els.trainerProgressDetail) {
    const phase = progress.stage === "preparing" ? "Đang chuẩn bị dữ liệu và mô hình..."
      : progress.stage === "loading" ? "Đang dừng nhận diện và nạp bộ huấn luyện..."
      : progress.stage === "saving" ? "Đang lưu mô hình đã huấn luyện..."
      : progress.stage === "running" ? "Đang chạy các vòng huấn luyện..."
      : progress.stage === "training" && progress.epoch === 0 ? "Đang khởi chạy huấn luyện..."
      : `Epoch ${progress.epoch}/${progress.totalEpochs}${progress.accuracy !== null ? ` (Độ chính xác: ${progress.accuracy}%)` : ""}`;
    els.trainerProgressDetail.textContent = phase;
  }
}

async function startProjectAutoTraining() {
  projectAutoTraining = true;
  try {
    const result = await initializeProjectTraining(updateProjectTrainingProgress);
    projectAutoTrainingResult = result;
    if (result.success) {
      console.log("✅ [Khởi Động] Đã huấn luyện model từ bộ mẫu dự án:", result.labels);
      if (els.trainerProgressPercent) els.trainerProgressPercent.textContent = "100%";
      if (els.trainerProgressBar) els.trainerProgressBar.style.width = "100%";
      if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "🎉";
      if (els.trainerStatusMsg) els.trainerStatusMsg.textContent = `Đã tự huấn luyện model với ${result.labels.length} nhãn từ bộ mẫu dự án.`;
      if (els.trainerStartTrainBtn) els.trainerStartTrainBtn.hidden = true;
      if (els.trainerApplyPlayBtn) els.trainerApplyPlayBtn.hidden = false;
    } else {
      console.warn("Không thể tự huấn luyện model từ dataset dự án:", result.message);
      if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "⚠️";
      if (els.trainerStatusMsg) els.trainerStatusMsg.textContent = result.message;
      if (els.trainerStartTrainBtn) {
        els.trainerStartTrainBtn.hidden = false;
        els.trainerStartTrainBtn.disabled = false;
      }
    }
  } catch (error) {
    projectAutoTrainingResult = { success: false, message: error.message || String(error) };
    console.error("Không thể tự huấn luyện model từ dataset dự án:", error);
    if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "⚠️";
    if (els.trainerStatusMsg) els.trainerStatusMsg.textContent = projectAutoTrainingResult.message;
  } finally {
    projectAutoTraining = false;
  }
}

export function closeTrainerModal() {
  playSfx("click");
  if (els.tmTrainerModal) {
    els.tmTrainerModal.hidden = true;
  }
}

if (els.openTrainerHeaderBtn) {
  els.openTrainerHeaderBtn.addEventListener("click", () => openTrainerModal());
}

if (els.tmTrainerModalClose) {
  els.tmTrainerModalClose.addEventListener("click", closeTrainerModal);
}

if (els.tmTrainerModalBackdrop) {
  els.tmTrainerModalBackdrop.addEventListener("click", closeTrainerModal);
}

// Thêm nhãn mới vào studio
if (els.trainerAddLabelBtn && els.trainerNewLabelInput) {
  const handleAddLabel = () => {
    const val = els.trainerNewLabelInput.value;
    if (addTrainerLabel(val)) {
      els.trainerNewLabelInput.value = "";
      renderTrainerCards(val.trim());
      playSfx("click");
      toast(`Đã thêm nhãn "${val.trim()}" vào danh sách luyện!`);
    }
  };
  els.trainerAddLabelBtn.addEventListener("click", handleAddLabel);
  els.trainerNewLabelInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLabel();
    }
  });
}

// Event Delegation cho danh sách thẻ nhãn thu âm
if (els.trainerCardsGrid) {
  els.trainerCardsGrid.addEventListener("click", async (e) => {
    // 1. Thu âm 1 mẫu âm thanh
    const recBtn = e.target.closest(".btn-record-sample");
    if (recBtn) {
      const label = recBtn.dataset.label;
      const allRecBtns = els.trainerCardsGrid.querySelectorAll(".btn-record-sample");
      allRecBtns.forEach(b => b.disabled = true);
      recBtn.classList.add("recording");
      recBtn.innerHTML = "🔴 Đang nghe (1s)...";

      await collectAudioSample(label, {
        onComplete: (lbl, count) => {
          playSfx("correct");
          renderTrainerCards(lbl);
          toast(`Đã thu thành công 1 mẫu cho "${getLabelDisplayName(lbl)}"! (${count} mẫu) 🎙️✨`);
        },
        onError: () => {
          renderTrainerCards(label);
        }
      });
      return;
    }

    // 2. Xóa các mẫu của 1 nhãn
    const clearBtn = e.target.closest(".btn-clear-sample");
    if (clearBtn) {
      playSfx("click");
      const label = clearBtn.dataset.clearLabel;
      clearSamplesForLabel(label);
      renderTrainerCards(label);
      toast(`Đã xóa các mẫu của "${getLabelDisplayName(label)}".`);
      return;
    }

    // 3. Xóa nhãn khỏi danh sách
    const removeBtn = e.target.closest(".btn-remove-label");
    if (removeBtn) {
      playSfx("click");
      const label = removeBtn.dataset.removeLabel;
      removeTrainerLabel(label);
      renderTrainerCards();
      toast(`Đã xóa nhãn "${label}".`);
      return;
    }
  });
}

// Xóa tất cả các mẫu đã thu
if (els.trainerClearAllBtn) {
  els.trainerClearAllBtn.addEventListener("click", () => {
    playSfx("click");
    if (confirm("Bé hoặc cô giáo có chắc chắn muốn xóa toàn bộ các mẫu âm thanh đã thu không?")) {
      clearAllTrainerSamples();
      renderTrainerCards();
    }
  });
}

// Bắt đầu huấn luyện AI
if (els.trainerStartTrainBtn) {
  els.trainerStartTrainBtn.addEventListener("click", async () => {
    playSfx("click");
    if (els.trainerProgressPanel) {
      els.trainerProgressPanel.hidden = false;
      if (els.trainerProgressBar) els.trainerProgressBar.style.width = "0%";
      if (els.trainerProgressPercent) els.trainerProgressPercent.textContent = "0%";
      if (els.trainerProgressDetail) els.trainerProgressDetail.textContent = "Đang khởi tạo mạng nơ-ron...";
    }
    els.trainerStartTrainBtn.disabled = true;

    const res = await startModelTraining({ epochs: 40 }, (prog) => {
      const pct = Math.round((prog.epoch / prog.totalEpochs) * 100);
      if (els.trainerProgressBar) els.trainerProgressBar.style.width = `${pct}%`;
      if (els.trainerProgressPercent) els.trainerProgressPercent.textContent = `${pct}%`;
      if (els.trainerProgressDetail) {
        els.trainerProgressDetail.textContent = `Epoch ${prog.epoch}/${prog.totalEpochs} ${prog.accuracy !== null ? `(Độ chính xác: ${prog.accuracy}%)` : ""}`;
      }
    });

    els.trainerStartTrainBtn.disabled = false;

    if (res.success) {
      playSfx("applause");
      toast("🎉 Đã tự động cập nhật trực tiếp vào mô hình! Bé có thể chơi ngay.");
      if (els.trainerStatusAlert) {
        els.trainerStatusAlert.className = "trainer-status-alert ready";
        if (els.trainerStatusIcon) els.trainerStatusIcon.textContent = "🎉";
        if (els.trainerStatusMsg) {
          els.trainerStatusMsg.textContent = `Tuyệt vời! Đã tự động cập nhật ${res.labels.length} nhãn âm thanh vào mô hình đã có sẵn. Không cần tải tệp mới!`;
        }
      }
      if (els.trainerStartTrainBtn) els.trainerStartTrainBtn.hidden = true;
      if (els.trainerApplyPlayBtn) els.trainerApplyPlayBtn.hidden = false;
      renderTrainerCards();
    } else {
      if (els.trainerProgressPanel) els.trainerProgressPanel.hidden = true;
    }
  });
}

// Áp dụng mô hình và bắt đầu chơi ngay
if (els.trainerApplyPlayBtn) {
  els.trainerApplyPlayBtn.addEventListener("click", () => {
    closeTrainerModal();
    if (state.mode !== "copy") {
      startCopyMode();
    } else {
      renderChallenge();
    }
    toast("AI đang lắng nghe giọng của bé! Hãy bắt chước tiếng kêu nhé! 🎙️🤖");
  });
}

if (els.trainerImportDatasetBtn && els.trainerDatasetInput) {
  els.trainerImportDatasetBtn.addEventListener("click", () => {
    playSfx("click");
    els.trainerDatasetInput.click();
  });
  els.trainerDatasetInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const imported = await importTrainerDatasetBin(file);
    if (imported) renderTrainerCards();
    event.target.value = "";
  });
}

if (els.trainerExportDatasetBtn) {
  els.trainerExportDatasetBtn.addEventListener("click", () => {
    playSfx("click");
    exportTrainerDatasetBin();
  });
}

async function initApp() {
  await removeLegacyTrainerDatabase();
  resetScore();
  showScreen(els.homeScreen);
  const loaded = await loadGameData();
  if (loaded) {
    // Luôn khôi phục model AI đang dùng qua cùng một recognizer hoạt động.
    // Chỉ huấn luyện từ bộ mẫu dự án khi chưa có model đã lưu.
    const restored = await loadSavedCustomModel();
    if (!restored) startProjectAutoTraining();
  }
}
initApp();

// Cung cấp các lệnh kiểm tra chẩn đoán trực tiếp từ Console trình duyệt

// Cung cấp namespace toàn cục để tiện kiểm tra / debug nếu cần
window.SoundGame = {
  state,
  els,
  loadGameData,
  startListenMode,
  startCopyMode,
  goHome,
  openTrainerModal,
  closeTrainerModal,
  resetScore,
  updateScore
};

