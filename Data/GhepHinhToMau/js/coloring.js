/**
 * Bảng màu, bộ chọn HSV tùy chỉnh, tẩy màu và phủ màu lên ảnh PNG.
 * Đây là module duy nhất quản lý màu hiện tại và mảnh đang được tô.
 */

function setupColoringEvents() {
    colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            if (dot.disabled || (typeof answerSubmitted !== 'undefined' && answerSubmitted)) return;
            colorDots.forEach(d => {
                d.classList.remove('active');
                d.setAttribute('aria-pressed', 'false');
            });
            dot.classList.add('active');
            dot.setAttribute('aria-pressed', 'true');
            if (eraserBtn) {
                eraserBtn.classList.remove('active');
                eraserBtn.setAttribute('aria-pressed', 'false');
            }
            
            isEraserSelected = false;
            selectedColor = dot.dataset.color || null;
            if (selectedColor && customColorPreview) customColorPreview.style.backgroundColor = selectedColor;
            if (selectedColor && customColorValue) customColorValue.value = selectedColor;
            if (selectedBoardItem) applyColorToPart(selectedBoardItem);
        });
    });

    let isPickingCustomColor = false;
    const updateCustomColor = (event) => {
        if (!colorField || !hueSlider) return;
        const rect = colorField.getBoundingClientRect();
        const saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const value = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        const hue = Number(hueSlider.value);
        const color = hsvToHex(hue, saturation, value);

        if (colorPickerHandle) {
            colorPickerHandle.style.left = `${saturation * 100}%`;
            colorPickerHandle.style.top = `${(1 - value) * 100}%`;
        }
        if (customColorPreview) customColorPreview.style.backgroundColor = color;
        if (customColorValue) customColorValue.value = color;
        colorField.setAttribute('aria-valuetext', color);

        isEraserSelected = false;
        selectedColor = color;
        colorDots.forEach(dot => {
            dot.classList.remove('active');
            dot.setAttribute('aria-pressed', 'false');
        });
        if (eraserBtn) {
            eraserBtn.classList.remove('active');
            eraserBtn.setAttribute('aria-pressed', 'false');
        }
        if (selectedBoardItem) applyColorToPart(selectedBoardItem, false);
    };

    if (colorField) {
        colorField.addEventListener('pointerdown', (event) => {
            if (typeof answerSubmitted !== 'undefined' && answerSubmitted) return;
            isPickingCustomColor = true;
            colorField.setPointerCapture(event.pointerId);
            updateCustomColor(event);
        });
        colorField.addEventListener('pointermove', (event) => {
            if (isPickingCustomColor) updateCustomColor(event);
        });
        const stopPicking = () => { isPickingCustomColor = false; };
        colorField.addEventListener('pointerup', stopPicking);
        colorField.addEventListener('pointercancel', stopPicking);
    }

    if (hueSlider) {
        hueSlider.addEventListener('input', () => {
            if (typeof answerSubmitted !== 'undefined' && answerSubmitted) return;
            if (!colorField) return;
            colorField.style.backgroundColor = `hsl(${hueSlider.value} 100% 50%)`;
            const rect = colorField.getBoundingClientRect();
            updateCustomColor({
                clientX: rect.left + rect.width * 0.75,
                clientY: rect.top + rect.height * 0.25
            });
        });
    }

    if (eraserBtn) {
        eraserBtn.addEventListener('click', () => {
            colorDots.forEach(d => {
                d.classList.remove('active');
                d.setAttribute('aria-pressed', 'false');
            });
            eraserBtn.classList.add('active');
            eraserBtn.setAttribute('aria-pressed', 'true');
            isEraserSelected = true;
            selectedColor = null;
            if (selectedBoardItem) applyColorToPart(selectedBoardItem, false);
            showToast('🧹 Đã chọn tẩy màu!');
        });
    }

    if (clearColorBtn) {
        clearColorBtn.addEventListener('click', () => {
            const allPlacedItems = placedContainer.querySelectorAll('.board-placed-item');
            allPlacedItems.forEach(item => {
                item.style.removeProperty('--part-color');
                item.style.removeProperty('--part-mask');
            });
            selectedBoardItem = null;
            showToast('🔄 Đã xóa tất cả màu tô!');
        });
    }
}

function hsvToHex(hue, saturation, value) {
    const chroma = value * saturation;
    const section = hue / 60;
    const secondary = chroma * (1 - Math.abs((section % 2) - 1));
    let red = 0, green = 0, blue = 0;

    if (section < 1) [red, green, blue] = [chroma, secondary, 0];
    else if (section < 2) [red, green, blue] = [secondary, chroma, 0];
    else if (section < 3) [red, green, blue] = [0, chroma, secondary];
    else if (section < 4) [red, green, blue] = [0, secondary, chroma];
    else if (section < 5) [red, green, blue] = [secondary, 0, chroma];
    else [red, green, blue] = [chroma, 0, secondary];

    const offset = value - chroma;
    return `#${[red, green, blue].map(channel =>
        Math.round((channel + offset) * 255).toString(16).padStart(2, '0')
    ).join('')}`;
}

function applyColorToPart(boardItem, notify = true) {
    const img = boardItem.querySelector('img');
    if (!img) return;

    selectedBoardItem = boardItem;

    if (isEraserSelected) {
        boardItem.style.removeProperty('--part-color');
        boardItem.style.removeProperty('--part-mask');
        if (notify) showToast('🧹 Đã xóa màu của bộ phận!');
    } else {
        // Mask theo vùng alpha của ảnh để phủ màu mà vẫn giữ nét vẽ.
        boardItem.style.setProperty('--part-mask', `url("${img.src}")`);
        boardItem.style.setProperty('--part-color', selectedColor || '#ef4444');
        
        // Play color sound
        if (typeof colorSound !== 'undefined') {
            colorSound.currentTime = 0;
            colorSound.play().catch(e => console.log('Audio play failed', e));
        }

        if (notify) showToast('🎨 Đã tô màu cho bộ phận!');
    }
}

// ----------------------------------------------------
// 8. SO SÁNH VỊ TRÍ TỪNG BỘ PHẬN THEO ID
// ----------------------------------------------------
