import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import PostCard from "./PostCard";
import ConfirmModal from "./ConfirmModal";
import "../styles/chatWindow.css";

const API_BASE = "http://127.0.0.1:8000";
const POLL_INTERVAL_MS = 3000;
const SKIP_DELETE_CONFIRM_KEY = "vibely_skip_message_delete_confirm";

function ChatWindow({ conversationId }) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [sending, setSending] = useState(false);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadMessages = async (isFirstLoad) => {
    if (isFirstLoad) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const data = await res.json();
      setMessages(data.results || data);
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages(true);
    const interval = setInterval(() => loadMessages(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
    e.target.value = "";
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !imageFile) return;

    setSending(true);
    const formData = new FormData();
    if (trimmed) formData.append("text", trimmed);
    if (imageFile) formData.append("image", imageFile);

    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
        body: formData,
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        setText("");
        setImageFile(null);
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditText(msg.text);
    setOpenMenuId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (messageId) => {
    const trimmed = editText.trim();
    if (!trimmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/messages/${messageId}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trimmed }),
      });

      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        cancelEdit();
      }
    } catch {
      // stays in editing state so the user can retry
    }
  };

  const handleEditKeyDown = (e, messageId) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit(messageId);
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const performDelete = async (messageId) => {
    try {
      const res = await fetch(`${API_BASE}/api/messages/${messageId}/`, {
        method: "DELETE",
        headers: { Authorization: `Token ${token}` },
      });

      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleDeleteClick = (messageId) => {
    setOpenMenuId(null);

    const skipConfirm = localStorage.getItem(SKIP_DELETE_CONFIRM_KEY) === "true";
    if (skipConfirm) {
      performDelete(messageId);
      return;
    }

    setPendingDeleteId(messageId);
  };

  const handleConfirmDelete = (remember) => {
    if (remember) {
      localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, "true");
    }
    performDelete(pendingDeleteId);
  };

  if (loading) {
    return <div className="chat-window-status">Loading conversation...</div>;
  }

  return (
    <>
      <div className="chat-window">
        <div className="chat-messages">
          {messages.map((msg) => {
            const isMine = msg.sender_username === user?.username;
            const isEditingThis = editingId === msg.id;
            const isMenuOpen = openMenuId === msg.id;
            const canEdit = isMine && !msg.is_deleted && msg.text && !msg.image && !msg.shared_post;
            const canDelete = isMine && !msg.is_deleted;

            return (
              <div className={`chat-message-row ${isMine ? "chat-message-mine" : ""}`} key={msg.id}>
                {isMine && !msg.is_deleted && (
                  <div className={`chat-message-menu-wrap ${isMenuOpen ? "chat-message-menu-wrap-open" : ""}`}>
                    <button
                      type="button"
                      className="chat-message-menu-btn"
                      onClick={() => setOpenMenuId(isMenuOpen ? null : msg.id)}
                      aria-label="Message options"
                    >
                      ⋮
                    </button>

                    {isMenuOpen && (
                      <div className="chat-message-menu">
                        {canEdit && (
                          <button type="button" onClick={() => startEdit(msg)}>
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="chat-message-menu-delete"
                            onClick={() => handleDeleteClick(msg.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className={`chat-bubble ${msg.is_deleted ? "chat-bubble-deleted" : ""}`}>
                  {msg.is_deleted ? (
                    <p className="chat-text chat-text-deleted">This message was deleted</p>
                  ) : isEditingThis ? (
                    <div className="chat-edit-box">
                      <textarea
                        className="chat-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, msg.id)}
                        rows={1}
                        autoFocus
                      />
                      <div className="chat-edit-actions">
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                        <button type="button" onClick={() => saveEdit(msg.id)}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {msg.shared_post && (
                        <div className="chat-shared-post">
                          <PostCard post={msg.shared_post} />
                        </div>
                      )}
                      {msg.image && <img src={msg.image} alt="Shared" className="chat-image" />}
                      {msg.text && <p className="chat-text">{msg.text}</p>}
                      {msg.is_edited && <span className="chat-edited-label">edited</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {imageFile && (
          <div className="chat-image-preview">
            <img src={URL.createObjectURL(imageFile)} alt="Preview" />
            <button type="button" onClick={() => setImageFile(null)}>
              ×
            </button>
          </div>
        )}

        <div className="chat-input-row">
          <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <textarea
            className="chat-input"
            placeholder="Write a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          <button
            type="button"
            className="chat-send-btn"
            onClick={handleSend}
            disabled={sending || (!text.trim() && !imageFile)}
          >
            Send
          </button>
        </div>
      </div>

      {pendingDeleteId !== null && (
        <ConfirmModal
          message="Delete this message?"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </>
  );
}

export default ChatWindow;