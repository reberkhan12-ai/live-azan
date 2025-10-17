import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

export default function MominDashboard() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const stored = JSON.parse(localStorage.getItem("user") || "null");
  const userEmail = state?.userEmail || state?.email || stored?.userEmail || null;
  const userName = state?.name || stored?.name || "Momin";

  const API_BASE = "https://redesigned-barnacle-x5gxrwwq76prhpvpj-5000.app.github.dev/api"; // backend URL

  const [masjid, setMasjid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [deviceInput, setDeviceInput] = useState("");
  const [deviceLoading, setDeviceLoading] = useState(false);

  useEffect(() => {
    if (!userEmail) {
      alert("User info missing. Please login again.");
      navigate("/register");
      return;
    }
    setLoading(true);

    axios.get(`${API_BASE}/users`)
      .then(res => {
        const user = res.data.find(u => u.email === userEmail && u.role === "Momin");
        if (user) {
          setDeviceId(user.deviceId || "");
          setDeviceInput(user.deviceId || "");
          if (user.masjidId) {
            axios.get(`${API_BASE}/masjids`)
              .then(mres => {
                const m = mres.data.find(masjid => masjid.masjidId === user.masjidId);
                setMasjid(m);
                setLoading(false);
              })
              .catch(() => setLoading(false));
          } else {
            setMasjid(null);
            setLoading(false);
          }
        }
      })
      .catch(() => setLoading(false));
  }, [userEmail]);

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/disconnect-masjid`, { email: userEmail });
      setMasjid(null);
      alert("Disconnected from masjid.");
    } catch (err) {
      alert("Failed to disconnect.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceSave = async () => {
    if (!deviceInput.trim()) {
      alert("Please enter a valid device ID.");
      return;
    }
    setDeviceLoading(true);
    try {
      await axios.post(`${API_BASE}/register-device`, { email: userEmail, deviceId: deviceInput.trim() });
      setDeviceId(deviceInput.trim());
      alert("Device ID saved!");
    } catch (err) {
      alert("Failed to save device ID.");
    } finally {
      setDeviceLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-[#0a1a2f] via-[#1e2746] to-[#2c3e50] flex flex-col items-center justify-start overflow-hidden text-white px-6 pt-16">
      {/* Ornamental background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg width="100%" height="100%" viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 w-full h-40 opacity-30">
          <path fill="#00bcd4" fillOpacity="0.2" d="M0,160L60,165.3C120,171,240,181,360,165.3C480,149,600,107,720,117.3C840,128,960,192,1080,218.7C1200,245,1320,235,1380,229.3L1440,224L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"></path>
        </svg>
      </div>
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden z-0">
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
      <div className="relative z-10 flex flex-col items-center justify-start text-center w-full max-w-lg">
        {/* Profile */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-cyan-400 mb-4 shadow-lg bg-white">
            <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="Momin Profile" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-cyan-300 mb-2 tracking-wide" style={{ fontFamily: 'Noto Naskh Arabic, serif' }}>
            السلام عليكم
          </h1>
          <h2 className="text-xl md:text-2xl font-bold text-cyan-200 mb-1">Welcome, {userName}!</h2>
          <p className="text-gray-300 mt-2 text-sm">Email: {userEmail}</p>
        </div>

        {/* Device ID */}
        <div className="bg-black/30 rounded-xl px-6 py-4 shadow-lg border border-cyan-700 mb-6">
          <h2 className="text-lg font-bold text-cyan-200 mb-2">Your Device ID</h2>
          <input
            type="text"
            value={deviceInput}
            onChange={e => setDeviceInput(e.target.value)}
            placeholder="Enter your ESP32 Device ID"
            className="w-full p-3 rounded-lg bg-gray-800 placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 mb-3"
            disabled={deviceLoading}
          />
          <button
            onClick={handleDeviceSave}
            disabled={deviceLoading}
            className="py-2 px-6 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold shadow transition-all duration-300"
          >
            {deviceLoading ? "Saving..." : "Save Device ID"}
          </button>
          {deviceId && <p className="mt-3 text-cyan-300 text-sm">Current Device ID: <span className="font-bold">{deviceId}</span></p>}
        </div>

        {/* Masjid connection */}
        {loading ? (
          <div className="text-cyan-300">Loading...</div>
        ) : masjid ? (
          <div className="bg-black/30 rounded-xl px-6 py-4 shadow-lg border border-cyan-700 mt-4">
            <h2 className="text-lg font-bold text-cyan-200 mb-1">Connected to: {masjid.masjidName}</h2>
            <p className="text-gray-300 text-sm mb-1">{masjid.address}</p>
            <p className="text-gray-400 text-sm">{masjid.city}, {masjid.state} - {masjid.pincode}</p>
            <button
              className="mt-3 py-2 px-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold shadow transition-all duration-300"
              onClick={handleDisconnect}
              disabled={loading}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="bg-black/30 rounded-xl px-6 py-4 shadow-lg border border-cyan-700 mt-4">
            <h2 className="text-lg font-bold text-cyan-200 mb-1">No masjid connected.</h2>
            <button
              className="mt-3 py-2 px-4 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold shadow transition-all duration-300"
              onClick={() => navigate("/search-masjid", { state: { userEmail } })}
            >
              Search & Connect Masjid
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col w-full space-y-4 mt-4">
          <button
            onClick={() => navigate("/search-masjid", { state: { userEmail } })}
            className="w-full py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-semibold shadow-xl transition-all duration-300 transform hover:scale-105 text-lg"
          >
            Search Masjid
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3 rounded-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 font-semibold shadow-xl transition-all duration-300 transform hover:scale-105 text-lg"
          >
            Logout
          </button>
        </div>

        {/* Quote */}
        <div className="mt-10 text-cyan-200 italic text-md md:text-lg bg-black/30 rounded-xl px-6 py-4 shadow-lg border border-cyan-700">
          <span className="block mb-2">“The mosques of Allah are only to be maintained by those who believe in Allah and the Last Day...”</span>
          <span className="block text-right">– Quran 9:18</span>
        </div>
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