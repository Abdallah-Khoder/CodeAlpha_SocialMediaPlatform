import { API_BASE } from "../config";
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

function VerifyEmail() {
  const { saveAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const username = location.state?.username || "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  if (!username) {
    navigate("/signup");
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/verify-email/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code }),
      });

      const data = await response.json();

      if (response.ok) {
        saveAuth(data);
        navigate("/home");
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResendMsg("");
    setResending(true);

    try {
      const response = await fetch(`${API_BASE}/api/resend-code/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendMsg(data.message);
      } else {
        setError(data.error || "Could not resend code.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <div className="brand-mark">
          <span className="brand-dot"></span>
          Vibely
        </div>

        <h2>Verify your email</h2>
        <p className="tagline">
          We sent a 6-digit code to your email. Enter it below.
        </p>

        {resendMsg && <p className="success-message">{resendMsg}</p>}

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Verification Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <button className="signup-button" type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <p className="auth-switch-text">
          Didn't get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0 }}
          >
            {resending ? "Sending..." : "Resend code"}
          </button>
        </p>

        <p className="auth-switch-text">
          <Link to="/signup">Back to signup</Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyEmail;