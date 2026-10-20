// radar.js - Xử lý kéo thả Radar và quét tinh thể tối ưu hóa cao (60fps, Zero Layout Thrashing)

const RadarManager = {
    radarElement: null,
    gameArea: null,
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
    rafId: null,
    lastClientX: 0,
    lastClientY: 0,

    // Bộ nhớ đệm tọa độ để tránh Layout Thrashing (Reflow liên tục)
    gameAreaRect: null,
    cachedTargets: [],
    activeScanningElement: null,

    // Cấu hình chùm sáng hình nón theo đúng tham số yêu cầu
    beamConfig: {
        topWidth: 78,       // Độ rộng chùm sáng ở đầu trên (px) khớp với emitter joint 78px
        bottomWidth: 230,   // Độ rộng chùm sáng ở đầu dưới (px)
        beamHeight: 140,    // Chiều dài chùm sáng (px)
        beamStartY: 28      // Vị trí bắt đầu chùm sáng tính từ tâm Radar (px) (y=78 - y=50)
    },

    // Quản lý trạng thái quét và khoảng thời gian chờ (300-500ms)
    currentScannedTarget: null,
    scanTimer: null,
    scanDuration: 500,      // Thời gian quét 500ms trước khi kiểm tra đáp án
    lastCheckedTarget: null,

    init() {
        this.radarElement = document.querySelector('.radar-center');
        this.gameArea = document.querySelector('.game-area');
        
        if (!this.radarElement || !this.gameArea) return;

        this.radarElement.style.cursor = 'grab';
        this.radarElement.style.touchAction = 'none';

        this.radarElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.radarElement.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.radarElement.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.radarElement.addEventListener('pointercancel', this.onPointerUp.bind(this));

        window.addEventListener('resize', () => {
            this.cacheGameArea();
            this.cacheCrystalTargets();
        });
    },

    cacheGameArea() {
        if (this.gameArea) {
            this.gameAreaRect = this.gameArea.getBoundingClientRect();
        }
    },

    cacheCrystalTargets() {
        const keywords = document.querySelectorAll('.keyword:not(.correct):not(.wrong-flash)');
        this.cachedTargets = [];
        keywords.forEach(kw => {
            const rect = kw.getBoundingClientRect();
            this.cachedTargets.push({
                element: kw,
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2
            });
        });
    },

    onPointerDown(e) {
        if (typeof GameManager !== 'undefined' && GameManager.isEndGame) return;
        this.isDragging = true;
        this.radarElement.style.cursor = 'grabbing';
        this.radarElement.setPointerCapture(e.pointerId);
        if (typeof SoundManager !== 'undefined') SoundManager.startRadar();

        // Cập nhật lại khung gameArea và vị trí tinh thể khi bắt đầu chạm/kéo
        this.cacheGameArea();
        this.cacheCrystalTargets();

        const rect = this.radarElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        this.offsetX = e.clientX - centerX;
        this.offsetY = e.clientY - centerY;
    },

    onPointerMove(e) {
        if (!this.isDragging) return;
        
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;

        if (this.rafId) return;

        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.updateRadarPosition();
        });
    },

    updateRadarPosition() {
        if (!this.isDragging || !this.gameAreaRect) return;

        const newCenterX = this.lastClientX - this.offsetX;
        const newCenterY = this.lastClientY - this.offsetY;
        
        const paddingX = 20;
        const paddingY = 20;
        const localX = Math.max(paddingX, Math.min(newCenterX - this.gameAreaRect.left, this.gameAreaRect.width - paddingX));
        const localY = Math.max(paddingY, Math.min(newCenterY - this.gameAreaRect.top, this.gameAreaRect.height - paddingY));
        
        // Cập nhật vị trí Radar
        this.radarElement.style.left = `${localX}px`;
        this.radarElement.style.top = `${localY}px`;

        // Tọa độ tâm radar trong client coordinates mà không cần gọi getBoundingClientRect
        const radarCenterX = this.gameAreaRect.left + localX;
        const radarCenterY = this.gameAreaRect.top + localY;
        const beamTop = radarCenterY + this.beamConfig.beamStartY;

        // Kiểm tra tinh thể trong chùm sáng bằng dữ liệu bộ nhớ đệm
        this.checkRadarScanZone(radarCenterX, radarCenterY, beamTop);
    },

    isCrystalInCone(targetX, targetY, radarCenterX, beamTop) {
        // y: khoảng cách dọc từ đỉnh chùm sáng đến tâm tinh thể
        const y = targetY - beamTop;

        // x: khoảng cách ngang từ tâm Radar đến tâm tinh thể
        const x = Math.abs(targetX - radarCenterX);

        // Kiểm tra phạm vi dọc (với vùng đệm 15px để phản hồi mượt mà)
        const verticalPadding = 15;
        if (y >= -verticalPadding && y <= this.beamConfig.beamHeight + verticalPadding) {
            const clampedY = Math.max(0, Math.min(y, this.beamConfig.beamHeight));
            
            // Độ rộng chùm sáng tại khoảng cách dọc y:
            const currentWidth = this.beamConfig.topWidth + 
                (clampedY / this.beamConfig.beamHeight) * (this.beamConfig.bottomWidth - this.beamConfig.topWidth);

            // Dung sai bán kính tinh thể (25px)
            const crystalTolerance = 25;
            if (x <= (currentWidth / 2) + crystalTolerance) {
                return {
                    inside: true,
                    x,
                    y,
                    distance: Math.hypot(x, y)
                };
            }
        }

        return { inside: false };
    },

    checkRadarScanZone(radarCenterX, radarCenterY, beamTop) {
        if (!this.radarElement) return;

        let closestTarget = null;
        let minDistance = Infinity;

        // Duyệt nhanh qua các mục tiêu đã cache trong bộ nhớ
        for (let i = 0; i < this.cachedTargets.length; i++) {
            const item = this.cachedTargets[i];
            const el = item.element;
            
            // Bỏ qua nếu đã biến mất khỏi DOM hoặc đã hoàn thành / đang flash sai
            if (!el.isConnected || el.classList.contains('correct') || el.classList.contains('wrong-flash')) {
                continue;
            }

            const result = this.isCrystalInCone(item.centerX, item.centerY, radarCenterX, beamTop);
            if (result.inside && result.distance < minDistance) {
                minDistance = result.distance;
                closestTarget = el;
            }
        }

        // Tối ưu DOM: Chỉ thay đổi class .scanning khi mục tiêu thực sự thay đổi
        if (closestTarget !== this.activeScanningElement) {
            if (this.activeScanningElement) {
                this.activeScanningElement.classList.remove('scanning');
            }
            if (closestTarget) {
                closestTarget.classList.add('scanning');
            }
            this.activeScanningElement = closestTarget;
        }

        // Nếu rời khỏi mục tiêu đã kiểm tra thì cho phép kiểm tra lại
        if (closestTarget !== this.lastCheckedTarget) {
            this.lastCheckedTarget = null;
        }

        if (closestTarget) {
            // Khi phát hiện mục tiêu mới nằm trong chùm sáng
            if (closestTarget !== this.currentScannedTarget && closestTarget !== this.lastCheckedTarget) {
                this.clearScanTimer();
                this.currentScannedTarget = closestTarget;

                // Sau khoảng 300–500 ms (chọn 500ms), game kiểm tra đáp án một lần
                this.scanTimer = setTimeout(() => {
                    this.triggerAnswerCheck(closestTarget);
                }, this.scanDuration);
            }
        } else {
            // Rời khỏi vùng nón quét
            this.clearScanTimer();
            this.currentScannedTarget = null;
        }
    },

    triggerAnswerCheck(target) {
        if (typeof GameManager !== 'undefined' && GameManager.isEndGame) {
            this.clearScanTimer();
            this.currentScannedTarget = null;
            return;
        }
        if (!target || target.classList.contains('correct') || target.classList.contains('wrong-flash')) {
            this.clearScanTimer();
            this.currentScannedTarget = null;
            return;
        }

        this.lastCheckedTarget = target;
        this.clearScanTimer();
        this.currentScannedTarget = null;

        // Kích hoạt kiểm tra đáp án: từ đúng bay vào Mindmap, từ sai nhấp nháy đỏ và thử lại
        if (typeof KeywordManager !== 'undefined') {
            KeywordManager.handleKeywordClick(target);
        }

        // Sau 1.2s, cho phép quét lại nếu người chơi vẫn giữ radar tại khối này
        setTimeout(() => {
            if (this.lastCheckedTarget === target) {
                this.lastCheckedTarget = null;
                if (this.isDragging) {
                    this.updateRadarPosition();
                }
            }
        }, 1200);
    },

    clearScanTimer() {
        if (this.scanTimer) {
            clearTimeout(this.scanTimer);
            this.scanTimer = null;
        }
    },

    reset() {
        this.clearScanTimer();
        this.currentScannedTarget = null;
        this.lastCheckedTarget = null;
        if (this.activeScanningElement) {
            this.activeScanningElement.classList.remove('scanning');
            this.activeScanningElement = null;
        }
        document.querySelectorAll('.keyword.scanning').forEach(kw => kw.classList.remove('scanning'));
        this.cacheGameArea();
        this.cacheCrystalTargets();
    },

    onPointerUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.radarElement.style.cursor = 'grab';
        
        try {
            this.radarElement.releasePointerCapture(e.pointerId);
        } catch (_) {}

        if (typeof SoundManager !== 'undefined') SoundManager.stopRadar();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    RadarManager.init();
});
