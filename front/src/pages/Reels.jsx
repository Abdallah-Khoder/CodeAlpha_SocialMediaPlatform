import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ReelCard from "../components/ReelCard";
import "../styles/reels.css";
import "../styles/pageTransition.css";

const API_BASE = "http://127.0.0.1:8000";
const PREFETCH_LOOKAHEAD = 3;

function Reels() {
  const { token } = useAuth();
  const [reels, setReels] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [navHidden, setNavHidden] = useState(false);

  const observerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const loadFirstPage = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/reels/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const data = await res.json();
        setReels(data.results);
        setNextUrl(data.next);
      } finally {
        setLoading(false);
      }
    };
    loadFirstPage();
  }, [token]);

  const loadMore = useCallback(async () => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(nextUrl, { headers: { Authorization: `Token ${token}` } });
      const data = await res.json();
      setReels((prev) => [...prev, ...data.results]);
      setNextUrl(data.next);
    } finally {
      setLoadingMore(false);
    }
  }, [nextUrl, loadingMore, token]);

  const sentinelRef = useCallback(
    (node) => {
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) loadMore();
      });
      if (node) observerRef.current.observe(node);
    },
    [loadMore]
  );

  const handleContainerScroll = (e) => {
    const currentTop = e.target.scrollTop;
    const goingDown = currentTop > lastScrollTopRef.current && currentTop > 80;
    lastScrollTopRef.current = currentTop;

    // Drives the reels page's own layout (grows to fill the space the
    // Navbar just vacated) AND tells the shared Navbar to hide/show
    setNavHidden(goingDown);
    window.dispatchEvent(new CustomEvent("app-scroll", { detail: { hidden: goingDown } }));
  };

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("app-scroll", { detail: { hidden: false } }));
    };
  }, []);

  const sentinelIndex = Math.max(reels.length - PREFETCH_LOOKAHEAD, 0);

  return (
    <div className="page-fade-in reels-root">
      <Navbar />
      <div className={`reels-page ${navHidden ? "reels-page-full" : ""}`}>
        {loading ? (
          <div className="reels-status">Loading reels...</div>
        ) : reels.length === 0 ? (
          <div className="reels-status">No reels yet.</div>
        ) : (
          <div
            className="reels-scroll-container"
            ref={scrollContainerRef}
            onScroll={handleContainerScroll}
          >
            {reels.map((post, index) => (
              <div ref={index === sentinelIndex ? sentinelRef : null} key={post.id}>
                <ReelCard post={post} isMuted={isMuted} onToggleMute={() => setIsMuted((prev) => !prev)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Reels;