// Session validation for 7-day login
const pageName = window.location.pathname.split("/").pop();
const isLoginPage = pageName === "index.html" || pageName === "";

const token = localStorage.getItem("token");
const expiry = localStorage.getItem("token_expiry");
const isValidSession = token && expiry && Date.now() < parseInt(expiry);

if (!isLoginPage && !isValidSession) {
  // Redirect to index if session is invalid and not already on index
  localStorage.removeItem("token");
  localStorage.removeItem("token_expiry");
  window.location.href = "index.html";
} else if (isLoginPage && isValidSession) {
  // If already logged in and on index page, skip to dashboard
  window.location.href = "dashboard.html";
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbyYlRc_dtcCDZaWxMGrXWh8bnuhkLjL37gDXyYiiEyWvywahO57IbPZWt-RVydqGKI/exec";

window.showCustomAlert = function (
  message,
  title = "Notification",
  type = "info",
) {
  let icon = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
  if (type === "success")
    icon = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  if (type === "error")
    icon = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  const overlay = document.createElement("div");
  overlay.className = "custom-alert-overlay";

  const box = document.createElement("div");
  box.className = "custom-alert-box";

  box.innerHTML = `
    <div style="margin-bottom: 16px; display: flex; justify-content: center;">${icon}</div>
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
