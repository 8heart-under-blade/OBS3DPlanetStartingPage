# Asset audit — openly licensed replacement set

Updated 2026-11-08. This is a provenance record, not legal advice or runtime certification.

## Current result

The eight unresolved entries from P0 have been removed or resolved using newly
downloaded upstream assets and explicit license evidence. The inventory now covers
19 bundled third-party files: 12 Three.js files (MIT), five textures (CC BY 4.0),
and two fonts (SIL OFL 1.1). There are no unresolved entries in the current set.

## Textures

Source and explicit license grant: https://www.solarsystemscope.com/textures/
The grant was independently checked in the original page HTML, including its
CC BY 4.0 hyperlink. See [stored evidence](licenses/SolarSystemScope-source.txt),
[bundled terms](licenses/CC-BY-4.0.txt), and [inventory](asset-inventory.json).

- Earth day, night, clouds and Moon: fresh downloads, byte-identical to upstream.
- Earth specular: fresh upstream TIFF converted to PNG using Windows
  System.Drawing Image.Save(Png); decoded 2048×1024 RGB samples were checked
  against the TIFF. Ocean remains white, land black; no resampling or inversion.
- All five maps are 2048×1024 equirectangular.
- Unused earth_clouds_1024.png removed.
- Existing SSS 2k cloud file was independently confirmed byte-identical to the
  fresh download, not cleared merely because of its filename.
- Render fallbacks now point at these same local assets, not unverified examples.

Retain attribution, license link, and the conversion notice. The Thanks scene
includes visible credit; credits.html and ATTRIBUTIONS.md provide full details.
Streamers who crop the credit should provide equivalent attribution with the video.

## Fonts

Cinzel Decorative Regular replaces Oracles; Macondo Regular replaces Twigs.
Both are unmodified TTFs downloaded from google/fonts at pinned commits recorded
in the inventory. Their complete upstream OFL files, including copyright notices,
ship in docs/licenses/. No conversion or font renaming was performed.
The pinned Macondo OFL.txt already has two U+FFFD replacement characters;
a fresh raw-byte fetch matched our bundled notice exactly (SHA-256
0d75673e4c98de3e11337dbd90b05d0232edfcade5c1c02fbc0118c85aea25da).
Its original bytes are retained, and ATTRIBUTIONS.md reproduces the readable
copyright statement from the unmodified TTF name table rather than guessing
an upstream encoding or silently rewriting the license.
The existing runtime loaders already support TTF/truetype.

## Limits and qualification

This deliberately changes typography and Earth/Moon appearance. It is not
pixel-identical to the original. Camera, lighting, animation and other numerical
scene settings are unchanged. The user accepted the preview visually and reports
OBS playback with working audio interaction; see BASELINE.md for the limited
manual smoke record. Recorded visual references and full performance/lifecycle
qualification remain outstanding; the 2k Moon increases texture memory compared
with the original 1k map.

The historical P0 source manifest is retained as source-baseline-p0.json.
The active manifest records this intentional asset migration and must not be used
to claim visual parity. A passing release:check means static asset eligibility,
not an end-user production release.
