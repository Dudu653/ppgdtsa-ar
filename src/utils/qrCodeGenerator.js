/**
 * Gerador Nativo de QR Code (ISO/IEC 18004 — Byte Mode, ECC Nível L)
 * Gera SVG vetorial nítido sem depender de bibliotecas externas ou CDNs bloqueadas.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(dataBytes, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const msg = new Uint8Array(dataBytes.length + ecCount);
  msg.set(dataBytes, 0);

  for (let i = 0; i < dataBytes.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(dataBytes.length);
}

const QR_VERSIONS_L = [
  null,
  { version: 1, size: 21, totalCodewords: 26, ecCodewords: 7, align: [] },
  { version: 2, size: 25, totalCodewords: 44, ecCodewords: 10, align: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, ecCodewords: 15, align: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, ecCodewords: 20, align: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, ecCodewords: 26, align: [6, 30] }
];

export function generateQRMatrix(text) {
  const utf8Bytes = new TextEncoder().encode(text);

  let verInfo = null;
  for (let v = 1; v <= 5; v++) {
    const info = QR_VERSIONS_L[v];
    const dataCapacity = info.totalCodewords - info.ecCodewords;
    if (utf8Bytes.length + 2 <= dataCapacity) {
      verInfo = info;
      break;
    }
  }
  if (!verInfo) {
    throw new Error('URL muito longa para QR Code compacto');
  }

  const dataCapacity = verInfo.totalCodewords - verInfo.ecCodewords;
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Mode indicator: Byte mode (0100) + Character count (8 bits)
  pushBits(0b0100, 4);
  pushBits(utf8Bytes.length, 8);
  for (const b of utf8Bytes) {
    pushBits(b, 8);
  }

  const maxBits = dataCapacity * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) {
    bits.push(0);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataBytes = new Uint8Array(dataCapacity);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i * 8 + b];
    }
    dataBytes[i] = byte;
  }
  let padToggle = true;
  for (let i = bits.length / 8; i < dataCapacity; i++) {
    dataBytes[i] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  const ecBytes = rsEncode(dataBytes, verInfo.ecCodewords);
  const allCodewords = new Uint8Array(verInfo.totalCodewords);
  allCodewords.set(dataBytes, 0);
  allCodewords.set(ecBytes, dataCapacity);

  const N = verInfo.size;
  const modules = Array.from({ length: N }, () => new Uint8Array(N));
  const isFunction = Array.from({ length: N }, () => new Uint8Array(N));

  const setFunctionModule = (r, c, dark) => {
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    modules[r][c] = dark ? 1 : 0;
    isFunction[r][c] = 1;
  };

  const drawFinder = (topR, leftC) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= N || c < 0 || c >= N) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const inRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (inRing || inCenter));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  for (let i = 8; i < N - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  const align = verInfo.align;
  for (const ar of align) {
    for (const ac of align) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === N - 7) || (ar === N - 7 && ac === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(ar + dr, ac + dc, dark);
        }
      }
    }
  }

  // Dark module e áreas reservadas de Format Info
  setFunctionModule(4 * verInfo.version + 9, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunctionModule(8, i, false);
    if (!isFunction[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][N - 1 - i]) setFunctionModule(8, N - 1 - i, false);
    if (!isFunction[N - 1 - i][8]) setFunctionModule(N - 1 - i, 8, false);
  }

  // Preenchimento dos bits de dados em zigue-zague
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  let upward = true;

  for (let rightCol = N - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < N; step++) {
      const r = upward ? N - 1 - step : step;
      for (let cOffset = 0; cOffset < 2; cOffset++) {
        const c = rightCol - cOffset;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((allCodewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark ? 1 : 0;
        }
      }
    }
    upward = !upward;
  }

  // Format Information (ISO/IEC 18004 Fig. 25): Nível L (01) + Máscara 0 (000) -> 0x77c4
  const formatBits = 0x77c4;
  const bit = idx => ((formatBits >> idx) & 1) === 1;

  // Ao redor do Finder superior esquerdo (Bit 14 em (8,0) até Bit 0 em (0,8))
  const tlCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = tlCoords[i];
    setFunctionModule(r, c, bit(14 - i));
  }

  // Inferior esquerdo (coluna 8): Bit 14 em (N-1, 8) até Bit 8 em (N-7, 8)
  for (let i = 0; i < 7; i++) {
    setFunctionModule(N - 1 - i, 8, bit(14 - i));
  }
  // Superior direito (linha 8): Bit 7 em (8, N-8) até Bit 0 em (8, N-1)
  for (let i = 0; i < 8; i++) {
    setFunctionModule(8, N - 8 + i, bit(7 - i));
  }

  return modules;
}

export function createQRCodeSVG(text, sizePx = 220) {
  const matrix = generateQRMatrix(text);
  const N = matrix.length;
  const margin = 4;
  const total = N + margin * 2;

  const rects = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c]) {
        rects.push(`<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="#000000"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#ffffff" rx="2"/>
    ${rects.join('')}
  </svg>`;
}
