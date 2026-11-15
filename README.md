# EECS 570 Indoor Explorer

A buildless static indoor map for Dental & Kellogg. Run `python3 -m http.server 5700`, then visit http://localhost:5700. No backend or API keys.

## Current map behavior

Overview comes first, followed by Ground, First and Second. Overview is the default main page and shows the unmodified original Union SVG as a static, fully contained image. It has no map zoom, drag, location controls or separate reference panels. Individual levels show the original vector floor plans without page titles, navy borders or off-map notes. The outdoor bitmap is no longer displayed or loaded. Original assets remain in `Mapsv1.0/`.

For G/1/2, the default and minimum zoom fit the **entire selected indoor footprint** within the available viewport, including desktop and phone portrait/landscape layouts. Minimum zoom reads 100%; zooming out further is prevented and restores the centered complete map. The fit button returns to this view. The map may have neutral space around it to accommodate differing device aspect ratios.

Legend & notes is fixed to the viewport, independently scrollable and collapsible. All G/1/2 levels use the First-floor symbol/color key, while destination notes remain floor-specific. Generated building assets remove rounded colored label chips and their duplicate glyph overlays, preserving original room lettering and area colors. GPS coordinates can also be collapsed. The page supports drag, wheel/button zoom, manual floor selection, level links for QR codes, copy coordinates and My location.

## GPS and manual tests

HTTPS is required for device GPS (localhost works for desktop). Enable location and grant browser permission; previously granted permission resumes automatically. Latitude, longitude, reported accuracy and last update time are shown continuously. Data stays in browser memory.

Open **Test a coordinate**, enter a latitude and longitude, then select **Show test position**. The default `42.2792, -83.7362` is an inside-building test. Test mode pauses GPS and labels the marker/readout TEST. Switching levels retains the test coordinate. **Return to GPS** resumes device updates.

Blue means live GPS, amber means manual test, gray means last known GPS position. Temporary errors keep the watcher active. All valid geographic fixes are rendered independently of the building boundary; the viewport naturally clips off-screen markers. Coordinate readouts keep updating even outside the building, with an explicit GPS-drift note. My location can recenter on an outside fix. Inside/outside status uses the traced building footprint.

`registration.mjs` uses the original First-floor SVG as a shared indoor coordinate frame. Ground and Second register to its common corners with independent axis scale/translation, without rotation or shear. GPS projects into this same indoor frame; no outdoor raster registration influences map geometry or location. Calibration is based on the user's five Google Maps coordinates; field checks are still needed.

## Assets and checks

`map-data.js` contains levels and calibration anchors. `map-footprints.js` and `public/maps/*-building.svg`, `*-notes.svg`, `*-key.svg` are generated without changing source files. Ground uses a rectangular artwork crop, preserving all original wall geometry and courtyard openings instead of clipping to a hand-traced outline. Its metadata footprint is used for fit/inside status only, not drawn as extra walls:

```sh
python3 scripts/prepare-maps.py
node --test tests/positioning.test.mjs
node --check app.js
```

[Calibration history](docs/calibration.md) records previous indoor/outdoor alignment work. Its latest section describes the current indoor-only behavior.

## Deployment

Existing site: https://map.solvaneon.com/. Local changes are not deployed automatically. Upload `index.html`, `style.css`, `app.js`, `map-data.js`, `map-footprints.js`, `positioning.mjs`, `registration.mjs`, `public/`, and `Mapsv1.0/` together into a new static release. Serve `.mjs` as JavaScript. nginx configuration is in `deploy/school-map.conf`.

`README-school-map.md` is historical; this README describes the current implementation.
