(function () {
"use strict";
const $ = id => document.getElementById(id);
const STATE_LIST = [
"Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta",
"Ebonyi","Edo","Ekiti","Enugu","Federal Capital Territory","Gombe","Imo","Jigawa","Kaduna","Kano",
"Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo",
"Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"
];
const state = { db:null, session:null, profile:null, trips:[], selectedTrip:null, seats:[], chosen:new Set(), booking:null, countdown:null, lastSearch:null };
const escapeHTML = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const naira = kobo => "₦" + (Number(kobo || 0) / 100).toLocaleString("en-NG",{minimumFractionDigits:0,maximumFractionDigits:2});
function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day;
}
function formatDate(value) {
  if(!value) return "Time not published";
  return new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date(value));
}
function formatTime(value) {
  if(!value) return "Time not published";
  return new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date(value));
}
function alertBox(id,msg,type="info") {
  const el=$(id); if(!el) return;
  el.textContent=msg; el.className="ic-alert show "+type;
}
function clearAlert(id) { const el=$(id); if(el) el.className="ic-alert"; }
function makeClient() {
  const c=window.HANYAGO_CONFIG;
  if(!window.supabase || !c || !window.hanyagoIsConfigured || !window.hanyagoIsConfigured()) return null;
  return window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
function setStateOptions() {
  ["originState","destinationState"].forEach(id=>{
    const el=$(id), existing=el.value;
    el.innerHTML=STATE_LIST.map(s=>'<option value="'+escapeHTML(s)+'">'+escapeHTML(s)+'</option>').join("");
    el.value=existing || (id==="originState"?"Borno":"Gombe");
  });
  $("originState").value="Borno";
  $("destinationState").value="Gombe";
  $("departureDate").min=localDate();
  if(!$("departureDate").value) $("departureDate").value=localDate();
}
async function getSession() {
  const {data,error}=await state.db.auth.getSession();
  if(error) throw error;
  state.session=data.session||null;
  if(state.session) {
    const {data:profile,error:profileError}=await state.db.from("profiles").select("full_name,phone").eq("id",state.session.user.id).maybeSingle();
    if(!profileError) state.profile=profile;
    if(state.profile) {
      if(!$("ticketPassengerName").value) $("ticketPassengerName").value=state.profile.full_name||"";
      if(!$("ticketPassengerPhone").value) $("ticketPassengerPhone").value=state.profile.phone||"";
      if(!$("bookingContactPhone").value) $("bookingContactPhone").value=state.profile.phone||"";
    }
  }
}
function drawTrip(trip) {
 const departure=formatTime(trip.departure_at), arrival=trip.arrival_at?formatTime(trip.arrival_at):"ETA not published";
 const seats=Number(trip.available_seats||0), fare=naira(trip.fare_kobo);
 const img=trip.vehicle_image_url&&/^https:\/\//i.test(trip.vehicle_image_url)?'<img class="ic-trip-image" loading="lazy" alt="'+escapeHTML(trip.vehicle_name||"Passenger vehicle")+'" src="'+escapeHTML(trip.vehicle_image_url)+'">':'<div class="ic-trip-image ic-vehicle-placeholder" aria-label="Vehicle photo not supplied">▰</div>';
 const amenities=Array.isArray(trip.amenities)?trip.amenities.slice(0,5):[];
 return '<article class="ic-trip-card" data-trip-id="'+escapeHTML(trip.id)+'">'+img+
 '<div><div class="ic-trip-operator">'+escapeHTML(trip.operator_name)+' '+(trip.operator_verified?'<span class="ic-verified" title="HanyaGo staff reviewed the operator and schedule details; this is not, by itself, an FRSC certification.">✓ HanyaGo staff-checked</span>':'<span class="ic-pill">Operator status not independently verified</span>')+'</div>'+
 '<div class="ic-trip-route"><div class="ic-trip-time">'+escapeHTML(departure)+'<small>'+escapeHTML(trip.origin_city)+' · '+escapeHTML(trip.origin_terminal)+'</small></div><div class="ic-trip-line"></div><div class="ic-trip-time">'+escapeHTML(arrival)+'<small>'+escapeHTML(trip.destination_city)+' · '+escapeHTML(trip.destination_terminal)+'</small></div></div>'+
 '<div class="ic-trip-meta"><span class="ic-pill">'+escapeHTML(trip.vehicle_name)+'</span><span class="ic-pill">'+escapeHTML(trip.ride_type)+'</span><span class="ic-pill">'+escapeHTML(formatDate(trip.departure_at))+'</span>'+amenities.map(x=>'<span class="ic-pill">'+escapeHTML(x)+'</span>').join("")+'</div>'+
 (trip.luggage_policy?'<p class="ic-form-note">Luggage: '+escapeHTML(trip.luggage_policy)+'</p>':'')+
 '</div><div class="ic-trip-action"><div class="ic-price">'+escapeHTML(fare)+'<small>per seat · NGN</small></div><div class="ic-availability '+(seats===0?'sold':'')+'">'+(seats>0?seats+' seat'+(seats===1?'':'s')+' available':'No seats available')+'</div><button class="ic-button" type="button" data-open-seats="'+escapeHTML(trip.id)+'" '+(seats===0?'disabled':'')+'>'+(seats>0?'Choose seat(s) →':'Sold out')+'</button><small class="ic-form-note">Vehicle and fare details are set by operations.</small></div></article>';
}
async function searchTrips(event) {
 if(event) event.preventDefault();
 clearAlert("searchAlert");
 const form=$("intercitySearchForm");
 if(!form.reportValidity()) return;
 const q={p_origin_state:$("originState").value,p_origin_city:$("originCity").value.trim(),p_destination_state:$("destinationState").value,p_destination_city:$("destinationCity").value.trim(),p_departure_date:$("departureDate").value};
 if(q.p_origin_city.length<2||q.p_destination_city.length<2){alertBox("searchAlert","Enter both origin and destination towns.","error");return;}
 if(q.p_origin_state===q.p_destination_state&&q.p_origin_city.toLowerCase()===q.p_destination_city.toLowerCase()){alertBox("searchAlert","Origin and destination cannot be the same town.","error");return;}
 state.lastSearch=q;
 if(state.countdown){clearInterval(state.countdown);state.countdown=null;}
 state.booking=null;state.selectedTrip=null;state.seats=[];state.chosen.clear();
 $("seatSelectionSection").hidden=true;
 $("departureResults").innerHTML='<div class="ic-empty"><div class="ic-spinner"></div><h3>Checking published departures…</h3><p>We are checking HanyaGo’s live schedule and seat inventory.</p></div>';
 $("resultsCount").textContent="Searching…";
 $("searchDeparturesButton").disabled=true;
 try {
  if(!state.db) throw new Error("HanyaGo could not connect to its schedule service. Refresh the page and try again.");
  const {data,error}=await state.db.rpc("search_scheduled_departures",q);
  if(error) throw error;
  state.trips=data||[];
  $("resultsCount").textContent=state.trips.length+" published departure"+(state.trips.length===1?"":"s");
  if(!state.trips.length) {
   $("departureResults").innerHTML='<div class="ic-empty"><div class="ic-empty-icon">⌕</div><h3>No HanyaGo departure is listed for this route and date</h3><p>This means no matching timetable has been published to HanyaGo. It does not prove buses do not operate on this road. Try another date, or contact support before making plans.</p><a class="ic-button" href="contact.html">Ask HanyaGo support</a></div>';
   $("seatSelectionSection").hidden=true; state.selectedTrip=null; state.chosen.clear();
   return;
  }
  $("departureResults").innerHTML=state.trips.map(drawTrip).join("");
 } catch(err) {
  console.error("HanyaGo intercity search failed",err);
  $("resultsCount").textContent="Schedule unavailable";
  $("departureResults").innerHTML='<div class="ic-empty"><h3>We could not load departures</h3><p>'+escapeHTML(err.message||"Please refresh and try again.")+'</p></div>';
 } finally {$("searchDeparturesButton").disabled=false;}
}
function resetSelection() { state.chosen.clear(); updateSelectionSummary(); }
function updateSelectionSummary() {
 const t=state.selectedTrip, seats=[...state.chosen].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 $("selectedSeatNumbers").textContent=seats.length?seats.join(", "):"None selected";
 $("selectedSeatCount").textContent=String(seats.length);
 $("selectedFarePerSeat").textContent=t?naira(t.fare_kobo):"₦—";
 $("selectedTotalFare").textContent=t?naira(Number(t.fare_kobo)*seats.length):"₦—";
 $("reserveSeatsButton").disabled=!t||!seats.length||seats.length>8;
}
function seatPositionStyle(seat,layout) {
 const col=Number(seat.position_number);
 if(layout==="2+1") return col<=2 ? "grid-column:"+col : "grid-column:4";
 if(layout==="2+3") return col<=2 ? "grid-column:"+col : "grid-column:"+(col+1);
 return col<=2 ? "grid-column:"+col : "grid-column:"+(col+1);
}
async function openSeatMap(tripId) {
 const trip=state.trips.find(t=>t.id===tripId);
 if(!trip) return;
 state.selectedTrip=trip; state.seats=[]; resetSelection();
 $("seatSelectionSection").hidden=false;
 $("seatMapTitle").textContent=trip.origin_city+" → "+trip.destination_city;
 $("seatMapDescription").textContent=trip.operator_name+" · "+formatDate(trip.departure_at)+" · "+formatTime(trip.departure_at)+" · "+trip.vehicle_name;
 $("selectedTripSummary").textContent=trip.origin_terminal+" → "+trip.destination_terminal+" | "+formatDate(trip.departure_at)+" | "+trip.ride_type;
 $("seatBus").className="ic-seat-bus layout-"+trip.seat_layout.replace("+","-");
 $("seatRows").innerHTML='<div class="ic-empty"><div class="ic-spinner"></div><p>Loading the seat map…</p></div>';
 $("reservationCard").classList.remove("show");
 clearAlert("seatAlert"); clearAlert("bookingAlert");
 $("seatSelectionSection").scrollIntoView({behavior:"smooth",block:"start"});
 await loadSeats();
}
async function loadSeats() {
 const t=state.selectedTrip;if(!t)return;
 $("seatRows").innerHTML='<p>Loading seat map…</p>';
 $("refreshSeatMapButton").disabled=true;
 try {
  const {data,error}=await state.db.rpc("get_scheduled_departure_seats",{p_departure_id:t.id});
  if(error) throw error;
  state.seats=data||[];
  if(!state.seats.length) {
    $("seatRows").innerHTML='<div class="ic-empty"><h3>Seat map unavailable</h3><p>The operator may not have published this vehicle inventory correctly.</p></div>';
    return;
  }
  const rows=[...new Set(state.seats.map(s=>Number(s.row_number)))].sort((a,b)=>a-b);
  const posMap=state.seats.reduce((acc,s)=>{(acc[Number(s.row_number)] ||= []).push(s);return acc;},{});
  $("seatRows").innerHTML=rows.map(row=>{
    const rowSeats=posMap[row].sort((a,b)=>Number(a.position_number)-Number(b.position_number));
    const layout=t.seat_layout;
    let markup='<div class="ic-seat-row" aria-label="Row '+row+'">';
    rowSeats.forEach(s=>{
      const st=String(s.seat_status);
      const chosen=state.chosen.has(s.seat_number);
      const available=st==="available" || chosen;
      markup+='<button type="button" class="ic-seat '+(chosen?'selected':st==='blocked'?'blocked':st==='booked'||st==='held'?'booked':'')+'" data-seat-number="'+escapeHTML(s.seat_number)+'" data-seat-status="'+escapeHTML(st)+'" style="'+seatPositionStyle(s,layout)+'" aria-pressed="'+chosen+'" '+(!available?'disabled':'')+' aria-label="Seat '+escapeHTML(s.seat_number)+': '+(chosen?'selected':st)+'">'+escapeHTML(s.seat_number)+'</button>';
    });
    const hasAisle=rowSeats.length>2;
    if(hasAisle) markup+='<span class="ic-seat-aisle" style="grid-column:3">AISLE</span>';
    return markup+'</div>';
  }).join("");
  $("reserveSeatsButton").disabled=state.chosen.size===0;
  updateSelectionSummary();
 } catch(err) {
  console.error("HanyaGo seat map failed",err);
  $("seatRows").innerHTML='<div class="ic-empty"><h3>Could not load live seats</h3><p>'+escapeHTML(err.message||"Refresh and try again.")+'</p></div>';
 } finally {$("refreshSeatMapButton").disabled=false;}
}
function toggleSeat(button) {
 const n=button.dataset.seatNumber;
 if(!n||button.dataset.seatStatus!=="available"&&!state.chosen.has(n)) return;
 if(state.chosen.has(n)) state.chosen.delete(n);
 else {
  if(state.chosen.size>=8){alertBox("seatAlert","You can reserve up to eight seats in one booking.","error");return;}
  state.chosen.add(n);
 }
 drawCurrentSelection();
}
function drawCurrentSelection() {
 document.querySelectorAll("[data-seat-number]").forEach(b=>{
  const n=b.dataset.seatNumber, selected=state.chosen.has(n);
  b.classList.toggle("selected",selected);
  b.setAttribute("aria-pressed",String(selected));
  b.disabled=!selected&&b.dataset.seatStatus!=="available";
  b.setAttribute("aria-label","Seat "+n+": "+(selected?"selected":b.dataset.seatStatus));
 });
 updateSelectionSummary();clearAlert("seatAlert");
}
function updateRelationshipUI() {
 const other=document.querySelector('input[name="bookFor"]:checked').value==="other";
 $("relationshipWrap").classList.toggle("show",other);
 $("relationshipSelect").required=other;
 const specify=other&&$("relationshipSelect").value==="Other";
 $("relationshipOtherWrap").classList.toggle("show",specify);
 $("relationshipOther").required=specify;
 if(!other){$("relationshipSelect").value="";$("relationshipOther").value="";}
 else if(!specify && $("relationshipSelect").value!=="Other") $("relationshipOther").value="";
}
function setHoldTimer(expiresAt) {
 if(state.countdown) clearInterval(state.countdown);
 function tick(){
  const ms=Math.max(0,new Date(expiresAt).getTime()-Date.now());
  const sec=Math.floor(ms/1000);
  $("holdCountdown").textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
  if(ms<=0) {
   clearInterval(state.countdown);state.countdown=null;
   $("holdCountdown").textContent="Expired";
   $("payNowButton").disabled=true;
   alertBox("bookingAlert","The seat hold has expired. Refresh the seat map and reserve available seats again before paying.","error");
  }
 }
 tick();state.countdown=setInterval(tick,1000);
}
function saveDraftAndLogin() {
 const draft={
  search:state.lastSearch,
  tripId:state.selectedTrip?.id||null,
  seats:[...state.chosen],
  passengerName:$("ticketPassengerName").value.trim(),
  passengerPhone:$("ticketPassengerPhone").value.trim(),
  bookingContactPhone:$("bookingContactPhone").value.trim(),
  bookedForOther:document.querySelector('input[name="bookFor"]:checked').value==="other",
  relationship:$("relationshipSelect").value,
  relationshipOther:$("relationshipOther").value.trim(),
  notes:$("passengerNotes").value.trim()
 };
 sessionStorage.setItem("hanyago_intercity_draft",JSON.stringify(draft));
 window.location.href="auth.html?redirect=intercity";
}
async function reserveSeats(event) {
 event.preventDefault();
 if(!$("passengerDetailsForm").reportValidity()) return;
 const t=state.selectedTrip;if(!t||!state.chosen.size){alertBox("bookingAlert","Choose at least one available seat first.","error");return;}
 const other=document.querySelector('input[name="bookFor"]:checked').value==="other";
 const relation=$("relationshipSelect").value==="Other"?$("relationshipOther").value.trim():$("relationshipSelect").value;
 if(other&&!relation){alertBox("bookingAlert","Select or write your relationship to the passenger.","error");return;}
 if(!state.session){saveDraftAndLogin();return;}
 const button=$("reserveSeatsButton");
 button.disabled=true;button.innerHTML='<span class="ic-spinner"></span> Checking seat inventory…';
 clearAlert("bookingAlert");
 try {
  const {data,error}=await state.db.rpc("reserve_scheduled_seats",{
   p_departure_id:t.id,
   p_seat_numbers:[...state.chosen],
   p_ticket_passenger_name:$("ticketPassengerName").value.trim(),
   p_ticket_passenger_phone:$("ticketPassengerPhone").value.trim(),
   p_booking_contact_phone:$("bookingContactPhone").value.trim(),
   p_booked_for_other:other,
   p_relationship_to_passenger:other?relation:null,
   p_passenger_notes:$("passengerNotes").value.trim()||null
  });
  if(error) throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!result?.booking_id) throw new Error("The reservation service did not return a booking reference.");
  state.booking=result;
  $("reservedBookingReference").textContent=result.booking_id;
  $("reservedSeatLabels").textContent=(result.seat_numbers||[...state.chosen]).join(", ");
  $("reservedFare").textContent=naira(result.fare_kobo);
  $("viewTicketLink").href="travel-ticket.html?booking="+encodeURIComponent(result.booking_id);
  $("reservationCard").classList.add("show");
  $("payNowButton").disabled=false;
  $("passengerDetailsForm").querySelectorAll("input,select,textarea,button").forEach(el=>el.disabled=true);
  setHoldTimer(result.hold_expires_at);
  alertBox("bookingAlert","Seat reservation created. Seats are held for 15 minutes while you complete payment. They are not tickets until payment is verified.","success");
  sessionStorage.removeItem("hanyago_intercity_draft");
  state.chosen.clear();updateSelectionSummary();
  $("reservationCard").scrollIntoView({behavior:"smooth",block:"center"});
 } catch(err) {
  console.error("HanyaGo seat reservation failed",err);
  alertBox("bookingAlert",err.message||"Could not reserve those seats. Refresh the seat map and try again.","error");
  await loadSeats();
 } finally {
  button.disabled=false;button.textContent="Reserve selected seats →";
  if(state.booking) button.disabled=true;
  else updateSelectionSummary();
 }
}
async function payNow() {
 const b=state.booking;if(!b?.booking_id)return;
 if($("holdCountdown").textContent==="Expired"){alertBox("bookingAlert","Your hold expired. Refresh seats and make a new reservation.","error");return;}
 $("payNowButton").disabled=true;$("payNowButton").textContent="Preparing secure checkout…";
 try {
  const {data,error}=await state.db.functions.invoke("paystack-checkout",{body:{booking_id:b.booking_id}});
  if(error) throw error;
  if(!data?.authorization_url) throw new Error(data?.error||"Paystack did not return a checkout link.");
  window.location.assign(data.authorization_url);
 } catch(err) {
  console.error("HanyaGo scheduled ticket checkout failed",err);
  alertBox("bookingAlert",err.message||"Checkout could not start. Check your booking status before trying again.","error");
  $("payNowButton").disabled=false;$("payNowButton").textContent="Pay securely with Paystack";
 }
}
async function restoreDraft() {
 let draft;try{draft=JSON.parse(sessionStorage.getItem("hanyago_intercity_draft")||"null")}catch(_){}
 if(!draft)return;
 if(draft.search) {
  $("originState").value=STATE_LIST.includes(draft.search.p_origin_state)?draft.search.p_origin_state:"Borno";
  $("originCity").value=draft.search.p_origin_city||"Biu";
  $("destinationState").value=STATE_LIST.includes(draft.search.p_destination_state)?draft.search.p_destination_state:"Gombe";
  $("destinationCity").value=draft.search.p_destination_city||"Gombe";
  $("departureDate").value=draft.search.p_departure_date||localDate();
  await searchTrips();
 }
 if(draft.tripId) await openSeatMap(draft.tripId);
 if(draft.seats) {
  const available=new Set(state.seats.filter(s=>s.seat_status==="available").map(s=>s.seat_number));
  state.chosen=new Set(draft.seats.filter(s=>available.has(s)).slice(0,8));
  drawCurrentSelection();
 }
 ["ticketPassengerName","ticketPassengerPhone","bookingContactPhone"].forEach((id,i)=>$(id).value=draft[["passengerName","passengerPhone","bookingContactPhone"][i]]||$(id).value);
 document.querySelector('input[name="bookFor"][value="'+(draft.bookedForOther?"other":"self")+'"]').checked=true;
 updateRelationshipUI();
 if(draft.relationship) $("relationshipSelect").value=draft.relationship;
 if(draft.relationshipOther) $("relationshipOther").value=draft.relationshipOther;
 updateRelationshipUI();
 $("passengerNotes").value=draft.notes||"";
}
function quickSearch(button) {
 $("originState").value=button.dataset.originState;
 $("originCity").value=button.dataset.originCity;
 $("destinationState").value=button.dataset.destinationState;
 $("destinationCity").value=button.dataset.destinationCity;
 if(!$("departureDate").value||$("departureDate").value<localDate()) $("departureDate").value=localDate();
 $("searchTrips").scrollIntoView({behavior:"smooth",block:"start"});
 searchTrips();
}
async function init() {
 setStateOptions();
 state.db=makeClient();
 $("intercitySearchForm").addEventListener("submit",searchTrips);
 $("departureResults").addEventListener("click",e=>{const b=e.target.closest("[data-open-seats]");if(b)openSeatMap(b.dataset.openSeats);});
 $("seatRows").addEventListener("click",e=>{const b=e.target.closest("[data-seat-number]");if(b)toggleSeat(b);});
 $("refreshSeatMapButton").addEventListener("click",loadSeats);
 $("passengerDetailsForm").addEventListener("submit",reserveSeats);
 document.querySelectorAll('input[name="bookFor"]').forEach(el=>el.addEventListener("change",updateRelationshipUI));
 $("relationshipSelect").addEventListener("change",updateRelationshipUI);
 $("payNowButton").addEventListener("click",payNow);
 document.querySelectorAll("[data-origin-state]").forEach(b=>b.addEventListener("click",()=>quickSearch(b)));
 if(!state.db) {
  alertBox("searchAlert","The public Supabase configuration could not be loaded. Please refresh the page or contact support.","error");
  $("searchDeparturesButton").disabled=true;
  return;
 }
 try { await getSession(); }
 catch(err) { console.error("Could not load HanyaGo session",err); }
 updateRelationshipUI();
 const savedTicketRedirect=sessionStorage.getItem("hanyago_ticket_redirect");
 if(savedTicketRedirect && /^travel-ticket\\.html\\?booking=[0-9a-f-]+$/i.test(savedTicketRedirect)) {
   sessionStorage.removeItem("hanyago_ticket_redirect");
   window.location.replace(savedTicketRedirect);
   return;
 }
 await restoreDraft();
 const requestedBooking=new URLSearchParams(location.search).get("booking");
 if(requestedBooking) window.location.href="travel-ticket.html?booking="+encodeURIComponent(requestedBooking);
}
window.addEventListener("load",init,{once:true});
})();