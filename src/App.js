import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Connect from "./pages/Connect";
import LearnMore from "./pages/LearnMore";
import RegisterMasjid from "./pages/RegisterMasjid";
import ImamDashboard from "./pages/ImamDashboard";
import SearchMasjid from "./pages/SearchMasjid";
import MominDashboard from "./pages/MominDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/connect" element={<Connect />} />
      <Route path="/learn-more" element={<LearnMore />} />
      <Route path="/register-masjid" element={<RegisterMasjid />} />
      <Route path="/imam-dashboard" element={<ImamDashboard />} />
      <Route path="/search-masjid" element={<SearchMasjid />} />
      <Route path="/momin-dashboard" element={<MominDashboard />} />
    </Routes>
  );
}