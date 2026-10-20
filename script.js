// HanyaGo frontend behavior and authenticated booking submission.
"use strict";

// Mobile navigation
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", function () {
    const isOpen = navLinks.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.textContent = isOpen ? "✕" : "☰";
  });

  document.querySelectorAll("#navLinks a").forEach(function (link) {
    link.addEventListener("click", function () {
      navLinks.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.textContent = "☰";
    });
  });
}

// Use local calendar date rather than UTC date for travel-date validation.
const travelDate = document.getElementById("travelDate");
const now = new Date();
const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  .toISOString()
  .split("T")[0];

if (travelDate) travelDate.min = localToday;

const bookingForm = document.getElementById("bookingForm");
const formMessage = document.getElementById("formMessage");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character];
  });
}

function showBookingMessage(html) {
  if (!formMessage) return;
  formMessage.innerHTML = html;
  formMessage.style.display = "block";
  formMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function getSupabaseClient() {
  if (
    !window.supabase ||
    !window.hanyagoIsConfigured ||
    !window.hanyagoIsConfigured()
  ) {
    return null;
  }

  if (!window.__hanyagoSupabaseClient) {
    const config = window.HANYAGO_CONFIG;
    window.__hanyagoSupabaseClient = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  return window.__hanyagoSupabaseClient;
}

function readBookingForm() {
  return {
    pickup: document.getElementById("pickup").value.trim(),
    destination: document.getElementById("destination").value.trim(),
    date: travelDate.value,
    rideType: document.getElementById("rideType").value
  };
}

function validateBooking(booking) {
  if (!booking.pickup || !booking.destination || !booking.date || !booking.rideType) {
    return "Please complete all the booking fields.";
  }
  if (booking.pickup.toLowerCase() === booking.destination.toLowerCase()) {
    return "Pickup and destination cannot be the same.";
  }
  if (booking.date < localToday) {
    return "Please select today or a future travel date.";
  }
  return "";
}

function renderBookingPreview(booking) {
  const formattedDate = new Date(booking.date + "T12:00:00").toLocaleDateString(
    undefined,
    { day: "numeric", month: "long", year: "numeric" }
  );

  showBookingMessage(
    "<strong>Journey Preview</strong><br><br>" +
    "<strong>From:</strong> " + escapeHTML(booking.pickup) + "<br>" +
    "<strong>To:</strong> " + escapeHTML(booking.destination) + "<br>" +
    "<strong>Travel Date:</strong> " + escapeHTML(formattedDate) + "<br>" +
    "<strong>Transport:</strong> " + escapeHTML(booking.rideType) + "<br><br>" +
    "<strong>Preview mode:</strong> Supabase is not configured yet, so this journey has not been saved."
  );
}

if (bookingForm) {
  // Restore the draft after a user signs in and returns from auth.html.
  try {
    const draft = JSON.parse(sessionStorage.getItem("hanyago_booking_draft") || "null");
    if (draft) {
      document.getElementById("pickup").value = draft.pickup || "";
      document.getElementById("destination").value = draft.destination || "";
      travelDate.value = draft.date || "";
      document.getElementById("rideType").value = draft.rideType || "";
      sessionStorage.removeItem("hanyago_booking_draft");
      showBookingMessage(
        "<strong>Your journey details are ready.</strong><br>" +
        "Review the details and submit again to save your booking."
      );
    }
  } catch (_) {
    sessionStorage.removeItem("hanyago_booking_draft");
  }

  bookingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const booking = readBookingForm();
    const validationMessage = validateBooking(booking);

    if (validationMessage) {
      showBookingMessage(escapeHTML(validationMessage));
      return;
    }

    const client = getSupabaseClient();

    // Keep a transparent preview fallback until public Supabase configuration
    // is added; never pretend that a preview was saved as a real booking.
    if (!client) {
      renderBookingPreview(booking);
      return;
    }

    const submitButton = bookingForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : "";

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Checking your account...";
      }

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (sessionError) throw sessionError;

      const session = sessionData?.session;

      if (!session) {
        sessionStorage.setItem("hanyago_booking_draft", JSON.stringify(booking));
        window.location.href = "auth.html?redirect=booking";
        return;
      }

      if (submitButton) submitButton.textContent = "Saving booking...";

      const { data, error } = await client
        .from("bookings")
        .insert({
          passenger_id: session.user.id,
          pickup_location: booking.pickup,
          destination: booking.destination,
          travel_date: booking.date,
          ride_type: booking.rideType,
          status: "pending",
          currency: "NGN"
        })
        .select("id, status, created_at")
        .single();

      if (error) throw error;

      const reference = String(data.id || "");
      showBookingMessage(
        "<strong>Booking request saved successfully.</strong><br><br>" +
        "<strong>Booking reference:</strong> " + escapeHTML(reference) + "<br>" +
        "<strong>Status:</strong> Pending confirmation<br><br>" +
        "This confirms that the request was saved, not that a driver or fare has been confirmed."
      );
      bookingForm.reset();
      travelDate.min = localToday;
    } catch (error) {
      console.error("HanyaGo booking submission failed:", error);
      const message = String(error?.message || "");
      let userMessage =
        "We could not save this booking. Please try again in a moment.";

      if (/relation .*bookings.* does not exist|could not find the table/i.test(message)) {
        userMessage =
          "The HanyaGo database migration has not been applied yet. The booking was not saved.";
      } else if (/row-level security|permission denied|not allowed/i.test(message)) {
        userMessage =
          "Your session does not have permission to create this booking. Sign in again or contact support.";
      } else if (/network|fetch/i.test(message)) {
        userMessage =
          "Connection problem. Check your internet connection and try again.";
      }

      showBookingMessage(escapeHTML(userMessage));
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText || "Continue with Journey →";
      }
    }
  });
}

// Ride option cards select the corresponding booking option.
document.querySelectorAll("[data-ride]").forEach(function (link) {
  link.addEventListener("click", function () {
    const rideType = document.getElementById("rideType");
    if (rideType) rideType.value = link.getAttribute("data-ride");
  });
});

// FAQ accordion
document.querySelectorAll(".faq-question").forEach(function (button) {
  button.addEventListener("click", function () {
    const item = button.closest(".faq-item");
    const isActive = item.classList.contains("active");

    document.querySelectorAll(".faq-item").forEach(function (faq) {
      faq.classList.remove("active");
      faq.querySelector(".faq-question").setAttribute("aria-expanded", "false");
    });

    if (!isActive) {
      item.classList.add("active");
      button.setAttribute("aria-expanded", "true");
    }
  });
});

// Current year in footer
const currentYear = document.getElementById("currentYear");
if (currentYear) currentYear.textContent = new Date().getFullYear();
