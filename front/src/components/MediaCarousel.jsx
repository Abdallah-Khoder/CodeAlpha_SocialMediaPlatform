import { useState, useRef } from "react";

// Renders a single image or video for one slide
function MediaElement({ item }) {
  if (item.media_type === "image") {
    return <img src={item.file} alt="Post media" draggable={false} />;
  }
  return <video src={item.file} controls />;
}

function MediaCarousel({ media }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const startXRef = useRef(0);

  const count = media.length;

  const handlePointerDown = (e) => {
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
    const threshold = containerWidth * 0.2; // must drag at least 20% of the width

    if (dragOffset <= -threshold && currentIndex < count - 1) {
      // Dragged left far enough -> go to next slide
      setCurrentIndex((prev) => prev + 1);
    } else if (dragOffset >= threshold && currentIndex > 0) {
      // Dragged right far enough -> go to previous slide
      setCurrentIndex((prev) => prev - 1);
    }

    setDragOffset(0);
    setIsDragging(false);
  };

  const trackStyle = {
    transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
    // No smooth transition while actively dragging, so the movement follows
    // the finger/mouse live. Snap back or advance smoothly on release.
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