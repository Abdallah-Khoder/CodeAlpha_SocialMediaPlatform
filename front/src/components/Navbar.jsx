import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationsBell from "./NotificationsBell";
import MessagesNavLink from "./MessagesNavLink";
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
        setHidden(true);
      } else {
        setHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    const handleCustomScroll = (e) => {
      setHidden(e.detail.hidden);
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("app-scroll", handleCustomScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("app-scroll", handleCustomScroll);
    };
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

        <Link to="/search" className="navbar-home-link" aria-label="Search">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>

        <Link to="/reels" className="navbar-home-link" aria-label="Reels">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="18" rx="3" />
            <path d="M9.5 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
          </svg>
        </Link>

        <NotificationsBell />

        <MessagesNavLink />
      </div>

      <button className="navbar-logout" onClick={handleLogout}>
        Logout
      </button>
    </nav>
  );
}

export default Navbar;
