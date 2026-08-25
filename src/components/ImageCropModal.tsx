"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { StandardModal } from "indas-ui";
import { Check, ZoomIn, ZoomOut } from "lucide-react";

/**
 * WhatsApp-style circular profile-photo cropper. The user pans (drag) + zooms a picked
 * image inside a square viewport with a round mask; on confirm it renders a square image
 * (stored square, displayed round everywhere). Output is a JPEG data URL.
 */
const VIEW = 320;   // viewport size (px)
const OUT = 512;    // exported image size (px, square)

export default function ImageCropModal({ open, imageSrc, onCancel, onCropped }: {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onCropped: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const baseScale = nat.w && nat.h ? Math.max(VIEW / nat.w, VIEW / nat.h) : 1;
  const s = baseScale * zoom;
  const dispW = nat.w * s;
  const dispH = nat.h * s;

  const clamp = useCallback((o: { x: number; y: number }, dw: number, dh: number) => ({
    x: Math.min(0, Math.max(VIEW - dw, o.x)),
    y: Math.min(0, Math.max(VIEW - dh, o.y)),
  }), []);

  // load the image + center it whenever a new source arrives
  useEffect(() => {
    if (!open || !imageSrc) return;
    const im = new Image();
    im.onload = () => {
      imgRef.current = im;
      setNat({ w: im.naturalWidth, h: im.naturalHeight });
      const bs = Math.max(VIEW / im.naturalWidth, VIEW / im.naturalHeight);
      const dw = im.naturalWidth * bs, dh = im.naturalHeight * bs;
      setZoom(1);
      setOffset({ x: (VIEW - dw) / 2, y: (VIEW - dh) / 2 });
    };
    im.src = imageSrc;
  }, [open, imageSrc]);

  // re-clamp when zoom changes (keep the viewport covered)
  useEffect(() => { setOffset((o) => clamp(o, dispW, dispH)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.px);
    const ny = drag.current.oy + (e.clientY - drag.current.py);
    setOffset(clamp({ x: nx, y: ny }, dispW, dispH));
  };
  const onUp = () => { drag.current = null; };

  const confirm = () => {
    const im = imgRef.current;
    if (!im) return;
    // viewport → source rect
    const sw = VIEW / s, sh = VIEW / s;
    const sx = -offset.x / s, sy = -offset.y / s;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, OUT, OUT); // flatten any transparency
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, OUT, OUT);
    onCropped(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <StandardModal
      isOpen={open}
      onClose={onCancel}
      title="Adjust photo"
      subtitle="Drag to reposition · zoom to fit"
      size="md"
      showFooter
      onSave={confirm}
      onCancel={onCancel}
      saveLabel="Set Photo"
      saveIcon={Check}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 16, padding: "4px 0" }}>
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          style={{ position: "relative", width: VIEW, height: VIEW, overflow: "hidden", borderRadius: 12, background: "#0d1420", cursor: "grab", touchAction: "none", userSelect: "none" }}
        >
          {imageSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: 0, top: 0, width: dispW, height: dispH, transform: `translate(${offset.x}px, ${offset.y}px)`, maxWidth: "none" }}
            />
          )}
          {/* circular mask: darken everything outside the centered circle */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 12, boxShadow: `inset 0 0 0 100vmax rgba(0,0,0,.001)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", width: VIEW - 8, height: VIEW - 8, transform: "translate(-50%,-50%)", borderRadius: "50%", boxShadow: "0 0 0 9999px rgba(0,0,0,.55)", outline: "2px solid rgba(255,255,255,.85)", pointerEvents: "none" }} />
        </div>

        {/* zoom control */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: VIEW }}>
          <ZoomOut size={18} color="#6b7686" />
          <input
            type="range" min={1} max={4} step={0.01} value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: "rgb(var(--color-primary))", cursor: "pointer" }}
          />
          <ZoomIn size={18} color="#6b7686" />
        </div>
      </div>
    </StandardModal>
  );
}
