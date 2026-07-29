import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

function Login() {
  const { saveAuth } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        saveAuth(data);
        navigate("/home");
      } else {
        setErrorMsg(data.error || "Login failed. Please try again.");
      }
    } catch (err) {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Reusing the exact same class names as Signup.jsx (signup-page, signup-card...)
    // so it picks up the same styles from the shared auth.css file
    <div className="signup-page">
      <svg className="floral floral-top" viewBox="0 0 200 200" fill="none">
        <path d="M20 180 C 40 140, 30 100, 60 70 C 80 50, 100 55, 110 40"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="65" cy="68" rx="10" ry="6" stroke="currentColor" strokeWidth="1.5" transform="rotate(-30 65 68)" />
        <ellipse cx="85" cy="55" rx="9" ry="5" stroke="currentColor" strokeWidth="1.5" transform="rotate(-10 85 55)" />
        <ellipse cx="108" cy="42" rx="8" ry="5" stroke="currentColor" strokeWidth="1.5" transform="rotate(20 108 42)" />
        <circle cx="112" cy="38" r="4" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <svg className="floral floral-bottom" viewBox="0 0 200 200" fill="none">
        <path d="M180 20 C 160 60, 170 100, 140 130 C 120 150, 100 145, 90 160"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="135" cy="132" rx="10" ry="6" stroke="currentColor" strokeWidth="1.5" transform="rotate(150 135 132)" />
        <ellipse cx="115" cy="145" rx="9" ry="5" stroke="currentColor" strokeWidth="1.5" transform="rotate(170 115 145)" />
        <ellipse cx="92" cy="158" rx="8" ry="5" stroke="currentColor" strokeWidth="1.5" transform="rotate(200 92 158)" />
        <circle cx="88" cy="162" r="4" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <div className="signup-card">
        <div className="brand-mark">
          <span className="brand-dot"></span>
          Vibely
        </div>

        <h2>Welcome back</h2>
        <p className="tagline">Log in to keep the vibe going.</p>

        {errorMsg && <p className="error-banner">{errorMsg}</p>}

        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button className="signup-button" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;