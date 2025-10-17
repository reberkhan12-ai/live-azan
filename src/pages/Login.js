import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { auth, provider, signInWithPopup } from "../firebase";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Ensure we request email scope and force account selection
      provider.addScope("email");
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // ✅ Get Firebase ID token
      const token = await user.getIdToken();

      // Call backend to check if user exists and get role
      const userEmail = user.email || user.providerData?.[0]?.email || null;
      if (!userEmail) {
        alert("Unable to get email from Google account. Please try another account or enable email access.");
        setLoading(false);
        return;
      }

      const res = await axios.post(
        "https://redesigned-barnacle-x5gxrwwq76prhpvpj-5000.app.github.dev/api/auth/check-user",
        { email: userEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data;

      if (data.success) {
        // Save user info locally for downstream pages
        localStorage.setItem(
          "user",
          JSON.stringify({ userEmail, name: user.displayName, role: data.role || "Momin", token })
        );
        console.log("💾 User saved to localStorage (login):", { userEmail, name: user.displayName, role: data.role });
        
        // ✅ Redirect based on role
        if (data.role === "Imam") {
          if (data.masjidRegistered) {
            navigate("/imam-dashboard", { state: { userEmail, name: user.displayName } });
          } else {
            navigate("/register-masjid", { state: { userEmail, name: user.displayName } });
          }
        } else if (data.role === "Momin") {
          navigate("/momin-dashboard", { state: { userEmail, name: user.displayName } });
        }
      } else {
        // User not found → redirect to register
        alert("No account found. Please register first.");
        navigate("/register");
      }
    } catch (err) {
      console.error("Google Login Error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        alert("Popup closed before completing sign-in.");
      } else if (err.code === "auth/cancelled-popup-request") {
        alert("Previous popup request in progress. Try again.");
      } else {
        alert("Login failed. Check console for details.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-dvh w-full bg-gradient-to-b from-[#000822] via-[#010f3f] to-[#021a5e] flex flex-col items-center justify-center overflow-hidden text-white px-6">
      {/* Background glow */}
      <div className="absolute inset-0 animate-pulse opacity-30 bg-[radial-gradient(circle_at_30%_30%,rgba(0,255,255,0.3),transparent_60%)]"></div>

      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(60)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-70"
            style={{
              width: Math.random() * 2 + "px",
              height: Math.random() * 2 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              background: `hsl(${Math.random() * 360}, 70%, 80%)`,
              animation: `twinkle ${2 + Math.random() * 3}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full max-w-sm">
        <h1 className="text-3xl md:text-4xl font-extrabold text-cyan-300 drop-shadow-lg mb-8 animate-pulse leading-tight">
          Login to Munova
        </h1>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className={`flex items-center justify-center space-x-3 w-full py-3 rounded-full bg-white text-gray-800 hover:bg-gray-100 font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google Icon"
            className="w-5 h-5"
          />
          <span>{loading ? "Processing..." : "Continue with Google"}</span>
        </button>

        <p className="mt-8 text-sm text-blue-200">
          Don’t have an account?{" "}
          <button
            onClick={() => navigate("/register")}
            className="text-cyan-400 underline hover:text-cyan-300 transition duration-300"
          >
            Register
          </button>
        </p>

        <button
          onClick={() => navigate("/")}
          className="mt-6 text-sm text-gray-400 hover:text-gray-200 transition duration-300 underline"
        >
          ← Back to Home
        </button>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}