// Isi dengan nilai dari Supabase Dashboard -> Project Settings -> API.
// ANON key memang publik (aman di frontend). JANGAN isi service_role key di sini.
window.LUMEN_CONFIG = {
  SUPABASE_URL: "",       // contoh: https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "",  // anon / publishable key
  FUNCTIONS_URL: ""       // opsional; default SUPABASE_URL + "/functions/v1"
};
