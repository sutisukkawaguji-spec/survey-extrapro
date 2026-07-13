# API security configuration

## Google Maps browser key

The Google Maps key used by this static site is a public browser credential. It
must be protected with Google Cloud restrictions rather than treated as a secret.

Create separate production and development keys. For the production key set:

- Application restriction: **Websites (HTTP referrers)**
- Allowed website: `https://sutisukkawaguji-spec.github.io/*`
- API restrictions: **Maps JavaScript API** and **Places API (New)** only

For the development key allow only local origins such as `http://localhost/*`
and `http://127.0.0.1/*`. Do not reuse the production key locally. Configure
quotas, billing alerts, and usage monitoring for both keys.

For local development, copy `config.local.example.js` to `config.local.js` and
set the restricted development browser key there. The application loads this
ignored file only on localhost.

GitHub Pages project sites share the same origin, and browsers can omit the URL
path from the Referer header. A dedicated custom domain is required if the key
must be restricted to Survey ExtraPro rather than every project on the GitHub
Pages account.

After applying restrictions, put the production browser key in
`googleMapsBrowserKey` in `config.js`. This does not make the key secret; the
Google Cloud restrictions are the security boundary.

## Supabase

Only `supabasePublishableKey` may be shipped to the browser. Keep Row Level
Security enabled on every exposed table. Never put a Supabase secret key,
`service_role` key, database password, or unrestricted third-party key in this
repository or in browser storage.

Server-side credentials belong in Supabase Edge Function Secrets. The browser
should call an authenticated Edge Function, and the function should read its
credential from an environment variable.

## Development login bypass

The application permits the bypass only on `localhost` or `127.0.0.1`, and only
when `devBypassAuth` is explicitly enabled. Public GitHub Pages deployments
always require a normal authenticated session.
