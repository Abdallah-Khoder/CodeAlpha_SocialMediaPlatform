import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useStories } from "../context/StoriesContext";
import StoryViewer from "./StoryViewer";
import "../styles/storiesBar.css";

const API_BASE = "http://127.0.0.1:8000";

function StoriesBar() {
  const { token, user } = useAuth();
  const { refreshTrigger } = useStories();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(null); // null = viewer closed
  const [toast, setToast] = useState(null); // { type: "success" | "error", message: string }

  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  const loadStories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stories/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setGroups(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStories();
  }, [token, refreshTrigger]);

  const ownGroup = groups.find((g) => g.username === user?.username);
  const otherGroups = groups.filter((g) => g.username !== user?.username);

  const handleOwnCircleClick = () => {
    if (ownGroup) {
      setActiveGroupIndex(groups.indexOf(ownGroup));
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleAddClick = (e) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("media", file);

    try {
      const res = await fetch(`${API_BASE}/api/stories/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
        body: formData,
      });

      if (res.ok) {
        await loadStories();
        showToast("success", "Story posted!");
      } else {
        const data = await res.json().catch(() => null);
        showToast("error", data?.error || "Could not post your story.");
      }
    } catch (err) {
      showToast("error", "Could not reach the server.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCloseViewer = () => {
    setActiveGroupIndex(null);
    loadStories(); // refresh so viewed rings update
  };

  if (loading) return null;

  return (
    <div className="stories-bar-wrapper">
      {toast && (
        <div className={`story-toast story-toast-${toast.type}`}>{toast.message}</div>
      )}

      <div className="stories-bar">
        <div className="story-circle-wrapper">
          <button
            type="button"
            className={`story-circle ${
              ownGroup
                ? ownGroup.has_unviewed
                  ? "story-ring-new"
                  : "story-ring-viewed"
                : "story-ring-empty"
            }`}
            onClick={handleOwnCircleClick}
          >
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt="Your story" />
            ) : (
              <span>{user?.username?.charAt(0)?.toUpperCase() || "?"}</span>
            )}
          </button>

          <button type="button" className="story-add-btn" onClick={handleAddClick} disabled={uploading}>
            {uploading ? "..." : "+"}
          </button>

          <span className="story-username">You</span>
        </div>

        <input
          type="file"
          accept="image/*,video/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {otherGroups.map((group) => (
          <div className="story-circle-wrapper" key={group.username}>
            <button
              type="button"
              className={`story-circle ${group.has_unviewed ? "story-ring-new" : "story-ring-viewed"}`}
              onClick={() => setActiveGroupIndex(groups.indexOf(group))}
            >
              {group.profile_picture ? (
                <img src={group.profile_picture} alt={group.username} />
              ) : (
                <span>{group.username?.charAt(0)?.toUpperCase() || "?"}</span>
              )}
            </button>
            <span className="story-username">{group.username}</span>
          </div>
        ))}
      </div>

      {activeGroupIndex !== null && (
        <StoryViewer groups={groups} startGroupIndex={activeGroupIndex} onClose={handleCloseViewer} />
      )}
    </div>
  );
}

export default StoriesBar;