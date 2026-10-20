(function(){
"use strict";
const $=id=>document.getElementById(id);
const townEl=$("town"), pickupEl=$("pickupArea"), dropEl=$("dropoffArea"), amountEl=$("fareAmount"), fareMessage=$("fareMessage"), routeSummary=$("routeSummary"), form=$("kekeForm"), submit=$("bookKeke"), message=$("formMessage");
let db=null, areas=[], routes=[], selectedRoute=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const naira=n=>"₦"+Number(n).toLocaleString("en-NG",{maximumFractionDigits:0});
function client(){const c=window.HANYAGO_CONFIG;if(!window.supabase||!c||!window.hanyagoIsConfigured||!window.hanyagoIsConfigured())return null;return window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}
function status(text,isError=false){message.className="keke-form-message "+(isError?"error":"success");message.textContent=text;message.style.display="block"}
function resetQuote(text="Choose a route to see the published price."){selectedRoute=null;amountEl.textContent="₦—";fareMessage.textContent=text;submit.disabled=true;submit.innerHTML='Choose a route first <span>→</span>';routeSummary.innerHTML='<span class="route-summary-icon">↗</span><span>Select a town and both areas to check the fare.</span>'}
function areasForTown(){const town=townEl.value.toLocaleLowerCase();return areas.filter(a=>a.town.toLocaleLowerCase()===town)}
function fillAreas(){const list=areasForTown();const opts='<option value="">Choose an area</option>'+list.map(a=>'<option value="'+a.id+'">'+esc(a.area_name)+(a.landmark?' · '+esc(a.landmark):'')+'</option>').join("");pickupEl.innerHTML=opts;dropEl.innerHTML=opts;pickupEl.disabled=!list.length;dropEl.disabled=!list.length;resetQuote(list.length?'Select pickup and drop-off areas.':'No active areas have been published for this town yet.');}
function refreshRoute(){resetQuote("Choose a route to see the published price.");if(!townEl.value||!pickupEl.value||!dropEl.value)return;if(pickupEl.value===dropEl.value){resetQuote("Pickup and drop-off must be different areas.");return}
const route=routes.find(r=>r.active&&r.approved&&r.pickup_area_id===pickupEl.value&&r.dropoff_area_id===dropEl.value&&r.town.toLocaleLowerCase()===townEl.value.toLocaleLowerCase());
const p=areas.find(a=>a.id===pickupEl.value),d=areas.find(a=>a.id===dropEl.value);
routeSummary.innerHTML='<span class="route-summary-icon">↗</span><span><strong>'+esc(townEl.value)+'</strong><br>'+esc(p?.area_name||"Pickup")+' <span aria-hidden="true">→</span> '+esc(d?.area_name||"Drop-off")+'</span>';
if(!route){resetQuote("No published fare for this route yet. Contact support or choose another route.");routeSummary.innerHTML='<span class="route-summary-icon">↗</span><span>'+esc(townEl.value)+': '+esc(p?.area_name||"Pickup")+' → '+esc(d?.area_name||"Drop-off")+'</span>';return}
selectedRoute=route;amountEl.textContent=naira(route.fare_naira);fareMessage.textContent=route.fare_note||"Published route fare. Driver availability is confirmed after the request.";submit.disabled=false;submit.innerHTML='Request this Keke ride <span>→</span>';
}
async function init(){db=client();if(!db){townEl.innerHTML='<option value="">Service temporarily unavailable</option>';resetQuote("The live fare catalogue could not connect. Refresh and try again.");return}
try{const [a,r]=await Promise.all([db.from("keke_service_areas").select("id,town,area_name,landmark,active").eq("active",true).order("town").order("area_name"),db.from("keke_fare_routes").select("id,town,pickup_area_id,dropoff_area_id,fare_naira,fare_note,active,approved").eq("active",true).eq("approved",true)]);if(a.error)throw a.error;if(r.error)throw r.error;areas=a.data||[];routes=r.data||[];const towns=[...new Set(areas.map(a=>a.town))];townEl.innerHTML='<option value="">Choose a town</option>'+towns.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join("");if(!towns.length){townEl.innerHTML='<option value="">No towns available yet</option>';resetQuote("HanyaGo has not published service areas yet. Operations must add verified local areas and fares before prices can be shown.");return}const requested=new URLSearchParams(location.search).get("town");if(requested&&towns.some(t=>t.toLocaleLowerCase()===requested.toLocaleLowerCase()))townEl.value=towns.find(t=>t.toLocaleLowerCase()===requested.toLocaleLowerCase());fillAreas();}catch(e){console.error("Keke fare catalogue failed",e);townEl.innerHTML='<option value="">Could not load towns</option>';resetQuote("We could not load published fares. Please refresh the page.");}}
townEl.addEventListener("change",fillAreas);pickupEl.addEventListener("change",refreshRoute);dropEl.addEventListener("change",refreshRoute);
$("swapRoute").addEventListener("click",()=>{const p=pickupEl.value;pickupEl.value=dropEl.value;dropEl.value=p;refreshRoute()});
const today=new Date();$("travelDate").min=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
form.addEventListener("submit",async e=>{e.preventDefault();if(!selectedRoute){status("Choose a route with a published fare first.",true);return}if(!$("travelDate").value||!$("travelTime").value){status("Select your travel date and pickup time.",true);return}if($("travelDate").value<$("travelDate").min){status("Travel date cannot be in the past.",true);return}const phone=$("phone").value.trim();if(!/^[+()\d\s-]{7,20}$/.test(phone)){status("Enter a valid contact phone number.",true);return}if(!db){status("Booking service is unavailable. Refresh and try again.",true);return}
const original=submit.innerHTML;submit.disabled=true;submit.textContent="Checking your account…";
try{const {data:sessionData,error:sessionError}=await db.auth.getSession();if(sessionError)throw sessionError;const session=sessionData?.session;if(!session){sessionStorage.setItem("hanyago_keke_draft",JSON.stringify({town:townEl.value,pickupArea:pickupEl.value,dropoffArea:dropEl.value,date:$("travelDate").value,time:$("travelTime").value,passengerCount:$("passengerCount").value,phone,notes:$("notes").value}));location.href="auth.html?redirect=keke-napep";return}
const p=areas.find(a=>a.id===pickupEl.value),d=areas.find(a=>a.id===dropEl.value);submit.textContent="Saving ride request…";
const {data,error}=await db.from("bookings").insert({passenger_id:session.user.id,pickup_location:p.area_name+", "+townEl.value,destination:d.area_name+", "+townEl.value,travel_date:$("travelDate").value,travel_time:$("travelTime").value,passenger_count:Number($("passengerCount").value),passenger_phone:phone,passenger_notes:$("notes").value.trim()||null,ride_type:"Keke Napep",status:"pending",currency:"NGN",pickup_area_id:p.id,dropoff_area_id:d.id,fare_route_id:selectedRoute.id,fare_kobo:selectedRoute.fare_naira*100,fare_quote_kobo:selectedRoute.fare_naira*100,fare_quote_currency:"NGN",fare_quote_created_at:new Date().toISOString()}).select("id").single();
if(error)throw error;
const savedRoute=selectedRoute, savedFare=naira(savedRoute.fare_naira);
form.reset();$("travelDate").min=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);fillAreas();
status("Ride request saved. Reference: "+data.id+". Published fare: "+savedFare+". Preparing secure checkout…");
try{
 const {data:checkout,error:checkoutError}=await db.functions.invoke("paystack-checkout",{body:{booking_id:data.id}});
 if(checkoutError)throw checkoutError;
 const checkoutUrl=new URL(checkout.authorization_url);
 if(checkoutUrl.protocol!=="https:"||checkoutUrl.hostname!=="checkout.paystack.com")throw new Error("The checkout link could not be validated.");
 message.className="keke-form-message success";message.innerHTML='<strong>Ride request saved.</strong><br>Reference: '+esc(data.id)+'<br>Published fare: '+esc(savedFare)+'<br><br><a class="keke-pay-link" href="'+esc(checkoutUrl.href)+'">Pay securely with Paystack →</a><br><small>After payment, return to HanyaGo for verification. Your ride remains pending until the operator confirms it.</small>';
}catch(payError){
 console.error("Paystack checkout is not available",payError);
 status("Ride request saved. Reference: "+data.id+". Published fare: "+savedFare+". The booking is still unpaid because secure checkout is not enabled yet. No payment was taken; contact support or check your booking later.");
}
}catch(err){console.error("Keke booking failed",err);status("We could not save the ride request. "+(err.message||"Please try again."),true)}finally{submit.disabled=!selectedRoute; if(selectedRoute)submit.innerHTML=original;else submit.innerHTML='Choose a route first <span>→</span>'}
});
init();
})();