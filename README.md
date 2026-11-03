# Nullnote

I'd like to make Desktop app / Web app like Notesnoook. Private by default, zero knowledge notebook and private nocloud share of folders etc like in notion but you are able to once its like this shared its like realtime editing and colaboration . No server, no cloud. Minimalist modern UI

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nullnote.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ceb0aa28-6523-4bc2-9971-cbf345e1899d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### Test on a phone

Mobile browsers disable Web Crypto on a plain HTTP LAN address. Use a trusted HTTPS certificate for the computer's LAN IP (for example, with [mkcert](https://github.com/FiloSottile/mkcert)), and trust mkcert's local CA on the phone:

```sh
mkdir -p .cert
mkcert -key-file .cert/dev-key.pem -cert-file .cert/dev-cert.pem localhost 127.0.0.1 <LAN-IP>
NULLNOTE_HTTPS_CERT=.cert/dev-cert.pem NULLNOTE_HTTPS_KEY=.cert/dev-key.pem npm run dev -- --host 0.0.0.0
```

Open the HTTPS address and port printed by Vite on the phone. The certificate must be trusted by the phone; accepting a browser warning may not enable secure-context APIs. Keep the certificate and private key local and do not commit them.

## Automatic deployment

Pushes to `main` build desktop prerelease installers, publish them to GitHub Releases, and deploy the web app with Nitro to the existing Cloudflare Worker. Configure these GitHub Actions repository secrets for the Worker deployment:

- `CLOUDFLARE_API_TOKEN` with permission to deploy Workers in the account.
- `CLOUDFLARE_ACCOUNT_ID` for the account that owns `nullnote.dxvil.com`.

Version tags (`vX.Y.Z`) publish stable desktop releases. Main-branch builds use semver prerelease tags so Electron's GitHub updater can discover the Linux AppImage prerelease feed.

## Editor plugins

The editor exposes `EditorPlugin` and `registerEditorPlugin` from `src/lib/editor-plugins/registry.ts`. Plugins are TypeScript modules bundled with the app; arbitrary remote scripts are not loaded. A plugin returns cursor-context completions with the text range to replace:

```ts
registerEditorPlugin({
  id: "community.example",
  name: "Example",
  suggest: ({ textBeforeCursor }) =>
    textBeforeCursor.endsWith("!hello")
      ? [
          {
            pluginId: "community.example",
            title: "Hello",
            detail: "Insert a greeting",
            insertText: "Hello!",
            deleteBefore: 6,
          },
        ]
      : [],
});
```

Built-in Calculator completions recognize arithmetic followed by `=`; Calendar completions recognize `@date`, `@today`, `@tomorrow`, and `@yesterday`. Tab or Enter inserts a suggestion, while Escape dismisses it.
