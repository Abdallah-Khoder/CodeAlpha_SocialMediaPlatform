import { useState } from "react";
import Navbar from "../components/Navbar";
import CreatePost from "../components/CreatePost";
import Feed from "../components/Feed";
import Sidebar from "../components/Sidebar";
import SectionFeed from "../components/SectionFeed";
import SuggestedUsers from "../components/SuggestedUsers";
import StoriesBar from "../components/StoriesBar";
import "../styles/home.css";
import "../styles/pageTransition.css"; 

function Home() {
  // Holds the most recently created post so Feed can show it right away
  const [newPost, setNewPost] = useState(null);

  // null = normal feed, otherwise "saved" | "liked" | "commented" | "shared"
  const [activeSection, setActiveSection] = useState(null);

  return (
    <div className="page-fade-in">
      <Navbar />

      <div className="home-layout">
        <Sidebar activeSection={activeSection} onSelectSection={setActiveSection} />

        <div className="home-main">
          {activeSection === null ? (
            <>
              <StoriesBar />
              <CreatePost onPostCreated={(post) => setNewPost(post)} />
              <Feed newPost={newPost} />
            </>
          ) : (
            <SectionFeed section={activeSection} />
          )}
        </div>

        {/* Right sidebar */}
        <div className="home-sidebar-right">
          <SuggestedUsers />
        </div>
      </div>
    </div>
  );
}

export default Home;