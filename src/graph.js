// 3D Perspective Canvas Graph Visualizer (Directional Prerequisite & Unlock Arrows)

export function createGraphVisualizer({ onSelectTopic, onResetFocus, getSubjectColor }) {
  const canvas = document.getElementById('graph-canvas');
  const container = document.getElementById('graph-canvas-container');
  const tooltip = document.getElementById('graph-tooltip');
  const statusTitle = document.getElementById('graph-status-title');
  const statusSubtitle = document.getElementById('graph-status-subtitle');

  const btnFit = document.getElementById('btn-graph-fit');
  const btnZoomIn = document.getElementById('btn-graph-zoom-in');
  const btnZoomOut = document.getElementById('btn-graph-zoom-out');
  const btnReset = document.getElementById('btn-graph-reset');

  const ctx = canvas.getContext('2d');

  // Camera State & Centering
  const SUN_X = 0, SUN_Y = -160, SUN_Z = 0;
  const GALAXY_CENTER_Y = 0;
  let rotY = 0.65, tilt = -0.52, zoom = 1.05;
  let rotYTarget = null, tiltTarget = null, zoomTarget = null;
  let camX = SUN_X, camY = GALAXY_CENTER_Y, camZ = SUN_Z;
  let camXTarget = SUN_X, camYTarget = GALAXY_CENTER_Y, camZTarget = SUN_Z;
  let centroidX = 0, centroidY = 0, centroidZ = 0;

  const FOV = 1100, NEAR = FOV * 0.05, H = 720;
  let DPR = 1, VW = 0, VH = 0;

  let nodes = [], edges = [];
  const nodeMap = new Map();
  let incident = [], lineage = null;
  let hoverIdx = -1, selectedId = null;

  let isDragging = false, isPanning = false, hasMoved = false, lastX = 0, lastY = 0;
  let P = new Float32Array(0);

  // Solar System Celestial Auto-Orbit
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AUTO_ORBIT_SPEED = prefersReducedMotion ? 0 : 0.0011;
  let autoSpeed = AUTO_ORBIT_SPEED;
  let lastInteractionTime = 0; // 0 ensures rotation starts immediately upon graph load

  function markInteraction() {
    lastInteractionTime = performance.now();
  }

  // Dynamic 3D Cosmic Star Dust Cloud (Continuous Orbital Flow & Harmonic Float)
  const STAR_DUST_COUNT = 180;
  const starDust = [];
  for (let i = 0; i < STAR_DUST_COUNT; i++) {
    const rad = 70 + Math.pow(Math.random(), 0.72) * 730;
    const baseTheta = Math.random() * Math.PI * 2;
    // Differential slow orbital drift: inner dust drifts slightly faster than outer dust
    const orbitSpeed = (0.000025 + (1 / Math.sqrt(rad)) * 0.00065) * (Math.random() > 0.1 ? 1 : -0.7);
    const py = (Math.random() - 0.5) * 580;
    const vertFreq1 = 0.00025 + Math.random() * 0.00035;
    const vertFreq2 = 0.00055 + Math.random() * 0.00045;
    const vertAmp = 1.6 + Math.random() * 1.8; // subtle 1.6-3.4px micro-float (no harsh bounce)
    const r = 0.55 + Math.random() * 1.15;
    const baseAlpha = 0.14 + Math.random() * 0.28;
    const twinkleSpeed = 0.0008 + Math.random() * 0.0014; // smooth starlight breathing
    const phase = Math.random() * Math.PI * 2;
    const randColor = Math.random();
    let rgb = '226, 232, 240'; // slate-200 celestial white
    if (randColor < 0.20) rgb = '186, 230, 253'; // sky-200 cosmic cyan
    else if (randColor < 0.35) rgb = '254, 240, 138'; // amber-200 solar dust
    else if (randColor < 0.48) rgb = '216, 180, 254'; // violet-300 nebula glow

    starDust.push({
      rad,
      baseTheta,
      orbitSpeed,
      py,
      vertFreq1,
      vertFreq2,
      vertAmp,
      r,
      baseAlpha,
      twinkleSpeed,
      phase,
      rgb,
      hasHalo: (r > 1.25 && Math.random() > 0.4)
    });
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    VW = container.clientWidth || 800;
    VH = container.clientHeight || 600;
    canvas.width = VW * DPR;
    canvas.height = VH * DPR;
    canvas.style.width = `${VW}px`;
    canvas.style.height = `${VH}px`;
  }

  window.addEventListener('resize', () => { if (container.offsetWidth > 0) resize(); });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { if (container.offsetWidth > 0 && container.offsetHeight > 0) resize(); }).observe(container);
  }

  // Pointer & Touch Events (1-Finger: Rotate, 2-Finger: Pinch Zoom & Pan, Mouse: Left Rotate, Middle/Shift Pan)
  const activePointers = new Map();
  let pinchStartDist = 0;
  let pinchStartZoom = zoom;
  let pinchStartMidX = 0, pinchStartMidY = 0;

  container.addEventListener('pointerdown', (e) => {
    markInteraction();
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault();
        isPanning = true; hasMoved = false; lastX = e.clientX; lastY = e.clientY;
        container.style.cursor = 'all-scroll'; container.setPointerCapture(e.pointerId);
      } else if (e.button === 0) {
        isDragging = true; hasMoved = false; lastX = e.clientX; lastY = e.clientY;
        container.setPointerCapture(e.pointerId);
      }
    } else if (activePointers.size === 2) {
      // Switch from drag to pinch-pan
      isDragging = false;
      const pts = Array.from(activePointers.values());
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartZoom = zoom;
      pinchStartMidX = (pts[0].x + pts[1].x) * 0.5;
      pinchStartMidY = (pts[0].y + pts[1].y) * 0.5;
      hasMoved = true;
    }
  });

  container.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  container.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointers.size === 2) {
      markInteraction();
      const pts = Array.from(activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStartDist > 0) {
        const factor = currentDist / pinchStartDist;
        zoom = Math.max(0.4, Math.min(3.5, pinchStartZoom * factor));
        zoomTarget = null;
      }
      const midX = (pts[0].x + pts[1].x) * 0.5, midY = (pts[0].y + pts[1].y) * 0.5;
      const dMidX = midX - pinchStartMidX, dMidY = midY - pinchStartMidY;
      const panSpeed = (1 / zoom) * 0.9, cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      camX -= (dMidX * cosY) * panSpeed; camZ -= (dMidX * sinY) * panSpeed; camY += dMidY * panSpeed;
      camXTarget = camX; camYTarget = camY; camZTarget = camZ;
      pinchStartMidX = midX; pinchStartMidY = midY;
    } else if (isPanning) {
      markInteraction();
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) hasMoved = true;
      const panSpeed = (1 / zoom) * 0.9, cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      camX -= (dx * cosY) * panSpeed; camZ -= (dx * sinY) * panSpeed; camY += dy * panSpeed;
      camXTarget = camX; camYTarget = camY; camZTarget = camZ;
      lastX = e.clientX; lastY = e.clientY;
    } else if (isDragging) {
      markInteraction();
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      const slop = e.pointerType === 'touch' ? 12 : 3;
      if (Math.abs(dx) + Math.abs(dy) > slop) hasMoved = true;
      rotY -= dx * 0.0055; tilt = Math.max(-1.15, Math.min(0.2, tilt - dy * 0.004));
      lastX = e.clientX; lastY = e.clientY;
      rotYTarget = null; tiltTarget = null;
    } else {
      handleHover(e);
    }
  });

  function handlePointerEnd(e) {
    markInteraction();
    activePointers.delete(e.pointerId);

    if (e.button === 1 || isPanning) {
      isPanning = false; container.style.cursor = '';
    } else if (e.button === 0 || e.pointerType === 'touch') {
      const wasDragging = isDragging;
      isDragging = false;
      if (!hasMoved && wasDragging) handleClick(e);
    }
  }

  container.addEventListener('pointerup', handlePointerEnd);
  container.addEventListener('pointercancel', handlePointerEnd);

  container.addEventListener('pointerleave', () => {
    isPanning = false; isDragging = false; activePointers.clear();
    container.style.cursor = '';
    hoverIdx = -1; hideTooltip();
  });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    markInteraction();
    zoom = Math.max(0.4, Math.min(3.5, zoom * Math.exp(-e.deltaY * 0.0016)));
    zoomTarget = null;
  }, { passive: false });

  btnFit.addEventListener('click', () => { markInteraction(); resetCamera(); });
  btnZoomIn.addEventListener('click', () => { markInteraction(); zoom = Math.min(3.5, zoom * 1.25); zoomTarget = null; });
  btnZoomOut.addEventListener('click', () => { markInteraction(); zoom = Math.max(0.4, zoom * 0.8); zoomTarget = null; });
  btnReset.addEventListener('click', () => {
    markInteraction();
    selectedId = null; lineage = null; hoverIdx = -1;
    hideTooltip(); resetCamera();
    statusTitle.textContent = `Skill map (${nodes.length.toLocaleString()} skills)`;
    statusSubtitle.textContent = `Each dot is a skill. Click one to see what comes before and after. Drag to rotate, scroll to zoom.`;
    if (onResetFocus) onResetFocus();
  });

  function getDefaultZoom() {
    if (VW < 600 || VH < 450) return 2.15;
    if (VW < 900 || VH < 600) return 1.45;
    return 1.05;
  }

  function resetCamera() {
    rotYTarget = 0.65;
    tiltTarget = (VW <= 600) ? -0.38 : -0.52;
    zoomTarget = getDefaultZoom();
    camXTarget = SUN_X;
    camYTarget = (VW <= 600) ? GALAXY_CENTER_Y - 20 : GALAXY_CENTER_Y;
    camZTarget = SUN_Z;
  }

  // Helper projection for spatial reference markers
  function projectPoint(px, py, pz, cy, sy, ct, st, cx, cyy, sc) {
    const dx = px - camX, dy = py - camY, dz = pz - camZ;
    const x = dx * cy + dz * sy, z = -dx * sy + dz * cy, y = dy;
    const y2 = y * ct - z * st, z2 = y * st + z * ct;
    const depth = FOV + z2 * sc * 1.5;
    if (depth < NEAR) return null;
    const pf = FOV / depth;
    return {
      x: cx + x * sc * pf,
      y: cyy - y2 * sc * pf,
      pf
    };
  }

  // 3D Perspective Projection
  function project() {
    const cy = Math.cos(rotY), sy = Math.sin(rotY), ct = Math.cos(tilt), st = Math.sin(tilt);
    const drawer = document.getElementById('detail-drawer');
    const isDrawerOpen = drawer && drawer.classList.contains('open');
    const isMobile = VW <= 900;
    let cx = VW * 0.5;
    let cyy = VH * 0.5;

    if (isDrawerOpen) {
      if (!isMobile) {
        // Desktop: drawer occupies right side (~420px)
        cx = (VW - 420) * 0.5;
      } else {
        // Mobile: center node in the visible space above the bottom sheet
        const drawerH = Math.min(VH * 0.45, drawer.clientHeight || 280);
        cyy = (VH - drawerH) * 0.52;
      }
    }
    const sc = Math.min(VW / 1400, VH / 1400) * zoom;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = n.x - camX, dy = n.py - camY, dz = n.z - camZ;
      const x = dx * cy + dz * sy, z = -dx * sy + dz * cy, y = dy;
      const y2 = y * ct - z * st, z2 = y * st + z * ct;
      const depth = FOV + z2 * sc * 1.5;

      if (depth < NEAR) { P[i * 3 + 2] = 0; continue; }
      const pf = FOV / depth;
      P[i * 3] = cx + x * sc * pf;
      P[i * 3 + 1] = cyy - y2 * sc * pf;
      P[i * 3 + 2] = pf;
    }
  }

  function nodeRadius(i) {
    const n = nodes[i];
    const baseR = 3.2 + Math.sqrt(n.topic.centrality || 0.05) * 7.5;
    return baseR * P[i * 3 + 2] * Math.min(1.5, Math.max(0.7, zoom));
  }

  function pick(mx, my) {
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const pf = P[i * 3 + 2];
      if (pf === 0) continue;
      const dx = P[i * 3] - mx, dy = P[i * 3 + 1] - my;
      const d = Math.hypot(dx, dy);
      const isTarget = lineage && i === lineage.targetIdx;
      const isDirectPrereq = lineage && lineage.directPrereqNodes.has(i);
      const isDirectUnlock = lineage && lineage.directUnlockNodes.has(i);
      const isConnected = isTarget || isDirectPrereq || isDirectUnlock;

      const hitR = Math.max(isConnected ? 26 : 14, nodeRadius(i) + (isConnected ? 14 : 6));
      if (d <= hitR) {
        const score = (hitR - d) + pf * 25 + (isConnected ? 60 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
    }
    return best;
  }

  function handleHover(e) {
    const rect = canvas.getBoundingClientRect();
    const idx = pick(e.clientX - rect.left, e.clientY - rect.top);
    if (idx !== hoverIdx) {
      hoverIdx = idx;
      if (hoverIdx >= 0) {
        container.style.cursor = 'pointer';
        markInteraction();
        showTooltip(e.clientX - rect.left, e.clientY - rect.top, nodes[hoverIdx]);
      } else {
        if (!isDragging && !isPanning) container.style.cursor = 'grab';
        hideTooltip();
      }
    } else if (hoverIdx >= 0) {
      container.style.cursor = 'pointer';
      markInteraction();
      placeTooltip(e.clientX - rect.left, e.clientY - rect.top);
    }
  }

  function handleClick(e) {
    markInteraction();
    const rect = canvas.getBoundingClientRect();
    const idx = pick(e.clientX - rect.left, e.clientY - rect.top);
    if (idx < 0) {
      selectedId = null; lineage = null;
      camXTarget = SUN_X; camYTarget = GALAXY_CENTER_Y; camZTarget = SUN_Z;
      statusTitle.textContent = `Skill map (${nodes.length.toLocaleString()} skills)`;
      statusSubtitle.textContent = `Each dot is a skill. Click one to see what comes before and after. Drag to rotate, scroll to zoom.`;
      if (onResetFocus) onResetFocus();
      return;
    }

    const targetNode = nodes[idx];
    selectedId = targetNode.topic.id;
    buildLineage(idx);
    focusNode(idx);
    if (onSelectTopic) onSelectTopic(targetNode.topic);
  }

  function focusNode(idx) {
    const n = nodes[idx];
    camXTarget = n.x; camYTarget = n.py; camZTarget = n.z;
    let best = null, bestZ = Infinity;
    for (const cand of [Math.atan2(-n.x, n.z), Math.atan2(-n.x, n.z) + Math.PI]) {
      const z2 = -n.x * Math.sin(cand) + n.z * Math.cos(cand);
      if (z2 < bestZ) { bestZ = z2; best = cand; }
    }
    const isMobile = VW <= 600;
    rotYTarget = best;
    tiltTarget = isMobile ? -0.24 : -0.32;
    zoomTarget = isMobile ? Math.max(zoom, 1.85) : Math.max(zoom, 1.35);
  }

  // Build dual directional lineage: Prerequisites (inbound) and Unlocks (outbound)
  function buildLineage(targetIdx) {
    const directPrereqNodes = new Set(), directUnlockNodes = new Set();
    const prereqNodes = new Set(), prereqEdges = new Set();
    const unlockNodes = new Set(), unlockEdges = new Set();

    // 1. Inbound Prerequisites (e.sourceIdx depends on e.targetIdx)
    const pQueue = [targetIdx];
    while (pQueue.length > 0) {
      const u = pQueue.shift();
      const inc = incident[u] || [];
      for (const edgeIdx of inc) {
        const e = edges[edgeIdx];
        if (e.sourceIdx === u) {
          prereqEdges.add(edgeIdx);
          if (u === targetIdx && e.targetIdx !== targetIdx) {
            directPrereqNodes.add(e.targetIdx);
          }
          if (!prereqNodes.has(e.targetIdx) && e.targetIdx !== targetIdx) {
            prereqNodes.add(e.targetIdx); pQueue.push(e.targetIdx);
          }
        }
      }
    }

    // 2. Outbound Unlocks (e.targetIdx is prerequisite for e.sourceIdx)
    const uQueue = [targetIdx];
    while (uQueue.length > 0) {
      const u = uQueue.shift();
      const inc = incident[u] || [];
      for (const edgeIdx of inc) {
        const e = edges[edgeIdx];
        if (e.targetIdx === u) {
          unlockEdges.add(edgeIdx);
          if (u === targetIdx && e.sourceIdx !== targetIdx) {
            directUnlockNodes.add(e.sourceIdx);
          }
          if (!unlockNodes.has(e.sourceIdx) && e.sourceIdx !== targetIdx) {
            unlockNodes.add(e.sourceIdx); uQueue.push(e.sourceIdx);
          }
        }
      }
    }

    const allNodes = new Set([targetIdx, ...prereqNodes, ...unlockNodes]);
    lineage = { targetIdx, prereqNodes, prereqEdges, directPrereqNodes, unlockNodes, unlockEdges, directUnlockNodes, allNodes };

    const dP = directPrereqNodes.size, sP = prereqNodes.size - dP;
    const dU = directUnlockNodes.size, sU = unlockNodes.size - dU;
    const selTopic = nodes[targetIdx].topic;
    statusTitle.innerHTML = `<span style="color:#ffffff; font-weight:700;">★ ${escapeHtml(selTopic.name)}</span>`;
    statusSubtitle.innerHTML = `<span style="color:#f59e0b; font-weight:600;">🟡 ${dP} Learn first${sP > 0 ? ` <span style="color:#fde68a; font-weight:400;">(+${sP} secondary)</span>` : ''}</span> · <span style="color:#38bdf8; font-weight:600;">🔵 ${dU} Leads to${sU > 0 ? ` <span style="color:#bae6fd; font-weight:400;">(+${sU} secondary)</span>` : ''}</span> · <span style="color:#94a3b8;">Click any node to navigate</span>`;
  }

  function showTooltip(x, y, node) {
    const t = node.topic;
    const col = getSubjectColor(t.subject);
    let relTag = '';
    let reasonText = '';

    if (lineage && selectedId) {
      if (node.topic.id === selectedId) {
        relTag = '<div style="color: #ffffff; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.03em;">★ SELECTED</div>';
      } else if (lineage.directPrereqNodes.has(node.idx)) {
        relTag = '<div style="color: #f59e0b; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.03em;">🟡 LEARN FIRST</div>';
        const edge = edges.find(e => e.sourceIdx === lineage.targetIdx && e.targetIdx === node.idx);
        if (edge && edge.reason) {
          reasonText = `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed rgba(245, 158, 11, 0.35); font-size: 0.72rem; color: #fde68a; font-style: italic;">"${escapeHtml(edge.reason)}"</div>`;
        }
      } else if (lineage.prereqNodes.has(node.idx)) {
        relTag = '<div style="color: #fde68a; font-size: 0.7rem; font-weight: 600; margin-bottom: 3px;">🟡 ALSO LEARN FIRST</div>';
      } else if (lineage.directUnlockNodes.has(node.idx)) {
        relTag = '<div style="color: #38bdf8; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.03em;">🔵 LEADS TO</div>';
        const edge = edges.find(e => e.targetIdx === lineage.targetIdx && e.sourceIdx === node.idx);
        if (edge && edge.reason) {
          reasonText = `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed rgba(56, 189, 248, 0.35); font-size: 0.72rem; color: #bae6fd; font-style: italic;">"${escapeHtml(edge.reason)}"</div>`;
        }
      } else if (lineage.unlockNodes.has(node.idx)) {
        relTag = '<div style="color: #bae6fd; font-size: 0.7rem; font-weight: 600; margin-bottom: 3px;">🔵 LEADS TO LATER</div>';
      }
    }

    const clickPrompt = (selectedId && node.topic.id !== selectedId)
      ? '<div style="margin-top: 6px; font-size: 0.68rem; font-weight: 600; color: #38bdf8; display: flex; align-items: center; gap: 4px;">Click node to focus & navigate →</div>'
      : '<div style="margin-top: 4px; font-size: 0.68rem; color: #94a3b8;">Click to inspect skill and what comes next</div>';

    tooltip.innerHTML = `
      ${relTag}
      <div style="font-weight: 700; color: #fff; font-size: 0.85rem; margin-bottom: 2px;">${escapeHtml(t.name)}</div>
      <div style="color: ${col}; font-size: 0.725rem; font-weight: 600;">${escapeHtml(t.subject)} · Age ${t.ageRangeStart}–${t.ageRangeEnd}</div>
      <div style="color: #94a3b8; font-size: 0.7rem; margin-top: 2px;">${escapeHtml(t.domain)}</div>
      ${reasonText}
      ${clickPrompt}
    `;
    tooltip.style.display = 'block';
    placeTooltip(x, y);
  }

  function placeTooltip(x, y) {
    const w = tooltip.offsetWidth || 220, h = tooltip.offsetHeight || 80;
    let posX = x + 16, posY = y + 16;
    if (posX + w > VW - 10) posX = x - w - 16;
    if (posY + h > VH - 10) posY = y - h - 16;
    tooltip.style.left = `${posX}px`; tooltip.style.top = `${posY}px`;
  }

  function hideTooltip() { tooltip.style.display = 'none'; }

  function setFocusTopic(topic) {
    if (topic) {
      selectedId = topic.id;
      const idx = nodes.findIndex(n => n.topic.id === topic.id);
      if (idx >= 0) {
        buildLineage(idx);
        focusNode(idx);
      }
      markInteraction();
    } else {
      selectedId = null;
      lineage = null;
      statusTitle.textContent = `Skill map (${nodes.length.toLocaleString()} skills)`;
      statusSubtitle.textContent = `Each dot is a skill. Click one to see what comes before and after. Drag to rotate, scroll to zoom.`;
      hideTooltip();
    }
  }

  function setGraphData({ filteredTopics, dependencies, topicMap, focusTopic }) {
    build3DData(filteredTopics, dependencies);
    resize();
    setFocusTopic(focusTopic);
  }

  function build3DData(filteredTopics, dependencies) {
    statusTitle.textContent = `Skill map (${filteredTopics.length.toLocaleString()} skills)`;
    statusSubtitle.textContent = `Each dot is a skill. Click one to see what comes before and after. Drag to rotate, scroll to zoom.`;

    const subjectAngles = {
      'Science': 0.0,
      'Mathematics': (Math.PI * 2) / 8,
      'English': (Math.PI * 4) / 8,
      'History': (Math.PI * 6) / 8,
      'Personal & Social Development': Math.PI,
      'Life Skills': (Math.PI * 10) / 8,
      'Computing': (Math.PI * 12) / 8,
      'Learning to Learn': (Math.PI * 14) / 8
    };

    nodeMap.clear();
    let sumX = 0, sumY = 0, sumZ = 0;

    nodes = filteredTopics.map((topic, i) => {
      // Normalized age progression: 0 (age 4) to 1 (age 15)
      const ageNorm = Math.max(0, Math.min(1, ((topic.ageRangeStart || 4) - 4) / 11));

      // Base subject angle (8 galaxy arms)
      const baseAngle = subjectAngles[topic.subject] !== undefined ? subjectAngles[topic.subject] : 0;

      // Spiral winding: logarithmic rotation winding outward as age increases (~68 degrees total curve)
      const spiralTwist = ageNorm * 1.2;

      // Organic dispersion within the subject arm (core is dense, outer arms expand)
      const armSpread = 0.2 + ageNorm * 0.12;
      const jitterAngle = Math.sin(i * 997.13 + 12.3) * armSpread;
      const theta = baseAngle + spiralTwist + jitterAngle;

      // Radius expands from inner foundational disc (~115) to outer frontier (~550)
      const radialJitter = Math.cos(i * 37.19 + 7.1) * (16 + ageNorm * 28);
      const radius = 115 + Math.pow(ageNorm, 0.86) * 435 + radialJitter;

      // Elevation (py): gentle ascending dome/helix
      const py = (ageNorm - 0.5) * 320 + Math.sin(ageNorm * Math.PI) * 45;

      const nodeObj = {
        idx: i,
        topic,
        x: radius * Math.cos(theta),
        py,
        z: radius * Math.sin(theta),
        col: getSubjectColor(topic.subject),
        ageNorm
      };
      sumX += nodeObj.x; sumY += nodeObj.py; sumZ += nodeObj.z;
      nodeMap.set(topic.id, i);
      return nodeObj;
    });

    centroidX = nodes.length ? sumX / nodes.length : 0;
    centroidY = nodes.length ? sumY / nodes.length : 0;
    centroidZ = nodes.length ? sumZ / nodes.length : 0;

    if (!selectedId) {
      camXTarget = SUN_X; camYTarget = GALAXY_CENTER_Y; camZTarget = SUN_Z;
      camX = SUN_X; camY = GALAXY_CENTER_Y; camZ = SUN_Z;
      zoom = getDefaultZoom();
    }

    P = new Float32Array(nodes.length * 3);
    incident = Array.from({ length: nodes.length }, () => []);
    edges = [];

    dependencies.forEach(dep => {
      const sIdx = nodeMap.get(dep.topicId);
      const tIdx = nodeMap.get(dep.prerequisiteId);
      if (sIdx !== undefined && tIdx !== undefined) {
        const edgeIdx = edges.length;
        edges.push({ sourceIdx: sIdx, targetIdx: tIdx, strength: dep.strength, reason: dep.reason });
        incident[sIdx].push(edgeIdx); incident[tIdx].push(edgeIdx);
      }
    });
  }

  // Draw directional arrowhead on 3D projected vector
  function drawArrow(x1, y1, x2, y2, targetR, color, size = 8) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < targetR + size + 2) return;
    const angle = Math.atan2(dy, dx);
    const endX = x2 - Math.cos(angle) * (targetR + 3);
    const endY = y2 - Math.sin(angle) * (targetR + 3);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - size * Math.cos(angle - 0.42), endY - size * Math.sin(angle - 0.42));
    ctx.lineTo(endX - size * Math.cos(angle + 0.42), endY - size * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fill();
  }

  // Render ambient dynamic star dust with continuous orbital flow and organic breathing
  function drawStarDust(now, cy, sy, ct, st, cx, cyy, sc, hasSel) {
    const dimFactor = hasSel ? ((VW <= 600) ? 0.04 : 0.16) : 1.0;
    const len = starDust.length;
    for (let i = 0; i < len; i++) {
      const d = starDust[i];

      // 1. Continuous organic orbital drift around galactic core
      const currentTheta = d.baseTheta + now * d.orbitSpeed;
      const px = d.rad * Math.cos(currentTheta);
      const pz = d.rad * Math.sin(currentTheta);

      // 2. Micro compound vertical drift (smooth dual harmonic, no hard bounce)
      const currentPy = d.py + (Math.sin(now * d.vertFreq1 + d.phase) + 0.35 * Math.cos(now * d.vertFreq2 + d.phase * 1.6)) * d.vertAmp;

      // 3. 3D perspective projection in world space
      const dx = px - camX, dy = currentPy - camY, dz = pz - camZ;
      const x = dx * cy + dz * sy, z = -dx * sy + dz * cy, y = dy;
      const y2 = y * ct - z * st, z2 = y * st + z * ct;
      const depth = FOV + z2 * sc * 1.5;
      if (depth < NEAR) continue;

      const pf = FOV / depth;
      const screenX = cx + x * sc * pf;
      const screenY = cyy - y2 * sc * pf;
      if (screenX < -20 || screenX > VW + 20 || screenY < -20 || screenY > VH + 20) continue;

      // 4. Optical luminance breathing (organic starlight shimmer)
      const twinkle = 0.72 + 0.28 * Math.sin(now * d.twinkleSpeed + d.phase);
      const alpha = d.baseAlpha * twinkle * dimFactor * Math.min(1.2, pf * 1.15);
      if (alpha <= 0.015) continue;

      const r = d.r * Math.max(0.5, Math.min(1.4, pf * zoom));

      if (d.hasHalo && alpha > 0.12) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${d.rgb}, ${alpha * 0.22})`;
        ctx.arc(screenX, screenY, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(${d.rgb}, ${alpha})`;
      ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    project();

    const hasSel = !!lineage;
    const isMobile = VW <= 600;
    const cy = Math.cos(rotY), sy = Math.sin(rotY), ct = Math.cos(tilt), st = Math.sin(tilt);
    const drawer = document.getElementById('detail-drawer');
    const isDrawerOpen = drawer && drawer.classList.contains('open');
    const cx = (isDrawerOpen && VW > 900) ? (VW - 460) * 0.5 : VW * 0.5;
    const cyy = VH * 0.5, sc = Math.min(VW / 1400, VH / 1400) * zoom;
    const now = performance.now();

    // 0. Ambient Cosmic Star Dust (deepest background layer)
    drawStarDust(prefersReducedMotion ? 0 : now, cy, sy, ct, st, cx, cyy, sc, hasSel);

    // 1. Draw Subtle Orbital Age Reference Rings (when no node selected)
    if (!hasSel && nodes.length > 0) {

      const ringAges = [
        { age: 5, label: 'Age 5 · Early Years' },
        { age: 8, label: 'Age 8 · Primary' },
        { age: 11, label: 'Age 11 · Upper Primary' },
        { age: 14, label: 'Age 14 · Secondary' }
      ];

      ctx.save();
      for (const r of ringAges) {
        const norm = (r.age - 4) / 11;
        const radius = 115 + Math.pow(norm, 0.86) * 435;
        const py = (norm - 0.5) * 320 + Math.sin(norm * Math.PI) * 45;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1;

        let first = true;
        const steps = 48;
        let labelPoint = null;

        for (let s = 0; s <= steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          const pt = projectPoint(radius * Math.cos(a), py, radius * Math.sin(a), cy, sy, ct, st, cx, cyy, sc);
          if (!pt) continue;
          if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
          else { ctx.lineTo(pt.x, pt.y); }
          if (s === Math.floor(steps * 0.4)) labelPoint = pt;
        }
        ctx.stroke();

        if (labelPoint && labelPoint.pf > 0.45) {
          ctx.setLineDash([]);
          ctx.font = '10px Plus Jakarta Sans, sans-serif';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.fillText(r.label, labelPoint.x + 8, labelPoint.y);
        }
      }

      // Radiant Sun at Galactic Core (Foundational Origin)
      const sunPt = projectPoint(SUN_X, SUN_Y, SUN_Z, cy, sy, ct, st, cx, cyy, sc);
      if (sunPt && sunPt.pf > 0.25) {
        const sunR = Math.max(14, 28 * sunPt.pf * Math.min(1.4, Math.max(0.7, zoom)));

        // Multi-layered corona glow
        const glowGrad = ctx.createRadialGradient(sunPt.x, sunPt.y, sunR * 0.2, sunPt.x, sunPt.y, sunR * 3.2);
        glowGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        glowGrad.addColorStop(0.25, 'rgba(245, 158, 11, 0.45)');
        glowGrad.addColorStop(0.6, 'rgba(234, 88, 12, 0.15)');
        glowGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(sunPt.x, sunPt.y, sunR * 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Sun photosphere core
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.arc(sunPt.x, sunPt.y, sunR * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

      }

      ctx.restore();
    }

    // 1. Draw Inactive / Background Edges with Depth Attenuation
    for (let k = 0; k < edges.length; k++) {
      if (hasSel && (lineage.prereqEdges.has(k) || lineage.unlockEdges.has(k))) continue;
      const e = edges[k], a = e.sourceIdx, b = e.targetIdx;
      if (P[a * 3 + 2] === 0 || P[b * 3 + 2] === 0) continue;

      const pfa = P[a * 3 + 2];
      ctx.beginPath();
      ctx.strokeStyle = hasSel
        ? (isMobile ? 'rgba(30, 41, 59, 0.008)' : 'rgba(100, 116, 139, 0.05)')
        : (e.strength === 'hard' ? `rgba(148, 163, 184, ${Math.min(0.12, 0.07 * pfa)})` : `rgba(148, 163, 184, ${Math.min(0.05, 0.03 * pfa)})`);
      ctx.lineWidth = 1;
      ctx.moveTo(P[a * 3], P[a * 3 + 1]); ctx.lineTo(P[b * 3], P[b * 3 + 1]);
      ctx.stroke();
    }

    // 2. Draw Active Highlighted Edges with Directional Arrows
    if (hasSel) {
      // 2A. Inbound Prerequisites (prereq b -> dependent a; arrow points at a)
      const prereqList = Array.from(lineage.prereqEdges);
      prereqList.sort((k1, k2) => {
        const isDir1 = edges[k1].sourceIdx === lineage.targetIdx ? 1 : 0;
        const isDir2 = edges[k2].sourceIdx === lineage.targetIdx ? 1 : 0;
        return isDir1 - isDir2;
      });

      prereqList.forEach(k => {
        const e = edges[k], a = e.sourceIdx, b = e.targetIdx;
        if (P[a * 3 + 2] === 0 || P[b * 3 + 2] === 0) return;
        const x1 = P[b * 3], y1 = P[b * 3 + 1], x2 = P[a * 3], y2 = P[a * 3 + 1];
        const isDirect = (a === lineage.targetIdx);
        const isSoft = (e.strength === 'soft');

        const strokeColor = isDirect
          ? (isSoft ? 'rgba(245, 158, 11, 0.85)' : '#f59e0b')
          : (isSoft ? 'rgba(253, 230, 138, 0.25)' : 'rgba(253, 230, 138, 0.45)');
        const lineWidth = isDirect ? 2.5 : 1.2;
        const arrowSize = isDirect ? 8 : 5;

        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.stroke();
        drawArrow(x1, y1, x2, y2, nodeRadius(a), strokeColor, arrowSize);
      });

      // 2B. Outbound Unlocks (unlocker b -> unlocked a; arrow points at a)
      const unlockList = Array.from(lineage.unlockEdges);
      unlockList.sort((k1, k2) => {
        const isDir1 = edges[k1].targetIdx === lineage.targetIdx ? 1 : 0;
        const isDir2 = edges[k2].targetIdx === lineage.targetIdx ? 1 : 0;
        return isDir1 - isDir2;
      });

      unlockList.forEach(k => {
        const e = edges[k], a = e.sourceIdx, b = e.targetIdx;
        if (P[a * 3 + 2] === 0 || P[b * 3 + 2] === 0) return;
        const x1 = P[b * 3], y1 = P[b * 3 + 1], x2 = P[a * 3], y2 = P[a * 3 + 1];
        const isDirect = (b === lineage.targetIdx);
        const isSoft = (e.strength === 'soft');

        const strokeColor = isDirect
          ? (isSoft ? 'rgba(56, 189, 248, 0.85)' : '#38bdf8')
          : (isSoft ? 'rgba(186, 230, 253, 0.25)' : 'rgba(186, 230, 253, 0.45)');
        const lineWidth = isDirect ? 2.5 : 1.2;
        const arrowSize = isDirect ? 8 : 5;

        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.stroke();
        drawArrow(x1, y1, x2, y2, nodeRadius(a), strokeColor, arrowSize);
      });
    }

    // Collision tracking per frame
    const placedBoxes = [];

    function canPlaceBox(box) {
      for (const b of placedBoxes) {
        if (box.x < b.x + b.w + 6 && box.x + box.w + 6 > b.x &&
            box.y < b.y + b.h + 6 && box.y + box.h + 6 > b.y) {
          return false;
        }
      }
      return true;
    }

    // Helper: Draw pill badge for nodes with boundary clamping and collision avoidance
    function drawNodeBadge(label, badge, sx, sy, r, badgeCol, textCol, borderCol, isPriority = false) {
      const isMobile = VW <= 600;
      const maxChars = isMobile ? 18 : 28;
      const dispLabel = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;

      ctx.save();
      ctx.globalAlpha = 1.0;
      const badgeFont = isMobile ? 'bold 7px Plus Jakarta Sans, sans-serif' : 'bold 8px Plus Jakarta Sans, sans-serif';
      ctx.font = badgeFont;
      const bW = badge ? ctx.measureText(badge).width : 0;

      const labelFont = isMobile ? '600 9px Plus Jakarta Sans, sans-serif' : '600 10.5px Plus Jakarta Sans, sans-serif';
      ctx.font = labelFont;
      const tW = ctx.measureText(dispLabel).width;

      const padX = isMobile ? 12 : 16;
      const pillW = Math.max(bW, tW) + padX;
      const pillH = badge ? (isMobile ? 24 : 30) : (isMobile ? 15 : 18);

      // Clamp X strictly within canvas visible margins so it NEVER clips screen edges
      const pillX = Math.max(8, Math.min(VW - pillW - 8, sx - pillW * 0.5));

      // Try placing below node first, then above
      let chosenY = sy + r + 5;
      let box = { x: pillX, y: chosenY, w: pillW, h: pillH };

      if (!isPriority) {
        if (!canPlaceBox(box) || chosenY + pillH > VH - 8) {
          chosenY = sy - r - pillH - 5;
          box.y = chosenY;
          if (!canPlaceBox(box) || chosenY < 8) {
            // Cannot place without collision: skip text box to keep view clean!
            ctx.restore();
            return false;
          }
        }
      } else {
        // Priority (selected node): force clamp
        if (chosenY + pillH > VH - 8) {
          chosenY = sy - r - pillH - 5;
        }
        chosenY = Math.max(8, Math.min(VH - pillH - 8, chosenY));
        box.y = chosenY;
      }

      placedBoxes.push(box);

      ctx.fillStyle = 'rgba(10, 15, 26, 0.92)';
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = isPriority ? 1.5 : 1.2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(box.x, box.y, pillW, pillH, 5);
      } else {
        ctx.rect(box.x, box.y, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      if (badge) {
        ctx.font = badgeFont;
        ctx.fillStyle = badgeCol;
        ctx.fillText(badge, box.x + pillW * 0.5, box.y + (isMobile ? 8 : 10));

        ctx.font = labelFont;
        ctx.fillStyle = textCol;
        ctx.fillText(dispLabel, box.x + pillW * 0.5, box.y + (isMobile ? 19 : 23));
      } else {
        ctx.font = labelFont;
        ctx.fillStyle = textCol;
        ctx.fillText(dispLabel, box.x + pillW * 0.5, box.y + (isMobile ? 11 : 13));
      }
      ctx.restore();
      return true;
    }

    // 3. Draw Depth-Sorted Nodes (Far to Near)
    const order = nodes.map((_, i) => i);
    order.sort((a, b) => P[a * 3 + 2] - P[b * 3 + 2]);

    let selectedNodeBadgeData = null;
    const directPrereqBadges = [];
    const directUnlockBadges = [];

    for (const i of order) {
      if (P[i * 3 + 2] === 0) continue;
      const n = nodes[i];
      const pf = P[i * 3 + 2];
      const isSelected = n.topic.id === selectedId;
      const isDirectPrereq = hasSel && lineage.directPrereqNodes.has(i);
      const isSecPrereq = hasSel && !isDirectPrereq && lineage.prereqNodes.has(i);
      const isDirectUnlock = hasSel && lineage.directUnlockNodes.has(i);
      const isSecUnlock = hasSel && !isDirectUnlock && lineage.unlockNodes.has(i);
      const isHover = i === hoverIdx;

      const isConnected = isSelected || isDirectPrereq || isSecPrereq || isDirectUnlock || isSecUnlock;

      // Deeply dim non-connected and secondary nodes on mobile when a node is selected
      let dim = 1.0;
      if (hasSel && !isConnected) {
        dim = isMobile ? 0.015 : 0.12;
      } else if (hasSel && (isSecPrereq || isSecUnlock)) {
        dim = isMobile ? 0.32 : 0.85;
      }

      // Realistic perspective depth fade
      const baseDepthFade = Math.min(1.0, Math.max(0.42, pf * 0.95));
      const depthFade = isSelected || isDirectPrereq || isDirectUnlock || isHover
        ? 1.0
        : (hasSel
            ? (isSecPrereq || isSecUnlock
                ? (isMobile ? 0.65 : 0.9)
                : (isMobile ? Math.min(0.2, Math.max(0.06, pf * 0.2)) : baseDepthFade))
            : baseDepthFade);

      const sx = P[i * 3], sy = P[i * 3 + 1];
      const rMult = isSelected
        ? 1.65
        : ((isDirectPrereq || isDirectUnlock)
            ? 1.38
            : (isHover
                ? 1.3
                : (isSecPrereq || isSecUnlock
                    ? (isMobile ? 0.95 : 1.1)
                    : (isMobile && hasSel ? 0.6 : 1))));
      const r = nodeRadius(i) * rMult;

      // Glow & Ring Encoding
      if (isSelected) {
        ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 24;
      } else if (isDirectPrereq) {
        ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 16;
      } else if (isSecPrereq) {
        ctx.shadowColor = isMobile ? 'transparent' : 'rgba(253, 230, 138, 0.6)'; ctx.shadowBlur = isMobile ? 0 : 6;
      } else if (isDirectUnlock) {
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 16;
      } else if (isSecUnlock) {
        ctx.shadowColor = isMobile ? 'transparent' : 'rgba(186, 230, 253, 0.6)'; ctx.shadowBlur = isMobile ? 0 : 6;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = dim * depthFade;
      if (isSelected) {
        ctx.fillStyle = '#ffffff';
      } else if (hasSel && !isConnected) {
        // Darken non-active nodes into a pitch cosmic charcoal/navy tone
        ctx.fillStyle = isMobile ? '#060912' : '#1e283c';
      } else {
        ctx.fillStyle = n.col;
      }
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();

      ctx.shadowBlur = 0;
      if (isSelected) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.0;
      } else if (isDirectPrereq) {
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5; // Vivid golden ring
      } else if (isSecPrereq) {
        ctx.strokeStyle = isMobile ? 'rgba(253, 230, 138, 0.35)' : 'rgba(253, 230, 138, 0.65)'; ctx.lineWidth = 1.0;
      } else if (isDirectUnlock) {
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5; // Vivid cyan ring
      } else if (isSecUnlock) {
        ctx.strokeStyle = isMobile ? 'rgba(186, 230, 253, 0.35)' : 'rgba(186, 230, 253, 0.65)'; ctx.lineWidth = 1.0;
      } else {
        ctx.strokeStyle = hasSel ? 'transparent' : 'rgba(10, 14, 24, 0.6)'; ctx.lineWidth = 1;
      }
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();

      if (isSelected) {
        selectedNodeBadgeData = { name: n.topic.name, sx, sy, r };
      } else if (isDirectPrereq) {
        directPrereqBadges.push({ name: n.topic.name, sx, sy, r });
      } else if (isDirectUnlock) {
        directUnlockBadges.push({ name: n.topic.name, sx, sy, r });
      }
    }

    // 4. Draw Pill Badges: Selected Node ALWAYS first, then non-overlapping direct connections
    ctx.globalAlpha = 1.0;
    const maxDirectBadges = (VW <= 600) ? 2 : 4;
    if (selectedNodeBadgeData) {
      drawNodeBadge(selectedNodeBadgeData.name, '★ SELECTED', selectedNodeBadgeData.sx, selectedNodeBadgeData.sy, selectedNodeBadgeData.r, '#ffffff', '#ffffff', 'rgba(255, 255, 255, 0.95)', true);
    }

    let pCount = 0;
    for (const b of directPrereqBadges) {
      if (pCount >= maxDirectBadges) break;
      if (drawNodeBadge(b.name, '🟡 LEARN FIRST', b.sx, b.sy, b.r, '#f59e0b', '#fde68a', '#f59e0b', false)) {
        pCount++;
      }
    }

    let uCount = 0;
    for (const b of directUnlockBadges) {
      if (uCount >= maxDirectBadges) break;
      if (drawNodeBadge(b.name, '🔵 LEADS TO', b.sx, b.sy, b.r, '#38bdf8', '#bae6fd', '#38bdf8', false)) {
        uCount++;
       }
    }
    ctx.globalAlpha = 1.0;
  }

  function loop() {
    camX += (camXTarget - camX) * 0.12; camY += (camYTarget - camY) * 0.12; camZ += (camZTarget - camZ) * 0.12;
    if (rotYTarget !== null) {
      let d = ((rotYTarget - rotY + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      rotY += d * 0.12;
      if (tiltTarget !== null) tilt += (tiltTarget - tilt) * 0.12;
      if (zoomTarget !== null) zoom += (zoomTarget - zoom) * 0.12;
      if (Math.abs(d) < 0.006) { rotYTarget = null; tiltTarget = null; zoomTarget = null; }
    } else {
      // Solar system celestial auto-orbit animation
      const now = performance.now();
      const hasActiveNode = (selectedId !== null);
      const isInteracting = isDragging || isPanning || (hoverIdx >= 0) || (now - lastInteractionTime < 2000);

      if (hasActiveNode || isInteracting) {
        // Smoothly decelerate to a complete stop
        autoSpeed += (0 - autoSpeed) * 0.14;
        if (Math.abs(autoSpeed) < 0.00002) autoSpeed = 0;
      } else {
        // Smoothly accelerate back to majestic solar rotation after 2s without interaction
        autoSpeed += (AUTO_ORBIT_SPEED - autoSpeed) * 0.025;
      }

      if (autoSpeed > 0.00001 && !isDragging) {
        rotY += autoSpeed;
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  return { setGraphData, setFocusTopic, resize, fitToView: resetCamera };
}
