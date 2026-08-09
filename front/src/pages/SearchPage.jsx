import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFollow } from "../context/FollowContext";
import Navbar from "../components/Navbar";
import PostCard from "../components/PostCard";
import "../styles/searchPage.css";

const API_BASE = "http://127.0.0.1:8000";
const TABS = ["profile", "posts"];

function SearchPage() {
  const { token } = useAuth();
  const { getFollowStatus, toggleFollow } = useFollow();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get("q") || "";
  const initialTab = TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "profile";

  const [inputValue, setInputValue] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    const params = {};
    if (inputValue) params.q = inputValue;
    if (activeTab !== "profile") params.tab = activeTab;
    setSearchParams(params, { replace: true });
  }, [inputValue, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = useCallback(
    async (query) => {
      if (!query.trim()) {
        setUsers([]);
        setPosts([]);
        return;
      }

      setLoading(true);
      try {
        if (activeTab === "profile") {
          const res = await fetch(
            `${API_BASE}/api/search/users/?q=${encodeURIComponent(query)}`,
            { headers: { Authorization: `Token ${token}` } }
          );
          const data = await res.json();
          setUsers(data.results || data);
        } else if (activeTab === "posts") {
          const res = await fetch(
            `${API_BASE}/api/search/posts/?q=${encodeURIComponent(query)}`,
            { headers: { Authorization: `Token ${token}` } }
          );
          const data = await res.json();
          setPosts(data.results || data);
        }
      } finally {
        setLoading(false);
      }
    },
    [activeTab, token]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(inputValue), 300);
    return () => clearTimeout(debounceRef.current);
  }, [inputValue, activeTab, runSearch]);

  return (
    <div>
      <Navbar />
      <div className="search-page">
        <input
          type="text"
          className="search-page-input"
          placeholder="Search Vibely..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          autoFocus
        />

        <div className="search-page-tabs">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab}
              className={`search-page-tab ${activeTab === tab ? "search-page-tab-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "profile" ? "Profile" : "Posts"}
            </button>
          ))}
        </div>

        <div className="search-page-results">
          {!inputValue.trim() ? (
            <div className="search-page-status">Start typing to search Vibely.</div>
          ) : loading ? (
            <div className="search-page-status">Searching...</div>
          ) : activeTab === "profile" ? (
            users.length === 0 ? (
              <div className="search-page-status">No people found.</div>
            ) : (
              <div className="search-page-user-list">
                {users.map((person) => {
                  const firstLetter = person.username?.charAt(0)?.toUpperCase() || "?";
                  const isFollowing = getFollowStatus(person.username, person.is_following);

                  return (
                    <div className="search-page-user-item" key={person.id}>
                      <Link to={`/profile/${person.username}`} className="search-page-user-link">
                        {person.profile_picture ? (
                          <img src={person.profile_picture} alt={person.username} />
                        ) : (
                          <div className="search-page-user-avatar-letter">{firstLetter}</div>
                        )}
                        <span className="search-page-user-username">{person.username}</span>
                      </Link>

                      {!isFollowing && (
                        <button
                          type="button"
                          className="search-page-follow-btn"
                          onClick={() => toggleFollow(person.username, isFollowing)}
                        >
                          Follow
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : posts.length === 0 ? (
            <div className="search-page-status">No posts found.</div>
          ) : (
            <div className="search-page-post-list">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPage;