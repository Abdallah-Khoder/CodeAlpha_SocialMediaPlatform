import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/createPost.css";

// Base URL of the Django backend (adjust if your setup differs)
const API_BASE = "http://127.0.0.1:8000";

function CreatePost({ onPostCreated }) {
  const { user, token } = useAuth();

  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]); // [{ file, previewUrl, type }]
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Grow the textarea height automatically as the user types
  const handleContentChange = (e) => {
    setContent(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  // Called when files are picked from either the image or video input
  const handleFilesSelected = (e, type) => {
    const files = Array.from(e.target.files || []);

    const newItems = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type, // "image" or "video"
    }));

    setMediaFiles((prev) => [...prev, ...newItems]);
    setShowMediaMenu(false);

    // Reset the input so selecting the same file twice still fires onChange
    e.target.value = "";
  };

  const removeMediaAt = (index) => {
    setMediaFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  };

  const canPost = content.trim().length > 0 || mediaFiles.length > 0;

  const handleSubmit = async () => {
    if (!canPost || loading) return;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("content", content.trim());
    mediaFiles.forEach((item) => {
      formData.append("media", item.file);
    });

    try {
      const res = await fetch(`${API_BASE}/api/posts/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Reset the composer after a successful post
      setContent("");
      mediaFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setMediaFiles([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      if (onPostCreated) onPostCreated(data);
    } catch (err) {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const firstLetter = user?.username?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="create-post-card">
      <div className="create-post-top">
        <Link to={`/profile/${user?.username}`} className="create-post-avatar">
          {firstLetter}
        </Link>

        <textarea
          ref={textareaRef}
          className="create-post-textarea"
          placeholder="What's on your mind?"
          value={content}
          onChange={handleContentChange}
          rows={1}
        />
      </div>

      {mediaFiles.length > 0 && (
        <div className="create-post-preview-grid">
          {mediaFiles.map((item, index) => (
            <div className="preview-item" key={index}>
              {item.type === "image" ? (
                <img src={item.previewUrl} alt="Selected media preview" />
              ) : (
                <video src={item.previewUrl} muted />
              )}
              <button
                type="button"
                className="preview-remove-btn"
                onClick={() => removeMediaAt(index)}
                aria-label="Remove media"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="create-post-error">{error}</div>}

      <div className="create-post-bottom">
        <div className="media-menu-wrapper">
          <button
            type="button"
            className="media-add-btn"
            onClick={() => setShowMediaMenu((prev) => !prev)}
            aria-label="Add media"
          >
            +
          </button>

          {showMediaMenu && (
            <div className="media-menu-popover">
              <button type="button" onClick={() => imageInputRef.current?.click()}>
                Photo
              </button>
              <button type="button" onClick={() => videoInputRef.current?.click()}>
                Video
              </button>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            multiple
            ref={imageInputRef}
            style={{ display: "none" }}
            onChange={(e) => handleFilesSelected(e, "image")}
          />
          <input
            type="file"
            accept="video/*"
            multiple
            ref={videoInputRef}
            style={{ display: "none" }}
            onChange={(e) => handleFilesSelected(e, "video")}
          />
        </div>

        <button
          type="button"
          className="submit-post-btn"
          disabled={!canPost || loading}
          onClick={handleSubmit}
        >
          {loading ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}

export default CreatePost;