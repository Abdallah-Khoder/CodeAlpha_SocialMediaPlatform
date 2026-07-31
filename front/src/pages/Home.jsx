import { useState } from "react";
import Navbar from "../components/Navbar";
import CreatePost from "../components/CreatePost";
import Feed from "../components/Feed";

function Home() {
  // Holds the most recently created post so Feed can show it right away
  const [newPost, setNewPost] = useState(null);

  return (
    <div>
      <Navbar />
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Welcome to Vibely 🎉</h1>
      </div>
      <CreatePost onPostCreated={(post) => setNewPost(post)} />
      <Feed newPost={newPost} />
    </div>
  );
}

export default Home;