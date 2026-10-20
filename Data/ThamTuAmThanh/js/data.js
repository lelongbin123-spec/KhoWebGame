// ====================================================
// DATA.JS - NẠP DỮ LIỆU TỪ DATA.JSON & TIỀN TẢI TÀI NGUYÊN
// ====================================================

import { state, els } from "./state.js";
import { getSoundAudio } from "./audio.js";
import { toast } from "./ui.js";
import { setMaxScore } from "./scoreManager.js";
import { loadTeachableMachineModel } from "./classifier.js";

// Tải dữ liệu từ tệp data/data.json
export async function loadGameData() {
  try {
    const response = await fetch("data/data.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.rounds = Array.isArray(data.rounds) ? data.rounds : [];
    state.challenges = Array.isArray(data.mode2Targets) ? data.mode2Targets : [];
    
    // Đọc thông tin cấu hình trò chơi từ data.json
    state.gameId = data.Id || state.gameId || "ThamTuAmThanh";
    state.gameType = data.type || state.gameType || "Thám Tử Âm Thanh";
    state.gameText = data.text || state.gameText || "";
    const configuredModelUrl = data.teachableMachineModelUrl || "base_model/";
    // Resolve project-relative model paths from the game folder rather than
    // the page URL, which may be nested or embedded by the host site.
    state.teachableMachineModelUrl = new URL(
      configuredModelUrl,
      new URL("../", import.meta.url)
    ).href;
    state.trainerDatasetUrl = data.trainerDatasetUrl || "";

    if (typeof data.maxScore === "number" && data.maxScore > 0) {
      setMaxScore(data.maxScore);
    }

    // Hiển thị trước hình ảnh nhân vật đầu tiên từ data.json cho màn hình Bắt chước
    if (state.challenges.length > 0 && els.copyCharacter) {
      const firstCh = state.challenges[0];
      const firstImg = firstCh.src || firstCh.image || "";
      if (firstImg) {
        els.copyCharacter.innerHTML = `<img src="${firstImg}" alt="${firstCh.label || ''}" class="character-img" />`;
      }
    }

    // Tải trước (preload) các tệp âm thanh thực tế từ data.json để phát tức thì khi bấm loa
    state.rounds.forEach((round) => {
      if (round.sound) {
        getSoundAudio(round.sound);
      }
    });

    await loadTeachableMachineModel(state.teachableMachineModelUrl).catch(() => false);

    return true;
  } catch (err) {
    console.error("Không thể tải tệp data/data.json:", err);
    toast("Chưa tải được tệp data/data.json. Hãy chạy trên máy chủ web!");
    return false;
  }
}

