import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PostCard from "../components/PostCard";
import "../styles/profile.css";

const API_BASE = "http://127.0.0.1:8000";

function Profile() {
  const { username } = useParams();
  const { token } = useAuth();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [shares, setShares] = useState([]);
  const [activeTab, setActiveTab] = useState("posts"); // "posts" | "shares"
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingShares, setLoadingShares] = useState(false);
  const [sharesLoaded, setSharesLoaded] = useState(false);

  // Load profile info + this user's posts as soon as the page opens
  useEffect(() => {
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const res = await fetch(`${API_BASE}/api/profile/${username}/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setProfile(data);
      } finally {
        setLoadingProfile(false);
      }
    };

    const loadPosts = async () => {
      setLoadingPosts(true);
      try {
        const res = await fetch(`${API_BASE}/api/profile/${username}/posts/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setPosts(data);
      } finally {
        setLoadingPosts(false);
      }
    };

    loadProfile();
    loadPosts();
    // Reset tab state whenever we navigate to a different user's profile
    setActiveTab("posts");
    setSharesLoaded(false);
    setShares([]);
  }, [username, token]);

  // Shares are only fetched the first time the "Shares" tab is opened
  const handleTabClick = async (tab) => {
    setActiveTab(tab);

    if (tab === "shares" && !sharesLoaded) {
      setLoadingShares(true);
      try {
        const res = await fetch(`${API_BASE}/api/profile/${username}/shares/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setShares(data);
        setSharesLoaded(true);
      } finally {
        setLoadingShares(false);
      }
    }
  };

  if (loadingProfile) {
    return <div className="profile-status">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="profile-status">Profile not found.</div>;
  }

  const firstLetter = profile.username?.charAt(0)?.toUpperCase() || "?";
  const fullName = `${profile.first_name} ${profile.last_name}`.trim();

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar-large">{firstLetter}</div>
        <div className="profile-header-text">
          <h2 className="profile-username">{profile.username}</h2>
          {fullName && <p className="profile-fullname">{fullName}</p>}
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          <div className="profile-stats">
            <span>
              <strong>{profile.posts_count}</strong> Posts
            </span>
            <span>
              <strong>{profile.shares_count}</strong> Shares
            </span>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        <button
          type="button"
          className={`profile-tab ${activeTab === "posts" ? "profile-tab-active" : ""}`}
          onClick={() => handleTabClick("posts")}
        >
          Posts
        </button>
        <button
          type="button"
          className={`profile-tab ${activeTab === "shares" ? "profile-tab-active" : ""}`}
          onClick={() => handleTabClick("shares")}
        >
          Shares
        </button>
      </div>

      <div className="profile-content">
        {activeTab === "posts" && (
          <>
            {loadingPosts && <div className="profile-status">Loading posts...</div>}
            {!loadingPosts && posts.length === 0 && (
              <div className="profile-status">No posts yet.</div>
            )}
            {posts.map((post) => (
              <PostCard post={post} key={post.id} />
            ))}
          </>
        )}

        {activeTab === "shares" && (
          <>
            {loadingShares && <div className="profile-status">Loading shares...</div>}
            {!loadingShares && shares.length === 0 && (
              <div className="profile-status">No shared posts yet.</div>
            )}
            {shares.map((post) => (
              <PostCard post={post} key={post.id} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;