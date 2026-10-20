// mindmap.js - Quản lý Sơ đồ tư duy
const MindmapManager = {
    collectedKeywords: {}, // key: topic, value: array of keywords
    
    init() {
        const btn = document.querySelector('.mindmap-btn');
        const modal = document.getElementById('mindmap-modal');
        const closeBtn = document.getElementById('close-mindmap');
        
        if (btn && modal && closeBtn) {
            btn.addEventListener('click', () => {
                modal.classList.remove('hidden');
                this.renderMindmap();
                if (typeof SoundManager !== 'undefined') SoundManager.playClick();
            });
            
            const closeModal = () => {
                modal.classList.add('hidden');
                if (typeof GameManager !== 'undefined' && GameManager.isEndGame) {
                    const endgameModal = document.getElementById('endgame-modal');
                    if (endgameModal) endgameModal.classList.remove('hidden');
                }
            };

            closeBtn.addEventListener('click', () => {
                closeModal();
                if (typeof SoundManager !== 'undefined') SoundManager.playClick();
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });

            let resizeRaf = null;
            window.addEventListener('resize', () => {
                if (!modal.classList.contains('hidden')) {
                    if (resizeRaf) cancelAnimationFrame(resizeRaf);
                    resizeRaf = requestAnimationFrame(() => this.drawLines());
                }
            });
        }
    },
    
    addKeyword(topic, keyword) {
        if (!this.collectedKeywords[topic]) {
            this.collectedKeywords[topic] = [];
        }
        if (!this.collectedKeywords[topic].includes(keyword)) {
            this.collectedKeywords[topic].push(keyword);
        }
    },

    showCollectedNotification(keyword) {
        const label = document.querySelector('.mindmap-label');
        if (!label) return;
        label.innerHTML = `
            <span class="collected-badge">
                <i class="fa-solid fa-circle-check"></i> Đã thu thập: <span class="keyword-name">${keyword}</span>
            </span>
        `;
    },

    clearNotification() {
        const label = document.querySelector('.mindmap-label');
        if (label) label.innerHTML = '';
    },
    
    renderMindmap() {
        const container = document.getElementById('mindmap-container');
        if (!container) return;
        
        container.innerHTML = '';
        container.scrollTop = 0;
        
        if (Object.keys(this.collectedKeywords).length === 0) {
            container.innerHTML = '<p style="color: #66fcf1; font-family: var(--font-main), sans-serif; font-weight: 600; font-size:1.05rem; text-align:center;"><i class="fa-solid fa-circle-info"></i> Chưa có dữ liệu thu thập. Hãy quét đúng các từ khóa trong nhiệm vụ!</p>';
            return;
        }
        
        let delayCounter = 0;
        const delayStep = 0.15; // Giây
        
        // Vẽ từng topic (mỗi topic là 1 cụm mindmap)
        for (const topic in this.collectedKeywords) {
            const cluster = document.createElement('div');
            cluster.className = 'mindmap-cluster';
            cluster.style.position = 'relative';
            cluster.style.display = 'flex';
            cluster.style.flexDirection = 'column';
            cluster.style.alignItems = 'center';
            cluster.style.marginBottom = '50px';
            cluster.style.width = '100%';
            
            // Lớp SVG vẽ các đường nhánh liên kết từ topic xuống keyword
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'mindmap-svg');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '1';
            svg.style.overflow = 'visible';
            cluster.appendChild(svg);
            
            const topicNode = document.createElement('div');
            topicNode.className = 'mindmap-node node-topic node-animate';
            topicNode.textContent = topic;
            topicNode.style.animationDelay = `${delayCounter}s`;
            delayCounter += delayStep;
            cluster.appendChild(topicNode);
            
            // Container chứa các từ khóa nhánh
            const keywordsLevel = document.createElement('div');
            keywordsLevel.className = 'mindmap-level';
            keywordsLevel.style.position = 'relative';
            keywordsLevel.style.zIndex = '2';
            
            this.collectedKeywords[topic].forEach(kw => {
                const kwNode = document.createElement('div');
                kwNode.className = 'mindmap-node node-keyword node-animate';
                kwNode.textContent = kw;
                kwNode.style.animationDelay = `${delayCounter}s`;
                keywordsLevel.appendChild(kwNode);
                delayCounter += delayStep;
            });
            
            cluster.appendChild(keywordsLevel);
            container.appendChild(cluster);
        }

        // Vẽ các đường line sau khi DOM hoàn tất layout
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.drawLines();
            });
        });
    },

    drawLines() {
        const clusters = document.querySelectorAll('.mindmap-cluster');
        clusters.forEach(cluster => {
            const svg = cluster.querySelector('.mindmap-svg');
            if (!svg) return;
            svg.innerHTML = '';

            const clusterRect = cluster.getBoundingClientRect();
            const topicNode = cluster.querySelector('.node-topic');
            if (!topicNode) return;
            const topicRect = topicNode.getBoundingClientRect();

            // Điểm bắt đầu: tâm mép dưới của node Topic
            const x1 = topicRect.left + topicRect.width / 2 - clusterRect.left;
            const y1 = topicRect.bottom - clusterRect.top;

            const kwNodes = cluster.querySelectorAll('.node-keyword');
            kwNodes.forEach((kwNode, idx) => {
                const kwRect = kwNode.getBoundingClientRect();
                // Điểm kết thúc: tâm mép trên của node Keyword
                const x2 = kwRect.left + kwRect.width / 2 - clusterRect.left;
                const y2 = kwRect.top - clusterRect.top;

                // Đường cong mượt mà từ Topic xuống Keyword
                const midY = y1 + (y2 - y1) * 0.5;
                const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', d);
                path.setAttribute('class', 'mindmap-branch-line');
                path.style.animationDelay = `${0.1 + idx * 0.1}s`;

                svg.appendChild(path);
            });
        });
    }
};

document.addEventListener("DOMContentLoaded", () => {
    MindmapManager.init();
});
