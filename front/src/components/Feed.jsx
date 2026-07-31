import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import PostCard from "./PostCard";
import "../styles/feed.css";

const API_BASE = "http://127.0.0.1:8000";

function Feed({ newPost }) {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/posts/`, {
          headers: {
            Authorization: `Token ${token}`,
          },
        });

        if (!res.ok) {
          setError("Could not load posts.");
          setLoading(false);
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
  }, [token]);

  // When a new post is created elsewhere (CreatePost), prepend it here
  // instead of re-fetching the whole feed from the server.
  useEffect(() => {
    if (newPost) {
      setPosts((prev) => [newPost, ...prev]);
    }
  }, [newPost]);

  if (loading) {
    return <div className="feed-status">Loading posts...</div>;
  }

  if (error) {
    return <div className="feed-status feed-status-error">{error}</div>;
  }

  if (posts.length === 0) {
    return (
      <div className="feed-status">
        No posts yet. Follow people or create your first post.
      </div>
    );
  }

  return (
    <div className="feed">
      {posts.map((post) => (
        <PostCard post={post} key={post.id} />
      ))}
    </div>
  );
}

export default Feed;