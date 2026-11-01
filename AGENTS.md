<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Local-first, no backend: each folder is a Yjs doc, stored AES-GCM encrypted in IndexedDB with a PBKDF2-derived vault key (src/lib/vault.ts) — zero-knowledge by design.
- Live sharing syncs folder Yjs docs over WebRTC via trystero/nostr (src/lib/p2p.ts); relays only signal, payloads are encrypted again with the share key carried in the link hash.
- The app route is ssr:false because everything depends on browser crypto/IndexedDB/WebRTC.
