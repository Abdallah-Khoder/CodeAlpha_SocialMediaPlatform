import Navbar from "../components/Navbar";

function Home() {
  return (
    <div>
      <Navbar />
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Welcome to Vibely 🎉</h1>
        <p>You are logged in.</p>
      </div>
    </div>
  );
}

export default Home;