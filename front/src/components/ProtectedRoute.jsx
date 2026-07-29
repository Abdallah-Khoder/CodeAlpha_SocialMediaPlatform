import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Still checking if there's a valid saved session -> don't redirect yet
  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "40px" }}>Loading...</p>;
  }

  // Finished checking, and no logged-in user found -> send to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is logged in -> show the actual page
  return children;
}

export default ProtectedRoute;