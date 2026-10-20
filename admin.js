"use strict";
(function(){
const $=s=>document.querySelector(s);
const state={client:null,user:null,profile:null,drivers:[],bookings:[],fleet:[],profiles:[],payments:[]};
const statusLabels={pending:"Pending",confirmed:"Confirmed",assigned:"Assigned",in_progress:"In progress",completed:"Completed",cancelled:"Cancelled"};
function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(kobo){return new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format((Number(kobo)||0)/100)}
function dateLabel(value,opts){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString("en-NG",opts||{day:"numeric",month:"short",year:"numeric"})}
function timeLabel(value){return value?String(value).slice(0,5):"Time not set"}
function notify(message,error){const el=$("#notice");el.textContent=message;el.classList.toggle("error",Boolean(error));el.hidden=false;window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>el.hidden=true,6500)}
function accessMessage(title,copy,showLogin){const box=$("#accessState");box.classList.add("denied");box.innerHTML='<div class="access-symbol">◈</div><h2>'+escapeHTML(title)+'</h2><p>'+escapeHTML(copy)+'</p>'+(showLogin?'<a class="primary-button" href="auth.html?redirect=admin">Sign in to HanyaGo</a>':'<a class="secondary-button" href="index.html">Return to website</a>');}
function getClient(){if(!window.supabase||!window.HANYAGO_CONFIG||!window.hanyagoIsConfigured())return null;if(!state.client)state.client=window.supabase.createClient(window.HANYAGO_CONFIG.supabaseUrl,window.HANYAGO_CONFIG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return state.client}
async function start(){
const client=getClient();if(!client){accessMessage("Workspace configuration missing","HanyaGo could not initialise its database connection. Check the public Supabase configuration.");return}
try{
const {data,error}=await client.auth.getSession();if(error)throw error;
if(!data.session){accessMessage("Sign in required","The operations console is restricted to authorised HanyaGo administrators and operators.",true);return}
state.user=data.session.user;
const {data:profile,error:profileError}=await client.from("profiles").select("id,full_name,phone,role").eq("id",state.user.id).single();
if(profileError)throw profileError;
state.profile=profile;
if(!["admin","operator"].includes(profile.role)){accessMessage("This account has no operations access","You are signed in as a regular user. An existing HanyaGo administrator must approve the staff role before this console can be used.");return}
$("#accessState").hidden=true;$("#dashboard").hidden=false;
const displayName=profile.full_name||state.user.email?.split("@")[0]||"Team member";
$("#userName").textContent=displayName;$("#userRole").textContent=profile.role;$("#userAvatar").textContent=displayName.trim().slice(0,1).toUpperCase();$("#welcomeName").textContent=displayName.split(" ")[0];
$("#todayDate").textContent=new Date().toLocaleDateString("en-NG",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
await loadDashboard();
}catch(error){console.error("HanyaGo admin access check failed",error);accessMessage("Could not verify access",error.message||"Please refresh the page and sign in again.");}
}
async function loadDashboard(){
const client=state.client;
try{
const [bookingsResult,profilesResult,paymentsResult,fleetResult]=await Promise.all([
client.from("bookings").select("id,passenger_id,pickup_location,destination,travel_date,travel_time,passenger_count,passenger_phone,passenger_notes,ride_type,status,assigned_driver_id,fare_kobo,currency,created_at,passenger:profiles!bookings_passenger_id_fkey(full_name,phone),driver:profiles!bookings_assigned_driver_id_fkey(full_name,phone)").order("created_at",{ascending:false}).limit(250),
client.from("profiles").select("id,full_name,phone,role,created_at").order("created_at",{ascending:false}).limit(500),
client.from("payments").select("id,booking_id,passenger_id,provider_reference,amount_kobo,status,created_at,paid_at").order("created_at",{ascending:false}).limit(100),
client.from("fleet_vehicles").select("id,name,category,registration_number,capacity,image_url,image_path,status,notes,created_at").order("created_at",{ascending:false}).limit(100)
]);
for(const r of [bookingsResult,profilesResult,paymentsResult,fleetResult])if(r.error)throw r.error;
state.bookings=bookingsResult.data||[];state.profiles=profilesResult.data||[];state.payments=paymentsResult.data||[];state.fleet=fleetResult.data||[];
state.drivers=state.profiles.filter(p=>p.role==="driver");
renderMetrics();renderBookings();renderPeople();renderFleet();renderPayments();
}catch(error){console.error("HanyaGo dashboard data load failed",error);notify("Some dashboard data could not be loaded: "+(error.message||"database request failed"),true)}
}
function renderMetrics(){
const total=state.bookings.length,pending=state.bookings.filter(b=>b.status==="pending").length,confirmed=state.bookings.filter(b=>["confirmed","assigned","in_progress","completed"].includes(b.status)).length,activeFleet=state.fleet.filter(v=>v.status==="active").length;
$("#metricTotal").textContent=total;$("#metricPending").textContent=pending;$("#metricConfirmed").textContent=confirmed;$("#metricFleet").textContent=activeFleet;
$("#navPending").textContent=pending;$("#totalBar").style.width=(total?Math.min(100,confirmed/total*100):0)+"%";
const paid=state.payments.filter(p=>p.status==="success");$("#paidTotal").textContent=money(paid.reduce((sum,p)=>sum+(Number(p.amount_kobo)||0),0));$("#paidCount").textContent=paid.length;$("#unpaidCount").textContent=state.payments.filter(p=>p.status==="pending").length;
}
function renderBookings(){
const query=($("#bookingSearch").value||"").trim().toLowerCase(),filter=$("#statusFilter").value;
const rows=state.bookings.filter(b=>(filter==="all"||b.status===filter)&&[b.id,b.pickup_location,b.destination,b.passenger?.full_name,b.passenger_phone,b.ride_type].some(v=>String(v||"").toLowerCase().includes(query)));
const body=$("#bookingRows");
if(!rows.length){body.innerHTML='<tr><td colspan="5" class="empty-cell">No booking requests match this filter.</td></tr>'}
else body.innerHTML=rows.map(b=>{
const passenger=b.passenger?.full_name||"Passenger account",driverOptions='<option value="">No driver assigned</option>'+state.drivers.map(d=>'<option value="'+escapeHTML(d.id)+'" '+(d.id===b.assigned_driver_id?"selected":"")+'>'+escapeHTML(d.full_name||"Driver")+(d.phone?" · "+escapeHTML(d.phone):"")+'</option>').join("");
const fare=b.fare_kobo==null?"":(Number(b.fare_kobo)/100).toFixed(2);
return '<tr><td><div class="journey-title">'+escapeHTML(b.pickup_location)+' <span style="color:#0b8b5a">→</span> '+escapeHTML(b.destination)+'</div><span class="subline">#'+escapeHTML(b.id.slice(0,8).toUpperCase())+' · '+escapeHTML(b.ride_type)+'</span>'+(b.passenger_notes?'<span class="subline">Note: '+escapeHTML(b.passenger_notes)+'</span>':'')+'</td><td><span class="passenger-name">'+escapeHTML(passenger)+'</span><span class="passenger-phone">'+escapeHTML(b.passenger_phone||b.passenger?.phone||"No phone added")+'</span><span class="subline">'+escapeHTML(b.passenger_count||1)+' passenger(s)</span></td><td>'+escapeHTML(dateLabel(b.travel_date))+'<span class="subline">'+escapeHTML(timeLabel(b.travel_time))+'</span></td><td><span class="status-tag '+escapeHTML(b.status)+'">'+escapeHTML(statusLabels[b.status]||b.status)+'</span><span class="subline">'+(b.fare_kobo==null?"Fare not set":escapeHTML(money(b.fare_kobo)))+'</span></td><td class="ops-cell"><form class="ops-form" data-booking-id="'+escapeHTML(b.id)+'"><select name="status" aria-label="Booking status">'+Object.keys(statusLabels).map(s=>'<option value="'+s+'" '+(s===b.status?"selected":"")+'>'+statusLabels[s]+'</option>').join("")+'</select><input name="fare" type="number" min="0" step="100" inputmode="decimal" value="'+escapeHTML(fare)+'" placeholder="Fare ₦" aria-label="Agreed fare in naira"><select class="wide" name="driver" aria-label="Assign driver">'+driverOptions+'</select><button class="wide" type="submit">Save operations update</button></form></td></tr>'
}).join("");
$("#bookingCount").textContent="Showing "+rows.length+" of "+state.bookings.length+" requests";
}
function renderPeople(){
const all=state.profiles,drivers=all.filter(p=>p.role==="driver").length,staff=all.filter(p=>["admin","operator"].includes(p.role)).length;
$("#peopleTotal").textContent=all.length;$("#peopleDrivers").textContent=drivers;$("#peopleStaff").textContent=staff;
const recent=all.slice(0,7);$("#peopleList").innerHTML=recent.length?recent.map(p=>'<div class="person-row"><span class="person-icon">'+escapeHTML((p.full_name||"U").slice(0,1).toUpperCase())+'</span><span><strong>'+escapeHTML(p.full_name||"Unnamed account")+'</strong><small>'+escapeHTML(p.phone||"No phone")+'</small></span><span class="status-tag '+(p.role==="admin"||p.role==="operator"?"success":"muted")+'">'+escapeHTML(p.role)+'</span></div>').join(""):'<p class="empty-note">No user profiles were found.</p>';
}
function renderFleet(){
const root=$("#fleetRows");
root.innerHTML=state.fleet.length?state.fleet.map(v=>'<article class="fleet-item"><img src="'+escapeHTML(v.image_url||"https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=240&q=75")+'" alt="'+escapeHTML(v.name)+'" loading="lazy"><div><strong>'+escapeHTML(v.name)+'</strong><small>'+escapeHTML(v.category)+' · '+escapeHTML(v.capacity)+' seats'+(v.registration_number?" · "+escapeHTML(v.registration_number):"")+'</small><small>'+escapeHTML(v.status==="active"?"Visible as active":v.status==="maintenance"?"Marked for maintenance":"Hidden from active fleet")+'</small></div><select data-fleet-status="'+escapeHTML(v.id)+'" aria-label="Fleet status for '+escapeHTML(v.name)+'"><option value="active" '+(v.status==="active"?"selected":"")+'>Active</option><option value="maintenance" '+(v.status==="maintenance"?"selected":"")+'>Maintenance</option><option value="inactive" '+(v.status==="inactive"?"selected":"")+'>Inactive</option></select></article>').join(""):'<p class="empty-note">No vehicles added yet. Add a real vehicle and photo above to begin building the fleet directory.</p>';
}
function renderPayments(){
const body=$("#paymentRows");
body.innerHTML=state.payments.length?state.payments.map(p=>'<tr><td>'+escapeHTML(p.provider_reference||"Not initiated")+'</td><td>#'+escapeHTML(String(p.booking_id||"").slice(0,8).toUpperCase())+'</td><td>'+escapeHTML(money(p.amount_kobo))+'</td><td><span class="status-tag '+escapeHTML(p.status)+'">'+escapeHTML(p.status)+'</span></td><td>'+escapeHTML(dateLabel(p.created_at))+'</td></tr>').join(""):'<tr><td colspan="5" class="empty-cell">No payment records yet. This is expected until checkout is integrated.</td></tr>';
}
async function updateBooking(form){
const id=form.dataset.bookingId,status=form.elements.status.value,driverId=form.elements.driver.value,fareRaw=form.elements.fare.value;
const fareText=fareRaw.trim();let fareKobo=null;
if(fareText!==""){const n=Number(fareText);if(!Number.isFinite(n)||n<0||n>100000000){notify("Enter a valid fare in naira.",true);return}fareKobo=Math.round(n*100)}
if(["assigned","in_progress"].includes(status)&&!driverId){notify("Assign an approved driver before setting this booking to "+statusLabels[status]+".",true);return}
const payload={status,assigned_driver_id:driverId||null};if(fareText!=="")payload.fare_kobo=fareKobo;
const button=form.querySelector("button[type=submit]");button.disabled=true;button.textContent="Saving…";
try{const {error}=await state.client.from("bookings").update(payload).eq("id",id);if(error)throw error;notify("Booking operations updated.");await loadDashboard()}
catch(error){console.error(error);notify("Could not update this booking: "+(error.message||"permission or database error"),true)}
finally{button.disabled=false;button.textContent="Save operations update"}
}
async function saveVehicle(event){
event.preventDefault();const form=event.currentTarget,file=$("#vehiclePhoto").files[0];if(!file){notify("Choose a vehicle photo first.",true);return}
if(!["image/jpeg","image/png","image/webp"].includes(file.type)){notify("Use a JPG, PNG or WebP image.",true);return}
if(file.size>5*1024*1024){notify("The image must be 5 MB or smaller.",true);return}
const name=$("#vehicleName").value.trim(),category=$("#vehicleCategory").value,registration=$("#vehicleRegistration").value.trim(),capacity=Number($("#vehicleCapacity").value),notes=$("#vehicleNotes").value.trim();
if(!name||!Number.isInteger(capacity)||capacity<1||capacity>80){notify("Check the vehicle name and passenger capacity.",true);return}
const button=$("#saveVehicle");button.disabled=true;button.textContent="Uploading photo…";
let objectPath="";
try{
const extension=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[file.type];
objectPath=state.user.id+"/"+Date.now()+"-"+file.name.replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_-]/g,"_").slice(-80)+"."+extension;
const upload=await state.client.storage.from("hanyago-vehicle-images").upload(objectPath,file,{contentType:file.type,upsert:false});
if(upload.error)throw upload.error;
const publicUrl=state.client.storage.from("hanyago-vehicle-images").getPublicUrl(objectPath).data.publicUrl;
button.textContent="Saving vehicle…";
const {error}=await state.client.from("fleet_vehicles").insert({name,category,registration_number:registration||null,capacity,image_url:publicUrl,image_path:objectPath,status:"active",notes:notes||null,created_by:state.user.id});
if(error)throw error;
form.reset();$("#vehicleCapacity").value="4";$("#photoPreview").hidden=true;$("#photoPreview").removeAttribute("src");notify("Vehicle and photo saved. The vehicle is marked active.");await loadDashboard();
}catch(error){console.error("Fleet save failed",error);if(objectPath)await state.client.storage.from("hanyago-vehicle-images").remove([objectPath]).catch(()=>{});notify("Could not save this vehicle: "+(error.message||"upload or database error"),true)}
finally{button.disabled=false;button.textContent="＋ Save vehicle"}
}
async function updateFleetStatus(select){
const previous=state.fleet.find(v=>v.id===select.dataset.fleetStatus)?.status;if(!previous)return;
select.disabled=true;try{const {error}=await state.client.from("fleet_vehicles").update({status:select.value}).eq("id",select.dataset.fleetStatus);if(error)throw error;notify("Fleet status updated.");await loadDashboard()}catch(error){select.value=previous;notify("Could not update vehicle status: "+(error.message||"request failed"),true)}finally{select.disabled=false}
}
$("#bookingSearch").addEventListener("input",renderBookings);$("#statusFilter").addEventListener("change",renderBookings);
$("#bookingRows").addEventListener("submit",event=>{if(event.target.matches(".ops-form")){event.preventDefault();updateBooking(event.target)}});
$("#fleetForm").addEventListener("submit",saveVehicle);
$("#fleetRows").addEventListener("change",event=>{if(event.target.matches("[data-fleet-status]"))updateFleetStatus(event.target)});
$("#vehiclePhoto").addEventListener("change",event=>{const file=event.target.files[0],img=$("#photoPreview");if(!file){img.hidden=true;return}if(!file.type.startsWith("image/")){notify("Choose an image file.",true);event.target.value="";return}img.src=URL.createObjectURL(file);img.hidden=false});
$("#refreshButton").addEventListener("click",loadDashboard);document.querySelectorAll("[data-refresh]").forEach(b=>b.addEventListener("click",loadDashboard));
$("#signOutButton").addEventListener("click",async()=>{const {error}=await state.client.auth.signOut();if(error){notify("Could not sign out: "+error.message,true);return}window.location.replace("auth.html")});
$("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
document.querySelectorAll("[data-section]").forEach(a=>a.addEventListener("click",()=>{document.querySelectorAll("[data-section]").forEach(x=>x.classList.toggle("active",x===a));$("#pageTitle").textContent=({"overview":"Operations overview","bookings":"Booking management","fleet":"Fleet & photos","people":"People & roles","payments":"Payment activity"})[a.dataset.section]||"Operations";$("#sidebar").classList.remove("open")}));
start();
})();