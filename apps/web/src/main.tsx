import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Pokeflip</h1>
      <p>Frontend is running. Styling & routes will come next.</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
