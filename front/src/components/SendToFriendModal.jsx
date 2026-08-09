import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/sendToFriendModal.css";

const API_BASE = "http://127.0.0.1:8000";

function SendToFriendModal({ post, onClose, onSent }) {
  const { token, user } = useAuth();
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [sentDone, setSentDone] = useState(false);

  useEffect(() => {
    if (!user?.username) return;

    const loadFollowing = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/profile/${user.username}/following/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setFollowing(data.results || data);
      } finally {
        setLoading(false);
      }
    };

    loadFollowing();
  }, [token, user]);

  const toggleSelected = (username) => {
    setSelected((prev) => {
      const updated = new Set(prev);
      if (updated.has(username)) {
        updated.delete(username);
      } else {
        updated.add(username);
      }
      return updated;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) return;

    setSending(true);
    let latestSharesCount = null;

    try {
      for (const username of selected) {
        const startRes = await fetch(`${API_BASE}/api/conversations/start/`, {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username }),
        });

        if (!startRes.ok) continue;
        const { conversation_id } = await startRes.json();

        const messageRes = await fetch(
          `${API_BASE}/api/conversations/${conversation_id}/messages/`,
          {
            method: "POST",
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ shared_post_id: post.id }),
          }
        );

        if (messageRes.ok) {
          const data = await messageRes.json();
          if (typeof data.shares_count === "number") {
            latestSharesCount = data.shares_count;
          }
        }
      }

      if (latestSharesCount !== null && onSent) {
        onSent(latestSharesCount);
      }

      setSentDone(true);
      setTimeout(onClose, 900);
    } finally {
      setSending(false);
    }
  };

  const modalContent = (
    <div className="send-to-friend-overlay" onClick={onClose}>
      <div className="send-to-friend-modal" onClick={(e) => e.stopPropagation()}>
        <div className="send-to-friend-header">
          <h3>Send to Friend</h3>
          <button type="button" className="send-to-friend-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading ? (
          <div className="send-to-friend-status">Loading...</div>
        ) : sentDone ? (
          <div className="send-to-friend-status send-to-friend-success">Sent!</div>
        ) : following.length === 0 ? (
          <div className="send-to-friend-status">You're not following anyone yet.</div>
        ) : (
          <>
            <div className="send-to-friend-list">
              {following.map((person) => {
                const firstLetter = person.username?.charAt(0)?.toUpperCase() || "?";
                const isChecked = selected.has(person.username);

                return (
                  <label className="send-to-friend-item" key={person.username}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelected(person.username)}
                    />
                    {person.profile_picture ? (
                      <img src={person.profile_picture} alt={person.username} />
                    ) : (
                      <div className="send-to-friend-avatar-letter">{firstLetter}</div>
                    )}
                    <span className="send-to-friend-username">{person.username}</span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              className="send-to-friend-send-btn"
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
            >
              {sending ? "Sending..." : `Send${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </button>
          </>
        )}
      </div>
    </div>
  );

  // Render into document.body directly, escaping any transformed ancestor
  // (like the feed's scroll-reveal animation wrapper) that would otherwise
  // break this modal's position:fixed centering
  return createPortal(modalContent, document.body);
}

export default SendToFriendModal;