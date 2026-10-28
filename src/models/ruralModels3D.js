/**
 * Fábrica de Modelos 3D Low-Poly + Texturas 2D em Estilo Cartoon Old-School (Anos 1930)
 * -----------------------------------------------------------------------------------------
 * - Sem rostos antropomórficos nos objetos/construções/plantas (estética de maquete ilustrada
 *   em nanquim, hachuras e paleta retrô estilo cenários de animação dos anos 1930).
 * - Elementos planos (Açude, Nascente, Plantações) desenhados na horizontal sobre a base
 *   para leitura perfeita vistos de cima ou em ângulo, combinados com relevos 3D.
 * - Árvores, Animais, Construções e Máquinas construídos com volumes 3D low-poly + camadas
 *   horizontais e verticais (nunca ficam "finos" quando olhados de cima).
 * - Pássaros da Mancha Florestal renderizados "deitados" (no plano horizontal XZ com asas
 *   abertas vistas de cima) batendo as asas sobre o dossel das árvores.
 */

import * as THREE from 'three';

const INK = '#18120e';
const CREAM = '#fcf4df';

export class RuralModelsFactory {
  constructor() {
    this.textureCache = new Map();
    this.materialCache = new Map();
    this.geometryCache = new Map();
  }

  getGeo(key, factoryFn) {
    if (!this.geometryCache.has(key)) {
      this.geometryCache.set(key, factoryFn());
    }
    return this.geometryCache.get(key);
  }

  /**
   * Gera ou recupera textura 2D em estilo ilustração de época (nanquim + guache anos 1930)
   */
  getCartoonTexture(key, width, height, drawFn) {
    if (this.textureCache.has(key)) {
      return this.textureCache.get(key);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawFn(ctx, width, height);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    this.textureCache.set(key, tex);
    return tex;
  }

  getCutoutMaterial(key, width, height, drawFn, opts = {}) {
    const matKey = `cutout_${key}_${opts.opacity ?? 1}`;
    if (this.materialCache.has(matKey)) {
      return this.materialCache.get(matKey);
    }
    const tex = this.getCartoonTexture(key, width, height, drawFn);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: opts.transparent ?? true,
      alphaTest: opts.alphaTest ?? 0.08,
      side: THREE.DoubleSide,
      opacity: opts.opacity ?? 1.0,
      depthWrite: opts.depthWrite ?? true
    });
    this.materialCache.set(matKey, mat);
    return mat;
  }

  getSolidMaterial(color) {
    const key = `solid_${color}`;
    if (!this.materialCache.has(key)) {
      this.materialCache.set(key, new THREE.MeshBasicMaterial({ color }));
    }
    return this.materialCache.get(key);
  }

  /**
   * Material de bloco 3D com bordas de nanquim e hachuras pintadas na textura
   */
  getInkedBoxMaterial(key, fillColor, shadeColor = null, detailFn = null) {
    return this.getCutoutMaterial(
      `inkbox_${key}_${fillColor}`,
      128,
      128,
      (ctx, W, H) => {
        ctx.fillStyle = fillColor;
        ctx.fillRect(0, 0, W, H);
        if (shadeColor) {
          ctx.fillStyle = shadeColor;
          ctx.fillRect(0, H * 0.68, W, H * 0.32);
        }
        this.drawHatchLines(ctx, 6, H - 34, W - 12, 28, 9, -0.6);
        if (detailFn) detailFn(ctx, W, H);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, W - 8, H - 8);
      },
      { transparent: false, alphaTest: 0 }
    );
  }

  // ===========================================================================
  // PRIMITIVAS DE ILUSTRAÇÃO OLD-SCHOOL (NANQUIM & HACHURAS)
  // ===========================================================================

  drawHatchLines(ctx, x, y, w, h, step = 10, angle = -0.6) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(24, 18, 14, 0.24)';
    ctx.lineWidth = 2.2;
    const diag = Math.hypot(w, h);
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(angle);
    for (let i = -diag; i <= diag; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, -diag);
      ctx.lineTo(i, diag);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRetroFlower(ctx, cx, cy, r, petalColor = '#f6c445') {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, r * 0.16);
    ctx.fillStyle = petalColor;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(a) * r * 0.68,
        cy + Math.sin(a) * r * 0.68,
        r * 0.48,
        r * 0.34,
        a,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Desenha um disco horizontal de folhagem visto de cima (evita que árvores/arbustos fiquem finos!)
   */
  createCanopyDiscMat(key, mainColor, shadeColor, accentFlowerColor = null) {
    return this.getCutoutMaterial(`canopy_disc_${key}`, 256, 256, (ctx, W, H) => {
      const cx = W / 2;
      const cy = H / 2;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 7;

      // Lóbulos arredondados da copa vista de cima
      ctx.fillStyle = shadeColor;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 66, cy + Math.sin(a) * 66, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = mainColor;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.35;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hachuras circulares e detalhes de folhas em nanquim
      this.drawHatchLines(ctx, 40, 40, W - 80, H - 80, 14, 0.5);

      if (accentFlowerColor) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.2;
          this.drawRetroFlower(ctx, cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, 16, accentFlowerColor);
        }
      }
    });
  }

  // ===========================================================================
  // CRIAÇÃO DO MODELO DE CADA CARTA
  // ===========================================================================

  createCardModel(card) {
    const root = new THREE.Group();
    root.name = `card_${card.code}`;
    root.userData = {
      cardId: card.id,
      code: card.code,
      animParts: {},
      phase: (card.id * 1.37) % (Math.PI * 2)
    };

    // 1. Base plana 1.02 x 1.02 desenhada especificamente para o terreno da carta
    const baseGroup = this.createBaseTile(card, root);
    root.add(baseGroup);

    // 2. Grupo de conteúdo 3D sobre a base
    const contentGroup = new THREE.Group();
    contentGroup.position.y = 0.04;
    root.add(contentGroup);
    root.userData.animParts.bounceGroup = contentGroup;

    this.buildElementBySubtype(card, contentGroup, root.userData.animParts);

    return root;
  }

  /**
   * Cria a base quadrada 1.02 x 1.02:
   * - No Açude e na Nascente, a própria base plana desenha o espelho d'água, margens e pedras!
   * - Nas Plantações, desenha os canteiros e sulcos de terra arada!
   * - Nos demais, desenha o terreno correspondente com moldura em nanquim anos 1930.
   */
  createBaseTile(card, root) {
    const group = new THREE.Group();
    const sub = card.subtype;

    const topMat = this.getCutoutMaterial(
      `base_surface_${card.code}`,
      384,
      384,
      (ctx, W, H) => {
        const cx = W / 2;
        const cy = H / 2;

        // Fundo base por categoria
        const bgColors = {
          floresta: '#6a9e48',
          agua: '#789c54',
          infraestrutura: '#d6ad72',
          lavoura: '#8c5e37',
          pecuaria: '#8ca84e',
          insumo: '#b89f6d'
        };
        ctx.fillStyle = bgColors[card.category] || '#789c54';
        ctx.fillRect(0, 0, W, H);

        // Moldura externa em nanquim
        ctx.strokeStyle = INK;
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, W - 16, H - 16);

        // Superfícies específicas desenhadas na base plana!
        if (sub === 'pond') {
          // AÇUDE PLANO NA BASE: Margem de pedras/areia + grande lagoa de água azul com ondas
          ctx.fillStyle = '#d9be8b';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 162, 148, 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Água principal do açude
          ctx.fillStyle = '#3b9fc4';
          ctx.beginPath();
          ctx.ellipse(cx, cy, 144, 130, 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Zona profunda central
          ctx.fillStyle = '#287ba1';
          ctx.beginPath();
          ctx.ellipse(cx - 10, cy + 6, 92, 78, 0.15, 0, Math.PI * 2);
          ctx.fill();

          // Ondulações concêntricas e reflexos em nanquim branco/preto
          ctx.strokeStyle = CREAM;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cx - 25, cy - 15, 55, 0.2, 1.8);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx + 30, cy + 25, 42, 3.4, 5.1);
          ctx.stroke();

          // Vitórias-régias planas na superfície da água
          ctx.fillStyle = '#52943e';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4;
          for (const [lx, ly, lr] of [[cx - 75, cy - 55, 22], [cx + 82, cy - 40, 18], [cx - 65, cy + 68, 20]]) {
            ctx.beginPath();
            ctx.arc(lx, ly, lr, 0.3, Math.PI * 1.9);
            ctx.lineTo(lx, ly);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else if (sub === 'spring') {
          // NASCENTE PLANA NA BASE: Olho d'água cristalino + córrego serpenteando
          ctx.fillStyle = '#528c42';
          ctx.fillRect(14, 14, W - 28, H - 28);

          // Bacia cristalina e riacho
          ctx.fillStyle = '#5ce1e6';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.ellipse(cx, cy + 18, 128, 105, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Pedras de rio ao redor da borda da nascente
          ctx.fillStyle = '#948d84';
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const rx = cx + Math.cos(a) * 126;
            const ry = cy + 18 + Math.sin(a) * 102;
            ctx.beginPath();
            ctx.ellipse(rx, ry, 24, 18, a, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        } else if (sub === 'grains' || sub === 'orchard') {
          // TERRA ARADA EM SULCOS HORIZONTAIS
          ctx.fillStyle = '#6e4726';
          ctx.fillRect(20, 20, W - 40, H - 40);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 5;
          for (let y = 48; y < H - 30; y += 44) {
            ctx.fillStyle = '#54341a';
            ctx.fillRect(32, y - 10, W - 64, 20);
            ctx.strokeRect(32, y - 10, W - 64, 20);
          }
        } else if (sub === 'pig') {
          // Poça de lama central no chiqueiro
          ctx.fillStyle = '#634124';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 130, 110, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          // Gramado/pátio vintage com sombra projetada suave no centro e hachuras nos cantos
          this.drawHatchLines(ctx, 16, 16, 64, 64, 10, -0.7);
          this.drawHatchLines(ctx, W - 80, H - 80, 64, 64, 10, -0.7);

          ctx.fillStyle = 'rgba(24, 18, 14, 0.26)';
          ctx.beginPath();
          ctx.ellipse(cx, cy, 108, 96, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.5;
        ctx.strokeRect(18, 18, W - 36, H - 36);
      },
      { transparent: false, alphaTest: 0 }
    );

    const sideMat = this.getSolidMaterial(INK);
    const boxGeo = this.getGeo('base_box', () => new THREE.BoxGeometry(1.02, 0.04, 1.02));
    const baseMesh = new THREE.Mesh(boxGeo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    baseMesh.position.y = 0.02;
    group.add(baseMesh);

    const ringGeo = this.getGeo('status_ring', () => {
      const g = new THREE.RingGeometry(0.68, 0.74, 4);
      g.rotateX(-Math.PI / 2);
      g.rotateY(Math.PI / 4);
      return g;
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: card.accentColor || '#f59e0b',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    });
    const statusRing = new THREE.Mesh(ringGeo, ringMat);
    statusRing.position.y = 0.042;
    group.add(statusRing);
    root.userData.statusRing = statusRing;

    return group;
  }

  /**
   * Calcula a base ortonormal exata que passa pelos centros 3D de duas cartas (posA e posB),
   * garantindo que o plano Y=0 da mescla NUNCA incline para cima/baixo cortando as cartas!
   */
  computePairPlaneTransform(meshA, meshB) {
    const posA = meshA.position;
    const posB = meshB.position;
    const mid = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
    const dist = posA.distanceTo(posB);

    // Eixo X aponta exatamente do centro da Carta A para o centro da Carta B
    const eX = new THREE.Vector3().subVectors(posB, posA);
    if (eX.lengthSq() < 1e-6) eX.set(1, 0, 0);
    else eX.normalize();

    // Normal média das duas cartas ortogonalizada contra eX
    const upA = new THREE.Vector3(0, 1, 0).applyQuaternion(meshA.quaternion);
    const upB = new THREE.Vector3(0, 1, 0).applyQuaternion(meshB.quaternion);
    const avgUp = new THREE.Vector3().addVectors(upA, upB).normalize();

    const eY = avgUp.clone().addScaledVector(eX, -avgUp.dot(eX)).normalize();
    const eZ = new THREE.Vector3().crossVectors(eX, eY).normalize();

    const rotMat = new THREE.Matrix4().makeBasis(eX, eY, eZ);
    const quat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

    return { mid, quat, dist };
  }

  /**
   * Calcula a base ortonormal e o centroide de caixa delimitadora para um AGROSSISTEMA DE 3 CARTAS
   * (meshA = Animal 1, meshB = Animal 2, meshC = Elemento Parceiro como Biodigestor/Celeiro/Galinheiro).
   * O eixo +X aponta do grupo de animais (A, B) em direção ao Elemento Parceiro (C), garantindo
   * que a usina/celeiro fique posicionada exatamente sobre a carta física correspondente!
   */
  computeTriplePlaneTransform(meshA, meshB, meshC) {
    const pA = meshA.position;
    const pB = meshB.position;
    const pC = meshC.position;

    const upA = new THREE.Vector3(0, 1, 0).applyQuaternion(meshA.quaternion);
    const upB = new THREE.Vector3(0, 1, 0).applyQuaternion(meshB.quaternion);
    const upC = new THREE.Vector3(0, 1, 0).applyQuaternion(meshC.quaternion);
    const eY = new THREE.Vector3().addVectors(upA, upB).add(upC).normalize();

    // Ponto médio dos dois animais (A e B) -> aponta para o parceiro (C)
    const midAB = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
    const dirToPartner = new THREE.Vector3().subVectors(pC, midAB);
    dirToPartner.addScaledVector(eY, -dirToPartner.dot(eY));

    const eX = new THREE.Vector3();
    if (dirToPartner.lengthSq() > 0.12) {
      eX.copy(dirToPartner).normalize();
    } else {
      // Caso o parceiro esteja exatamente no meio entre Animal 1 e Animal 2
      eX.subVectors(pB, pA);
      eX.addScaledVector(eY, -eX.dot(eY));
      if (eX.lengthSq() < 1e-6) eX.set(1, 0, 0);
      else eX.normalize();
    }

    const eZ = new THREE.Vector3().crossVectors(eX, eY).normalize();
    eY.crossVectors(eZ, eX).normalize();

    // Projeta as 3 cartas nos eixos (eX, eY, eZ) para centralizar a base cobrindo as 3 cartas
    const pts = [pA, pB, pC];
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let sumY = 0;
    for (const p of pts) {
      const x = p.dot(eX);
      const y = p.dot(eY);
      const z = p.dot(eZ);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      sumY += y;
    }

    const cx = 0.5 * (minX + maxX);
    const cy = sumY / 3.0;
    const cz = 0.5 * (minZ + maxZ);

    const mid = new THREE.Vector3()
      .addScaledVector(eX, cx)
      .addScaledVector(eY, cy)
      .addScaledVector(eZ, cz);

    const rotMat = new THREE.Matrix4().makeBasis(eX, eY, eZ);
    const quat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

    const spanW = Math.min(3.85, Math.max(2.65, (maxX - minX) + 1.04));
    const spanD = Math.min(2.10, Math.max(1.16, (maxZ - minZ) + 1.04));

    return { mid, quat, spanW, spanD };
  }

  /**
   * Cria a base 3D única (2x1 ou 3x1) de um Novo Modelo Fundido ou Agrossistema!
   */
  createUnifiedPairBase(type, spanW, spanD = 1.02) {
    const topMat = this.getCutoutMaterial(
      `unified_base_${type}`,
      512,
      256,
      (ctx, W, H) => {
        const cy = H / 2;
        const bgColors = {
          herd_cow: '#789c44',
          flock_chicken: '#cfa05e',
          herd_pig: '#9e7248',
          mansion_farmhouse: '#d4b47c',
          solar_park: '#7d9488',
          barn_complex: '#b58d58',
          mega_solar_barn: '#9c8b60',
          agrosystem_swine_biogas: '#829472',
          agrosystem_dairy_estate: '#769c46',
          agrosystem_cattle_biogas: '#7a9658',
          agrosystem_silvopasture: '#69943e',
          agrosystem_poultry_farm: '#c89b5a',
          agrosystem_agro_poultry: '#6f8c3d',
          agrosystem_solar_mansion: '#c2ab78',
          agrosystem_solar_barn: '#948d68',
          mega_crop: '#7c512d',
          mega_watershed: '#6c964c',
          mega_poultry: '#c99b5e',
          mega_dairy: '#7ea148',
          mega_biogas: '#829474',
          mega_solar_house: '#cfb07c'
        };
        ctx.fillStyle = bgColors[type] || '#7c512d';
        ctx.fillRect(0, 0, W, H);

        // Moldura externa dupla em nanquim anos 1930
        ctx.strokeStyle = INK;
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, W - 16, H - 16);

        if (type === 'mega_crop' || type === 'agrosystem_agro_poultry') {
          // Sulcos longos de terra arada
          ctx.fillStyle = '#54341a';
          ctx.lineWidth = 5;
          for (let y = 38; y <= H - 38; y += 38) {
            ctx.fillRect(28, y - 10, W - 56, 20);
            ctx.strokeRect(28, y - 10, W - 56, 20);
          }
        } else if (type === 'mega_watershed') {
          ctx.fillStyle = '#d9be8b';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.roundRect(28, 32, W - 56, H - 64, 80);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.roundRect(42, 46, W - 84, H - 92, 68);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = CREAM;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(85, cy - 15);
          ctx.bezierCurveTo(W * 0.4, cy - 35, W * 0.6, cy + 25, W - 95, cy);
          ctx.stroke();
        } else if (type === 'herd_pig' || type === 'agrosystem_swine_biogas') {
          // Grande lamaçal orgânico no piquete dos porcos + piso técnico na ala de biogás
          const mudX = type === 'agrosystem_swine_biogas' ? W * 0.30 : W * 0.48;
          ctx.fillStyle = '#5c3a1e';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.ellipse(mudX, cy + 10, 115, 72, 0.08, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Brilho de lama fresca em nanquim
          ctx.strokeStyle = '#8c5a32';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(mudX - 25, cy, 42, 0.2, 2.2);
          ctx.stroke();

          if (type === 'agrosystem_swine_biogas') {
            // Base circular técnica de concreto sob a Usina de Biogás (lado direito +X)
            ctx.fillStyle = '#cbd5e1';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(W * 0.76, cy, 74, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        } else if (type === 'herd_cow' || type === 'agrosystem_dairy_estate' || type === 'agrosystem_silvopasture' || type === 'agrosystem_cattle_biogas') {
          // Pastagem rotacionada com trilha campestre e tufos de capim em nanquim
          ctx.fillStyle = '#b8945f';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(W * 0.5, cy, W * 0.36, 48, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          this.drawHatchLines(ctx, 22, 22, 70, 56, 10, -0.7);
          this.drawHatchLines(ctx, W - 92, H - 78, 70, 56, 10, -0.7);
        } else if (type === 'flock_chicken' || type === 'agrosystem_poultry_farm') {
          // Terreiro avícola caipira com área de areia/terra batida e grãos de milho
          ctx.fillStyle = '#dfc188';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.roundRect(36, 36, W - 72, H - 72, 46);
          ctx.fill();
          ctx.stroke();

          // Grãos de milho dourados desenhados no chão
          ctx.fillStyle = '#facc15';
          for (let g = 0; g < 22; g++) {
            const gx = 70 + ((g * 73) % (W - 140));
            const gy = 56 + ((g * 47) % (H - 112));
            ctx.beginPath();
            ctx.arc(gx, gy, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (type === 'mansion_farmhouse' || type === 'agrosystem_solar_mansion') {
          // Jardim colonial com gramado lateral, calçada central de pedras e canteiros floridos
          ctx.fillStyle = '#6da346';
          ctx.fillRect(24, 24, W - 48, H - 48);

          ctx.fillStyle = '#d6c7b2';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.roundRect(W * 0.14, 38, W * 0.72, H - 76, 28);
          ctx.fill();
          ctx.stroke();
        } else if (type === 'solar_park' || type === 'agrosystem_solar_barn' || type === 'mega_solar_barn') {
          // Pátio técnico de cascalho claro com trilhas de cabos em nanquim
          ctx.fillStyle = '#cbd5e1';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 5;
          ctx.strokeRect(34, 34, W - 68, H - 68);
          this.drawHatchLines(ctx, 22, 22, 56, 56, 10, -0.7);
          this.drawHatchLines(ctx, W - 78, H - 78, 56, 56, 10, -0.7);
        } else {
          this.drawHatchLines(ctx, 18, 18, 64, 64, 10, -0.7);
          this.drawHatchLines(ctx, W - 82, H - 82, 64, 64, 10, -0.7);
        }

        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.5;
        ctx.strokeRect(18, 18, W - 36, H - 36);
      },
      { transparent: false, alphaTest: 0 }
    );

    const sideMat = this.getSolidMaterial(INK);
    const boxGeo = new THREE.BoxGeometry(spanW, 0.04, spanD);
    const baseMesh = new THREE.Mesh(boxGeo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    baseMesh.position.y = 0.02;
    return baseMesh;
  }

  // ===========================================================================
  // CONSTRUTORES DE ANIMAIS 3D DETALHADOS EM NANQUIM (VACAS, GALINHAS, PORCOS, PATOS, AVES E CUTIAS)
  // ===========================================================================

  /**
   * Vaquinha Leiteira 3D Completa (Suporta 'holstein' malhada preta/branca e 'jersey' caramelo/marrom!)
   * Corpo malhado, cabeça com olhos brilhantes, focinho rosado com narinas, chifres dourados,
   * orelhas caídas, sineta dourada no pescoço, úbere, 4 patas com cascos e rabinho!
   */
  createDetailedCow3D(scale = 1.0, variant = 'holstein') {
    const cow = new THREE.Group();
    cow.scale.setScalar(scale);

    const isJersey = variant === 'jersey';
    const baseCoat = isJersey ? '#c87d46' : CREAM;
    const shadeCoat = isJersey ? '#9c5a28' : '#e2d9c5';
    const spotColor = isJersey ? '#5c3012' : INK;

    const hideMat = this.getInkedBoxMaterial(`cow_hide_${variant}`, baseCoat, shadeCoat, (ctx, W, H) => {
      ctx.fillStyle = spotColor;
      ctx.beginPath();
      ctx.ellipse(W * 0.32, H * 0.42, 26, 20, 0.3, 0, Math.PI * 2);
      ctx.ellipse(W * 0.72, H * 0.60, 22, 18, -0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    const faceMat = this.getInkedBoxMaterial(`cow_face_${variant}`, baseCoat, shadeCoat, (ctx, W, H) => {
      for (const ex of [W * 0.28, W * 0.72]) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(ex, H * 0.42, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 3, H * 0.39, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const snoutMat = this.getInkedBoxMaterial('cow_snout_det', '#f4a298', '#e07a70', (ctx, W, H) => {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(W * 0.32, H * 0.48, 7, 0, Math.PI * 2);
      ctx.arc(W * 0.68, H * 0.48, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    const darkMat = this.getInkedBoxMaterial('cow_dark_det', '#26201c');
    const goldMat = this.getInkedBoxMaterial('cow_bell_det', '#facc15', '#ca8a04');

    const torso = new THREE.Mesh(this.getGeo('dcow_torso', () => new THREE.BoxGeometry(0.24, 0.20, 0.40)), hideMat);
    torso.position.set(0, 0.21, 0);
    cow.add(torso);

    const udder = new THREE.Mesh(this.getGeo('dcow_udder', () => new THREE.BoxGeometry(0.12, 0.06, 0.12)), snoutMat);
    udder.position.set(0, 0.10, -0.06);
    cow.add(udder);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.28, 0.22);

    const head = new THREE.Mesh(this.getGeo('dcow_head', () => new THREE.BoxGeometry(0.18, 0.16, 0.17)), faceMat);
    headGroup.add(head);

    const snout = new THREE.Mesh(this.getGeo('dcow_snout', () => new THREE.BoxGeometry(0.19, 0.10, 0.09)), snoutMat);
    snout.position.set(0, -0.03, 0.11);
    headGroup.add(snout);

    const earGeo = this.getGeo('dcow_ear', () => new THREE.BoxGeometry(0.09, 0.04, 0.05));
    const hornGeo = this.getGeo('dcow_horn', () => new THREE.ConeGeometry(0.025, 0.08, 6));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, darkMat);
      ear.position.set(sx * 0.12, 0.03, -0.02);
      ear.rotation.z = sx * -0.25;
      headGroup.add(ear);

      const horn = new THREE.Mesh(hornGeo, goldMat);
      horn.position.set(sx * 0.065, 0.11, -0.01);
      horn.rotation.z = sx * -0.2;
      headGroup.add(horn);
    }

    const bell = new THREE.Mesh(this.getGeo('dcow_bell', () => new THREE.CylinderGeometry(0.025, 0.038, 0.05, 6)), goldMat);
    bell.position.set(0, -0.10, 0.02);
    headGroup.add(bell);

    cow.add(headGroup);

    const legGeo = this.getGeo('dcow_leg', () => new THREE.BoxGeometry(0.06, 0.12, 0.06));
    const hoofGeo = this.getGeo('dcow_hoof', () => new THREE.BoxGeometry(0.065, 0.035, 0.065));
    for (const [lx, lz] of [[-0.08, -0.14], [0.08, -0.14], [-0.08, 0.14], [0.08, 0.14]]) {
      const leg = new THREE.Mesh(legGeo, hideMat);
      leg.position.set(lx, 0.07, lz);
      cow.add(leg);

      const hoof = new THREE.Mesh(hoofGeo, darkMat);
      hoof.position.set(lx, 0.018, lz);
      cow.add(hoof);
    }

    const tail = new THREE.Mesh(this.getGeo('dcow_tail', () => new THREE.CylinderGeometry(0.015, 0.02, 0.18, 5)), darkMat);
    tail.position.set(0, 0.19, -0.22);
    tail.rotation.x = 0.35;
    cow.add(tail);

    return cow;
  }

  /**
   * Galinha Branca / Carijó / Galo Caipira / Pintinho 3D Detalhado!
   * Variantes: 'white', 'brown' (carijó), 'rooster' (galo imponente de cauda verde-escura), 'chick' (pintinho)
   */
  createDetailedChicken3D(scale = 1.0, variant = 'white') {
    const chk = new THREE.Group();
    chk.scale.setScalar(scale);

    const colors = {
      white: { main: CREAM, shade: '#e5dcc8', wing: '#f3ead6', tail: '#e5dcc8' },
      brown: { main: '#c86428', shade: '#964515', wing: '#ad501b', tail: '#7c340f' },
      rooster: { main: '#ea580c', shade: '#b45309', wing: '#9a3412', tail: '#064e3b' },
      chick: { main: '#fde047', shade: '#eab308', wing: '#facc15', tail: '#eab308' }
    };
    const pal = colors[variant] || colors.white;

    const bodyMat = this.getInkedBoxMaterial(`dchk_body_${variant}`, pal.main, pal.shade);
    const wingMat = this.getInkedBoxMaterial(`dchk_wing_${variant}`, pal.wing, pal.shade, (ctx, W, H) => {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(W * 0.5, (H * i) / 3, 28, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
    });
    const tailMat = this.getInkedBoxMaterial(`dchk_tail_${variant}`, pal.tail, INK);
    const headMat = this.getInkedBoxMaterial(`dchk_head_${variant}`, pal.main, pal.shade, (ctx, W, H) => {
      for (const ex of [W * 0.25, W * 0.75]) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(ex, H * 0.45, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const redMat = this.getInkedBoxMaterial('dchk_red', '#dc2626', '#991b1b');
    const beakMat = this.getInkedBoxMaterial('dchk_beak', '#f59e0b', '#d97706');

    const body = new THREE.Mesh(this.getGeo('dchk_body_g', () => new THREE.BoxGeometry(0.15, 0.14, 0.19)), bodyMat);
    body.position.set(0, 0.12, 0);
    chk.add(body);

    const wingGeo = this.getGeo('dchk_wing_g', () => new THREE.BoxGeometry(0.035, 0.10, 0.13));
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(sx * 0.088, 0.12, -0.01);
      chk.add(wing);
    }

    if (variant !== 'chick') {
      const isRooster = variant === 'rooster';
      const tailGeo = this.getGeo(
        isRooster ? 'dchk_tail_rooster' : 'dchk_tail_g',
        () => new THREE.BoxGeometry(0.09, isRooster ? 0.18 : 0.12, isRooster ? 0.11 : 0.08)
      );
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(0, isRooster ? 0.21 : 0.18, -0.11);
      tail.rotation.x = -0.48;
      chk.add(tail);
    }

    const head = new THREE.Mesh(this.getGeo('dchk_head_g', () => new THREE.BoxGeometry(0.11, 0.11, 0.11)), headMat);
    head.position.set(0, 0.21, 0.08);
    chk.add(head);

    if (variant !== 'chick') {
      const isRooster = variant === 'rooster';
      const comb = new THREE.Mesh(
        this.getGeo(isRooster ? 'dchk_comb_r' : 'dchk_comb_g', () => new THREE.BoxGeometry(0.036, isRooster ? 0.085 : 0.06, 0.095)),
        redMat
      );
      comb.position.set(0, isRooster ? 0.30 : 0.285, 0.08);
      chk.add(comb);

      const wattle = new THREE.Mesh(this.getGeo('dchk_wat_g', () => new THREE.BoxGeometry(0.03, 0.045, 0.04)), redMat);
      wattle.position.set(0, 0.15, 0.13);
      chk.add(wattle);
    }

    const beak = new THREE.Mesh(this.getGeo('dchk_beak_cone', () => new THREE.ConeGeometry(0.032, 0.065, 4)), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.20, 0.16);
    chk.add(beak);

    const legGeo = this.getGeo('dchk_leg_g', () => new THREE.BoxGeometry(0.025, 0.06, 0.04));
    for (const sx of [-0.04, 0.04]) {
      const leg = new THREE.Mesh(legGeo, beakMat);
      leg.position.set(sx, 0.03, 0.01);
      chk.add(leg);
    }

    return chk;
  }

  /**
   * Porquinho 3D Detalhado (Suporta 'pink' rosado clássico e 'spotted' Porco Piau malhado!)
   */
  createDetailedPig3D(scale = 1.0, variant = 'pink') {
    const pig = new THREE.Group();
    pig.scale.setScalar(scale);

    const isSpotted = variant === 'spotted';
    const pinkMat = this.getInkedBoxMaterial(
      `dpig_body_${variant}`,
      '#f4978e',
      '#e57c73',
      isSpotted
        ? (ctx, W, H) => {
            ctx.fillStyle = '#4a2c18';
            ctx.beginPath();
            ctx.ellipse(W * 0.35, H * 0.42, 24, 18, 0.2, 0, Math.PI * 2);
            ctx.ellipse(W * 0.68, H * 0.58, 20, 16, -0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        : null
    );
    const faceMat = this.getInkedBoxMaterial('dpig_face', '#f4978e', '#e57c73', (ctx, W, H) => {
      for (const ex of [W * 0.28, W * 0.72]) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(ex, H * 0.38, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const snoutMat = this.getInkedBoxMaterial('dpig_snout', '#e0575b', '#c94044', (ctx, W, H) => {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(W * 0.34, H * 0.5, 7, 11, 0, 0, Math.PI * 2);
      ctx.ellipse(W * 0.66, H * 0.5, 7, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    const hoofMat = this.getInkedBoxMaterial('dpig_hoof', '#4a2c18');

    const body = new THREE.Mesh(this.getGeo('dpig_body', () => new THREE.BoxGeometry(0.21, 0.17, 0.28)), pinkMat);
    body.position.set(0, 0.14, 0);
    pig.add(body);

    const head = new THREE.Mesh(this.getGeo('dpig_head', () => new THREE.BoxGeometry(0.17, 0.15, 0.14)), faceMat);
    head.position.set(0, 0.17, 0.16);
    pig.add(head);

    const snout = new THREE.Mesh(this.getGeo('dpig_snout_g', () => new THREE.BoxGeometry(0.11, 0.085, 0.055)), snoutMat);
    snout.position.set(0, 0.15, 0.25);
    pig.add(snout);

    const earGeo = this.getGeo('dpig_ear', () => new THREE.BoxGeometry(0.06, 0.06, 0.03));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, isSpotted ? hoofMat : snoutMat);
      ear.position.set(sx * 0.065, 0.25, 0.17);
      ear.rotation.set(0.35, 0, sx * -0.25);
      pig.add(ear);
    }

    const legGeo = this.getGeo('dpig_leg', () => new THREE.BoxGeometry(0.05, 0.08, 0.05));
    for (const [lx, lz] of [[-0.065, -0.09], [0.065, -0.09], [-0.065, 0.09], [0.065, 0.09]]) {
      const leg = new THREE.Mesh(legGeo, hoofMat);
      leg.position.set(lx, 0.04, lz);
      pig.add(leg);
    }

    const tail = new THREE.Mesh(this.getGeo('dpig_tail', () => new THREE.BoxGeometry(0.04, 0.04, 0.05)), snoutMat);
    tail.position.set(0, 0.18, -0.16);
    pig.add(tail);

    return pig;
  }

  /**
   * Utilitários Rurais 3D Detalhados (Cercas de Madeira, Cochos/Bebedouros, Rolos de Feno e Latões de Leite)
   */
  createWoodFenceSection(length = 0.56) {
    const fence = new THREE.Group();
    const woodMat = this.getInkedBoxMaterial('u_wood', '#9c6638', '#6e4522');
    const postGeo = this.getGeo('fence_post_g', () => new THREE.BoxGeometry(0.045, 0.16, 0.045));

    const numPosts = Math.max(2, Math.round(length / 0.26) + 1);
    for (let i = 0; i < numPosts; i++) {
      const px = -length * 0.5 + (i / (numPosts - 1)) * length;
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(px, 0.08, 0);
      fence.add(post);
    }

    for (const ry of [0.06, 0.125]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length + 0.04, 0.025, 0.022), woodMat);
      rail.position.set(0, ry, 0);
      fence.add(rail);
    }
    return fence;
  }

  createTrough3D(width = 0.34, fillType = 'water') {
    const trough = new THREE.Group();
    const woodMat = this.getInkedBoxMaterial('u_wood', '#9c6638', '#6e4522');
    const fillColors = {
      water: ['#38bdf8', '#0284c7'],
      corn: ['#facc15', '#ca8a04'],
      silage: ['#65a30d', '#3f6212']
    };
    const [c1, c2] = fillColors[fillType] || fillColors.water;
    const fillMat = this.getInkedBoxMaterial(`trough_fill_${fillType}`, c1, c2);

    const outer = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.15), woodMat);
    outer.position.y = 0.04;
    trough.add(outer);

    const inner = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, 0.03, 0.11), fillMat);
    inner.position.y = 0.072;
    trough.add(inner);

    return trough;
  }

  createHayBale3D(scale = 1.0) {
    const strawMat = this.getInkedBoxMaterial('hay_roll', '#eab308', '#ca8a04', (ctx, W, H) => {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.32);
      ctx.lineTo(W, H * 0.32);
      ctx.moveTo(0, H * 0.68);
      ctx.lineTo(W, H * 0.68);
      ctx.stroke();
    });
    const baleGeo = this.getGeo('hay_bale_cyl', () => {
      const g = new THREE.CylinderGeometry(0.085, 0.085, 0.16, 8);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const bale = new THREE.Mesh(baleGeo, strawMat);
    bale.scale.setScalar(scale);
    bale.position.y = 0.085 * scale;
    return bale;
  }

  createStandTree3D(subtype = 'ipe', scale = 1.0) {
    const tree = new THREE.Group();
    tree.scale.setScalar(scale);
    const palettes = {
      ipe: { main: '#f5b82e', shade: '#d48c12', trunk: '#6e4224', accent: '#fff6cc' },
      araucaria: { main: '#2f6e36', shade: '#1e4d24', trunk: '#543118', accent: null },
      jatoba: { main: '#4c8f3a', shade: '#316324', trunk: '#633b1e', accent: '#e07a5f' }
    };
    const pal = palettes[subtype] || palettes.jatoba;
    const trunkMat = this.getInkedBoxMaterial(`trunk_${subtype}`, pal.trunk, '#3d2210');
    const trunk = new THREE.Mesh(this.getGeo('stand_trunk', () => new THREE.CylinderGeometry(0.055, 0.09, 0.50, 6)), trunkMat);
    trunk.position.y = 0.25;
    tree.add(trunk);

    const discMat = this.createCanopyDiscMat(`canopy_${subtype}`, pal.main, pal.shade, pal.accent);
    const discGeo = this.getGeo('canopy_disc_geo', () => {
      const g = new THREE.PlaneGeometry(0.76, 0.76);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    for (const [dy, sc] of [[0.42, 0.92], [0.54, 0.72]]) {
      const d = new THREE.Mesh(discGeo, discMat);
      d.position.y = dy;
      d.scale.setScalar(sc);
      tree.add(d);
    }
    return tree;
  }

  /**
   * Patinho / Marreco 3D Nadando na Lagoa
   */
  createDetailedDuck3D(scale = 1.0) {
    const duck = new THREE.Group();
    duck.scale.setScalar(scale);

    const whiteMat = this.getInkedBoxMaterial('dduck_w', CREAM, '#e2d9c5');
    const greenMat = this.getInkedBoxMaterial('dduck_g', '#15803d', '#14532d');
    const billMat = this.getInkedBoxMaterial('dduck_b', '#facc15', '#ca8a04');

    const body = new THREE.Mesh(this.getGeo('dduck_body', () => new THREE.BoxGeometry(0.11, 0.07, 0.17)), whiteMat);
    body.position.set(0, 0.035, 0);
    duck.add(body);

    const head = new THREE.Mesh(this.getGeo('dduck_head', () => new THREE.BoxGeometry(0.08, 0.09, 0.08)), greenMat);
    head.position.set(0, 0.09, 0.06);
    duck.add(head);

    const bill = new THREE.Mesh(this.getGeo('dduck_bill', () => new THREE.BoxGeometry(0.06, 0.025, 0.06)), billMat);
    bill.position.set(0, 0.08, 0.12);
    duck.add(bill);

    return duck;
  }

  /**
   * Cutia / Esquilo Silvestre 3D Detalhado (para a Mancha Florestal Nv.3)
   */
  createDetailedRodent3D(scale = 1.0) {
    const rod = new THREE.Group();
    rod.scale.setScalar(scale);

    const furMat = this.getInkedBoxMaterial('drod_fur', '#b45309', '#78350f');
    const tailMat = this.getInkedBoxMaterial('drod_tail', '#78350f', '#451a03');
    const darkMat = this.getInkedBoxMaterial('drod_dark', INK);

    const body = new THREE.Mesh(this.getGeo('drod_body', () => new THREE.BoxGeometry(0.09, 0.08, 0.14)), furMat);
    body.position.set(0, 0.05, 0);
    rod.add(body);

    const head = new THREE.Mesh(this.getGeo('drod_head', () => new THREE.BoxGeometry(0.075, 0.075, 0.08)), furMat);
    head.position.set(0, 0.08, 0.08);
    rod.add(head);

    const nose = new THREE.Mesh(this.getGeo('drod_nose', () => new THREE.BoxGeometry(0.03, 0.025, 0.03)), darkMat);
    nose.position.set(0, 0.08, 0.13);
    rod.add(nose);

    const tail = new THREE.Mesh(this.getGeo('drod_tail_g', () => new THREE.BoxGeometry(0.065, 0.11, 0.065)), tailMat);
    tail.position.set(0, 0.09, -0.09);
    tail.rotation.x = -0.35;
    rod.add(tail);

    return rod;
  }

  /**
   * Pássaro 3D Híbrido (Corpo 3D + Asas "Deitadas" no Plano Horizontal XZ vistas de cima!)
   * Variantes: 0 = Arara Vermelha/Azul, 1 = Tucano de Bico Dourado, 2 = Sanhaço Azul
   */
  createDetailedBird3D(variant = 0) {
    const birdGroup = new THREE.Group();

    const wingMat = this.getCutoutMaterial(`bird_wing_v${variant}`, 256, 256, (ctx, W, H) => {
      const cx = W / 2;
      const cy = H / 2;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;

      const palettes = [
        { wing: '#ef4444', tip: '#2563eb', body: '#dc2626', beak: '#facc15', tail: '#2563eb' }, // Arara
        { wing: '#1e293b', tip: '#0f172a', body: '#0f172a', beak: '#f97316', tail: '#ef4444' }, // Tucano
        { wing: '#38bdf8', tip: '#1d4ed8', body: '#0284c7', beak: '#facc15', tail: '#1e40af' }  // Azulão
      ];
      const pal = palettes[variant % palettes.length];

      for (const sx of [-1, 1]) {
        ctx.fillStyle = pal.wing;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 18);
        ctx.quadraticCurveTo(cx + sx * 105, cy - 42, cx + sx * 112, cy + 8);
        ctx.quadraticCurveTo(cx + sx * 75, cy + 36, cx, cy + 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pal.tip;
        ctx.beginPath();
        ctx.ellipse(cx + sx * 92, cy + 2, 22, 16, sx * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = pal.tail;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 22);
      ctx.lineTo(cx - 28, cy + 96);
      ctx.lineTo(cx + 28, cy + 96);
      ctx.lineTo(cx + 12, cy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pal.body;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 22, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const beakLen = variant % 3 === 1 ? 88 : 66;
      ctx.fillStyle = pal.beak;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 34);
      ctx.lineTo(cx + 12, cy - 34);
      ctx.lineTo(cx, cy - beakLen);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    const flatGeo = this.getGeo('bird_flat_xz_det', () => {
      const g = new THREE.PlaneGeometry(0.44, 0.44);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const wingMesh = new THREE.Mesh(flatGeo, wingMat);
    birdGroup.add(wingMesh);

    const bodyColors = ['#dc2626', '#1e293b', '#0284c7'];
    const body3D = new THREE.Mesh(
      this.getGeo('bird_3d_core', () => new THREE.BoxGeometry(0.06, 0.05, 0.14)),
      this.getInkedBoxMaterial(`bcore_${variant}`, bodyColors[variant % 3])
    );
    birdGroup.add(body3D);

    return birdGroup;
  }

  /**
   * Abelhinha Polinizadora 3D + Top-Down Híbrida (Corpo 3D listrado amarelo e preto em nanquim +
   * Asas translúcidas "deitadas" no plano horizontal XZ para ficarem bem visíveis de cima e de lado!)
   */
  createDetailedBee3D(scale = 1.0) {
    const beeGroup = new THREE.Group();
    beeGroup.scale.setScalar(scale);

    // Asas abertas + silhueta listrada no plano horizontal XZ (vistas de cima na folha A4!)
    const beeWingMat = this.getCutoutMaterial('bee_topdown_1930', 192, 192, (ctx, W, H) => {
      const cx = W / 2;
      const cy = H / 2;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;

      // Par de asas brancas/celestes translúcidas abertas para os lados
      ctx.fillStyle = '#e0f2fe';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + sx * 46, cy - 4, 38, 22, sx * -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Asa menor traseira
        ctx.beginPath();
        ctx.ellipse(cx + sx * 34, cy + 16, 24, 14, sx * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Abdômen roliço amarelo-ouro com listras pretas em nanquim
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, 24, 34, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.clip();

      ctx.fillStyle = INK;
      for (const sy of [cy - 8, cy + 8, cy + 24]) {
        ctx.fillRect(cx - 30, sy, 60, 9);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, 24, 34, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Cabecinha preta e antenas na frente (-Y)
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx, cy - 28, 15, 0, Math.PI * 2);
      ctx.fill();
    });

    const wingGeo = this.getGeo('bee_wing_xz_geo', () => {
      const g = new THREE.PlaneGeometry(0.24, 0.24);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const wingMesh = new THREE.Mesh(wingGeo, beeWingMat);
    wingMesh.position.y = 0.02;
    beeGroup.add(wingMesh);
    beeGroup.userData.wings = wingMesh;

    // Corpinho 3D listrado amarelo e preto (dá volume quando visto de lado!)
    const bodyMat = this.getInkedBoxMaterial('bee_body_3d', '#facc15', '#eab308', (ctx, W, H) => {
      ctx.fillStyle = INK;
      ctx.fillRect(0, H * 0.22, W, H * 0.20);
      ctx.fillRect(0, H * 0.60, W, H * 0.20);
    });
    const body3D = new THREE.Mesh(
      this.getGeo('bee_core_3d', () => new THREE.BoxGeometry(0.055, 0.05, 0.095)),
      bodyMat
    );
    beeGroup.add(body3D);

    return beeGroup;
  }

  /**
   * Cria um grupo de enxame de abelhinhas forrageiras que aparece ao redor do Apiário e das plantas polinizadas!
   */
  createBeeSwarmGroup(maxBees = 8, radius = 0.36, baseHeight = 0.38) {
    const swarm = new THREE.Group();
    swarm.visible = false;
    const bees = [];

    for (let i = 0; i < maxBees; i++) {
      const bee = this.createDetailedBee3D(0.95 + (i % 3) * 0.08);
      swarm.add(bee);
      bees.push({
        mesh: bee,
        radius: radius * (0.65 + (i % 3) * 0.22),
        height: baseHeight + (i % 4) * 0.07,
        speed: 2.6 + (i % 4) * 0.45,
        phase: (i * Math.PI * 2) / maxBees,
        fig8: i % 2 === 0
      });
    }

    swarm.userData.bees = bees;
    return swarm;
  }

  /**
   * Transforma 2 cartas (Mescla 2x1) ou 3 cartas (Agrossistema 3x1) em UM ÚNICO NOVO MODELO 3D MAIOR!
   * Os modelos individuais das cartas ficam ocultos enquanto o modelo fundido existir.
   */
  buildMergedZone3D(zone, cardMeshesMap) {
    const group = new THREE.Group();
    group.name = zone.id;
    const anim = { flyers: [], windmillBlades: null, animals: [] };
    group.userData.anim = anim;

    const registerAnimal = (mesh, baseRotY, idx = 0, bobSpeed = 3.6) => {
      mesh.rotation.y = baseRotY;
      anim.animals.push({ mesh, baseRotY, phase: idx * 1.15, bobSpeed });
    };

    const isTriple = zone.members.length === 3;
    let spanW = 2.0;
    let spanD = 1.04;

    if (isTriple) {
      const meshA = cardMeshesMap?.get(zone.members[0].id);
      const meshB = cardMeshesMap?.get(zone.members[1].id);
      const meshC = cardMeshesMap?.get(zone.members[2].id);
      if (!meshA || !meshB || !meshC) return group;

      const tr = this.computeTriplePlaneTransform(meshA, meshB, meshC);
      group.position.copy(tr.mid);
      group.quaternion.copy(tr.quat);
      spanW = tr.spanW;
      spanD = tr.spanD;
    } else {
      const [m1, m2] = zone.members;
      const meshA = cardMeshesMap?.get(m1.id);
      const meshB = cardMeshesMap?.get(m2.id);
      if (!meshA || !meshB) return group;

      const tr = this.computePairPlaneTransform(meshA, meshB);
      group.position.copy(tr.mid);
      group.quaternion.copy(tr.quat);
      spanW = Math.max(1.88, tr.dist + 0.98);
      spanD = 1.04;
    }

    const halfSpan = (spanW - 0.36) * 0.5;
    const halfD = (spanD - 0.24) * 0.5;

    // 1. Base Única (2x1 ou 3x1) do Novo Elemento / Agrossistema
    const unifiedBase = this.createUnifiedPairBase(zone.type, spanW, spanD);
    group.add(unifiedBase);

    const content = new THREE.Group();
    content.position.y = 0.04;
    group.add(content);

    const woodMat = this.getInkedBoxMaterial('u_wood', '#9c6638', '#6e4522');
    const strawMat = this.getInkedBoxMaterial('u_straw', '#eab308', '#ca8a04');
    const redMat = this.getInkedBoxMaterial('u_red', '#bf3426', '#7f1d1d');
    const creamMat = this.getInkedBoxMaterial('u_cream', CREAM, '#e2d9c5');
    const siloMat = this.getInkedBoxMaterial('md_silo', '#d1d5db', '#9ca3af');
    const domeMat = this.getInkedBoxMaterial('mb_dome', '#3b6978', '#254652');
    const flameMat = this.getInkedBoxMaterial('mb_flame', '#38bdf8');
    const greenTankMat = this.getInkedBoxMaterial('mb_gtank', '#15803d', '#14532d');

    switch (zone.type) {
      // =======================================================================
      // A) MESCLAS 2x1 DO MESMO ANIMAL (1 + 2 -> POPULAÇÃO MAIOR!)
      // =======================================================================
      case 'herd_cow': {
        // REBANHO BOVINO MAIOR (Vaca I + Vaca II): 6 Bovinos (Holandesas, Jersey e Bezerros) + Piquete Completo!
        for (const zSide of [-halfD, halfD]) {
          const fence = this.createWoodFenceSection(spanW * 0.72);
          fence.position.set(0, 0, zSide);
          content.add(fence);
        }

        const waterTrough = this.createTrough3D(0.42, 'water');
        waterTrough.position.set(-halfSpan * 0.55, 0, -halfD * 0.62);
        content.add(waterTrough);

        const saltTrough = this.createTrough3D(0.32, 'corn');
        saltTrough.position.set(halfSpan * 0.58, 0, halfD * 0.62);
        content.add(saltTrough);

        for (const [bx, bz, rot] of [[-halfSpan * 0.78, halfD * 0.52, 0.3], [halfSpan * 0.78, -halfD * 0.55, -0.4]]) {
          const bale = this.createHayBale3D(1.0);
          bale.position.set(bx, 0.085, bz);
          bale.rotation.y = rot;
          content.add(bale);
        }

        const herdSpecs = [
          { x: -halfSpan * 0.62, z: 0.08, rot: 0.45, sc: 1.02, v: 'holstein' },
          { x: -halfSpan * 0.16, z: -0.18, rot: 0.85, sc: 0.98, v: 'jersey' },
          { x: halfSpan * 0.22, z: 0.14, rot: -0.55, sc: 1.0, v: 'holstein' },
          { x: halfSpan * 0.65, z: -0.06, rot: -0.95, sc: 0.96, v: 'jersey' },
          { x: -0.04, z: 0.24, rot: 0.15, sc: 0.66, v: 'holstein' },
          { x: halfSpan * 0.42, z: -0.24, rot: -1.2, sc: 0.64, v: 'jersey' }
        ];
        herdSpecs.forEach((sp, i) => {
          const cow = this.createDetailedCow3D(sp.sc, sp.v);
          cow.position.set(sp.x, 0, sp.z);
          content.add(cow);
          registerAnimal(cow, sp.rot, i, 3.2);
        });
        break;
      }

      case 'flock_chicken': {
        // BANDO DE GALINHAS CAIPIRAS MAIOR (Galinha I + Galinha II): 12 Aves (Galo + Galinhas Brancas/Carijós + Pintinhos)!
        for (const zSide of [-halfD, halfD]) {
          const fence = this.createWoodFenceSection(spanW * 0.68);
          fence.position.set(0, 0, zSide);
          content.add(fence);
        }

        // Poleiro duplo de madeira e 2 ninhos de palha com ovinhos
        const perch = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.14), woodMat);
        perch.position.set(-halfSpan * 0.68, 0.08, -halfD * 0.52);
        content.add(perch);

        for (const nx of [halfSpan * 0.55, halfSpan * 0.78]) {
          const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 8), strawMat);
          nest.position.set(nx, 0.03, -halfD * 0.56);
          content.add(nest);

          const egg = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), creamMat);
          egg.position.set(nx, 0.065, -halfD * 0.56);
          content.add(egg);
        }

        const feeder = this.createTrough3D(0.34, 'corn');
        feeder.position.set(0, 0, 0);
        content.add(feeder);

        // Bebedouro avícola cônico vermelho
        const drinker = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 8), redMat);
        drinker.position.set(-halfSpan * 0.32, 0.075, halfD * 0.55);
        content.add(drinker);

        const flockSpecs = [
          { x: -0.10, z: -0.18, rot: 0.3, sc: 1.12, type: 'rooster' },
          { x: -halfSpan * 0.62, z: 0.14, rot: 0.7, sc: 0.98, type: 'white' },
          { x: -halfSpan * 0.34, z: -0.12, rot: 1.1, sc: 0.96, type: 'brown' },
          { x: 0.24, z: 0.18, rot: -0.8, sc: 0.98, type: 'white' },
          { x: halfSpan * 0.48, z: 0.10, rot: -1.2, sc: 0.96, type: 'brown' },
          { x: halfSpan * 0.72, z: -0.08, rot: -1.7, sc: 0.94, type: 'white' },
          { x: -halfSpan * 0.12, z: 0.24, rot: 0.5, sc: 0.94, type: 'brown' },
          { x: -halfSpan * 0.48, z: 0.26, rot: 0.9, sc: 0.62, type: 'chick' },
          { x: -0.18, z: 0.08, rot: 0.4, sc: 0.60, type: 'chick' },
          { x: 0.14, z: -0.16, rot: -0.5, sc: 0.62, type: 'chick' },
          { x: halfSpan * 0.35, z: -0.22, rot: -1.1, sc: 0.58, type: 'chick' },
          { x: halfSpan * 0.60, z: 0.24, rot: 1.8, sc: 0.60, type: 'chick' }
        ];
        flockSpecs.forEach((sp, i) => {
          const bird = this.createDetailedChicken3D(sp.sc, sp.type);
          bird.position.set(sp.x, 0, sp.z);
          content.add(bird);
          registerAnimal(bird, sp.rot, i, 4.8);
        });
        break;
      }

      case 'herd_pig': {
        // VARA DE SUÍNOS MAIOR (Porco I + Porco II): 7 Porcos (Rosados, Piau Malhados e Leitões) + Lamaçal & Cochos!
        for (const zSide of [-halfD, halfD]) {
          const fence = this.createWoodFenceSection(spanW * 0.74);
          fence.position.set(0, 0, zSide);
          content.add(fence);
        }

        // Abrigo sombreado rústico num canto e grande cocho de milho no outro
        const shadeRoof = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.42), woodMat);
        shadeRoof.position.set(-halfSpan * 0.68, 0.24, -halfD * 0.35);
        shadeRoof.rotation.z = 0.12;
        content.add(shadeRoof);
        for (const [px, pz] of [[-halfSpan * 0.86, -halfD * 0.52], [-halfSpan * 0.50, -halfD * 0.52], [-halfSpan * 0.86, -halfD * 0.18], [-halfSpan * 0.50, -halfD * 0.18]]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.04), woodMat);
          p.position.set(px, 0.12, pz);
          content.add(p);
        }

        const cornTrough = this.createTrough3D(0.46, 'corn');
        cornTrough.position.set(halfSpan * 0.55, 0, -halfD * 0.55);
        content.add(cornTrough);

        const pigSpecs = [
          { x: -halfSpan * 0.55, z: 0.14, rot: 0.55, sc: 1.04, v: 'pink' },
          { x: -0.14, z: 0.06, rot: 0.25, sc: 1.0, v: 'spotted' },
          { x: 0.22, z: 0.16, rot: -0.65, sc: 1.02, v: 'pink' },
          { x: halfSpan * 0.64, z: 0.04, rot: -1.1, sc: 0.98, v: 'spotted' },
          { x: -halfSpan * 0.28, z: -0.20, rot: 0.95, sc: 0.68, v: 'pink' },
          { x: 0.06, z: -0.22, rot: -0.35, sc: 0.66, v: 'spotted' },
          { x: halfSpan * 0.38, z: -0.18, rot: -0.85, sc: 0.65, v: 'pink' }
        ];
        pigSpecs.forEach((sp, i) => {
          const pig = this.createDetailedPig3D(sp.sc, sp.v);
          pig.position.set(sp.x, 0, sp.z);
          content.add(pig);
          registerAnimal(pig, sp.rot, i, 3.8);
        });
        break;
      }

      case 'mansion_farmhouse': {
        // =====================================================================
        // CASARÃO COLONIAL DA FAZENDA (Casa I + Casa II — 2x1)
        // Corpo central de 2 andares + 2 Alas laterais simétricas + Varanda de Colunas + Chaminé + Jardim & Poço!
        // =====================================================================
        const mansionWallMat = this.getInkedBoxMaterial('mansion_wall', CREAM, '#e2d9c5', (ctx, W, H) => {
          ctx.fillStyle = '#1d4ed8';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 5;
          for (const wx of [W * 0.16, W * 0.60]) {
            ctx.fillRect(wx, H * 0.25, W * 0.24, H * 0.34);
            ctx.strokeRect(wx, H * 0.25, W * 0.24, H * 0.34);
          }
        });
        const brickMat = this.getInkedBoxMaterial('mansion_brick', '#991b1b', '#7f1d1d');

        // Pavilhão Central de 2 Andares
        const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.50, 0.52), mansionWallMat);
        centerBlock.position.set(0, 0.25, -0.06);
        content.add(centerBlock);

        const centerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.28, 4), redMat);
        centerRoof.position.set(0, 0.62, -0.06);
        centerRoof.rotation.y = Math.PI / 4;
        content.add(centerRoof);

        // 2 Alas Laterais Simétricas (Ala Oeste e Ala Leste)
        for (const sx of [-1, 1]) {
          const wingX = sx * (halfSpan * 0.62);
          const wing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.44), mansionWallMat);
          wing.position.set(wingX, 0.18, -0.04);
          content.add(wing);

          const wingRoof = new THREE.Mesh(new THREE.ConeGeometry(0.39, 0.22, 4), redMat);
          wingRoof.position.set(wingX, 0.45, -0.04);
          wingRoof.rotation.y = Math.PI / 4;
          content.add(wingRoof);
        }

        // Varanda Frontal com Alpendre e 4 Colunas Coloniais
        const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.04, 0.20), woodMat);
        porchRoof.position.set(0, 0.24, 0.26);
        porchRoof.rotation.x = 0.22;
        content.add(porchRoof);

        for (const colX of [-0.46, -0.16, 0.16, 0.46]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.24, 6), creamMat);
          col.position.set(colX, 0.12, 0.32);
          content.add(col);
        }

        // Chaminé de Tijolinhos no Topo
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.22, 0.10), brickMat);
        chimney.position.set(0.20, 0.64, -0.16);
        content.add(chimney);

        // Árvore Ornamental (Ipê) e Animais no Jardim do Casarão
        const gardenTree = this.createStandTree3D('ipe', 0.78);
        gardenTree.position.set(-halfSpan * 0.78, 0, 0.28);
        content.add(gardenTree);

        const yardCow = this.createDetailedCow3D(0.76, 'jersey');
        yardCow.position.set(halfSpan * 0.72, 0, 0.26);
        content.add(yardCow);
        registerAnimal(yardCow, -0.6, 0, 3.2);

        const yardHen = this.createDetailedChicken3D(0.82, 'rooster');
        yardHen.position.set(0.18, 0, 0.34);
        content.add(yardHen);
        registerAnimal(yardHen, 0.5, 1, 4.5);
        break;
      }

      case 'solar_park': {
        // =====================================================================
        // USINA SOLAR FOTOVOLTAICA (Energia Solar I + Energia Solar II — 2x1)
        // 6 Matrizes Solares Inclinadas em 2 Fileiras + Subestação Inversora + Baterias + Poste de Transmissão!
        // =====================================================================
        const solarMat = this.getInkedBoxMaterial('park_solar_cells', '#1d4ed8', '#1e3a8a', (ctx, W, H) => {
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 3;
          for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo((W * i) / 4, 6);
            ctx.lineTo((W * i) / 4, H - 6);
            ctx.moveTo(6, (H * i) / 4);
            ctx.lineTo(W - 6, (H * i) / 4);
            ctx.stroke();
          }
        });
        const postMat = this.getInkedBoxMaterial('solar_post_m', '#64748b');

        // 6 Grandes Placas Fotovoltaicas em 2 fileiras (Oeste e Leste)
        for (const px of [-halfSpan * 0.72, -halfSpan * 0.28, halfSpan * 0.28, halfSpan * 0.72]) {
          for (const pz of [-0.18, 0.20]) {
            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.18, 6), postMat);
            stand.position.set(px, 0.09, pz);
            content.add(stand);

            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.32), solarMat);
            panel.position.set(px, 0.19, pz);
            panel.rotation.x = 0.38;
            content.add(panel);
          }
        }

        // Subestação / Cabine Inversora Central + Banco de Baterias Verdes
        const inverterHouse = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.32), creamMat);
        inverterHouse.position.set(0, 0.15, -0.14);
        content.add(inverterHouse);

        const invRoof = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.36), postMat);
        invRoof.position.set(0, 0.32, -0.14);
        content.add(invRoof);

        for (const bx of [-0.08, 0.08]) {
          const battery = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.14), greenTankMat);
          battery.position.set(bx, 0.09, 0.20);
          content.add(battery);
        }

        // Torre / Poste de Transmissão com Cruzeta
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.56, 6), woodMat);
        pole.position.set(0, 0.28, -0.34);
        content.add(pole);

        const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.035), woodMat);
        crossArm.position.set(0, 0.52, -0.34);
        content.add(crossArm);
        break;
      }

      case 'barn_complex': {
        // =====================================================================
        // COMPLEXO DE CELEIROS & SILOS GRANELEIROS (Celeiro I + Celeiro II — 2x1)
        // 2 Grandes Celeiros Interligados + Passarela Aérea de Grãos + Bateria de 3 Silos Prateados + Rolos de Feno!
        // =====================================================================
        const westX = -halfSpan * 0.58;
        const eastX = halfSpan * 0.56;

        // Celeiro Principal Vermelho (Oeste)
        const mainBarn = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.54), redMat);
        mainBarn.position.set(westX, 0.24, 0.02);
        content.add(mainBarn);

        const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(0.50, 0.28, 4), woodMat);
        mainRoof.position.set(westX, 0.60, 0.02);
        mainRoof.rotation.y = Math.PI / 4;
        content.add(mainRoof);

        // Segundo Galpão Graneleiro (Leste)
        const secBarn = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.40, 0.48), strawMat);
        secBarn.position.set(eastX, 0.20, 0.06);
        content.add(secBarn);

        const secRoof = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.24, 4), redMat);
        secRoof.position.set(eastX, 0.50, 0.06);
        secRoof.rotation.y = Math.PI / 4;
        content.add(secRoof);

        // Passarela Aérea / Rosca Transportadora de Grãos ligando os 2 Celeiros no alto!
        const skyBridge = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(eastX - westX), 0.07, 0.09), siloMat);
        skyBridge.position.set(0, 0.42, 0.04);
        content.add(skyBridge);

        // Bateria de 3 Silos Metálicos Prateados com Domos Esféricos no Centro-Fundo
        for (const [sx, sz, sh, sr] of [
          [-0.18, -0.22, 0.66, 0.13],
          [0.08, -0.22, 0.66, 0.13],
          [0.32, -0.24, 0.52, 0.11]
        ]) {
          const silo = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr, sh, 10), siloMat);
          silo.position.set(sx, sh * 0.5, sz);
          content.add(silo);

          const dome = new THREE.Mesh(new THREE.SphereGeometry(sr, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), siloMat);
          dome.position.set(sx, sh, sz);
          content.add(dome);
        }

        // Fardos Cilíndricos de Feno e Latões na Doca Frontal
        for (const [bx, bz, rot] of [[-0.14, 0.26, 0.2], [0.12, 0.28, -0.3], [0.28, 0.26, 0.8]]) {
          const bale = this.createHayBale3D(1.0);
          bale.position.set(bx, 0.085, bz);
          bale.rotation.y = rot;
          content.add(bale);
        }
        break;
      }

      case 'mega_solar_barn': {
        // =====================================================================
        // CELEIRO FOTOVOLTAICO AUTOMATIZADO (Celeiro + Energia Solar — 2x1)
        // =====================================================================
        const barnX = -halfSpan * 0.54;
        const barn = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.46, 0.52), redMat);
        barn.position.set(barnX, 0.23, 0);
        content.add(barn);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.26, 4), woodMat);
        roof.position.set(barnX, 0.57, 0);
        roof.rotation.y = Math.PI / 4;
        content.add(roof);

        const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.58, 8), siloMat);
        silo.position.set(barnX + 0.38, 0.29, -0.22);
        content.add(silo);

        const solarMat = this.getInkedBoxMaterial('msh_solar', '#1d4ed8', '#1e3a8a');
        for (const sx of [halfSpan * 0.24, halfSpan * 0.68]) {
          for (const sz of [-0.16, 0.18]) {
            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.30), solarMat);
            panel.position.set(sx, 0.18, sz);
            panel.rotation.x = 0.36;
            content.add(panel);
          }
        }
        break;
      }

      // =======================================================================
      // B) AGROSSISTEMAS TRIPLOS (3x1: ANIMAL 1 + ANIMAL 2 + ELEMENTO PARCEIRO!)
      // =======================================================================
      case 'agrosystem_swine_biogas': {
        // AGROSSISTEMA DE SUINOCULTURA & BIOENERGIA (Porco I + Porco II + Biodigestor)
        // 1. Ala Oeste (-X): Granja Ecológica Ventilada + Piquete com Cocho e Vara de 7 Suínos
        const barnX = -halfSpan * 0.72;
        const swineBarn = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.52), creamMat);
        swineBarn.position.set(barnX, 0.16, -halfD * 0.22);
        content.add(swineBarn);

        const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(0.50, 0.22, 4), redMat);
        barnRoof.position.set(barnX, 0.42, -halfD * 0.22);
        barnRoof.rotation.y = Math.PI / 4;
        content.add(barnRoof);

        // Lanternim de ventilação térmica no topo do telhado
        const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.14), woodMat);
        lantern.position.set(barnX, 0.52, -halfD * 0.22);
        content.add(lantern);

        const fenceFront = this.createWoodFenceSection(spanW * 0.56);
        fenceFront.position.set(-halfSpan * 0.22, 0, halfD * 0.82);
        content.add(fenceFront);

        const feedTrough = this.createTrough3D(0.44, 'corn');
        feedTrough.position.set(-halfSpan * 0.24, 0, -halfD * 0.62);
        content.add(feedTrough);

        // 2. Centro: Canaleta Técnica + Tanque de Equalização de Efluentes
        const mainPipe = new THREE.Mesh(new THREE.BoxGeometry(spanW * 0.58, 0.06, 0.07), domeMat);
        mainPipe.position.set(0.08, 0.05, -halfD * 0.36);
        content.add(mainPipe);

        const eqTank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 10), siloMat);
        eqTank.position.set(0.14, 0.07, -halfD * 0.36);
        content.add(eqTank);

        // 3. Ala Leste (+X, sobre a carta do Biodigestor): Usina Dupla de Biogás + Gasômetro + Flare + Tanques de Biofertilizante
        const plantX = halfSpan * 0.62;
        const mainDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.40, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
          domeMat
        );
        mainDome.position.set(plantX, 0.02, 0.04);
        content.add(mainDome);

        // Gasômetro secundário e Torre de Queima com Chama Azul de Biogás
        const subDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
          domeMat
        );
        subDome.position.set(plantX - 0.38, 0.02, 0.22);
        content.add(subDome);

        const flareStack = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.26, 6), siloMat);
        flareStack.position.set(plantX, 0.44, 0.04);
        content.add(flareStack);

        const bigFlame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), flameMat);
        bigFlame.position.set(plantX, 0.64, 0.04);
        content.add(bigFlame);

        // 2 Tanques Verdes de Biofertilizante Líquido
        for (const tz of [-0.32, -0.10]) {
          const bioTank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 8), greenTankMat);
          bioTank.position.set(plantX + 0.32, 0.14, tz);
          content.add(bioTank);
        }

        // 4. Vara Completa de 7 Suínos (Porcos Rosados, Piau Malhados e Leitões)!
        const swineAgroSpecs = [
          { x: -halfSpan * 0.72, z: 0.26, rot: 0.45, sc: 1.02, v: 'pink' },
          { x: -halfSpan * 0.42, z: 0.12, rot: 0.25, sc: 1.0, v: 'spotted' },
          { x: -halfSpan * 0.16, z: 0.22, rot: -0.35, sc: 1.0, v: 'pink' },
          { x: 0.08, z: 0.08, rot: -0.85, sc: 0.96, v: 'spotted' },
          { x: -halfSpan * 0.52, z: -0.08, rot: 0.9, sc: 0.68, v: 'pink' },
          { x: -halfSpan * 0.28, z: -0.22, rot: 1.2, sc: 0.66, v: 'spotted' },
          { x: -0.02, z: 0.30, rot: -0.6, sc: 0.64, v: 'pink' }
        ];
        swineAgroSpecs.forEach((sp, i) => {
          const pig = this.createDetailedPig3D(sp.sc, sp.v);
          pig.position.set(sp.x, 0, sp.z);
          content.add(pig);
          registerAnimal(pig, sp.rot, i, 3.8);
        });
        break;
      }

      case 'agrosystem_dairy_estate': {
        // AGROSSISTEMA LEITEIRO & SILAGEM (Vaca I + Vaca II + Celeiro)
        // 1. Ala Leste (+X, sobre o Celeiro): Grande Celeiro Leiteiro + 2 Silos Prateados + Plataforma de Latões de Leite
        const barnX = halfSpan * 0.64;
        const mainBarn = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.56), redMat);
        mainBarn.position.set(barnX, 0.24, -0.04);
        content.add(mainBarn);

        const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.28, 4), woodMat);
        barnRoof.position.set(barnX, 0.60, -0.04);
        barnRoof.rotation.y = Math.PI / 4;
        content.add(barnRoof);

        for (const [sx, sz, sh] of [[barnX - 0.42, -0.26, 0.64], [barnX - 0.18, -0.32, 0.52]]) {
          const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, sh, 10), siloMat);
          silo.position.set(sx, sh * 0.5, sz);
          content.add(silo);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), siloMat);
          cap.position.set(sx, sh, sz);
          content.add(cap);
        }

        // Latões de leite na plataforma
        for (let m = 0; m < 3; m++) {
          const can = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.11, 6), siloMat);
          can.position.set(barnX - 0.22 + m * 0.09, 0.055, 0.30);
          content.add(can);
        }

        // 2. Centro & Ala Oeste (-X): Moinho de Vento, Cercas, Bebedouro, Rolos de Feno e 6 Bovinos!
        const fenceBack = this.createWoodFenceSection(spanW * 0.62);
        fenceBack.position.set(-halfSpan * 0.24, 0, -halfD * 0.80);
        content.add(fenceBack);
        const fenceFront = this.createWoodFenceSection(spanW * 0.62);
        fenceFront.position.set(-halfSpan * 0.24, 0, halfD * 0.80);
        content.add(fenceFront);

        const waterTrough = this.createTrough3D(0.46, 'water');
        waterTrough.position.set(0.05, 0, halfD * 0.52);
        content.add(waterTrough);

        const silageTrough = this.createTrough3D(0.42, 'silage');
        silageTrough.position.set(-halfSpan * 0.55, 0, -halfD * 0.52);
        content.add(silageTrough);

        for (const [bx, bz] of [[-halfSpan * 0.82, -0.22], [-halfSpan * 0.76, 0.24]]) {
          const bale = this.createHayBale3D(1.05);
          bale.position.set(bx, 0.09, bz);
          content.add(bale);
        }

        const dairyHerd = [
          { x: -halfSpan * 0.64, z: 0.04, rot: 0.35, sc: 1.02, v: 'holstein' },
          { x: -halfSpan * 0.32, z: 0.20, rot: 0.65, sc: 0.98, v: 'jersey' },
          { x: -halfSpan * 0.18, z: -0.16, rot: -0.45, sc: 1.0, v: 'holstein' },
          { x: 0.16, z: -0.06, rot: -0.75, sc: 0.96, v: 'jersey' },
          { x: -halfSpan * 0.46, z: -0.22, rot: 1.1, sc: 0.65, v: 'holstein' },
          { x: 0.02, z: 0.24, rot: -1.2, sc: 0.64, v: 'jersey' }
        ];
        dairyHerd.forEach((sp, i) => {
          const cow = this.createDetailedCow3D(sp.sc, sp.v);
          cow.position.set(sp.x, 0, sp.z);
          content.add(cow);
          registerAnimal(cow, sp.rot, i, 3.2);
        });
        break;
      }

      case 'agrosystem_cattle_biogas': {
        // AGROSSISTEMA PECUÁRIO DE BIOENERGIA (Vaca I + Vaca II + Biodigestor)
        const shed = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 0.48), woodMat);
        shed.position.set(-halfSpan * 0.68, 0.18, -0.12);
        content.add(shed);

        const waterTrough = this.createTrough3D(0.42, 'water');
        waterTrough.position.set(-halfSpan * 0.20, 0, halfD * 0.56);
        content.add(waterTrough);

        const plantX = halfSpan * 0.62;
        const mainDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.38, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
          domeMat
        );
        mainDome.position.set(plantX, 0.02, 0);
        content.add(mainDome);

        const bigFlame = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.20, 8), flameMat);
        bigFlame.position.set(plantX, 0.48, 0);
        content.add(bigFlame);

        const pipe = new THREE.Mesh(new THREE.BoxGeometry(spanW * 0.48, 0.055, 0.06), domeMat);
        pipe.position.set(0.12, 0.05, -0.22);
        content.add(pipe);

        const cowsBio = [
          { x: -halfSpan * 0.58, z: 0.22, rot: 0.4, sc: 1.0, v: 'holstein' },
          { x: -halfSpan * 0.24, z: 0.06, rot: 0.7, sc: 0.98, v: 'jersey' },
          { x: 0.06, z: 0.16, rot: -0.6, sc: 0.98, v: 'holstein' },
          { x: -0.06, z: -0.14, rot: -0.9, sc: 0.94, v: 'jersey' },
          { x: -halfSpan * 0.38, z: -0.20, rot: 1.1, sc: 0.65, v: 'holstein' }
        ];
        cowsBio.forEach((sp, i) => {
          const cow = this.createDetailedCow3D(sp.sc, sp.v);
          cow.position.set(sp.x, 0, sp.z);
          content.add(cow);
          registerAnimal(cow, sp.rot, i, 3.2);
        });
        break;
      }

      case 'agrosystem_silvopasture': {
        // AGROSSISTEMA SILVIPASTORIL ILPF (Vaca I + Vaca II + Árvore): Bosque Sombreado + 6 Bovinos + Aves!
        for (const [tx, tz, tsub, tsc] of [
          [halfSpan * 0.66, -0.06, 'jatoba', 1.12],
          [0.08, -halfD * 0.48, 'ipe', 0.96],
          [-halfSpan * 0.72, -halfD * 0.42, 'araucaria', 0.92]
        ]) {
          const tree = this.createStandTree3D(tsub, tsc);
          tree.position.set(tx, 0, tz);
          content.add(tree);
        }

        const fence = this.createWoodFenceSection(spanW * 0.76);
        fence.position.set(0, 0, halfD * 0.80);
        content.add(fence);

        const trough = this.createTrough3D(0.42, 'water');
        trough.position.set(halfSpan * 0.24, 0, halfD * 0.46);
        content.add(trough);

        const ilpfHerd = [
          { x: -halfSpan * 0.56, z: 0.12, rot: 0.4, sc: 1.02, v: 'holstein' },
          { x: -halfSpan * 0.22, z: -0.06, rot: 0.75, sc: 0.98, v: 'jersey' },
          { x: 0.14, z: 0.16, rot: -0.45, sc: 1.0, v: 'holstein' },
          { x: halfSpan * 0.48, z: 0.18, rot: -0.85, sc: 0.96, v: 'jersey' },
          { x: -halfSpan * 0.38, z: 0.28, rot: 1.1, sc: 0.65, v: 'holstein' },
          { x: 0.32, z: -0.18, rot: -1.2, sc: 0.64, v: 'jersey' }
        ];
        ilpfHerd.forEach((sp, i) => {
          const cow = this.createDetailedCow3D(sp.sc, sp.v);
          cow.position.set(sp.x, 0, sp.z);
          content.add(cow);
          registerAnimal(cow, sp.rot, i, 3.2);
        });

        for (let b = 0; b < 2; b++) {
          const bird = this.createDetailedBird3D(b);
          content.add(bird);
          anim.flyers.push({ mesh: bird, radius: 0.56 + b * 0.18, height: 0.82 + b * 0.08, speed: 1.45 + b * 0.2, phase: b * 2.2 });
        }
        break;
      }

      case 'agrosystem_poultry_farm': {
        // AGROSSISTEMA AVÍCOLA CAIPIRA (Galinha I + Galinha II + Galinheiro): Aviário Duplo + Silo + 12 Aves!
        const coopX = halfSpan * 0.62;
        const mainCoop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.40, 0.52), strawMat);
        mainCoop.position.set(coopX, 0.20, -0.04);
        content.add(mainCoop);

        const coopRoof = new THREE.Mesh(new THREE.ConeGeometry(0.50, 0.25, 4), redMat);
        coopRoof.position.set(coopX, 0.52, -0.04);
        coopRoof.rotation.y = Math.PI / 4;
        content.add(coopRoof);

        // Ala lateral de ninhos e Silo de Ração Dourado
        const nestWing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.36), woodMat);
        nestWing.position.set(coopX - 0.38, 0.11, -0.10);
        content.add(nestWing);

        const feedSilo = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 8), siloMat);
        feedSilo.position.set(coopX + 0.34, 0.23, -0.22);
        content.add(feedSilo);

        const fenceFront = this.createWoodFenceSection(spanW * 0.66);
        fenceFront.position.set(-halfSpan * 0.18, 0, halfD * 0.80);
        content.add(fenceFront);

        const cornFeeder = this.createTrough3D(0.38, 'corn');
        cornFeeder.position.set(-halfSpan * 0.35, 0, -halfD * 0.48);
        content.add(cornFeeder);

        const waterDrinker = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.16, 8), redMat);
        waterDrinker.position.set(0.04, 0.08, halfD * 0.48);
        content.add(waterDrinker);

        const agroFlock = [
          { x: -halfSpan * 0.18, z: 0.04, rot: 0.35, sc: 1.14, type: 'rooster' },
          { x: -halfSpan * 0.72, z: 0.16, rot: 0.65, sc: 1.0, type: 'white' },
          { x: -halfSpan * 0.52, z: -0.10, rot: 0.95, sc: 0.98, type: 'brown' },
          { x: -halfSpan * 0.32, z: 0.24, rot: 0.25, sc: 0.96, type: 'white' },
          { x: 0.02, z: -0.16, rot: -0.65, sc: 0.98, type: 'brown' },
          { x: 0.22, z: 0.18, rot: -1.1, sc: 0.96, type: 'white' },
          { x: -0.06, z: 0.28, rot: 0.8, sc: 0.94, type: 'brown' },
          { x: -halfSpan * 0.64, z: -0.22, rot: 1.2, sc: 0.62, type: 'chick' },
          { x: -halfSpan * 0.40, z: 0.08, rot: 0.5, sc: 0.60, type: 'chick' },
          { x: -0.14, z: -0.22, rot: -0.4, sc: 0.62, type: 'chick' },
          { x: 0.12, z: 0.02, rot: -0.9, sc: 0.58, type: 'chick' },
          { x: 0.28, z: -0.08, rot: 1.5, sc: 0.60, type: 'chick' }
        ];
        agroFlock.forEach((sp, i) => {
          const bird = this.createDetailedChicken3D(sp.sc, sp.type);
          bird.position.set(sp.x, 0, sp.z);
          content.add(bird);
          registerAnimal(bird, sp.rot, i, 4.8);
        });
        break;
      }

      case 'agrosystem_agro_poultry': {
        // AGROSSISTEMA DE HORTA & AVICULTURA INTEGRADA (Galinha I + Galinha II + Horta/Plantação)
        const ridgeMat = this.getInkedBoxMaterial('mc_ridge', '#5c3a1e', '#3d2511');
        const leafDiscGeo = this.getGeo('crop_leaf_disc', () => {
          const g = new THREE.PlaneGeometry(0.24, 0.24);
          g.rotateX(-Math.PI / 2);
          return g;
        });
        const grainMat = this.createCanopyDiscMat('mc_grain', '#eab308', '#ca8a04', '#fef08a');
        const vegMat = this.createCanopyDiscMat('mc_veg', '#4ca638', '#2f7320', '#ef4444');

        for (const zPos of [-0.30, 0.30]) {
          const ridge = new THREE.Mesh(new THREE.BoxGeometry(spanW - 0.26, 0.06, 0.15), ridgeMat);
          ridge.position.set(0, 0.03, zPos);
          content.add(ridge);

          const cols = 7;
          for (let c = 0; c < cols; c++) {
            const xPos = -halfSpan + (c / (cols - 1)) * (halfSpan * 2);
            const isGrain = c % 2 === 0;
            const stemH = isGrain ? 0.17 : 0.11;
            const stem = new THREE.Mesh(new THREE.BoxGeometry(0.10, stemH, 0.10), this.getInkedBoxMaterial('mc_stem', '#4d8c32'));
            stem.position.set(xPos, stemH * 0.5 + 0.03, zPos);
            content.add(stem);

            const topDisc = new THREE.Mesh(leafDiscGeo, isGrain ? grainMat : vegMat);
            topDisc.position.set(xPos, stemH + 0.04, zPos);
            content.add(topDisc);
          }
        }

        // Abrigo avícola móvel no corredor central + 9 aves fazendo controle biológico
        const mobileCoop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.28), strawMat);
        mobileCoop.position.set(halfSpan * 0.66, 0.13, 0);
        content.add(mobileCoop);

        const agroBirds = [
          { x: -halfSpan * 0.65, z: 0, rot: 0.4, sc: 1.08, type: 'rooster' },
          { x: -halfSpan * 0.36, z: 0.06, rot: 0.7, sc: 0.95, type: 'white' },
          { x: -0.08, z: -0.05, rot: -0.5, sc: 0.95, type: 'brown' },
          { x: 0.22, z: 0.04, rot: -0.9, sc: 0.95, type: 'white' },
          { x: -halfSpan * 0.50, z: -0.08, rot: 1.1, sc: 0.58, type: 'chick' },
          { x: -0.22, z: 0.08, rot: 0.3, sc: 0.58, type: 'chick' },
          { x: 0.08, z: -0.06, rot: -0.6, sc: 0.58, type: 'chick' }
        ];
        agroBirds.forEach((sp, i) => {
          const b = this.createDetailedChicken3D(sp.sc, sp.type);
          b.position.set(sp.x, 0, sp.z);
          content.add(b);
          registerAnimal(b, sp.rot, i, 4.8);
        });
        break;
      }

      case 'agrosystem_solar_mansion': {
        // =====================================================================
        // AGROSSISTEMA 3x1: CASARÃO COLONIAL & USINA SOLAR FOTOVOLTAICA
        // Combina Casa I + Casa II + Energia Solar (ou Casa + Energia Solar I + II)
        // =====================================================================
        const mansionWallMat = this.getInkedBoxMaterial('mansion_wall', CREAM, '#e2d9c5');
        const solarMat = this.getInkedBoxMaterial('msh_solar', '#1d4ed8', '#1e3a8a');
        const postMat = this.getInkedBoxMaterial('solar_post_m', '#64748b');

        // 1. Casarão Colonial de 2 Andares + Alas Laterais + Varanda (-X / Centro-Oeste)
        const mX = -halfSpan * 0.36;
        const mainBlock = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.50, 0.52), mansionWallMat);
        mainBlock.position.set(mX, 0.25, -0.06);
        content.add(mainBlock);

        const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.28, 4), redMat);
        mainRoof.position.set(mX, 0.62, -0.06);
        mainRoof.rotation.y = Math.PI / 4;
        content.add(mainRoof);

        for (const sx of [-0.48, 0.48]) {
          const wing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.44), mansionWallMat);
          wing.position.set(mX + sx, 0.18, -0.04);
          content.add(wing);

          const wRoof = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.20, 4), redMat);
          wRoof.position.set(mX + sx, 0.44, -0.04);
          wRoof.rotation.y = Math.PI / 4;
          content.add(wRoof);
        }

        const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.04, 0.18), woodMat);
        porchRoof.position.set(mX, 0.24, 0.25);
        porchRoof.rotation.x = 0.22;
        content.add(porchRoof);

        // 2. Usina Solar Fotovoltaica + Subestação + Baterias (+X / Leste)
        for (const px of [halfSpan * 0.34, halfSpan * 0.74]) {
          for (const pz of [-0.18, 0.18]) {
            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.18, 6), postMat);
            stand.position.set(px, 0.09, pz);
            content.add(stand);

            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.32), solarMat);
            panel.position.set(px, 0.19, pz);
            panel.rotation.x = 0.38;
            content.add(panel);
          }
        }

        const batteryBank = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.24), greenTankMat);
        batteryBank.position.set(halfSpan * 0.08, 0.12, -0.22);
        content.add(batteryBank);

        // 3. Jardim e Animais no Quintal Sustentável
        const cow = this.createDetailedCow3D(0.78, 'jersey');
        cow.position.set(0.08, 0, 0.26);
        content.add(cow);
        registerAnimal(cow, -0.5, 0, 3.2);

        const rooster = this.createDetailedChicken3D(0.86, 'rooster');
        rooster.position.set(-halfSpan * 0.15, 0, 0.34);
        content.add(rooster);
        registerAnimal(rooster, 0.6, 1, 4.5);
        break;
      }

      case 'agrosystem_solar_barn': {
        // =====================================================================
        // AGROSSISTEMA 3x1: COMPLEXO AGROINDUSTRIAL DE CELEIROS, SILOS & USINA SOLAR
        // Combina Celeiro I + Celeiro II + Energia Solar (ou Celeiro + Energia Solar I + II)
        // =====================================================================
        const solarMat = this.getInkedBoxMaterial('msh_solar', '#1d4ed8', '#1e3a8a');
        const postMat = this.getInkedBoxMaterial('solar_post_m', '#64748b');

        // 1. Complexo Duplo de Celeiros + Passarela Aérea + 3 Silos Metálicos (-X e Centro)
        const b1X = -halfSpan * 0.66;
        const b2X = -0.08;

        const mainBarn = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.48, 0.52), redMat);
        mainBarn.position.set(b1X, 0.24, 0.04);
        content.add(mainBarn);
        const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.28, 4), woodMat);
        mainRoof.position.set(b1X, 0.60, 0.04);
        mainRoof.rotation.y = Math.PI / 4;
        content.add(mainRoof);

        const secBarn = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.38, 0.46), strawMat);
        secBarn.position.set(b2X, 0.19, 0.06);
        content.add(secBarn);
        const secRoof = new THREE.Mesh(new THREE.ConeGeometry(0.40, 0.22, 4), redMat);
        secRoof.position.set(b2X, 0.48, 0.06);
        secRoof.rotation.y = Math.PI / 4;
        content.add(secRoof);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(b2X - b1X), 0.06, 0.08), siloMat);
        bridge.position.set((b1X + b2X) * 0.5, 0.40, 0.04);
        content.add(bridge);

        for (const [sx, sz, sh] of [[b1X + 0.34, -0.24, 0.66], [b2X - 0.26, -0.24, 0.62], [b2X + 0.24, -0.24, 0.52]]) {
          const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, sh, 10), siloMat);
          silo.position.set(sx, sh * 0.5, sz);
          content.add(silo);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), siloMat);
          cap.position.set(sx, sh, sz);
          content.add(cap);
        }

        // 2. Usina Solar Fotovoltaica de 4 Matrizes + Subestação (+X / Leste)
        for (const px of [halfSpan * 0.36, halfSpan * 0.74]) {
          for (const pz of [-0.18, 0.18]) {
            const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.18, 6), postMat);
            stand.position.set(px, 0.09, pz);
            content.add(stand);

            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.32), solarMat);
            panel.position.set(px, 0.19, pz);
            panel.rotation.x = 0.38;
            content.add(panel);
          }
        }

        // Rolos de feno na frente
        for (const bx of [-0.36, 0.18]) {
          const bale = this.createHayBale3D(1.0);
          bale.position.set(bx, 0.085, 0.28);
          content.add(bale);
        }
        break;
      }

      // =======================================================================
      // C) MESCLAS COMPLEMENTARES 2x1 (GRANDE LAVOURA, BACIA, GRANJA, LATICÍNIO, BIOGÁS, SEDE SOLAR)
      // =======================================================================
      case 'mega_crop': {
        const ridgeMat = this.getInkedBoxMaterial('mc_ridge', '#5c3a1e', '#3d2511');
        const leafDiscGeo = this.getGeo('crop_leaf_disc', () => {
          const g = new THREE.PlaneGeometry(0.24, 0.24);
          g.rotateX(-Math.PI / 2);
          return g;
        });
        const grainMat = this.createCanopyDiscMat('mc_grain', '#eab308', '#ca8a04', '#fef08a');
        const vegMat = this.createCanopyDiscMat('mc_veg', '#4ca638', '#2f7320', '#ef4444');

        for (const zPos of [-0.28, 0, 0.28]) {
          const ridge = new THREE.Mesh(new THREE.BoxGeometry(spanW - 0.22, 0.06, 0.15), ridgeMat);
          ridge.position.set(0, 0.03, zPos);
          content.add(ridge);

          const cols = 6;
          for (let c = 0; c < cols; c++) {
            const xPos = -halfSpan + (c / (cols - 1)) * (halfSpan * 2);
            if (Math.abs(xPos) < 0.24 && zPos === 0) continue;

            const isGrain = (c + (zPos > 0 ? 1 : 0)) % 2 === 0;
            const stemH = isGrain ? 0.18 : 0.11;
            const stem = new THREE.Mesh(
              new THREE.BoxGeometry(0.10, stemH, 0.10),
              this.getInkedBoxMaterial('mc_stem', '#4d8c32')
            );
            stem.position.set(xPos, stemH * 0.5 + 0.03, zPos);
            content.add(stem);

            const topDisc = new THREE.Mesh(leafDiscGeo, isGrain ? grainMat : vegMat);
            topDisc.position.set(xPos, stemH + 0.04, zPos);
            content.add(topDisc);
          }
        }

        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.48, 6), woodMat);
        tower.position.set(0, 0.24, 0);
        content.add(tower);

        const dome = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.14, 6), redMat);
        dome.position.set(0, 0.54, 0);
        content.add(dome);

        const bladesPivot = new THREE.Group();
        bladesPivot.position.set(0, 0.42, 0.14);
        for (let b = 0; b < 4; b++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.015), creamMat);
          blade.rotation.z = (b * Math.PI) / 2;
          bladesPivot.add(blade);
        }
        content.add(bladesPivot);
        anim.windmillBlades = bladesPivot;

        const hen1 = this.createDetailedChicken3D(0.85, 'brown');
        hen1.position.set(-0.28, 0, 0.14);
        content.add(hen1);
        registerAnimal(hen1, 0.6, 0, 4.5);

        const hen2 = this.createDetailedChicken3D(0.85, 'white');
        hen2.position.set(0.28, 0, -0.14);
        content.add(hen2);
        registerAnimal(hen2, -0.8, 1, 4.5);

        const cropBird = this.createDetailedBird3D(2);
        content.add(cropBird);
        anim.flyers.push({ mesh: cropBird, radius: 0.46, height: 0.72, speed: 1.5, phase: 0 });
        break;
      }

      case 'mega_watershed': {
        const rockMat = this.getInkedBoxMaterial('mw_rock', '#7d776f', '#524e48');
        const mossMat = this.getInkedBoxMaterial('mw_moss', '#4b8a38', '#316123');
        const cascadeMat = this.getInkedBoxMaterial('mw_water', '#7ce8ff', '#38bdf8');

        const cliffX = -halfSpan * 0.76;
        const cliff = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.58), rockMat);
        cliff.position.set(cliffX, 0.18, 0);
        content.add(cliff);

        const mossTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.56), mossMat);
        mossTop.position.set(cliffX, 0.38, 0);
        content.add(mossTop);

        const waterfall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.28), cascadeMat);
        waterfall.position.set(cliffX + 0.18, 0.16, 0);
        waterfall.rotation.z = 0.35;
        content.add(waterfall);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.48), woodMat);
        bridge.position.set(0, 0.08, 0);
        content.add(bridge);

        const pier = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.22), woodMat);
        pier.position.set(halfSpan * 0.65, 0.04, 0.22);
        content.add(pier);

        [
          [halfSpan * 0.32, -0.14, 0.5, 1.0],
          [halfSpan * 0.54, 0.02, -0.4, 0.9],
          [-halfSpan * 0.25, 0.15, 1.2, 0.75]
        ].forEach(([dx, dz, drot, dsc], i) => {
          const duck = this.createDetailedDuck3D(dsc);
          duck.position.set(dx, 0.01, dz);
          content.add(duck);
          registerAnimal(duck, drot, i, 2.8);
        });

        const lakeBird = this.createDetailedBird3D(1);
        content.add(lakeBird);
        anim.flyers.push({ mesh: lakeBird, radius: 0.48, height: 0.68, speed: 1.4, phase: 1.2 });
        break;
      }

      case 'mega_poultry': {
        const coopBody = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.48), strawMat);
        coopBody.position.set(-halfSpan * 0.58, 0.18, 0);
        content.add(coopBody);

        const coopRoof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 4), redMat);
        coopRoof.position.set(-halfSpan * 0.58, 0.46, 0);
        coopRoof.rotation.y = Math.PI / 4;
        content.add(coopRoof);

        const feeder = this.createTrough3D(0.30, 'corn');
        feeder.position.set(halfSpan * 0.20, 0, 0);
        content.add(feeder);

        const flockSpecs = [
          { x: -0.05, z: 0.22, rot: 0.4, sc: 1.08, type: 'rooster' },
          { x: halfSpan * 0.22, z: -0.20, rot: -0.6, sc: 1.0, type: 'brown' },
          { x: halfSpan * 0.56, z: 0.16, rot: -1.4, sc: 0.95, type: 'white' },
          { x: halfSpan * 0.68, z: -0.14, rot: 2.1, sc: 0.95, type: 'brown' },
          { x: 0.10, z: 0.12, rot: 0.8, sc: 0.58, type: 'chick' },
          { x: halfSpan * 0.38, z: 0.04, rot: -0.3, sc: 0.58, type: 'chick' },
          { x: halfSpan * 0.44, z: -0.18, rot: 1.5, sc: 0.55, type: 'chick' }
        ];
        flockSpecs.forEach((sp, i) => {
          const bird = this.createDetailedChicken3D(sp.sc, sp.type);
          bird.position.set(sp.x, 0, sp.z);
          content.add(bird);
          registerAnimal(bird, sp.rot, i, 4.8);
        });
        break;
      }

      case 'mega_dairy': {
        const barn = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.44, 0.52), redMat);
        barn.position.set(-halfSpan * 0.56, 0.22, 0);
        content.add(barn);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.26, 4), woodMat);
        roof.position.set(-halfSpan * 0.56, 0.56, 0);
        roof.rotation.y = Math.PI / 4;
        content.add(roof);

        const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.54, 8), siloMat);
        silo.position.set(-halfSpan * 0.18, 0.27, -0.22);
        content.add(silo);

        const trough = this.createTrough3D(0.32, 'water');
        trough.position.set(halfSpan * 0.12, 0, 0.24);
        content.add(trough);

        [
          [halfSpan * 0.18, -0.10, 0.45, 0.98, 'holstein'],
          [halfSpan * 0.64, 0.08, -0.75, 0.96, 'jersey'],
          [halfSpan * 0.42, 0.22, -0.20, 0.64, 'holstein']
        ].forEach(([cx, cz, rot, sc, v], i) => {
          const cow = this.createDetailedCow3D(sc, v);
          cow.position.set(cx, 0, cz);
          content.add(cow);
          registerAnimal(cow, rot, i, 3.2);
        });
        break;
      }

      case 'mega_biogas': {
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
          domeMat
        );
        dome.position.set(halfSpan * 0.52, 0.02, 0);
        content.add(dome);

        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), flameMat);
        flame.position.set(halfSpan * 0.52, 0.42, 0);
        content.add(flame);

        const pipe = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 0.9, 0.055, 0.055), domeMat);
        pipe.position.set(0, 0.07, -0.18);
        content.add(pipe);

        const shelter = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.42), woodMat);
        shelter.position.set(-halfSpan * 0.62, 0.13, -0.12);
        content.add(shelter);

        [
          [-halfSpan * 0.22, 0.14, 0.5, 0.96, 'pink'],
          [-halfSpan * 0.52, 0.22, 0.9, 0.92, 'spotted'],
          [0.04, 0.08, -0.6, 0.68, 'pink']
        ].forEach(([px, pz, rot, sc, v], i) => {
          const pig = this.createDetailedPig3D(sc, v);
          pig.position.set(px, 0, pz);
          content.add(pig);
          registerAnimal(pig, rot, i, 3.8);
        });
        break;
      }

      case 'mega_solar_house':
      default: {
        const house = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.38, 0.50), creamMat);
        house.position.set(-halfSpan * 0.48, 0.19, 0);
        content.add(house);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.50, 0.25, 4), redMat);
        roof.position.set(-halfSpan * 0.48, 0.50, 0);
        roof.rotation.y = Math.PI / 4;
        content.add(roof);

        const solarMat = this.getInkedBoxMaterial('msh_solar', '#1d4ed8', '#1e3a8a');
        for (const sx of [halfSpan * 0.20, halfSpan * 0.64]) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.04, 0.46), solarMat);
          panel.position.set(sx, 0.20, -0.06);
          panel.rotation.z = -0.32;
          content.add(panel);
        }

        const yardCow = this.createDetailedCow3D(0.75, 'holstein');
        yardCow.position.set(halfSpan * 0.35, 0, 0.26);
        content.add(yardCow);
        registerAnimal(yardCow, -0.5, 0, 3.2);

        const yardHen = this.createDetailedChicken3D(0.8, 'brown');
        yardHen.position.set(-0.04, 0, 0.24);
        content.add(yardHen);
        registerAnimal(yardHen, 0.7, 1, 4.5);
        break;
      }
    }

    if (zone.hasBees) {
      for (let b = 0; b < 6; b++) {
        const bee = this.createDetailedBee3D(1.0);
        content.add(bee);
        anim.flyers.push({
          mesh: bee,
          radius: halfSpan * 0.65 + (b % 3) * 0.18,
          height: 0.44 + (b % 3) * 0.08,
          speed: 2.8 + (b % 3) * 0.4,
          phase: b * 1.05
        });
      }
    }

    return group;
  }
  // ===========================================================================

  buildElementBySubtype(card, group, animParts) {
    const sub = card.subtype;

    // -------------------------------------------------------------------------
    // 1. ÁRVORES (Tronco 3D + Camadas Horizontais Vistas de Cima + Planos Verticais)
    // -------------------------------------------------------------------------
    if (sub === 'ipe' || sub === 'araucaria' || sub === 'jatoba' || sub === 'palmeira') {
      const palettes = {
        ipe: { main: '#f5b82e', shade: '#d48c12', trunk: '#6e4224', accent: '#fff6cc' },
        araucaria: { main: '#2f6e36', shade: '#1e4d24', trunk: '#543118', accent: null },
        jatoba: { main: '#4c8f3a', shade: '#316324', trunk: '#633b1e', accent: '#e07a5f' },
        palmeira: { main: '#5ca340', shade: '#3c7526', trunk: '#826440', accent: '#4a154b' }
      };
      const pal = palettes[sub];

      // Tronco cilíndrico 3D low-poly com textura de casca em nanquim
      const trunkMat = this.getInkedBoxMaterial(`trunk_${sub}`, pal.trunk, '#3d2210');
      const trunkH = sub === 'araucaria' ? 0.68 : 0.52;
      const trunkGeo = this.getGeo(`trunk_geo_${trunkH}`, () => new THREE.CylinderGeometry(0.06, 0.10, trunkH, 6));
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkH * 0.5;
      group.add(trunk);

      // Copa Combinada: Discos Horizontais Empilhados (vistos de cima!) + Planos Verticais Cruzados (vistos de lado!)
      const discMat = this.createCanopyDiscMat(sub, pal.main, pal.shade, pal.accent);
      const discGeo = this.getGeo('canopy_disc_geo', () => {
        const g = new THREE.PlaneGeometry(0.76, 0.76);
        g.rotateX(-Math.PI / 2);
        return g;
      });

      if (sub === 'araucaria') {
        // Araucária: 3 patamares horizontais amplos (formato taça clássico visto de cima e de lado)
        for (const [yPos, sc] of [[0.48, 0.72], [0.60, 0.98], [0.72, 0.65]]) {
          const tier = new THREE.Mesh(discGeo, discMat);
          tier.position.y = yPos;
          tier.scale.setScalar(sc);
          group.add(tier);
        }
      } else {
        // 3 camadas horizontais em diferentes alturas formando volume de copa
        for (const [yPos, sc, rot] of [[0.40, 0.85, 0], [0.54, 1.0, 0.5], [0.66, 0.74, 1.1]]) {
          const layer = new THREE.Mesh(discGeo, discMat);
          layer.position.y = yPos;
          layer.rotation.y = rot;
          layer.scale.setScalar(sc);
          group.add(layer);
        }
      }

      // 2 planos verticais cruzados internos para preencher a silhueta lateral a 90°
      const sidePlaneGeo = this.getGeo('tree_side_plane', () => new THREE.PlaneGeometry(0.74, 0.52));
      for (const ang of [0, Math.PI / 2]) {
        const sp = new THREE.Mesh(sidePlaneGeo, discMat);
        sp.position.y = 0.52;
        sp.rotation.y = ang;
        group.add(sp);
      }

      // Enxame de abelhinhas forrageiras quando próximo ao Apiário (Pasto Apícola Arbóreo)
      const treeBees = this.createBeeSwarmGroup(4, 0.38, 0.56);
      group.add(treeBees);
      animParts.beeSwarm = treeBees;
      return;
    }

    // -------------------------------------------------------------------------
    // 2. AÇUDE (#5) — Base plana com a água do açude + píer 3D + peixes horizontais + taboas
    // -------------------------------------------------------------------------
    if (sub === 'pond') {
      // Camada de água animada paralela à base (deitada!)
      const rippleGeo = this.getGeo('pond_ripple_geo', () => {
        const g = new THREE.PlaneGeometry(0.72, 0.66);
        g.rotateX(-Math.PI / 2);
        return g;
      });
      const rippleMat = this.getCutoutMaterial('pond_ripples_top', 256, 256, (ctx, W, H) => {
        ctx.strokeStyle = CREAM;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(W * 0.4, H * 0.45, 38, 0, Math.PI * 1.4);
        ctx.stroke();

        // Dois peixinhos vistos de cima nadando na horizontal!
        ctx.fillStyle = '#f28c38';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4;
        for (const [fx, fy, fa] of [[W * 0.36, H * 0.42, 0.4], [W * 0.64, H * 0.58, -2.2]]) {
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(fa);
          ctx.beginPath();
          ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-18, 0);
          ctx.lineTo(-32, -10);
          ctx.lineTo(-32, 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      });
      const waterOverlay = new THREE.Mesh(rippleGeo, rippleMat);
      waterOverlay.position.y = 0.012;
      group.add(waterOverlay);
      animParts.waterOverlay = waterOverlay;

      // Píer de madeira 3D avançando sobre a água do açude
      const woodMat = this.getInkedBoxMaterial('pier_wood', '#9c6638', '#704623');
      const deck = new THREE.Mesh(this.getGeo('pier_deck', () => new THREE.BoxGeometry(0.18, 0.03, 0.34)), woodMat);
      deck.position.set(0.24, 0.035, 0.26);
      group.add(deck);

      // Pedras 3D e tufos de taboas na margem
      const rockMat = this.getInkedBoxMaterial('pond_rock', '#8c857b', '#5c564f');
      for (const [rx, rz, sc] of [[-0.34, -0.28, 1.0], [-0.24, -0.34, 0.75], [0.32, -0.24, 0.85]]) {
        const rock = new THREE.Mesh(this.getGeo('rock_dodec', () => new THREE.DodecahedronGeometry(0.08, 0)), rockMat);
        rock.position.set(rx, 0.05, rz);
        rock.scale.set(sc, sc * 0.65, sc);
        group.add(rock);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // 3. NASCENTE (#15) — Olho d'água plano + formação rochosa 3D com queda d'água e samambaias
    // -------------------------------------------------------------------------
    if (sub === 'spring') {
      const rockMat = this.getInkedBoxMaterial('spring_rock', '#7d776f', '#524e48');
      const mossMat = this.getInkedBoxMaterial('spring_moss', '#4b8a38', '#316123');

      // Formação rochosa 3D na cabeceira da nascente
      for (const [rx, ry, rz, sx, sy, sz] of [
        [0, 0.14, -0.24, 0.42, 0.28, 0.24],
        [-0.22, 0.09, -0.18, 0.22, 0.18, 0.20],
        [0.22, 0.10, -0.18, 0.22, 0.20, 0.20]
      ]) {
        const rMesh = new THREE.Mesh(this.getGeo(`srock_${sx}_${sy}`, () => new THREE.BoxGeometry(sx, sy, sz)), rockMat);
        rMesh.position.set(rx, ry, rz);
        group.add(rMesh);

        const mMesh = new THREE.Mesh(this.getGeo(`smoss_${sx}`, () => new THREE.BoxGeometry(sx * 0.9, 0.04, sz * 0.9)), mossMat);
        mMesh.position.set(rx, ry + sy * 0.5 + 0.01, rz);
        group.add(mMesh);
      }

      // Queda d'água saindo da pedra para a bacia plana da nascente
      const cascadeMat = this.getInkedBoxMaterial('spring_cascade', '#7ce8ff', '#38bdf8');
      const cascade = new THREE.Mesh(this.getGeo('cascade_geo', () => new THREE.BoxGeometry(0.18, 0.18, 0.08)), cascadeMat);
      cascade.position.set(0, 0.09, -0.11);
      cascade.rotation.x = -0.35;
      group.add(cascade);
      return;
    }

    // -------------------------------------------------------------------------
    // 4. EDIFICAÇÕES RURAIS 3D (CASA, CELEIRO, GALINHEIRO — Maquetes 3D sem rosto)
    // -------------------------------------------------------------------------
    if (sub === 'farmhouse' || sub === 'barn' || sub === 'coop') {
      const specs = {
        farmhouse: { w: 0.58, h: 0.36, d: 0.48, roofH: 0.24, wall: '#f5ead2', roof: '#b8432b', trim: '#6e4224' },
        barn: { w: 0.56, h: 0.44, d: 0.48, roofH: 0.28, wall: '#bf3426', roof: '#5e1912', trim: '#fcf4df' },
        coop: { w: 0.46, h: 0.30, d: 0.38, roofH: 0.18, wall: '#d99636', roof: '#8f2920', trim: '#5c3317' }
      }[sub];

      const wallMat = this.getInkedBoxMaterial(`bldg_wall_${sub}`, specs.wall, null, (ctx, W, H) => {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4;
        for (let y = 32; y < H; y += 28) {
          ctx.beginPath();
          ctx.moveTo(4, y);
          ctx.lineTo(W - 4, y);
          ctx.stroke();
        }
        // Janela com veneziana e porta de madeira (arquitetura rural real, sem rosto)
        ctx.fillStyle = specs.trim;
        ctx.fillRect(W * 0.18, H * 0.42, W * 0.26, H * 0.54);
        ctx.strokeRect(W * 0.18, H * 0.42, W * 0.26, H * 0.54);

        ctx.fillStyle = '#fde68a';
        ctx.fillRect(W * 0.56, H * 0.34, W * 0.26, H * 0.28);
        ctx.strokeRect(W * 0.56, H * 0.34, W * 0.26, H * 0.28);
      });

      const roofMat = this.getInkedBoxMaterial(`bldg_roof_${sub}`, specs.roof, '#3d100b');

      const body = new THREE.Mesh(
        this.getGeo(`bldg_box_${sub}`, () => new THREE.BoxGeometry(specs.w, specs.h, specs.d)),
        wallMat
      );
      body.position.y = specs.h * 0.5;
      group.add(body);

      const roof = new THREE.Mesh(
        this.getGeo(`bldg_roof_${sub}`, () => new THREE.ConeGeometry(Math.max(specs.w, specs.d) * 0.82, specs.roofH, 4)),
        roofMat
      );
      roof.position.y = specs.h + specs.roofH * 0.48;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);

      // Silo lateral cilíndrico no Celeiro (#12)
      if (sub === 'barn') {
        const siloMat = this.getInkedBoxMaterial('barn_silo', '#d1d5db', '#9ca3af');
        const silo = new THREE.Mesh(this.getGeo('silo_cyl', () => new THREE.CylinderGeometry(0.12, 0.12, 0.54, 8)), siloMat);
        silo.position.set(0.32, 0.27, -0.10);
        group.add(silo);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // 5. PLANTAÇÕES (#7 GRÃOS E #8 HORTA/POMAR — Canteiros 3D + Folhagem Top-Down)
    // -------------------------------------------------------------------------
    if (sub === 'grains' || sub === 'orchard') {
      const ridgeMat = this.getInkedBoxMaterial('crop_ridge', '#5c3a1e', '#3d2511');
      const ridgeGeo = this.getGeo('crop_ridge_geo', () => new THREE.BoxGeometry(0.78, 0.06, 0.14));

      const leafDiscGeo = this.getGeo('crop_leaf_disc', () => {
        const g = new THREE.PlaneGeometry(0.22, 0.22);
        g.rotateX(-Math.PI / 2);
        return g;
      });
      const leafMat = this.createCanopyDiscMat(
        `crop_${sub}`,
        sub === 'grains' ? '#eab308' : '#4ca638',
        sub === 'grains' ? '#ca8a04' : '#2f7320',
        sub === 'grains' ? '#fef08a' : '#ef4444'
      );

      for (const zPos of [-0.26, 0, 0.26]) {
        const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
        ridge.position.set(0, 0.03, zPos);
        group.add(ridge);

        for (const xPos of [-0.26, 0, 0.26]) {
          // Roseta horizontal (vista de cima) + plano vertical (visto de lado)
          const topLeaf = new THREE.Mesh(leafDiscGeo, leafMat);
          topLeaf.position.set(xPos, sub === 'grains' ? 0.18 : 0.12, zPos);
          group.add(topLeaf);

          const stem = new THREE.Mesh(
            this.getGeo('crop_stem', () => new THREE.BoxGeometry(0.10, sub === 'grains' ? 0.16 : 0.10, 0.10)),
            this.getInkedBoxMaterial(`stem_${sub}`, '#4d8c32')
          );
          stem.position.set(xPos, sub === 'grains' ? 0.10 : 0.07, zPos);
          group.add(stem);
        }
      }

      // Enxame de abelhinhas quando a Lavoura ou Horta está sendo polinizada pelo Apiário!
      const cropBees = this.createBeeSwarmGroup(5, 0.36, 0.32);
      group.add(cropBees);
      animParts.beeSwarm = cropBees;
      return;
    }

    // -------------------------------------------------------------------------
    // 6. ANIMAIS DETALHADOS EM 3D INKED (VACA, GALINHA, PORCO — Visíveis de Cima e de Lado!)
    // -------------------------------------------------------------------------
    if (sub === 'cow') {
      const isSecond = card.id === 20;
      const cow1 = this.createDetailedCow3D(1.0, isSecond ? 'jersey' : 'holstein');
      cow1.position.set(-0.08, 0, -0.04);
      cow1.rotation.y = isSecond ? -0.45 : 0.35;
      group.add(cow1);

      const calf = this.createDetailedCow3D(0.68, isSecond ? 'holstein' : 'jersey');
      calf.position.set(0.22, 0, 0.16);
      calf.rotation.y = isSecond ? 0.55 : -0.65;
      group.add(calf);
      return;
    }

    if (sub === 'chicken') {
      const isSecond = card.id === 21;
      for (const [cx, cz, rot, variant, sc] of [
        [-0.18, 0.08, 0.4, isSecond ? 'rooster' : 'white', isSecond ? 1.08 : 1.0],
        [0.18, -0.10, -0.7, 'brown', 0.96],
        [-0.02, -0.20, 1.1, 'white', 0.92],
        [0.06, 0.22, 1.5, 'chick', 0.76],
        [0.22, 0.16, -1.2, 'chick', 0.72]
      ]) {
        const chk = this.createDetailedChicken3D(sc, variant);
        chk.position.set(cx, 0, cz);
        chk.rotation.y = rot;
        group.add(chk);
      }
      return;
    }

    if (sub === 'pig') {
      const isSecond = card.id === 22;
      for (const [px, pz, rot, sc, variant] of [
        [-0.18, 0.08, 0.5, 1.02, isSecond ? 'spotted' : 'pink'],
        [0.18, -0.06, -0.85, 0.95, isSecond ? 'pink' : 'spotted'],
        [0.02, 0.24, 1.3, 0.72, 'pink']
      ]) {
        const pig = this.createDetailedPig3D(sc, variant);
        pig.position.set(px, 0, pz);
        pig.rotation.y = rot;
        group.add(pig);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // 7. TRATOR (#13) E TECNOLOGIAS RURAIS (#14 A #19) EM 3D LOW-POLY INKED
    // -------------------------------------------------------------------------
    if (sub === 'tractor') {
      const greenMat = this.getInkedBoxMaterial('trac_green', '#3b7a3e', '#265428');
      const yellowMat = this.getInkedBoxMaterial('trac_yellow', '#f5b82e', '#d49415');
      const wheelMat = this.getInkedBoxMaterial('trac_wheel', '#262220', '#181412');

      const chassis = new THREE.Mesh(this.getGeo('trac_chassis', () => new THREE.BoxGeometry(0.28, 0.18, 0.48)), greenMat);
      chassis.position.set(0, 0.18, 0.04);
      group.add(chassis);

      const cab = new THREE.Mesh(this.getGeo('trac_cab', () => new THREE.BoxGeometry(0.26, 0.22, 0.24)), yellowMat);
      cab.position.set(0, 0.36, -0.08);
      group.add(cab);

      const wheelGeo = this.getGeo('trac_w_rear', () => {
        const g = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 10);
        g.rotateZ(Math.PI / 2);
        return g;
      });
      for (const sx of [-0.18, 0.18]) {
        const rw = new THREE.Mesh(wheelGeo, wheelMat);
        rw.position.set(sx, 0.15, -0.10);
        group.add(rw);

        const fw = new THREE.Mesh(wheelGeo, wheelMat);
        fw.scale.setScalar(0.65);
        fw.position.set(sx, 0.10, 0.18);
        group.add(fw);
      }
      return;
    }

    if (sub === 'beehive') {
      const hiveMat = this.getInkedBoxMaterial('hive_box_det', '#f5b82e', '#d49415', (ctx, W, H) => {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4;
        // Divisórias das melgueiras (gavetas da colmeia Langstroth) + alvado escuro de entrada
        ctx.beginPath();
        ctx.moveTo(6, H * 0.36);
        ctx.lineTo(W - 6, H * 0.36);
        ctx.moveTo(6, H * 0.68);
        ctx.lineTo(W - 6, H * 0.68);
        ctx.stroke();

        ctx.fillStyle = INK;
        ctx.fillRect(W * 0.28, H * 0.78, W * 0.44, 12);
      });
      const lidMat = this.getInkedBoxMaterial('hive_lid', '#9c5a25', '#6e3d16');

      for (const [hx, hz, rot] of [[-0.19, -0.04, 0.12], [0.19, 0.02, -0.15]]) {
        const hiveGroup = new THREE.Group();
        hiveGroup.position.set(hx, 0, hz);
        hiveGroup.rotation.y = rot;

        const box = new THREE.Mesh(this.getGeo('hive_b', () => new THREE.BoxGeometry(0.24, 0.26, 0.24)), hiveMat);
        box.position.y = 0.15;
        hiveGroup.add(box);

        const lid = new THREE.Mesh(this.getGeo('hive_l', () => new THREE.ConeGeometry(0.22, 0.11, 4)), lidMat);
        lid.position.y = 0.32;
        lid.rotation.y = Math.PI / 4;
        hiveGroup.add(lid);

        group.add(hiveGroup);
      }

      // Pote de mel dourado na frente + flores melíferas
      const honeyJar = new THREE.Mesh(
        this.getGeo('honey_jar', () => new THREE.CylinderGeometry(0.055, 0.06, 0.11, 8)),
        this.getInkedBoxMaterial('honey_gold', '#facc15', '#ca8a04')
      );
      honeyJar.position.set(0, 0.055, 0.24);
      group.add(honeyJar);

      // Enxame de até 8 abelhinhas 3D voando ao redor quando perto de elementos polinizadores!
      const apiaryBees = this.createBeeSwarmGroup(8, 0.38, 0.40);
      group.add(apiaryBees);
      animParts.beeSwarm = apiaryBees;
      return;
    }

    if (sub === 'bioinput' || sub === 'pesticide') {
      const isPest = sub === 'pesticide';
      const tankMat = this.getInkedBoxMaterial(
        `tank_${sub}`,
        isPest ? '#c9302c' : '#2d8a56',
        isPest ? '#8c1d1a' : '#1e613b'
      );
      const capMat = this.getInkedBoxMaterial(`cap_${sub}`, isPest ? '#f5b82e' : '#74c69d');

      for (const tx of [-0.16, 0.16]) {
        const cyl = new THREE.Mesh(this.getGeo('tank_cyl', () => new THREE.CylinderGeometry(0.14, 0.14, 0.34, 8)), tankMat);
        cyl.position.set(tx, 0.17, 0);
        group.add(cyl);

        const cap = new THREE.Mesh(this.getGeo('tank_cap', () => new THREE.CylinderGeometry(0.15, 0.15, 0.04, 8)), capMat);
        cap.position.set(tx, 0.35, 0);
        group.add(cap);
      }
      return;
    }

    if (sub === 'biodigester') {
      const domeMat = this.getInkedBoxMaterial('bio_dome', '#3b6978', '#254652');
      const dome = new THREE.Mesh(
        this.getGeo('bio_dome_geo', () => new THREE.SphereGeometry(0.30, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        domeMat
      );
      dome.position.set(0, 0.02, 0);
      group.add(dome);

      const flameMat = this.getInkedBoxMaterial('bio_flame', '#38bdf8');
      const flame = new THREE.Mesh(this.getGeo('bio_flame_geo', () => new THREE.ConeGeometry(0.05, 0.14, 6)), flameMat);
      flame.position.set(0, 0.36, 0);
      group.add(flame);
      return;
    }

    // Energia Solar (#19) — Placa inclinada visível de cima com células fotovoltaicas em nanquim
    const panelMat = this.getInkedBoxMaterial('solar_cells', '#1d4ed8', '#1e3a8a', (ctx, W, H) => {
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 3;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo((W * i) / 4, 8);
        ctx.lineTo((W * i) / 4, H - 8);
        ctx.moveTo(8, (H * i) / 4);
        ctx.lineTo(W - 8, (H * i) / 4);
        ctx.stroke();
      }
    });
    const post = new THREE.Mesh(
      this.getGeo('solar_post', () => new THREE.CylinderGeometry(0.05, 0.06, 0.20, 6)),
      this.getInkedBoxMaterial('solar_post_m', '#64748b')
    );
    post.position.y = 0.10;
    group.add(post);

    const panel = new THREE.Mesh(this.getGeo('solar_panel_g', () => new THREE.BoxGeometry(0.68, 0.04, 0.48)), panelMat);
    panel.position.y = 0.22;
    panel.rotation.x = 0.38;
    group.add(panel);
  }

  // ===========================================================================
  // MANCHA FLORESTAL DINÂMICA (COM AVES SILVESTRES "DEITADAS" E CUTIAS 3D!)
  // ===========================================================================

  buildForestClusterEcosystem(cluster, cardMeshesMap) {
    const group = new THREE.Group();
    group.name = cluster.id;
    const anim = { birds: [], rodents: [], foliage: [] };
    group.userData.anim = anim;

    const { members, level } = cluster;
    const worldPositions = [];
    const avgQuat = new THREE.Quaternion();
    let firstQuat = null;

    for (const m of members) {
      const mesh = cardMeshesMap?.get(m.id);
      if (mesh) {
        worldPositions.push(mesh.position.clone());
        if (!firstQuat) {
          firstQuat = mesh.quaternion.clone();
          avgQuat.copy(firstQuat);
        } else {
          avgQuat.slerp(mesh.quaternion, 1 / worldPositions.length);
        }
      } else {
        worldPositions.push(new THREE.Vector3(m.x, 0, m.z));
      }
    }

    const centroid3D = new THREE.Vector3();
    for (const p of worldPositions) centroid3D.add(p);
    centroid3D.divideScalar(Math.max(1, worldPositions.length));

    group.position.copy(centroid3D);
    group.quaternion.copy(avgQuat);

    const invQuat = avgQuat.clone().invert();
    const localPts = worldPositions.map(wp => wp.clone().sub(centroid3D).applyQuaternion(invQuat));

    // Arbustos e copas de conexão entre os pares de árvores (sem chão artificial!)
    const bushDiscGeo = this.getGeo('cluster_bush_disc', () => {
      const g = new THREE.PlaneGeometry(0.52, 0.52);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const bushMat = this.createCanopyDiscMat('cluster_bush', '#4e8c3a', '#316324', '#f5b82e');

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const meshA = cardMeshesMap?.get(members[i].id);
        const meshB = cardMeshesMap?.get(members[j].id);
        if (!meshA || !meshB) continue;

        const a = localPts[i];
        const b = localPts[j];
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > 4.2) continue;

        // Copas e arbustos fechando o dossel entre as árvores!
        const steps = level >= 3 ? 3 : 2;
        for (let k = 1; k <= steps; k++) {
          const t = k / (steps + 1);
          const sx = a.x + (b.x - a.x) * t;
          const sy = a.y + (b.y - a.y) * t;
          const sz = a.z + (b.z - a.z) * t;

          const canopyBridge = new THREE.Mesh(bushDiscGeo, bushMat);
          canopyBridge.position.set(sx, sy + 0.52 + (k % 2) * 0.06, sz);
          canopyBridge.scale.setScalar(level >= 3 ? 1.15 : 0.95);
          group.add(canopyBridge);
          anim.foliage.push(canopyBridge);
        }
      }
    }

    // AVES TROPICAIS DETALHADAS VOANDO "DEITADAS" (Arara, Tucano e Sanhaço vistos de cima e de lado!)
    const numBirds = level >= 3 ? 3 : 2;
    for (let b = 0; b < numBirds; b++) {
      const birdMesh = this.createDetailedBird3D(b);
      group.add(birdMesh);
      anim.birds.push({
        mesh: birdMesh,
        radius: 0.42 + b * 0.16,
        height: 0.82 + (b % 2) * 0.10,
        speed: 1.5 + b * 0.25,
        phase: b * 2.1
      });
    }

    // Cutias / Esquilos 3D detalhados no solo da floresta (Nível 3)
    if (level >= 3) {
      for (let r = 0; r < 3; r++) {
        const rodentMesh = this.createDetailedRodent3D(1.0);
        group.add(rodentMesh);
        anim.rodents.push({
          mesh: rodentMesh,
          radius: 0.34 + r * 0.14,
          speed: 1.2 + r * 0.25,
          phase: r * 2.1
        });
      }
    }

    return group;
  }

  // ===========================================================================
  // ANIMAÇÕES SUAVES EM TEMPO REAL
  // ===========================================================================

  updateCardAnimation(cardMesh, time, cardState) {
    const { animParts, phase = 0 } = cardMesh.userData;
    if (!animParts?.bounceGroup) return;

    const beat = Math.sin(time * 4.5 + phase);
    animParts.bounceGroup.scale.set(
      1.0 - beat * 0.025,
      1.0 + beat * 0.035,
      1.0 - beat * 0.025
    );

    if (animParts.waterOverlay) {
      animParts.waterOverlay.rotation.y = time * 0.45;
    }

    if (animParts.beeSwarm) {
      const activeCount = cardState?.beeCount || 0;
      animParts.beeSwarm.visible = activeCount > 0;
      if (activeCount > 0 && animParts.beeSwarm.userData.bees) {
        const bees = animParts.beeSwarm.userData.bees;
        for (let i = 0; i < bees.length; i++) {
          const b = bees[i];
          const isVisible = i < activeCount;
          b.mesh.visible = isVisible;
          if (!isVisible) continue;

          const t = time * b.speed + b.phase;
          const nx = Math.cos(t) * b.radius;
          const nz = b.fig8 ? Math.sin(t * 2) * b.radius * 0.55 : Math.sin(t) * b.radius;
          const ny = b.height + Math.sin(time * 7.5 + b.phase) * 0.045;

          b.mesh.position.set(nx, ny, nz);
          b.mesh.rotation.y = -t + (b.fig8 ? Math.cos(t) * 0.4 : 0);

          if (b.mesh.userData.wings) {
            b.mesh.userData.wings.scale.x = 1.0 + Math.sin(time * 42.0 + i) * 0.22;
          }
        }
      }
    }
  }

  updateForestClusterAnimation(clusterGroup, time) {
    const anim = clusterGroup.userData?.anim;
    if (!anim) return;

    if (anim.windmillBlades) {
      anim.windmillBlades.rotation.z = -time * 1.8;
    }

    if (anim.animals) {
      for (const item of anim.animals) {
        const { mesh, baseRotY = 0, phase = 0, bobSpeed = 3.5 } = item;
        const bob = Math.sin(time * bobSpeed + phase);
        mesh.rotation.y = baseRotY + Math.sin(time * 1.4 + phase) * 0.12;
        mesh.rotation.x = bob * 0.05;
        mesh.scale.y = 1.0 + bob * 0.03;
      }
    }

    if (anim.birds) {
      for (const bird of anim.birds) {
        const angle = time * bird.speed + bird.phase;
        const nx = Math.cos(angle) * bird.radius;
        const nz = Math.sin(angle) * bird.radius;
        const ny = bird.height + Math.sin(time * 4.2 + bird.phase) * 0.04;

        bird.mesh.position.set(nx, ny, nz);
        bird.mesh.rotation.set(
          Math.sin(time * 10.0 + bird.phase) * 0.15,
          -angle,
          0.18
        );
      }
    }

    if (anim.flyers) {
      for (const fl of anim.flyers) {
        const angle = time * fl.speed + fl.phase;
        fl.mesh.position.set(
          Math.cos(angle) * fl.radius,
          fl.height + Math.sin(time * 6.0 + fl.phase) * 0.03,
          Math.sin(angle) * fl.radius * 0.65
        );
        fl.mesh.rotation.y = -angle;
      }
    }

    if (anim.rodents) {
      for (const rod of anim.rodents) {
        const angle = -time * rod.speed + rod.phase;
        const hop = Math.abs(Math.sin(time * 7.0 + rod.phase)) * 0.04;
        rod.mesh.position.set(
          Math.cos(angle) * rod.radius,
          0.01 + hop,
          Math.sin(angle) * rod.radius
        );
        rod.mesh.rotation.y = angle + Math.PI;
      }
    }
  }
}
