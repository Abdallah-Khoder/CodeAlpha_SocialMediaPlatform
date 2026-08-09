import { useState, useRef, useEffect } from "react";

function MediaElement({ item }) {
  if (item.media_type === "image") {
    return <img src={item.file} alt="Post media" draggable={false} />;
  }
  return <video src={item.file} controls draggable={false} />;
}

function MediaCarousel({ media, onIndexChange }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const startXRef = useRef(0);

  const count = media.length;

  useEffect(() => {
    if (onIndexChange) onIndexChange(currentIndex);
  }, [currentIndex]);

  const handlePointerDown = (e) => {
    // Let the native video controls (play/pause, seek bar, volume, etc.)
    // handle their own clicks normally - don't hijack the pointer for
    // swipe-dragging when the press starts on a <video> element.
    if (e.target.tagName === "VIDEO") return;

    setIsDragging(true);
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientX - startXRef.current;
    setDragOffset(diff);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;

    const containerWidth = containerRef.current?.offsetWidth || 1;
    const threshold = containerWidth * 0.2;

    if (dragOffset <= -threshold && currentIndex < count - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (dragOffset >= threshold && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }

    setDragOffset(0);
    setIsDragging(false);
  };

  const trackStyle = {
    transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
    transition: isDragging ? "none" : "transform 0.25s ease",
  };

  return (
    <div className="media-carousel">
      <div
        className="media-carousel-viewport"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="media-carousel-track" style={trackStyle}>
          {media.map((item) => (
            <div className="media-carousel-slide" key={item.id}>
              <MediaElement item={item} />
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <div className="media-carousel-dots">
          {media.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`media-carousel-dot ${
                index === currentIndex ? "media-carousel-dot-active" : ""
              }`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to media ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MediaCarousel;