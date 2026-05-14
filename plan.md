# Weather Integration for Dashboard - Phase 1

## Overview
Enhance the Dashboard to display detailed weather information with risk assessment in the status bar section.

## Current State
- Dashboard already imports `getCurrentWeather()` API
- `weatherText` state displays basic `${temp}°C / ${humidity}%` in status bar
- Weather data has: temperature, humidity, rainfall_mm, wind_speed, forecast (sunny/cloudy/rainy/storm)
- StatusCard component is used for status displays with icon, label, value, status indicator

## Implementation Plan

### 1. Create Weather Card Component
**File:** `src/features/dashboard/WeatherCard.tsx`
- Input: WeatherCurrent data from API
- Output: Enhanced risk assessment card
- Logic:
  - Calculate risk level badge:
    - GREEN (safe): temp ≤ 32°C and forecast ≠ "storm"
    - YELLOW (caution): 32°C < temp ≤ 35°C or forecast ≠ "storm"
    - RED (critical): temp > 35°C or forecast = "storm"
  - Map forecast to emoji: ☀ (sunny), ☁ (cloudy), 🌧 (rainy), ⛈ (storm)
  - Display as custom card (not StatusCard) to show multiple fields

### 2. Extend Weather API Data
**File:** `src/features/weather/api.ts`
- Update WeatherCurrent interface to optionally include:
  - `heat_index?: number`
  - `uv_index?: number`
- These will be added by backend when available

### 3. Update Dashboard Component
**File:** `src/features/dashboard/Dashboard.tsx`
- Change `weatherText` state to `weather` (store full WeatherCurrent object)
- Replace StatusCard for weather with new WeatherCard component
- Pass full weather data to WeatherCard for rich display

### 4. Visual Design
- Card layout with:
  - Top row: Emoji icon + current temp + risk badge
  - Middle row: Humidity, Rain forecast, Heat index
  - Bottom row: UV index (if available)
- Colors:
  - Safe: green border-left, green-bg
  - Caution: yellow border-left, yellow-bg
  - Critical: red border-left, red-bg

### 5. Risk Calculation Logic
```
if forecast === "storm" {
  risk = "critical" (red)
} else if temperature > 35 {
  risk = "critical" (red)
} else if temperature > 32 {
  risk = "warning" (yellow)
} else {
  risk = "safe" (green)
}
```

## Files to Modify
1. Create: `src/features/dashboard/WeatherCard.tsx` (new component)
2. Modify: `src/features/weather/api.ts` (extend WeatherCurrent interface)
3. Modify: `src/features/dashboard/Dashboard.tsx` (integrate WeatherCard)

## Implementation Notes
- Keep API response structure backward compatible
- Use existing i18n patterns for labels (weather.temperature, weather.humidity, etc.)
- Maintain accessibility with semantic HTML
- Follow existing styling patterns (border-l-[3px], status color classes)
