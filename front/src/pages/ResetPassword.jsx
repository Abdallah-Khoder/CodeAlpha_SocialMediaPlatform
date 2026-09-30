import { API_BASE } from "../config";
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import "../styles/auth.css";

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!email) {
    navigate("/forgot-password");
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/reset-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(data.message);
        setTimeout(() => navigate("/login"), 1200);
      } else {
        setError(
          data.error ||
            (data.new_password && data.new_password[0]) ||
            "Something went wrong."
        );
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <div className="brand-mark">
          <span className="brand-dot"></span>
          Vibely
        </div>

        <h2>Reset your password</h2>
        <p className="tagline">Enter the code we sent to {email}.</p>

        {successMsg && <p className="success-message">{successMsg}</p>}

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Reset Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
            />
          </div>

          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <button className="signup-button" type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p className="auth-switch-text">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;