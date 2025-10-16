import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { auth, provider, signInWithPopup } from "../firebase";

export default function Register() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRoleSelect = (role) => setSelectedRole(role);

  const handleGoogleRegister = async () => {
    if (!selectedRole) {
      alert("Please select a role first!");
      return;
    }

    setLoading(true);

    try {
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Get Firebase ID token
      const idToken = await user.getIdToken();

      // Send token and selected role to backend
      const res = await axios.post(
        "http://localhost:5000/api/auth/check-user",
        { role: selectedRole },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      const data = res.data;

      if (!data.success) {
        alert(data.message || "Something went wrong. Please try again.");
        return;
      }

      // Save user info to localStorage for persistence
      localStorage.setItem(
        "user",
        JSON.stringify({
          userEmail: user.email,
          name: user.displayName,
          role: selectedRole,
          token: idToken,
        })
      );

      // Role-based navigation
      if (data.role === "Imam") {
        if (data.masjidRegistered) {
          alert("Welcome back, Imam! Redirecting to Dashboard...");
          navigate("/imam-dashboard");
        } else {
          alert("Please register your Masjid.");
          navigate("/register-masjid");
        }
      } else if (data.role === "Momin") {
        navigate("/momin-dashboard");
      }
    } catch (err) {
      console.error("Google Sign-in Error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        alert("Popup closed before completing sign-in.");
      } else if (err.code === "auth/cancelled-popup-request") {
        alert("Previous popup request in progress. Try again.");
      } else {
        alert("Google login failed. Check console for details.");
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

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full max-w-sm">
        {!selectedRole ? (
          <>
            <h1 className="text-3xl md:text-4xl font-extrabold text-cyan-300 drop-shadow-lg mb-10 animate-pulse leading-tight">
              Register with Munova
            </h1>

            <div className="flex flex-col space-y-5 w-full">
              <button
                onClick={() => handleRoleSelect("Imam")}
                className="w-full py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-base md:text-lg font-semibold shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                Register as Imam
              </button>

              <button
                onClick={() => handleRoleSelect("Momin")}
                className="w-full py-3 rounded-full bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-base md:text-lg font-semibold shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                Register as Momin
              </button>
            </div>

            <button
              onClick={() => navigate("/")}
              className="mt-10 text-sm text-blue-300 hover:text-cyan-400 transition duration-300 underline"
            >
              ← Back to Home
            </button>
          </>
        ) : (
          <>
            <h1 className="text-3xl md:text-4xl font-extrabold text-cyan-300 drop-shadow-lg mb-8 animate-pulse leading-tight">
              Register as {selectedRole}
            </h1>

            <button
              onClick={handleGoogleRegister}
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
              <span>{loading ? "Processing..." : "Register with Google"}</span>
            </button>

            <p className="mt-8 text-sm text-blue-200">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-cyan-400 underline hover:text-cyan-300 transition duration-300"
              >
                Login
              </button>
            </p>

            <button
              onClick={() => setSelectedRole(null)}
              className="mt-6 text-sm text-gray-400 hover:text-gray-200 transition duration-300 underline"
            >
              ← Choose another role
            </button>
          </>
        )}
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