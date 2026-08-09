import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import PostCard from "./PostCard";
import "../styles/feed.css";

const API_BASE = "http://127.0.0.1:8000";

// How many posts before the end of the loaded list should trigger a prefetch
const PREFETCH_LOOKAHEAD = 5;

function Feed({ newPost }) {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Observer that triggers "load more" pagination (unrelated to the animation)
  const paginationObserverRef = useRef(null);

  // Observer that reveals each post card the first time it scrolls into view.
  // Created lazily during render (not inside useEffect) so it already exists
  // by the time the very first post's ref callback fires during commit.
  const revealObserverRef = useRef(null);
  if (!revealObserverRef.current) {
    revealObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("post-card-in-view");
            // Reveal once per card, then stop watching it
            revealObserverRef.current.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
  }

  useEffect(() => {
    return () => revealObserverRef.current?.disconnect();
  }, []);

  // Load the very first page when the feed mounts
  useEffect(() => {
    const loadFirstPage = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/posts/`, {
          headers: { Authorization: `Token ${token}` },
        });

        if (!res.ok) {
          setError("Could not load posts.");
          return;
        }

        const data = await res.json();
        setPosts(data.results);
        setNextUrl(data.next);
      } catch (err) {
        setError("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    };

    loadFirstPage();
  }, [token]);

  // When a new post is created elsewhere (CreatePost), prepend it here
  useEffect(() => {
    if (newPost) {
      setPosts((prev) => [newPost, ...prev]);
    }
  }, [newPost]);

  // Fetches the next page and appends it to the current list
  const loadMore = useCallback(async () => {
    if (!nextUrl || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setPosts((prev) => [...prev, ...data.results]);
      setNextUrl(data.next);
    } finally {
      setLoadingMore(false);
    }
  }, [nextUrl, loadingMore, token]);

  // Ref callback attached to the "lookahead" post (5 posts before the end).
  // When that post scrolls into view, we silently fetch the next batch.
  const sentinelRef = useCallback(
    (node) => {
      if (paginationObserverRef.current) paginationObserverRef.current.disconnect();

      paginationObserverRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      });

      if (node) paginationObserverRef.current.observe(node);
    },
    [loadMore]
  );

  // Ref callback attached to EVERY post, registering it with the reveal observer
  const revealRef = useCallback((node) => {
    if (node) {
      revealObserverRef.current.observe(node);
    }
  }, []);

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (loading) {
    return <div className="feed-status">Loading posts...</div>;
  }

  if (error) {
    return <div className="feed-status feed-status-error">{error}</div>;
  }

  if (posts.length === 0) {
    return <div className="feed-status">No posts yet.</div>;
  }

  const sentinelIndex = Math.max(posts.length - PREFETCH_LOOKAHEAD, 0);

  return (
    <div className="feed">
      {posts.map((post, index) => (
        <div
          ref={(node) => {
            revealRef(node);
            if (index === sentinelIndex) sentinelRef(node);
          }}
          className="feed-post-wrapper"
          key={post.id}
        >
          <PostCard post={post} onDeleted={handlePostDeleted} />
        </div>
      ))}
    </div>
  );
}

export default Feed;