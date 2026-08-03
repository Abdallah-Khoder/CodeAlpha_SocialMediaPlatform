import { createContext, useContext, useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE = "http://127.0.0.1:8000";
const FollowContext = createContext(null);

export function FollowProvider({ children }) {
  const { token } = useAuth();

  // Map of username -> true/false, only for users whose follow state
  // has been changed (or explicitly checked) during this session.
  // Anything not in the map falls back to whatever value the caller provides.
  const [followMap, setFollowMap] = useState(new Map());

  // Usernames currently showing the "just followed" green success flash
  const [flashSet, setFlashSet] = useState(new Set());

  // Returns the known follow state for a username, or the given fallback
  // (usually the value that came from the API, e.g. post.is_following_author)
  const getFollowStatus = (username, fallback) => {
    return followMap.has(username) ? followMap.get(username) : fallback;
  };

  const isFlashing = (username) => flashSet.has(username);

  const triggerFlash = (username) => {
    setFlashSet((prev) => new Set(prev).add(username));

    // Remove the flash after 10 seconds
    setTimeout(() => {
      setFlashSet((prev) => {
        const updated = new Set(prev);
        updated.delete(username);
        return updated;
      });
    }, 10000);
  };

  const toggleFollow = async (username, currentValue) => {
    const newValue = !currentValue;

    // Optimistic update, visible everywhere immediately
    setFollowMap((prev) => new Map(prev).set(username, newValue));

    try {
      const res = await fetch(`${API_BASE}/api/users/${username}/follow/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });

      if (!res.ok) throw new Error("Follow request failed");

      const data = await res.json();
      setFollowMap((prev) => new Map(prev).set(username, data.following));

      // Only flash when the action resulted in actually following someone
      if (data.following) {
        triggerFlash(username);
      }
    } catch (err) {
      // Revert on failure
      setFollowMap((prev) => new Map(prev).set(username, currentValue));
    }
  };

  return (
    <FollowContext.Provider value={{ getFollowStatus, toggleFollow, isFlashing }}>
      {children}
    </FollowContext.Provider>
  );
}

export function useFollow() {
  return useContext(FollowContext);
}