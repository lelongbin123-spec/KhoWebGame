// GameUtils - Các tiện ích hình học, xử lý chuỗi và thuật toán nắn hướng kéo chuột
const GameUtils = {
  // Chuẩn hóa xâu chữ tiếng Việt: loại bỏ khoảng trắng thừa và viết in hoa 
  normalizeVietnamese(str) {
    if (!str) return '';
    return str.replace(/\s+/g, '').toUpperCase();
  },

  // So khớp mềm dẻo dung sai cho các chữ cái tiếng Việt tương đồng (như Đ và D)
  matchFuzzy(target, actual) {
    if (target === actual) return true;
    const fTarget = target.replace(/Đ/g, 'D');
    const fActual = actual.replace(/Đ/g, 'D');
    return fTarget === fActual;
  },

  // Thuật toán nắn tia kéo chuột 8 hướng (Magnetic Ray Tracing):
  // Tự động điều chỉnh các dao động tay của học sinh về đúng hàng ngang, hàng dọc hoặc chéo 45 độ
   
  getCellsInLine(r1, c1, r2, c2, gridSize, getCellFn) {
    const cells = [];
    let dr = r2 - r1;
    let dc = c2 - c1;

    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);

    // Cơ chế hút từ tính (Magnetic Snapping):
    // 1. Nếu hướng dịch chuyển ngang chiếm ưu thế rõ rệt -> ép về hàng ngang
    if (absDc > 0 && absDr <= absDc * 0.45) {
      dr = 0;
    }
    // 2. Nếu hướng dịch chuyển dọc chiếm ưu thế rõ rệt -> ép về hàng dọc
    else if (absDr > 0 && absDc <= absDr * 0.45) {
      dc = 0;
    }
    // 3. Nếu gần hướng đường chéo -> cân bằng số bước theo đường chéo 45 độ
    else if (absDr > 0 && absDc > 0) {
      const diagDist = Math.max(absDr, absDc);
      dr = dr > 0 ? diagDist : -diagDist;
      dc = dc > 0 ? diagDist : -diagDist;
    }

    const isHorizontal = dr === 0;
    const isVertical = dc === 0;
    const isDiagonal = Math.abs(dr) === Math.abs(dc);

    // Nếu không thuộc 8 hướng thẳng hàng, trả về ít nhất ô bắt đầu
    if (!isHorizontal && !isVertical && !isDiagonal) {
      const startEl = getCellFn(r1, c1);
      if (startEl) cells.push(startEl);
      return cells;
    }

    const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
    const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));

    let curR = r1;
    let curC = c1;

    // Duyệt qua từng ô trên đường thẳng và thêm vào danh sách chọn
    for (let i = 0; i <= steps; i++) {
      if (curR < 0 || curR >= gridSize || curC < 0 || curC >= gridSize) break;
      const cell = getCellFn(curR, curC);
      if (cell) cells.push(cell);
      curR += stepR;
      curC += stepC;
    }

    return cells;
  },

  /*************************************************************************
   * THUẬT TOÁN SINH MA TRẬN WORD SEARCH (ĐẢM BẢO ĐẶT ĐỦ 100% TỪ KHÓA)
   * Tự động tính toán tọa độ, hướng và đặt 100% từ khóa theo kích thước thẻ "size"
   *************************************************************************/
  DIR_MAP: {
    H: { dr: 0, dc: 1, arrow: "→", name: "Ngang (trái sang phải)" },
    V: { dr: 1, dc: 0, arrow: "↓", name: "Dọc (trên xuống dưới)" },
    D_DOWN: { dr: 1, dc: 1, arrow: "↘", name: "Chéo xuôi (trên xuống phải)" },
    D_UP: { dr: -1, dc: 1, arrow: "↗", name: "Chéo ngược (dưới lên phải)" }
  },

  VIETNAMESE_ALPHABET: [
    'A', 'Ă', 'Â', 'B', 'C', 'D', 'Đ', 'E', 'Ê', 'G', 'H', 'I', 'K', 'L', 'M',
    'N', 'O', 'Ô', 'Ơ', 'P', 'Q', 'R', 'S', 'T', 'U', 'Ư', 'V', 'X', 'Y',
    'À', 'Á', 'Ả', 'Ã', 'Ạ', 'Ằ', 'Ắ', 'Ẳ', 'Ẵ', 'Ặ', 'Ầ', 'Ấ', 'Ẩ', 'Ẫ', 'Ậ',
    'È', 'É', 'Ẻ', 'Ẽ', 'Ẹ', 'Ề', 'Ế', 'Ể', 'Ễ', 'Ệ', 'Ì', 'Í', 'Ỉ', 'Ĩ', 'Ị',
    'Ò', 'Ó', 'Ỏ', 'Õ', 'Ọ', 'Ồ', 'Ố', 'Ổ', 'Ỗ', 'Ộ', 'Ờ', 'Ớ', 'Ở', 'Ỡ', 'Ợ',
    'Ù', 'Ú', 'Ủ', 'Ũ', 'Ụ', 'Ừ', 'Ứ', 'Ử', 'Ữ', 'Ự', 'Ỳ', 'Ý', 'Ỷ', 'Ỹ'
  ],

  buildLevelMatrix(levelObj) {
    // Lấy danh sách từ khóa từ thẻ "keywords" hoặc "words"
    const rawWordsList = levelObj.words || levelObj.keywords || [];
    const rawWords = rawWordsList.map((w, idx) => {
      const wordStr = typeof w === 'string' ? w : (w.word || w.display || '');
      const clean = typeof w === 'object' && w.cleanWord ? w.cleanWord : wordStr;
      return {
        ...(typeof w === 'object' ? w : { word: wordStr }),
        originalIndex: idx,
        display: (typeof w === 'object' && w.display) ? w.display : wordStr,
        cleanChars: Array.from(clean.replace(/\s+/g, "").toUpperCase())
      };
    });

    // Tính độ dài của từ dài nhất trong danh sách từ khóa
    const maxWordLength = rawWords.reduce((max, w) => Math.max(max, w.cleanChars.length), 0);

    // Kích thước size ma trận lấy trực tiếp từ thẻ size trong data.json,
    // đồng thời luôn đảm bảo tối thiểu bằng từ dài nhất để thuật toán sinh tự động 100% thành công
    const configuredSize = parseInt(levelObj.size || levelObj.gridSize, 10) || 8;
    const size = Math.max(configuredSize, maxWordLength);

    const allowedKeys = levelObj.allowedDirections || ["H", "V", "D_DOWN", "D_UP"];
    const dirs = allowedKeys.map(k => ({ key: k, ...this.DIR_MAP[k] }));

    // Sắp xếp từ dài nhất lên trước để ưu tiên đặt vị trí dễ dàng hơn
    const sortedWords = [...rawWords].sort((a, b) => b.cleanChars.length - a.cleanChars.length);

    for (let attempt = 0; attempt < 200; attempt++) {
      const board = Array.from({ length: size }, () => Array(size).fill(null));
      const placements = [];
      let allPlaced = true;

      for (const wObj of sortedWords) {
        const chars = wObj.cleanChars;
        const len = chars.length;
        const candidates = [];

        for (const d of dirs) {
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              const endR = r + d.dr * (len - 1);
              const endC = c + d.dc * (len - 1);
              if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

              let canFit = true;
              let overlapCount = 0;
              for (let i = 0; i < len; i++) {
                const nr = r + d.dr * i;
                const nc = c + d.dc * i;
                const existing = board[nr][nc];
                if (existing !== null && existing !== chars[i]) {
                  canFit = false;
                  break;
                }
                if (existing === chars[i]) overlapCount++;
              }
              if (canFit) {
                candidates.push({ r, c, d, overlapCount });
              }
            }
          }
        }

        if (candidates.length === 0) {
          allPlaced = false;
          break;
        }

        // Chọn vị trí ngẫu nhiên từ danh sách ứng viên hợp lệ
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        const cells = [];
        for (let i = 0; i < len; i++) {
          const nr = chosen.r + chosen.d.dr * i;
          const nc = chosen.c + chosen.d.dc * i;
          board[nr][nc] = chars[i];
          cells.push({ r: nr, c: nc });
        }

        placements.push({
          index: wObj.originalIndex,
          word: wObj.display || chars.join(""),
          cleanWord: chars.join(""),
          chars,
          display: wObj.display || wObj.word,
          category: wObj.category || "Lịch sử & Địa lý",
          clue: wObj.clue,
          aiHint: wObj.aiHint || wObj.hint,
          hint: wObj.hint || wObj.aiHint,
          fact: wObj.fact,
          altCleanWords: wObj.altCleanWords || [],
          row: chosen.r,
          col: chosen.c,
          dr: chosen.d.dr,
          dc: chosen.d.dc,
          dirArrow: chosen.d.arrow,
          dirName: chosen.d.name,
          cells,
          start: { r: chosen.r, c: chosen.c },
          end: { r: cells[cells.length - 1].r, c: cells[cells.length - 1].c },
          found: false,
          hintStage: 0 // 0: chưa gợi ý, 1: nhấp nháy chữ đầu, 2: nhấp nháy kèm mũi tên chỉ hướng
        });
      }

      if (allPlaced) {
        // Điền các ô trống còn lại bằng các chữ cái tiếng Việt ngẫu nhiên
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (board[r][c] === null) {
              board[r][c] = this.VIETNAMESE_ALPHABET[Math.floor(Math.random() * this.VIETNAMESE_ALPHABET.length)];
            }
          }
        }
        placements.sort((a, b) => a.index - b.index);
        return { board, placements };
      }
    }

    // Phương án dự phòng an toàn tuyệt đối nếu sau các lần thử ngẫu nhiên không xếp đủ
    const fallbackSize = Math.max(size, rawWords.length, maxWordLength);
    const board = Array.from({ length: fallbackSize }, () => Array(fallbackSize).fill(null));
    const placements = rawWords.map((wObj, idx) => {
      const chars = wObj.cleanChars;
      const r = idx % fallbackSize;
      const cells = [];
      for (let c = 0; c < chars.length && c < fallbackSize; c++) {
        board[r][c] = chars[c];
        cells.push({ r, c });
      }
      return {
        index: idx,
        word: wObj.display || chars.join(""),
        cleanWord: chars.join(""),
        chars,
        display: wObj.display || wObj.word,
        category: wObj.category || "Lịch sử & Địa lý",
        clue: wObj.clue,
        aiHint: wObj.aiHint || wObj.hint,
        hint: wObj.hint || wObj.aiHint,
        fact: wObj.fact,
        altCleanWords: wObj.altCleanWords || [],
        row: r,
        col: 0,
        dr: 0,
        dc: 1,
        dirArrow: "→",
        dirName: "Ngang (trái sang phải)",
        cells,
        start: { r, c: 0 },
        end: { r, c: cells.length - 1 },
        found: false,
        hintStage: 0
      };
    });

    for (let r = 0; r < fallbackSize; r++) {
      for (let c = 0; c < fallbackSize; c++) {
        if (board[r][c] === null) {
          board[r][c] = this.VIETNAMESE_ALPHABET[Math.floor(Math.random() * this.VIETNAMESE_ALPHABET.length)];
        }
      }
    }
    return { board, placements };
  }
};

if (typeof window !== 'undefined') {
  window.GameUtils = GameUtils;
  window.buildLevelMatrix = function(levelObj) {
    return GameUtils.buildLevelMatrix(levelObj);
  };
  window.DIR_MAP = GameUtils.DIR_MAP;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameUtils;
}
