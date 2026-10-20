/**
 * Tiện ích giao diện dùng chung: điểm số, đồng hồ, toast và kết thúc/reset.
 */

function updateScoreDisplay() {
    if (scoreEl) {
        scoreEl.textContent = `Đã ghép: ${placedCount} / ${totalPartsCount}`;
    }
}

function startTimer() {
    stopTimer();
    secondsElapsed = 0;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    if (!timerEl) return;
    const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
    const secs = (secondsElapsed % 60).toString().padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
}

function finishGame(score = 0, result = {}) {
    stopTimer();
    if (successTitleEl) successTitleEl.textContent = result.isCorrect ? 'Xuất sắc!' : 'Kết quả lượt chơi';
    if (successDescriptionEl) successDescriptionEl.textContent = result.isCorrect
        ? 'Bạn đã hoàn thành đúng thách!'
        : 'Lượt chơi đã được chấm điểm và kết thúc.';
    if (finalScoreEl) finalScoreEl.textContent = `${Number(score).toFixed(1)} / 10`;
    if (finalScoreDetailsEl) finalScoreDetailsEl.textContent = 'Vị trí lệch: ' + (result.deviationPercent ?? '-') + '% | Màu lệch: ' + (result.colorDeviationPercent ?? '-') + '%';
    if (finishTimeout) clearTimeout(finishTimeout);
    finishTimeout = setTimeout(() => {
        finishTimeout = null;
        if (successModal) {
            successModal.classList.add('show');
        }
        
        // Play correct/congratulation sound when game ends
        if (typeof correctSound !== 'undefined') {
            correctSound.currentTime = 0;
            correctSound.play().catch(e => console.log('Audio play failed', e));
        }
    }, 800);
}

function showToast(message) {
    if (!toastEl) return;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.classList.add('show');
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
        toastTimeout = null;
    }, 2500);
}

function resetGame(showMessage = false, allowAfterSubmit = false) {
    if (answerSubmitted && !allowAfterSubmit) return;
    answerSubmitted = false;
    document.body.classList.remove('game-locked');
    if (resetBtn) resetBtn.disabled = false;
    if (checkAnswerBtn) checkAnswerBtn.disabled = false;
    tabButtons.forEach(button => { button.disabled = false; });
    colorDots.forEach(button => { button.disabled = false; });
    [hueSlider, eraserBtn, clearColorBtn].forEach(control => { if (control) control.disabled = false; });
    if (finishTimeout) {
        clearTimeout(finishTimeout);
        finishTimeout = null;
    }
    if (successModal) successModal.classList.remove('show');
    setupBoardAndTray();
    startTimer();
    if (showMessage) showToast('Đã làm mới trò chơi!');
}

