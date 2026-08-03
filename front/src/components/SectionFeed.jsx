import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import PostCard from "./PostCard";
import "../styles/feed.css";

const API_BASE = "http://127.0.0.1:8000";

// Maps each sidebar section to its API endpoint
const SECTION_ENDPOINTS = {
  saved: "/api/me/saved/",
  liked: "/api/me/liked/",
  commented: "/api/me/commented/",
  shared: "/api/me/shared/",
};

function SectionFeed({ section }) {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_BASE}${SECTION_ENDPOINTS[section]}`, {
          headers: { Authorization: `Token ${token}` },
        });

        if (!res.ok) {
          setError("Could not load posts.");
          return;
        }

        const data = await res.json();
        setPosts(data);
      } catch (err) {
        setError("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [section, token]);

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (loading) {
    return <div className="feed-status">Loading...</div>;
  }

  if (error) {
    return <div className="feed-status feed-status-error">{error}</div>;
  }

  if (posts.length === 0) {
    return <div className="feed-status">Nothing here yet.</div>;
  }

  return (
    <div className="feed">
      {posts.map((post) => (
        <PostCard
          post={post}
          key={post.id}
          onDeleted={handlePostDeleted}
          isSharedView={section === "shared"}
          onUnshared={section === "shared" ? handlePostDeleted : undefined}
        />
      ))}
    </div>
  );
}

export default SectionFeed;