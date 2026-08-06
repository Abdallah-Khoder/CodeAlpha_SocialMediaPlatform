import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/navbar.css";

function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setHidden(true); // scrolling down -> hide
      } else {
        setHidden(false); // scrolling up -> show
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className={`navbar ${hidden ? "navbar-hidden" : ""}`}>
      <Link to="/home" className="navbar-brand">
        Vibely
      </Link>
      <div className="navbar-icons">
        <Link to="/home" className="navbar-home-link" aria-label="Home">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        </Link>

        <Link to="/messages" className="navbar-home-link" aria-label="Messages">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </Link>
      </div>

      <button className="navbar-logout" onClick={handleLogout}>
        Logout
      </button>
    </nav>
  );
}

export default Navbar;
