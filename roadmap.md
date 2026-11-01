# Roadmap

## Done
- [x] Invert app icon: black tile, white mono "n" (src/assets/icon-dark.png)
- [x] Regenerate favicon.png, icons 180/192/512, electron/icon.ico from inverted icon
- [x] Point root favicon link at /favicon.png; remove stale favicon.ico
- [x] Wire icon into electron/build.sh (staging + --icon for win)

## Open
- [ ] Repackage 4 desktop targets with new icon -> refresh zips in /mnt/documents (running in background, /tmp/pack-all.log)
- [ ] SEO review: trigger scan, read findings, fix failing issues
