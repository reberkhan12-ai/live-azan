import React, { useState, useEffect } from "react";

export default function SearchMasjid() {
	const [masjids, setMasjids] = useState([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		setLoading(true);
		fetch("https://directive-wednesday-others-permalink.trycloudflare.com/api/masjids")
			.then((res) => res.json())
			.then((data) => {
				setMasjids(data);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	const filteredMasjids = masjids.filter((m) =>
		m.masjidName?.toLowerCase().includes(search.toLowerCase()) ||
		m.city?.toLowerCase().includes(search.toLowerCase()) ||
		m.state?.toLowerCase().includes(search.toLowerCase())
	);

	return (
		<div className="relative min-h-screen w-full bg-gradient-to-b from-[#0a1a2f] via-[#1e2746] to-[#2c3e50] flex flex-col items-center justify-start overflow-hidden text-white px-6 pt-16">
			{/* Ornamental Islamic pattern background */}
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
				<h1 className="text-3xl md:text-4xl font-extrabold text-cyan-300 mb-8 tracking-wide" style={{ fontFamily: 'Noto Naskh Arabic, serif' }}>
					مساجد البحث
				</h1>
				<input
					type="text"
					placeholder="Search by name, city, or state..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="w-full p-3 rounded-lg bg-gray-800 placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 mb-6"
				/>
				{loading ? (
					<div className="text-cyan-300">Loading masjids...</div>
				) : (
					<div className="w-full flex flex-col space-y-4">
						{filteredMasjids.length === 0 ? (
							<div className="text-gray-400">No masjids found.</div>
						) : (
							filteredMasjids.map((m, idx) => (
								<div key={idx} className="bg-black/30 rounded-xl px-6 py-4 shadow-lg border border-cyan-700 text-left">
									<h2 className="text-xl font-bold text-cyan-200 mb-1">{m.masjidName}</h2>
									<p className="text-gray-300 text-sm mb-1">{m.address}</p>
									<p className="text-gray-400 text-sm">{m.city}, {m.state} - {m.pincode}</p>
								</div>
							))
						)}
					</div>
				)}
				<div className="mt-10 text-cyan-200 italic text-md md:text-lg bg-black/30 rounded-xl px-6 py-4 shadow-lg border border-cyan-700">
					<span className="block mb-2">“Whoever builds a masjid for Allah, Allah will build for him a house like it in Paradise.”</span>
					<span className="block text-right">– Prophet Muhammad ﷺ</span>
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