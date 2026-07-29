import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

function Signup() {
  const { saveAuth } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccessMsg("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(data.message);
        saveAuth(data);

        setTimeout(() => {
          navigate("/home");
        }, 800);
      } else {
        setErrors(data);
      }
    } catch (err) {
      setErrors({ general: ["Something went wrong. Please try again."] });
    } finally {
      setLoading(false);
    }
  };

  return (
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

        <h2>Create your account</h2>
        <p className="tagline">Join the vibe. It only takes a minute.</p>

        {successMsg && <p className="success-message">{successMsg}</p>}

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
            {errors.username && (
              <span className="error-message">{errors.username[0]}</span>
            )}
          </div>

          <div className="form-group">
            <label>First Name</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
            {errors.first_name && (
              <span className="error-message">{errors.first_name[0]}</span>
            )}
          </div>

          <div className="form-group">
            <label>Last Name</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
            {errors.last_name && (
              <span className="error-message">{errors.last_name[0]}</span>
            )}
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
            {errors.password && (
              <span className="error-message">{errors.password[0]}</span>
            )}
          </div>

          {errors.general && (
            <span className="error-message">{errors.general[0]}</span>
          )}

          <button className="signup-button" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Signup;