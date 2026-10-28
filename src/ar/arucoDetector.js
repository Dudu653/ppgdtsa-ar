/**
 * Motor de Visão Computacional WebAR — Detector ArUco 7x7 Ultra-Estável
 * - Refinamento Sub-Pixel com 40 pontos de borda por quadrado (gradiente direcional claro -> escuro)
 * - Ajuste de retas ortogonal livre de singularidades verticais/horizontais
 * - Pose 6DoF sem amplificação de ruído de ponto de fuga
 */

import { CARDS_CATALOG } from '../data/cardsCatalog.js';

function rotateMatrix90CW(mat) {
  const N = mat.length;
  const out = Array.from({ length: N }, () => new Array(N));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      out[c][N - 1 - r] = mat[r][c];
    }
  }
  return out;
}

const ROTATED_DICTIONARY = [];
for (const card of CARDS_CATALOG) {
  let current = card.matrix;
  for (let rot = 0; rot < 4; rot++) {
    ROTATED_DICTIONARY.push({
      id: card.id,
      code: card.code,
      rotation: rot,
      flatBits: current.flat()
    });
    current = rotateMatrix90CW(current);
  }
}

export class ArucoDetector {
  constructor(width = 640, height = 480) {
    this.width = width;
    this.height = height;
    this.gray = new Uint8Array(width * height);
    this.integral = new Int32Array((width + 1) * (height + 1));
    this.binary = new Uint8Array(width * height);
    this.visited = new Uint8Array(width * height);
  }

  resize(width, height) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.gray = new Uint8Array(width * height);
    this.integral = new Int32Array((width + 1) * (height + 1));
    this.binary = new Uint8Array(width * height);
    this.visited = new Uint8Array(width * height);
  }

  detect(imageData, viewWidth = imageData.width, viewHeight = imageData.height, fovDeg = 48) {
    const { width, height, data } = imageData;
    this.resize(width, height);

    const gray = this.gray;
    const integral = this.integral;
    const binary = this.binary;
    const visited = this.visited;

    const stride = width + 1;
    integral.fill(0, 0, stride);

    let rgbaIdx = 0;
    let pxIdx = 0;
    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      const intRowOffset = (y + 1) * stride;
      const prevRowOffset = y * stride;
      integral[intRowOffset] = 0;

      for (let x = 0; x < width; x++) {
        const lum = (data[rgbaIdx] * 77 + data[rgbaIdx + 1] * 150 + data[rgbaIdx + 2] * 29) >> 8;
        gray[pxIdx] = lum;
        rowSum += lum;
        integral[intRowOffset + x + 1] = integral[prevRowOffset + x + 1] + rowSum;
        rgbaIdx += 4;
        pxIdx++;
      }
    }

    const radius = Math.max(8, Math.floor(Math.min(width, height) / 28));
    const bias = 9;
    visited.fill(0);

    for (let y = 0; y < height; y++) {
      const y1 = Math.max(0, y - radius);
      const y2 = Math.min(height - 1, y + radius);
      const r1 = y1 * stride;
      const r2 = (y2 + 1) * stride;
      const rowOffset = y * width;

      for (let x = 0; x < width; x++) {
        if (x <= 2 || x >= width - 3 || y <= 2 || y >= height - 3) {
          binary[rowOffset + x] = 0;
          continue;
        }
        const x1 = Math.max(0, x - radius);
        const x2 = Math.min(width - 1, x + radius);
        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum = integral[r2 + x2 + 1] - integral[r1 + x2 + 1] - integral[r2 + x1] + integral[r1 + x1];
        binary[rowOffset + x] = gray[rowOffset + x] * count < sum - bias * count ? 1 : 0;
      }
    }

    const candidates = [];
    const dx = [1, 1, 0, -1, -1, -1, 0, 1];
    const dy = [0, 1, 1, 1, 0, -1, -1, -1];

    const minPerim = 36;
    const maxSide = Math.floor(Math.max(width, height) * 0.96);

    for (let y = 3; y < height - 3; y++) {
      const rowOffset = y * width;
      for (let x = 3; x < width - 3; x++) {
        const idx = rowOffset + x;
        if (binary[idx] === 1 && binary[idx - 1] === 0 && visited[idx] === 0) {
          const contour = [];
          let cx = x;
          let cy = y;
          let backtrackDir = 4;
          let minX = x, maxX = x, minY = y, maxY = y;
          let steps = 0;
          const maxSteps = 4000;

          while (steps < maxSteps) {
            visited[cy * width + cx] = 1;
            contour.push({ x: cx, y: cy });
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            let foundNext = false;
            const startDir = (backtrackDir + 1) & 7;
            for (let k = 0; k < 8; k++) {
              const dir = (startDir + k) & 7;
              const nx = cx + dx[dir];
              const ny = cy + dy[dir];
              if (binary[ny * width + nx] === 1) {
                cx = nx;
                cy = ny;
                backtrackDir = (dir + 4) & 7;
                foundNext = true;
                break;
              }
            }
            steps++;
            if (!foundNext || (cx === x && cy === y)) break;
          }

          const bw = maxX - minX;
          const bh = maxY - minY;
          if (
            contour.length >= minPerim &&
            bw >= 11 && bh >= 11 &&
            bw <= maxSide && bh <= maxSide &&
            bw / bh > 0.3 && bw / bh < 3.2
          ) {
            const quad = this.extractQuadFromContour(contour, bw, bh);
            if (quad) candidates.push(quad);
          }
        }
      }
    }

    const detectedById = new Map();

    for (const quad of candidates) {
      const decoded = this.decodeQuad(quad, gray, width, height, viewWidth, viewHeight, fovDeg);
      if (decoded) {
        const existing = detectedById.get(decoded.id);
        if (!existing || decoded.hamming < existing.hamming || (decoded.hamming === existing.hamming && decoded.area > existing.area)) {
          detectedById.set(decoded.id, decoded);
        }
      }
    }

    return Array.from(detectedById.values());
  }

  extractQuadFromContour(contour, bw, bh) {
    const eps = Math.max(2.5, Math.hypot(bw, bh) * 0.042);
    const poly = this.simplifyPolygonRDP(contour, eps);
    if (poly.length < 4 || poly.length > 9) return null;

    let corners = poly;
    if (corners.length > 4) {
      corners = this.selectBestFourCorners(poly);
    }
    if (!corners || corners.length !== 4) return null;

    const ordered = this.orderClockwise(corners);
    if (!this.isConvexQuad(ordered)) return null;

    for (let i = 0; i < 4; i++) {
      const p1 = ordered[i];
      const p2 = ordered[(i + 1) % 4];
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 8) return null;
    }

    return ordered;
  }

  /**
   * Refina os 4 cantos com 10 amostras por aresta (40 pontos totais) usando gradiente direcional
   * (zona branca externa -> borda preta interna) e regressão ortogonal contínua.
   */
  refineCornersSubPixel(quad, gray, width, height) {
    const lines = [];
    // 10 pontos ao longo do trecho reto de cada uma das 4 arestas
    const sampleTs = [0.16, 0.24, 0.31, 0.39, 0.46, 0.54, 0.61, 0.69, 0.76, 0.84];

    for (let i = 0; i < 4; i++) {
      const pA = quad[i];
      const pB = quad[(i + 1) % 4];
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const len = Math.hypot(dx, dy);
      if (len < 8) return quad;

      // Como o quad está ordenado em sentido horário (em coordenadas de imagem Y para baixo),
      // a normal que aponta para FORA (zona branca silenciosa) é (dy/len, -dx/len).
      const outNx = dy / len;
      const outNy = -dx / len;

      const edgePts = [];
      for (const t of sampleTs) {
        const bx = pA.x + dx * t;
        const by = pA.y + dy * t;

        let weightSum = 0;
        let offsetSum = 0;
        // Varre de -2.5px (dentro da borda preta) a +2.5px (fora na zona branca) em passos de 0.5px
        for (let s = -2.5; s <= 2.5; s += 0.5) {
          const xOut = bx + outNx * (s + 0.6);
          const yOut = by + outNy * (s + 0.6);
          const xIn = bx + outNx * (s - 0.6);
          const yIn = by + outNy * (s - 0.6);

          const lumOut = this.sampleBilinear(gray, width, height, xOut, yOut);
          const lumIn = this.sampleBilinear(gray, width, height, xIn, yIn);
          // Gradiente direcional positivo apenas quando fora é claro e dentro é escuro!
          const grad = Math.max(0, lumOut - lumIn);
          const w = grad * grad;
          weightSum += w;
          offsetSum += w * s;
        }

        const bestS = weightSum > 80 ? offsetSum / weightSum : 0;
        edgePts.push({
          x: bx + outNx * bestS,
          y: by + outNy * bestS
        });
      }

      // Centroide da aresta
      let mx = 0, my = 0;
      for (const p of edgePts) {
        mx += p.x;
        my += p.y;
      }
      mx /= edgePts.length;
      my /= edgePts.length;

      // Covariância para autovetor principal da reta (sem salto de atan2!)
      let sxx = 0, syy = 0, sxy = 0;
      for (const p of edgePts) {
        const ux = p.x - mx;
        const uy = p.y - my;
        sxx += ux * ux;
        syy += uy * uy;
        sxy += ux * uy;
      }

      const diff = sxx - syy;
      const root = Math.hypot(diff, 2 * sxy);
      let vx, vy;
      if (sxx >= syy) {
        vx = diff + root;
        vy = 2 * sxy;
      } else {
        vx = 2 * sxy;
        vy = -diff + root;
      }
      const vLen = Math.hypot(vx, vy);
      if (vLen > 1e-6) {
        vx /= vLen;
        vy /= vLen;
      } else {
        vx = dx / len;
        vy = dy / len;
      }

      const a = -vy;
      const b = vx;
      const c = -(a * mx + b * my);
      lines.push({ a, b, c });
    }

    const refined = [];
    for (let i = 0; i < 4; i++) {
      const L1 = lines[(i + 3) % 4];
      const L2 = lines[i];
      const det = L1.a * L2.b - L2.a * L1.b;
      if (Math.abs(det) < 1e-5) return quad;
      const rx = (L1.b * L2.c - L2.b * L1.c) / det;
      const ry = (L2.a * L1.c - L1.a * L2.c) / det;
      if (Math.hypot(rx - quad[i].x, ry - quad[i].y) > 4.0) {
        refined.push(quad[i]);
      } else {
        refined.push({ x: rx, y: ry });
      }
    }

    return refined;
  }

  sampleBilinear(gray, width, height, x, y) {
    const x0 = Math.max(0, Math.min(width - 2, Math.floor(x)));
    const y0 = Math.max(0, Math.min(height - 2, Math.floor(y)));
    const fx = Math.max(0, Math.min(1, x - x0));
    const fy = Math.max(0, Math.min(1, y - y0));

    const idx00 = y0 * width + x0;
    const v00 = gray[idx00];
    const v10 = gray[idx00 + 1];
    const v01 = gray[idx00 + width];
    const v11 = gray[idx00 + width + 1];

    return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
  }

  simplifyPolygonRDP(points, epsilon) {
    let idx1 = 0;
    let maxDistSq = -1;
    const step = Math.max(1, Math.floor(points.length / 40));
    for (let i = 0; i < points.length; i += step) {
      const dx = points[i].x - points[0].x;
      const dy = points[i].y - points[0].y;
      const d = dx * dx + dy * dy;
      if (d > maxDistSq) {
        maxDistSq = d;
        idx1 = i;
      }
    }

    let idx2 = 0;
    maxDistSq = -1;
    for (let i = 0; i < points.length; i += step) {
      const dx = points[i].x - points[idx1].x;
      const dy = points[i].y - points[idx1].y;
      const d = dx * dx + dy * dy;
      if (d > maxDistSq) {
        maxDistSq = d;
        idx2 = i;
      }
    }

    const iMin = Math.min(idx1, idx2);
    const iMax = Math.max(idx1, idx2);
    const chain1 = points.slice(iMin, iMax + 1);
    const chain2 = points.slice(iMax).concat(points.slice(0, iMin + 1));

    const simp1 = this.rdpRecursive(chain1, epsilon);
    const simp2 = this.rdpRecursive(chain2, epsilon);
    return simp1.slice(0, -1).concat(simp2.slice(0, -1));
  }

  rdpRecursive(pts, eps) {
    if (pts.length <= 2) return pts;
    const first = pts[0];
    const last = pts[pts.length - 1];
    let maxDist = -1;
    let index = 0;

    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const lenSq = dx * dx + dy * dy;

    for (let i = 1; i < pts.length - 1; i++) {
      let dist;
      if (lenSq === 0) {
        dist = Math.hypot(pts[i].x - first.x, pts[i].y - first.y);
      } else {
        dist = Math.abs(dy * pts[i].x - dx * pts[i].y + last.x * first.y - last.y * first.x) / Math.sqrt(lenSq);
      }
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > eps) {
      const left = this.rdpRecursive(pts.slice(0, index + 1), eps);
      const right = this.rdpRecursive(pts.slice(index), eps);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  }

  selectBestFourCorners(poly) {
    const pts = poly.slice();
    while (pts.length > 4) {
      let minArea = Infinity;
      let removeIdx = 0;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const area = Math.abs((p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y)) * 0.5);
        if (area < minArea) {
          minArea = area;
          removeIdx = i;
        }
      }
      pts.splice(removeIdx, 1);
    }
    return pts;
  }

  orderClockwise(pts) {
    const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) * 0.25;
    const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) * 0.25;
    const sorted = pts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    let tlIdx = 0;
    let minSum = Infinity;
    for (let i = 0; i < 4; i++) {
      const s = sorted[i].x + sorted[i].y;
      if (s < minSum) {
        minSum = s;
        tlIdx = i;
      }
    }
    return [
      sorted[tlIdx],
      sorted[(tlIdx + 1) % 4],
      sorted[(tlIdx + 2) % 4],
      sorted[(tlIdx + 3) % 4]
    ];
  }

  isConvexQuad(q) {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const p0 = q[i];
      const p1 = q[(i + 1) % 4];
      const p2 = q[(i + 2) % 4];
      const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
      if (Math.abs(cross) < 12) return false;
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (sign !== s) return false;
    }
    return true;
  }

  computeUnitToQuadHomography(q) {
    const x0 = q[0].x, y0 = q[0].y;
    const x1 = q[1].x, y1 = q[1].y;
    const x2 = q[2].x, y2 = q[2].y;
    const x3 = q[3].x, y3 = q[3].y;

    const dx1 = x1 - x2, dy1 = y1 - y2;
    const dx2 = x3 - x2, dy2 = y3 - y2;
    const sx = x0 - x1 + x2 - x3;
    const sy = y0 - y1 + y2 - y3;

    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) < 1e-6) return null;

    const g = (sx * dy2 - sy * dx2) / det;
    const h = (dx1 * sy - dy1 * sx) / det;
    const a = x1 - x0 + g * x1;
    const b = x3 - x0 + h * x3;
    const c = x0;
    const d = y1 - y0 + g * y1;
    const e = y3 - y0 + h * y3;
    const f = y0;

    return { a, b, c, d, e, f, g, h };
  }

  projectPoint(H, u, v) {
    const denom = H.g * u + H.h * v + 1.0;
    return {
      x: (H.a * u + H.b * v + H.c) / denom,
      y: (H.d * u + H.e * v + H.f) / denom
    };
  }

  decodeQuad(rawQuad, gray, width, height, viewWidth, viewHeight, fovDeg) {
    const quad = this.refineCornersSubPixel(rawQuad, gray, width, height);
    const H = this.computeUnitToQuadHomography(quad);
    if (!H) return null;

    const cellValues = new Float32Array(49);
    let minVal = 255;
    let maxVal = 0;

    const offsets = [-0.2, 0.0, 0.2];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        let sum = 0;
        for (let oy of offsets) {
          for (let ox of offsets) {
            const u = (c + 0.5 + ox) / 7.0;
            const v = (r + 0.5 + oy) / 7.0;
            const pt = this.projectPoint(H, u, v);
            const px = Math.round(pt.x);
            const py = Math.round(pt.y);
            if (px < 0 || px >= width || py < 0 || py >= height) return null;
            sum += gray[py * width + px];
          }
        }
        const avg = sum / 9.0;
        cellValues[r * 7 + c] = avg;
        if (avg < minVal) minVal = avg;
        if (avg > maxVal) maxVal = avg;
      }
    }

    if (maxVal - minVal < 28) return null;
    const threshold = (minVal + maxVal) * 0.5;

    let borderErrors = 0;
    for (let i = 0; i < 7; i++) {
      if (cellValues[0 * 7 + i] > threshold) borderErrors++;
      if (cellValues[6 * 7 + i] > threshold) borderErrors++;
      if (i > 0 && i < 6) {
        if (cellValues[i * 7 + 0] > threshold) borderErrors++;
        if (cellValues[i * 7 + 6] > threshold) borderErrors++;
      }
    }
    if (borderErrors > 2) return null;

    const innerBits = new Array(25);
    let idx = 0;
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 5; c++) {
        innerBits[idx++] = cellValues[r * 7 + c] > threshold ? 1 : 0;
      }
    }

    let bestMatch = null;
    let bestHamming = 99;

    for (const entry of ROTATED_DICTIONARY) {
      let hamming = 0;
      const target = entry.flatBits;
      for (let k = 0; k < 25; k++) {
        if (innerBits[k] !== target[k]) {
          hamming++;
          if (hamming >= bestHamming) break;
        }
      }
      if (hamming < bestHamming) {
        bestHamming = hamming;
        bestMatch = entry;
      }
    }

    if (!bestMatch || bestHamming > 2) return null;

    const shift = (4 - bestMatch.rotation) % 4;
    const orientedCorners = [
      quad[(0 + shift) % 4],
      quad[(1 + shift) % 4],
      quad[(2 + shift) % 4],
      quad[(3 + shift) % 4]
    ];

    const pose = this.estimatePose6DoF(orientedCorners, width, height, viewWidth, viewHeight, fovDeg);

    return {
      id: bestMatch.id,
      code: bestMatch.code,
      hamming: bestHamming,
      corners: orientedCorners,
      area: pose.area,
      pose
    };
  }

  /**
   * Extrai os vetores 2D projetados (vx, vz) e o centro (uc, vc) no plano métrico Z = -1 da câmera
   * para decomposição analítica por Valores Singulares (SVD 2x2 + Pitágoras), garantindo
   * rotação 3D real em qualquer ângulo (0° a 75°) sem ruído de ponto de fuga!
   */
  estimatePose6DoF(corners, cvW, cvH, viewW, viewH, fovDeg = 48) {
    const videoAspect = cvW / cvH;
    const viewAspect = viewW / viewH;
    let drawW, drawH, offsetX, offsetY;
    if (viewAspect > videoAspect) {
      drawW = viewW;
      drawH = viewW / videoAspect;
      offsetX = 0;
      offsetY = (viewH - drawH) * 0.5;
    } else {
      drawH = viewH;
      drawW = viewH * videoAspect;
      offsetX = (viewW - drawW) * 0.5;
      offsetY = 0;
    }

    const tanHalfFov = Math.tan((fovDeg * Math.PI) / 360.0);

    const q = corners.map(pt => {
      const sx = offsetX + (pt.x / cvW) * drawW;
      const sy = offsetY + (pt.y / cvH) * drawH;
      const ndcX = (sx / viewW) * 2.0 - 1.0;
      const ndcY = 1.0 - (sy / viewH) * 2.0;
      return {
        u: ndcX * tanHalfFov * viewAspect,
        v: ndcY * tanHalfFov
      };
    });

    const uc = 0.25 * (q[0].u + q[1].u + q[2].u + q[3].u);
    const vc = 0.25 * (q[0].v + q[1].v + q[2].v + q[3].v);

    // Vetores médios das arestas horizontais (+X da carta) e verticais (+Z topo->base da carta)
    const vx = {
      x: 0.5 * (q[1].u - q[0].u + (q[2].u - q[3].u)),
      y: 0.5 * (q[1].v - q[0].v + (q[2].v - q[3].v))
    };
    const vz = {
      x: 0.5 * (q[3].u - q[0].u + (q[2].u - q[1].u)),
      y: 0.5 * (q[3].v - q[0].v + (q[2].v - q[1].v))
    };

    const topLen = Math.hypot(q[1].u - q[0].u, q[1].v - q[0].v);
    const botLen = Math.hypot(q[2].u - q[3].u, q[2].v - q[3].v);
    const leftLen = Math.hypot(q[3].u - q[0].u, q[3].v - q[0].v);
    const rightLen = Math.hypot(q[2].u - q[1].u, q[2].v - q[1].v);

    const topEdgePx = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const rightEdgePx = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
    const avgMarkerPx = 0.5 * (topEdgePx + rightEdgePx);

    return {
      uc,
      vc,
      vx,
      vz,
      topLen,
      botLen,
      leftLen,
      rightLen,
      area: avgMarkerPx * avgMarkerPx
    };
  }
}
