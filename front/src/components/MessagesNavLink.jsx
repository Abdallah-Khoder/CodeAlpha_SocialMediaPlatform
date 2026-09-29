import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/messagesNavLink.css";

import { API_BASE } from "../config";
const POLL_INTERVAL_MS = 15000;

function MessagesNavLink() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations/unread-count/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setUnreadCount(data.unread_count || 0);
    } catch {
      // silently ignore, next poll retries
    }
  }, [token]);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  return (
    <Link to="/messages" className="navbar-home-link navbar-messages-nav-link" aria-label="Messages">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
      {unreadCount > 0 && (
        <span className="navbar-message-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
      )}
    </Link>
  );
}

export default MessagesNavLink;