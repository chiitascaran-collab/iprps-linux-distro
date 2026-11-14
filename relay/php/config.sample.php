<?php
// IPRPS Link relay settings. Copy to config.php and edit. Every line is optional.
return [
    // The address players use for this folder, without a trailing slash. '' = work it out from the request.
    'public_url' => '',

    // Infinite Plane usernames or emails allowed to connect a table to this relay.
    // Leave empty and the first account that connects becomes the owner (stored in data/owner.json).
    'owners' => [],

    // Where Infinite Plane accounts are checked. On infiniteplane.space itself the relay finds /auth/ on its own.
    'auth_url' => 'https://infiniteplane.space/auth/',

    // Largest upload from a player (the IPRPS Table accepts 15 MB).
    'max_upload_mb' => 20,

    // How long one live-events response may stay open. Lower it if your host stops long requests (30 is safe almost everywhere).
    'stream_seconds' => 50,

    // true if this site sits behind a proxy or CDN that sets X-Forwarded-For.
    'trust_proxy' => false,
];
