// ====================================================
// CLASSIFIER.JS - GOOGLE TEACHABLE MACHINE (AUDIO) CLASSIFIER DUY NHẤT
// ====================================================

import { state } from "./state.js";
import { toast } from "./ui.js";

export const TARGET_CONFIDENCE_THRESHOLD = 75;

let tmRecognizer = null;
let tmBaseRecognizer = null;
let tmModelLoading = false;
let tmModelLoaded = false;
let activeNoFrameCheckTimeout = null;

export function isTmModelLoaded() {
  return tmModelLoaded;
}

export function getTmRecognizer() {
  return tmRecognizer;
}

// Nạp mô hình Google Teachable Machine Audio từ URL checkpoint hoặc thư mục model/
export async function loadTeachableMachineModel(url) {
  if (!url || typeof url !== "string") {
    unloadTeachableMachineModel();
    return false;
  }
  let cleanUrl = url.trim();
  if (!cleanUrl) {
    unloadTeachableMachineModel();
    return false;
  }

  if (!window.speechCommands) {
    setTmStatus("error", "Chưa nạp được thư viện Speech Commands (lib/speech-commands.min.js).");
    return false;
  }

  // Cảnh báo nếu người dùng dán link trang train thay vì link model đã export
  if (cleanUrl.includes("teachablemachine.withgoogle.com/train")) {
    const trainErr = "Bạn đang nhập đường dẫn trang huấn luyện. Hãy bấm 'Export Model' -> 'Upload my model' trong Teachable Machine để lấy link dạng https://teachablemachine.withgoogle.com/models/... nhé!";
    setTmStatus("error", trainErr);
    toast(trainErr);
    return false;
  }

  // Tự động chuẩn hóa nếu người dùng dán link kèm model.json hoặc metadata.json
  cleanUrl = cleanUrl.replace(/\/(model|metadata)\.json$/i, "");

  try {
    tmModelLoading = true;
    setTmStatus("loading", "Đang tải mô hình Teachable Machine...");

    // Resolve bundled paths from this game, not from the current page. The
    // game can be opened under a nested route or embedded by another page.
    const gameRootUrl = new URL("../", import.meta.url);
    const formattedUrl = cleanUrl.endsWith("/") ? cleanUrl : cleanUrl + "/";
    const baseUrl = new URL(formattedUrl, gameRootUrl);
    const cacheBuster = "v=" + Date.now();
    const checkpointURL = new URL("model.json?" + cacheBuster, baseUrl).href;
    const metadataURL = new URL("metadata.json?" + cacheBuster, baseUrl).href;

    // 1. Tải trước và kiểm tra tính hợp lệ của tệp metadata.json
    let metadata = null;
    try {
      const metaRes = await fetch(metadataURL);
      if (!metaRes.ok) {
        throw new Error(`Không tìm thấy metadata.json (Mã HTTP ${metaRes.status})`);
      }
      metadata = await metaRes.json();
    } catch (fetchErr) {
      console.warn("Lỗi tải tệp metadata.json:", fetchErr);
      let fetchMsg = "Không thể tải tệp metadata.json từ đường dẫn mô hình!";
      const fetchStr = String(fetchErr && fetchErr.message ? fetchErr.message : fetchErr);
      if (fetchStr.includes("404")) {
        fetchMsg = "Không tìm thấy tệp metadata.json tại đường dẫn đã nhập (Lỗi 404).";
      } else if (fetchStr.includes("Failed to fetch") || fetchStr.includes("NetworkError")) {
        fetchMsg = "Không thể kết nối đến máy chủ mô hình (Lỗi mạng hoặc bị chặn CORS).";
      }
      setTmStatus("error", fetchMsg);
      toast(fetchMsg);
      unloadTeachableMachineModel();
      return false;
    }

    // 2. Phát hiện lỗi nhầm lẫn giữa mô hình Hình ảnh/Tư thế và mô hình Âm thanh
    const isImageModel = metadata.packageName === "@teachablemachine/image" ||
                         metadata.imageSize !== undefined ||
                         (typeof metadata.packageName === "string" && metadata.packageName.includes("image"));
    const isPoseModel = metadata.packageName === "@teachablemachine/pose" ||
                        (typeof metadata.packageName === "string" && metadata.packageName.includes("pose"));

    if (isImageModel || isPoseModel) {
      const modelType = isImageModel ? "Hình ảnh (Image Project)" : "Tư thế (Pose Project)";
      const errorMsg = `Mô hình này là mô hình ${modelType}, không phải mô hình Âm thanh (Audio Project)! Hãy tạo 'Audio Project' trên Teachable Machine để nhận diện âm thanh micro bé nhé! 🎙️`;
      console.error("❌ " + errorMsg, metadata);
      setTmStatus("error", errorMsg);
      toast("⚠️ Đây là mô hình " + (isImageModel ? "Hình ảnh" : "Tư thế") + ", không phải mô hình Âm thanh!");
      unloadTeachableMachineModel();
      return false;
    }

    // 3. Chuẩn hóa và bổ sung danh sách nhãn (hỗ trợ cả wordLabels, words, labels, classes)
    const rawLabels = metadata.wordLabels || metadata.words || metadata.labels || metadata.classes;
    if (!Array.isArray(rawLabels) || rawLabels.length === 0) {
      const errorMsg = "Tệp metadata.json không chứa danh sách nhãn âm thanh ('wordLabels', 'words' hoặc 'labels')!";
      console.error("❌ " + errorMsg, metadata);
      setTmStatus("error", errorMsg);
      toast(errorMsg);
      unloadTeachableMachineModel();
      return false;
    }

    // Đảm bảo metadata có đầy đủ cả wordLabels và words để tương thích hoàn toàn với speech-commands
    metadata.wordLabels = rawLabels;
    metadata.words = rawLabels;

    // 4. Khởi tạo Speech Commands với checkpointURL và metadata đã chuẩn hóa
    const recognizer = window.speechCommands.create(
      "BROWSER_FFT",
      undefined,
      checkpointURL,
      metadata
    );

    await recognizer.ensureModelLoaded();

    tmBaseRecognizer = recognizer;
    tmRecognizer = recognizer;
    tmModelLoaded = true;
    tmModelLoading = false;

    const labels = tmRecognizer.wordLabels();
    setTmStatus("ready", `Đã tải mô hình Teachable Machine (${labels.length} nhãn âm thanh)!`);
    toast("Đã tải mô hình Teachable Machine thành công! 🤖");
    console.log("%c✅ [Teachable Machine] Đã nạp thành công mô hình! Danh sách nhãn:", "color: #10B981; font-weight: bold;", labels);

    if (state.challenges && state.challenges.length > 0) {
      validateAllTargetMappings(labels, state.challenges);
    }
    return true;

  } catch (err) {
    console.warn("Lỗi khi tải Teachable Machine model:", err);
    unloadTeachableMachineModel();
    let detail = "Không tải được mô hình Teachable Machine. Hãy kiểm tra lại đường dẫn!";
    const errStr = String(err && err.message ? err.message : err);
    if (errStr.includes("words") || errStr.includes("wordLabels")) {
      detail = "Lỗi metadata: Không tìm thấy nhãn 'words'/'wordLabels'. Bạn hãy kiểm tra đã chọn đúng Audio Project trên Teachable Machine chưa nhé!";
    } else if (errStr.includes("Float32Array") || errStr.includes("multiple of 4")) {
      detail = "Tệp trọng số weights.bin bị lỗi kích thước byte hoặc bị lưu sai định dạng văn bản.";
    } else if (errStr.includes("NetworkError") || errStr.includes("404")) {
      detail = "Lỗi mạng hoặc không tìm thấy tệp mô hình model.json / metadata.json (404).";
    } else if (errStr.includes("Failed to fetch")) {
      detail = "Không thể tải tệp mô hình (Lỗi kết nối hoặc bị chặn CORS).";
    }
    setTmStatus("error", detail);
    toast(detail);
    return false;
  }
}

// Dừng lắng nghe micro nếu đang chạy
export async function stopTmListening() {
  if (activeNoFrameCheckTimeout) {
    clearTimeout(activeNoFrameCheckTimeout);
    activeNoFrameCheckTimeout = null;
  }
  if (tmRecognizer && tmRecognizer.isListening()) {
    try {
      await tmRecognizer.stopListening();
    } catch (_) {}
  }
}

// Lấy đối tượng recognizer cơ sở (để làm base model cho transfer learning)
export function getBaseTmRecognizer() {
  return tmBaseRecognizer || tmRecognizer;
}

// Kích hoạt mô hình tự huấn luyện (Transfer Learning Model) làm mô hình hoạt động chính
export function setCustomTmRecognizer(customRecognizer, customLabels = null) {
  if (tmRecognizer && tmRecognizer.isListening()) {
    try { tmRecognizer.stopListening(); } catch (_) {}
  }
  tmRecognizer = customRecognizer;
  tmModelLoaded = true;
  tmModelLoading = false;
  const labels = customLabels || (tmRecognizer && tmRecognizer.wordLabels ? tmRecognizer.wordLabels() : []);
  setTmStatus("ready", `Mô hình đã cập nhật (${labels.length} nhãn) sẵn sàng! 🎓`);
  toast(`Đã tự động cập nhật vào mô hình! Bé có thể chơi ngay 🤖✨`);
  console.log("%c🎓 [Transfer Learning] Đã cập nhật vào mô hình hiện tại! Danh sách nhãn:", "color: #3B82F6; font-weight: bold;", labels);
  if (state.challenges && state.challenges.length > 0) {
    validateAllTargetMappings(labels, state.challenges);
  }
}

// Hủy nạp mô hình Teachable Machine
export function unloadTeachableMachineModel() {
  if (tmRecognizer && tmRecognizer.isListening()) {
    try { tmRecognizer.stopListening(); } catch (_) {}
  }
  tmRecognizer = null;
  tmBaseRecognizer = null;
  tmModelLoaded = false;
  tmModelLoading = false;
  setTmStatus("disconnected", "Chưa nạp mô hình Teachable Machine.");
}

// Cập nhật trạng thái hiển thị của Google Teachable Machine trên giao diện
export function setTmStatus(type, message) {
  if (type === "error") console.warn(`[Teachable Machine] ${message}`);
}

// ====================================================
// CÔNG CỤ CHẨN ĐOÁN & KIỂM TRA HOẠT ĐỘNG MICROPHONE
// ====================================================

export function normalizeMatchTerm(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[_\-\s]+/g, " ")
    .trim();
}

// Tìm vị trí lớp (class index) tương ứng trong mô hình Teachable Machine cho mục tiêu từ data.json
export function findTargetClassIndex(labels, target) {
  if (!Array.isArray(labels) || labels.length === 0 || !target) return -1;

  const normTargetModelClass = normalizeMatchTerm(target.modelClass || target.aiLabel || "");
  const normTargetLabel = normalizeMatchTerm(target.label || target.name || "");
  const soundPattern = normalizeMatchTerm(target.soundPattern || "");

  // Tập hợp các từ khóa gốc đặc trưng (loại bỏ tiền tố chung như tieng, keu, con, chu, dong, vat)
  const commonPrefixes = new Set(["tieng", "keu", "con", "chu", "dong", "vat", "sound", "animal"]);
  const distinctKeywords = new Set();
  [normTargetModelClass, normTargetLabel, soundPattern].forEach((t) => {
    if (!t) return;
    t.split(" ").forEach((w) => {
      if (w.length >= 2 && !commonPrefixes.has(w)) {
        distinctKeywords.add(w);
      }
    });
  });

  let bestIndex = -1;
  let bestScore = -1;

  labels.forEach((rawLabel, index) => {
    const normLabel = normalizeMatchTerm(rawLabel);

    // Bỏ qua nhãn tạp âm nền (Background Noise)
    if (normLabel.includes("background") || normLabel.includes("noise") || normLabel.includes("tap am")) {
      return;
    }

    let score = 0;

    // TIER 1: Khớp chính xác tuyệt đối với modelClass (Ưu tiên cao nhất: 1000 điểm)
    if (normTargetModelClass && normLabel === normTargetModelClass) {
      score += 1000;
    }
    // TIER 2: Khớp chính xác tuyệt đối với label con vật (800 điểm)
    else if (normTargetLabel && normLabel === normTargetLabel) {
      score += 800;
    }
    // TIER 3: modelClass bao hàm nhãn hoặc ngược lại (500 điểm)
    else if (normTargetModelClass && (normLabel.includes(normTargetModelClass) || normTargetModelClass.includes(normLabel))) {
      score += 500;
    }
    // TIER 4: label bao hàm nhãn hoặc ngược lại (400 điểm)
    else if (normTargetLabel && (normLabel.includes(normTargetLabel) || normTargetLabel.includes(normLabel))) {
      score += 400;
    }

    // TIER 5: Khớp từ khóa gốc đặc trưng (ví dụ: 'vit', 'meo', 'cho', 'ga')
    const labelWords = normLabel.split(" ");
    let keywordMatches = 0;
    distinctKeywords.forEach((kw) => {
      if (labelWords.includes(kw)) {
        keywordMatches += 2;
      } else if (normLabel.includes(kw)) {
        keywordMatches += 1;
      }
    });

    if (keywordMatches > 0) {
      score += keywordMatches * 100;
    }

    // Chọn nhãn có điểm số khớp cao nhất
    if (score > bestScore && score >= 100) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

// Kiểm tra và chuẩn hóa ánh xạ toàn bộ mục tiêu trong data.json với mô hình AI
export function validateAllTargetMappings(labels, targets) {
  if (!Array.isArray(labels) || labels.length === 0) {
    console.warn("⚠️ [Chuẩn hóa nhãn AI] Chưa nạp danh sách nhãn mô hình AI.");
    return { valid: false, results: [] };
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    console.warn("⚠️ [Chuẩn hóa nhãn AI] Danh sách mục tiêu trong data.json trống.");
    return { valid: false, results: [] };
  }

  const results = [];
  const mappedIndices = new Map();
  let hasError = false;

  targets.forEach((target, i) => {
    const classIndex = findTargetClassIndex(labels, target);
    const matchedLabel = classIndex >= 0 ? labels[classIndex] : "KHÔNG TÌM THẤY";
    const isDuplicate = classIndex >= 0 && mappedIndices.has(classIndex);

    if (classIndex === -1 || isDuplicate) {
      hasError = true;
    }

    if (classIndex >= 0 && !mappedIndices.has(classIndex)) {
      mappedIndices.set(classIndex, target.label);
    }

    results.push({
      id: target.id || (i + 1),
      label: target.label,
      modelClass: target.modelClass || "(chưa đặt)",
      matchedAiClass: matchedLabel,
      classIndex: classIndex >= 0 ? classIndex : "N/A",
      status: classIndex === -1 ? "❌ Không khớp" : (isDuplicate ? "⚠️ Trùng lớp AI" : "✅ Chuẩn xác 1:1")
    });
  });
  return {
    valid: !hasError,
    results
  };
}

// Lắng nghe và phân loại âm thanh DUY NHẤT qua Google Teachable Machine
export async function startTmListening(currentTarget, callbacks = {}) {
  if (!tmRecognizer) {
    console.error("Chưa có mô hình Teachable Machine sẵn sàng để lắng nghe.");
    return;
  }
  const { onVolume, onConfidence, onRecognized } = callbacks;

  try {
    const labels = tmRecognizer.wordLabels();
    const bgNoiseIndex = labels.findIndex((label) => {
      const normLabel = normalizeMatchTerm(label);
      return normLabel.includes("background") || normLabel.includes("noise") || normLabel.includes("tap am");
    });

    // Ánh xạ lớp mục tiêu theo chuẩn hóa phân tầng chính xác
    const targetClassIndex = findTargetClassIndex(labels, currentTarget);

    // Dừng và cảnh báo rõ ràng nếu mục tiêu không có trong mô hình AI (KHÔNG tự gán lớp dự phòng theo thứ tự)
    if (targetClassIndex === -1) {
      console.warn(`⚠️ [Teachable Machine] Không tìm thấy lớp nhận diện phù hợp trong mô hình cho mục tiêu "${currentTarget.label}".`);
      toast(`Mô hình AI chưa có nhãn nhận diện cho "${currentTarget.label}"!`);
      if (callbacks.onError) {
        callbacks.onError(`Mô hình AI chưa có nhãn cho "${currentTarget.label}"`);
      }
      return;
    }


    let sessionRecognized = false;
    let currentSmoothedVol = 0;
    let totalFramesReceived = 0;

    if (activeNoFrameCheckTimeout) {
      clearTimeout(activeNoFrameCheckTimeout);
      activeNoFrameCheckTimeout = null;
    }

    activeNoFrameCheckTimeout = setTimeout(() => {
      if (state.micActive && totalFramesReceived === 0) {
        console.warn("⚠️ [Micro Cảnh Báo] Sau 3 giây vẫn chưa nhận được khung dữ liệu nào từ micro! Vui lòng kiểm tra quyền truy cập micro trên trình duyệt hoặc công tắc micro trên máy tính.");
      }
    }, 3000);

    if (tmRecognizer.isListening()) {
      try {
        await tmRecognizer.stopListening();
      } catch (_) {}
    }

    await tmRecognizer.listen((result) => {
      // ĐẢM BẢO KHÔNG CỘNG ĐIỂM LẶP: Dừng ngay nếu micro đã tắt hoặc đã công nhận trong phiên này
      if (!state.micActive || state.targetRecognized || sessionRecognized) return;

      totalFramesReceived++;
      if (activeNoFrameCheckTimeout) {
        clearTimeout(activeNoFrameCheckTimeout);
        activeNoFrameCheckTimeout = null;
      }

      // 1. Phân tích năng lượng phổ âm thanh & áp dụng cổng âm lượng thực tế
      let approxVol = 0;
      let avgDb = -80;
      if (result.spectrogram && result.spectrogram.data && result.spectrogram.data.length > 0) {
        const sData = result.spectrogram.data;
        let sum = 0;
        for (let i = 0; i < sData.length; i++) {
          sum += sData[i];
        }
        avgDb = sum / sData.length;

        // Cổng phân tích âm lượng chuẩn Web Audio FFT:
        // Phòng yên tĩnh (tạp âm nền): -100 dB đến -85 dB
        // Giọng nói / tiếng con vật bắt chước: -80 dB đến -35 dB
        const NOISE_FLOOR_DB = -88; // Mức sàn âm lượng phòng thực tế
        const PEAK_DB = -38;        // Mức âm lượng lớn nhất (100%)

        if (avgDb > NOISE_FLOOR_DB) {
          const ratio = (avgDb - NOISE_FLOOR_DB) / (PEAK_DB - NOISE_FLOOR_DB);
          approxVol = Math.min(100, Math.max(0, Math.round(ratio * 100)));
        }
      }

      const rawTargetScore = (targetClassIndex >= 0 && Number.isFinite(result.scores[targetClassIndex]))
        ? result.scores[targetClassIndex]
        : 0;

      let topIndex = 0;
      let highestScore = -1;
      for (let i = 0; i < result.scores.length; i++) {
        const s = Number.isFinite(result.scores[i]) ? result.scores[i] : 0;
        if (s > highestScore) {
          highestScore = s;
          topIndex = i;
        }
      }

      // Điểm số của nhãn tạp âm nền (Background Noise)
      const bgNoiseScore = (bgNoiseIndex >= 0 && Number.isFinite(result.scores[bgNoiseIndex]))
        ? result.scores[bgNoiseIndex]
        : 0;

      // Làm mượt âm lượng, phản hồi nhạy bén và mượt mà
      if (approxVol === 0) {
        currentSmoothedVol = Math.max(0, Math.round(currentSmoothedVol * 0.4));
        if (currentSmoothedVol < 2) currentSmoothedVol = 0;
      } else {
        currentSmoothedVol = Math.round(currentSmoothedVol * 0.3 + approxVol * 0.7);
      }
      if (onVolume) onVolume(currentSmoothedVol);

      const isNoiseDominant = (bgNoiseIndex >= 0 && topIndex === bgNoiseIndex) || bgNoiseScore > 0.60;
      const confidence = Math.round(rawTargetScore * 100);
      const isPredictedTarget = (topIndex === targetClassIndex) && (targetClassIndex >= 0);

      // Đạt khi mô hình chọn đúng mục tiêu với confidence >= 75%, không tính nhãn tạp âm.
      const isFrameHit = isPredictedTarget && confidence >= TARGET_CONFIDENCE_THRESHOLD && !isNoiseDominant;

      if (onConfidence) {
        if (isPredictedTarget) {
          if (isFrameHit) {
            onConfidence(confidence, `🎯 Chuẩn xác [${currentTarget.label}]: ${confidence}%!`);
          } else {
            const displayConfidence = confidence >= 15 ? confidence : 0;
            onConfidence(displayConfidence, `Độ tương đồng [${currentTarget.label}]: ${displayConfidence}%`);
          }
        } else {
          const topLabel = labels[topIndex] || "";
          const isNoise = topLabel.toLowerCase().includes("background") || topLabel.toLowerCase().includes("noise");
          if (!isNoise && highestScore >= 0.50) {
            onConfidence(0, `AI đang nghe thấy "${topLabel}" (${Math.round(highestScore * 100)}%). Bé hãy kêu tiếng ${currentTarget.label} nhé!`);
          } else {
            const displayConfidence = confidence >= 15 ? confidence : 0;
            onConfidence(displayConfidence, `Độ tương đồng [${currentTarget.label}]: ${displayConfidence}%`);
          }
        }
      }

      if (isFrameHit) {
        sessionRecognized = true;
        if (onRecognized) {
          onRecognized(currentTarget, confidence);
        }
      }
    }, {
      probabilityThreshold: 0.0,
      overlapFactor: 0.5,
      invokeCallbackOnNoiseAndUnknown: true,
      includeSpectrogram: true,
      audioTrackConstraints: {
        sampleRate: { ideal: 44100 },
        channelCount: { ideal: 1 }
      }
    });

  } catch (err) {
    console.error("Lỗi khi kích hoạt micro lắng nghe qua Teachable Machine:", err);
    let errorMsg = "Không thể truy cập micro!";
    if (err && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
      errorMsg = "Bé hoặc phụ huynh hãy bấm cho phép truy cập micro trên trình duyệt nhé! 🎙️";
    } else if (err && (err.name === "NotFoundError" || err.name === "DevicesNotFoundError")) {
      errorMsg = "Không tìm thấy thiết bị micro nào được kết nối với máy tính!";
    } else if (err && err.name === "NotReadableError") {
      errorMsg = "Micro đang bị ứng dụng khác chiếm dụng hoặc bị lỗi phần cứng!";
    } else if (err && err.name === "OverconstrainedError") {
      errorMsg = "Micro không hỗ trợ cấu hình âm thanh yêu cầu!";
    }
    toast(errorMsg);
    if (callbacks.onError) {
      callbacks.onError(errorMsg, err);
    }
  }
}
