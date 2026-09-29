import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFollow } from "../context/FollowContext";
import "../styles/followListModal.css";

import { API_BASE } from "../config";

function FollowListModal({ username, type, onClose, onFollowChange }) {
  const { token, user } = useAuth();
  const { getFollowStatus, toggleFollow, isFlashing } = useFollow();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/profile/${username}/${type}/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setUsers(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [username, type, token]);

  return (
    <div className="follow-modal-overlay" onClick={onClose}>
      <div className="follow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="follow-modal-header">
          <span className="follow-modal-title">
            {type === "followers" ? "Followers" : "Following"}
          </span>
          <button type="button" className="follow-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="follow-modal-list">
          {loading && <div className="follow-modal-status">Loading...</div>}

          {!loading && users.length === 0 && (
            <div className="follow-modal-status">Nothing to show yet.</div>
          )}

          {!loading &&
            users.map((u) => {
              const firstLetter = u.username?.charAt(0)?.toUpperCase() || "?";
              const isSelf = user?.username === u.username;
              const isFollowing = getFollowStatus(u.username, u.is_following);

              return (
                <div
                  className={`follow-modal-item ${
                    isFlashing(u.username) ? "follow-success-flash" : ""
                  }`}
                  key={u.id}
                >
                  <Link
                    to={`/profile/${u.username}`}
                    className="follow-modal-user-link"
                    onClick={onClose}
                  >
                    {u.profile_picture ? (
                      <img src={u.profile_picture} alt={u.username} />
                    ) : (
                      <div className="follow-modal-avatar-letter">{firstLetter}</div>
                    )}
                    <span>{u.username}</span>
                  </Link>

                  {!isSelf && (
                    <button
                      type="button"
                      className={`follow-modal-follow-btn ${
                        isFollowing ? "follow-modal-following" : ""
                      }`}
                      onClick={async () => {
                        await toggleFollow(u.username, isFollowing);
                        if (onFollowChange) onFollowChange(u.username, !isFollowing);
                      }}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default FollowListModal;