import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStories } from "../context/StoriesContext";
import StoryViewer from "./StoryViewer";
import "../styles/storiesBar.css";

import { API_BASE } from "../config";

function StoriesBar() {
  const { token, user } = useAuth();
  const { refreshTrigger } = useStories();
  const [searchParams, setSearchParams] = useSearchParams();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Normally the viewer shows `groups` at `activeGroupIndex`. For a
  // deep-linked story from a notification (possibly from someone whose
  // stories aren't in `groups` because you don't follow them), we instead
  // populate `deepLinkGroups` with a single fetched group and view that.
  const [activeGroupIndex, setActiveGroupIndex] = useState(null); // null = viewer closed
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [deepLinkGroups, setDeepLinkGroups] = useState(null);

  const [toast, setToast] = useState(null);

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

  // Deep-link support: /home?story=<username>&storyId=<id> (used by
  // notifications). Tries the normal `groups` first; if the story's owner
  // isn't in there (e.g. you don't follow them), fetches that one story's
  // group directly instead.
  useEffect(() => {
    const storyUsername = searchParams.get("story");
    const storyIdParam = searchParams.get("storyId");

    if (!storyUsername || groups.length === 0) return;

    const clearParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("story");
      next.delete("storyId");
      setSearchParams(next, { replace: true });
    };

    const groupIdx = groups.findIndex((g) => g.username === storyUsername);
    if (groupIdx !== -1) {
      let storyIdx = 0;
      if (storyIdParam) {
        const foundIdx = groups[groupIdx].stories.findIndex(
          (s) => String(s.id) === storyIdParam,
        );
        if (foundIdx !== -1) storyIdx = foundIdx;
      }
      setDeepLinkGroups(null);
      setActiveGroupIndex(groupIdx);
      setActiveStoryIndex(storyIdx);
      clearParams();
      return;
    }

    if (storyIdParam) {
      const fetchStandaloneGroup = async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/stories/${storyIdParam}/detail/`,
            {
              headers: { Authorization: `Token ${token}` },
            },
          );
          if (!res.ok) {
            clearParams();
            return;
          }
          const group = await res.json();
          const storyIdx = group.stories.findIndex(
            (s) => String(s.id) === storyIdParam,
          );

          setDeepLinkGroups([group]);
          setActiveGroupIndex(0);
          setActiveStoryIndex(storyIdx !== -1 ? storyIdx : 0);
        } finally {
          clearParams();
        }
      };

      fetchStandaloneGroup();
    } else {
      clearParams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, searchParams.get("story"), searchParams.get("storyId")]);
  const ownGroup = groups.find((g) => g.username === user?.username);
  const otherGroups = groups.filter((g) => g.username !== user?.username);

  const handleOwnCircleClick = () => {
    if (ownGroup) {
      setDeepLinkGroups(null);
      setActiveStoryIndex(0);
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
    setActiveStoryIndex(0);
    setDeepLinkGroups(null);
    loadStories();
  };

  if (loading) return null;

  const viewerGroups = deepLinkGroups || groups;

  return (
    <div className="stories-bar-wrapper">
      {toast && (
        <div className={`story-toast story-toast-${toast.type}`}>
          {toast.message}
        </div>
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

          <button
            type="button"
            className="story-add-btn"
            onClick={handleAddClick}
            disabled={uploading}
          >
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
              onClick={() => {
                setDeepLinkGroups(null);
                setActiveStoryIndex(0);
                setActiveGroupIndex(groups.indexOf(group));
              }}
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
        <StoryViewer
          groups={viewerGroups}
          startGroupIndex={activeGroupIndex}
          startStoryIndex={activeStoryIndex}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
}

export default StoriesBar;
