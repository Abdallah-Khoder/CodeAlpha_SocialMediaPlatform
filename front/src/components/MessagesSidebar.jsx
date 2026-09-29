import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../utils/timeAgo";
import "../styles/messagesSidebar.css";

import { API_BASE } from "../config";
const POLL_INTERVAL_MS = 8000;

function MessagesSidebar({ activeConversationId }) {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingUsername, setStartingUsername] = useState(null);

  useEffect(() => {
    if (!user?.username) return;

    const loadData = async (isFirstLoad) => {
      try {
        const [conversationsRes, followingRes] = await Promise.all([
          fetch(`${API_BASE}/api/conversations/`, {
            headers: { Authorization: `Token ${token}` },
          }),
          fetch(`${API_BASE}/api/profile/${user.username}/following/`, {
            headers: { Authorization: `Token ${token}` },
          }),
        ]);

        const conversationsData = await conversationsRes.json();
        const followingData = await followingRes.json();

        setConversations(conversationsData);
        setFollowing(followingData.results || followingData);
      } finally {
        if (isFirstLoad) setLoading(false);
      }
    };

    loadData(true);
    const interval = setInterval(() => loadData(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, user]);

  const handleStartConversation = async (username) => {
    setStartingUsername(username);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/start/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      if (res.ok) {
        const data = await res.json();
        navigate(`/messages/${data.conversation_id}`);
      }
    } finally {
      setStartingUsername(null);
    }
  };

  if (loading) {
    return <div className="messages-sidebar-status">Loading...</div>;
  }

  const conversationUsernames = new Set(conversations.map((c) => c.other_username));
  const newChatCandidates = following.filter(
    (person) => !conversationUsernames.has(person.username)
  );

  const isEmpty = conversations.length === 0 && newChatCandidates.length === 0;

  if (isEmpty) {
    return (
      <div className="messages-sidebar-status">
        You're not following anyone yet. Follow people to start chatting with them.
      </div>
    );
  }

  return (
    <div className="messages-sidebar-content">
      {conversations.length > 0 && (
        <div className="messages-sidebar-section">
          {conversations.map((c) => {
            const firstLetter = c.other_username?.charAt(0)?.toUpperCase() || "?";
            const isActive = String(c.id) === String(activeConversationId);

            return (
              <Link
                to={`/messages/${c.id}`}
                key={`conv-${c.id}`}
                className={`conversation-item ${isActive ? "conversation-item-active" : ""}`}
              >
                {c.other_profile_picture ? (
                  <img src={c.other_profile_picture} alt={c.other_username} />
                ) : (
                  <div className="conversation-avatar-letter">{firstLetter}</div>
                )}

                <div className="conversation-item-text">
                  <span className="conversation-item-username">{c.other_username}</span>
                  <span className="conversation-item-preview">
                    {c.last_message || "Start the conversation"}
                  </span>
                </div>

                <div className="conversation-item-meta">
                  {c.last_message_at && (
                    <span className="conversation-item-time">{timeAgo(c.last_message_at)}</span>
                  )}
                  {c.unread_count > 0 && (
                    <span className="conversation-item-badge">{c.unread_count}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {newChatCandidates.length > 0 && (
        <div className="messages-sidebar-section">
          <h3 className="messages-sidebar-title">People you follow</h3>

          {newChatCandidates.map((person) => {
            const firstLetter = person.username?.charAt(0)?.toUpperCase() || "?";

            return (
              <button
                type="button"
                key={`follow-${person.username}`}
                className="message-suggestion-item"
                onClick={() => handleStartConversation(person.username)}
                disabled={startingUsername === person.username}
              >
                {person.profile_picture ? (
                  <img src={person.profile_picture} alt={person.username} />
                ) : (
                  <div className="message-suggestion-avatar-letter">{firstLetter}</div>
                )}
                <span className="message-suggestion-username">{person.username}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MessagesSidebar;