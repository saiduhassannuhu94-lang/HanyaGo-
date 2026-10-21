// HanyaGo frontend behavior and authenticated booking submission.
"use strict";

// Site-wide mobile navigation is managed by site-shell.js, so this file only handles booking and page-specific interactions.

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

// Booking is an account-only action. Keep the form hidden until the session check
// completes so unauthenticated visitors are sent through signup/sign-in first.
if (bookingForm) {
  document.documentElement.classList.add("hanyago-auth-checking");
  const authGateStyle = document.createElement("style");
  authGateStyle.textContent = "html.hanyago-auth-checking body{visibility:hidden!important}";
  document.head.appendChild(authGateStyle);

  (async () => {
    const client = getSupabaseClient();
    if (!client) {
      document.documentElement.classList.remove("hanyago-auth-checking");
      const submit = bookingForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      showBookingMessage("Secure booking is temporarily unavailable because the account service is not configured. No booking has been saved.");
      return;
    }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data?.session) {
        const next = encodeURIComponent("booking");
        window.location.replace("auth.html?redirect=" + next);
        return;
      }
      document.documentElement.classList.remove("hanyago-auth-checking");
    } catch (error) {
      console.error("HanyaGo booking access check failed:", error);
      document.documentElement.classList.remove("hanyago-auth-checking");
      const submit = bookingForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      showBookingMessage("We could not verify your sign-in session. Refresh the page or sign in again before booking.");
    }
  })();
}

function readBookingForm() {
  return {
    pickup: document.getElementById("pickup").value.trim(),
    destination: document.getElementById("destination").value.trim(),
    date: travelDate.value,
    rideType: document.getElementById("rideType").value,
    time: document.getElementById("travelTime")?.value || "",
    passengerCount: Number(document.getElementById("passengerCount")?.value || 1),
    contactPhone: document.getElementById("contactPhone")?.value.trim() || "",
    passengerNotes: document.getElementById("passengerNotes")?.value.trim() || "",
    pickupLatitude: document.getElementById("pickupLatitude")?.value ? Number(document.getElementById("pickupLatitude").value) : null,
    pickupLongitude: document.getElementById("pickupLongitude")?.value ? Number(document.getElementById("pickupLongitude").value) : null,
    destinationLatitude: document.getElementById("destinationLatitude")?.value ? Number(document.getElementById("destinationLatitude").value) : null,
    destinationLongitude: document.getElementById("destinationLongitude")?.value ? Number(document.getElementById("destinationLongitude").value) : null,
    allowLiveLocation: Boolean(document.getElementById("allowLiveLocation")?.checked)
  };
}

function validateBooking(booking) {
  if (!booking.pickup || !booking.destination || !booking.date || !booking.rideType || !booking.time || !booking.contactPhone) {
    return "Please complete all required journey details, including pickup time and contact phone.";
  }
  if (!Number.isInteger(booking.passengerCount) || booking.passengerCount < 1 || booking.passengerCount > 8) {
    return "Please select between 1 and 8 passengers.";
  }
  if (!/^[+()\d\s-]{7,20}$/.test(booking.contactPhone)) {
    return "Please enter a valid contact phone number.";
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
    "<strong>Transport:</strong> " + escapeHTML(booking.rideType) + "<br>" +
    "<strong>Pickup time:</strong> " + escapeHTML(booking.time) + "<br>" +
    "<strong>Passengers:</strong> " + escapeHTML(booking.passengerCount) + "<br>" +
    "<strong>Contact:</strong> " + escapeHTML(booking.contactPhone) + "<br>" +
    (booking.passengerNotes ? "<strong>Additional requests:</strong> " + escapeHTML(booking.passengerNotes) + "<br>" : "") + "<br>" +
    "<strong>Preview mode:</strong> Supabase is not configured yet, so this journey has not been saved."
  );
}

// Start Paystack checkout only from an authenticated user's saved booking.
// The server verifies ownership and uses the fare stored in the database.
if (formMessage) {
  formMessage.addEventListener("click", async function (event) {
    const button = event.target.closest("#paystackCheckoutButton");
    if (!button) return;
    const client = getSupabaseClient();
    if (!client) {
      showBookingMessage("Payment service is unavailable. Refresh the page and sign in again.");
      return;
    }
    const bookingId = button.getAttribute("data-booking-id");
    if (!bookingId) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing secure checkout…";
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session) {
        window.location.href = "auth.html?redirect=booking";
        return;
      }
      const { data, error } = await client.functions.invoke("paystack-checkout", {
        body: { booking_id: bookingId }
      });
      if (error) {
        let detail = "";
        try { detail = (await error.context?.json?.())?.error || ""; } catch (_) {}
        throw new Error(detail || error.message || "Checkout could not be started.");
      }
      if (!data?.authorization_url || !/^https:\/\/checkout\.paystack\.com\//i.test(data.authorization_url)) {
        throw new Error(data?.error || "Paystack did not return a valid secure checkout link.");
      }
      window.location.assign(data.authorization_url);
    } catch (error) {
      console.error("HanyaGo Paystack checkout failed:", error);
      const message = String(error?.message || "");
      const safeMessage = /confirmed fare|valid confirmed fare/i.test(message)
        ? "The operator has not confirmed a payable fare yet. No payment was started. Please try again after the fare is confirmed."
        : /verified email/i.test(message)
        ? "Please verify your account email before paying."
        : "We could not start checkout. No payment was confirmed. Check the booking and try again.";
      showBookingMessage(escapeHTML(safeMessage) + "<br><br><button type=\"button\" class=\"btn btn-primary\" id=\"paystackCheckoutButton\" data-booking-id=\"" + escapeHTML(bookingId) + "\">Try checkout again</button>");
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });
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
      if (document.getElementById("travelTime")) document.getElementById("travelTime").value = draft.time || "";
      if (document.getElementById("passengerCount")) document.getElementById("passengerCount").value = String(draft.passengerCount || 1);
      if (document.getElementById("contactPhone")) document.getElementById("contactPhone").value = draft.contactPhone || "";
      if (document.getElementById("passengerNotes")) document.getElementById("passengerNotes").value = draft.passengerNotes || "";
      if (document.getElementById("allowLiveLocation")) document.getElementById("allowLiveLocation").checked = Boolean(draft.allowLiveLocation);
      if (document.getElementById("pickupLatitude")) document.getElementById("pickupLatitude").value = draft.pickupLatitude ?? "";
      if (document.getElementById("pickupLongitude")) document.getElementById("pickupLongitude").value = draft.pickupLongitude ?? "";
      if (document.getElementById("destinationLatitude")) document.getElementById("destinationLatitude").value = draft.destinationLatitude ?? "";
      if (document.getElementById("destinationLongitude")) document.getElementById("destinationLongitude").value = draft.destinationLongitude ?? "";
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
          travel_time: booking.time,
          passenger_count: booking.passengerCount,
          passenger_phone: booking.contactPhone,
          passenger_notes: booking.passengerNotes || null,
          pickup_latitude: booking.pickupLatitude,
          pickup_longitude: booking.pickupLongitude,
          destination_latitude: booking.destinationLatitude,
          destination_longitude: booking.destinationLongitude,
          passenger_location_sharing: booking.allowLiveLocation,
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
        "Online payment is available only after the operator confirms a valid fare. If the fare is not set yet, return to this booking after confirmation." +
        "<br><br><button type=\"button\" class=\"btn btn-primary\" id=\"paystackCheckoutButton\" data-booking-id=\"" + escapeHTML(reference) + "\">Continue to secure payment</button>" +
        "<br><br><a href=\"trip-live.html?booking=" + encodeURIComponent(reference) + "\">Open live trip sharing →</a>"
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


// Preselect the requested transport option when a visitor arrives from a service page.
try {
  const requestedRide = new URLSearchParams(window.location.search).get("ride");
  const rideSelect = document.getElementById("rideType");
  const supportedRides = ["Keke Napep", "Private Car", "Bus / Shared Ride", "Shuttle", "Luxury Vehicle", "Motorcycle", "Taxi"];
  if (rideSelect && requestedRide && supportedRides.includes(requestedRide)) {
    rideSelect.value = requestedRide;
  }
} catch (_) {
  // Keep the booking form usable if query-string parsing is unavailable.
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
