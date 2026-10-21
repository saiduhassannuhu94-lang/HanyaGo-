(function(){"use strict";
const $=id=>document.getElementById(id);
const state={db:null,companies:[],departures:[]};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=k=>"₦"+(Number(k||0)/100).toLocaleString("en-NG",{maximumFractionDigits:2});
function setStatus(text,type="info"){$("operatorStatus").textContent=text;$("operatorStatus").className="ic-alert show "+type}
function dateText(s){return s?new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",day:"numeric",month:"short",year:"numeric"}).format(new Date(s)):"Date not set"}
function timeText(s){return s?new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date(s)):"Time not set"}
function companyKey(t){return t.company_id||("independent:"+String(t.operator_name||"").toLowerCase())}
function buildProfiles(){
 const profiles=new Map();
 for(const co of state.companies) profiles.set(co.id,{kind:"company",key:co.id,name:co.display_name||co.legal_name,legal:co.display_name!==co.legal_name?co.legal_name:"",slug:co.slug,phone:co.support_phone,address:co.address,email:co.support_email,companyStatus:co.company_status,licenseStatus:co.license_status,routes:[],searchText:""});
 for(const trip of state.departures){
  const key=companyKey(trip);
  let p=profiles.get(key);
  if(!p){
   p={kind:"independent",key,name:trip.operator_name,legal:"",slug:"",phone:trip.operator_contact_phone,address:"",email:"",companyStatus:"published-trip",licenseStatus:"not-listed-as-company",routes:[]};
   profiles.set(key,p);
  }
  if(!p.routes.some(r=>r.id===trip.id))p.routes.push(trip);
 }
 const arr=[...profiles.values()];
 arr.forEach(p=>{p.routes.sort((a,b)=>new Date(a.departure_at)-new Date(b.departure_at));p.searchText=[p.name,p.legal,p.address,p.routes.map(r=>[r.origin_state,r.origin_city,r.origin_terminal,r.destination_state,r.destination_city,r.destination_terminal,r.vehicle_name].join(" ")).join(" ")].join(" ").toLowerCase();});
 state.profiles=arr;
 render();
}
function profileCard(p){
 const upcoming=p.routes.slice(0,3);
 const badge=p.kind==="company"?'<span class="op-badge">HanyaGo-approved company</span>':'<span class="op-badge" style="background:#fff2d7;color:#7a5b14">Published trip · company status not shown</span>';
 const routes=upcoming.length?'<div class="op-route-list"><h4>Upcoming published departures</h4>'+upcoming.map(t=>'<div class="op-route"><strong>'+esc(t.origin_city)+' → '+esc(t.destination_city)+'</strong><span>'+esc(dateText(t.departure_at))+'</span></div><div class="op-route" style="font-size:.73rem;color:var(--ic-muted)"><span>'+esc(t.origin_terminal)+' → '+esc(t.destination_terminal)+'</span><span>'+esc(timeText(t.departure_at))+' · '+esc(money(t.fare_kobo))+'/seat</span></div>').join("")+'</div>':'<p class="ic-form-note">No future departure is currently published for this profile.</p>';
 const routesLink=upcoming.length?'intercity.html?originState='+encodeURIComponent(upcoming[0].origin_state)+'&origin='+encodeURIComponent(upcoming[0].origin_city)+'&destinationState='+encodeURIComponent(upcoming[0].destination_state)+'&destination='+encodeURIComponent(upcoming[0].destination_city)+'&date='+encodeURIComponent(upcoming[0].departure_at.slice(0,10)):'intercity.html';
 const phone=String(p.phone||"").replace(/[^0-9+(). -]/g,"").trim();
 return '<article class="op-card"><div class="op-cover"><span class="op-mark">'+esc((p.name||"H").trim().charAt(0).toUpperCase())+'</span>'+badge+'</div><div class="op-card-body"><h3>'+esc(p.name)+'</h3>'+(p.legal?'<div class="op-legal">Legal name: '+esc(p.legal)+'</div>':'')+'<div class="op-status">'+(p.kind==="company"?"Company record approved by HanyaGo":"Listed from a published departure")+'</div><div class="op-facts">'+(p.address?'<div class="op-fact"><b>Address</b> '+esc(p.address)+'</div>':'')+(phone?'<div class="op-fact"><b>Booking contact</b> <a href="tel:'+esc(phone)+'">'+esc(phone)+'</a></div>':'')+(p.email?'<div class="op-fact"><b>Email</b> <a href="mailto:'+esc(p.email)+'">'+esc(p.email)+'</a></div>':'')+'<div class="op-fact"><b>Profile status</b> '+(p.kind==="company"?"Active company · required company document status approved":"Company licensing details not displayed for this operator")+'</div></div>'+routes+'<div class="op-card-actions"><a class="op-button" href="'+esc(routesLink)+'">View departures →</a>'+(phone?'<a class="op-button secondary" href="tel:'+esc(phone)+'">Call operator</a>':'')+'</div></div></article>';
}
function render(){
 const term=$("operatorSearch").value.trim().toLowerCase();
 const list=(state.profiles||[]).filter(p=>!term||p.searchText.includes(term)||p.name.toLowerCase().includes(term));
 $("opCount").textContent=list.length+" profile"+(list.length===1?"":"s")+" · "+(state.departures.length)+" upcoming published departure(s)";
 $("operatorCards").innerHTML=list.map(profileCard).join("");
 $("operatorEmpty").classList.toggle("op-hidden",list.length>0);
 if(!list.length && !term)setStatus("No public HanyaGo operator profiles are available yet. This is an empty verified directory, not proof that no transport companies operate in the region.","info");
 else if(!list.length)setStatus("No approved operator matches that search. Try a shorter company name, town or destination.","info");
 else setStatus("Showing current HanyaGo company records and published routes. HanyaGo approval is not a government endorsement.","success");
}
function client(){
 const c=window.HANYAGO_CONFIG;
 if(!window.supabase||!c||!window.hanyagoIsConfigured())return null;
 return window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
async function init(){
 $("operatorSearch").addEventListener("input",render);
 state.db=client();
 if(!state.db){setStatus("HanyaGo could not connect to its public directory. Refresh the page or contact support.","error");$("operatorEmpty").classList.remove("op-hidden");return}
 try{
  const [{data:companies,error:coError},{data:departures,error:depError}]=await Promise.all([
   state.db.from("transport_companies").select("id,legal_name,display_name,slug,support_email,support_phone,address,company_status,license_status").eq("company_status","active").eq("license_status","approved").limit(200),
   state.db.from("scheduled_departures").select("id,company_id,operator_name,operator_contact_phone,origin_state,origin_city,origin_terminal,destination_state,destination_city,destination_terminal,departure_at,arrival_at,ride_type,vehicle_name,vehicle_registration,seat_capacity,seat_layout,fare_kobo,amenities,luggage_policy,status,operator_verified").eq("status","published").eq("operator_verified",true).gt("departure_at",new Date().toISOString()).order("departure_at",{ascending:true}).limit(500)
  ]);
  if(coError)throw coError;if(depError)throw depError;
  state.companies=companies||[];state.departures=departures||[];
  buildProfiles();
 }catch(e){console.error("HanyaGo operator directory failed",e);setStatus("Could not load approved operator profiles: "+(e.message||"Please try again."),"error");$("operatorEmpty").classList.remove("op-hidden")}
}
window.addEventListener("load",init,{once:true});
})();