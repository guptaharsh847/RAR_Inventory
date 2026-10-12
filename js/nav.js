// App shell shared by every signed-in page: sidebar, mobile top bar and overlay.
// Include it as the first thing inside <body data-title="Page name">.
const BRAND_NAME = "Roast and Root";

(function () {
  const icon = (paths) =>
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const links = [
    { href: "dashboard.html", label: "Dashboard", icon: icon('<rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect>') },
    { href: "campaign.html", label: "Festive Mail", icon: icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>') },
    { href: "customers.html", label: "Customers", icon: icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>') },
    { href: "labels.html", label: "Labels", icon: icon('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>') },
    { href: "settings.html", label: "Settings", icon: icon('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>') },
  ];

  const page = window.location.pathname.split("/").pop() || "dashboard.html";
  const title = document.body.dataset.title || "";
  document.title = title ? `${title} · ${BRAND_NAME}` : BRAND_NAME;

  document.body.insertAdjacentHTML(
    "afterbegin",
    `<header class="top-header">
      <button class="menu-toggle" aria-label="Open menu" onclick="toggleSidebar()">${icon('<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>')}</button>
      <img src="assets/icons/icon-96x96.png" alt="" />
      <div class="header-title">${title}</div>
    </header>
    <div class="sidebar-overlay" onclick="toggleSidebar()"></div>
    <nav class="sidebar" id="sidebar" aria-label="Main">
      <a class="brand" href="dashboard.html">
        <img src="assets/icons/icon-96x96.png" alt="" />
        <div><strong>${BRAND_NAME}</strong><span>Business Suite</span></div>
      </a>
      ${links.map((l) => `<a class="nav-link${l.href === page ? " active" : ""}" href="${l.href}"${l.href === page ? ' aria-current="page"' : ""}>${l.icon}${l.label}</a>`).join("")}
      <a class="nav-link nav-logout" onclick="logout()" role="button" tabindex="0">${icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>')}Logout</a>
    </nav>`,
  );
})();

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("active");
  document.querySelector(".sidebar-overlay").classList.toggle("active");
}
