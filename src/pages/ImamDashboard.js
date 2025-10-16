import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ImamDashboard() {
  const navigate = useNavigate();

  // Helper to get user from localStorage
  const getUserFromStorage = () => JSON.parse(localStorage.getItem("user") || "{}");
  const { userEmail, name: userName = "Molana", role: userRole = "Imam", token } = getUserFromStorage();

  const [masjidId, setMasjidId] = useState(null);
  const [masjidName, setMasjidName] = useState("");
  const [allDeviceIds, setAllDeviceIds] = useState([]);
  const [devices, setDevices] = useState({});
  const [totalMomin, setTotalMomin] = useState(0);
  const [status, setStatus] = useState("");

  const wsRef = useRef(null);
  const API_URL = "http://127.0.0.1:5000"; // replace with your backend URL

  // Redirect if user info missing or role invalid
  useEffect(() => {
    if (!userEmail || !token) {
      navigate("/register");
      return;
    }
    if (userRole !== "Imam") {
      alert("Access denied. Only Imam can access this dashboard.");
      navigate("/register");
      return;
    }
  }, [userEmail, userRole, token, navigate]);

  // Fetch Masjid info and total Momins
  useEffect(() => {
    const fetchMasjid = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/masjid/${userEmail}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success && res.data.masjid) {
          const masjid = res.data.masjid;
          setMasjidId(masjid.masjidId);
          setMasjidName(masjid.masjidName);
          setAllDeviceIds(masjid.devices || []);

          // Fetch total Momins
          const mominRes = await axios.get(`${API_URL}/api/masjid/momins/${masjid.masjidId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setTotalMomin(mominRes.data.totalMomin || 0);
        } else {
          setStatus("No Masjid found.");
        }
      } catch (err) {
        console.error("Error fetching masjid info:", err);
        setStatus("Failed to fetch Masjid info");
      }
    };

    if (userEmail && token) fetchMasjid();
  }, [userEmail, token]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!masjidId) return;

    const ws = new WebSocket(`${API_URL.replace("http", "ws")}/ws?masjidId=${masjidId}&token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      setStatus("WebSocket connected to server");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.deviceId && msg.status) {
          setDevices((prev) => ({ ...prev, [msg.deviceId]: msg.status }));
        }
      } catch (err) {
        console.error("Invalid WebSocket message:", event.data);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setStatus("WebSocket connection error");
    };

    ws.onclose = () => {
      console.warn("WebSocket disconnected. Retrying in 5s...");
      setTimeout(() => window.location.reload(), 5000);
    };

    return () => ws.close();
  }, [masjidId, token]);

  // Start Live Azan
  const handleStartAzan = async () => {
    if (!masjidId) return alert("Masjid ID missing.");
    setStatus("📡 Sending start Azan command...");
    try {
      const res = await axios.post(
        `${API_URL}/api/masjid/start-azan`,
        { masjidId, imamName: userName, imamEmail: userEmail, time: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setStatus("📢 Live Azan Started");
        alert("Live Azan broadcast sent to all devices!");
      } else {
        setStatus("Failed to start Azan");
        alert(res.data.message || "Something went wrong");
      }
    } catch (err) {
      console.error("Error starting Azan:", err);
      setStatus("Server error");
    }
  };

  // Stop Live Azan
  const handleStopAzan = async () => {
    if (!masjidId) return alert("Masjid ID missing.");
    setStatus("🛑 Sending stop Azan command...");
    try {
      const res = await axios.post(
        `${API_URL}/api/masjid/stop-azan`,
        { masjidId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setStatus("🛑 Azan stopped for all devices");
        alert("Azan stopped broadcast!");
      } else {
        setStatus("Failed to stop Azan");
        alert(res.data.message || "Something went wrong");
      }
    } catch (err) {
      console.error("Error stopping Azan:", err);
      setStatus("Server error");
    }
  };

  const onlineDevices = allDeviceIds.filter((id) => devices[id] === "online");
  const offlineDevices = allDeviceIds.filter((id) => devices[id] !== "online");
  const totalDevices = allDeviceIds.length;

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-[#071426] via-[#10223a] to-[#1c324d] flex flex-col items-center justify-start overflow-hidden text-white px-6 pt-8">
      {/* Logout */}
      <button
        onClick={() => {
          localStorage.removeItem("user");
          navigate("/register");
        }}
        className="absolute top-5 right-5 bg-red-600 hover:bg-red-700 text-white rounded-full p-3 shadow-md transition-all duration-300"
        title="Logout"
      >
        🚪
      </button>

      {/* Profile */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md text-center mt-12">
        <div className="flex flex-col items-center mb-8">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-cyan-400 mb-4 shadow-xl bg-white">
            <img
              src="https://cdn-icons-png.flaticon.com/512/149/149071.png"
              alt="Molana Profile"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-4xl font-extrabold text-cyan-300 mb-1" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>
            السلام عليكم
          </h1>
          <h2 className="text-2xl font-semibold text-cyan-200">Welcome, {userName}!</h2>
          <p className="text-gray-400 mt-2 text-sm italic">{userEmail}</p>
          {masjidId && (
            <p className="text-cyan-400 mt-2 text-sm font-bold">
              Masjid: {masjidName} ({masjidId})
            </p>
          )}
        </div>

        {/* Live Azan */}
        <div className="relative flex justify-center mb-8 space-x-4">
          <button
            onClick={handleStartAzan}
            className="w-36 h-36 rounded-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white text-xl font-bold shadow-lg transition-all duration-300"
          >
            📢 Start Azan
          </button>
          <button
            onClick={handleStopAzan}
            className="w-36 h-36 rounded-full bg-gradient-to-r from-gray-600 to-gray-800 hover:from-gray-500 hover:to-gray-700 text-white text-xl font-bold shadow-lg transition-all duration-300"
          >
            🛑 Stop Azan
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-4 gap-4 w-full max-w-md mb-8">
          <div className="bg-green-900/70 border border-green-600 rounded-xl p-4 text-center">
            <h3 className="text-green-300 font-semibold text-sm">🟢 Online</h3>
            <p className="text-green-100 text-lg font-bold mt-1">{onlineDevices.length}</p>
          </div>
          <div className="bg-red-900/70 border border-red-600 rounded-xl p-4 text-center">
            <h3 className="text-red-300 font-semibold text-sm">🔴 Offline</h3>
            <p className="text-red-100 text-lg font-bold mt-1">{offlineDevices.length}</p>
          </div>
          <div className="bg-blue-900/70 border border-blue-600 rounded-xl p-4 text-center">
            <h3 className="text-blue-300 font-semibold text-sm">👤 Total Momin</h3>
            <p className="text-blue-100 text-lg font-bold mt-1">{totalMomin}</p>
          </div>
          <div className="bg-purple-900/70 border border-purple-600 rounded-xl p-4 text-center">
            <h3 className="text-purple-300 font-semibold text-sm">📱 Total Devices</h3>
            <p className="text-purple-100 text-lg font-bold mt-1">{totalDevices}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col w-full space-y-4">
          <button
            onClick={() => navigate("/register-masjid")}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-semibold shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            🕌 Add / Edit
          </button>
          <button
            onClick={() => navigate("/reports")}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 font-semibold shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            📊 View Reports
          </button>
        </div>

        <p className="mt-6 text-cyan-300 text-sm font-medium">{status}</p>
      </div>
    </div>
  );
}