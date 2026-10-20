// keyword.js - Xử lý từ khóa
const KeywordManager = {
    // 10 vị trí an toàn cố định (Safe Zones) đối xứng và cân đối không gian
    safeZones: [
        // Hàng trên (4 vị trí: Trái ngoài, Trái trong, Phải trong, Phải ngoài)
        { id: 0, minTop: 8,  maxTop: 20, minLeft: 0,  maxLeft: 18 },
        { id: 1, minTop: 8,  maxTop: 20, minLeft: 26, maxLeft: 38 },
        { id: 2, minTop: 8,  maxTop: 20, minLeft: 58, maxLeft: 70 },
        { id: 3, minTop: 8,  maxTop: 20, minLeft: 77, maxLeft: 86 },

        // Hàng giữa (2 vị trí hai bên màn hình - trung tâm dành cho Ra-đa)
        { id: 4, minTop: 36, maxTop: 48, minLeft: 0,  maxLeft: 18 },
        { id: 5, minTop: 36, maxTop: 48, minLeft: 77, maxLeft: 86 },

        // Hàng dưới (4 vị trí: Trái ngoài, Trái trong, Phải trong, Phải ngoài)
        { id: 6, minTop: 66, maxTop: 78, minLeft: 0,  maxLeft: 18 },
        { id: 7, minTop: 66, maxTop: 78, minLeft: 26, maxLeft: 38 },
        { id: 8, minTop: 66, maxTop: 78, minLeft: 58, maxLeft: 70 },
        { id: 9, minTop: 66, maxTop: 78, minLeft: 77, maxLeft: 86 }
    ],

    // Chọn tập vị trí an toàn phân bổ cân đối hoàn hảo giữa Trái/Phải và Trên/Dưới
    selectBalancedZones(count) {
        if (count >= this.safeZones.length) {
            return [...this.safeZones];
        }

        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const removeOne = (arr, item) => {
            const idx = arr.indexOf(item);
            if (idx !== -1) arr.splice(idx, 1);
        };

        const selected = [...this.safeZones];
        const toRemove = this.safeZones.length - count;

        if (toRemove === 1) {
            // Với 9 tinh thể: Bỏ 1 ô bên trong (Top/Bot Inner) để giữ 4 góc và 2 bên giữa
            const innerCandidates = [this.safeZones[1], this.safeZones[2], this.safeZones[7], this.safeZones[8]];
            removeOne(selected, pickRandom(innerCandidates));
        } else if (toRemove === 2) {
            // Với 8 tinh thể: Bỏ 1 ô Trái và 1 ô Phải đối xứng chéo (Mỗi bên đúng 4 tinh thể)
            if (Math.random() < 0.5) {
                removeOne(selected, this.safeZones[1]);
                removeOne(selected, this.safeZones[8]);
            } else {
                removeOne(selected, this.safeZones[2]);
                removeOne(selected, this.safeZones[7]);
            }
        } else if (toRemove === 3) {
            // Với 7 tinh thể: Bỏ 1 ô hàng giữa, 1 ô bên trái và 1 ô bên phải
            // Kết quả luôn đạt: Trên: 3, Giữa: 1, Dưới: 3 | Trái: 3-4, Phải: 4-3
            const dropLeftMid = Math.random() < 0.5;
            if (dropLeftMid) {
                removeOne(selected, this.safeZones[4]); // Bỏ Giữa - Trái
                removeOne(selected, pickRandom([this.safeZones[2], this.safeZones[8]]));
                removeOne(selected, pickRandom([this.safeZones[1], this.safeZones[7]]));
            } else {
                removeOne(selected, this.safeZones[5]); // Bỏ Giữa - Phải
                removeOne(selected, pickRandom([this.safeZones[1], this.safeZones[7]]));
                removeOne(selected, pickRandom([this.safeZones[2], this.safeZones[8]]));
            }
        } else {
            // Dự phòng cho số lượng ít hơn (<= 6)
            while (selected.length > count) {
                const idx = Math.floor(Math.random() * selected.length);
                selected.splice(idx, 1);
            }
        }

        return selected;
    },

    renderKeywords(keywords) {
        if (typeof RadarManager !== 'undefined' && RadarManager.reset) {
            RadarManager.reset();
        }
        const container = document.getElementById('keywords-container');
        if (!container) return;
        
        container.innerHTML = '';

        // Chọn tập safeZones cân đối cho số lượng từ khóa hiện tại, sau đó xáo trộn ngẫu nhiên
        const balancedZones = this.selectBalancedZones(keywords.length);
        const shuffledZones = [...balancedZones].sort(() => 0.5 - Math.random());
        
        keywords.forEach((kw, idx) => {
            const delay = (Math.random() * 2).toFixed(1);
            
            const kwElement = document.createElement('div');
            const randomType = Math.floor(Math.random() * 4) + 1;
            kwElement.className = `keyword floating crystal-${randomType}`;
            kwElement.innerHTML = `${kw.text}`;
            kwElement.style.animationDelay = `${delay}s`;
            
            kwElement.dataset.correct = kw.correct;
            kwElement.dataset.id = kw.Id;

            // Lấy vị trí an toàn đã được tính toán cân đối
            const zone = shuffledZones[idx % shuffledZones.length];
            
            // Đặt tinh thể ở trung tâm safe zone kết hợp độ lệch nhẹ (jitter +/- 1.5%)
            // Đảm bảo không bao giờ chồng chéo và không bị tràn khỏi mép màn hình
            const centerTop = (zone.minTop + zone.maxTop) / 2;
            const centerLeft = (zone.minLeft + zone.maxLeft) / 2;
            const jitterTop = (Math.random() * 3 - 1.5);
            const jitterLeft = (Math.random() * 3 - 1.5);

            const top = centerTop + jitterTop;
            const left = centerLeft + jitterLeft;

            kwElement.style.top = `${top.toFixed(1)}%`;
            kwElement.style.left = `${left.toFixed(1)}%`;
            kwElement.dataset.desktopTop = kwElement.style.top;
            kwElement.dataset.desktopLeft = kwElement.style.left;
            
            container.appendChild(kwElement);
        });

        this.positionKeywords();
    },

    positionKeywords() {
        const keywords = Array.from(document.querySelectorAll('.keyword'));
        if (!keywords.length) return;

        if (window.innerWidth > 600) {
            keywords.forEach(element => {
                element.style.top = element.dataset.desktopTop;
                element.style.left = element.dataset.desktopLeft;
            });
        } else {
            const area = document.querySelector('.game-area');
            if (!area) return;

            const { width, height } = area.getBoundingClientRect();
            const rowCount = Math.ceil(keywords.length / 2);
            keywords.forEach((element, index) => {
                const row = Math.floor(index / 2);
                const isLastSingle = keywords.length % 2 === 1 && row === rowCount - 1;
                const centerX = isLastSingle
                    ? width / 2
                    : width * (index % 2 === 0 ? 0.27 : 0.73);
                const centerY = height * (row + 0.5) / rowCount;
                element.style.left = `${centerX - element.offsetWidth / 2}px`;
                element.style.top = `${centerY - element.offsetHeight / 2}px`;
            });
        }

        if (typeof RadarManager !== 'undefined' && RadarManager.cacheCrystalTargets) {
            RadarManager.cacheGameArea();
            RadarManager.cacheCrystalTargets();
        }
    },

    handleKeywordClick(element) {
        if (typeof GameManager !== 'undefined' && GameManager.isEndGame) return;
        if (element.classList.contains('correct') || element.classList.contains('wrong-flash')) return;

        const isCorrect = element.dataset.correct === 'true';
        
        if (isCorrect) {
            element.classList.remove('scanning');
            element.classList.add('correct');
            
            // Tạo hiệu ứng tinh thể rơi vào ô mindmap (Parabolic arc)
            const btn = document.querySelector('.mindmap-btn');
            if (btn) {
                const btnRect = btn.getBoundingClientRect();
                const elRect = element.getBoundingClientRect();
                
                // Ẩn phần tử gốc đi ngay lập tức để diễn hoạt bằng clone
                element.style.opacity = '0';
                
                // Wrapper chịu trách nhiệm di chuyển ngang (trục X)
                const cloneWrapper = document.createElement('div');
                cloneWrapper.style.position = 'fixed';
                cloneWrapper.style.left = `${elRect.left}px`;
                cloneWrapper.style.top = `${elRect.top}px`;
                cloneWrapper.style.width = `${elRect.width}px`;
                cloneWrapper.style.height = `${elRect.height}px`;
                cloneWrapper.style.zIndex = '9999';
                cloneWrapper.style.transition = 'left 0.8s ease-out'; // Bay ngang nhanh lúc đầu
                
                // Clone chịu trách nhiệm rơi dọc (trục Y) và thu nhỏ
                const clone = element.cloneNode(true);
                clone.style.position = 'absolute';
                clone.style.left = '0';
                clone.style.top = '0';
                clone.style.width = '100%';
                clone.style.height = '100%';
                clone.style.margin = '0';
                clone.style.animation = 'none'; // Tắt hiệu ứng lơ lửng
                clone.style.opacity = '1';
                // ease-in tạo hiệu ứng trọng lực rơi nhanh dần
                clone.style.transition = 'top 0.8s cubic-bezier(0.5, 0, 1, 1), transform 0.8s ease-in, opacity 0.8s linear';
                
                cloneWrapper.appendChild(clone);
                document.body.appendChild(cloneWrapper);
                
                // Bắt đầu diễn hoạt ở frame tiếp theo
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const targetLeft = btnRect.left + btnRect.width / 2 - elRect.width / 2;
                        const targetTop = btnRect.top + btnRect.height / 2 - elRect.height / 2;
                        
                        cloneWrapper.style.left = `${targetLeft}px`;
                        clone.style.top = `${targetTop - elRect.top}px`;
                        clone.style.transform = `scale(0.1) rotate(360deg)`;
                        clone.style.opacity = '0.5';
                    });
                });
                
                setTimeout(() => {
                    cloneWrapper.remove();
                    element.style.display = 'none';
                    if (typeof RadarManager !== 'undefined' && RadarManager.cacheCrystalTargets) {
                        RadarManager.cacheCrystalTargets();
                    }
                }, 800);
            }
        } else {
            element.classList.remove('scanning');
            element.classList.add('wrong-flash');
            setTimeout(() => {
                element.classList.remove('wrong-flash');
            }, 800);
        }
        
        console.log(`Bạn đã chọn: ${element.textContent}, Kết quả: ${isCorrect ? 'ĐÚNG' : 'SAI'}`);
        
        if (typeof GameManager !== 'undefined') {
            GameManager.handleAnswer(element, isCorrect);
        }
    }
};

window.addEventListener('resize', () => {
    if (document.querySelector('.keyword')) {
        KeywordManager.positionKeywords();
    }
});
