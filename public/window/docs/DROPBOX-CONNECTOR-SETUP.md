# Dropbox connector setup

The Library Dropbox connector is read-only. It uses the Dropbox OAuth authorization-code flow with offline refresh access. Dropbox refresh tokens are encrypted with AES-256-GCM and stored per Firebase user in Cloud Firestore. The Dropbox App Secret and refresh tokens are never sent to browser JavaScript.

## 1. Dropbox app settings

Create a Dropbox **Scoped access** app with **Full Dropbox** access if the Library should browse the user's existing Dropbox folders.

Enable exactly these permissions on the Permissions tab:

- `files.metadata.read`
- `files.content.read`

Keep all write permissions disabled.

Under Settings → OAuth 2, register this exact Redirect URI:

```text
https://jupiterastrology108.com/api/dropbox
```

Keep **Allow public clients** OFF. This connector uses a server-side authorization-code exchange. The app can remain in Development while the owner tests it; other Dropbox users need to be added/approved according to Dropbox's app-development/production limits before broader rollout.

## 2. Vercel environment variables

Add these to the Jupiter Astrology Vercel project. Set Production and Preview as needed.

| Variable | Value |
|---|---|
| `DROPBOX_APP_KEY` | App key from Dropbox Developer Console |
| `DROPBOX_APP_SECRET` | App secret from Dropbox Developer Console (Secret) |
| `DROPBOX_REDIRECT_URI` | `https://jupiterastrology108.com/api/dropbox` |
| `DROPBOX_STATE_SECRET` | A new random secret, at least 32 random bytes |
| `DROPBOX_TOKEN_ENCRYPTION_KEY` | A separate random 32-byte key, Base64 or 64-character hex |
| `GOOGLE_CLOUD_PROJECT` | `jupiter-astro` (optional; this is the default) |
| `FIREBASE_WEB_API_KEY` | Optional; the project's public Firebase Web API key is used as a code fallback |
| `DROPBOX_POST_CONNECT_URL` | Optional; defaults to the main Jupiter Astrology Library page |

Generate independent random secrets locally:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

Use one generated value for `DROPBOX_STATE_SECRET` and the other for `DROPBOX_TOKEN_ENCRYPTION_KEY`. Keep them in a password manager. Do not commit them to GitHub or put them in public files. Losing the encryption key makes existing encrypted Dropbox refresh tokens unreadable; users would need to disconnect/reconnect.

The existing Vercel variables `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY` are also used to access Firestore through the Google service-account OAuth flow. They must remain configured.

## 3. Enable Firestore token storage

In the Google Cloud Console for project `jupiter-astro`:

1. Enable the **Cloud Firestore API**.
2. Create the default Cloud Firestore database `(default)` in Native mode if one does not already exist.
3. Open IAM & Admin → IAM.
4. Find the service account whose email is stored in Vercel as `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`.
5. Grant it **Cloud Datastore User** (`roles/datastore.user`).

The connector creates one document per Firebase user at:

```text
dropboxConnections/{firebaseUid}
```

Only the encrypted refresh token, Dropbox account ID, provider identifier and connection timestamp are stored. Firestore access uses the server's service account and IAM; no service-account key is sent to the browser.

## 4. OAuth and user flow

1. A signed-in, email-verified Firebase user selects Dropbox in Library.
2. The browser calls `POST /api/dropbox?action=connect` with that user's Firebase ID token.
3. The server creates a short-lived, signed HttpOnly/Secure/SameSite=Lax state cookie and returns the Dropbox authorization URL.
4. Dropbox redirects to `/api/dropbox` with the authorization code and state.
5. The server verifies state, exchanges the code using the App Secret, encrypts the refresh token, stores it against the Firebase UID, and returns to the Library page.
6. The browser requests folder metadata and file downloads through the authenticated same-origin API. The server refreshes Dropbox access tokens as needed.

API actions:

- `POST /api/dropbox?action=connect`
- `GET /api/dropbox?action=status`
- `GET /api/dropbox?action=list&path=/`
- `GET /api/dropbox?action=list&cursor=...`
- `GET /api/dropbox?action=download&path=/folder/file.docx`
- `GET /api/dropbox?action=convert-docx&path=/folder/file.docx`
- `POST /api/dropbox?action=disconnect`

The DOCX-to-PDF action reuses the existing Vercel → Gotenberg/LibreOffice converter and its existing `DOCX_PDF_CONVERTER_*` environment variables. DOCX conversion is limited to 50 MB; browser preview is limited to the Library's existing 150 MB cap.

## 5. Validation after deployment

1. Confirm `https://jupiterastrology108.com/api/dropbox` is the URI registered in Dropbox.
2. Sign in with a verified Jupiter Astrology account.
3. Open Library → Dropbox → Connect Dropbox.
4. Approve the read-only Dropbox permissions.
5. Confirm folders and files load.
6. Open a PDF, DOCX, spreadsheet and PPTX to test the existing viewers.
7. Test DOCX → PDF with the Render converter.
8. Test Disconnect and confirm the Dropbox account returns to the connect prompt.

## Security notes

- Dropbox API tokens remain server-side.
- Firebase ID tokens are verified through Firebase Authentication before each API action.
- The OAuth state is HMAC-signed and tied to the Firebase UID.
- Refresh tokens are encrypted at rest using AES-256-GCM.
- The connector has no Dropbox upload, edit, move, share or delete actions.
- File content is streamed back through the authenticated Vercel API; no Dropbox access token is exposed to the client.
