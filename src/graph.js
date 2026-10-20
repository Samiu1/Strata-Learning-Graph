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
  let rotY = 0.65, tilt = -0.52, zoom = 1.05;
  let rotYTarget = null, tiltTarget = null, zoomTarget = null;
  let camX = 0, camY = 0, camZ = 0;
  let camXTarget = 0, camYTarget = 0, camZTarget = 0;
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
  const AUTO_ORBIT_SPEED = 0.0011;
  let autoSpeed = AUTO_ORBIT_SPEED;
  let lastInteractionTime = 0; // 0 ensures rotation starts immediately upon graph load

  function markInteraction() {
    lastInteractionTime = performance.now();
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

  // Pointer Events (Left: Rotate, Middle or Shift+Left: Pan)
  container.addEventListener('pointerdown', (e) => {
    markInteraction();
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      isPanning = true; hasMoved = false; lastX = e.clientX; lastY = e.clientY;
      container.style.cursor = 'all-scroll'; container.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      isDragging = true; hasMoved = false; lastX = e.clientX; lastY = e.clientY;
      container.setPointerCapture(e.pointerId);
    }
  });

  container.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  container.addEventListener('pointermove', (e) => {
    if (isPanning) {
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
      if (Math.abs(dx) + Math.abs(dy) > 3) hasMoved = true;
      rotY -= dx * 0.0055; tilt = Math.max(-1.15, Math.min(0.2, tilt - dy * 0.004));
      lastX = e.clientX; lastY = e.clientY;
      rotYTarget = null; tiltTarget = null;
    } else {
      handleHover(e);
    }
  });

  container.addEventListener('pointerup', (e) => {
    markInteraction();
    if (e.button === 1 || isPanning) {
      isPanning = false; container.style.cursor = '';
    } else if (e.button === 0) {
      isDragging = false; if (!hasMoved) handleClick(e);
    }
  });

  container.addEventListener('pointerleave', () => {
    isPanning = false; isDragging = false; container.style.cursor = '';
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
    statusSubtitle.textContent = `Rotate: Left Drag · Pan: Middle Drag / Shift+Drag · Zoom: Scroll`;
    if (onResetFocus) onResetFocus();
  });

  function resetCamera() {
    rotYTarget = 0.65; tiltTarget = -0.52; zoomTarget = 1.05;
    camXTarget = centroidX; camYTarget = centroidY; camZTarget = centroidZ;
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
    const cx = (isDrawerOpen && VW > 900) ? (VW - 460) * 0.5 : VW * 0.5;
    const cyy = VH * 0.5, sc = Math.min(VW / 1400, VH / 1400) * zoom;

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
    let best = -1, minD = 22 * 22;
    for (let i = 0; i < nodes.length; i++) {
      if (P[i * 3 + 2] === 0) continue;
      const dx = P[i * 3] - mx, dy = P[i * 3 + 1] - my, d = dx * dx + dy * dy;
      const r = Math.max(12, nodeRadius(i) + 5);
      if (d < r * r && d < minD) { minD = d; best = i; }
    }
    return best;
  }

  function handleHover(e) {
    const rect = canvas.getBoundingClientRect();
    const idx = pick(e.clientX - rect.left, e.clientY - rect.top);
    if (idx !== hoverIdx) {
      hoverIdx = idx;
      if (hoverIdx >= 0) {
        markInteraction();
        showTooltip(e.clientX - rect.left, e.clientY - rect.top, nodes[hoverIdx]);
      } else {
        hideTooltip();
      }
    } else if (hoverIdx >= 0) {
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
      camXTarget = centroidX; camYTarget = centroidY; camZTarget = centroidZ;
      statusSubtitle.textContent = `Rotate: Left Drag · Pan: Middle Drag / Shift+Drag · Zoom: Scroll`;
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
    rotYTarget = best; tiltTarget = -0.32; zoomTarget = Math.max(zoom, 1.4);
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
    statusSubtitle.innerHTML = `<span style="color:#f59e0b; font-weight:600;">🟡 ${dP} Direct Prereq${dP===1?'':'s'}${sP > 0 ? ` <span style="color:#fde68a; font-weight:400;">(+${sP} secondary)</span>` : ''}</span> · <span style="color:#38bdf8; font-weight:600;">🔵 ${dU} Direct Unlock${dU===1?'':'s'}${sU > 0 ? ` <span style="color:#bae6fd; font-weight:400;">(+${sU} secondary)</span>` : ''}</span>`;
  }

  function showTooltip(x, y, node) {
    const t = node.topic;
    const col = getSubjectColor(t.subject);
    let relTag = '';
    if (lineage && selectedId) {
      if (node.topic.id === selectedId) {
        relTag = '<div style="color: #ffffff; font-size: 0.7rem; font-weight: 700; margin-bottom: 2px;">★ SELECTED TOPIC</div>';
      } else if (lineage.directPrereqNodes.has(node.idx)) {
        relTag = '<div style="color: #f59e0b; font-size: 0.7rem; font-weight: 700; margin-bottom: 2px;">🟡 DIRECT PREREQUISITE (Immediate requirement)</div>';
      } else if (lineage.prereqNodes.has(node.idx)) {
        relTag = '<div style="color: #fde68a; font-size: 0.7rem; font-weight: 600; margin-bottom: 2px;">🟡 SECONDARY PREREQUISITE (Ancestor requirement)</div>';
      } else if (lineage.directUnlockNodes.has(node.idx)) {
        relTag = '<div style="color: #38bdf8; font-size: 0.7rem; font-weight: 700; margin-bottom: 2px;">🔵 DIRECT UNLOCK (Immediately unlocked)</div>';
      } else if (lineage.unlockNodes.has(node.idx)) {
        relTag = '<div style="color: #bae6fd; font-size: 0.7rem; font-weight: 600; margin-bottom: 2px;">🔵 SECONDARY UNLOCK (Descendant topic)</div>';
      }
    }

    tooltip.innerHTML = `
      ${relTag}
      <div style="font-weight: 700; color: #fff; margin-bottom: 2px;">${escapeHtml(t.name)}</div>
      <div style="color: ${col}; font-size: 0.725rem; font-weight: 600;">${escapeHtml(t.subject)} · Age ${t.ageRangeStart}–${t.ageRangeEnd}</div>
      <div style="color: #94a3b8; font-size: 0.7rem; margin-top: 3px;">${escapeHtml(t.domain)}</div>
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

  function setGraphData({ filteredTopics, dependencies, topicMap, focusTopic }) {
    build3DData(filteredTopics, dependencies);
    resize();
    if (focusTopic) {
      selectedId = focusTopic.id;
      const idx = nodes.findIndex(n => n.topic.id === focusTopic.id);
      if (idx >= 0) { buildLineage(idx); focusNode(idx); }
      markInteraction();
    } else {
      selectedId = null; lineage = null;
    }
  }

  function build3DData(filteredTopics, dependencies) {
    statusTitle.textContent = `3D Curriculum Galaxy (${filteredTopics.length.toLocaleString()} topics)`;
    statusSubtitle.textContent = `Rotate: Left Drag · Pan: Middle Drag / Shift+Drag · Zoom: Scroll`;

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
      camXTarget = centroidX; camYTarget = centroidY; camZTarget = centroidZ;
      camX = centroidX; camY = centroidY; camZ = centroidZ;
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

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    project();

    const hasSel = !!lineage;

    // 0. Draw Subtle Orbital Age Reference Rings (when no node selected)
    if (!hasSel && nodes.length > 0) {
      const cy = Math.cos(rotY), sy = Math.sin(rotY), ct = Math.cos(tilt), st = Math.sin(tilt);
      const drawer = document.getElementById('detail-drawer');
      const isDrawerOpen = drawer && drawer.classList.contains('open');
      const cx = (isDrawerOpen && VW > 900) ? (VW - 460) * 0.5 : VW * 0.5;
      const cyy = VH * 0.5, sc = Math.min(VW / 1400, VH / 1400) * zoom;

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
      const sunPt = projectPoint(0, -160, 0, cy, sy, ct, st, cx, cyy, sc);
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

        // Label
        ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
        ctx.fillStyle = 'rgba(254, 240, 138, 0.65)';
        ctx.textAlign = 'center';
        ctx.fillText('CORE FOUNDATIONS', sunPt.x, sunPt.y + sunR * 0.7 + 14);
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
        ? 'rgba(100, 116, 139, 0.02)'
        : (e.strength === 'hard' ? `rgba(148, 163, 184, ${Math.min(0.12, 0.07 * pfa)})` : `rgba(148, 163, 184, ${Math.min(0.05, 0.03 * pfa)})`);
      ctx.lineWidth = 1;
      ctx.moveTo(P[a * 3], P[a * 3 + 1]); ctx.lineTo(P[b * 3], P[b * 3 + 1]);
      ctx.stroke();
    }

    // 2. Draw Active Highlighted Edges with Directional Arrows
    if (hasSel) {
      // 2A. Inbound Prerequisites (prereq b -> dependent a; arrow points at a)
      // Sort so secondary (ancestor) edges draw first in pale amber, direct edges draw on top in bright amber
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

        // Paler color and thinner stroke for secondary edges
        const strokeColor = isDirect
          ? (isSoft ? 'rgba(245, 158, 11, 0.75)' : '#f59e0b')
          : (isSoft ? 'rgba(253, 230, 138, 0.22)' : 'rgba(253, 230, 138, 0.42)');
        const lineWidth = isDirect ? (isSoft ? 2.0 : 2.5) : (isSoft ? 1.0 : 1.3);
        const arrowSize = isDirect ? (isSoft ? 7 : 8) : 5;

        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.stroke();
        drawArrow(x1, y1, x2, y2, nodeRadius(a), strokeColor, arrowSize);
      });

      // 2B. Outbound Unlocks (unlocker b -> unlocked a; arrow points at a)
      // Sort so secondary (descendant) edges draw first in pale cyan, direct edges draw on top in bright sky cyan
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

        // Paler color and thinner stroke for secondary edges
        const strokeColor = isDirect
          ? (isSoft ? 'rgba(56, 189, 248, 0.75)' : '#38bdf8')
          : (isSoft ? 'rgba(186, 230, 253, 0.22)' : 'rgba(186, 230, 253, 0.42)');
        const lineWidth = isDirect ? (isSoft ? 2.0 : 2.5) : (isSoft ? 1.0 : 1.3);
        const arrowSize = isDirect ? (isSoft ? 7 : 8) : 5;

        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.stroke();
        drawArrow(x1, y1, x2, y2, nodeRadius(a), strokeColor, arrowSize);
      });
    }

    // 3. Draw Depth-Sorted Nodes (Far to Near)
    const order = nodes.map((_, i) => i);
    order.sort((a, b) => P[a * 3 + 2] - P[b * 3 + 2]);

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
      const dim = (hasSel && !isSelected && !isDirectPrereq && !isSecPrereq && !isDirectUnlock && !isSecUnlock) ? 0.08 : 1.0;

      // Realistic perspective depth fade
      const depthFade = isSelected || isDirectPrereq || isSecPrereq || isDirectUnlock || isSecUnlock || isHover
        ? 1.0
        : Math.min(1.0, Math.max(0.42, pf * 0.95));

      const sx = P[i * 3], sy = P[i * 3 + 1];
      const r = nodeRadius(i) * (isSelected ? 1.6 : (isHover ? 1.4 : 1));

      // Glow & Ring Encoding
      if (isSelected) {
        ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 20;
      } else if (isDirectPrereq) {
        ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 14;
      } else if (isSecPrereq) {
        ctx.shadowColor = 'rgba(253, 230, 138, 0.6)'; ctx.shadowBlur = 6;
      } else if (isDirectUnlock) {
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 14;
      } else if (isSecUnlock) {
        ctx.shadowColor = 'rgba(186, 230, 253, 0.6)'; ctx.shadowBlur = 6;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = dim * depthFade;
      ctx.fillStyle = n.col;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();

      ctx.shadowBlur = 0;
      if (isSelected) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
      } else if (isDirectPrereq) {
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.2; // Vivid golden ring
      } else if (isSecPrereq) {
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.65)'; ctx.lineWidth = 1.3; // Pale golden ring
      } else if (isDirectUnlock) {
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.2; // Vivid cyan ring
      } else if (isSecUnlock) {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)'; ctx.lineWidth = 1.3; // Pale cyan ring
      } else {
        ctx.strokeStyle = 'rgba(10, 14, 24, 0.6)'; ctx.lineWidth = 1;
      }
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();

      if ((isSelected || isDirectPrereq || isSecPrereq || isDirectUnlock || isSecUnlock || isHover) && dim > 0.5) {
        ctx.font = `${isSelected ? 'bold 12px' : '10px'} Plus Jakarta Sans, sans-serif`;
        ctx.fillStyle = isSelected
          ? '#ffffff'
          : (isDirectPrereq ? '#f59e0b' : (isSecPrereq ? '#fde68a' : (isDirectUnlock ? '#38bdf8' : (isSecUnlock ? '#bae6fd' : '#cbd5e1'))));
        ctx.textAlign = 'center';
        ctx.fillText(n.topic.name, sx, sy + r + 13);
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

  return { setGraphData, resize, fitToView: resetCamera };
}
