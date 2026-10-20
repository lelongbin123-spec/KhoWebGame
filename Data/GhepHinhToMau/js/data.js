// Resolve the JSON URL relative to this script instead of the current page route.
const GAME_DATA_URL = new URL('../data/data.json', document.currentScript?.src || document.baseURI).href;

/**
 * Chuẩn hóa dữ liệu, dựng hình mẫu và khởi tạo lượt chơi.
 * Phụ thuộc các biến dùng chung trong state.js; được gọi bởi main.js.
 */

function normalizeGameData(rawData) {
    // Chấp nhận hai kiểu tên khóa đang có trong data.json, rồi chuẩn hóa
    // một lần để phần còn lại chỉ cần xử lý id, name và image.
    const sourceParts = rawData?.parts ?? rawData?.data;
    if (!rawData || typeof rawData !== 'object' || !Array.isArray(sourceParts)) {
        throw new Error('data.json phải chứa mảng data hoặc parts');
    }

    const parts = sourceParts.map((part, index) => {
        if (!part || typeof part !== 'object') {
            throw new Error(`parts[${index}] phải là một đối tượng`);
        }

        const id = part.id ?? part.Id;
        const name = part.name ?? part.Name;
        const image = part.image ?? part.src;

        if (id == null || !name || !image) {
            throw new Error(`Thiếu id, name hoặc ảnh ở parts[${index}]`);
        }

        return { id: String(id), name: String(name), image: String(image) };
    });
    const partsById = new Map(parts.map(part => [part.id, part]));
    if (partsById.size !== parts.length) {
        throw new Error('Mỗi bộ phận cần có ID riêng biệt');
    }

    const sourceLayout = rawData.referenceLayout;
    if (!sourceLayout || !Array.isArray(sourceLayout.parts)
        || !Number.isFinite(Number(sourceLayout.width))
        || !Number.isFinite(Number(sourceLayout.height))
        || Number(sourceLayout.width) <= 0 || Number(sourceLayout.height) <= 0) {
        throw new Error('referenceLayout phải chứa width, height và mảng parts');
    }

    // Kiểm tra tọa độ mẫu và chọn ảnh cho từng bộ phận. Layout có thể chỉ
    // định ảnh riêng; nếu không, dùng ảnh của bộ phận trong khay.
    const layoutParts = sourceLayout.parts.map((target, index) => {
        const id = String(target?.id ?? '');
        const part = partsById.get(id);
        const image = target?.image ?? target?.src ?? part?.image;
        const x = Number(target?.x);
        const y = Number(target?.y);
        const width = Number(target?.width);
        const height = Number(target?.height);
        if (!part || !image
            || ![x, y, width, height].every(Number.isFinite)
            || x < 0 || y < 0 || width <= 0 || height <= 0) {
            throw new Error(`referenceLayout.parts[${index}] không hợp lệ`);
        }
        return { id, image: String(image), x, y, width, height };
    });
    if (layoutParts.length !== parts.length
        || new Set(layoutParts.map(part => part.id)).size !== layoutParts.length) {
        throw new Error('referenceLayout cần có vị trí cho đủ sáu bộ phận');
    }

    return {
        title: rawData.title ?? rawData.Title ?? '',
        description: rawData.description ?? rawData.Text ?? '',
        referenceLayout: {
            width: Number(sourceLayout.width),
            height: Number(sourceLayout.height),
            parts: layoutParts
        },
        parts
    };
}

// Dựng ảnh mẫu từ layout trong data.json, lấy mã màu ngẫu nhiên từ bảng màu.
// Mã màu được giữ trên phần tử để phép so sánh có thể đối chiếu theo ID.
function setupReferenceBoard() {
    if (!referencePartsContainer || !gameData) return;

    referencePartsContainer.replaceChildren();
    const palette = [...colorDots]
        .map(dot => dot.dataset.color)
        .filter(Boolean);
    for (const target of gameData.referenceLayout.parts) {
        const part = gameData.parts.find(item => item.id === target.id);
        if (!part) continue;

        const referencePart = document.createElement('div');
        const image = document.createElement('img');
        const color = palette[Math.floor(Math.random() * palette.length)] || '#ef4444';
        referencePart.className = 'reference-part';
        referencePart.dataset.id = part.id;
        referencePart.dataset.name = part.name;
        referencePart.dataset.color = color;
        referencePart.style.setProperty('--part-color', color);
        referencePart.style.left = `${target.x / gameData.referenceLayout.width * 100}%`;
        referencePart.style.top = `${target.y / gameData.referenceLayout.height * 100}%`;
        referencePart.style.width = `${target.width / gameData.referenceLayout.width * 100}%`;
        referencePart.style.height = `${target.height / gameData.referenceLayout.height * 100}%`;
        image.src = target.image;
        // Resolve the mask against the document URL so it survives the folder reorganization.
        referencePart.style.setProperty('--part-mask', `url("${image.src}")`);
        image.alt = part.name;
        image.draggable = false;
        referencePart.appendChild(image);
        referencePartsContainer.appendChild(referencePart);
    }
}

async function initGame() {
    try {
        const response = await fetch(GAME_DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Không thể tải ${GAME_DATA_URL} (HTTP ${response.status})`);
        gameData = normalizeGameData(await response.json());
        referenceLayout = gameData.referenceLayout;

        if (gameTitleEl && gameData.title) gameTitleEl.textContent = gameData.title;
        if (gameDescEl && gameData.description) gameDescEl.textContent = gameData.description;
        setupReferenceBoard();
        setupBoardAndTray();
        setupTabEvents();
        setupColoringEvents();
        setupCheckAnswerEvent();
        startTimer();
    } catch (error) {
        console.error('Lỗi khởi tạo game. URL dữ liệu:', GAME_DATA_URL, error);
        showToast('❌ Không thể tải dữ liệu trò chơi!');
    }
}

