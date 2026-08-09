import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStories } from "../context/StoriesContext";
import CommentsSection from "./CommentsSection";
import ConfirmModal from "./ConfirmModal";
import SendToFriendModal from "./SendToFriendModal";
import "../styles/reelCard.css";

const API_BASE = "http://127.0.0.1:8000";

function ReelCard({ post, isMuted, onToggleMute }) {
  const { token, user } = useAuth();
  const { notifyStoriesChanged } = useStories();

  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.is_saved);
  const [sharesCount, setSharesCount] = useState(post.shares_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);

  const [showComments, setShowComments] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showSendToFriend, setShowSendToFriend] = useState(false);
  const [sharingToStory, setSharingToStory] = useState(false);
  const [shareToast, setShareToast] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // null | "delete"

  const videoRef = useRef(null);

  const video = (post.media || []).find(
    (m) => m.media_type === "video" && m.file.toLowerCase().endsWith(".mp4")
  );

  const isOwnPost = user?.username === post.username;

  // Autoplay when scrolled into view, pause when scrolled away
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleToggleMute = (e) => {
    e.stopPropagation();
    onToggleMute();
  };

  const handleVideoClick = () => {
    const el = videoRef.current;
    if (!el) return;
    el.paused ? el.play() : el.pause();
  };

  const handleLike = async () => {
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/like/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setLiked(data.liked);
      setLikesCount(data.likes_count);
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const handleSave = async () => {
    const prevSaved = saved;
    setSaved(!saved);

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/save/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setSaved(data.saved);
    } catch {
      setSaved(prevSaved);
    }
  };

  const handleShare = async () => {
    setShowShareMenu(false);
    const prevCount = sharesCount;
    setSharesCount(sharesCount + 1);

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/share/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setSharesCount(data.shares_count);
    } catch {
      setSharesCount(prevCount);
    }
  };

  const handleShareToStory = async () => {
    setShowShareMenu(false);
    setSharingToStory(true);

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/share-to-story/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ media_id: video?.id || null }),
      });

      if (!res.ok) throw new Error("Share to story failed");

      const data = await res.json();
      setSharesCount(data.shares_count);
      setShareToast({ type: "success", message: "Added to your story!" });
      notifyStoriesChanged();
    } catch {
      setShareToast({ type: "error", message: "Could not add to your story." });
    } finally {
      setSharingToStory(false);
      setTimeout(() => setShareToast(null), 3000);
    }
  };

  const handleSentToFriend = (newSharesCount) => {
    setSharesCount(newSharesCount);
  };

  const handleDeleteClick = () => {
    setShowShareMenu(false);
    if (localStorage.getItem("vibely_skip_removal_confirm") === "true") {
      performDelete();
    } else {
      setConfirmAction("delete");
    }
  };

  const performDelete = async () => {
    try {
      await fetch(`${API_BASE}/api/posts/${post.id}/`, {
        method: "DELETE",
        headers: { Authorization: `Token ${token}` },
      });
      if (videoRef.current) videoRef.current.style.display = "none";
    } catch {
      // non-critical
    }
  };

  const handleConfirmDelete = (remember) => {
    if (remember) localStorage.setItem("vibely_skip_removal_confirm", "true");
    performDelete();
    setConfirmAction(null);
  };

  if (!video) return null;

  return (
    <div className="reel-card">
      <video
        ref={videoRef}
        src={video.file}
        className="reel-video"
        loop
        muted={isMuted}
        playsInline
        onClick={handleVideoClick}
      />

      <button type="button" className="reel-mute-btn" onClick={handleToggleMute} aria-label="Toggle sound">
        {isMuted ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        )}
      </button>

      <div className="reel-overlay">
        <Link to={`/profile/${post.username}`} className="reel-username">
          @{post.username}
        </Link>
        {post.content && <p className="reel-caption">{post.content}</p>}
      </div>

      <div className="reel-actions">
        <button type="button" className={`reel-action-btn ${liked ? "reel-action-active" : ""}`} onClick={handleLike}>
          <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7.5-4.5-10-9.5C0.5 7 2.5 3 6.5 3c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3 4 0 6 4 4.5 8.5-2.5 5-10 9.5-10 9.5z" />
          </svg>
          <span>{likesCount}</span>
        </button>

        <button type="button" className="reel-action-btn" onClick={() => setShowComments(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span>{commentsCount}</span>
        </button>

        <div className="reel-share-wrapper">
          <button type="button" className="reel-action-btn" onClick={() => setShowShareMenu((prev) => !prev)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
            </svg>
            <span>{sharesCount}</span>
          </button>

          {showShareMenu && (
            <div className="reel-share-popover">
              <button type="button" onClick={handleShare}>Share</button>
              <button type="button" onClick={handleShareToStory} disabled={sharingToStory}>
                {sharingToStory ? "Adding..." : "Add To Story"}
              </button>
              <button type="button" onClick={() => { setShowShareMenu(false); setShowSendToFriend(true); }}>
                Send to Friend
              </button>
              {isOwnPost && (
                <button type="button" className="reel-share-delete" onClick={handleDeleteClick}>
                  Delete
                </button>
              )}
            </div>
          )}

          {shareToast && (
            <div className={`reel-share-toast reel-share-toast-${shareToast.type}`}>
              {shareToast.message}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`reel-action-btn ${saved ? "reel-action-active" : ""}`}
          onClick={handleSave}
        >
          <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {showComments && (
        <div className="reel-comments-overlay" onClick={() => setShowComments(false)}>
          <div className="reel-comments-panel" onClick={(e) => e.stopPropagation()}>
            <div className="reel-comments-header">
              <span>Comments</span>
              <button type="button" onClick={() => setShowComments(false)}>×</button>
            </div>
            <CommentsSection
              postId={post.id}
              onCommentAdded={() => setCommentsCount((prev) => prev + 1)}
            />
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmModal
          message="Delete this reel? This cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {showSendToFriend && (
        <SendToFriendModal
          post={post}
          onClose={() => setShowSendToFriend(false)}
          onSent={handleSentToFriend}
        />
      )}
    </div>
  );
}

export default ReelCard;