const API_URL =
  "https://script.google.com/macros/s/AKfycbyYlRc_dtcCDZaWxMGrXWh8bnuhkLjL37gDXyYiiEyWvywahO57IbPZWt-RVydqGKI/exec";

window.showCustomAlert = function (
  message,
  title = "Notification",
  type = "info",
) {
  let icon = "🔔";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";

  const overlay = document.createElement("div");
  overlay.className = "custom-alert-overlay";

  const box = document.createElement("div");
  box.className = "custom-alert-box";

  box.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
    <h3>${title}</h3>
    <p>${message}</p>
    <button id="customAlertBtn" style="margin: 0;">Okay</button>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });

  const closeAlert = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 300); // Wait for CSS transition
  };

  box.querySelector("#customAlertBtn").addEventListener("click", closeAlert);
};
