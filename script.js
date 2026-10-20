// Mobile navigation
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");

    menuToggle.addEventListener("click", function () {
      const isOpen = navLinks.classList.toggle("active");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.textContent = isOpen ? "✕" : "☰";
    });

    // Close mobile menu after selecting a link
    document.querySelectorAll("#navLinks a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
      });
    });

    // Set minimum travel date to today
    const travelDate = document.getElementById("travelDate");

    const today = new Date();
    const localToday = new Date(
      today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().split("T")[0];

    travelDate.min = localToday;

    // Booking form preview
    const bookingForm = document.getElementById("bookingForm");
    const formMessage = document.getElementById("formMessage");

    bookingForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const pickup = document.getElementById("pickup").value.trim();
      const destination = document.getElementById("destination").value.trim();
      const date = travelDate.value;
      const rideType = document.getElementById("rideType").value;

      if (!pickup || !destination || !date || !rideType) {
        alert("Please complete all the booking fields.");
        return;
      }

      if (pickup.toLowerCase() === destination.toLowerCase()) {
        alert("Pickup and destination cannot be the same.");
        return;
      }

      if (date < localToday) {
        alert("Please select today or a future travel date.");
        return;
      }

      const formattedDate = new Date(date + "T12:00:00")
        .toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric"
        });

      formMessage.innerHTML = `
        <strong>Journey Preview</strong><br><br>
        <strong>From:</strong> ${escapeHTML(pickup)}<br>
        <strong>To:</strong> ${escapeHTML(destination)}<br>
        <strong>Travel Date:</strong> ${formattedDate}<br>
        <strong>Transport:</strong> ${escapeHTML(rideType)}<br><br>
        <strong>Important:</strong> This is only a preview.
        Your booking has not been submitted or saved because
        the database and live booking system are not connected yet.
      `;

      formMessage.style.display = "block";
      formMessage.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });

    // Escape user-entered text before inserting it into HTML
    function escapeHTML(value) {
      return value.replace(/[&<>"']/g, function (character) {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        };

        return entities[character];
      });
    }

    // Ride option cards select the corresponding booking option
    document.querySelectorAll("[data-ride]").forEach(function (link) {
      link.addEventListener("click", function () {
        document.getElementById("rideType").value =
          link.getAttribute("data-ride");
      });
    });

    // FAQ accordion
    document.querySelectorAll(".faq-question").forEach(function (button) {
      button.addEventListener("click", function () {
        const item = button.closest(".faq-item");
        const isActive = item.classList.contains("active");

        document.querySelectorAll(".faq-item").forEach(function (faq) {
          faq.classList.remove("active");
          faq.querySelector(".faq-question")
            .setAttribute("aria-expanded", "false");
        });

        if (!isActive) {
          item.classList.add("active");
          button.setAttribute("aria-expanded", "true");
        }
      });
    });

    // Current year in footer
    document.getElementById("currentYear").textContent =
      new Date().getFullYear();
