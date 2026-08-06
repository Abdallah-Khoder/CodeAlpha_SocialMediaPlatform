import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import PostCard from "../components/PostCard";
import "../styles/postDetail.css";

const API_BASE = "http://127.0.0.1:8000";

function PostDetail() {
  const { postId } = useParams();
  const { token } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loadPost = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`${API_BASE}/api/posts/${postId}/`, {
          headers: { Authorization: `Token ${token}` },
        });

        if (!res.ok) {
          setNotFound(true);
          return;
        }

        const data = await res.json();
        setPost(data);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId, token]);

  return (
    <div>
      <Navbar />
      <div className="post-detail-page">
        {loading && <div className="post-detail-status">Loading post...</div>}
        {!loading && notFound && (
          <div className="post-detail-status">This post could not be found.</div>
        )}
        {!loading && post && (
          <PostCard
            post={post}
            onDeleted={() => setPost(null)}
          />
        )}
      </div>
    </div>
  );
}

export default PostDetail;