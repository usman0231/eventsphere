import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import './FloorPlan.css';

const STATUS_COLOR = {
  available: { fill: 'rgba(0,255,136,0.18)', stroke: '#00ff88', text: '#00ff88' },
  reserved:  { fill: 'rgba(255,179,0,0.20)', stroke: '#ffb300', text: '#ffb300' },
  occupied:  { fill: 'rgba(123,47,247,0.25)', stroke: '#b388ff', text: '#e0c2ff' },
};

const SIZE_DIM = {
  'extra-large': { w: 4, h: 3 },
  large:         { w: 3, h: 2 },
  medium:        { w: 2, h: 2 },
  small:         { w: 2, h: 1 },
};

const COLS = 16;
const AISLE_EVERY = 4;
const UNIT = 32;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;

function layoutBooths(booths) {
  let x = 0, y = 0, rowHeight = 0;
  const placed = [];
  for (const booth of booths) {
    const { w, h } = SIZE_DIM[booth.size] || SIZE_DIM.medium;
    if (x + w > COLS) { x = 0; y += rowHeight + 1; rowHeight = 0; }
    placed.push({ ...booth, gx: x, gy: y, gw: w, gh: h });
    x += w;
    if (x % AISLE_EVERY === 0) x += 1;
    if (h > rowHeight) rowHeight = h;
  }
  return { placed, gridWidth: COLS, gridHeight: y + rowHeight };
}

export default function FloorPlan({
  booths,
  onSelectBooth,
  isAdmin = false,
  readOnly = false,
  onAssignExhibitor,
  backgroundImage,
}) {
  const [hovered, setHovered] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panState = useRef({ panning: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const svgRef = useRef(null);

  const { placed, gridWidth, gridHeight } = useMemo(() => layoutBooths(booths || []), [booths]);

  const baseW = gridWidth * UNIT + UNIT;
  const baseH = (gridHeight + 4) * UNIT;
  const viewW = baseW / zoom;
  const viewH = baseH / zoom;

  const clampPan = useCallback((nx, ny, z = zoom) => {
    const w = baseW / z;
    const h = baseH / z;
    const maxX = baseW - w;
    const maxY = baseH - h;
    return {
      x: Math.max(0, Math.min(maxX, nx)),
      y: Math.max(0, Math.min(maxY, ny)),
    };
  }, [baseW, baseH, zoom]);

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    if (nextZoom === zoom) return;
    const nextViewW = baseW / nextZoom;
    const nextViewH = baseH / nextZoom;
    const cursorX = pan.x + mx * viewW;
    const cursorY = pan.y + my * viewH;
    const nextPan = clampPan(cursorX - mx * nextViewW, cursorY - my * nextViewH, nextZoom);
    setZoom(nextZoom);
    setPan(nextPan);
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    panState.current = {
      panning: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pan.x,
      baseY: pan.y,
      moved: false,
    };
  };

  const handlePointerMove = (e) => {
    if (!panState.current.panning) return;
    const dx = e.clientX - panState.current.startX;
    const dy = e.clientY - panState.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) panState.current.moved = true;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewW / rect.width;
    const scaleY = viewH / rect.height;
    setPan(clampPan(panState.current.baseX - dx * scaleX, panState.current.baseY - dy * scaleY));
  };

  const handlePointerUp = () => { panState.current.panning = false; };

  useEffect(() => {
    const up = () => { panState.current.panning = false; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const zoomBy = (delta) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    setZoom(next);
    setPan(p => clampPan(p.x, p.y, next));
  };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleDrop = (e, booth) => {
    e.preventDefault();
    setDragOver(null);
    if (!isAdmin || booth.status === 'occupied') return;
    const payload = e.dataTransfer.getData('application/x-exhibitor');
    if (!payload) return;
    try {
      const exhibitor = JSON.parse(payload);
      onAssignExhibitor?.(booth, exhibitor);
    } catch {}
  };

  const handleBoothClick = (b) => {
    if (panState.current.moved) return;
    onSelectBooth?.(b);
  };

  return (
    <div className="fp-wrap">
      <div className="fp-controls">
        <button className="fp-ctrl-btn" onClick={() => zoomBy(ZOOM_STEP)} title="Zoom in">＋</button>
        <span className="fp-zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="fp-ctrl-btn" onClick={() => zoomBy(-ZOOM_STEP)} title="Zoom out">−</button>
        <button className="fp-ctrl-btn fp-ctrl-reset" onClick={resetView} title="Reset view">⤾</button>
      </div>
      <div className="fp-hint">Scroll to zoom · Drag to pan</div>

      <svg
        ref={svgRef}
        viewBox={`${pan.x} ${pan.y} ${viewW} ${viewH}`}
        className="fp-svg"
        preserveAspectRatio="xMidYMin meet"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: panState.current.panning ? 'grabbing' : 'grab' }}
      >
        <defs>
          <pattern id="fp-grid" width={UNIT} height={UNIT} patternUnits="userSpaceOnUse">
            <path d={`M ${UNIT} 0 L 0 0 0 ${UNIT}`} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
        </defs>

        {backgroundImage && (
          <image
            href={backgroundImage}
            x="0" y="0"
            width={baseW} height={baseH}
            preserveAspectRatio="xMidYMid meet"
            opacity="0.6"
          />
        )}

        <rect x="0" y="0" width={baseW} height={baseH} fill="url(#fp-grid)" pointerEvents="none" />

        <rect
          x={UNIT * (gridWidth / 2 - 2)}
          y={baseH - UNIT * 2}
          width={UNIT * 4}
          height={UNIT * 1.4}
          rx="8"
          fill="rgba(0,212,255,0.12)"
          stroke="rgba(0,212,255,0.4)"
          strokeDasharray="6 4"
          pointerEvents="none"
        />
        <text
          x={gridWidth / 2 * UNIT}
          y={baseH - UNIT * 1.1}
          textAnchor="middle"
          fill="#00d4ff"
          fontSize="13"
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
          letterSpacing="0.1em"
          pointerEvents="none"
        >
          ▼ ENTRANCE ▼
        </text>

        {placed.map(b => {
          const c = STATUS_COLOR[b.status] || STATUS_COLOR.available;
          const x = b.gx * UNIT + UNIT / 2;
          const y = b.gy * UNIT + UNIT / 2;
          const w = b.gw * UNIT - 4;
          const h = b.gh * UNIT - 4;
          const isHover = hovered === b._id;
          const isDropTarget = dragOver === b._id && isAdmin;

          return (
            <g
              key={b._id}
              className="fp-booth"
              onMouseEnter={() => setHovered(b._id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => handleBoothClick(b)}
              onDragOver={e => {
                if (!isAdmin || b.status === 'occupied') return;
                e.preventDefault();
                setDragOver(b._id);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, b)}
              style={{ cursor: readOnly ? 'pointer' : 'pointer' }}
            >
              <title>{`Booth ${b.boothNumber} · ${b.status}${b.exhibitor ? ' · ' + (b.exhibitor.company || b.exhibitor.name || '') : ''}`}</title>
              <rect
                x={x} y={y} width={w} height={h} rx="6"
                fill={isDropTarget ? 'rgba(0,212,255,0.35)' : c.fill}
                stroke={isDropTarget ? '#00d4ff' : c.stroke}
                strokeWidth={isHover || isDropTarget ? 2.5 : 1.5}
                strokeDasharray={isDropTarget ? '5 3' : 'none'}
                style={{ transition: 'fill 0.2s, stroke 0.2s' }}
              />
              <text
                x={x + w / 2} y={y + h / 2 - 2}
                textAnchor="middle"
                fill={c.text}
                fontSize={b.gh >= 2 ? 13 : 11}
                fontWeight="800"
                fontFamily="DM Sans, sans-serif"
                pointerEvents="none"
              >
                {b.boothNumber}
              </text>
              {b.gh >= 2 && (
                <text
                  x={x + w / 2} y={y + h / 2 + 12}
                  textAnchor="middle"
                  fill="rgba(240,240,255,0.55)"
                  fontSize="9"
                  fontFamily="DM Sans, sans-serif"
                  pointerEvents="none"
                >
                  {b.size}
                </text>
              )}
              {b.gh >= 2 && (
                <text
                  x={x + w / 2} y={y + h / 2 + 24}
                  textAnchor="middle"
                  fill={c.text}
                  fontSize="8"
                  fontWeight="700"
                  fontFamily="DM Sans, sans-serif"
                  pointerEvents="none"
                >
                  {b.status.toUpperCase()}
                </text>
              )}
              {b.exhibitor && (
                <>
                  <circle cx={x + w - 10} cy={y + 10} r="7" fill="#0a0a1a" stroke={c.stroke} strokeWidth="1.5" pointerEvents="none" />
                  <text
                    x={x + w - 10} y={y + 13}
                    textAnchor="middle"
                    fill={c.stroke}
                    fontSize="9"
                    fontWeight="800"
                    fontFamily="DM Sans, sans-serif"
                    pointerEvents="none"
                  >
                    {b.exhibitor.name?.[0]?.toUpperCase() || '?'}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
