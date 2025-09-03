const loader = document.getElementById("loader");

function showLoader() {
  loader.classList.add("active");
}
function hideLoader() {
  loader.classList.remove("active");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("keyForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // stop full reload
    showLoader();

    const formData = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      console.log("Verify response:", data);

      if (res.ok && data.success) {
        setTimeout(() => {
          window.location.href = `panel.html?u=${encodeURIComponent(
            data.username || "User"
          )}`;
        }, 600);
      } else {
        hideLoader();
        alert("❌ " + (data.message || "Invalid key"));
      }
    } catch (err) {
      hideLoader();
      console.error(err);
      alert("⚠️ Network error");
    }
  });
});

