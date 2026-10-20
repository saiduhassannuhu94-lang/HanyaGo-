/* HanyaGo live weather panel powered by Open-Meteo. */
(function(){
"use strict";
const root=document.querySelector("#liveWeather");
if(!root)return;
const $=s=>root.querySelector(s);
const defaultPlace={latitude:10.6129,longitude:12.1946,label:"Biu, Borno"};
const codes={0:["Clear sky","☀️"],1:["Mainly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Overcast","☁️"],45:["Fog","🌫️"],48:["Fog","🌫️"],51:["Light drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Heavy drizzle","🌧️"],61:["Light rain","🌦️"],63:["Moderate rain","🌧️"],65:["Heavy rain","🌧️"],71:["Light snow","🌨️"],73:["Snow","🌨️"],75:["Heavy snow","❄️"],80:["Rain showers","🌦️"],81:["Rain showers","🌧️"],82:["Heavy rain showers","⛈️"],95:["Thunderstorm","⛈️"],96:["Thunderstorm with hail","⛈️"],99:["Severe thunderstorm","⛈️"]};
function put(selector,value){const el=$(selector);if(el)el.textContent=value}
async function loadWeather(){
const btn=$("[data-weather-refresh]");if(btn){btn.disabled=true;btn.textContent="Updating…"}
put(".weather-description","Loading current conditions…");
try{
const url="https://api.open-meteo.com/v1/forecast?latitude="+defaultPlace.latitude+"&longitude="+defaultPlace.longitude+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto";
const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw Error("Weather unavailable");
const data=await response.json(),c=data.current;if(!c)throw Error("No current weather data");
const info=codes[c.weather_code]||["Current conditions","🌤️"];
put(".weather-location",defaultPlace.label);put(".weather-description",info[0]);put(".weather-icon",info[1]);put(".weather-temp",Math.round(c.temperature_2m)+"°");
put(".weather-feels",Math.round(c.apparent_temperature)+"°C");put(".weather-humidity",Math.round(c.relative_humidity_2m)+"%");
put(".weather-wind",Math.round(c.wind_speed_10m)+" km/h");put(".weather-rain",Number(c.precipitation||0).toLocaleString(undefined,{maximumFractionDigits:1})+" mm");
put(".weather-updated","Updated "+new Date(c.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
put(".weather-live","Live weather");
const desc=$(".weather-description");if(desc)desc.classList.remove("weather-error");
}catch(_){put(".weather-description","Live weather is temporarily unavailable. Check your connection and retry.");put(".weather-updated","Weather service unavailable");put(".weather-live","Offline");const desc=$(".weather-description");if(desc)desc.classList.add("weather-error")}
finally{if(btn){btn.disabled=false;btn.textContent="↻ Refresh"}}
}
loadWeather();
window.setInterval(loadWeather, 15 * 60 * 1000);
const refresh=$("[data-weather-refresh]");if(refresh)refresh.addEventListener("click",loadWeather);
const locate=$("[data-weather-location]");if(locate){locate.addEventListener("click",()=>{const el=$(".weather-description");if(el)el.textContent="Weather currently uses Biu, Borno. The pickup form lets you enter your exact starting point.";const heading=$(".weather-location");if(heading)heading.scrollIntoView({behavior:"smooth",block:"nearest"})})}
})();