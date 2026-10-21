(function(){
"use strict";
const $=id=>document.getElementById(id);
const STATES=["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Federal Capital Territory","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];
const state={db:null,user:null,profile:null,departures:[],seats:[],activeSeatDeparture:null};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=k=>"₦"+(Number(k||0)/100).toLocaleString("en-NG",{maximumFractionDigits:2});
function message(text,error=false){const el=$("iaMessage");el.hidden=false;el.textContent=text;el.classList.toggle("error",error)}
function client(){const c=window.HANYAGO_CONFIG;if(!window.supabase||!c||!window.hanyagoIsConfigured())return null;return window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}
function fillStates(){["originState","destinationState"].forEach(id=>{$(id).innerHTML=STATES.map(s=>'<option>'+esc(s)+'</option>').join("")});$("originState").value="Borno";$("destinationState").value="Gombe";}
function dateLagos(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function toISO(date,time){return new Date(date+"T"+time+":00+01:00").toISOString()}
function friendlyDate(date){return date?new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",dateStyle:"medium",timeStyle:"short"}).format(new Date(date)):"Time not set"}
async function start(){
 state.db=client();if(!state.db){$("iaAccess").textContent="HanyaGo database config is not available.";return}
 try{
  const {data,error}=await state.db.auth.getSession();if(error)throw error;
  if(!data.session){$("iaAccess").innerHTML='<h2>Sign in required</h2><p>Only authorised HanyaGo operations staff may manage departures and seat inventory.</p><a class="ia-btn" href="auth.html?redirect=intercity-admin">Sign in to HanyaGo</a>';return}
  state.user=data.session.user;
  const {data:profile,error:pe}=await state.db.from("profiles").select("id,full_name,role").eq("id",state.user.id).single();if(pe)throw pe;
  state.profile=profile;if(!["admin","operator"].includes(profile.role)){$("iaAccess").innerHTML="<h2>No operations access</h2><p>Your account must be approved as HanyaGo operations staff before managing published departures.</p><a class='ia-btn secondary' href='index.html'>Return to website</a>";return}
  $("iaAccess").hidden=true;$("iaWorkspace").hidden=false;
  fillStates();$("departureDate").min=dateLagos();$("arrivalDate").min=dateLagos();
  $("departureForm").addEventListener("submit",createDeparture);
  $("departureList").addEventListener("click",departureAction);
  $("seatDepartureSelect").addEventListener("change",loadSeats);
  $("adminSeatGrid").addEventListener("click",seatAction);
  await loadDepartures();
 }catch(e){console.error("HanyaGo intercity admin access failed",e);$("iaAccess").innerHTML="<h2>Could not verify operations access</h2><p>"+esc(e.message||"Sign in again and retry.")+"</p><a class='ia-btn secondary' href='admin.html'>Main dashboard</a>";}
}
async function createDeparture(event){
 event.preventDefault();const form=$("departureForm");if(!form.reportValidity())return;
 const cap=Number($("seatCapacity").value),fare=Number($("fareNaira").value),cutoff=Number($("bookingCutoff").value);
 if(!Number.isInteger(cap)||cap<4||cap>70){message("Vehicle capacity must be a whole number from 4 to 70.",true);return}
 if(!Number.isSafeInteger(fare)||fare<1||fare>1000000){message("Enter the actual fare per seat in naira.",true);return}
 if(!$("originCity").value.trim()||!$("destinationCity").value.trim()||$("originCity").value.trim().toLowerCase()===$("destinationCity").value.trim().toLowerCase()&&$("originState").value===$("destinationState").value){message("Origin and destination must be different places.",true);return}
 if($("departureDate").value<dateLagos()){message("Choose today or a future date.",true);return}
 let departureAt,arrivalAt=null;
 try{departureAt=toISO($("departureDate").value,$("departureTime").value);if($("arrivalDate").value&&$("arrivalTime").value)arrivalAt=toISO($("arrivalDate").value,$("arrivalTime").value);else if($("arrivalDate").value||$("arrivalTime").value){message("Provide both arrival date and arrival time, or leave both blank.",true);return}}
 catch(_){message("Check the departure and arrival date/time values.",true);return}
 if(arrivalAt&&new Date(arrivalAt)<=new Date(departureAt)){message("Arrival must be later than departure. Use the next date for an overnight journey.",true);return}
 const image=$("vehicleImage").value.trim();if(image&&(!/^https:\/\//i.test(image))){message("Vehicle image URL must start with HTTPS.",true);return}
 const amenities=[...document.querySelectorAll('input[name="amenity"]:checked')].map(x=>x.value);
 const payload={created_by:state.user.id,operator_name:$("operatorName").value.trim(),operator_contact_phone:$("operatorPhone").value.trim()||null,operator_verification_note:$("verificationNote").value.trim(),operator_verified:false,origin_state:$("originState").value,origin_city:$("originCity").value.trim(),origin_terminal:$("originTerminal").value.trim(),destination_state:$("destinationState").value,destination_city:$("destinationCity").value.trim(),destination_terminal:$("destinationTerminal").value.trim(),departure_at:departureAt,arrival_at:arrivalAt,ride_type:$("rideType").value,vehicle_name:$("vehicleName").value.trim(),vehicle_registration:$("vehicleRegistration").value.trim()||null,vehicle_image_url:image||null,seat_capacity:cap,seat_layout:$("seatLayout").value,fare_kobo:Math.round(fare*100),booking_cutoff_minutes:cutoff,amenities,luggage_policy:$("luggagePolicy").value.trim()||null,status:"draft"};
 const btn=$("saveDeparture");btn.disabled=true;btn.textContent="Saving draft and seats…";
 try{
  const {data,error}=await state.db.from("scheduled_departures").insert(payload).select("id,seat_capacity,seat_layout").single();if(error)throw error;
  form.reset();$("originState").value=payload.origin_state;$("destinationState").value=payload.destination_state;$("seatCapacity").value="18";$("bookingCutoff").value="30";$("departureDate").min=dateLagos();$("arrivalDate").min=dateLagos();
  message("Draft saved. "+data.seat_capacity+" numbered seat records were generated automatically. Check the seat layout, vehicle, route, terminal, date/time and real fare before publishing. The trip is not yet visible to passengers.");
  await loadDepartures();$("seatDepartureSelect").value=data.id;await loadSeats();
 }catch(e){console.error("Failed to save HanyaGo departure",e);message("Could not save this draft: "+(e.message||"database or permission error"),true)}
 finally{btn.disabled=false;btn.textContent="Save draft & generate numbered seats →"}
}
async function loadDepartures(){
 $("departureList").textContent="Loading schedules…";$("seatDepartureSelect").innerHTML='<option value="">Choose a departure</option>';
 try{
  const {data,error}=await state.db.from("scheduled_departures").select("id,operator_name,operator_verified,operator_verification_note,origin_state,origin_city,origin_terminal,destination_state,destination_city,destination_terminal,departure_at,arrival_at,ride_type,vehicle_name,vehicle_registration,seat_capacity,seat_layout,fare_kobo,status,company_id").order("departure_at",{ascending:true}).limit(150);
  if(error)throw error;state.departures=data||[];
  if(!state.departures.length){$("departureList").innerHTML='<div class="ic-empty"><h3>No departures created yet</h3><p>Create a verified schedule in the form. HanyaGo will not fabricate departure times or prices.</p></div>';return}
  $("departureList").innerHTML=state.departures.map(d=>'<article class="ia-trip" data-trip="'+esc(d.id)+'"><div class="ia-trip-top"><strong>'+esc(d.origin_city+', '+d.origin_state)+' → '+esc(d.destination_city+', '+d.destination_state)+'</strong><span class="ia-status '+esc(d.status)+'">'+esc(d.status.toUpperCase())+'</span></div><small>'+esc(d.operator_name)+' · '+esc(d.origin_terminal)+' → '+esc(d.destination_terminal)+'<br>'+esc(friendlyDate(d.departure_at))+' · '+esc(d.vehicle_name)+' · '+esc(d.seat_capacity)+' seats · '+esc(d.seat_layout)+' · '+esc(money(d.fare_kobo))+' per seat</small><div class="ia-actions"><button class="ia-btn secondary" type="button" data-seat-view="'+esc(d.id)+'">View seats</button>'+(d.status==="draft"?'<button class="ia-btn" type="button" data-publish="'+esc(d.id)+'">Publish departure</button>':'')+(d.status==="published"?'<button class="ia-btn warning" type="button" data-cancel="'+esc(d.id)+'">Cancel departure</button>':'')+'</div></article>').join("");
  $("seatDepartureSelect").innerHTML='<option value="">Choose a departure</option>'+state.departures.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.origin_city+' → '+d.destination_city+' · '+friendlyDate(d.departure_at)+' · '+d.status)+'</option>').join("");
  if(state.activeSeatDeparture&&state.departures.some(d=>d.id===state.activeSeatDeparture)){$("seatDepartureSelect").value=state.activeSeatDeparture;await loadSeats()}
 }catch(e){console.error(e);$("departureList").textContent="Could not load schedules: "+(e.message||"request failed");message("Could not load departure records. Check operations access and database connection.",true)}
}
async function departureAction(event){
 const publish=event.target.closest("[data-publish]"),cancel=event.target.closest("[data-cancel]"),view=event.target.closest("[data-seat-view]");
 if(view){state.activeSeatDeparture=view.dataset.seatView;$("seatDepartureSelect").value=state.activeSeatDeparture;await loadSeats();$("adminSeatGrid").scrollIntoView({behavior:"smooth",block:"center"});return}
 if(publish){const id=publish.dataset.publish;const d=state.departures.find(x=>x.id===id);if(!d)return;
  if(!d.operator_verification_note||d.operator_verification_note.trim().length<3){message("Add a verification source note before publishing this departure.",true);return;}
  if(!confirm("I have checked the actual operator, terminal, vehicle, departure time, fare and physical seat layout. Mark this operator/schedule as staff-verified and publish it to passengers?"))return;
  try{const {error}=await state.db.from("scheduled_departures").update({status:"published",operator_verified:true}).eq("id",id);if(error)throw error;message("Departure published. It can appear in public searches for its exact route and date.");await loadDepartures()}catch(e){message("Could not publish: "+(e.message||"permission or validation error"),true)}return}
 if(cancel){const id=cancel.dataset.cancel;if(!confirm("Cancel this departure? First review all bookings, payments, passenger communication and refunds. Cancelling the schedule does not itself refund anyone."))return;
  try{const {error}=await state.db.from("scheduled_departures").update({status:"cancelled"}).eq("id",id);if(error)throw error;message("Departure marked cancelled. Handle affected passenger bookings, communication and refunds separately.");await loadDepartures()}catch(e){message("Could not cancel this departure: "+(e.message||"permission error"),true)}}
}
async function loadSeats(){
 const id=$("seatDepartureSelect").value;if(!id){$("adminSeatGrid").innerHTML="";$("adminSeatSummary").textContent="Select a departure to view seats.";return}
 state.activeSeatDeparture=id;$("adminSeatSummary").textContent="Loading inventory…";$("adminSeatGrid").innerHTML="";
 try{
  const {data,error}=await state.db.rpc("get_scheduled_departure_seats",{p_departure_id:id});if(error)throw error;state.seats=data||[];
  const counts=state.seats.reduce((a,s)=>(a[s.seat_status]=(a[s.seat_status]||0)+1,a),{});
  $("adminSeatSummary").textContent=state.seats.length+" seats · Available "+(counts.available||0)+" · Held "+(counts.held||0)+" · Booked "+(counts.booked||0)+" · Blocked "+(counts.blocked||0);
  $("adminSeatGrid").innerHTML=state.seats.map(s=>'<button type="button" class="'+esc(s.seat_status)+'" data-seat="'+esc(s.seat_number)+'" data-status="'+esc(s.seat_status)+'" '+(["held","booked"].includes(s.seat_status)?"disabled":"")+' title="'+esc(s.seat_number+" · "+s.seat_status)+'">'+esc(s.seat_number)+'</button>').join("");
 }catch(e){console.error(e);$("adminSeatSummary").textContent="Could not load seat inventory: "+(e.message||"request failed");}
}
async function seatAction(event){
 const b=event.target.closest("[data-seat]");if(!b)return;
 const old=b.dataset.status;if(["held","booked"].includes(old))return;
 const next=old==="blocked"?"available":"blocked";
 if(!confirm((next==="blocked"?"Block":"Reopen")+" seat "+b.dataset.seat+"? "+(next==="blocked"?"Passengers will no longer be able to select it.":"This will make the seat selectable again.")))return;
 b.disabled=true;
 try{const {data,error}=await state.db.rpc("staff_set_scheduled_seat_status",{p_departure_id:state.activeSeatDeparture,p_seat_number:b.dataset.seat,p_status:next});if(error)throw error;if(data!==true)throw new Error("The seat record was not updated.");message("Seat "+b.dataset.seat+" is now "+next+".");await loadSeats()}catch(e){message("Could not change this seat: "+(e.message||"permission error"),true);b.disabled=false}
}
window.addEventListener("load",start,{once:true});
})();