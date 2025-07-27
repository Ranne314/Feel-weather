<script>
    import { onMount } from 'svelte';
    export let name;

    let latitude = 22.3964; // default for Hong Kong
    let longitude = 114.1095;
    let city = 'Detecting...';
    let temperature = 'Loading...';
    let windSpeed = 'Loading...';
    let humidity = 'Loading...';
    let condition = 'Loading...';
    let feelsLikeTemp = 'Calculating...';
    let conditionEmoji = '';
    let tempEmojiDisplay = '';
    let feelsEmojiDisplay = '';
    let darkMode = true;

    const weatherCodes = {
        0: { desc: 'Clear sky', emoji: '☀️' },
        1: { desc: 'Mainly clear', emoji: '🌤️' },
        2: { desc: 'Partly cloudy', emoji: '⛅' },
        3: { desc: 'Overcast', emoji: '☁️' },
        45: { desc: 'Fog', emoji: '🌫️' },
        48: { desc: 'Rime fog', emoji: '🌫️' },
        51: { desc: 'Light drizzle', emoji: '🌦️' },
        61: { desc: 'Light rain', emoji: '🌧️' },
        71: { desc: 'Light snow', emoji: '🌨️' },
        80: { desc: 'Rain showers', emoji: '🌦️' },
        95: { desc: 'Thunderstorm', emoji: '⛈️' }
    };

    function toggleDarkMode() {
        darkMode = !darkMode;
        localStorage.setItem('darkMode', darkMode);
        applyDarkMode();
    }

    function applyDarkMode() {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', darkMode);
        }
    }

    function tempEmoji(tempC) {
        if (tempC <= -20) return '🧊';
        if (tempC > -20 && tempC <= 0) return '❄️';
        if (tempC > 0 && tempC <= 10) return '🥶';
        if (tempC > 10 && tempC <= 20) return '😌';
        if (tempC > 20 && tempC <= 30) return '🫠';
        if (tempC > 30 && tempC <= 40) return '🥵';
        return '🔥';
    }

    function feelsLikeEmoji(tempC) {
        return tempEmoji(tempC); // im lazy
    }

    function feelsLike(tempC, humidityPercent, windKph) {
        const tempF = tempC * 9 / 5 + 32;

        if (tempC <= 10 && windKph > 4.8) {
            const windChillC = 13.12 + 0.6215 * tempC 
                - 11.37 * Math.pow(windKph, 0.16) 
                + 0.3965 * tempC * Math.pow(windKph, 0.16);
            return `${windChillC.toFixed(1)} °C (Wind Chill)`;
        }

        if (tempC >= 27 && humidityPercent >= 40) {
            const HI_F = -42.379 + 2.049 * tempF + 10.143 * humidityPercent
                - 0.225 * tempF * humidityPercent - 0.007 * Math.pow(tempF, 2)
                - 0.055 * Math.pow(humidityPercent, 2)
                + 0.00123 * Math.pow(tempF, 2) * humidityPercent
                + 0.00085 * tempF * Math.pow(humidityPercent, 2)
                - 0.000002 * Math.pow(tempF, 2) * Math.pow(humidityPercent, 2);
            const HI_C = (HI_F - 32) * 5 / 9;
            return `${HI_C.toFixed(1)} °C (Heat Index)`;
        }

        return `${tempC.toFixed(1)} °C (Actual)`;
    }

    function applyWeather(data) {
        temperature = data.temperature;
        windSpeed = data.windSpeed;
        humidity = data.humidity;
        condition = data.condition;
        conditionEmoji = data.conditionEmoji;
        tempEmojiDisplay = data.tempEmojiDisplay;
        feelsLikeTemp = data.feelsLikeTemp;
        feelsEmojiDisplay = data.feelsEmojiDisplay;
    }

    async function fetchWeather(lat, lon) {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m`);
        const data = await res.json();

        const weatherCode = data.current_weather.weathercode;
        const rawTemp = data.current_weather.temperature;
        const rawWind = data.current_weather.windspeed;
        const rawHumidity = data.hourly.relative_humidity_2m?.[0] || 50;

        temperature = `${rawTemp} °C`;
        windSpeed = `${rawWind} km/h`;
        humidity = `${rawHumidity}%`;
        condition = weatherCodes[weatherCode]?.desc || 'Unknown';
        conditionEmoji = weatherCodes[weatherCode]?.emoji || '';
        tempEmojiDisplay = tempEmoji(rawTemp);
        feelsLikeTemp = feelsLike(rawTemp, rawHumidity, rawWind);
        feelsEmojiDisplay = feelsLikeEmoji(rawTemp);

        localStorage.setItem('info', JSON.stringify({
            latitude,
            longitude,
            temperature,
            windSpeed,
            humidity,
            condition,
            conditionEmoji,
            tempEmojiDisplay,
            feelsLikeTemp,
            feelsEmojiDisplay
        }));
    }

    onMount(async () => {
        const savedDarkMode = localStorage.getItem('darkMode') === 'true';
        if (savedDarkMode) {
            darkMode = true;
            applyDarkMode();
        }

        try {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const rawCity = timeZone.split('/').pop() || 'Unknown';
            city = rawCity.replace(/_/g, ' ');

            // You can optionally update latitude and longitude based on city if you want to expand
            // For now, we just keep defaults and use city string for display

            const cached = JSON.parse(localStorage.getItem('info'));
            if (
                cached &&
                Math.abs(cached.latitude - latitude) < 0.01 &&
                Math.abs(cached.longitude - longitude) < 0.01
            ) {
                applyWeather(cached);
            } else {
                await fetchWeather(latitude, longitude);
            }
        } catch (error) {
            city = 'Hong Kong (fallback)';
            latitude = 22.3962;
            longitude = 114.1094;
            await fetchWeather(latitude, longitude);
        }
    });
</script>



<svelte:head>
    <title>{name}</title>
    <style>
        :root {
            --bg-color: #ffffff;
            --text-color: #333333;
            --card-bg: linear-gradient(to bottom, #f5fafd, #e0f7fa);
            --card-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
        }
        
        .dark {
            --bg-color: #1a1a1a;
            --text-color: #f0f0f0;
            --card-bg: linear-gradient(to bottom, #2d3748, #1a202c);
            --card-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
        }
        
        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            transition: background-color 0.3s ease, color 0.3s ease;
        }
    </style>
</svelte:head>

<main>
    <button class="dark-mode-toggle" on:click={toggleDarkMode}>
        {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
    
    <h1>{conditionEmoji} Weather in {city}</h1>
    <p><strong>Latitude:</strong> {latitude}</p>
    <p><strong>Longitude:</strong> {longitude}</p>
    <p><strong>Temperature:</strong> {temperature} {tempEmojiDisplay}</p>
    <p><strong>Feels Like:</strong> {feelsLikeTemp} {feelsEmojiDisplay}</p>
    <p><strong>Humidity:</strong> {humidity}</p>
    <p><strong>Wind Speed:</strong> {windSpeed}</p>
    <p><strong>Condition:</strong> {condition}</p>
</main>

<style>
    main {
        font-family: sans-serif;
        text-align: center;
        padding: 2rem;
        background: var(--card-bg);
        border-radius: 12px;
        width: 330px;
        margin: 2rem auto;
        box-shadow: var(--card-shadow);
        transition: all 0.3s ease;
        position: relative;
    }

    h1 {
        font-size: 1.7rem;
        margin-bottom: 1rem;
    }
    
    p {
        margin: 0.4rem 0;
        font-size: 1.1rem;
    }
    
    .dark-mode-toggle {
        position: absolute;
        top: 10px;
        right: 10px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        color: inherit;
        padding: 5px 10px;
        border-radius: 20px;
        transition: all 0.3s ease;
    }
    
    .dark-mode-toggle:hover {
        background: rgba(0, 0, 0, 0.1);
    }
</style>