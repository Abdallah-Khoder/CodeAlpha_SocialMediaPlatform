import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { timeRemaining } from "../utils/timeAgo";
import "../styles/storyViewer.css";

const API_BASE = "http://127.0.0.1:8000";
const IMAGE_DURATION_MS = 15000;

function StoryViewer({ groups, startGroupIndex, onClose }) {
  const { token, user } = useAuth();
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  const timerRef = useRef(null);
  const videoRef = useRef(null);

  const group = groups[groupIndex];
  const currentStory = group?.stories[storyIndex];
  const isOwnStory = group?.username === user?.username;

  // Mark the currently visible story as viewed
  useEffect(() => {
    const markViewed = async () => {
      try {
        await fetch(`${API_BASE}/api/stories/${currentStory.id}/view/`, {
          method: "POST",
          headers: { Authorization: `Token ${token}` },
        });
      } catch (err) {
        // Non-critical
      }
    };

    if (currentStory) markViewed();
  }, [currentStory?.id, token]);

  // Advance to the next story, or the next user's stories, or close
  const goNext = () => {
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
  };

  // Auto-advance timer: 15s for images. Videos advance via onEnded instead.
  useEffect(() => {
    setVideoProgress(0);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (currentStory?.media_type === "image") {
      timerRef.current = setTimeout(goNext, IMAGE_DURATION_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      setVideoProgress((video.currentTime / video.duration) * 100);
    }
  };

  const handleLoadViewers = async () => {
    setShowViewers(true);
    setLoadingViewers(true);
    try {
      const res = await fetch(`${API_BASE}/api/stories/${currentStory.id}/viewers/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setViewers(data);
    } finally {
      setLoadingViewers(false);
    }
  };

  if (!currentStory) return null;

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-viewer-card" onClick={(e) => e.stopPropagation()}>
        <div className="story-viewer-progress-row">
          {group.stories.map((story, index) => (
            <div className="story-viewer-progress-track" key={story.id}>
              {index < storyIndex && (
                <div className="story-viewer-progress-fill story-viewer-progress-full" />
              )}
              {index === storyIndex && currentStory.media_type === "image" && (
                <div
                  key={currentStory.id}
                  className="story-viewer-progress-fill story-viewer-progress-animate"
                />
              )}
              {index === storyIndex && currentStory.media_type === "video" && (
                <div
                  className="story-viewer-progress-fill"
                  style={{ width: `${videoProgress}%` }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="story-viewer-header">
          <span className="story-viewer-username">{group.username}</span>
          <span className="story-viewer-time-left">{timeRemaining(currentStory.expires_at)}</span>
          <button type="button" className="story-viewer-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="story-viewer-media" key={currentStory.id}>
          {currentStory.media_type === "image" ? (
            <img src={currentStory.file} alt="Story" className="story-media-fade" />
          ) : (
            <video
              key={currentStory.id}
              ref={videoRef}
              src={currentStory.file}
              autoPlay
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={goNext}
              className="story-media-fade"
            />
          )}

          <button type="button" className="story-nav-zone story-nav-left" onClick={goPrev} aria-label="Previous" />
          <button type="button" className="story-nav-zone story-nav-right" onClick={goNext} aria-label="Next" />
        </div>

        {isOwnStory && (
          <button type="button" className="story-viewer-seen-by" onClick={handleLoadViewers}>
            Seen by
          </button>
        )}

        {showViewers && (
          <div className="story-viewers-panel" onClick={(e) => e.stopPropagation()}>
            <div className="story-viewers-header">
              <span>Viewers</span>
              <button type="button" onClick={() => setShowViewers(false)}>
                ×
              </button>
            </div>
            <div className="story-viewers-list">
              {loadingViewers && <div className="story-viewers-status">Loading...</div>}
              {!loadingViewers && viewers.length === 0 && (
                <div className="story-viewers-status">No views yet.</div>
              )}
              {!loadingViewers &&
                viewers.map((v) => (
                  <div className="story-viewer-item" key={v.id}>
                    {v.profile_picture ? (
                      <img src={v.profile_picture} alt={v.username} />
                    ) : (
                      <div className="story-viewer-item-letter">
                        {v.username?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span>{v.username}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StoryViewer;