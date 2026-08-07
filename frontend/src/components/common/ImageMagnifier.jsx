import { useRef, useState } from "react";

/**
 * Hover magnifier for document preview images.
 * Moves a circular lens over the image that shows a zoomed crop under the cursor.
 */
export default function ImageMagnifier({
  src,
  alt = "Document",
  zoom = 2.5,
  lensSize = 160,
  className = "",
}) {
  const imgRef = useRef(null);
  const [lens, setLens] = useState(null);

  function handleMove(e) {
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setLens(null);
      return;
    }

    const half = lensSize / 2;
    const left = Math.max(0, Math.min(x - half, rect.width - lensSize));
    const top = Math.max(0, Math.min(y - half, rect.height - lensSize));

    // Background position so the zoomed crop tracks the cursor.
    const bgX = (x / rect.width) * 100;
    const bgY = (y / rect.height) * 100;

    setLens({
      left,
      top,
      backgroundSize: `${rect.width * zoom}px ${rect.height * zoom}px`,
      backgroundPosition: `${bgX}% ${bgY}%`,
    });
  }

  function handleLeave() {
    setLens(null);
  }

  return (
    <div
      className={`relative inline-block max-w-full mx-auto cursor-crosshair ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="max-w-full rounded-xl border block select-none"
        draggable={false}
      />

      {lens && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 rounded-full border-2 border-white shadow-lg ring-1 ring-black/20"
          style={{
            width: lensSize,
            height: lensSize,
            left: lens.left,
            top: lens.top,
            backgroundImage: `url(${src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: lens.backgroundSize,
            backgroundPosition: lens.backgroundPosition,
          }}
        />
      )}
    </div>
  );
}
