# Hydroponic Reservoir

An iPhone-first, offline PWA for monitoring one hydroponic reservoir. All behavior is deterministic: the app uses user-defined crop ranges, calendar arithmetic, and data stored locally in IndexedDB. It contains no AI, machine learning, predictions, accounts, analytics, or cloud synchronization.

## Features

- Fast daily logging with large pH, EC, temperature, and water steppers
- One reservoir reading per local day; later saves update that day in place
- Automatic prefill from today's reading or the most recent prior log
- Green, amber, and red shared-threshold feedback while values are adjusted
- pH and EC charts for the last 7, 14, or 30 days, with one point per day
- Multi-select reservoir crops and editable crop target ranges
- Recurring maintenance tasks with deterministic due dates
- Dexie/IndexedDB persistence and Workbox precaching for offline use
- iOS standalone metadata, safe-area layout, and generated PWA icons

## Deterministic shared threshold rule

Each reservoir log belongs to the single reservoir, not to an individual crop.
For all crops selected in **Crops in this reservoir**, the app calculates:

- **Shared minimum:** the highest selected crop minimum.
- **Shared maximum:** the lowest selected crop maximum.
- **Incompatible mix:** shared minimum is higher than shared maximum for pH or EC.

For the resulting shared range `[minimum, maximum]`:

- **Red:** value is outside the range.
- **Amber:** value is inside the range and within 10% of the range span from either boundary.
- **Green:** value is in the remaining middle 80%.

No historical trend, inference, or prediction changes this result.

## Local development

```powershell
npm install
npm run dev
```

The default address is `http://localhost:8114`. Vite binds to `0.0.0.0`, so the laptop's LAN address is also exposed. Change the host or port in `.env`:

```dotenv
APP_HOST=0.0.0.0
APP_PORT=8114
```

Vite uses `strictPort`, so it will stop rather than silently selecting another application's port.

## Production build

```powershell
npm run build
npm run preview
```

`npm run preview` serves the built output on the same configured host and port for local verification. For an always-on laptop deployment, serve `dist/` from a static HTTPS server or reverse proxy.

## iPhone installation and HTTPS

Safari requires a trusted HTTPS origin for service-worker installation when the phone connects through a LAN IP. Configure a trusted local certificate on the laptop or place the built app behind an HTTPS reverse proxy, then open the HTTPS LAN address in Safari and choose **Add to Home Screen**.

Plain `http://192.168.x.x:8114` can display the development UI but is not a reliable installable-PWA origin on iOS.

## Verification

```powershell
npm test
npm run lint
npm run build
```

The tests cover shared crop ranges, threshold bands, overall severity, recurring due dates, local day boundaries, and one chart point per day.

## Local storage

IndexedDB database: `HydroponicReservoirDB`

- `crops`: auto-incremented `id`
- `logs`: auto-incremented `id`, indexed `timestamp`
- `tasks`: auto-incremented `id`

Reservoir crop membership is stored separately in versioned local storage under `hydroponic.reservoirCropIds.v1`, preserving the requested three-table database schema. Existing installs migrate their previous active crop without silently changing its thresholds.

## Visual reference

The implementation reference is stored at `design/ios-interface-reference.png`. It is a design artifact only and is not loaded by the application.
