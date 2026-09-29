import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFollow } from "../context/FollowContext";
import "../styles/suggestedUsers.css";

import { API_BASE } from "../config";

function SuggestedUsers() {
  const { token } = useAuth();
  const { getFollowStatus, toggleFollow, isFlashing } = useFollow();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/suggested/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setUsers(data);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [token]);

  if (loading) return null;

  // Users the suggestion API returned as "not followed" originally, MINUS
  // anyone the shared FollowContext now knows has just been followed
  // (e.g. followed from a PostCard elsewhere on the page).
  // Exception: keep the row visible while it's still flashing green,
  // so the success feedback is actually seen before it disappears.
  const visibleUsers = users.filter(
    (user) => !getFollowStatus(user.username, false) || isFlashing(user.username)
  );

  if (visibleUsers.length === 0) return null;

  return (
    <div className="suggested-users">
      <div className="suggested-users-title">Suggested for you</div>

      {visibleUsers.map((user) => {
        const firstLetter = user.username?.charAt(0)?.toUpperCase() || "?";
        const isFollowing = getFollowStatus(user.username, false);

        return (
          <div
            className={`suggested-user-item ${
              isFlashing(user.username) ? "follow-success-flash" : ""
            }`}
            key={user.id}
          >
            <Link to={`/profile/${user.username}`} className="suggested-user-link">
              {user.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={user.username}
                  className="suggested-user-avatar-img"
                />
              ) : (
                <div className="suggested-user-avatar-letter">{firstLetter}</div>
              )}
              <span className="suggested-user-name">{user.username}</span>
            </Link>

            <button
              type="button"
              className={`suggested-user-follow-btn ${
                isFollowing ? "suggested-user-following" : ""
              }`}
              onClick={() => toggleFollow(user.username, isFollowing)}
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default SuggestedUsers;