# WebPages - An [LNbits](https://github.com/lnbits/lnbits) Extension

Admin-only editor for managing static HTML, CSS, and JavaScript files served from `static/pages`.

## Features

- Admin-only create, edit, and delete for `.html`, `.css`, and `.js` files
- Admin-only upload and delete for image assets (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.ico`, `.avif`)
- Live HTML preview while editing
- Autosave support
- File list with quick delete actions
- Caddyfile sample dialog for reverse proxy setup

## Usage

1. Enable the WebPages extension in LNbits.
2. Open `WebPages` from the admin sidebar.
3. Create or edit files under `static/pages`.
4. Access files at `/webpages/static/pages/<file>`.

## Reverse Proxy Example (Caddy)

```caddy
lnbits.yoursite.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:5000
}

yoursite.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:5000

  @root path /
  rewrite @root /webpages/static/pages/index.html
}
```

## Notes

- Static pages are public routes by design.
- Edit APIs and extension UI are admin-protected.
