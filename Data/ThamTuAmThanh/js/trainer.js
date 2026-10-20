// ====================================================
// TRAINER.JS - XƯỞNG TỰ HUẤN LUYỆN MÔ HÌNH ÂM THANH (TRANSFER LEARNING)
// ====================================================

import { state } from "./state.js";
import { toast } from "./ui.js";
import {
  getBaseTmRecognizer,
  loadTeachableMachineModel,
  setCustomTmRecognizer,
  stopTmListening
} from "./classifier.js";

export const BACKGROUND_NOISE_TAG = "_background_noise_";
const CUSTOM_MODEL_NAME = "tham_tu_am_thanh_custom";
const INDEXEDDB_URL = "indexeddb://tham_tu_am_thanh_custom_model";
const STORAGE_KEY_META = "tm_custom_trained_meta";
const DB_NAME = "ThamTuAmThanh_DB";
const STORE_NAME = "ai_trainer_store";
const LEGACY_DB_NAME = "AnimalAudioGameDB";

let transferRecognizer = null;
let isRecordingSample = false;
let isTrainingActive = false;
let trainerLabels = [];

// Xóa IndexedDB của phiên bản cũ; ứng dụng hiện không còn đọc hay ghi database này.
export function removeLegacyTrainerDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
    request.onsuccess = () => resolve(true);
    request.onerror = () => {
      console.warn("Không thể xóa IndexedDB cũ:", request.error);
      resolve(false);
    };
    request.onblocked = () => {
      console.warn("Chưa xóa được IndexedDB cũ vì còn một tab đang mở kết nối tới nó.");
      resolve(false);
    };
  });
}

// Quản lý cơ sở dữ liệu IndexedDB để lưu trữ mẫu âm thanh (Dataset)
function openTrainerDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB không được hỗ trợ trên môi trường này."));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Lưu tập dữ liệu mẫu thu âm (Audio Spectrograms) vào IndexedDB
export async function saveDatasetToIndexedDB(recognizer) {
  try {
    if (!recognizer || recognizer.isDatasetEmpty()) return;
    const serialized = recognizer.serializeExamples();
    const db = await openTrainerDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(serialized, "saved_dataset");
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (err) {
    console.warn("Không thể lưu dataset vào IndexedDB:", err);
  }
}

// Phục hồi tập dữ liệu mẫu thu âm đã lưu từ IndexedDB
export async function loadDatasetFromIndexedDB(recognizer) {
  try {
    if (!recognizer) return false;
    const db = await openTrainerDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const getReq = tx.objectStore(STORE_NAME).get("saved_dataset");
    const serialized = await new Promise((res, rej) => {
      getReq.onsuccess = () => res(getReq.result);
      getReq.onerror = rej;
    });
    if (serialized && serialized.byteLength > 0) {
      recognizer.loadExamples(serialized, false);
      return true;
    }
  } catch (err) {
    console.warn("Không thể tải dataset từ IndexedDB:", err);
  }
  return false;
}

async function loadProjectDataset(recognizer) {
  const datasetUrl = state.trainerDatasetUrl;
  if (!recognizer || !datasetUrl) return false;

  try {
    const response = await fetch(datasetUrl, { cache: "no-store" });
    if (!response.ok) return false;
    const serialized = await response.arrayBuffer();
    if (serialized.byteLength === 0) return false;
    recognizer.loadExamples(serialized, false);
    await saveDatasetToIndexedDB(recognizer);
    return true;
  } catch (err) {
    console.warn("Không thể nạp bộ mẫu huấn luyện trong dự án:", err);
    return false;
  }
}

export async function exportTrainerDatasetBin() {
  try {
    const recognizer = await getOrCreateTransferRecognizer();
    if (recognizer.isDatasetEmpty()) {
      toast("Chưa có mẫu âm thanh để xuất!");
      return false;
    }

    const blob = new Blob([recognizer.serializeExamples()], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "du-lieu-giong-con-vat.bin";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Đã xuất bộ mẫu âm thanh (.bin).");
    return true;
  } catch (err) {
    console.error("Không thể xuất bộ mẫu huấn luyện:", err);
    toast("Không thể xuất bộ mẫu: " + (err.message || err));
    return false;
  }
}

export async function importTrainerDatasetBin(file) {
  if (!file) return false;
  try {
    const recognizer = await getOrCreateTransferRecognizer();
    recognizer.loadExamples(await file.arrayBuffer(), false);
    await saveDatasetToIndexedDB(recognizer);
    toast(`Đã cộng dồn mẫu từ "${file.name}".`);
    return true;
  } catch (err) {
    console.error("File mẫu âm thanh không hợp lệ:", err);
    toast("Không thể nạp file mẫu (.bin): " + (err.message || err));
    return false;
  }
}

// Xóa dữ liệu mẫu âm thanh đã lưu trong IndexedDB
export async function clearSavedDatasetFromIndexedDB() {
  try {
    const db = await openTrainerDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete("saved_dataset");
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (err) {
    console.warn("Lỗi khi xóa dataset trong IndexedDB:", err);
  }
}

// Tự động đồng bộ các nhãn trong mô hình AI vào danh sách thử thách của game
export function syncChallengesWithModelLabels(labels) {
  if (!Array.isArray(labels) || !Array.isArray(state.challenges)) return;
  const existingNorms = new Set(
    state.challenges.map(c => (c.label || c.name || c.modelClass || "").toLowerCase().trim())
  );

  labels.forEach(lbl => {
    const trimmed = (lbl || "").trim();
    if (!trimmed || trimmed === BACKGROUND_NOISE_TAG || trimmed.includes("noise") || trimmed.includes("tap am")) {
      return;
    }
    const norm = trimmed.toLowerCase();
    if (!existingNorms.has(norm)) {
      // Tìm xem có hình ảnh tương ứng trong state.rounds không
      const matchedRound = (state.rounds || []).find(r => 
        (r.label || "").toLowerCase() === norm ||
        norm.includes((r.label || "").toLowerCase())
      );
      state.challenges.push({
        id: state.challenges.length + 1,
        label: trimmed,
        modelClass: trimmed,
        src: matchedRound ? matchedRound.src : "",
        emoji: getLabelIcon(trimmed),
        soundPattern: norm,
        scored: false
      });
      existingNorms.add(norm);
    }
  });
}

// Bảng ánh xạ icon ngộ nghĩnh cho các tiếng kêu/con vật
const LABEL_ICONS = {
  [BACKGROUND_NOISE_TAG]: " ",
  "background noise": " ",
  "tieng on phong": " ",
  "tap am": " ",
  "ga trong": " ",
  "con ga": " ",
  "chu cho": " ",
  "con cho": " ",
  "meo con": " ",
  "con meo": " ",
  "con vit": " ",
  "chu vit": " ",
  "xe cap cuu": " ",
  "dan piano": " ",
  "piano": " ",
  "con bo": " ",
  "chu lon": " ",
  "con lon": " ",
  "con heo": " ",
  "chu heo": " ",
  "con chim": " ",
  "su tu": " ",
  "con ho": " ",
  "tieng vo tay": " ",
  "tieng cuoi": " "
};

// Nhận diện từ khóa gốc đặc trưng của con vật hoặc âm thanh để khử trùng lặp
export function getLabelRootWord(label) {
  const norm = String(label || "").toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  if (norm.includes("noise") || norm.includes("background") || norm.includes("tap am") || norm.includes("im lang") || label === BACKGROUND_NOISE_TAG) {
    return "noise";
  }
  if (norm.includes("cho") || norm.includes("dog")) return "cho";
  if (norm.includes("ga") || norm.includes("rooster") || norm.includes("chicken")) return "ga";
  if (norm.includes("meo") || norm.includes("cat")) return "meo";
  if (norm.includes("vit") || norm.includes("duck")) return "vit";
  if (norm.includes("bo") || norm.includes("cow")) return "bo";
  if (norm.includes("heo") || norm.includes("lon") || norm.includes("pig")) return "heo";
  if (norm.includes("chim") || norm.includes("bird")) return "chim";
  if (norm.includes("cuu") || norm.includes("ambulance")) return "ambulance";
  if (norm.includes("piano")) return "piano";
  if (norm.includes("ho") || norm.includes("tiger")) return "ho";
  if (norm.includes("tu") || norm.includes("lion")) return "lion";
  return norm;
}

export function getLabelIcon(label) {
  const norm = String(label || "").toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const root = getLabelRootWord(label);
  return LABEL_ICONS[root] || LABEL_ICONS[norm] || LABEL_ICONS[label] || "🐾";
}

export function getLabelDisplayName(label) {
  const root = getLabelRootWord(label);
  if (root === "noise") {
    return "Tạp âm phòng / Im lặng";
  }
  // Tìm tên hiển thị tiếng Việt ngộ nghĩnh trong danh sách các bài học thử thách
  const allKnown = [...(state.challenges || []), ...(state.rounds || [])];
  const matched = allKnown.find(item => {
    const l = (item.label || item.name || "").trim();
    return getLabelRootWord(l) === root;
  });
  if (matched && matched.label) {
    return matched.label;
  }
  const trimmed = String(label || "").trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Khởi tạo danh sách nhãn huấn luyện: Tự động khử trùng lặp và đồng bộ sạch sẽ với mô hình dự án
export function initTrainerLabels() {
  const labelsMap = new Map(); // key: root word, value: canonical training label

  // 1. Nhãn tiếng ồn phòng bắt buộc (DUY NHẤT 1 nhãn)
  labelsMap.set("noise", BACKGROUND_NOISE_TAG);

  // 2. Kế thừa nhãn có trong bộ mẫu dự án.
  Object.keys(getSampleCounts()).forEach(label => {
    const trimmed = label.trim();
    const root = getLabelRootWord(trimmed);
    if (trimmed && root !== "noise" && !labelsMap.has(root)) {
      labelsMap.set(root, trimmed);
    }
  });

  // 3. Kế thừa các con vật từ danh sách bài học / thử thách trong game (nếu chưa có trong mô hình)
  const challenges = state.challenges && state.challenges.length > 0
    ? state.challenges
    : (state.rounds || []);

  challenges.forEach(ch => {
    const name = (ch.label || ch.name || "").trim();
    if (!name) return;
    const root = getLabelRootWord(name);
    if (root === "noise") return;
    if (!labelsMap.has(root)) {
      labelsMap.set(root, name);
    }
  });

  // 4. Nếu danh sách vẫn trống, bổ sung 4 con vật mặc định
  if (labelsMap.size <= 1) {
    ["con chó", "con gà", "con mèo", "con vịt"].forEach(l => {
      const root = getLabelRootWord(l);
      if (!labelsMap.has(root)) labelsMap.set(root, l);
    });
  }

  trainerLabels = Array.from(labelsMap.values());
  return trainerLabels;
}

export function getTrainerLabels() {
  if (trainerLabels.length === 0) {
    initTrainerLabels();
  }
  return [...trainerLabels];
}

export function addTrainerLabel(newLabel) {
  const trimmed = String(newLabel || "").trim();
  if (!trimmed) {
    toast("Vui lòng nhập tên con vật hoặc tiếng kêu!");
    return false;
  }
  const root = getLabelRootWord(trimmed);
  if (root === "noise") {
    toast("Đã có nhãn Tạp âm phòng rồi bạn nhỏ ơi!");
    return false;
  }
  const exists = trainerLabels.some(l => getLabelRootWord(l) === root || l.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    toast(`Nhãn "${trimmed}" đã có trong danh sách!`);
    return false;
  }
  trainerLabels.push(trimmed);
  return true;
}

export function removeTrainerLabel(labelToRemove) {
  if (labelToRemove === BACKGROUND_NOISE_TAG || getLabelRootWord(labelToRemove) === "noise") {
    toast("Không thể xóa nhãn Tạp âm phòng!");
    return false;
  }
  // Xóa mẫu đã thu của nhãn này nếu có
  clearSamplesForLabel(labelToRemove);
  trainerLabels = trainerLabels.filter(l => l !== labelToRemove && getLabelRootWord(l) !== getLabelRootWord(labelToRemove));
  return true;
}

// Đảm bảo mô hình nền tảng trong thư mục dự án (model/) được nạp trước khi huấn luyện hoặc thu mẫu
export async function ensureProjectBaseModelLoaded() {
  const projectModelUrl = state.teachableMachineModelUrl || "base_model/";
  let baseRecognizer = getBaseTmRecognizer();

  const isReady = baseRecognizer && typeof baseRecognizer.createTransfer === "function" && baseRecognizer.model;
  if (!isReady) {
    const ok = await loadTeachableMachineModel(projectModelUrl);
    if (!ok) {
      throw new Error(`Không thể nạp mô hình từ thư mục dự án "${projectModelUrl}". Bé hoặc cô giáo hãy kiểm tra lại thư mục model/ nhé!`);
    }
    baseRecognizer = getBaseTmRecognizer();
  }

  return baseRecognizer;
}

// Lấy hoặc khởi tạo TransferSpeechCommandRecognizer dựa trên mô hình của dự án
export async function getOrCreateTransferRecognizer(forceReloadBase = false) {
  if (transferRecognizer && !forceReloadBase) {
    return transferRecognizer;
  }

  // 1. Luôn bảo đảm tải mô hình trong dự án (model/) trước
  const baseRecognizer = await ensureProjectBaseModelLoaded();

  if (!baseRecognizer || typeof baseRecognizer.createTransfer !== "function") {
    throw new Error("Mô hình cơ sở trong dự án chưa sẵn sàng để chuyển giao học tập (Transfer Learning)!");
  }

  if (baseRecognizer.transferRecognizers && baseRecognizer.transferRecognizers[CUSTOM_MODEL_NAME]) {
    transferRecognizer = baseRecognizer.transferRecognizers[CUSTOM_MODEL_NAME];
  } else {
    transferRecognizer = baseRecognizer.createTransfer(CUSTOM_MODEL_NAME);
  }

  // Bộ mẫu trong IndexedDB đã gồm mẫu dự án và mẫu người dùng thu thêm.
  // Khôi phục nó trước để không ghi đè mất giọng đã thu khi tải lại trang.
  const loadedSavedDataset = await loadDatasetFromIndexedDB(transferRecognizer);
  if (!loadedSavedDataset) await loadProjectDataset(transferRecognizer);

  return transferRecognizer;
}

function getModelOutputCount(recognizer) {
  const outputShape = recognizer?.model?.outputs?.[0]?.shape;
  const count = outputShape && outputShape.length ? outputShape[outputShape.length - 1] : null;
  return Number.isInteger(count) ? count : null;
}

async function rebuildTransferRecognizerForDataset(recognizer) {
  const examples = recognizer.serializeExamples();
  const baseRecognizer = await ensureProjectBaseModelLoaded();
  const freshRecognizer = baseRecognizer.createTransfer(`${CUSTOM_MODEL_NAME}_${Date.now()}`);
  freshRecognizer.loadExamples(examples, false);
  transferRecognizer = freshRecognizer;
  console.warn("⚠️ Số lớp đầu ra AI không trùng số nhãn dữ liệu. Đã tạo lại đầu huấn luyện từ bộ mẫu hiện có.");
  return freshRecognizer;
}

export async function initializeProjectTraining(onProgress = null) {
  const recognizer = await getOrCreateTransferRecognizer();
  if (recognizer.isDatasetEmpty()) {
    return { success: false, message: "Không tìm thấy bộ mẫu huấn luyện của dự án." };
  }

    const result = await startModelTraining({ epochs: 40 }, onProgress);
  if (result.success) {
    initTrainerLabels();
  }
  return result;
}

// Lấy số lượng mẫu đã thu của từng nhãn
export function getSampleCounts() {
  if (!transferRecognizer) return {};
  try {
    if (transferRecognizer.isDatasetEmpty()) return {};
    return transferRecognizer.countExamples() || {};
  } catch (_) {
    return {};
  }
}

// Thu âm 1 mẫu âm thanh (~1 giây) cho một nhãn cụ thể
export async function collectAudioSample(label, callbacks = {}) {
  if (isRecordingSample) {
    toast("Đang trong quá trình thu âm mẫu khác, bé đợi một chút nhé!");
    return false;
  }

  try {
    isRecordingSample = true;
    await stopTmListening();

    const recognizer = await getOrCreateTransferRecognizer();

    if (callbacks.onStart) {
      callbacks.onStart(label);
    }

    // Thu thập 1 mẫu âm thanh độ dài ~1 giây
    await recognizer.collectExample(label);

    // Tự động lưu mẫu vào IndexedDB để không bị mất khi tải lại trang
    await saveDatasetToIndexedDB(recognizer);

    isRecordingSample = false;
    const counts = getSampleCounts();

    if (callbacks.onComplete) {
      callbacks.onComplete(label, counts[label] || 0);
    }
    return true;

  } catch (err) {
    isRecordingSample = false;
    console.error("Lỗi khi thu âm mẫu:", err);
    let errMsg = "Không thể thu âm mẫu!";
    if (err && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
      errMsg = "Bé hoặc phụ huynh hãy bấm cho phép truy cập micro nhé!";
    }
    toast(errMsg);
    if (callbacks.onError) {
      callbacks.onError(errMsg, err);
    }
    return false;
  }
}

// Xóa các mẫu đã thu của một nhãn cụ thể
export function clearSamplesForLabel(label) {
  if (!transferRecognizer) return;
  try {
    if (transferRecognizer.isDatasetEmpty()) return;
    const examples = transferRecognizer.getExamples(label) || [];
    examples.forEach(ex => {
      if (ex && ex.uid !== undefined) {
        transferRecognizer.removeExample(ex.uid);
      }
    });
    saveDatasetToIndexedDB(transferRecognizer);
  } catch (err) {
    console.warn("Không thể xóa mẫu cho nhãn:", label, err);
  }
}

// Xóa toàn bộ dữ liệu mẫu đã thu
export function clearAllTrainerSamples() {
  if (!transferRecognizer) return;
  try {
    if (!transferRecognizer.isDatasetEmpty()) {
      transferRecognizer.clearExamples();
    }
    clearSavedDatasetFromIndexedDB();
    toast("Đã xóa toàn bộ mẫu đã thu.");
  } catch (err) {
    console.warn("Lỗi khi xóa toàn bộ mẫu:", err);
  }
}

// Kiểm tra điều kiện đủ để huấn luyện mô hình
export function validateTrainingRequirements() {
  const counts = getSampleCounts();
  const countsByRoot = {};
  Object.entries(counts).forEach(([label, count]) => {
    const root = getLabelRootWord(label);
    countsByRoot[root] = (countsByRoot[root] || 0) + count;
  });
  const labels = getTrainerLabels();
  const bgCount = countsByRoot.noise || 0;
  const animalLabels = labels.filter(label => getLabelRootWord(label) !== "noise");

  if (bgCount < 2) {
    return {
      ready: false,
      message: "Cần ít nhất 2 mẫu Tạp âm phòng (giữ im lặng) để AI phân biệt khi chưa có tiếng kêu!"
    };
  }

  if (animalLabels.length === 0) {
    return {
      ready: false,
      message: "Cần thêm nhãn tiếng con vật để AI học!"
    };
  }

  const missingLabels = animalLabels.filter(label => (countsByRoot[getLabelRootWord(label)] || 0) < 2);
  if (missingLabels.length > 0) {
    return {
      ready: false,
      message: `Mỗi nhãn cần ít nhất 2 mẫu. Còn thiếu: ${missingLabels.map(getLabelDisplayName).join(", ")}.`
    };
  }

  return {
    ready: true,
    bgCount,
    animalCount: animalLabels.length,
    labels: [BACKGROUND_NOISE_TAG, ...animalLabels]
  };
}

// Tìm layer phân loại đầu ra NewHeadDense trong mô hình
export async function startModelTraining(options = {}, onProgress = null) {
  if (isTrainingActive) {
    toast("Đang trong quá trình huấn luyện AI...");
    return { success: false, message: "Đang huấn luyện" };
  }

  const check = validateTrainingRequirements();
  if (!check.ready) {
    toast(check.message);
    return { success: false, message: check.message };
  }

  try {
    isTrainingActive = true;
    if (onProgress) onProgress({ stage: "preparing", epoch: 0, totalEpochs: options.epochs || 40, accuracy: null });
    await stopTmListening();
    if (onProgress) onProgress({ stage: "loading", epoch: 0, totalEpochs: options.epochs || 40, accuracy: null });

    let recognizer = await getOrCreateTransferRecognizer();
    const datasetLabelCount = recognizer.wordLabels().length;
    const modelOutputCount = getModelOutputCount(recognizer);
    if (modelOutputCount !== null && modelOutputCount !== datasetLabelCount) {
      recognizer = await rebuildTransferRecognizerForDataset(recognizer);
    }
    if (onProgress) onProgress({ stage: "training", epoch: 0, totalEpochs: options.epochs || 40, accuracy: null });
    const epochs = options.epochs || 40;

    console.log(`%c🚀 [Trainer] Bắt đầu huấn luyện và cập nhật mô hình AI (${epochs} epochs)...`, "color: #3B82F6; font-weight: bold;");
    if (onProgress) onProgress({ stage: "running", epoch: 0, totalEpochs: epochs, accuracy: null });

    await recognizer.train({
      epochs,
      callback: {
        onEpochEnd: async (epoch, logs) => {
          const currentEpoch = epoch + 1;
          const accuracy = logs && logs.acc !== undefined ? Math.round(logs.acc * 100) : null;
          const loss = logs && logs.loss !== undefined ? logs.loss.toFixed(3) : null;
          if (onProgress) {
            onProgress({
              stage: "training",
              epoch: currentEpoch,
              totalEpochs: epochs,
              accuracy,
              loss
            });
          }
        }
      }
    });

    isTrainingActive = false;
    if (onProgress) onProgress({ stage: "saving", epoch: epochs, totalEpochs: epochs, accuracy: 100 });

    // Giữ model transfer đã huấn luyện làm nguồn nhận dạng duy nhất.
    // Không chép lớp tùy chỉnh vào model nền vì chỉ số đầu ra của hai model
    // có thể khác nhau, khiến nhãn dự đoán bị lệch hoặc quay về nhãn mặc định.
    const finalRecognizer = recognizer;
    const finalLabels = recognizer.wordLabels();

    // 2. Tự động lưu mô hình vừa cập nhật vào IndexedDB của trình duyệt
    try {
      if (typeof finalRecognizer.save === "function") {
        await finalRecognizer.save(INDEXEDDB_URL);
      } else if (finalRecognizer.model && typeof finalRecognizer.model.save === "function") {
        await finalRecognizer.model.save(INDEXEDDB_URL);
      }
      const meta = {
        name: CUSTOM_MODEL_NAME,
        wordLabels: finalLabels,
        trainedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
      await saveDatasetToIndexedDB(recognizer);
    } catch (saveErr) {
      console.warn("Không thể lưu tự động vào IndexedDB:", saveErr);
    }

    // 3. Kích hoạt trực tiếp mô hình vừa cập nhật làm mô hình phân loại chính của game
    setCustomTmRecognizer(finalRecognizer, finalLabels);

    // 4. Tự động đồng bộ các con vật trong game để bé chơi được trọn vẹn tất cả con vật
    syncChallengesWithModelLabels(finalLabels);

    return {
      success: true,
      labels: finalLabels,
      message: "Đã cập nhật thẳng vào mô hình lúc đầu thành công!"
    };

  } catch (err) {
    isTrainingActive = false;
    console.error("Lỗi khi huấn luyện mô hình:", err);
    toast("Huấn luyện AI thất bại: " + (err.message || err));
    return {
      success: false,
      message: err.message || String(err)
    };
  }
}

export async function loadSavedCustomModel() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    if (!raw) return false;
    const meta = JSON.parse(raw);

    const recognizer = await getOrCreateTransferRecognizer();
    const datasetLabels = recognizer.wordLabels() || [];
    const savedLabels = Array.isArray(meta.wordLabels) ? meta.wordLabels : [];
    const labelsMatch = datasetLabels.length === savedLabels.length &&
      datasetLabels.every((label, index) => String(label).trim().toLowerCase() === String(savedLabels[index]).trim().toLowerCase());
    if (!labelsMatch) {
      console.warn("⚠️ Model đã lưu có số/thứ tự nhãn khác bộ mẫu hiện tại; bỏ model cũ và huấn luyện lại.");
      localStorage.removeItem(STORAGE_KEY_META);
      if (window.tf?.io) await window.tf.io.removeModel(INDEXEDDB_URL).catch(() => {});
      return false;
    }
    await recognizer.load(INDEXEDDB_URL);
    recognizer.words = meta.wordLabels || recognizer.wordLabels();

    // Khởi tạo secondLastBaseDenseLayer từ baseModel để sẵn sàng cho các lần huấn luyện tiếp theo
    if (!recognizer.secondLastBaseDenseLayer && recognizer.baseModel && recognizer.baseModel.layers) {
      for (let n = recognizer.baseModel.layers.length - 2; n >= 0; n--) {
        if ("dense" === recognizer.baseModel.layers[n].getClassName().toLowerCase()) {
          recognizer.secondLastBaseDenseLayer = recognizer.baseModel.layers[n];
          break;
        }
      }
    }

    // Kiểm tra tính toàn vẹn của trọng số (ngăn chặn triệt để lỗi NaN làm tê liệt thanh đo)
    if (recognizer.model && typeof recognizer.model.getWeights === "function") {
      let hasNan = false;
      const weights = recognizer.model.getWeights();
      for (const w of weights) {
        const data = w.dataSync();
        for (let i = 0; i < data.length; i++) {
          if (!Number.isFinite(data[i])) {
            hasNan = true;
            break;
          }
        }
        if (hasNan) break;
      }
      if (hasNan) {
        console.warn("⚠️ [IndexedDB] Phát hiện mô hình tự luyện cũ chứa trọng số lỗi (NaN). Đang tự động dọn dẹp để phục hồi mô hình chuẩn sạch!");
        try {
          localStorage.removeItem(STORAGE_KEY_META);
          if (typeof window !== "undefined" && window.tf && window.tf.io) {
            window.tf.io.removeModel(INDEXEDDB_URL).catch(() => {});
          }
        } catch (_) {}
        return false;
      }
    }

    setCustomTmRecognizer(recognizer, meta.wordLabels);
    syncChallengesWithModelLabels(recognizer.wordLabels());
    toast("Đã tự động tải lại mô hình AI đã cập nhật! 🤖✨");
    return true;
  } catch (err) {
    console.warn("Không thể nạp mô hình từ IndexedDB:", err);
    return false;
  }
}

// Xóa sạch mô hình tự huấn luyện và các mẫu đã lưu để khôi phục về mô hình mặc định
