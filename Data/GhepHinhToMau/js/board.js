/**
 * Quản lý khay, kéo thả, di chuyển mảnh ghép và đổi tab.
 * Chia sẻ trạng thái với state.js; gọi các tiện ích trong coloring.js/ui.js.
 */

function setupBoardAndTray() {
    if (!gameData || !Array.isArray(gameData.parts) || !placedContainer || !puzzleTray) return;

    placedCount = 0;
    totalPartsCount = gameData.parts.length;
    selectedBoardItem = null;
    
    placedContainer.innerHTML = '';
    puzzleTray.innerHTML = '';
    updateScoreDisplay();

    // Xáo trộn bản sao theo Fisher-Yates để giữ nguyên mảng dữ liệu gốc.
    const shuffledParts = [...gameData.parts];
    for (let i = shuffledParts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledParts[i], shuffledParts[j]] = [shuffledParts[j], shuffledParts[i]];
    }

    shuffledParts.forEach(part => {
        const trayItem = document.createElement('div');
        trayItem.classList.add('tray-item');
        trayItem.dataset.id = part.id;
        trayItem.dataset.image = part.image;
        trayItem.dataset.name = part.name;

        const image = document.createElement('img');
        image.src = part.image;
        image.alt = part.name;
        const name = document.createElement('span');
        name.textContent = part.name;
        trayItem.append(image, name);

        trayItem.addEventListener('pointerdown', handleTrayPointerDown);
        puzzleTray.appendChild(trayItem);
    });
}

// ----------------------------------------------------
// 4. KÉO THẢ TỪ KHAY VÀO KHUNG LẮP RÁP
// ----------------------------------------------------
function handleTrayPointerDown(e) {
    if (answerSubmitted) return;
    // Pointer Events dùng chung một luồng kéo thả cho chuột, bút và cảm ứng.
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    draggedElement = e.currentTarget;
    activePointerId = e.pointerId;
    draggedElement.setPointerCapture(activePointerId);

    const rect = draggedElement.getBoundingClientRect();
    touchOffsetX = e.clientX - rect.left;
    touchOffsetY = e.clientY - rect.top;

    cloneElement = draggedElement.cloneNode(true);
    cloneElement.classList.add('dragging');
    
    Object.assign(cloneElement.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: '9999',
        pointerEvents: 'none',
        opacity: '0.85',
        boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
    });

    document.body.appendChild(cloneElement);
    draggedElement.style.opacity = '0.3';

    draggedElement.addEventListener('pointermove', handleTrayPointerMove);
    draggedElement.addEventListener('pointerup', handleTrayPointerUp);
    draggedElement.addEventListener('pointercancel', handleTrayPointerUp);
}

function handleTrayPointerMove(e) {
    if (!cloneElement || e.pointerId !== activePointerId) return;

    const x = e.clientX - touchOffsetX;
    const y = e.clientY - touchOffsetY;
    cloneElement.style.left = `${x}px`;
    cloneElement.style.top = `${y}px`;
}

function handleTrayPointerUp(e) {
    if (e.pointerId !== activePointerId) return;

    if (draggedElement) {
        try { draggedElement.releasePointerCapture(activePointerId); } catch (error) {}
        draggedElement.removeEventListener('pointermove', handleTrayPointerMove);
        draggedElement.removeEventListener('pointerup', handleTrayPointerUp);
        draggedElement.removeEventListener('pointercancel', handleTrayPointerUp);
        draggedElement.style.opacity = '1';
    }

    if (cloneElement) {
        const boardRect = assemblyBoard.getBoundingClientRect();
        const dropX = e.clientX;
        const dropY = e.clientY;

        // Chỉ thêm mảnh vào bảng khi người chơi thả nó bên trong khung.
        const isInsideBoard = (
            dropX >= boardRect.left &&
            dropX <= boardRect.right &&
            dropY >= boardRect.top &&
            dropY <= boardRect.bottom
        );

        if (isInsideBoard && draggedElement) {
            const relativeX = dropX - boardRect.left;
            const relativeY = dropY - boardRect.top;

            createBoardItemCopy(draggedElement, relativeX, relativeY);
            
            // Play drop sound
            if (typeof dropSound !== 'undefined') {
                dropSound.currentTime = 0;
                dropSound.play().catch(e => console.log('Audio play failed', e));
            }
        }

        cloneElement.remove();
        cloneElement = null;
    }

    draggedElement = null;
    activePointerId = null;
}

// ----------------------------------------------------
// 5. TẠO BẢN SAO TRÊN BẢNG LẮP RÁP
// ----------------------------------------------------
// Tạo một mảnh ghép trên bảng sau khi người chơi thả mảnh vào.
function createBoardItemCopy(sourceItem, dropX, dropY) {
    const partId = sourceItem.dataset.id;
    const partImage = sourceItem.dataset.image;
    const partName = sourceItem.dataset.name;

    const boardItem = document.createElement('div');
    boardItem.classList.add('board-placed-item');
    boardItem.dataset.id = partId;
    boardItem.style.visibility = 'hidden';

    const img = document.createElement('img');
    img.alt = partName;
    img.onload = () => {
        if (!boardItem.isConnected) return;

        const scaledWidth = Math.round((img.naturalWidth || 150) * 0.35);
        const scaledHeight = Math.round((img.naturalHeight || 150) * 0.35);

        const boardWidth = assemblyBoard.clientWidth;
        const boardHeight = assemblyBoard.clientHeight;

        boardItem.style.width = `${scaledWidth}px`;
        boardItem.style.height = `${scaledHeight}px`;

        const leftPos = Math.max(0, Math.min(dropX - scaledWidth / 2, boardWidth - scaledWidth));
        const topPos = Math.max(0, Math.min(dropY - scaledHeight / 2, boardHeight - scaledHeight));

        boardItem.style.left = `${leftPos}px`;
        boardItem.style.top = `${topPos}px`;
        boardItem.style.visibility = 'visible';
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        boardItem.addEventListener('pointerdown', (e) => {
            if (answerSubmitted) return;
            if (coloringPanel && coloringPanel.classList.contains('active')) {
                applyColorToPart(boardItem);
                return;
            }

            if (e.button !== undefined && e.button !== 0) return;
            e.stopPropagation();

            isDragging = true;
            boardItem.setPointerCapture(e.pointerId);
            boardItem.style.zIndex = '1000';
            boardItem.style.cursor = 'grabbing';

            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseFloat(boardItem.style.left) || 0;
            initialTop = parseFloat(boardItem.style.top) || 0;
        });

        boardItem.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            // Giới hạn vị trí để mảnh ghép luôn nằm gọn trong bảng.
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            newLeft = Math.max(0, Math.min(newLeft, boardWidth - scaledWidth));
            newTop = Math.max(0, Math.min(newTop, boardHeight - scaledHeight));

            boardItem.style.left = `${newLeft}px`;
            boardItem.style.top = `${newTop}px`;
        });

        const stopDrag = (e) => {
            if (isDragging) {
                isDragging = false;
                boardItem.style.zIndex = '10';
                boardItem.style.cursor = 'grab';
                try { boardItem.releasePointerCapture(e.pointerId); } catch (error) {}
                
                // Play drop sound
                if (typeof dropSound !== 'undefined') {
                    dropSound.currentTime = 0;
                    dropSound.play().catch(err => console.log('Audio play failed', err));
                }
            }
        };

        boardItem.addEventListener('pointerup', stopDrag);
        boardItem.addEventListener('pointercancel', stopDrag);
    };

    img.onerror = () => {
        if (!boardItem.isConnected) return;
        boardItem.remove();
        sourceItem.classList.remove('hidden');
        placedCount = Math.max(0, placedCount - 1);
        updateScoreDisplay();
        showToast(`⚠️ Không tải được ảnh ${partName}`);
    };

    boardItem.appendChild(img);
    placedContainer.appendChild(boardItem);
    img.src = partImage;

    sourceItem.classList.add('hidden');
    placedCount++;

    updateScoreDisplay();
    showToast(`✨ Đã thêm ${partName}`);
}

// ----------------------------------------------------
// 6. XỬ LÝ CHUYỂN TAB
// ----------------------------------------------------
function setupTabEvents() {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTabId = btn.dataset.tab;

            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            taskPanels.forEach(panel => {
                if (panel.id === targetTabId) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
        });
    });
}

// ----------------------------------------------------
// 7. XỬ LÝ BẢNG MÀU & TẨY
// ----------------------------------------------------
