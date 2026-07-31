import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../utils/timeAgo";
import MediaCarousel from "./MediaCarousel";
import CommentsSection from "./CommentsSection";
import "../styles/postCard.css";

const API_BASE = "http://127.0.0.1:8000";

function PostCard({ post }) {
  const { token } = useAuth();

  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.is_saved);
  const [sharesCount, setSharesCount] = useState(post.shares_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showComments, setShowComments] = useState(false);

  const firstLetter = post.username?.charAt(0)?.toUpperCase() || "?";
  const media = post.media || [];

  const handleLike = async () => {
    // Optimistic update: flip the UI immediately, before the server responds
    const previousLiked = liked;
    const previousCount = likesCount;

    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/like/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });

      if (!res.ok) throw new Error("Like request failed");

      const data = await res.json();
      setLiked(data.liked);
      setLikesCount(data.likes_count);
    } catch (err) {
      // Revert to the previous state if the request failed
      setLiked(previousLiked);
      setLikesCount(previousCount);
    }
  };

  const handleSave = async () => {
    const previousSaved = saved;
    setSaved(!saved);

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/save/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });

      if (!res.ok) throw new Error("Save request failed");

      const data = await res.json();
      setSaved(data.saved);
    } catch (err) {
      setSaved(previousSaved);
    }
  };

  const handleShare = async () => {
    // Shares aren't toggleable, each click creates a new share
    const previousCount = sharesCount;
    setSharesCount(sharesCount + 1);

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/share/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });

      if (!res.ok) throw new Error("Share request failed");

      const data = await res.json();
      setSharesCount(data.shares_count);
    } catch (err) {
      setSharesCount(previousCount);
    }
  };

  return (
    <div className="post-card">
      <div className="post-card-header">
        <Link to={`/profile/${post.username}`} className="post-card-avatar">
          {firstLetter}
        </Link>
        <div className="post-card-header-text">
          <span className="post-card-username">{post.username}</span>
          <span className="post-card-time">{timeAgo(post.created_at)}</span>
        </div>
      </div>

      {post.content && <p className="post-card-content">{post.content}</p>}

      {media.length > 0 && <MediaCarousel media={media} />}

      <div className="post-card-actions">
        <button
          type="button"
          className={`action-btn ${liked ? "action-btn-active-like" : ""}`}
          onClick={handleLike}
        >
          <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7.5-4.5-10-9.5C0.5 7 2.5 3 6.5 3c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3 4 0 6 4 4.5 8.5-2.5 5-10 9.5-10 9.5z" />
          </svg>
          <span>{likesCount}</span>
        </button>

        <button
          type="button"
          className="action-btn"
          onClick={() => setShowComments((prev) => !prev)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span>{commentsCount}</span>
        </button>

        <button type="button" className="action-btn" onClick={handleShare}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
          </svg>
          <span>{sharesCount}</span>
        </button>

        <button
          type="button"
          className={`action-btn action-btn-save ${saved ? "action-btn-active-save" : ""}`}
          onClick={handleSave}
        >
          <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {showComments && (
        <CommentsSection
          postId={post.id}
          onCommentAdded={() => setCommentsCount((prev) => prev + 1)}
        />
      )}
    </div>
  );
}

export default PostCard;