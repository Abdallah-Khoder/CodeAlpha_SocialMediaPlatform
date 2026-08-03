import { useState } from "react";
import "../styles/confirmModal.css";

function ConfirmModal({ message, onConfirm, onCancel }) {
  const [remember, setRemember] = useState(false);

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-modal-message">{message}</p>

        <label className="confirm-modal-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Don't ask me again
        </label>

        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="confirm-modal-confirm"
            onClick={() => onConfirm(remember)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;