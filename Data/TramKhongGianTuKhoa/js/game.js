// game.js - Logic chính của trò chơi (Điều phối)
const GameManager = {
    gameData: null,
    currentQuestionIndex: 0,
    score: 0,
    lives: 3,
    correctKeywordsRemaining: 0,
    hintTimer: null,
    wrongAttemptsInQuestion: 0,
    isEndGame: false,

    // Chuẩn hóa chuỗi tiếng Việt: chuyển thành chữ thường không dấu
    removeVietnameseTones(str) {
        if (!str) return '';
        str = str.toLowerCase().trim();
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
        str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
        str = str.replace(/đ/g, 'd');
        str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return str.replace(/\s+/g, ' ');
    },
    
    async init() {
        try {
            const response = await fetch('data/data.json');
            this.gameData = await response.json();
            
            QuestionManager.setQuestions(this.gameData.questions, 3);
            this.currentQuestionIndex = 0;
            this.score = 0;
            this.lives = 3;
            this.isEndGame = false;
            
            this.updateScoreUI();
            this.updateLivesUI();
            this.initStarField();
            
            this.playCurrentQuestion();
            this.initSearchBox();
            
            // Nút Chơi Lại ở top bar và màn endgame
            const restartBtn = document.getElementById('endgame-restart-btn');
            const topResetBtn = document.getElementById('reset-btn');
            const handleRestart = () => {
                if (typeof SoundManager !== 'undefined') SoundManager.playClick();
                this.restartGame();
            };
            if (restartBtn) restartBtn.addEventListener('click', handleRestart);
            if (topResetBtn) topResetBtn.addEventListener('click', handleRestart);

            // Nút Xem Mindmap ở màn endgame
            const endgameMindmapBtn = document.getElementById('endgame-mindmap-btn');
            if (endgameMindmapBtn) {
                endgameMindmapBtn.addEventListener('click', () => {
                    if (typeof SoundManager !== 'undefined') SoundManager.playClick();
                    const endgameModal = document.getElementById('endgame-modal');
                    if (endgameModal) endgameModal.classList.add('hidden');
                    
                    const mindmapModal = document.getElementById('mindmap-modal');
                    if (mindmapModal) {
                        mindmapModal.classList.remove('hidden');
                        if (typeof MindmapManager !== 'undefined') {
                            MindmapManager.renderMindmap();
                        }
                    }
                });
            }
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu game:", error);
        }
    },

    updateScoreUI() {
        const scoreText = document.getElementById('score-text');
        if (scoreText) scoreText.textContent = `${this.score} XP`;
    },

    updateLivesUI() {
        const livesContainer = document.getElementById('lives-container');
        if (livesContainer) {
            livesContainer.innerHTML = '';
            for (let i = 0; i < this.lives; i++) {
                livesContainer.innerHTML += '<i class="fa-solid fa-heart"></i> ';
            }
            for (let i = this.lives; i < 3; i++) {
                livesContainer.innerHTML += '<i class="fa-regular fa-heart"></i> '; 
            }
        }
    },

    initStarField() {
        const starField = document.getElementById('stars-field');
        if (!starField) return;
        starField.innerHTML = '';
        
        const starCount = 45;
        const colors = ['white', 'white', 'white', 'cyan', 'gold', 'purple'];
        
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() < 0.7 ? (Math.random() * 1.5 + 1.2) : (Math.random() * 2 + 2.4);
            const duration = (Math.random() * 2.5 + 1.5).toFixed(2);
            const delay = (Math.random() * 3).toFixed(2);
            
            star.className = `star-dot ${color}`;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.left = `${(Math.random() * 100).toFixed(2)}%`;
            star.style.top = `${(Math.random() * 100).toFixed(2)}%`;
            star.style.setProperty('--duration', `${duration}s`);
            star.style.animationDelay = `${delay}s`;
            
            starField.appendChild(star);
        }

        // Tạo 2 vệt sao băng thi thoảng lướt ngang qua vũ trụ
        for (let s = 1; s <= 2; s++) {
            const shooter = document.createElement('div');
            shooter.className = 'shooting-star';
            shooter.style.top = `${Math.random() * 40}%`;
            shooter.style.left = `${45 + Math.random() * 50}%`;
            shooter.style.animationDelay = `${s * 4.5}s`;
            starField.appendChild(shooter);
        }
    },
    
    initSearchBox() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;

        searchInput.addEventListener('keydown', (e) => {
            if (this.isEndGame) return;
            if (e.key === 'Enter') {
                const text = searchInput.value.trim();
                if (text) {
                    this.handleSearch(text);
                    searchInput.value = '';
                }
            }
        });
    },

    handleSearch(text) {
        if (this.isEndGame) return;
        const searchRaw = text.trim();
        if (!searchRaw) return;

        const searchUpper = searchRaw.toUpperCase();
        const searchNoTone = this.removeVietnameseTones(searchRaw);
        const activeKeywords = Array.from(document.querySelectorAll('.keyword:not(.correct):not(.wrong-flash)'));
        
        if (activeKeywords.length === 0) return;

        // 1. Khớp từ chính xác 100% (có dấu)
        for (let kw of activeKeywords) {
            const kwText = kw.textContent.trim().toUpperCase();
            if (kwText === searchUpper) {
                KeywordManager.handleKeywordClick(kw);
                return;
            }
        }
        
        // 2. Khớp từ gõ không dấu (ví dụ: gõ "chay" vẫn khớp "Chạy", "di" vẫn khớp "Đi")
        const noToneMatches = activeKeywords.filter(kw => 
            this.removeVietnameseTones(kw.textContent) === searchNoTone
        );

        if (noToneMatches.length > 0) {
            // Ưu tiên từ đúng nếu có trùng lặp không dấu
            const matchedKw = noToneMatches.find(kw => kw.dataset.correct === 'true') || noToneMatches[0];
            console.log(`[Tìm kiếm không dấu] Khớp từ "${searchRaw}" -> "${matchedKw.textContent}"`);
            KeywordManager.handleKeywordClick(matchedKw);
            return;
        }
        
        // Không tìm thấy từ phù hợp
        this.handleAnswer(null, false);
    },

    playCurrentQuestion() {
        if (this.hintTimer) clearTimeout(this.hintTimer);
        this.wrongAttemptsInQuestion = 0;
        
        if (typeof SoundManager !== 'undefined') SoundManager.stopSpeech();

        if (typeof MindmapManager !== 'undefined' && MindmapManager.clearNotification) {
            MindmapManager.clearNotification();
        }
        
        const qData = QuestionManager.loadQuestion(this.currentQuestionIndex);
        if (qData) {
            this.correctKeywordsRemaining = qData.keywords.filter(k => k.correct).length;
            
            // Tự động kích hoạt gợi ý text nếu sau 10 giây học sinh chưa tìm thấy
            this.hintTimer = setTimeout(() => {
                this.showHint(qData);
            }, 10000);
        } else {
            console.log("Hoàn thành tất cả câu hỏi!");
            this.showEndGame(true);
        }
    },
    
    showHint(qData) {
        // Hiển thị gợi ý dạng văn bản trực quan để học sinh tự xem và đọc
        const hintText = qData.hint && qData.hint.text ? qData.hint.text : "Hãy chú ý, AI đã thu hẹp phạm vi quét cho bạn!";
        const promptEl = document.querySelector('.prompt-text');
        if (promptEl) {
            promptEl.innerHTML = `"${qData.question}"<div class="hint-badge" style="color: #66fcf1; font-size: 0.95rem; margin-top: 6px; font-weight: normal;"><i class="fa-solid fa-lightbulb" style="color: #f6cd61;"></i> <b>Gợi ý AI:</b> ${hintText}</div>`;
        }

        if (typeof KeywordManager !== 'undefined' && KeywordManager.positionKeywords) {
            KeywordManager.positionKeywords();
        }

        // Đọc to câu gợi ý bằng giọng AI tiếng Việt giúp bé định hướng
        if (typeof SoundManager !== 'undefined') {
            SoundManager.speak(`Gợi ý: ${hintText}`);
        }
        
        // Thu hẹp phạm vi quét của Radar xuống còn 3 khối tinh thể gần nhất
        const radarElement = document.querySelector('.radar-center');
        const radarRect = radarElement ? radarElement.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight * 0.8, width: 0, height: 0 };
        const radarCenterX = radarRect.left + radarRect.width / 2;
        const radarCenterY = radarRect.top + radarRect.height / 2;
        
        const activeKeywords = Array.from(document.querySelectorAll('.keyword:not(.correct):not(.wrong-flash)'));
        if (activeKeywords.length === 0) return;

        // Tính khoảng cách Euclidean từ tâm Radar tới từng khối tinh thể
        const withDistances = activeKeywords.map(el => {
            const rect = el.getBoundingClientRect();
            const elX = rect.left + rect.width / 2;
            const elY = rect.top + rect.height / 2;
            const dist = Math.hypot(elX - radarCenterX, elY - radarCenterY);
            return {
                element: el,
                dist: dist,
                isCorrect: el.dataset.correct === 'true'
            };
        });

        // Sắp xếp theo thứ tự khoảng cách tăng dần
        withDistances.sort((a, b) => a.dist - b.dist);

        // Đảm bảo 3 khối tinh thể được giữ lại có ít nhất 1 khối đáp án đúng
        const chosenElements = new Set();
        const firstCorrect = withDistances.find(item => item.isCorrect);
        
        if (firstCorrect) {
            chosenElements.add(firstCorrect.element);
            const others = withDistances.filter(item => item.element !== firstCorrect.element).slice(0, 2);
            others.forEach(item => chosenElements.add(item.element));
        } else {
            withDistances.slice(0, 3).forEach(item => chosenElements.add(item.element));
        }

        // Làm mờ các khối tinh thể nằm ngoài phạm vi 3 khối gần nhất
        activeKeywords.forEach(el => {
            if (!chosenElements.has(el)) {
                el.style.transition = 'opacity 1s ease';
                el.style.opacity = '0.3';
                el.style.pointerEvents = 'none';
            } else {
                el.style.transition = 'filter 0.5s ease, transform 0.5s ease';
                el.style.filter = 'drop-shadow(0 0 15px #66fcf1) brightness(1.3)';
            }
        });

        // Thông báo trực quan trên Radar
        if (radarElement) {
            radarElement.style.filter = 'drop-shadow(0 0 25px #66fcf1) brightness(1.4)';
            setTimeout(() => {
                radarElement.style.filter = '';
            }, 3000);
        }
    },

    handleAnswer(element, isCorrect) {
        if (this.isEndGame) return;
        if (isCorrect) {
            if (this.hintTimer) clearTimeout(this.hintTimer);
            if (typeof SoundManager !== 'undefined') {
                SoundManager.stopSpeech();
                SoundManager.playCorrect();
            }
            
            // Thêm vào sơ đồ tư duy (Mindmap)
            const qData = QuestionManager.currentQuestions[this.currentQuestionIndex];
            const keywordText = element ? element.textContent.trim() : '';
            if (typeof MindmapManager !== 'undefined' && element) {
                MindmapManager.addKeyword(qData.topic, keywordText);
            }
            
            this.score += this.gameData.settings.scorePerCorrect || 10;
            this.updateScoreUI();
            this.correctKeywordsRemaining--;
            
            // Cập nhật Mindmap UI (sau khi tinh thể bay đến nơi)
            setTimeout(() => {
                const mindmapBtn = document.querySelector('.mindmap-btn');
                if (mindmapBtn) {
                    mindmapBtn.classList.add('absorb-effect');
                    setTimeout(() => {
                        mindmapBtn.classList.remove('absorb-effect');
                    }, 600);
                }
                if (typeof MindmapManager !== 'undefined' && keywordText) {
                    MindmapManager.showCollectedNotification(keywordText);
                }
            }, 800); // 800ms khi tinh thể bay vào ô mindmap
            
            if (this.correctKeywordsRemaining <= 0) {
                if (typeof SoundManager !== 'undefined') SoundManager.playLevelComplete();
                setTimeout(() => {
                    this.currentQuestionIndex++;
                    this.playCurrentQuestion();
                }, 2000); // Chờ animation hoàn tất trước khi qua màn tiếp theo
            }
        } else {
            if (typeof SoundManager !== 'undefined') SoundManager.playWrong();
            this.lives--;
            this.updateLivesUI();
            
            this.wrongAttemptsInQuestion++;
            
            // Gợi ý ngay khi trả lời sai lần đầu trong câu hỏi
            if (this.wrongAttemptsInQuestion === 1) {
                if (this.hintTimer) clearTimeout(this.hintTimer);
                const qData = QuestionManager.currentQuestions[this.currentQuestionIndex];
                this.showHint(qData);
            }
            
            if (this.lives <= 0) {
                console.log("Game Over!");
                setTimeout(() => {
                    this.showEndGame(false);
                }, 600);
            }
        }
    },

    showEndGame(isVictory) {
        this.isEndGame = true;
        if (this.hintTimer) clearTimeout(this.hintTimer);
        if (typeof SoundManager !== 'undefined') SoundManager.stopSpeech();

        // Khóa và xóa focus ô tìm kiếm
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.disabled = true;
            searchInput.blur();
            searchInput.value = '';
        }

        if (typeof RadarManager !== 'undefined' && RadarManager.reset) {
            RadarManager.reset();
        }

        const modal = document.getElementById('endgame-modal');
        if (!modal) return;

        const title = document.getElementById('endgame-title');
        const subtitle = document.getElementById('endgame-subtitle');
        const starsContainer = document.getElementById('endgame-stars');
        const scoreEl = document.getElementById('endgame-score');
        const livesEl = document.getElementById('endgame-lives');
        const keywordsEl = document.getElementById('endgame-keywords');
        const mindmapBtn = document.getElementById('endgame-mindmap-btn');

        // Tính tổng số từ khóa đã thu thập trong Mindmap
        let totalKeywords = 0;
        if (typeof MindmapManager !== 'undefined' && MindmapManager.collectedKeywords) {
            for (const topic in MindmapManager.collectedKeywords) {
                totalKeywords += MindmapManager.collectedKeywords[topic].length;
            }
        }

        if (scoreEl) scoreEl.textContent = `${this.score} XP`;
        if (livesEl) livesEl.textContent = `${Math.max(0, this.lives)} / 3`;
        if (keywordsEl) keywordsEl.textContent = totalKeywords;

        if (isVictory) {
            if (title) {
                title.className = 'modal-title endgame-title';
                title.textContent = 'NHIỆM VỤ HOÀN THÀNH!';
            }
            if (subtitle) {
                subtitle.textContent = 'Chúc mừng Chỉ Huy! Bạn đã giải mã xuất sắc toàn bộ Trạm Không Gian Từ Khóa!';
            }

            // Đánh giá số sao đạt được theo số lượt tim còn lại
            if (starsContainer) {
                starsContainer.style.display = 'flex';
                let starsHtml = '';
                for (let i = 1; i <= 3; i++) {
                    if (i <= this.lives) {
                        starsHtml += '<i class="fa-solid fa-star star-filled"></i>';
                    } else {
                        starsHtml += '<i class="fa-solid fa-star"></i>';
                    }
                }
                starsContainer.innerHTML = starsHtml;
            }

            if (mindmapBtn) mindmapBtn.style.display = 'flex';
            if (typeof SoundManager !== 'undefined') SoundManager.playFinish();
        } else {
            // Thất bại (Game Over)
            if (title) {
                title.className = 'modal-title endgame-title defeat';
                title.textContent = 'HẾT NĂNG LƯỢNG!';
            }
            if (subtitle) {
                subtitle.textContent = 'Bạn đã dùng hết 3 lượt thử. Hãy khởi động lại trạm radar để tiếp tục thử thách nhé!';
            }

            if (starsContainer) {
                starsContainer.innerHTML = '<span style="color:#ff3b3b; font-family: var(--font-main), sans-serif; font-size:1.1rem; font-weight: 800; letter-spacing:1px;"> GAME OVER</span>';
            }

            if (mindmapBtn) {
                mindmapBtn.style.display = totalKeywords > 0 ? 'flex' : 'none';
            }
            if (typeof SoundManager !== 'undefined') SoundManager.playWrong();
        }

        modal.classList.remove('hidden');
    },

    restartGame() {
        this.isEndGame = false;
        if (typeof SoundManager !== 'undefined') SoundManager.stopSpeech();

        // Mở khóa lại ô tìm kiếm
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.disabled = false;
            searchInput.value = '';
        }

        const endgameModal = document.getElementById('endgame-modal');
        if (endgameModal) endgameModal.classList.add('hidden');

        const mindmapModal = document.getElementById('mindmap-modal');
        if (mindmapModal) mindmapModal.classList.add('hidden');

        this.currentQuestionIndex = 0;
        this.score = 0;
        this.lives = 3;
        this.wrongAttemptsInQuestion = 0;

        if (typeof MindmapManager !== 'undefined') {
            MindmapManager.collectedKeywords = {};
            MindmapManager.clearNotification();
        }

        if (typeof RadarManager !== 'undefined' && RadarManager.reset) {
            RadarManager.reset();
        }

        // Đặt lại radar về giữa màn hình
        const radarElement = document.querySelector('.radar-center');
        if (radarElement) {
            radarElement.style.left = '50%';
            radarElement.style.top = '50%';
        }

        this.updateScoreUI();
        this.updateLivesUI();

        // Xáo trộn và nạp lại câu hỏi
        if (this.gameData && this.gameData.questions) {
            QuestionManager.setQuestions(this.gameData.questions, 3);
        }

        this.playCurrentQuestion();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    GameManager.init();
});
