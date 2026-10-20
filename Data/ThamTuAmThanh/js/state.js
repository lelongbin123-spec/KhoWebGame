// ====================================================
// STATE.JS - QUẢN LÝ TRẠNG THÁI TOÀN CỤC & DOM ELEMENTS
// ====================================================

export const $ = (selector) => document.querySelector(selector);
export const screens = [...document.querySelectorAll(".screen")];

export const state = {
  gameId: "ThamTuAmThanh",
  gameType: "Thám Tử Âm Thanh",
  gameText: "",
  maxScore: 100,
  teachableMachineModelUrl: "base_model/",
  trainerDatasetUrl: "",
  rounds: [],
  challenges: [],
  mode: null,
  questionIndex: 0,
  questions: [],
  score: 0,
  correct: 0,
  answered: false,
  soundEnabled: true,
  audioPlaying: false,
  currentAudio: null,
  audioStopTimer: null,
  waveformInterval: null,
  micStream: null,
  micActive: false,
  micTimeout: null,
  autoNextTimeout: null,
  targetRecognized: false,
  challengeIndex: 0,
  isCompleted: false
};

export const els = {
  topScore: $("#topScore"),
  scorePill: $("#scorePill"),
  scorePopupContainer: $("#scorePopupContainer"),
  homeBtn: $("#homeBtn"),
  homeScreen: $("#homeScreen"),
  listenScreen: $("#listenScreen"),
  copyScreen: $("#copyScreen"),
  resultScreen: $("#resultScreen"),
  
  // Chế độ 1: Nghe âm đoán bóng
  answerGrid: $("#answerGrid"),
  feedback: $("#listenFeedback"),
  feedbackIcon: $("#listenFeedback .feedback-icon"),
  feedbackText: $("#listenFeedback .feedback-text"),
  playSound: $("#playSoundBtn"),
  soundOrb: $("#soundOrb"),
  waveformBars: $("#waveformBars"),
  next: $("#nextQuestionBtn"),
  counter: $("#questionCounter"),
  progress: $("#progressFill"),
  mascotImg: $("#mascotCompanionImg"),
  mascotMsg: $("#mascotMessage"),
  
  // Chế độ 2: Thử tài bắt chước & Teachable Machine
  challengeCounter: $("#challengeCounter"),
  challengeProgressFill: $("#challengeProgressFill"),
  micBtn: $("#micBtn"),
  micStatus: $("#micStatus"),
  copyCharacter: $("#copyCharacter"),
  copyChallenge: $("#copyChallenge"),
  aiConfidenceFill: $("#aiConfidenceFill"),
  aiConfidenceText: $("#aiConfidenceText"),
  aiConfidenceHint: $("#aiConfidenceHint"),
  voiceMeterFill: $("#voiceMeterFill"),
  voiceLevelText: $("#voiceLevelText"),
  nextChallengeBtn: $("#nextChallengeBtn"),

  // Xưởng Tự Luyện AI (Transfer Learning Studio)
  tmTrainerModal: $("#tmTrainerModal"),
  tmTrainerModalClose: $("#tmTrainerModalClose"),
  tmTrainerModalBackdrop: $("#tmTrainerModalBackdrop"),
  trainerNewLabelInput: $("#trainerNewLabelInput"),
  trainerAddLabelBtn: $("#trainerAddLabelBtn"),
  trainerCardsGrid: $("#trainerCardsGrid"),
  trainerProgressPanel: $("#trainerProgressPanel"),
  trainerProgressBar: $("#trainerProgressBar"),
  trainerProgressPercent: $("#trainerProgressPercent"),
  trainerProgressDetail: $("#trainerProgressDetail"),
  trainerStatusAlert: $("#trainerStatusAlert"),
  trainerStatusIcon: $("#trainerStatusIcon"),
  trainerStatusMsg: $("#trainerStatusMsg"),
  trainerClearAllBtn: $("#trainerClearAllBtn"),
  trainerDatasetInput: $("#trainerDatasetInput"),
  trainerImportDatasetBtn: $("#trainerImportDatasetBtn"),
  trainerExportDatasetBtn: $("#trainerExportDatasetBtn"),
  trainerStartTrainBtn: $("#trainerStartTrainBtn"),
  trainerApplyPlayBtn: $("#trainerApplyPlayBtn"),
  openTrainerHeaderBtn: $("#openTrainerHeaderBtn"),
  
  // Màn hình kết quả
  finalScore: $("#finalScore"),
  resultDetail: $("#resultDetail"),
  resultMessage: $("#resultMessage"),
  starRatingBox: $("#starRatingBox"),
  replayBtn: $("#replayBtn"),
  homeFromResultBtn: $("#homeFromResultBtn"),
  
  toast: $("#toast")
};

