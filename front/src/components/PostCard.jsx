import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFollow } from "../context/FollowContext";
import { useStories } from "../context/StoriesContext";
import { timeAgo } from "../utils/timeAgo";
import MediaCarousel from "./MediaCarousel";
import CommentsSection from "./CommentsSection";
import ConfirmModal from "./ConfirmModal";
import "../styles/postCard.css";

const API_BASE = "http://127.0.0.1:8000";

function PostCard({ post, isSharedView = false, onDeleted, onUnshared, onShared }) {
  const { token, user } = useAuth();
  const { getFollowStatus, toggleFollow, isFlashing } = useFollow();
  const { notifyStoriesChanged } = useStories();

  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.is_saved);
  const [sharesCount, setSharesCount] = useState(post.shares_count);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [showComments, setShowComments] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [content, setContent] = useState(post.content || "");
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // null | "delete" | "unshare"
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [sharingToStory, setSharingToStory] = useState(false);
  const [shareToast, setShareToast] = useState(null); // { type, message }
  const [visibleMediaIndex, setVisibleMediaIndex] = useState(0);

  const firstLetter = post.username?.charAt(0)?.toUpperCase() || "?";
  const media = post.media || [];
  const isFollowingAuthor = getFollowStatus(post.username, post.is_following_author);
  const isOwnPost = user?.username === post.username;

  const handleLike = async () => {
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
    setShowShareMenu(false);
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
      if (onShared) onShared(post);
    } catch (err) {
      setSharesCount(previousCount);
    }
  };

  const handleShareToStory = async () => {
    setShowShareMenu(false);
    setSharingToStory(true);

    // Send the id of whichever media the user is currently looking at
    // in the carousel, so that specific image/video gets shared
    const currentMedia = media[visibleMediaIndex];

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/share-to-story/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ media_id: currentMedia?.id || null }),
      });

      if (!res.ok) throw new Error("Share to story failed");

      const data = await res.json();
      setSharesCount(data.shares_count);

      setShareToast({ type: "success", message: "Added to your story!" });
      notifyStoriesChanged();
    } catch (err) {
      setShareToast({ type: "error", message: "Could not add to your story." });
    } finally {
      setSharingToStory(false);
      setTimeout(() => setShareToast(null), 3000);
    }
  };

  const handleUnshareClick = () => {
    if (localStorage.getItem("vibely_skip_removal_confirm") === "true") {
      performUnshare();
    } else {
      setConfirmAction("unshare");
    }
  };

  const performUnshare = async () => {
    const previousCount = sharesCount;
    setSharesCount(sharesCount - 1);

    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/share/`, {
        method: "DELETE",
        headers: { Authorization: `Token ${token}` },
      });

      if (!res.ok) throw new Error(`Unshare request failed with status ${res.status}`);

      const data = await res.json();
      setSharesCount(data.shares_count);
      if (onUnshared) onUnshared(post.id);
    } catch (err) {
      console.error("Unshare error:", err);
      setSharesCount(previousCount);
    }
  };

  const handleDeleteClick = () => {
    setShowMenu(false);

    if (localStorage.getItem("vibely_skip_removal_confirm") === "true") {
      performDelete();
    } else {
      setConfirmAction("delete");
    }
  };

  const performDelete = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/`, {
        method: "DELETE",
        headers: { Authorization: `Token ${token}` },
      });

      if (res.ok || res.status === 204) {
        if (onDeleted) onDeleted(post.id);
      } else {
        const errorData = await res.json().catch(() => null);
        console.error("Delete post failed:", res.status, errorData);
      }
    } catch (err) {
      console.error("Delete post error:", err);
    }
  };

  const handleConfirmModalConfirm = (remember) => {
    if (remember) {
      localStorage.setItem("vibely_skip_removal_confirm", "true");
    }

    if (confirmAction === "delete") {
      performDelete();
    } else if (confirmAction === "unshare") {
      performUnshare();
    }

    setConfirmAction(null);
  };

  const handleStartEdit = () => {
    setShowMenu(false);
    setEditContent(content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(content);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
        setIsEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`post-card ${isFlashing(post.username) ? "follow-success-flash" : ""}`}>
      {post.shared_by && (
        <Link to={`/profile/${post.shared_by.username}`} className="post-card-shared-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
          </svg>
          <span>
            <strong>{post.shared_by.username}</strong> shared this ·{" "}
            {timeAgo(post.shared_by.shared_at)}
          </span>
        </Link>
      )}

      <div className="post-card-header">
        <Link to={`/profile/${post.username}`} className="post-card-avatar">
          {post.profile_picture ? (
            <img src={post.profile_picture} alt={post.username} />
          ) : (
            firstLetter
          )}
        </Link>
        <div className="post-card-header-text">
          <span className="post-card-username">{post.username}</span>
          <Link to={`/post/${post.id}`} className="post-card-time">
            {timeAgo(post.created_at)}
          </Link>
        </div>

        {!isOwnPost && !isFollowingAuthor && (
          <button
            type="button"
            className="post-card-follow-btn"
            onClick={() => toggleFollow(post.username, isFollowingAuthor)}
          >
            Follow
          </button>
        )}

        {isOwnPost && (
          <div className="post-card-menu-wrapper">
            <button
              type="button"
              className="post-card-menu-btn"
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Post options"
            >
              ⋮
            </button>

            {showMenu && (
              <div className="post-card-menu-popover">
                <button type="button" onClick={handleStartEdit}>
                  Edit
                </button>
                <button type="button" className="post-card-menu-delete" onClick={handleDeleteClick}>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="post-card-edit-box">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
          />
          <div className="post-card-edit-actions">
            <button type="button" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="post-card-edit-save"
              onClick={handleSaveEdit}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        content && <p className="post-card-content">{content}</p>
      )}

      {media.length > 0 && (
        <MediaCarousel media={media} onIndexChange={setVisibleMediaIndex} />
      )}

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

        <div className="post-card-share-wrapper">
          <button
            type="button"
            className="action-btn"
            onClick={() => setShowShareMenu((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
            </svg>
            <span>{sharesCount}</span>
          </button>

          {showShareMenu && (
            <div className="post-card-share-popover">
              <button type="button" onClick={handleShare}>
                Share
              </button>
              <button type="button" onClick={handleShareToStory} disabled={sharingToStory}>
                {sharingToStory ? "Adding..." : "Add To Story"}
              </button>
            </div>
          )}

          {shareToast && (
            <div className={`post-card-share-toast post-card-share-toast-${shareToast.type}`}>
              {shareToast.message}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`action-btn action-btn-save ${saved ? "action-btn-active-save" : ""}`}
          onClick={handleSave}
        >
          <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {isSharedView && (
          <button type="button" className="post-card-unshare-btn" onClick={handleUnshareClick}>
            Remove
          </button>
        )}
      </div>

      {showComments && (
        <CommentsSection
          postId={post.id}
          onCommentAdded={() => setCommentsCount((prev) => prev + 1)}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          message={
            confirmAction === "delete"
              ? "Delete this post? This cannot be undone."
              : "Remove this post from your shares?"
          }
          onConfirm={handleConfirmModalConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

export default PostCard;