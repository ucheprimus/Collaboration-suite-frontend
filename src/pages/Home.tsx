import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="vh-100 d-flex flex-column justify-content-center align-items-center bg-light">
      <h1 className="display-4 mb-4">Welcome to Our Demo App 🚀</h1>
      <p className="mb-4 text-center">
        This is a demo landing page for our chat & video conferencing app.
      </p>

      <div className="d-flex gap-3">
        <Link to="/login" className="btn btn-primary btn-lg">
          Login
        </Link>
        <Link to="/signup" className="btn btn-success btn-lg">
          Signup
        </Link>
      </div>
    </div>
  );
}
