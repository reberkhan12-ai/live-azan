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
  const streamWsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  const API_URL = "https://redesigned-barnacle-x5gxrwwq76prhpvpj-5000.app.github.dev"; // backend base URL

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
        const serverMsg = err?.response?.data?.message || null;
        // If token invalid/expired, force re-login
        if (err?.response?.status === 401) {
          alert("Session expired or unauthorized. Please login again.");
          localStorage.removeItem("user");
          navigate("/register");
          return;
        }
        setStatus(serverMsg || "Failed to fetch Masjid info");
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

  // --- Live voice streaming (capture mic and send binary chunks) ---
  const getWsProtocol = (baseUrl) => {
    if (baseUrl.startsWith("https://")) return baseUrl.replace(/^https:/, "wss:");
    if (baseUrl.startsWith("http://")) return baseUrl.replace(/^http:/, "ws:");
    return baseUrl;
  };

  const startStreaming = async () => {
    if (!masjidId) return alert("Masjid ID missing.");
    if (!token) return alert("Not authenticated.");

    // Configurable params
    const TARGET_SAMPLE_RATE = 16000; // desired output sample rate (Hz) — changeable
    const CHUNK_MS = 100; // ~100ms chunks — changeable

    try {
      setStreamStatus("Initializing microphone (PCM capture)...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // create stream websocket
      const wsUrl = `${getWsProtocol(API_URL)}/ws`;
      const sWs = new WebSocket(wsUrl);
      streamWsRef.current = sWs;
      sWs.binaryType = "arraybuffer";

      // audio capture using WebAudio (ScriptProcessor fallback)
      let audioCtx;
      let sourceNode;
      let processorNode;
      let recordedBuffer = [];
      let recordedSamples = 0;

      // helper: downsample Float32 [-1..1] to target sample rate
      function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
        if (outputSampleRate === inputSampleRate) return buffer;
        const sampleRateRatio = inputSampleRate / outputSampleRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
          const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
          // average the samples between offsetBuffer and nextOffsetBuffer
          let accum = 0, count = 0;
          for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
          }
          result[offsetResult] = count > 0 ? accum / count : 0;
          offsetResult++;
          offsetBuffer = nextOffsetBuffer;
        }
        return result;
      }

      // helper: convert Float32Array to Int16 LE ArrayBuffer
      function floatTo16BitPCM(float32Array) {
        const l = float32Array.length;
        const buffer = new ArrayBuffer(l * 2);
        const view = new DataView(buffer);
        let offset = 0;
        for (let i = 0; i < l; i++, offset += 2) {
          let s = Math.max(-1, Math.min(1, float32Array[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
        }
        return buffer;
      }

      sWs.onopen = () => {
        console.log("Stream WS open");
        const payload = { type: "stream-register", masjidId, role: "streamer", token };
        sWs.send(JSON.stringify(payload));
        setStreamStatus("Connected to stream server. Starting PCM capture...");

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioCtx.createMediaStreamSource(stream);

        // Buffer size: smaller = lower latency, but higher CPU. 2048 is a balance.
        const BUFFER_SIZE = 2048;
        processorNode = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);

        const inputSampleRate = audioCtx.sampleRate;
        const samplesPerChunk = Math.floor((TARGET_SAMPLE_RATE * CHUNK_MS) / 1000);

        processorNode.onaudioprocess = (audioProcessingEvent) => {
          const inputBuffer = audioProcessingEvent.inputBuffer.getChannelData(0);

          // downsample to target sample rate
          const down = downsampleBuffer(inputBuffer, inputSampleRate, TARGET_SAMPLE_RATE);
          recordedBuffer.push(down);
          recordedSamples += down.length;

          // if we have enough samples for one chunk, send
          while (recordedSamples >= samplesPerChunk) {
            // concat pieces into one Float32Array of length samplesPerChunk
            const out = new Float32Array(samplesPerChunk);
            let offset = 0;
            while (offset < samplesPerChunk) {
              const chunk = recordedBuffer[0];
              const take = Math.min(chunk.length, samplesPerChunk - offset);
              out.set(chunk.subarray(0, take), offset);
              offset += take;
              if (take < chunk.length) {
                recordedBuffer[0] = chunk.subarray(take);
              } else {
                recordedBuffer.shift();
              }
            }
            recordedSamples -= samplesPerChunk;

            // convert to Int16 LE and send
            const ab = floatTo16BitPCM(out);
            if (sWs.readyState === WebSocket.OPEN) {
              sWs.send(ab);
            }
          }
        };

        sourceNode.connect(processorNode);
        processorNode.connect(audioCtx.destination); // connect to output to keep processing alive

        mediaRecorderRef.current = { audioCtx, sourceNode, processorNode, stream };
        setStreaming(true);
        setStreamStatus('Streaming PCM audio');
      };

      sWs.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (d.type === 'presence-update') {
            // update device lists and counts
            setAllDeviceIds(d.onlineDevices || []);
            // optionally mark devices online/offline map
            const newDevices = {};
            (d.onlineDevices || []).forEach(id => { newDevices[id] = 'online'; });
            setDevices(prev => ({ ...prev, ...newDevices }));
            setStatus(`Online ${d.online || 0} / Total ${d.total || 0}`);
          } else if (d.type === 'ack') {
            setStreamStatus(d.message || 'Streamer acked');
          }
        } catch (e) { /* ignore non-JSON */ }
      };

      sWs.onerror = (err) => {
        console.error('Stream WS error', err);
        setStreamStatus('Stream WS error');
      };

      sWs.onclose = () => {
        setStreaming(false);
        setStreamStatus('Stream connection closed');
        try {
          if (mediaRecorderRef.current) {
            const { audioCtx, processorNode, sourceNode, stream } = mediaRecorderRef.current;
            try { processorNode.disconnect(); } catch(e){}
            try { sourceNode.disconnect(); } catch(e){}
            try { audioCtx.close(); } catch(e){}
            try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
          }
        } catch(e){}
      };
    } catch (err) {
      console.error('Start streaming failed', err);
      alert('Failed to start microphone. Allow mic permission and try again.');
      setStreamStatus('Failed to start streaming');
    }
  };

  const stopStreaming = () => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') mr.stop();
    } catch (e) { console.warn(e); }
    try {
      if (streamWsRef.current && streamWsRef.current.readyState === WebSocket.OPEN) streamWsRef.current.close();
    } catch (e) { console.warn(e); }
    setStreaming(false);
    setStreamStatus('Stopped');
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