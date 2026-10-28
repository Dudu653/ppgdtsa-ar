/**
 * Controlador Principal WebAR Fullscreen — Organização Territorial & Sustentabilidade Rural
 * Estabilização Anti-Tremor com:
 * - Zona Morta (Deadband / Histerese) no espaço de imagem antes da projeção 3D
 * - Filtro 1€ (One-Euro Filter) calibrado para coordenadas normalizadas de câmera
 * - Eliminação total da amplificação de ruído de inclinação (tilt wobble)
 */

import * as THREE from 'three';
import { CARD_BY_ID } from './data/cardsCatalog.js';
import { ArucoDetector } from './ar/arucoDetector.js';
import { SustainabilityEngine } from './engine/sustainabilityEngine.js';
import { RuralModelsFactory } from './models/ruralModels3D.js';

/**
 * Estabilizador 6DoF Real por Valores Singulares (SVD 2x2 + Escorço Pitagórico)
 * - Filtra os vetores de aresta 2D (vx, vz) e o centro (uc, vc) com Zona Morta + Filtro 1€
 * - Reconstrói a inclinação 3D exata (0° a 75°) e rotação 360° pelo achatamento cos(theta),
 *   permitindo ver todas as laterais dos modelos 3D sem tremor de ponto de fuga!
 */
class PoseStabilizer {
  constructor() {
    this.initialized = false;
    this.uc = 0;
    this.vc = 0;
    this.vx = { x: 0.1, y: 0 };
    this.vz = { x: 0, y: -0.1 };
    this.sign1 = 1;
    this.sign3 = 1;
    this.quat = new THREE.Quaternion();

    this.velPos = 0;
    this.velEdge = 0;
    this.lastTime = null;
  }

  alpha(dt, cutoff) {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / Math.max(0.001, dt));
  }

  deadband(delta, threshold) {
    if (Math.abs(delta) <= threshold) return 0;
    return delta - Math.sign(delta) * threshold;
  }

  update(raw, timestampMs) {
    if (!this.initialized || this.lastTime === null) {
      this.initialized = true;
      this.uc = raw.uc;
      this.vc = raw.vc;
      this.vx = { x: raw.vx.x, y: raw.vx.y };
      this.vz = { x: raw.vz.x, y: raw.vz.y };
      this.sign3 = raw.botLen >= raw.topLen ? 1 : -1;
      this.sign1 = raw.rightLen >= raw.leftLen ? 1 : -1;
      this.lastTime = timestampMs;
      return this.build3DPose(raw, 1.0);
    }

    const dt = Math.max(0.005, Math.min(0.15, (timestampMs - this.lastTime) * 0.001));
    this.lastTime = timestampMs;

    // 1. Filtra o centro (uc, vc) com Zona Morta de ~1.2px (0.0016 rad)
    const du = this.deadband(raw.uc - this.uc, 0.0016);
    const dv = this.deadband(raw.vc - this.vc, 0.0016);
    const speedPos = Math.hypot(du, dv) / dt;
    const aVel = this.alpha(dt, 1.8);
    this.velPos = aVel * speedPos + (1 - aVel) * this.velPos;

    const cutoffPos = 0.45 + 18.0 * this.velPos;
    const aPos = this.alpha(dt, cutoffPos);
    this.uc += aPos * du;
    this.vc += aPos * dv;

    // 2. Filtra os vetores de aresta 2D (vx, vz) com Zona Morta relativa
    const mag = Math.max(0.02, Math.hypot(this.vx.x, this.vx.y) + Math.hypot(this.vz.x, this.vz.y));
    const dbEdge = mag * 0.009;
    const dvxx = this.deadband(raw.vx.x - this.vx.x, dbEdge);
    const dvxy = this.deadband(raw.vx.y - this.vx.y, dbEdge);
    const dvzx = this.deadband(raw.vz.x - this.vz.x, dbEdge);
    const dvzy = this.deadband(raw.vz.y - this.vz.y, dbEdge);

    const speedEdge = Math.hypot(dvxx, dvxy, dvzx, dvzy) / (mag * dt);
    this.velEdge = aVel * speedEdge + (1 - aVel) * this.velEdge;

    const cutoffEdge = 0.40 + 14.0 * this.velEdge;
    const aEdge = this.alpha(dt, cutoffEdge);
    this.vx.x += aEdge * dvxx;
    this.vx.y += aEdge * dvxy;
    this.vz.x += aEdge * dvzx;
    this.vz.y += aEdge * dvzy;

    // Histerese para o sinal de perspectiva (qual borda está mais perto da câmera)
    const avgVert = 0.5 * (raw.botLen + raw.topLen);
    if (Math.abs(raw.botLen - raw.topLen) > avgVert * 0.03) {
      this.sign3 = raw.botLen >= raw.topLen ? 1 : -1;
    }
    const avgHoriz = 0.5 * (raw.rightLen + raw.leftLen);
    if (Math.abs(raw.rightLen - raw.leftLen) > avgHoriz * 0.03) {
      this.sign1 = raw.rightLen >= raw.leftLen ? 1 : -1;
    }

    return this.build3DPose(raw, aEdge);
  }

  build3DPose(raw, slerpAlpha) {
    const vx = this.vx;
    const vz = this.vz;

    // Maior valor singular sigma1 da matriz 2x2 [vx, vz]:
    // Mede a largura real sem escorço do quadrado em qualquer ângulo de inclinação!
    const nx2 = vx.x * vx.x + vx.y * vx.y;
    const nz2 = vz.x * vz.x + vz.y * vz.y;
    const dot = vx.x * vz.x + vx.y * vz.y;
    const sigma1 = Math.max(
      1e-4,
      Math.sqrt(0.5 * (nx2 + nz2 + Math.sqrt((nx2 - nz2) * (nx2 - nz2) + 4 * dot * dot)))
    );

    const zDepth = 1.0 / sigma1;
    const camPos = {
      x: this.uc * zDepth,
      y: this.vc * zDepth,
      z: -zDepth
    };

    // Projeções normalizadas no plano XY da câmera
    const r1x = vx.x / sigma1;
    const r1y = vx.y / sigma1;
    const r3x = vz.x / sigma1;
    const r3y = vz.y / sigma1;

    // Componentes Z fora do plano da tela por Pitágoras (escorço real cos(theta) -> sin(theta))!
    const sq1 = Math.max(0, 1.0 - (r1x * r1x + r1y * r1y));
    const sq3 = Math.max(0, 1.0 - (r3x * r3x + r3y * r3y));
    const absR1z = sq1 < 0.012 ? 0 : Math.sqrt(sq1);
    const absR3z = sq3 < 0.012 ? 0 : Math.sqrt(sq3);

    // Garante ortogonalidade 3D: r1 . r3 = r1x*r3x + r1y*r3y + r1z*r3z = 0
    const dot2D = r1x * r3x + r1y * r3y;
    let r1z, r3z;
    if (absR3z >= absR1z) {
      r3z = this.sign3 * absR3z;
      const s1 = Math.abs(dot2D) > 0.02 ? -Math.sign(dot2D * (r3z || 1)) : this.sign1;
      r1z = s1 * absR1z;
    } else {
      r1z = this.sign1 * absR1z;
      const s3 = Math.abs(dot2D) > 0.02 ? -Math.sign(dot2D * (r1z || 1)) : this.sign3;
      r3z = s3 * absR3z;
    }

    // Ortonormaliza a base 3D [xAxis (direita), yAxis (normal saindo da carta), zAxis (topo->base)]
    const vRight = new THREE.Vector3(r1x, r1y, r1z).normalize();
    const vDown = new THREE.Vector3(r3x, r3y, r3z).normalize();
    const vUp = new THREE.Vector3().crossVectors(vDown, vRight).normalize();
    if (vUp.z < 0) vUp.negate();

    const vZ = new THREE.Vector3().crossVectors(vRight, vUp).normalize();
    const vX = new THREE.Vector3().crossVectors(vUp, vZ).normalize();

    const rotMat = new THREE.Matrix4().makeBasis(vX, vUp, vZ);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

    if (slerpAlpha >= 0.99) {
      this.quat.copy(targetQuat);
    } else {
      this.quat.slerp(targetQuat, Math.max(0.18, Math.min(0.85, slerpAlpha)));
    }

    return {
      camPos,
      camQuat: this.quat.clone(),
      worldX: camPos.x / 1.35,
      worldZ: -camPos.y / 1.35,
      yaw: Math.atan2(vX.y, vX.x)
    };
  }
}

class TerritorialARApp {
  constructor() {
    this.video = document.getElementById('arVideo');
    this.cvCanvas = document.createElement('canvas');
    this.cvCanvas.width = 640;
    this.cvCanvas.height = 480;
    this.cvCtx = this.cvCanvas.getContext('2d', { willReadFrequently: true });

    this.hudCanvas = document.getElementById('arOverlayCanvas');
    this.hudCtx = this.hudCanvas.getContext('2d');

    this.detector = new ArucoDetector(640, 480);
    this.engine = new SustainabilityEngine();
    this.modelsFactory = new RuralModelsFactory();

    this.activeCards = new Map();
    this.cardMeshes = new Map();
    this.forestClusterMeshes = new Map();

    this.cameraActive = false;
    this.facingMode = 'environment';
    this.clock = new THREE.Clock();
    this.lastEvalTime = 0;
    this.currentReport = null;
    this.lastCombosSignature = '';
    this.lastCapturedBlob = null;
    this.lastCapturedDataUrl = null;
    this.ppgdtsaLogoCleanCanvas = null;

    this.initThreeScene();
    this.initUI();
    this.startCamera('environment');
    this.animate();
  }

  initThreeScene() {
    const container = document.getElementById('viewportContainer');
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.05,
      100
    );
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    const hemiLight = new THREE.HemisphereLight('#ffffff', '#3f6212', 1.4);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.7);
    sunLight.position.set(3.5, 6.0, 5.0);
    sunLight.castShadow = true;
    this.scene.add(sunLight);

    const camLight = new THREE.DirectionalLight('#ffffff', 0.9);
    camLight.position.set(0, 1, 2);
    this.camera.add(camLight);
    this.scene.add(this.camera);

    this.cardsGroup = new THREE.Group();
    this.forestsGroup = new THREE.Group();
    this.linksGroup = new THREE.Group();
    this.scene.add(this.cardsGroup);
    this.scene.add(this.forestsGroup);
    this.scene.add(this.linksGroup);

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  onResize() {
    const container = document.getElementById('viewportContainer');
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.hudCanvas.width = w;
    this.hudCanvas.height = h;
  }

  async startCamera(facingMode = this.facingMode) {
    const promptEl = document.getElementById('startCameraPrompt');
    try {
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
      }
      this.facingMode = facingMode;
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();

      this.cameraActive = true;
      if (promptEl) promptEl.style.display = 'none';
    } catch (err) {
      console.warn('Aguardando interação ou permissão da câmera:', err);
      if (promptEl) promptEl.style.display = 'flex';
    }
  }

  processARFrame(now) {
    if (!this.cameraActive || this.video.readyState < 2) return;

    const vw = this.video.videoWidth || 860;
    const vh = this.video.videoHeight || 640;
    const targetW = 860;
    const targetH = Math.round((vh / vw) * targetW);

    if (this.cvCanvas.width !== targetW || this.cvCanvas.height !== targetH) {
      this.cvCanvas.width = targetW;
      this.cvCanvas.height = targetH;
    }

    this.cvCtx.drawImage(this.video, 0, 0, targetW, targetH);
    const imageData = this.cvCtx.getImageData(0, 0, targetW, targetH);
    const detections = this.detector.detect(
      imageData,
      this.hudCanvas.width,
      this.hudCanvas.height,
      this.camera.fov
    );

    this.drawAROverlay(detections, targetW, targetH);

    for (const det of detections) {
      const { id, code, pose } = det;

      if (this.activeCards.has(id)) {
        const curr = this.activeCards.get(id);
        const stabilized = curr.stabilizer.update(pose, now);
        curr.camPos = stabilized.camPos;
        curr.camQuat = stabilized.camQuat;
        curr.x = stabilized.worldX;
        curr.z = stabilized.worldZ;
        curr.yaw = stabilized.yaw;
        curr.lastSeen = now;
      } else {
        const stabilizer = new PoseStabilizer();
        const stabilized = stabilizer.update(pose, now);
        this.activeCards.set(id, {
          id,
          code,
          stabilizer,
          camPos: stabilized.camPos,
          camQuat: stabilized.camQuat,
          x: stabilized.worldX,
          z: stabilized.worldZ,
          yaw: stabilized.yaw,
          lastSeen: now
        });
      }
    }

    // Persistência anti-flicker de 650ms
    for (const [id, entry] of this.activeCards.entries()) {
      if (now - entry.lastSeen > 650) {
        this.activeCards.delete(id);
      }
    }
  }

  drawAROverlay() {
    // Visual limpo na câmera
  }

  sync3DScene(time) {
    for (const [id, entry] of this.activeCards.entries()) {
      let mesh = this.cardMeshes.get(id);
      if (!mesh) {
        const cardDef = CARD_BY_ID[id];
        mesh = this.modelsFactory.createCardModel(cardDef);
        this.cardsGroup.add(mesh);
        this.cardMeshes.set(id, mesh);
      }

      mesh.position.set(entry.camPos.x, entry.camPos.y, entry.camPos.z);
      mesh.quaternion.copy(entry.camQuat);
      mesh.scale.setScalar(1.0);

      // Oculta os modelos 1x1 individuais quando fundidos num único Novo Modelo 2x1 ou 3x1
      const isFused = Boolean(this.currentReport?.fusedCardIds?.has(id));
      mesh.visible = !isFused;

      const cardState = this.currentReport?.cardStates?.[id];
      if (!isFused) {
        this.modelsFactory.updateCardAnimation(mesh, time, cardState);
      }

      if (mesh.userData.statusRing && cardState) {
        if (cardState.conflicts > 0) {
          mesh.userData.statusRing.material.color.setHex(0xef4444);
          mesh.userData.statusRing.material.opacity = 0.7 + Math.sin(time * 8) * 0.25;
        } else if (
          cardState.forestClusterLevel >= 2 ||
          cardState.hasRiparianForest ||
          cardState.isAgroforestry ||
          cardState.hasShade ||
          cardState.hasCoop ||
          cardState.isPollinating
        ) {
          mesh.userData.statusRing.material.color.setHex(0x10b981);
          mesh.userData.statusRing.material.opacity = 0.75;
        } else {
          mesh.userData.statusRing.material.color.set(CARD_BY_ID[id].accentColor);
          mesh.userData.statusRing.material.opacity = 0.45;
        }
      }
    }

    for (const [id, mesh] of this.cardMeshes.entries()) {
      if (!this.activeCards.has(id)) {
        this.cardsGroup.remove(mesh);
        this.cardMeshes.delete(id);
      }
    }

    for (const clusterMesh of this.forestClusterMeshes.values()) {
      const zone = clusterMesh.userData?.zone;
      if (zone && zone.members?.length === 2) {
        const meshA = this.cardMeshes.get(zone.members[0].id);
        const meshB = this.cardMeshes.get(zone.members[1].id);
        if (meshA && meshB) {
          const { mid, quat } = this.modelsFactory.computePairPlaneTransform(meshA, meshB);
          clusterMesh.position.copy(mid);
          clusterMesh.quaternion.copy(quat);
        }
      } else if (zone && zone.members?.length === 3) {
        const meshA = this.cardMeshes.get(zone.members[0].id);
        const meshB = this.cardMeshes.get(zone.members[1].id);
        const meshC = this.cardMeshes.get(zone.members[2].id);
        if (meshA && meshB && meshC) {
          const { mid, quat } = this.modelsFactory.computeTriplePlaneTransform(meshA, meshB, meshC);
          clusterMesh.position.copy(mid);
          clusterMesh.quaternion.copy(quat);
        }
      }
      this.modelsFactory.updateForestClusterAnimation(clusterMesh, time);
    }
  }

  evaluateNow() {
    const activeArray = Array.from(this.activeCards.values());
    const report = this.engine.evaluate(activeArray);
    this.currentReport = report;
    this.updateScoreHUD(report);
    this.rebuildForestClusters3D(report.forestClusters, report.mergedZones || []);
    this.rebuildInteractionLinks3D(report.links);
  }

  rebuildForestClusters3D(forestClusters, mergedZones = []) {
    while (this.forestsGroup.children.length > 0) {
      this.forestsGroup.remove(this.forestsGroup.children[0]);
    }
    this.forestClusterMeshes.clear();

    for (const cluster of forestClusters) {
      if (cluster.level >= 2) {
        const ecosystemMesh = this.modelsFactory.buildForestClusterEcosystem(cluster, this.cardMeshes);
        this.forestsGroup.add(ecosystemMesh);
        this.forestClusterMeshes.set(cluster.id, ecosystemMesh);
      }
    }

    for (const zone of mergedZones) {
      const mergedMesh = this.modelsFactory.buildMergedZone3D(zone, this.cardMeshes);
      mergedMesh.userData.zone = zone;
      this.forestsGroup.add(mergedMesh);
      this.forestClusterMeshes.set(zone.id, mergedMesh);
    }
  }

  rebuildInteractionLinks3D(_links) {
    while (this.linksGroup.children.length > 0) {
      const oldMesh = this.linksGroup.children[0];
      if (oldMesh.geometry) oldMesh.geometry.dispose();
      if (oldMesh.material) oldMesh.material.dispose();
      this.linksGroup.remove(oldMesh);
    }
  }

  initUI() {
    const hud = document.getElementById('cornerScoreHud');
    const pill = document.getElementById('gameCharPill');
    if (pill && hud) {
      pill.addEventListener('click', () => {
        hud.classList.toggle('expanded');
      });
    }

    document.getElementById('btnFlipCamera').addEventListener('click', () => {
      const next = this.facingMode === 'environment' ? 'user' : 'environment';
      this.startCamera(next);
    });

    document.getElementById('btnStartCameraPrompt').addEventListener('click', () => {
      this.startCamera(this.facingMode);
    });

    const btnTakePhoto = document.getElementById('btnTakePhoto');
    if (btnTakePhoto) {
      btnTakePhoto.addEventListener('click', () => this.captureAndOpenPhotoModal());
    }

    const modal = document.getElementById('photoPreviewModal');
    const btnClose = document.getElementById('btnClosePhotoModal');
    if (btnClose && modal) {
      btnClose.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    const btnDownload = document.getElementById('btnDownloadPhoto');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => this.downloadCapturedPhoto());
    }

    const btnShare = document.getElementById('btnSharePhoto');
    if (btnShare) {
      btnShare.addEventListener('click', () => this.shareCapturedPhoto());
    }

    this.initProducerHudIllustration();
    this.initPpgdtsaLogo();
  }

  /**
   * Carrega a ilustração anos 1930 da Produtora Rural em formato de Retrato de Jogo
   * e remove o fundo branco externo via flood-fill (preservando olhos e sorriso).
   */
  initProducerHudIllustration() {
    const canvas = document.getElementById('producerCharCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = './src/assets/produtora_hud.jpg';
    img.onload = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Enquadra o busto/rosto sorridente e chapéu da Produtora Rural para o medalhão da barra de jogo
      const sx = Math.round(img.width * 0.55);
      const sy = Math.round(img.height * 0.01);
      const sw = Math.round(img.width * 0.42);
      const sh = Math.round(img.height * 0.88);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

      this.removeWhiteBgFloodFill(ctx, W, H);
    };
  }

  /**
   * Pré-carrega o símbolo/logo oficial do PPGDTSA - UFPel para a moldura de foto compartilhável
   */
  initPpgdtsaLogo() {
    const img = new Image();
    img.src = './src/assets/ppgdtsa_logo.png';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Remove apenas o fundo branco puro (>245) mantendo a sombra suave da árvore e o texto nítido
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const minC = Math.min(r, g, b);
        if (minC > 246) {
          d[i + 3] = 0;
        } else if (minC > 230 && Math.max(r, g, b) - minC < 10) {
          d[i + 3] = Math.round(((246 - minC) / 16) * d[i + 3]);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      this.ppgdtsaLogoCleanCanvas = c;
    };
  }

  removeWhiteBgFloodFill(ctx, W, H) {
    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;
    const visited = new Uint8Array(W * H);
    const queue = new Int32Array(W * H);
    let head = 0;
    let tail = 0;

    const isBgWhite = idx => {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      return r > 225 && g > 225 && b > 220;
    };

    const pushSeed = (x, y) => {
      const p = y * W + x;
      if (!visited[p] && isBgWhite(p * 4)) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < W; x++) {
      pushSeed(x, 0);
      pushSeed(x, H - 1);
    }
    for (let y = 0; y < H; y++) {
      pushSeed(0, y);
      pushSeed(W - 1, y);
    }

    while (head < tail) {
      const p = queue[head++];
      const idx = p * 4;
      data[idx + 3] = 0;

      const x = p % W;
      const y = (p / W) | 0;
      const neighbors = [];
      if (x > 0) neighbors.push(p - 1);
      if (x < W - 1) neighbors.push(p + 1);
      if (y > 0) neighbors.push(p - W);
      if (y < H - 1) neighbors.push(p + W);

      for (const np of neighbors) {
        if (!visited[np]) {
          const nIdx = np * 4;
          if (isBgWhite(nIdx)) {
            visited[np] = 1;
            queue[tail++] = np;
          } else {
            const lum = (data[nIdx] + data[nIdx + 1] + data[nIdx + 2]) / 3;
            if (lum > 185) {
              data[nIdx + 3] = Math.round(((225 - lum) / 40) * 255);
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  updateScoreHUD(report) {
    const scoreValEl = document.getElementById('totalScoreValue');
    const ratingEl = document.getElementById('scoreRatingBadge');
    const ringCircle = document.getElementById('scoreGaugeCircle');
    const hpFillEl = document.getElementById('scoreHpFill');

    scoreValEl.textContent = report.totalScore;

    let shortRating = 'Aponte cartas';
    let inkBadgeColor = '#18120e';
    let hpGradient = 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)';

    if (this.activeCards.size > 0) {
      if (report.totalScore >= 82) {
        shortRating = '🏆 Sustentável';
        inkBadgeColor = '#065f46';
        hpGradient = 'linear-gradient(90deg, #059669 0%, #34d399 100%)';
      } else if (report.totalScore >= 65) {
        shortRating = '🌿 Equilibrado';
        inkBadgeColor = '#166534';
        hpGradient = 'linear-gradient(90deg, #16a34a 0%, #4ade80 100%)';
      } else if (report.totalScore >= 45) {
        shortRating = '⚖️ Transição';
        inkBadgeColor = '#92400e';
        hpGradient = 'linear-gradient(90deg, #d97706 0%, #facc15 100%)';
      } else {
        shortRating = '⚠️ Alerta';
        inkBadgeColor = '#991b1b';
        hpGradient = 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)';
      }
    }

    ratingEl.textContent = shortRating;
    ratingEl.style.color = inkBadgeColor;

    if (hpFillEl) {
      hpFillEl.style.width = `${report.totalScore}%`;
      hpFillEl.style.background = hpGradient;
    }

    const circumference = 238.76;
    const offset = circumference - (report.totalScore / 100) * circumference;
    ringCircle.style.strokeDashoffset = offset;
    ringCircle.style.stroke = report.ratingColor;

    const setBar = (id, val) => {
      const barEl = document.getElementById(`bar_${id}`);
      const valEl = document.getElementById(`val_${id}`);
      const pipEl = document.getElementById(`pip_${id}`);
      if (barEl) barEl.style.width = `${val}%`;
      if (valEl) valEl.textContent = `${val}%`;
      if (pipEl) pipEl.style.width = `${val}%`;
    };
    setBar('bio', report.pillars.biodiversidade);
    setBar('water', report.pillars.aguaSolo);
    setBar('prod', report.pillars.producao);
    setBar('well', report.pillars.bemEstar);

    // Atualiza a lista de todos os combos identificados na tela (logo abaixo da barra da personagem)
    const combos = report.combos || [];
    const combosContainer = document.getElementById('activeCombosContainer');
    const combosHeader = document.getElementById('combosHeaderChip');
    const combosList = document.getElementById('activeCombosList');

    if (combosContainer && combosList && combosHeader) {
      if (combos.length === 0) {
        combosContainer.classList.remove('has-combos');
        this.lastCombosSignature = '';
      } else {
        combosContainer.classList.add('has-combos');
        const positiveCount = combos.filter(c => c.tier !== 'conflict').length;
        combosHeader.textContent =
          positiveCount > 0 ? `⚡ Combos Ativos (${positiveCount})` : `⚠️ Alertas (${combos.length})`;

        const sig = combos.map(c => `${c.id}:${c.badge}`).join('|');
        if (sig !== this.lastCombosSignature) {
          this.lastCombosSignature = sig;
          combosList.innerHTML = combos
            .map(
              c => `
            <div class="combo-pill-item tier-${c.tier}">
              <span class="combo-icon">${c.icon}</span>
              <span class="combo-title">${c.title}</span>
              <span class="combo-badge">${c.badge}</span>
            </div>
          `
            )
            .join('');
        }
      }
    }
  }

  /**
   * Captura a cena AR atual, compõe uma imagem pronta para compartilhar com:
   * - Moldura estilizada 1930s + Agroecologia
   * - Barra de Score da Produtora Rural + 4 Pilares + Combos Ativos
   * - Símbolo oficial do programa PPGDTSA - UFPel e Instagram @ppgdtsa.ufpel
   */
  async captureAndOpenPhotoModal() {
    // Garante que o buffer WebGL 3D está recém-renderizado
    this.renderer.render(this.scene, this.camera);

    const flash = document.getElementById('cameraFlashOverlay');
    if (flash) {
      flash.style.opacity = '0.9';
      setTimeout(() => {
        flash.style.opacity = '0';
      }, 180);
    }

    const framedCanvas = this.buildFramedSnapshotCanvas();
    const dataUrl = framedCanvas.toDataURL('image/png');
    this.lastCapturedDataUrl = dataUrl;

    framedCanvas.toBlob(blob => {
      this.lastCapturedBlob = blob;
    }, 'image/png');

    const imgEl = document.getElementById('capturedPhotoImg');
    const modal = document.getElementById('photoPreviewModal');
    if (imgEl && modal) {
      imgEl.src = dataUrl;
      modal.style.display = 'flex';
    }
  }

  buildFramedSnapshotCanvas() {
    const viewW = Math.max(320, this.hudCanvas.width || window.innerWidth);
    const viewH = Math.max(320, this.hudCanvas.height || window.innerHeight);
    const isPortrait = viewH >= viewW * 0.95;

    // Resolução de alta definição pronta para Instagram / Redes Sociais
    const W = isPortrait ? 1080 : 1360;
    const H = isPortrait ? 1380 : 1080;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const report = this.currentReport || this.engine.evaluate([]);

    // 1. FUNDO DA MOLDURA PERGAMINHO / MADEIRA RETRÔ
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#fffdf6');
    bgGrad.addColorStop(0.5, '#f6e7c5');
    bgGrad.addColorStop(1, '#ebd4a2');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Textura sutil de pontilhado / grão nas bordas da moldura
    ctx.save();
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 10;
    this.roundRectPath(ctx, 10, 10, W - 20, H - 20, 32);
    ctx.stroke();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    this.roundRectPath(ctx, 22, 22, W - 44, H - 44, 24);
    ctx.stroke();
    ctx.restore();

    // Ornamentos botânicos de canto na moldura
    this.drawFrameCornerOrnaments(ctx, W, H);

    // 2. JANELA CENTRAL DA CÂMERA + MODELOS 3D AR (SEM DISTORÇÃO DE ASPECTO)
    const padX = 40;
    const topBarH = isPortrait ? 158 : 142;
    const footerH = isPortrait ? 168 : 148;
    const winX = padX;
    const winY = topBarH;
    const winW = W - padX * 2;
    const winH = H - topBarH - footerH - 28;

    // Sombra sólida retrô da janela da foto
    ctx.save();
    ctx.fillStyle = '#18120e';
    this.roundRectPath(ctx, winX, winY + 7, winW, winH, 24);
    ctx.fill();
    ctx.restore();

    // Compõe o vídeo da câmera + cena 3D exatamente na proporção real da tela e aplica cover na janela
    const screenComp = document.createElement('canvas');
    screenComp.width = viewW;
    screenComp.height = viewH;
    const sCtx = screenComp.getContext('2d');

    sCtx.fillStyle = '#121820';
    sCtx.fillRect(0, 0, viewW, viewH);

    if (this.video && this.video.readyState >= 2 && this.video.videoWidth > 0) {
      const vw = this.video.videoWidth;
      const vh = this.video.videoHeight;
      const scale = Math.max(viewW / vw, viewH / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (viewW - dw) * 0.5;
      const dy = (viewH - dh) * 0.5;
      sCtx.drawImage(this.video, dx, dy, dw, dh);
    }

    if (this.renderer && this.renderer.domElement) {
      sCtx.drawImage(this.renderer.domElement, 0, 0, viewW, viewH);
    }

    // Desenha o compósito na janela central com recorte arredondado
    ctx.save();
    this.roundRectPath(ctx, winX, winY, winW, winH, 24);
    ctx.clip();

    const compScale = Math.max(winW / viewW, winH / viewH);
    const cw = viewW * compScale;
    const ch = viewH * compScale;
    const cx = winX + (winW - cw) * 0.5;
    const cy = winY + (winH - ch) * 0.5;
    ctx.drawImage(screenComp, cx, cy, cw, ch);

    // Vinheta suave nas bordas internas da foto
    const vigGrad = ctx.createRadialGradient(
      winX + winW * 0.5,
      winY + winH * 0.5,
      Math.min(winW, winH) * 0.35,
      winX + winW * 0.5,
      winY + winH * 0.5,
      Math.max(winW, winH) * 0.75
    );
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(12,10,8,0.28)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(winX, winY, winW, winH);
    ctx.restore();

    // Contorno nanquim da janela da foto
    ctx.save();
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 6;
    this.roundRectPath(ctx, winX, winY, winW, winH, 24);
    ctx.stroke();
    ctx.restore();

    // 3. CABEÇALHO SUPERIOR: TÍTULO DO JOGO + BARRA DE PERSONAGEM E SCORE
    this.drawSnapshotHeaderAndScorePill(ctx, W, topBarH, padX, report, isPortrait);

    // 4. LISTA DE COMBOS ATIVOS SOBRE O CANTO SUPERIOR DIREITO DA JANELA DA FOTO
    this.drawSnapshotCombosOverlay(ctx, winX + winW - 18, winY + 18, report.combos || []);

    // 5. RODAPÉ INSTITUCIONAL: SÍMBOLO PPGDTSA + @ppgdtsa.ufpel
    const footerY = winY + winH + 16;
    this.drawSnapshotInstitutionalFooter(ctx, padX, footerY, winW, footerH - 22, isPortrait);

    return canvas;
  }

  drawFrameCornerOrnaments(ctx, W, H) {
    const corners = [
      { x: 34, y: 34, sx: 1, sy: 1 },
      { x: W - 34, y: 34, sx: -1, sy: 1 },
      { x: 34, y: H - 34, sx: 1, sy: -1 },
      { x: W - 34, y: H - 34, sx: -1, sy: -1 }
    ];
    for (const c of corners) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.sx, c.sy);
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#18120e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(12, 6, 10, 5, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(4, 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSnapshotHeaderAndScorePill(ctx, W, topBarH, padX, report, isPortrait) {
    // Bloco Esquerdo: Título principal "Organização do Sistema agroindustrial"
    const titleX = padX + 6;
    const centerHeaderY = Math.round(topBarH * 0.5);

    ctx.save();
    ctx.fillStyle = '#18120e';
    ctx.textBaseline = 'middle';
    if (isPortrait) {
      ctx.font = '900 32px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('🌱 Organização do', titleX, centerHeaderY - 18);
      ctx.fillText('Sistema agroindustrial', titleX, centerHeaderY + 20);
    } else {
      ctx.font = '900 36px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('🌱 Organização do Sistema agroindustrial', titleX, centerHeaderY + 2);
    }
    ctx.restore();

    // Bloco Direito: Pílula de Personagem de Jogo (Produtora Rural + Score + Barra + 4 Pilares)
    const pillW = isPortrait ? 450 : 490;
    const pillH = 104;
    const pillX = W - padX - pillW;
    const pillY = Math.round((topBarH - pillH) * 0.5) + 4;

    ctx.save();
    // Sombra sólida da pílula
    ctx.fillStyle = '#18120e';
    this.roundRectPath(ctx, pillX, pillY + 6, pillW, pillH, 52);
    ctx.fill();

    // Fundo da pílula
    const pillGrad = ctx.createLinearGradient(0, pillY, 0, pillY + pillH);
    pillGrad.addColorStop(0, '#fffdf7');
    pillGrad.addColorStop(1, '#f4dfaf');
    ctx.fillStyle = pillGrad;
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 5;
    this.roundRectPath(ctx, pillX, pillY, pillW, pillH, 52);
    ctx.fill();
    ctx.stroke();

    // 1) Medalhão Circular de Score (Esquerda da Pílula)
    const orbR = 40;
    const orbCx = pillX + 52;
    const orbCy = pillY + pillH * 0.5;

    ctx.fillStyle = '#fffdf9';
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(orbCx, orbCy, orbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Trilha do arco de score
    ctx.strokeStyle = 'rgba(24, 18, 14, 0.14)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(orbCx, orbCy, orbR - 9, 0, Math.PI * 2);
    ctx.stroke();

    // Arco preenchido do score
    const pct = Math.max(0, Math.min(100, report.totalScore || 0)) / 100;
    ctx.strokeStyle = report.ratingColor || '#10b981';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(orbCx, orbCy, orbR - 9, -Math.PI * 0.5, -Math.PI * 0.5 + pct * Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#18120e';
    ctx.font = '900 28px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${report.totalScore || 0}`, orbCx, orbCy - 4);

    ctx.fillStyle = '#6b4c30';
    ctx.font = '900 10px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('SCORE', orbCx, orbCy + 16);

    // 2) Centro da Pílula: Rating + Barra HP de Jogo + 4 Pilares
    const midX = orbCx + orbR + 14;
    const midW = pillW - (orbR * 2 + 126);

    let ratingText = report.rating || '🌿 Equilibrado';
    if (this.activeCards.size === 0) ratingText = '🌱 Território Livre';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#18120e';
    ctx.font = '900 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(ratingText, midX, pillY + 14);

    // Barra de Progresso estilo Jogo
    const barY = pillY + 41;
    const barH = 16;
    ctx.fillStyle = '#291f18';
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 3;
    this.roundRectPath(ctx, midX, barY, midW, barH, 8);
    ctx.fill();
    ctx.stroke();

    if (pct > 0) {
      ctx.save();
      this.roundRectPath(ctx, midX + 2, barY + 2, Math.max(10, (midW - 4) * pct), barH - 4, 6);
      ctx.fillStyle = report.ratingColor || '#10b981';
      ctx.fill();
      ctx.restore();
    }

    // Divisórias de 25%, 50%, 75% na barra
    ctx.strokeStyle = 'rgba(24, 18, 14, 0.55)';
    ctx.lineWidth = 2;
    for (const step of [0.25, 0.5, 0.75]) {
      const tx = midX + midW * step;
      ctx.beginPath();
      ctx.moveTo(tx, barY + 1);
      ctx.lineTo(tx, barY + barH - 1);
      ctx.stroke();
    }

    // 4 Mini-Pílulas dos Pilares
    const pillarsList = [
      { label: '🌿 Bio', val: report.pillars?.biodiversidade ?? 0, color: '#10b981' },
      { label: '💧 Água', val: report.pillars?.aguaSolo ?? 0, color: '#0ea5e9' },
      { label: '🌾 Prod', val: report.pillars?.producao ?? 0, color: '#eab308' },
      { label: '🏡 Vida', val: report.pillars?.bemEstar ?? 0, color: '#a855f7' }
    ];
    const pGap = 6;
    const pW = (midW - pGap * 3) / 4;
    const pY = pillY + 65;

    pillarsList.forEach((p, idx) => {
      const px = midX + idx * (pW + pGap);
      ctx.fillStyle = '#18120e';
      ctx.font = '800 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`${p.label} ${p.val}%`, px, pY);

      ctx.fillStyle = 'rgba(24,18,14,0.16)';
      this.roundRectPath(ctx, px, pY + 15, pW, 6, 3);
      ctx.fill();

      ctx.fillStyle = p.color;
      this.roundRectPath(ctx, px, pY + 15, Math.max(4, pW * (p.val / 100)), 6, 3);
      ctx.fill();
    });

    // 3) Avatar da Produtora Rural à direita da pílula
    const avR = 41;
    const avCx = pillX + pillW - 52;
    const avCy = pillY + pillH * 0.5;

    const avGrad = ctx.createRadialGradient(avCx, avCy - 8, 6, avCx, avCy, avR);
    avGrad.addColorStop(0, '#fef08a');
    avGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = avGrad;
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const charCanvas = document.getElementById('producerCharCanvas');
    if (charCanvas) {
      ctx.drawImage(charCanvas, avCx - 48, avCy - 54, 96, 100);
    }

    ctx.restore();
  }

  drawSnapshotCombosOverlay(ctx, rightX, topY, combos) {
    if (!combos || combos.length === 0) return;

    const visibleCombos = combos.slice(0, 6);
    let currY = topY;

    // Cabeçalho "⚡ COMBOS ATIVOS"
    ctx.save();
    const headW = 195;
    const headH = 30;
    ctx.fillStyle = '#18120e';
    this.roundRectPath(ctx, rightX - headW, currY, headW, headH, 15);
    ctx.fill();

    ctx.fillStyle = '#fde68a';
    ctx.font = '900 14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⚡ COMBOS ATIVOS (${combos.length})`, rightX - headW * 0.5, currY + headH * 0.5 + 1);
    currY += headH + 8;

    for (const c of visibleCombos) {
      const itemW = 275;
      const itemH = 40;
      const itemX = rightX - itemW;

      ctx.fillStyle = '#18120e';
      this.roundRectPath(ctx, itemX, currY + 4, itemW, itemH, 14);
      ctx.fill();

      if (c.tier === 'agrosystem') {
        ctx.fillStyle = '#fef08a';
      } else if (c.tier === 'fusion' || c.tier === 'forest') {
        ctx.fillStyle = '#d1fae5';
      } else if (c.tier === 'conflict') {
        ctx.fillStyle = '#fecaca';
      } else {
        ctx.fillStyle = '#fffdf5';
      }

      ctx.strokeStyle = '#18120e';
      ctx.lineWidth = 3;
      this.roundRectPath(ctx, itemX, currY, itemW, itemH, 14);
      ctx.fill();
      ctx.stroke();

      // Ícone e título do combo
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '900 19px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(c.icon, itemX + 10, currY + itemH * 0.5 + 1);

      ctx.fillStyle = '#18120e';
      ctx.font = '800 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(c.title.slice(0, 24), itemX + 38, currY + itemH * 0.5 + 1);

      // Badge à direita
      const badgeW = 52;
      const badgeH = 24;
      const badgeX = itemX + itemW - badgeW - 8;
      const badgeY = currY + (itemH - badgeH) * 0.5;
      ctx.fillStyle = c.tier === 'conflict' ? '#991b1b' : c.tier === 'agrosystem' ? '#92400e' : '#065f46';
      this.roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 12);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.badge, badgeX + badgeW * 0.5, badgeY + badgeH * 0.5 + 1);

      currY += itemH + 8;
    }
    ctx.restore();
  }

  drawSnapshotInstitutionalFooter(ctx, x, y, w, h, isPortrait) {
    ctx.save();

    // Sombra sólida do cartão institucional
    ctx.fillStyle = '#18120e';
    this.roundRectPath(ctx, x, y + 6, w, h, 22);
    ctx.fill();

    // Cartão claro para destacar perfeitamente o símbolo do PPGDTSA e o Instagram
    ctx.fillStyle = '#fffefb';
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 4.5;
    this.roundRectPath(ctx, x, y, w, h, 22);
    ctx.fill();
    ctx.stroke();

    // Lado Esquerdo: Símbolo e Nome do Programa PPGDTSA - UFPel
    const logoMaxW = isPortrait ? w * 0.58 : w * 0.56;
    const logoMaxH = h - 18;
    if (this.ppgdtsaLogoCleanCanvas) {
      const lw = this.ppgdtsaLogoCleanCanvas.width;
      const lh = this.ppgdtsaLogoCleanCanvas.height;
      const scale = Math.min(logoMaxW / lw, logoMaxH / lh);
      const dw = lw * scale;
      const dh = lh * scale;
      const dx = x + 18;
      const dy = y + (h - dh) * 0.5;
      ctx.drawImage(this.ppgdtsaLogoCleanCanvas, dx, dy, dw, dh);
    }

    // Lado Direito: Pílula do Instagram @ppgdtsa.ufpel
    const igPillW = isPortrait ? 355 : 385;
    const igPillH = isPortrait ? 86 : 82;
    const igPillX = x + w - igPillW - 18;
    const igPillY = y + (h - igPillH) * 0.5;

    ctx.fillStyle = '#18120e';
    this.roundRectPath(ctx, igPillX, igPillY + 4, igPillW, igPillH, 43);
    ctx.fill();

    const igBgGrad = ctx.createLinearGradient(igPillX, igPillY, igPillX + igPillW, igPillY + igPillH);
    igBgGrad.addColorStop(0, '#fffdf5');
    igBgGrad.addColorStop(1, '#fef3c7');
    ctx.fillStyle = igBgGrad;
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 3.5;
    this.roundRectPath(ctx, igPillX, igPillY, igPillW, igPillH, 43);
    ctx.fill();
    ctx.stroke();

    // Ícone da Câmera do Instagram estilizado
    const iconSize = 54;
    const iconX = igPillX + 16;
    const iconY = igPillY + (igPillH - iconSize) * 0.5;

    const instaGrad = ctx.createLinearGradient(iconX, iconY + iconSize, iconX + iconSize, iconY);
    instaGrad.addColorStop(0, '#fcb045');
    instaGrad.addColorStop(0.35, '#fd1d1d');
    instaGrad.addColorStop(0.7, '#d62976');
    instaGrad.addColorStop(1, '#833ab4');

    ctx.fillStyle = instaGrad;
    ctx.strokeStyle = '#18120e';
    ctx.lineWidth = 3;
    this.roundRectPath(ctx, iconX, iconY, iconSize, iconSize, 15);
    ctx.fill();
    ctx.stroke();

    // Lente interna do ícone do Instagram
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.2;
    this.roundRectPath(ctx, iconX + 10, iconY + 10, iconSize - 20, iconSize - 20, 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(iconX + iconSize * 0.5, iconY + iconSize * 0.5, 8.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(iconX + iconSize - 16, iconY + 16, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Texto @ppgdtsa.ufpel
    const textX = iconX + iconSize + 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#92400e';
    ctx.font = '900 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('SIGA E COMPARTILHE NO INSTAGRAM', textX, igPillY + 18);

    ctx.fillStyle = '#18120e';
    ctx.font = `900 ${isPortrait ? 26 : 28}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText('@ppgdtsa.ufpel', textX, igPillY + 35);

    ctx.restore();
  }

  roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  downloadCapturedPhoto() {
    if (!this.lastCapturedDataUrl) return;
    const link = document.createElement('a');
    link.download = `organizacao-sistema-agroindustrial-ppgdtsa-${Date.now()}.png`;
    link.href = this.lastCapturedDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async shareCapturedPhoto() {
    if (!this.lastCapturedBlob) {
      this.downloadCapturedPhoto();
      return;
    }
    const file = new File([this.lastCapturedBlob], 'organizacao-sistema-agroindustrial-ppgdtsa.png', {
      type: 'image/png'
    });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'Organização do Sistema agroindustrial — @ppgdtsa.ufpel',
          text: 'Confira minha Organização do Sistema agroindustrial no @ppgdtsa.ufpel!',
          files: [file]
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          this.downloadCapturedPhoto();
        }
      }
    } else {
      this.downloadCapturedPhoto();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const elapsed = this.clock.getElapsedTime();

    if (this.cameraActive) {
      this.processARFrame(now);
      if (now - this.lastEvalTime > 200) {
        this.evaluateNow();
        this.lastEvalTime = now;
      }
    }

    this.sync3DScene(elapsed);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.territorialApp = new TerritorialARApp();
});
