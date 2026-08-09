import { Link } from "react-router-dom";
import "../styles/sharedPostPreview.css";

function SharedPostPreview({ post }) {
  const media = post.media || [];
  const firstMedia = media[0];

  return (
    <Link to={`/post/${post.id}`} className="shared-post-preview">
      <span className="shared-post-preview-username">{post.username}</span>

      <div className="shared-post-preview-media">
        {firstMedia ? (
          firstMedia.media_type === "video" ? (
            <video src={firstMedia.file} muted />
          ) : (
            <img src={firstMedia.file} alt="" />
          )
        ) : (
          <div className="shared-post-preview-text-only">{post.content}</div>
        )}

        <div className="shared-post-preview-overlay">
          <span>See post</span>
        </div>
      </div>
    </Link>
  );
}

export default SharedPostPreview;