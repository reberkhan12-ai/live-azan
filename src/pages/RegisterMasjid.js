import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase"; // Make sure this imports your Firebase auth

export default function RegisterMasjid() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const userEmail = state?.userEmail || state?.email || null;

  const [masjidName, setMasjidName] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pincodeValid, setPincodeValid] = useState(false);

  useEffect(() => {
    if (!userEmail) {
      alert("User email missing. Please register again.");
      navigate("/register");
    }
  }, [userEmail, navigate]);

  const handlePincodeChange = async (e) => {
    const pin = e.target.value.trim();
    setPincode(pin);
    setCity("");
    setStateName("");
    setPincodeValid(false);

    if (pin.length === 6) {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (data[0].Status === "Success" && data[0].PostOffice.length > 0) {
          const postOffice = data[0].PostOffice[0];
          setCity(postOffice.District);
          setStateName(postOffice.State);
          setPincodeValid(true);
        } else {
          setPincodeValid(false);
          alert("Invalid Pincode. Please enter a correct Indian Pincode.");
        }
      } catch (err) {
        console.error("Error fetching city/state:", err);
        setPincodeValid(false);
        alert("Error verifying Pincode. Try again later.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!pincodeValid) {
      alert("Please enter a valid Pincode before submitting.");
      return;
    }

    if (!masjidName || !address) {
      alert("Please fill all required fields.");
      return;
    }

    setLoading(true);

    try {
      // ✅ Get Firebase token
      const idToken = await auth.currentUser.getIdToken();

      const masjidData = {
        userEmail,
        masjidName,
        address,
        city,
        state: stateName,
        pincode,
      };

      const res = await fetch("http://127.0.0.1:5000/api/masjid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`, // ✅ send token
        },
        body: JSON.stringify(masjidData),
      });

      const data = await res.json();

      if (data.success) {
        alert(`Masjid registered successfully!\nMasjid ID: ${data.masjidId}`);
        navigate("/imam-dashboard", { state: { userEmail, masjidId: data.masjidId } });
      } else if (data.masjidRegistered && data.masjidId) {
        alert(`Masjid already registered for this Imam.\nMasjid ID: ${data.masjidId}`);
        navigate("/imam-dashboard", { state: { userEmail, masjidId: data.masjidId } });
      } else {
        alert("Failed to register Masjid: " + data.message);
      }
    } catch (err) {
      console.error("Error registering Masjid:", err);
      alert("An error occurred while registering Masjid. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-[#0a1a2f] via-[#1e2746] to-[#2c3e50] flex flex-col items-center justify-center overflow-hidden text-white px-6 pt-16">
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg width="100%" height="100%" viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 w-full h-40 opacity-30">
          <path fill="#00bcd4" fillOpacity="0.2" d="M0,160L60,165.3C120,171,240,181,360,165.3C480,149,600,107,720,117.3C840,128,960,192,1080,218.7C1200,245,1320,235,1380,229.3L1440,224L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"></path>
        </svg>
      </div>

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

      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full max-w-md">
        <h1 className="text-3xl md:text-4xl font-extrabold text-cyan-300 mb-10 animate-pulse leading-tight">
          Register Masjid
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full">
          <input
            type="text"
            placeholder="Masjid Name"
            value={masjidName}
            onChange={(e) => setMasjidName(e.target.value)}
            className="p-3 rounded-lg bg-gray-800 placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            required
          />

          <input
            type="text"
            placeholder="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="p-3 rounded-lg bg-gray-800 placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            required
          />

          <input
            type="text"
            placeholder="Pincode"
            value={pincode}
            onChange={handlePincodeChange}
            className="p-3 rounded-lg bg-gray-800 placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            required
          />

          <input
            type="text"
            placeholder="City"
            value={city}
            readOnly
            className="p-3 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />

          <input
            type="text"
            placeholder="State"
            value={stateName}
            readOnly
            className="p-3 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />

          <button
            type="submit"
            disabled={loading || !pincodeValid}
            className={`py-3 rounded-full bg-cyan-500 hover:bg-cyan-600 font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 ${
              loading || !pincodeValid ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Submitting..." : "Submit Masjid"}
          </button>
        </form>
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