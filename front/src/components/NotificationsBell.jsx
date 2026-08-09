import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../utils/timeAgo";
import "../styles/notificationsBell.css";

const API_BASE = "http://127.0.0.1:8000";
const UNREAD_POLL_INTERVAL_MS = 15000;

function getNotificationPath(notif) {
  if (notif.verb === "follow") {
    return `/profile/${notif.actor_username}`;
  }
  if (notif.verb === "message") {
    return notif.target_conversation_id ? `/messages/${notif.target_conversation_id}` : "/messages";
  }
  if (notif.verb === "comment") {
    return notif.target_post_id
      ? `/post/${notif.target_post_id}?comment=${notif.target_comment_id}`
      : "/home";
  }
  if (notif.verb === "story_share") {
    // Jump straight into the story viewer for that specific story.
    // Falls back to the original post if the story already expired/deleted.
    if (notif.target_story_id && notif.target_story_username) {
      return `/home?story=${notif.target_story_username}&storyId=${notif.target_story_id}`;
    }
    return notif.target_post_id ? `/post/${notif.target_post_id}` : "/home";
  }
  // like, share, friend_share -> the post itself
  return notif.target_post_id ? `/post/${notif.target_post_id}` : "/home";
}

function NotificationsBell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const wrapperRef = useRef(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/unread-count/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setUnreadCount(data.unread_count || 0);
    } catch {
      // silently ignore, next poll will retry
    }
  }, [token]);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, UNREAD_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = async () => {
    const opening = !isOpen;
    setIsOpen(opening);

    if (opening) {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/notifications/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setNotifications(data.results || data);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNotificationClick = async (notif) => {
    setIsOpen(false);

    if (!notif.is_read) {
      // Optimistic: update this item and the badge immediately
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));

      try {
        await fetch(`${API_BASE}/api/notifications/${notif.id}/read/`, {
          method: "PATCH",
          headers: { Authorization: `Token ${token}` },
        });
      } catch {
        // non-critical, worst case it shows unread again next poll
      }
    }

    navigate(getNotificationPath(notif));
  };

  return (
    <div className="navbar-notif-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="navbar-home-link navbar-notif-btn"
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="navbar-notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="navbar-notif-dropdown">
          <div className="navbar-notif-dropdown-header">Notifications</div>

          {loading ? (
            <div className="navbar-notif-status">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="navbar-notif-status">No notifications yet.</div>
          ) : (
            <div className="navbar-notif-list">
              {notifications.map((notif) => {
                const firstLetter = notif.actor_username?.charAt(0)?.toUpperCase() || "?";

                return (
                  <button
                    type="button"
                    key={notif.id}
                    className={`navbar-notif-item ${!notif.is_read ? "navbar-notif-item-unread" : ""}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    {notif.actor_profile_picture ? (
                      <img src={notif.actor_profile_picture} alt={notif.actor_username} />
                    ) : (
                      <div className="navbar-notif-avatar-letter">{firstLetter}</div>
                    )}

                    <div className="navbar-notif-item-text">
                      <span>
                        <strong>{notif.actor_username}</strong> {notif.message}
                      </span>
                      <span className="navbar-notif-item-time">{timeAgo(notif.created_at)}</span>
                    </div>

                    {!notif.is_read && <span className="navbar-notif-item-dot" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationsBell;