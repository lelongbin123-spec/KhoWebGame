/**
 * So sánh vị trí, ID và màu giữa hình mẫu với bài lắp của người chơi.
 * Vẽ hai nhóm lên canvas chuẩn hóa trước khi đánh giá đáp án.
 */

function comparePartPositions(maxDeviationPercent = 5) {
    const referenceItems = [...referencePartsContainer.querySelectorAll('.reference-part')];
    const placedItems = [...placedContainer.querySelectorAll('.board-placed-item')];
    const imagesReady = referenceItems.every(item => {
        const image = item instanceof HTMLImageElement ? item : item.querySelector('img');
        return image?.complete && image.naturalWidth > 0;
    })
        && placedItems.every(item => {
            const image = item instanceof HTMLImageElement ? item : item.querySelector('img');
            return image?.complete && image.naturalWidth > 0;
        });
    if (referenceItems.length !== totalPartsCount || placedItems.length !== totalPartsCount || !imagesReady) {
        console.warn('[Check đáp án] Chưa thể dựng đủ hai canvas:', {
            expectedParts: totalPartsCount,
            referenceParts: referenceItems.length,
            placedParts: placedItems.length,
            imagesReady
        });
        return {
            isCorrect: false,
            deviationPercent: '100.00',
            colorDeviationPercent: '100.00',
            combinedDeviationPercent: '200.00',
            idsMatch: false,
            positionsMatchById: false
        };
    }

    // Tính khung bao riêng cho mỗi nhóm để phần trống bên ngoài không làm
    // thay đổi tọa độ chuẩn hóa dùng cho phép so sánh.
    const getBounds = (items) => {
        const rects = items.map(item => item.getBoundingClientRect());
        const left = Math.min(...rects.map(rect => rect.left));
        const top = Math.min(...rects.map(rect => rect.top));
        const right = Math.max(...rects.map(rect => rect.right));
        const bottom = Math.max(...rects.map(rect => rect.bottom));
        return { left, top, width: right - left, height: bottom - top };
    };
    const referenceBounds = getBounds(referenceItems);
    const placedBounds = getBounds(placedItems);
    const referenceCanvas = document.createElement('canvas');
    const placedCanvas = document.createElement('canvas');
    for (const canvas of [referenceCanvas, placedCanvas]) {
        canvas.width = referenceLayout.width;
        canvas.height = referenceLayout.height;
    }

    // Vẽ hai nhóm lên canvas cùng kích thước, lưu tọa độ góc trên trái của
    // từng mảnh theo ID để đối chiếu trực tiếp.
    const drawGroupToCanvas = (items, bounds, canvas, isReference) => {
        const ctx = canvas.getContext('2d');
        const positions = new Map();
        const tintedCanvas = isReference ? document.createElement('canvas') : null;
        const tintedContext = tintedCanvas?.getContext('2d');
        for (const item of items) {
            const image = item instanceof HTMLImageElement ? item : item.querySelector('img');
            const id = item.dataset.id;
            const rect = item.getBoundingClientRect();
            const x = (rect.left - bounds.left) / bounds.width * canvas.width;
            const y = (rect.top - bounds.top) / bounds.height * canvas.height;
            const width = rect.width / bounds.width * canvas.width;
            const height = rect.height / bounds.height * canvas.height;
            positions.set(id, { x, y });
            if (image?.complete && image.naturalWidth) {
                if (isReference && item.dataset.color) {
                    // Dùng lại canvas phụ thay vì tạo mới cho từng bộ phận.
                    tintedCanvas.width = Math.max(1, Math.ceil(width));
                    tintedCanvas.height = Math.max(1, Math.ceil(height));
                    tintedContext.drawImage(image, 0, 0, tintedCanvas.width, tintedCanvas.height);
                    // Mô phỏng CSS multiply và giữ nguyên các pixel trong suốt.
                    tintedContext.globalCompositeOperation = 'source-atop';
                    tintedContext.fillStyle = item.dataset.color;
                    tintedContext.fillRect(0, 0, tintedCanvas.width, tintedCanvas.height);
                    tintedContext.globalCompositeOperation = 'source-over';
                    ctx.drawImage(tintedCanvas, x, y, width, height);
                } else {
                    ctx.drawImage(image, x, y, width, height);
                }
            }
        }
        return positions;
    };

    const referencePositions = drawGroupToCanvas(
        referenceItems, referenceBounds, referenceCanvas, true
    );
    const placedPositions = drawGroupToCanvas(
        placedItems, placedBounds, placedCanvas, false
    );
    const duplicateIds = new Set();
    const idCounts = new Map();
    // Từ chối ID bị lặp hoặc không tồn tại vì chúng làm sai phép so sánh.
    for (const item of placedItems) {
        idCounts.set(item.dataset.id, (idCounts.get(item.dataset.id) || 0) + 1);
    }
    for (const [id, count] of idCounts) if (count > 1) duplicateIds.add(id);

    // Chuẩn hóa độ lệch vị trí theo đường chéo canvas để lấy phần trăm.
    const canvasDiagonal = Math.hypot(referenceCanvas.width, referenceCanvas.height);
    // Tìm ID mẫu gần tọa độ thực tế nhất để phát hiện hai bộ phận, như trái
    // và phải, bị đổi chỗ dù cả sáu ID vẫn có mặt.
    const nearestReferenceIdFor = (position) => {
        let nearestId = null;
        let nearestDistance = Infinity;
        for (const [id, referencePosition] of referencePositions) {
            const distance = Math.hypot(position.x - referencePosition.x, position.y - referencePosition.y);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestId = id;
            }
        }
        return nearestId;
    };
    const referenceItemsById = new Map(referenceItems.map(item => [item.dataset.id, item]));
    const placedItemsById = new Map(placedItems.map(item => [item.dataset.id, item]));
    // Chuyển mã màu dạng hex thành ba kênh RGB để tính độ lệch màu.
    const colorToRgb = (color) => {
        const hex = String(color || '').trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
        if (!hex) return null;
        const fullHex = hex.length === 3 ? [...hex].map(value => value + value).join('') : hex;
        return [0, 2, 4].map(index => parseInt(fullHex.slice(index, index + 2), 16));
    };
    // Tính khoảng cách màu Euclid và chuẩn hóa theo khoảng cách RGB lớn nhất.
    const colorDeviationFor = (referenceColor, placedColor) => {
        const referenceRgb = colorToRgb(referenceColor);
        const placedRgb = colorToRgb(placedColor);
        if (!referenceRgb || !placedRgb) return 100;
        const distance = Math.hypot(...referenceRgb.map((value, index) => value - placedRgb[index]));
        return distance / Math.hypot(255, 255, 255) * 100;
    };
    // Tạo một dòng thông tin cho mỗi bộ phận mẫu và ghép theo đúng ID.
    const rows = referenceLayout.parts.map(target => {
        const expected = referencePositions.get(target.id);
        const actual = placedPositions.get(target.id);
        const referenceItem = referenceItemsById.get(target.id);
        const placedItem = placedItemsById.get(target.id);
        const referenceColor = referenceItem?.dataset.color || 'missing';
        const placedColor = placedItem?.style.getPropertyValue('--part-color').trim() || 'none';
        const colorDeviationPercent = colorDeviationFor(referenceColor, placedColor);
        if (!expected || !actual) {
            return {
                id: target.id,
                id_match: false,
                reference_x: expected ? Number(expected.x.toFixed(1)) : 'missing',
                reference_y: expected ? Number(expected.y.toFixed(1)) : 'missing',
                placed_x: actual ? Number(actual.x.toFixed(1)) : 'missing',
                placed_y: actual ? Number(actual.y.toFixed(1)) : 'missing',
                nearest_reference_id: actual ? nearestReferenceIdFor(actual) : 'missing',
                position_id_match: false,
                reference_color: referenceColor,
                placed_color: placedColor,
                color_deviation_percent: `${colorDeviationPercent.toFixed(2)}%`,
                delta_x: '—',
                delta_y: '—',
                deviation_percent: '100.00%'
            };
        }

        const deltaX = actual.x - expected.x;
        const deltaY = actual.y - expected.y;
        const deviationPercent = Math.hypot(deltaX, deltaY) / canvasDiagonal * 100;
        return {
            id: target.id,
            id_match: !duplicateIds.has(target.id),
            reference_x: Number(expected.x.toFixed(1)),
            reference_y: Number(expected.y.toFixed(1)),
            placed_x: Number(actual.x.toFixed(1)),
            placed_y: Number(actual.y.toFixed(1)),
            nearest_reference_id: nearestReferenceIdFor(actual),
            position_id_match: nearestReferenceIdFor(actual) === target.id,
            reference_color: referenceColor,
            placed_color: placedColor,
            color_deviation_percent: `${colorDeviationPercent.toFixed(2)}%`,
            delta_x: Number(deltaX.toFixed(1)),
            delta_y: Number(deltaY.toFixed(1)),
            deviation_percent: `${deviationPercent.toFixed(2)}%`
        };
    });

    const deviations = rows.map(row => parseFloat(row.deviation_percent));
    const averageDeviation = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
    // Sai lệch trung bình vị trí và màu đều phải dưới 5%; tổng phải dưới 10%.
    const colorDeviations = rows.map(row => parseFloat(row.color_deviation_percent));
    const averageColorDeviation = colorDeviations.reduce((sum, value) => sum + value, 0) / colorDeviations.length;
    // Cộng hai sai lệch trung bình để kiểm tra thêm ngưỡng tổng dưới 10%.
    const combinedDeviation = averageDeviation + averageColorDeviation;
    const expectedIds = new Set(referenceLayout.parts.map(part => part.id));
    const idsMatch = placedItems.length === referenceItems.length
        && placedItems.every(item => expectedIds.has(item.dataset.id))
        && duplicateIds.size === 0
        && rows.every(row => row.id_match === true);
    const positionsMatchById = rows.every(row => row.position_id_match === true);

    console.groupCollapsed('[Check đáp án] Tọa độ trên hai canvas bao quanh nhóm');
    console.log('Canvas hình mẫu:', `${referenceCanvas.width} × ${referenceCanvas.height}`, referenceCanvas);
    console.log('Canvas bài làm:', `${placedCanvas.width} × ${placedCanvas.height}`, placedCanvas);
    console.log('Khung bao hình mẫu (CSS px):', referenceBounds);
    console.log('Khung bao bài làm (CSS px):', placedBounds);
    console.table(rows);
    console.log('Sai lệch vị trí trung bình:', `${averageDeviation.toFixed(2)}%`);
    console.log('Sai lệch màu trung bình:', `${averageColorDeviation.toFixed(2)}%`);
    console.log('Tổng sai lệch vị trí + màu:', `${combinedDeviation.toFixed(2)}%`);
    console.log('Ngưỡng vị trí / màu / tổng:', `${maxDeviationPercent}% / 5% / 10%`);
    console.log('IDs có vị trí sai (nearest_reference_id khác id):', rows
        .filter(row => !row.position_id_match)
        .map(row => ({ id: row.id, nearest_reference_id: row.nearest_reference_id })));
    console.log('Tất cả ID đúng:', idsMatch);
    console.groupEnd();

    return {
        isCorrect: idsMatch && positionsMatchById
            && averageDeviation < maxDeviationPercent
            && averageColorDeviation < 5
            && combinedDeviation < 10,
        deviationPercent: averageDeviation.toFixed(2),
        colorDeviationPercent: averageColorDeviation.toFixed(2),
        combinedDeviationPercent: combinedDeviation.toFixed(2),
        idsMatch,
        positionsMatchById
    };
}

function setupCheckAnswerEvent() {
    if (!checkAnswerBtn) return;
    checkAnswerBtn.addEventListener('click', () => {
        if (answerSubmitted) return;
        const currentPartCount = assemblyBoard.querySelectorAll('.board-placed-item').length;
        if (currentPartCount !== totalPartsCount) {
            showToast('Cần ghép đủ ' + totalPartsCount + ' bộ phận trước khi kiểm tra (hiện có ' + currentPartCount + ').');
            return;
        }
        try {
            const result = comparePartPositions(5);
            const combinedDeviation = Number(result.combinedDeviationPercent);
            // Matching all parts yields 10 points; every 10% combined deviation removes one point.
            const score = result.idsMatch && result.positionsMatchById
                ? Math.max(0, Math.min(10, 10 - combinedDeviation / 10)) : 0;
            answerSubmitted = true;
            lockGameAfterCheck();
            showToast((result.isCorrect ? 'Đúng rồi! ' : 'Đã chấm xong. ') + 'Tổng điểm: ' + score.toFixed(1) + '/10.');
            finishGame(score, result);
        } catch (err) {
            console.error('Answer comparison failed:', err);
            showToast('Có lỗi khi kiểm tra đáp án.');
        }
    });
}

/** Disable game controls after the final score is submitted. */
function lockGameAfterCheck() {
    if (resetBtn) resetBtn.disabled = true;
    if (checkAnswerBtn) checkAnswerBtn.disabled = true;
    tabButtons.forEach(button => { button.disabled = true; });
    colorDots.forEach(button => { button.disabled = true; });
    [hueSlider, eraserBtn, clearColorBtn].forEach(control => { if (control) control.disabled = true; });
    document.body.classList.add('game-locked');
}

// ----------------------------------------------------
// 9. TIỆN ÍCH & TIMER
// ----------------------------------------------------
