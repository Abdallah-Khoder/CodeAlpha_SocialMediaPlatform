import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  // Still checking saved session -> don't redirect yet
  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "40px" }}>Loading...</p>;
  }

  // Already logged in -> no need to see Login/Signup again, go to Home
  if (user) {
    return <Navigate to="/home" replace />;
  }

  // Guest -> show the login/signup page normally
  return children;
}

export default PublicRoute;