import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../utils/timeAgo";

const API_BASE = "http://127.0.0.1:8000";

function CommentsSection({ postId, onCommentAdded }) {
  const { token } = useAuth();
  const [comments, setComments] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load the first page of comments when this section is opened
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

  // Fetch the next page and append it to the existing list
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
            <div className="comment-item" key={comment.id}>
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