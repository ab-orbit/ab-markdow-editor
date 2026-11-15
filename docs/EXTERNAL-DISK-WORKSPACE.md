# Working from an exFAT external disk

Scriba must be built from an APFS (or HFS+) volume. On exFAT, macOS stores
extended attributes in AppleDouble `._*` companion files, and those files break
the build in two measured ways:

- **Git:** `._pack-*.idx` files appear inside `.git/objects/pack` and every
  command reports `error: non-monotonic index .git/objects/pack/._pack-….idx`.
- **Code signing:** `npm run build` stops at `scripts/build-picker.mjs` with
  `Operation not permitted … ._Resources` and
  `osacompile: couldn't write to file … AB Markdown Folder Picker.app`.
  `install.sh` and `npm run ios:archive` sign bundles as well and hit the same
  limitation.

`tsc`, `vite build` and `npm test` pass on exFAT. Everything that signs an
`.app` does not.

## Layout: an APFS disk image on the external disk

Keep the checkout inside an APFS sparse bundle stored on the external disk,
mounted at the path where the repository is expected. A sparse bundle is not a
partition. It is a folder of 8 MB band files that grows as data is written, up
to the size given at creation. The size is a ceiling, not space reserved up
front, and the exFAT disk stays as it is.

```text
<parent>/ab-scriba.sparsebundle   # the image (a folder on exFAT)
<parent>/ab-scriba                # its APFS volume, mounted here; the Git checkout
```

### Create (once)

```sh
P=/path/to/parent          # directory on the external disk
hdiutil create -size 50g -type SPARSEBUNDLE -fs APFS -volname ab-scriba \
  "$P/ab-scriba.sparsebundle"
mkdir -p "$P/ab-scriba"
hdiutil attach -nomount "$P/ab-scriba.sparsebundle"
sleep 2   # the APFS container appears a moment after the attach returns
VOL=$(diskutil list | awk '/APFS Volume ab-scriba/{print $NF}')
diskutil mount -mountPoint "$P/ab-scriba" "$VOL"

# The volume root already holds .fseventsd, so clone beside it and move .git in.
cd "$P/ab-scriba"
git clone --no-checkout git@github.com:ab-orbit/ab-markdow-editor.git .clone-tmp
mv .clone-tmp/.git .git && rmdir .clone-tmp
printf '.fseventsd/\n.Spotlight-V100/\n.Trashes/\n.TemporaryItems/\n' >> .git/info/exclude
git checkout main
npm ci
```

`hdiutil attach -mountpoint <exFAT dir>` fails with `Permission denied`.
Attaching first and then calling `diskutil mount -mountPoint` works. The volume
lives on a synthesized container disk, not on the `Apple_APFS` partition that
`hdiutil attach` prints, so it is looked up by name in `diskutil list`.

### Mount again (after reboot or reconnecting the disk)

The image is not mounted automatically. Before using the checkout:

```sh
P=/path/to/parent
hdiutil attach -nomount "$P/ab-scriba.sparsebundle"
sleep 2   # the APFS container appears a moment after the attach returns
VOL=$(diskutil list | awk '/APFS Volume ab-scriba/{print $NF}')
diskutil mount -mountPoint "$P/ab-scriba" "$VOL"
mount | grep "$P/ab-scriba"   # must show (apfs, …)
```

If `$P/ab-scriba` lists an empty folder, the image is not mounted. Do not
clone into it; mount the image first.

### Unmount (before disconnecting the disk)

```sh
diskutil unmount "$P/ab-scriba"
hdiutil detach "$(hdiutil info | awk '/ab-scriba.sparsebundle/{f=1} f&&/^\/dev\/disk[0-9]+\t/{print $1; exit}')"
```

### Reclaim space

Deleted files do not shrink the bundle. To give the space back to the exFAT
disk, unmount the image first and then run:

```sh
hdiutil compact "$P/ab-scriba.sparsebundle"
```

### Verify

```sh
cd "$P/ab-scriba"
find . -name '._*' -not -path './node_modules/*' | wc -l   # 0
npm run build    # ends with "AB Markdown Folder Picker.app: replacing existing signature"
npm test
```
