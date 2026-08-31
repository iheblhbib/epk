# Custom Domains

Lets a workspace on the Business plan serve one EPK's public page from their own domain — `press.theirband.com` instead of `epk.karthagopm.com/epk/their-band`.

The app handles claiming a domain, proving ownership of it, and resolving requests once it's verified. It does **not** handle making the domain itself reachable — pointing DNS at your hosting and getting it a certificate is real infrastructure work that happens outside this codebase, on your host. This doc covers both halves: what happens automatically, and the manual steps you (the KORAX operator) walk an EPK owner through.

## How it works

1. In the EPK Builder, the owner opens **Custom domain** and enters the domain they want (`press.theirband.com`).
2. The app generates a one-time verification token and shows two DNS records to add:
   - A **TXT** record at `_kitfolio-challenge.press.theirband.com` proving they control the domain.
   - A **CNAME** record at `press.theirband.com` pointing at your app's own hostname (`epk.karthagopm.com`) — this is what actually routes visitors to your app once DNS propagates.
3. Once both are added, they click **Check verification**. The backend looks up the TXT record; if it matches, the domain is marked verified and the CNAME starts working end-to-end.
4. A visitor hitting `press.theirband.com` loads the exact same static frontend build as everyone else (that's what the CNAME points at) — the SPA notices its own hostname doesn't match `VITE_APP_HOSTNAME`, and instead of the normal app, renders that one EPK's public page, resolved via `GET /api/public/epks/by-domain` rather than by slug. See `frontend/src/App.tsx` and `CustomDomainEpkPage.tsx`.

An unverified `custom_domain` is never resolved publicly — simply typing someone else's live domain into the field does nothing until DNS ownership has actually been proven.

## 1. Set `VITE_APP_HOSTNAME`

In `frontend/.env` (or wherever your build pipeline sets frontend env vars):

```bash
VITE_APP_HOSTNAME=epk.karthagopm.com
```

This has to be the exact hostname your frontend build is deployed to. Rebuild and redeploy the frontend after setting it — it's baked in at build time, not read at runtime. Leaving it unset disables custom-domain resolution entirely (the app behaves exactly as it did before this feature existed); nothing else about deploying the frontend changes.

## 2. Point the custom domain's DNS at your app

The EPK owner does this at *their* DNS provider (wherever `press.theirband.com`'s nameservers are) — not yours:

- Add the **TXT** record the app showed them, exactly as given.
- Add a **CNAME** record: `press.theirband.com` → `epk.karthagopm.com`.

DNS changes can take anywhere from a few minutes to a few hours to propagate, depending on their provider's TTL — "Check verification" failing right after adding the record isn't necessarily wrong, just early.

## 3. Get the custom domain an SSL certificate

This is the step the app can't do for you. Once the CNAME is live, `https://press.theirband.com` needs its own valid certificate — browsers won't show the page at all over HTTPS without one, and won't reliably fall back to HTTP.

Two common paths on cPanel:

- **AutoSSL** (built into nearly every cPanel host): add `press.theirband.com` as an **Alias/Addon Domain** on the same account that serves `epk.karthagopm.com`'s document root, pointed at the *same* `frontend/dist` directory. cPanel's AutoSSL then issues it a free Let's Encrypt-backed certificate automatically, the same way it already covers your own domains — no separate purchase, but it only works once the CNAME is actually resolving to your server.
- **Manual certificate**: if AutoSSL isn't available or the domain lives on infrastructure cPanel doesn't manage, issue a certificate however your host normally handles one for an added domain (their own tooling, or `certbot` if you have shell + a web server you control) and install it against the same document root.

Either way, the target is: `press.theirband.com` serves the identical `frontend/dist` files as `epk.karthagopm.com`, over HTTPS, with a valid cert. Once that's true, DNS verification inside the app and the certificate are the only two prerequisites — everything else (which EPK to show, the theme, sections, analytics) is handled by the SPA + API exactly like the normal public page.

## Removing a custom domain

The owner can remove it from the same **Custom domain** dialog at any time — this clears the domain, its verification token, and verified status, and the EPK falls back to being reachable only at its normal `epk.karthagopm.com/epk/{slug}` link. It does **not** touch DNS or any certificate you set up outside the app; if the domain is being retired for good, remove the CNAME/Alias/AutoSSL config on your end too.

## Troubleshooting

- **"Check verification" keeps failing** — confirm the TXT record's host is exactly `_kitfolio-challenge.` prefixed onto the domain (not the bare domain), and that its value matches character-for-character. `dig TXT _kitfolio-challenge.press.theirband.com` (or an online DNS lookup tool) shows what's actually propagated.
- **Verified in the app, but the page doesn't load** — the CNAME/cPanel Alias/SSL steps are the usual culprits, not the app-side verification. Check `dig CNAME press.theirband.com` resolves to your app's hostname, and that the certificate covers that exact domain.
- **Domain already claimed by another EPK** — domains are globally unique across the whole app (the same way slugs are); the owner will need to remove it from whichever EPK has it first, or pick a different domain.
