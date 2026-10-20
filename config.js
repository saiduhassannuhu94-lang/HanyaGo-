/*
 * HanyaGo public browser configuration.
 *
 * These are public client values, not secrets. Use the Supabase project URL
 * and publishable key (or legacy anon key). NEVER place a service_role key,
 * database password, or Paystack secret key in this file.
 *
 * Replace the two placeholders after confirming the correct Supabase project.
 */
window.HANYAGO_CONFIG = Object.freeze({
  supabaseUrl: "https://wtcheskbfahqpvnhyoyb.supabase.co",
  supabasePublishableKey: "sb_publishable_0M4xmQr2zOcpAhpv0pGTpw_qreW3UyR"
});

window.hanyagoIsConfigured = function () {
  const config = window.HANYAGO_CONFIG;
  return Boolean(
    config &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl) &&
    config.supabasePublishableKey &&
    config.supabasePublishableKey.length > 20 &&
    !config.supabasePublishableKey.includes("YOUR_SUPABASE")
  );
};
