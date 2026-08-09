import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import "../styles/imageCropModal.css";

// Must match PostCard's actual media box (postCard.css):
//   .post-card { max-width: 560px; padding: 16px 18px; }
//   .media-carousel-viewport { width: 100%; height: 420px; }
// content width = 560 - 18*2 = 524, height = 420 -> that's the real ratio
// the cropped result needs to match, so nothing gets cropped again later.
const POST_CARD_CONTENT_WIDTH = 524;
const POST_CARD_MEDIA_HEIGHT = 420;
const ASPECT_RATIO = POST_CARD_CONTENT_WIDTH / POST_CARD_MEDIA_HEIGHT; // ~1.248

const VIEWPORT_WIDTH = 340;
const VIEWPORT_HEIGHT = Math.round(VIEWPORT_WIDTH / ASPECT_RATIO); // ~272

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / ASPECT_RATIO); // ~962

const MAX_ZOOM = 3;

function ImageCropModal({ file, onCancel, onDone }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragState = useRef(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      imgRef.current = img;
      // "Cover" fit: smallest scale where the image fully fills the box
      const cover = Math.max(VIEWPORT_WIDTH / img.width, VIEWPORT_HEIGHT / img.height);
      setBaseScale(cover);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clampOffset = useCallback(
    (x, y, currentZoom) => {
      const img = imgRef.current;
      if (!img) return { x: 0, y: 0 };

      const scale = baseScale * currentZoom;
      const width = img.width * scale;
      const height = img.height * scale;
      const maxX = Math.max((width - VIEWPORT_WIDTH) / 2, 0);
      const maxY = Math.max((height - VIEWPORT_HEIGHT) / 2, 0);

      return {
        x: Math.min(Math.max(x, -maxX), maxX),
        y: Math.min(Math.max(y, -maxY), maxY),
      };
    },
    [baseScale]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext("2d");
    const scale = baseScale * zoom;
    const width = img.width * scale;
    const height = img.height * scale;

    ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    ctx.save();
    ctx.translate(VIEWPORT_WIDTH / 2 + offset.x, VIEWPORT_HEIGHT / 2 + offset.y);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    ctx.restore();
  }, [imgLoaded, baseScale, zoom, offset]);

  const handleZoomChange = (e) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, newZoom));
  };

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset(
      clampOffset(dragState.current.startOffsetX + dx, dragState.current.startOffsetY + dy, zoom)
    );
  };

  const handlePointerUp = (e) => {
    dragState.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer may already be released, ignore
    }
  };

  const handleDone = () => {
    const img = imgRef.current;
    if (!img) return;

    const ratio = OUTPUT_WIDTH / VIEWPORT_WIDTH;
    const outputScale = baseScale * zoom * ratio;
    const width = img.width * outputScale;
    const height = img.height * outputScale;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = OUTPUT_WIDTH;
    outputCanvas.height = OUTPUT_HEIGHT;
    const ctx = outputCanvas.getContext("2d");

    ctx.translate(OUTPUT_WIDTH / 2 + offset.x * ratio, OUTPUT_HEIGHT / 2 + offset.y * ratio);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);

    outputCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], file.name, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        onDone(croppedFile);
      },
      "image/jpeg",
      0.92
    );
  };

  const modalContent = (
    <div className="image-crop-overlay">
      <div className="image-crop-modal">
        <h3 className="image-crop-title">Adjust photo</h3>

        <div className="image-crop-viewport" style={{ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }}>
          <canvas
            ref={canvasRef}
            width={VIEWPORT_WIDTH}
            height={VIEWPORT_HEIGHT}
            className="image-crop-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>

        <input
          type="range"
          min="1"
          max={MAX_ZOOM}
          step="0.01"
          value={zoom}
          onChange={handleZoomChange}
          className="image-crop-zoom"
        />

        <div className="image-crop-actions">
          <button type="button" className="image-crop-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="image-crop-done" onClick={handleDone} disabled={!imgLoaded}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default ImageCropModal;