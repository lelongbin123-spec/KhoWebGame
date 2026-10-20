/**
 * Điểm khởi chạy của game; file này luôn được nạp cuối cùng.
 * Đăng ký nút reset/modal trước khi tải dữ liệu và dựng giao diện.
 */
function startGameApp() {
    if (resetBtn) resetBtn.addEventListener('click', () => resetGame(true, true));
    const replayButton = document.querySelector('.replay-button');
    if (replayButton) replayButton.addEventListener('click', () => resetGame(false, true));

    const closeModalBtn = document.querySelector('.close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (successModal) successModal.classList.remove('show');
            if (resetBtn) resetBtn.disabled = false;
        });
    }

    initGame();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGameApp, { once: true });
} else {
    startGameApp();
}