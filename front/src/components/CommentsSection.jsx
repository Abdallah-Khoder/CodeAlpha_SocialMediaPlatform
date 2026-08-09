import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../utils/timeAgo";

const API_BASE = "http://127.0.0.1:8000";

function CommentsSection({ postId, onCommentAdded, highlightCommentId }) {
  const { token } = useAuth();
  const [comments, setComments] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);

  const hasHandledHighlightRef = useRef(false);

  useEffect(() => {
    const loadFirstPage = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/posts/${postId}/comments/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setComments(data.results);
        setNextUrl(data.next);
      } catch (err) {
        // Fail silently, section will just show an empty list
      } finally {
        setLoading(false);
      }
    };

    loadFirstPage();
  }, [postId, token]);

  const handleLoadMore = async () => {
    if (!nextUrl || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setComments((prev) => [...prev, ...data.results]);
      setNextUrl(data.next);
    } finally {
      setLoadingMore(false);
    }
  };

  // If we arrived here from a "commented on your post" notification,
  // keep auto-loading pages (silently) until we find that comment, then
  // scroll to it and flash a highlight for 5 seconds.
  useEffect(() => {
    if (!highlightCommentId || loading || hasHandledHighlightRef.current) return;

    const found = comments.find((c) => String(c.id) === String(highlightCommentId));

    if (found) {
      hasHandledHighlightRef.current = true;
      requestAnimationFrame(() => {
        const el = document.getElementById(`comment-${highlightCommentId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      setHighlightedId(highlightCommentId);
      setTimeout(() => setHighlightedId(null), 5000);
    } else if (nextUrl && !loadingMore) {
      handleLoadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, loading, nextUrl, loadingMore, highlightCommentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/comments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ text: trimmed }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setText("");
        if (onCommentAdded) onCommentAdded();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comments-section">
      {loading ? (
        <div className="comments-loading">Loading comments...</div>
      ) : (
        <div className="comments-list">
          {comments.length === 0 && (
            <div className="comments-empty">No comments yet.</div>
          )}

          {comments.map((comment) => (
            <div
              className={`comment-item ${
                String(comment.id) === String(highlightedId) ? "comment-item-highlight" : ""
              }`}
              id={`comment-${comment.id}`}
              key={comment.id}
            >
              <div className="comment-avatar">
                {comment.profile_picture ? (
                  <img src={comment.profile_picture} alt={comment.username} />
                ) : (
                  comment.username?.charAt(0)?.toUpperCase() || "?"
                )}
              </div>
              <div className="comment-bubble">
                <span className="comment-username">{comment.username}</span>
                <p className="comment-text">{comment.text}</p>
                <span className="comment-time">{timeAgo(comment.created_at)}</span>
              </div>
            </div>
          ))}

          {nextUrl && (
            <button
              type="button"
              className="comments-load-more"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more comments"}
            </button>
          )}
        </div>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Write a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={!text.trim() || submitting}>
          Send
        </button>
      </form>
    </div>
  );
}

export default CommentsSection;