(function () {
    const config = window.APP_CONFIG || {};
    const library = window.supabase;

    if (!library || !config.supabaseUrl || !config.supabaseAnonKey) {
        window.supabaseClient = null;
        return;
    }

    window.supabaseClient = library.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
})();