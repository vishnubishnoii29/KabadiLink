import React, { useRef, useEffect } from 'react';

const MATERIAL_COLORS = {
  PCB: '#10b981',      // Emerald
  BATTERY: '#ef4444',  // Rose / Hazard
  CABLE: '#f59e0b',    // Amber
  LCD: '#38bdf8',      // Sky Blue
  CRT: '#f97316',      // Orange
  MOTOR: '#6366f1',    // Indigo
  MAGNET: '#ec4899',   // Pink
  PLASTIC: '#14b8a6',  // Teal
  OTHER: '#a855f7'     // Purple
};

export default function BoundingBoxCanvas({ imageSrc, detections = [], selectedIndex = null, onSelect = null }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      // Calculate responsive canvas aspect ratio
      const maxWidth = canvas.parentElement?.clientWidth || 580;
      const scale = Math.min(1, maxWidth / img.width);
      const canvasWidth = img.width * scale;
      const canvasHeight = img.height * scale;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Draw base photo
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      // Draw bounding boxes
      detections.forEach((det, idx) => {
        const bbox = det.bbox || [0, 0, img.width, img.height];
        const [rawX, rawY, rawW, rawH] = bbox;
        
        // Scale coordinates
        const x = rawX * scale;
        const y = rawY * scale;
        const w = (rawW || img.width) * scale;
        const h = (rawH || img.height) * scale;

        const isSelected = selectedIndex === idx;
        const color = MATERIAL_COLORS[det.material] || '#10b981';

        // Box border
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 4 : 2.5;
        if (isSelected) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.strokeRect(x, y, w, h);

        // Fill highlight if selected
        if (isSelected) {
          ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
          ctx.fillRect(x, y, w, h);
        }

        // Tag label background pill
        const labelText = `${det.material} ${Math.round((det.confidence || 0.5) * 100)}%`;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        const textMetrics = ctx.measureText(labelText);
        const tagHeight = 18;
        const tagWidth = textMetrics.width + 12;

        ctx.fillStyle = color;
        ctx.fillRect(x, Math.max(0, y - tagHeight), tagWidth, tagHeight);

        // Tag text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, x + 6, Math.max(13, y - 5));
      });
    };
  }, [imageSrc, detections, selectedIndex]);

  const handleCanvasClick = (e) => {
    if (!onSelect || !detections.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked inside any bounding box
    for (let i = 0; i < detections.length; i++) {
      const bbox = detections[i].bbox || [0, 0, canvas.width, canvas.height];
      const scale = canvas.width / (canvas.dataset.rawWidth || canvas.width);
      const [x, y, w, h] = bbox.map(v => v * scale);
      if (clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h) {
        onSelect(i);
        return;
      }
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasClick}
        style={{ display: 'block', width: '100%', height: 'auto', cursor: 'pointer' }} 
      />
    </div>
  );
}
