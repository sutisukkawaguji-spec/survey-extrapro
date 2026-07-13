// Public browser configuration only.
// Never put Supabase secret/service_role keys or unrestricted server API keys here.
const surveyPublicConfig = {
    supabaseUrl: 'https://eocbxntymzwbgqaodvse.supabase.co',
    supabasePublishableKey: 'AIzaSyAWnb6S0zVLvNyv_vXke1gs2Qm68eQFVrY',

    // A browser key is visible to users by design. Restrict it in Google Cloud to:
    //   - Websites (HTTP referrers)
    //   - Maps JavaScript API
    //   - Places API (New)
    googleMapsBrowserKey: 'AIzaSyAWnb6S0zVLvNyv_vXke1gs2Qm68eQFVrY',

    // The bypass is additionally limited by app.js to localhost/127.0.0.1.
    devBypassAuth: false
};

const surveyLocalConfig = window.SURVEY_LOCAL_CONFIG || {};
window.SURVEY_CONFIG = Object.freeze({ ...surveyPublicConfig, ...surveyLocalConfig });
