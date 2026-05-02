# AgriSenseIoT Frontend

> React + Vite dashboard client for the AgriSenseIoT platform (frontend-only).

This repository contains the web user interface for agricultural IoT monitoring, device management, analytics, alerts, and automation rules. Back-end services are implemented in a separate repository:

- https://github.com/savvyinsight/AgriSenseIoT

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

- `src/pages` – page routes (`Login`, `Dashboard`, `Alerts`, `Analytics`, `MapView`, `DeviceManagement`, `AlertRules`, `AutomationRules`)
- `src/components` – reusable components (`SensorChart`, `TemperatureChart`, `DeviceCard`, etc.)
- `src/api` – API client and HTTP wrappers
- `src/hooks` – custom hooks (`useWebSocket`)
- `src/store` – auth context and global state
- `src/assets` – static images/assets
- `src/locales` – i18n JSON files
- `docs` – requirements/design/implementation docs

## ⚙️ Tech stack

- React + Vite
- Material UI (MUI)
- Chart.js
- WebSocket
- i18next (i18n)
- ESLint config

## 🚀 Quick start

```bash
git clone https://github.com/<your-org>/agrisense-frontend.git
cd agrisense-frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

> Backend API is not included in this repository. Configure endpoints via `src/api/client.js` or env vars.

## 🛠 Build

```bash
npm run build
npm run preview
```

Result is output in `dist/`.

## 🌐 Live demo

Publicly deployed frontend: [http://47.94.43.108](http://47.94.43.108)

Demo admin credentials (for evaluation only):
- email: `kaiyumu@qq.com`
- password: `test123`

## 🔗 Backend repository

- https://github.com/savvyinsight/AgriSenseIoT

The existing API reference and implementation is in the backend repository. The frontend expects an API base URL such as `http://47.94.43.108:8080/api/v1` (development default).

## 🛡 Contributing

1. Fork repository
2. Create branch `feat/<name>` or `fix/<name>`
3. Open pull request with summary and testing steps

Optional:
- Add `CONTRIBUTING.md`
- Add `CODE_OF_CONDUCT.md`
- Add GitHub issue/PR templates

## 🧾 License

Add license information (e.g., MIT):

```text
MIT License
Copyright (c) 2026 savvyinsight
```

## 📌 Additional notes

- Purely frontend code; no backend inside this repo.
- Backend service should be run from https://github.com/savvyinsight/AgriSenseIoT.

