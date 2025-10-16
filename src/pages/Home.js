import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#000822] via-[#010f3f] to-[#021a5e] text-white overflow-hidden">
      
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(80)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-70"
            style={{
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              background: `hsl(${Math.random() * 360}, 70%, 80%)`,
              animation: `twinkle ${2 + Math.random() * 3}s infinite ease-in-out`
            }}
          />
        ))}
      </div>

      {/* Navbar */}
      <nav className="z-20 relative flex justify-between items-center px-6 md:px-12 py-4 bg-black/20 backdrop-blur-md">
        <h2 className="text-2xl font-bold text-cyan-300">Munova</h2>

        {/* Desktop menu */}
        <div className="hidden md:flex space-x-4">
          <button
            onClick={() => navigate("/register")}
            className="px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-600 shadow-md transition duration-300"
          >
            Register
          </button>
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-700 shadow-md transition duration-300"
          >
            Login
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-black/30 backdrop-blur-md flex flex-col items-center py-4 space-y-2 z-20">
          <button
            onClick={() => navigate("/register")}
            className="w-32 px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-600 shadow-md transition duration-300"
          >
            Register
          </button>
          <button
            onClick={() => navigate("/login")}
            className="w-32 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-700 shadow-md transition duration-300"
          >
            Login
          </button>
        </div>
      )}

      {/* Main Body */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center h-[calc(100vh-80px)] px-6">
        {/* Crescent Moon + Live Azan */}
        <div className="relative flex items-center justify-center space-x-4">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-yellow-400 rounded-full relative shadow-lg">
            <div className="absolute top-0 left-3 w-16 h-16 md:w-24 md:h-24 bg-gradient-to-r from-[#000822] via-[#010f3f] to-[#021a5e] rounded-full"></div>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-cyan-300 drop-shadow-lg animate-pulse">
            Live Azan
          </h1>
        </div>

        <p className="mt-4 text-lg md:text-xl text-blue-200 max-w-lg drop-shadow-md">
          Bringing the Azan live to every home 🌙
        </p>

        {/* Buttons */}
        <div className="mt-8 flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
          <button
            onClick={() => navigate("/register")}
            className="bg-cyan-500 hover:bg-cyan-600 px-8 py-3 rounded-full font-semibold shadow-lg transform transition duration-300 hover:scale-105"
          >
            Connect Your Device
          </button>
          <button
            onClick={() => navigate("/learn-more")}
            className="bg-gray-800 hover:bg-gray-700 px-8 py-3 rounded-full font-semibold shadow-lg transform transition duration-300 hover:scale-105"
          >
            Learn More
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 w-full z-20 bg-black/20 backdrop-blur-md py-4 text-center text-gray-400 text-sm">
        &copy; 2025 Munova. All rights reserved.
      </footer>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}