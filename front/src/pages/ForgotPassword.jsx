import { API_BASE } from "../config";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/auth.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/forgot-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        navigate("/reset-password", { state: { email } });
      } else {
        setError(data.error || "Something went wrong.");
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

        <h2>Forgot your password?</h2>
        <p className="tagline">Enter your email and we'll send you a reset code.</p>

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <button className="signup-button" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send reset code"}
          </button>
        </form>

        <p className="auth-switch-text">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;