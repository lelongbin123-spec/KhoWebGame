// ====================================================
// AUDIO.JS - HỆ THỐNG ÂM THANH (CHỈ SỬ DỤNG CÁC TỆP ÂM THANH TRONG MỤC ASSETS)
// ====================================================

import { state, els } from "./state.js";

// 1. Hiệu ứng âm thanh giao diện (SFX) nằm trong assets/audio/
const sfxCache = {};
const SFX_FILES = {
  click: "assets/audio/click.m4a",
  correct: "assets/audio/correct.m4a",
  incorrect: "assets/audio/incorrect.m4a",
  start: "assets/audio/starding.m4a"
};

export function playSfx(type) {
  if (!state.soundEnabled) return;
  try {
    const file = SFX_FILES[type];
    if (!file) return;
    if (!sfxCache[type]) {
      sfxCache[type] = new Audio(file);
    }
    const audio = sfxCache[type];
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (_) {}
}

// Bộ đệm lưu trữ Audio element cho các file âm thanh
const soundAudioCache = {};
const DEFAULT_WAVEFORM_HEIGHTS = [25, 55, 80, 40, 90, 65, 30, 75, 85, 45, 60, 95, 50, 30];
let vietnameseVoice = null;
let speechRequestId = 0;
let speechAudio = null;
let speechAudioUrl = null;

function loadVietnameseVoice() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const vietnameseVoices = voices.filter((voice) => /^vi([_-]|$)/i.test(voice.lang || ""));
  vietnameseVoice = vietnameseVoices.find((voice) =>
    /natural|online|google|hoai ?my|nam ?minh/i.test(voice.name)
  ) || vietnameseVoices[0] || null;
  return vietnameseVoice;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVietnameseVoice();
  window.speechSynthesis.addEventListener("voiceschanged", loadVietnameseVoice);
}

function releaseSpeechAudio() {
  if (speechAudio) {
    speechAudio.pause();
    speechAudio = null;
  }
  if (speechAudioUrl) {
    URL.revokeObjectURL(speechAudioUrl);
    speechAudioUrl = null;
  }
}

function stopSpeech() {
  speechRequestId += 1;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  releaseSpeechAudio();
}

async function speakWithGoogleTts(text, requestId) {
  const endpoint = window.GOOGLE_TTS_ENDPOINT;
  if (!endpoint || requestId !== speechRequestId || !state.soundEnabled) return;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "vi-VN", name: "vi-VN-Wavenet-A" },
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.92, pitch: 1.05 }
      })
    });
    if (!response.ok) throw new Error(`Google TTS endpoint returned ${response.status}`);

    const contentType = response.headers.get("content-type") || "";
    let audioBlob;
    if (contentType.includes("application/json")) {
      const result = await response.json();
      if (!result.audioContent) throw new Error("Google TTS response has no audioContent");
      const binary = atob(result.audioContent);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      audioBlob = new Blob([bytes], { type: "audio/mpeg" });
    } else {
      audioBlob = await response.blob();
    }

    if (requestId !== speechRequestId || !state.soundEnabled) return;
    speechAudioUrl = URL.createObjectURL(audioBlob);
    speechAudio = new Audio(speechAudioUrl);
    speechAudio.addEventListener("ended", releaseSpeechAudio, { once: true });
    speechAudio.addEventListener("error", releaseSpeechAudio, { once: true });
    await speechAudio.play();
  } catch (error) {
    if (requestId === speechRequestId) {
      console.warn("Google TTS fallback failed:", error);
      releaseSpeechAudio();
    }
  }
}

function waitForVietnameseVoice(timeoutMs = 1500) {
  const voice = loadVietnameseVoice();
  if (voice || !window.speechSynthesis) return Promise.resolve(voice);
  return new Promise((resolve) => {
    let timeoutId;
    const finish = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      clearTimeout(timeoutId);
      resolve(loadVietnameseVoice());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish);
    timeoutId = setTimeout(finish, timeoutMs);
  });
}

export function resolveAssetAudioPath(pathOrKey) {
  if (!pathOrKey) return "";
  const key = String(pathOrKey).trim();

  if (Array.isArray(state.rounds) && state.rounds.length > 0) {
    const found = state.rounds.find(
      (round) => round.sound === key || round.soundPattern === key || String(round.id) === key || round.label === key
    );
    if (found && found.sound) return found.sound;
  }

  const clean = key.replace(/^\.?\/+/, "");
  if (clean.startsWith("assets/")) return clean;
  if (clean.startsWith("sound/")) return `assets/${clean}`;
  if (clean.startsWith("audio/")) return `assets/${clean}`;
  return `assets/sound/${clean}`;
}

export function getSoundAudio(urlOrKey) {
  if (!urlOrKey) return null;
  const safePath = resolveAssetAudioPath(urlOrKey);
  if (!safePath) return null;

  if (!soundAudioCache[safePath]) {
    const audio = new Audio(safePath);
    audio.preload = "auto";
    audio.onerror = (event) => {
      console.warn(`Lỗi nạp tệp âm thanh: "${safePath}"`, event);
    };
    soundAudioCache[safePath] = audio;
  }
  return soundAudioCache[safePath];
}

export function stopSoundPlayback() {
  state.audioPlaying = false;
  clearTimeout(state.audioStopTimer);
  clearInterval(state.waveformInterval);

  if (state.currentAudio) {
    try {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
      state.currentAudio.onended = null;
      state.currentAudio.onerror = null;
    } catch (_) {}
    state.currentAudio = null;
  }

  stopSpeech();

  if (els.soundOrb) els.soundOrb.classList.remove("playing");
  if (els.waveformBars) els.waveformBars.classList.remove("animating");
  if (els.playSound) {
    els.playSound.innerHTML = "<span class=\"btn-icon\">▶</span> Nghe âm thanh";
  }

  // Trả lại chiều cao mặc định cho các cột sóng
  if (els.waveformBars) {
    const bars = els.waveformBars.querySelectorAll(".wf-bar");
    bars.forEach((bar, i) => {
      bar.style.setProperty("--h", `${DEFAULT_WAVEFORM_HEIGHTS[i % DEFAULT_WAVEFORM_HEIGHTS.length]}%`);
    });
  }
}

// Giọng đọc trợ lý tiếng Việt
export async function speakVietnamese(text) {
  const message = String(text || "").trim();
  if (!state.soundEnabled || !message) return;

  stopSpeech();
  const requestId = speechRequestId;
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
    await speakWithGoogleTts(message, requestId);
    return;
  }

  const voice = await waitForVietnameseVoice();
  if (requestId !== speechRequestId || !state.soundEnabled) return;
  if (!voice) {
    await speakWithGoogleTts(message, requestId);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "vi-VN";
  utterance.voice = voice;
  utterance.rate = 0.92;
  utterance.pitch = 1.05;
  let handled = false;
  let watchdogId;
  const fallbackToGoogle = () => {
    if (handled || requestId !== speechRequestId) return;
    handled = true;
    clearTimeout(watchdogId);
    window.speechSynthesis.cancel();
    speakWithGoogleTts(message, requestId);
  };
  watchdogId = setTimeout(fallbackToGoogle, Math.min(120000, 10000 + message.length * 220));
  utterance.onend = () => {
    handled = true;
    clearTimeout(watchdogId);
  };
  utterance.onerror = (event) => {
    if (requestId !== speechRequestId || handled) return;
    console.warn("Web Speech API failed:", event.error);
    fallbackToGoogle();
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("Web Speech API could not start:", error);
    fallbackToGoogle();
  }
}
