import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import PostCard from "../components/PostCard";
import "../styles/postDetail.css";
import "../styles/pageTransition.css"; 

import { API_BASE } from "../config";

function PostDetail() {
  const { postId } = useParams();
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const highlightCommentId = searchParams.get("comment");

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
    <div className="page-fade-in">
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
            initialShowComments={!!highlightCommentId}
            highlightCommentId={highlightCommentId}
          />
        )}
      </div>
    </div>
  );
}

export default PostDetail;