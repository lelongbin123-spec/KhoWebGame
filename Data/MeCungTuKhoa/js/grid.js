/**
 * Bảng màu sắc phân biệt sinh động cho từng từ khóa (Distinct Word Colors Palette)
 */
const WORD_COLORS = [
  {
    name: 'emerald',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    start: '#10b981',
    border: '#047857',
    shadow: '#065f46',
    glow: 'rgba(16, 185, 129, 0.4)',
    lightBg: '#ecfdf5',
    text: '#047857'
  },
  {
    name: 'orange',
    gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    start: '#f97316',
    border: '#c2410c',
    shadow: '#9a3412',
    glow: 'rgba(249, 115, 22, 0.4)',
    lightBg: '#fff7ed',
    text: '#c2410c'
  },
  {
    name: 'purple',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    start: '#8b5cf6',
    border: '#6d28d9',
    shadow: '#5b21b6',
    glow: 'rgba(139, 92, 246, 0.4)',
    lightBg: '#f5f3ff',
    text: '#6d28d9'
  },
  {
    name: 'cyan',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    start: '#06b6d4',
    border: '#0e7490',
    shadow: '#155e75',
    glow: 'rgba(6, 182, 212, 0.4)',
    lightBg: '#ecfeff',
    text: '#0e7490'
  },
  {
    name: 'rose',
    gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)',
    start: '#f43f5e',
    border: '#be123c',
    shadow: '#9f1239',
    glow: 'rgba(244, 63, 94, 0.4)',
    lightBg: '#fff1f2',
    text: '#be123c'
  },
  {
    name: 'amber',
    gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
    start: '#eab308',
    border: '#a16207',
    shadow: '#854d0e',
    glow: 'rgba(234, 179, 8, 0.4)',
    lightBg: '#fefce8',
    text: '#a16207'
  },
  {
    name: 'indigo',
    gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    start: '#6366f1',
    border: '#4338ca',
    shadow: '#3730a3',
    glow: 'rgba(99, 102, 241, 0.4)',
    lightBg: '#eef2ff',
    text: '#4338ca'
  },
  {
    name: 'teal',
    gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)',
    start: '#14b8a6',
    border: '#0f766e',
    shadow: '#115e59',
    glow: 'rgba(20, 184, 166, 0.4)',
    lightBg: '#f0fdfa',
    text: '#0f766e'
  }
];

class GridManager {
  constructor(gridElement, keywordsListElement) {
    this.gridElement = gridElement;
    this.keywordsListElement = keywordsListElement;
    this.counterEl = (typeof document !== 'undefined' && typeof document.getElementById === 'function')
      ? document.getElementById('keywordsCounter')
      : null;
    this.progressBarEl = (typeof document !== 'undefined' && typeof document.getElementById === 'function')
      ? document.getElementById('keywordsProgressBar')
      : null;
  }

  /**
   * Tạo cấu trúc các ô chữ cái trong bảng ma trận theo số hàng và cột (size × size)
   * Sinh lưới động theo thẻ size trong data.json
   */
  renderMatrix(matrix) {
    if (!this.gridElement) return;
    this.gridElement.innerHTML = '';
    const size = matrix.length;
    this.cellMatrix = [];
    this.currentSelectingSet = null;

    // Thiết lập số cột và số hàng động dựa theo kích thước size
    this.gridElement.style.setProperty('--grid-size', size);
    this.gridElement.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    this.gridElement.style.gridTemplateRows = `repeat(${size}, 1fr)`;

    // Tính toán cỡ chữ co giãn linh hoạt theo số ô trên mỗi hàng
    const fontSize = Math.max(13, Math.min(26, Math.round(220 / size)));
    this.gridElement.style.setProperty('--tile-font-size', `${fontSize}px`);

    for (let r = 0; r < size; r++) {
      this.cellMatrix[r] = [];
      for (let c = 0; c < size; c++) {
        const letter = matrix[r][c] || '';
        const cell = document.createElement('div');
        cell.className = 'tile-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.dataset.letter = letter;
        cell.textContent = letter;
        this.cellMatrix[r][c] = cell;
        this.gridElement.appendChild(cell);
      }
    }
  }

  /**
   * Lấy phần tử DOM của một ô theo tọa độ hàng và cột (Tối ưu truy xuất O(1))
   */
  getCell(r, c) {
    if (this.cellMatrix && this.cellMatrix[r] && this.cellMatrix[r][c]) {
      return this.cellMatrix[r][c];
    }
    if (!this.gridElement) return null;
    return this.gridElement.querySelector(`.tile-cell[data-row="${r}"][data-col="${c}"]`);
  }

  /**
   * Đánh dấu các ô đang được chuột rê chọn qua (Tối ưu vi sai diff)
   */
  setSelectingCells(cells) {
    if (this.currentSelectingSet) {
      const newSet = new Set(cells);
      for (const c of this.currentSelectingSet) {
        if (!newSet.has(c)) c.classList.remove('selecting');
      }
      for (const c of cells) {
        if (!this.currentSelectingSet.has(c)) c.classList.add('selecting');
      }
      this.currentSelectingSet = newSet;
    } else {
      this.clearSelecting();
      cells.forEach(c => c.classList.add('selecting'));
      this.currentSelectingSet = new Set(cells);
    }
  }

  /**
   * Xóa đánh dấu trạng thái đang rê chuột trên toàn bộ các ô
   */
  clearSelecting() {
    if (this.currentSelectingSet && this.currentSelectingSet.size > 0) {
      for (const c of this.currentSelectingSet) {
        c.classList.remove('selecting');
      }
      this.currentSelectingSet.clear();
      return;
    }
    if (!this.gridElement) return;
    const prev = this.gridElement.querySelectorAll('.tile-cell.selecting');
    prev.forEach(el => el.classList.remove('selecting'));
  }

  /**
   * Đánh dấu cố định các ô thuộc từ khóa đã tìm thấy với màu sắc phân biệt riêng
   * @param {Array<HTMLElement>} cells - Danh sách các ô chữ cái của từ vừa tìm thấy
   * @param {number} colorIndex - Chỉ số màu sắc riêng của từ khóa này
   */
  markCellsFound(cells, colorIndex = 0) {
    const palette = WORD_COLORS[colorIndex % WORD_COLORS.length];

    cells.forEach(c => {
      c.classList.add('found');
      c.classList.add(`found-color-${colorIndex % WORD_COLORS.length}`);
      c.classList.add('pop-celebrate');

      // Ghi nhận các màu sắc của từ khóa đi qua ô này (hỗ trợ ô giao nhau)
      let cellColors = c.dataset.colors ? c.dataset.colors.split(',').map(Number) : [];
      if (!cellColors.includes(colorIndex)) {
        cellColors.push(colorIndex);
      }
      c.dataset.colors = cellColors.join(',');

      if (cellColors.length === 1) {
        c.style.setProperty('background', palette.gradient, 'important');
        c.style.setProperty('border-color', palette.border, 'important');
        c.style.setProperty('box-shadow', `0 3px 0 ${palette.shadow}, 0 4px 10px ${palette.glow}`, 'important');
        c.style.setProperty('color', '#ffffff', 'important');
      } else {
        
        // Trường hợp ô giao nhau giữa nhiều từ: tạo dải màu phân chia chéo đẹp mắt
        const c1 = WORD_COLORS[cellColors[0] % WORD_COLORS.length];
        const c2 = WORD_COLORS[cellColors[cellColors.length - 1] % WORD_COLORS.length];
        c.style.setProperty('background', `linear-gradient(135deg, ${c1.start} 50%, ${c2.start} 50%)`, 'important');
        c.style.setProperty('border-color', c2.border, 'important');
        c.style.setProperty('box-shadow', `0 3px 0 ${c2.shadow}, 0 0 12px ${c2.glow}`, 'important');
        c.style.setProperty('color', '#ffffff', 'important');
      }
    });

    // Gom dọn dẹp hiệu ứng pop-celebrate trong 1 timeout duy nhất
    setTimeout(() => {
      cells.forEach(c => c.classList.remove('pop-celebrate'));
    }, 650);
  }

  /**
   * Hiển thị danh sách từ khóa cần tìm ở cột bên trái kèm bộ đếm, thanh tiến trình và màu sắc tương ứng
   */
  renderKeywordsList(keywords, foundWords) {
    if (!this.keywordsListElement) return;
    this.keywordsListElement.innerHTML = '';

    let foundCount = 0;
    const total = keywords.length;

    keywords.forEach((kw, kwIdx) => {
      const text = kw.display || kw.word;
      const isFound = foundWords.has(text) || foundWords.has(kw.word);
      const colorIndex = (kw.colorIndex !== undefined ? kw.colorIndex : kwIdx) % WORD_COLORS.length;
      const palette = WORD_COLORS[colorIndex];

      if (isFound) foundCount++;

      const li = document.createElement('li');
      li.className = 'keyword-item';
      li.dataset.word = text;

      if (isFound) {
        const isHintUsed = Boolean(kw.hasHint || kw.hintUsed);
        li.classList.add('found', `found-color-${colorIndex}`);
        li.style.backgroundColor = palette.lightBg;
        li.style.color = palette.text;
        li.style.borderColor = palette.border;
        li.innerHTML = `
          <span class="keyword-check-badge" style="background:${palette.start};" title="Đã tìm thấy từ này">
            <svg viewBox="0 0 20 20" width="12" height="12" fill="none">
              <polyline points="4.5 10 8.5 14 15.5 6" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="keyword-text">${text}</span>
          ${isHintUsed ? '<span class="kw-hint-indicator" title="Từ này đã dùng gợi ý (50% điểm)">💡</span>' : ''}
        `;
      } else {
        const isHintActive = Boolean(kw.hasHint || kw.hintUsed);
        li.innerHTML = `
          <span class="keyword-check-badge unchecked" title="Chưa tìm thấy từ này">
            <svg viewBox="0 0 20 20" width="12" height="12" fill="none">
              <polyline points="4.5 10 8.5 14 15.5 6" stroke="#cbd5e1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="keyword-text">${text}</span>
          ${isHintActive ? '<span class="kw-hint-indicator active" title="Đang mở gợi ý cho từ này (-50% điểm)">💡</span>' : ''}
        `;
      }

      this.keywordsListElement.appendChild(li);
    });

    // Cập nhật bộ đếm từ khóa và thanh tiến trình sinh động
    const counterEl = this.counterEl || document.getElementById('keywordsCounter');
    if (counterEl) {
      counterEl.textContent = `${foundCount}/${total}`;
    }
    const progressBar = this.progressBarEl || document.getElementById('keywordsProgressBar');
    if (progressBar) {
      const pct = total > 0 ? Math.round((foundCount / total) * 100) : 0;
      progressBar.style.width = `${pct}%`;
    }
  }
}

if (typeof window !== 'undefined') {
  window.WORD_COLORS = WORD_COLORS;
  window.GridManager = GridManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WORD_COLORS, GridManager };
}
