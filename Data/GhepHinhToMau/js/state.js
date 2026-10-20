/**
 * Trạng thái dùng chung và các tham chiếu DOM của trò chơi.
 * File này phải được nạp đầu tiên; những script tiếp theo dùng các biến này.
 */

// ----------------------------------------------------
// 1. DỮ LIỆU & TRẠNG THÁI (STATE)
// ----------------------------------------------------
let gameData = null;
let referenceLayout = null;
let placedCount = 0;
let totalPartsCount = 0;
let answerSubmitted = false;

let timerInterval = null;
let finishTimeout = null;
let secondsElapsed = 0;

let activePointerId = null;
let draggedElement = null;
let cloneElement = null;
let touchOffsetX = 0;
let touchOffsetY = 0;

let isEraserSelected = false;
let selectedColor = '#ef4444';
let selectedBoardItem = null;
let toastTimeout = null;

// Thêm âm thanh
const dropSound = new Audio('assets/audio/drop-sound.m4a');
const colorSound = new Audio('assets/audio/color-sound.m4a');
const correctSound = new Audio('assets/audio/correct.m4a');

// ----------------------------------------------------
// 2. TRUY XUẤT PHẦN TỬ DOM
// ----------------------------------------------------
const gameTitleEl = document.querySelector('.game-title');
const gameDescEl = document.querySelector('.game-description');
const timerEl = document.querySelector('.stat-box span');
const scoreEl = document.querySelector('.score-counter span');
const resetBtn = document.querySelector('.game-button');

const referencePartsContainer = document.querySelector('.reference-parts-container');
const assemblyBoard = document.querySelector('.assembly-board');
const coloringPanel = document.getElementById('task-coloring');
const placedContainer = document.getElementById('placed-parts-container');
const puzzleTray = document.querySelector('.puzzle-tray');

const successModal = document.querySelector('.success-modal');
const successTitleEl = document.querySelector('.success-title');
const successDescriptionEl = document.querySelector('.success-description');
const finalScoreEl = document.getElementById('final-score');
const finalScoreDetailsEl = document.getElementById('final-score-details');
const toastEl = document.querySelector('.toast-message');

const tabButtons = document.querySelectorAll('.tab-btn');
const taskPanels = document.querySelectorAll('.task-panel');
const colorDots = document.querySelectorAll('.color-dot');
const colorField = document.getElementById('color-field');
const hueSlider = document.getElementById('hue-slider');
const colorPickerHandle = document.getElementById('color-picker-handle');
const customColorPreview = document.getElementById('custom-color-preview');
const customColorValue = document.getElementById('custom-color-value');
const eraserBtn = document.getElementById('eraser-btn');
const clearColorBtn = document.getElementById('clear-color-btn');

// Nút Check Đáp Án
const checkAnswerBtn = document.querySelector('.submit_result, .btn-check-answer, .check-btn');

