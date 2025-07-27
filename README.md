# 🌤️ Feel-weather

A sleek, emoji-powered weather app built in Svelte. It detects your city via your time zone and shows real-time weather using Open-Meteo API (https://open-meteo.com/). Fully responsive with dark mode support.

---

## 🚀 Features

- **📍 City Detection via Time Zone**  
  Parses `Intl.DateTimeFormat().resolvedOptions().timeZone` to extract a readable city name, no IP tracking.

- **🌡️ Real-Time Weather**  
  Uses Open-Meteo for current temperature, humidity, wind speed, and weather conditions.

- **🧠 "Feels Like" Calculator**  
  Computes wind chill or heat index based on humidity, wind, and temperature formulas.

- **😎 Emoji-Based Temp Display**

  | Temp Range (°C)     | Emoji | Meaning         |
  |---------------------|--------|------------------|
  | ≤ -20               | 🧊     | Arctic Freeze    |
  | -19 to 0            | ❄️     | Freezing Cold    |
  | 1 to 10             | 🥶     | Very Cold        |
  | 11 to 20            | 😌     | Cold             |
  | 21 to 30            | 😌     | Normal           |
  | 31 to 40            | 🥵     | Hot              |
  | > 40                | 🔥     | Extreme Heat     |

- **🌓 Dark Mode Toggle**  
  Clickable button toggles theme; preference saved via `localStorage`.

---
