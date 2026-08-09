import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFollow } from "../context/FollowContext";
import Navbar from "../components/Navbar";
import PostCard from "../components/PostCard";
import FollowListModal from "../components/FollowListModal";
import StoryViewer from "../components/StoryViewer";
import "../styles/profile.css";
import "../styles/pageTransition.css";
const API_BASE = "http://127.0.0.1:8000";

function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { token, user, fetchCurrentUser } = useAuth();
  const { getFollowStatus, toggleFollow, isFlashing } = useFollow();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [shares, setShares] = useState([]);
  const [activeTab, setActiveTab] = useState("posts"); // "posts" | "shares"
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingShares, setLoadingShares] = useState(false);
  const [sharesLoaded, setSharesLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [followModalType, setFollowModalType] = useState(null); // null | "followers" | "following"

  // NEW: story ring on the avatar
  const [storyGroup, setStoryGroup] = useState(null); // null = no active story
  const [showStoryViewer, setShowStoryViewer] = useState(false);

  const fileInputRef = useRef(null);

  // Whether the page being viewed belongs to the currently logged-in user
  const isOwnProfile = user?.username === username;

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

    // NEW: check whether this user currently has an active story
    const loadStoryStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/profile/${username}/story-group/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setStoryGroup(data.has_story ? data : null);
      } catch {
        setStoryGroup(null);
      }
    };

    loadProfile();
    loadPosts();
    loadStoryStatus();
    setActiveTab("posts");
    setSharesLoaded(false);
    setShares([]);
  }, [username, token]);

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

  // Opens the hidden file picker (only reachable when viewing your own profile)
  const handleAvatarClick = () => {
    if (isOwnProfile) fileInputRef.current?.click();
  };

  // NEW: avatar click now branches - other people's active story opens the
  // viewer, your own avatar still opens the picture picker as before
  const handleAvatarInteract = () => {
    if (storyGroup && !isOwnProfile) {
      setShowStoryViewer(true);
    } else {
      handleAvatarClick();
    }
  };

  // NEW: re-checks story status (used after closing the viewer, so the ring
  // updates from "new" to "viewed")
  const refreshStoryStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/profile/${username}/story-group/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setStoryGroup(data.has_story ? data : null);
    } catch {
      // non-critical
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("profile_picture", file);

    try {
      const res = await fetch(`${API_BASE}/api/profile/update-picture/`, {
        method: "PATCH",
        headers: { Authorization: `Token ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Update this page's local state so it shows up instantly here
        setProfile((prev) => ({ ...prev, profile_picture: data.profile_picture }));

        // Also refresh the global AuthContext user, so the picture updates
        // immediately everywhere else too (CreatePost composer, Navbar, etc.)
        if (fetchCurrentUser) fetchCurrentUser();
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleFollowToggle = async () => {
    const currentValue = getFollowStatus(username, profile.is_following);
    const previousCount = profile.followers_count;

    // Optimistically adjust the follower count shown on this page
    setProfile((prev) => ({
      ...prev,
      followers_count: currentValue ? previousCount - 1 : previousCount + 1,
    }));

    await toggleFollow(username, currentValue);
  };

  const handlePostShared = (sharedPost) => {
    if (!isOwnProfile) return;

    setProfile((prev) => ({ ...prev, shares_count: prev.shares_count + 1 }));

    // Only add it to the visible Shares list if it's not already there
    // (re-sharing the same post again shouldn't create a duplicate row)
    setShares((prev) => {
      const alreadyThere = prev.some((p) => p.id === sharedPost.id);
      return alreadyThere ? prev : [sharedPost, ...prev];
    });
  };

  const handleMessageClick = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations/start/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ username }),
      });

      if (res.ok) {
        const data = await res.json();
        navigate(`/messages/${data.conversation_id}`);
      }
    } catch (err) {
      // Non-critical for now
    }
  };

  if (loadingProfile) {
    return (
      <div>
        <Navbar />
        <div className="profile-status">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <Navbar />
        <div className="profile-status">Profile not found.</div>
      </div>
    );
  }

  const firstLetter = profile.username?.charAt(0)?.toUpperCase() || "?";
  const fullName = `${profile.first_name} ${profile.last_name}`.trim();

  return (
    <div className="page-fade-in">
      <Navbar />
      <div className="profile-page">
      <div className={`profile-header ${isFlashing(username) ? "follow-success-flash" : ""}`}>
        <div
          className={`profile-avatar-large ${isOwnProfile ? "profile-avatar-editable" : ""} ${
            storyGroup
              ? storyGroup.has_unviewed
                ? "profile-avatar-story-new"
                : "profile-avatar-story-viewed"
              : ""
          }`}
          onClick={handleAvatarInteract}
        >
          {profile.profile_picture ? (
            <img src={profile.profile_picture} alt={profile.username} />
          ) : (
            firstLetter
          )}

          {isOwnProfile && (
            <div className="profile-avatar-overlay">
              {uploading ? "..." : "Change"}
            </div>
          )}
        </div>

        {isOwnProfile && (
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        )}

        <div className="profile-header-text">
          <div className="profile-name-row">
            <h2 className="profile-username">{profile.username}</h2>

            {!isOwnProfile && (
              <>
                <button
                  type="button"
                  className={`profile-follow-btn ${
                    getFollowStatus(username, profile.is_following)
                      ? "profile-follow-btn-active"
                      : ""
                  }`}
                  onClick={handleFollowToggle}
                >
                  {getFollowStatus(username, profile.is_following) ? "Unfollow" : "Follow"}
                </button>

                <button
                  type="button"
                  className="profile-message-btn"
                  onClick={handleMessageClick}
                >
                  Message
                </button>
              </>
            )}
          </div>

          {fullName && <p className="profile-fullname">{fullName}</p>}
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          <div className="profile-stats">
            <span>
              <strong>{profile.posts_count}</strong> Posts
            </span>
            <span
              className="profile-stat-clickable"
              onClick={() => setFollowModalType("followers")}
            >
              <strong>{profile.followers_count}</strong> Followers
            </span>
            <span
              className="profile-stat-clickable"
              onClick={() => setFollowModalType("following")}
            >
              <strong>{profile.following_count}</strong> Following
            </span>
            <span>
              <strong>{profile.shares_count}</strong> Shares
            </span>
          </div>
        </div>
      </div>

      {followModalType && (
        <FollowListModal
          username={username}
          type={followModalType}
          onClose={() => setFollowModalType(null)}
          onFollowChange={(targetUsername, nowFollowing) => {
            // Toggling follow on ANYONE (whether you're viewing their
            // followers list or their following list) always changes
            // YOUR OWN following_count - not the list type being shown
            if (isOwnProfile) {
              setProfile((prev) => ({
                ...prev,
                following_count: nowFollowing
                  ? prev.following_count + 1
                  : prev.following_count - 1,
              }));
            }
          }}
        />
      )}

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
              <PostCard
                post={post}
                key={post.id}
                onShared={handlePostShared}
                onDeleted={(id) => {
                  setPosts((prev) => prev.filter((p) => p.id !== id));
                  setProfile((prev) => ({ ...prev, posts_count: prev.posts_count - 1 }));
                }}
              />
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
              <PostCard
                post={post}
                key={post.id}
                isSharedView={isOwnProfile}
                onShared={handlePostShared}
                onUnshared={(id) => {
                  setShares((prev) => prev.filter((p) => p.id !== id));
                  setProfile((prev) => ({ ...prev, shares_count: prev.shares_count - 1 }));
                }}
                onDeleted={(id) => {
                  setShares((prev) => prev.filter((p) => p.id !== id));
                  setProfile((prev) => ({ ...prev, shares_count: prev.shares_count - 1 }));
                }}
              />
            ))}
          </>
        )}
      </div>
      </div>

      {showStoryViewer && storyGroup && (
        <StoryViewer
          groups={[storyGroup]}
          startGroupIndex={0}
          onClose={() => {
            setShowStoryViewer(false);
            refreshStoryStatus();
          }}
        />
      )}
    </div>
  );
}

export default Profile;