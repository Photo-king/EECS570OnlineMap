> 历史探索记录：包含已废弃的室外叠图、旧 UI 和旧裁切方案。当前状态见 [../calibration.md](../calibration.md)。

# First-floor calibration (provisional)

Source: five latitude/longitude pairs supplied by the user on 2026-11-14, picked from Google Maps, with numbered corners on a screenshot. This is **First floor / Level 1**, identified by the McCauley clinics, Orthodontics and room 1033. No independent survey or phone field validation has been performed.

| Point | Latitude (WGS84) | Longitude (WGS84) | Full SVG x | Full SVG y | Corner interpretation |
| --- | --- | --- | --- | --- | --- |
| 1 | 42.27957036070683 | -83.73637611538639 | 1005.43 | 581.68 | Maize Clinic west wall, lower outside corner of north wing |
| 2 | 42.27957957305385 | -83.7356838237391 | 1534.99 | 579.071 | Blue Clinic east wall, corresponding north-wing corner |
| 3 | 42.27881494366865 | -83.73681066535926 | 649.95 | 1375.01 | Southwest exterior corner |
| 4 | 42.27881770740602 | -83.73665502425149 | 769.14 | 1375.01 | East end of the same southern exterior wall segment |
| 5 | 42.278884037066696 | -83.73550950569839 | 1665.52 | 1318.9 | Southeast exterior corner of east wing |

SVG correspondence uses wall path vertices in `Dental_Kellogg_First.svg`, with the enclosing `translate(-39 80)` applied. The screenshot crop and its red square centers are not used as SVG coordinates. These corner interpretations remain provisional until confirmed in person.

The app fits an affine transform using all five points by least squares. Per-point fit residuals in full SVG units: 4.31, 4.50, 0.74, 2.19, 2.71 (maximum roughly 0.5 m at this map's inferred scale). Leave-one-out residuals, fitting four points and predicting the fifth: 11.19, 10.77, 1.56, 3.81, 18.73 SVG units (maximum roughly 2 m). These measure internal agreement of the supplied picks and corner correspondence, **not absolute position accuracy**. Google imagery offsets and indoor device errors are not measured by these residuals.

Ground and Second now share physical corners 1–4 with First floor, following the user’s confirmation that the floors align vertically. Each has its own SVG coordinates, determined from corresponding exterior wall vertices. Point 5 is not used for the other floors because the east-wing silhouettes differ there. Union remains an overview without positioning.

| Point | Ground SVG x / y | Second SVG x / y |
| --- | --- | --- |
| 1 | 1119.521 / 611.115 | 1125.84 / 607.5665 |
| 2 | 1662.043 / 606.261 | 1656.8625 / 605.6135 |
| 3 | 769.6197 / 1402.7717 | 772.6125 / 1401.3575 |
| 4 | 888.8257 / 1402.7717 | 892.6125 / 1401.3575 |

Ground vertices are in the restored wall layer: its scale(4/3) cancels the enclosing scale(3/4), then translate(-39,80) applies. Second-floor source vertices are (1553.12,703.422), (2261.15,700.818), (1082.15,1761.81), (1242.15,1761.81); apply scale(3/4) then translate(-39,80). The geographic coordinate of a physical corner is reused unchanged across levels. Map display bounds cover the building and immediate surroundings but exclude the page’s legends and title; they do not represent walkable room polygons.

To validate: open `?level=first` over HTTPS, select Enable location, and compare the dot and reported GPS accuracy with a known real position. Start near an exterior corner. Then check an additional point not used in the fit. The selected floor remains manual.

## Outdoor raster registration and building extraction

The user supplied `Mapsv1.0/mapoutside.png` (1842 × 1208), north-up. Its matching corner pixel picks (x/y from image top-left) are: 1 = 1125/526; 2 = 1279/523; 3 = 1035/729; 4 = 1067/729; 5 = 1298/710. These are visual picks on the building outline; the screenshot contains no embedded coordinates. Their WGS84 coordinates remain the original user-supplied values. Outdoor placement is approximate and requires an independent field check.

For each floor, the app projects its surveyed corner coordinates into this raster coordinate system, then fits an affine transform from the original full-SVG units to raster pixels. Thus floor overlays and GPS markers share one world coordinate system and north-up orientation; each floor's distinct source translation/scale is preserved in its transformation. The original isometric Union illustration is a reference panel, not a geographically registered floor. Overview now shows the campus image with the registered First-floor building outline.

Exterior footprint polygons are recorded in `scripts/prepare-maps.py` and generated into `map-footprints.js`. They clip decorative page elements and supply approximate inside-building status. Source SVGs and their existing anchor coordinates are unchanged. All three individual level overlays have transparent surroundings; the original white backgrounds remain only inside their building footprints, where they provide corridor fills. Reference notes and keys are separate vector crops anchored to the viewport.

## North-up geometry correction

The active registration supersedes the free affine raster alignment above. Raster landmarks were rechecked on a 4× pixel grid: 1 = 1124.5/526.5; 2 = 1277.5/523.5; 3 = 1035.5/727.5; 4 = 1067.5/727.5; 5 = 1298/707.5.

`registration.mjs` now fits independent positive X/Y scales and translation only, with zero off-diagonal matrix terms. There is no added rotation or shear. Ground and Second first register to the common First-floor frame under the same constraints; all levels then share the campus transform. Geographic fixes project to that common building frame before rendering, so the map and marker use the same registration. Original floor-plan wall geometry stays intact. The two axis scales may differ because the schematic and raster do not have identical proportions.

First-floor-to-raster residuals at the five landmarks are 4.61, 8.34, 2.00, 2.19 and 7.04 image pixels. This is the measured limit of the constrained fit to this schematic and screenshot; it is not survey-grade agreement. It cannot be reduced to zero at every landmark without deforming the drawing or acquiring a more geometrically consistent floor plan/registration source.

Default view uses the actual transformed footprint bounding box and viewport dimensions, centering and enlarging the building. A minimum cover scale and clamped translation prevent raster edges from exposing an empty canvas. Screens with a different aspect ratio crop a portion of the raster at minimum zoom rather than stretch the raster. The Campus button selects this minimum scale; Center building returns to the initial close view. References start collapsed; short landscape viewports also start with the coordinate readout collapsed.

## Current behavior: indoor-only

At the user's request, the outdoor bitmap has been removed from rendering and network loading. The shared coordinate frame is now the original First-floor SVG: the former `campusMatrix` is the identity matrix. Ground and Second retain only their no-shear/no-rotation registration to that indoor frame. Geographic fixes project directly to the original building calibration; outdoor landmark picks no longer influence geometry or location.

Default/minimum zoom uses contain-fit of the complete selected indoor footprint with padding for map controls. Zooming out is clamped at that fit and recenters the map. Neutral margins are allowed to preserve the complete plan on screens of different aspect ratios. The original outdoor asset is retained on disk but unused by the page.

## Ground artwork correction against the supplied PNG

The previous Ground footprint was incorrectly used as both a visual clipping mask and an extra exterior wall. Ground now renders its original SVG building artwork through a rectangular crop (x=745, y=320, width=1065, height=1135 in full SVG units). Its 209 original restored-wall elements and their transforms are preserved unchanged. There is no added polygon stroke on Ground. Its metadata footprint was corrected using the source wall vertices and remains separate from rendering. Source wall openings, courtyard voids and corridors therefore follow the provided reference PNG.

The obsolete First-floor highlight SVG has also been removed from the interactive scene: it previously remained visible beneath other plans because assigning `.hidden` to an SVG element did not reflect a hidden attribute. Overview continues to display its independent original static artwork.
