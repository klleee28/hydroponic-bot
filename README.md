# Hydroponic Reservoir

An iPhone-first, offline PWA for monitoring one hydroponic reservoir. All behavior is deterministic: the app uses user-defined crop ranges, calendar arithmetic, and data stored locally in IndexedDB. It contains no AI, machine learning, predictions, accounts, analytics, or cloud synchronization.

## Features

- Fast daily logging with large pH, EC, water-temperature, and water steppers
- One reservoir reading per local day; later saves update that day in place
- Automatic prefill from today's reading or the most recent prior log
- Green, amber, and red shared-threshold feedback while values are adjusted
- pH and EC charts for 7 days, 30 days, 3 months, 6 months, or all history
- Multi-select reservoir crops and editable crop target ranges
- Offline crop preset library sourced from Oklahoma State University Extension
- Full JSON backup/restore and spreadsheet-ready CSV reading export
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

## Offline crop library

The bundled presets are static copies of the ranged crop values in Table 2 of
[Oklahoma State University Extension HLA-6722](https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics).
They work without a network connection. Presets are starting points rather than
predictions, and each added crop remains editable for a particular cultivar,
growth stage, system, or water source. Custom crops remain available.

## Backup and restore

Settings includes a **Backup & data** section:

- **Full JSON backup** contains crops, readings, maintenance tasks, and selected
  reservoir crops. Restore validates the complete versioned file and shows a
  confirmation summary before replacing local data.
- **Readings CSV** contains date, time, pH, EC, water temperature, water added,
  and notes for spreadsheet use.

On supported iPhones the app opens the Share Sheet so files can be saved to
Files or iCloud Drive. Other browsers receive a normal file download. No backup
is uploaded automatically and no cloud account is required by the app.

Once reservoir readings exist, the Dashboard shows a weekly backup reminder if
no full backup has been saved or the last one was saved at least seven days ago.
The same reminder appears immediately after saving a due daily log. Successfully
saving or sharing a full JSON backup starts the next seven-day interval; a CSV
export does not. The reminder is checked when the app is open—iOS does not allow
this offline-only app to create backup files unattended in the background.

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

The tests cover backup validation and restoration, the weekly backup schedule,
CSV escaping, offline preset data, shared crop ranges, threshold bands,
recurring due dates, local day boundaries, one daily update, and one chart point
per day.

## Local storage

IndexedDB database: `HydroponicReservoirDB`

- `crops`: auto-incremented `id`
- `logs`: auto-incremented `id`, indexed `timestamp`
- `tasks`: auto-incremented `id`

Reservoir crop membership is stored separately in versioned local storage under `hydroponic.reservoirCropIds.v1`, preserving the requested three-table database schema. Existing installs migrate their previous active crop without silently changing its thresholds.

## Visual reference

The implementation reference is stored at `design/ios-interface-reference.png`. It is a design artifact only and is not loaded by the application.
