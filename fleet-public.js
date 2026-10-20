(function(){
"use strict";
const root=document.getElementById("publicFleetGrid");if(!root)return;
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function client(){const c=window.HANYAGO_CONFIG;if(!window.supabase||!c||!window.hanyagoIsConfigured||!window.hanyagoIsConfigured())return null;return window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}})}
async function load(){
const db=client();if(!db){root.innerHTML='<div class="public-fleet-empty"><strong>Vehicle listings are being prepared.</strong><p>Choose a transport category above while the live fleet directory is configured.</p></div>';return}
try{
const {data,error}=await db.from("fleet_vehicles").select("id,name,category,registration_number,capacity,image_url").eq("status","active").order("created_at",{ascending:false}).limit(12);
if(error)throw error;
if(!data||!data.length){root.innerHTML='<div class="public-fleet-empty"><strong>Real vehicle listings will appear here.</strong><p>Our operations team has not added any active vehicles yet. Existing transport categories remain available.</p></div>';return}
root.innerHTML=data.map(v=>'<article class="public-fleet-card"><img src="'+esc(v.image_url||"")+'" alt="'+esc(v.name)+'" loading="lazy" decoding="async"><div class="public-fleet-body"><h3>'+esc(v.name)+'</h3><div class="public-fleet-meta"><span>'+esc(v.category)+'</span><span>'+esc(v.capacity)+' seats</span></div><a class="public-fleet-book" href="booking.html?ride='+encodeURIComponent(v.category)+'">Request this vehicle →</a></div></article>').join("");
}catch(error){console.error("Public fleet listing unavailable",error);root.innerHTML='<div class="public-fleet-empty"><strong>Fleet listings could not be loaded.</strong><p>Try refreshing this page. You can still book through the transport categories above.</p></div>'}
}
load();
})();