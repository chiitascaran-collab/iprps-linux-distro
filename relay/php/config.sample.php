<?php
// IPRPS Link relay settings. Copy to config.php and edit. Every line is optional.
// The relay dashboard can change the settings marked (dashboard); its changes are kept in data/settings.json and win over this file.
return [
    // Who may connect a table (dashboard):
    //   'owners'   only the accounts in 'owners' below (no list: the first account that connects owns the relay)
    //   'open'     any Infinite Plane account; each Session Master is added the first time their IPRPS Link connects
    //   'approval' like open, but new Session Masters wait until you approve them in the dashboard
    'access' => 'owners',

    // access 'owners': Infinite Plane usernames or emails allowed to connect a table.
    'owners' => [],

    // Infinite Plane usernames or emails that may use the relay dashboard. Only set here, never from the dashboard.
    'admins' => [],

    // Where the relay dashboard page is served from (it must be on the site with the shared /auth/ folder).
    'dashboard_origins' => ['https://infiniteplane.space'],

    // Shown to Session Masters who are refused, and on the relay's front page (dashboard). For example 'support@example.com'.
    'contact' => '',

    // Players' link https://play.example.com/<name>/ instead of /t/<table>/ (dashboard). Names come from usernames.
    'friendly_links' => true,

    // Tables connected at the same time; 0 = no limit (dashboard). On shared web hosting, about 8.
    'max_online_tables' => 0,

    // Plans (dashboard). 0 = no limit. A Session Master's own limits in the dashboard win over their plan's.
    'default_plan' => 'free',
    'plans' => [
        'free'    => ['label' => 'Free',          'hours_per_month' => 0, 'gb_per_month' => 0, 'max_upload_mb' => 20],
        'monthly' => ['label' => 'Monthly',       'hours_per_month' => 0, 'gb_per_month' => 0, 'max_upload_mb' => 20],
        'payg'    => ['label' => 'Pay as you go', 'hours_per_month' => 0, 'gb_per_month' => 0, 'max_upload_mb' => 20],
    ],

    // The address players use for this folder, without a trailing slash. '' = work it out from the request.
    'public_url' => '',

    // Where Infinite Plane accounts are checked. On infiniteplane.space itself the relay finds /auth/ on its own.
    'auth_url' => 'https://infiniteplane.space/auth/',

    // Largest upload from a player, when the plan doesn't say (the IPRPS Table accepts 15 MB).
    'max_upload_mb' => 20,

    // How long one live-events response may stay open. Lower it if your host stops long requests (30 is safe almost everywhere).
    'stream_seconds' => 50,

    // true if this site sits behind a proxy or CDN that sets X-Forwarded-For.
    'trust_proxy' => false,
];
