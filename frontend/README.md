# AgriSense Frontend

> React + Vite dashboard client for the AgriSense platform.

This frontend provides the web interface for agricultural IoT monitoring, device management, analytics, alerts, and automation.
The backend services live in the same monorepo under `../backend`.

---

## 🧩 Project scope

- Frontend-only single-page application (SPA)
- Authentication and session management
- Device inventory and control in UI
- Time-series sensor charts (temperature, humidity, etc.)
- Real-time sensor data updates via WebSocket
- Alerts and rule configuration panels
- Map rendering for device locations
- i18n support (English + Chinese)

## 📁 Repository structure

- `src/features/` – feature modules (auth, devices, sensors, alerts, analytics, automation)
- `src/shared/` – shared components, hooks, and TypeScript types
- `src/api/` – Axios client and API wrappers
- `src/assets/` – static assets and styles
- `src/locales/` – i18n JSON files
- `src/App.tsx`, `src/i18n.ts`, `src/main.tsx` – application entrypoints
- `docs/` – frontend-specific design docs

## ⚙️ Tech stack

- React 19 + TypeScript
- Vite
- Material UI (MUI)
- Chart.js and Recharts
- Leaflet for maps
- Axios for API requests
- i18next for internationalization
- ESLint

## 🚀 Quick start

```bash
git clone https://github.com/savvyinsight/agrisense.git
cd agrisense/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

> Backend API is not included in this frontend package. The monorepo backend is available at `../backend`.
> Configure endpoints via `src/api/client.ts` or environment variables.

## 🛠 Build

```bash
npm run build
npm run preview
```

Result is output in `dist/`.

## 🔗 Backend repository

The backend implementation is available in the same repo under `../backend`.

The frontend expects an API base URL configured in `src/api/client.ts` or by environment variables.

## 🛡 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for full guidelines.

## 🧾 License

MIT License — see [LICENSE](../LICENSE) file for details.

