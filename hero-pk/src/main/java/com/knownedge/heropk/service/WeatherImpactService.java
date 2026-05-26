package com.knownedge.heropk.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

@Service
public class WeatherImpactService {

    private static final double BOOST_SUNNY_COMFY = 1.20;
    private static final double NERF_SUNNY_HOT = 0.70;
    private static final double BOOST_CLOUDY_COMFY = 1.10;
    private static final double NERF_CLOUDY_HARSH = 0.90;
    private static final double NERF_RAINY = 0.80;

    private final ObjectMapper objectMapper;
    private final List<String> cityPool;

    public WeatherImpactService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.cityPool = loadCityPool();
    }

    public WeatherImpact resolveTodayImpact(Random random) {
        String city = cityPool.get(random.nextInt(cityPool.size()));
        try {
            WeatherSnapshot snapshot = queryWeather(city);
            return evaluate(snapshot);
        } catch (Exception ex) {
            return WeatherImpact.neutral(city, "天气查询失败，按中性天气处理");
        }
    }

    private WeatherImpact evaluate(WeatherSnapshot snapshot) {
        String d = snapshot.condition.toLowerCase();

        if (containsAny(d, "rain", "shower", "drizzle", "thunder", "storm")) {
            return new WeatherImpact(snapshot.displayCity, snapshot.condition, NERF_RAINY,
                    "雨天：双方能力 -20%", snapshot.temperatureC, snapshot.feelsLikeC, snapshot.humidity);
        }

        if (containsAny(d, "sunny", "clear")) {
            boolean comfyTemp = snapshot.temperatureC >= 18 && snapshot.temperatureC <= 28;
            boolean comfyHumidity = snapshot.humidity >= 35 && snapshot.humidity <= 70;
            if (comfyTemp && comfyHumidity) {
                return new WeatherImpact(snapshot.displayCity, snapshot.condition, BOOST_SUNNY_COMFY,
                        "晴天且温湿适宜：双方能力 +20%", snapshot.temperatureC, snapshot.feelsLikeC, snapshot.humidity);
            }
            if (snapshot.temperatureC >= 33 || snapshot.feelsLikeC >= 36) {
                return new WeatherImpact(snapshot.displayCity, snapshot.condition, NERF_SUNNY_HOT,
                        "晴天高温：双方能力 -30%", snapshot.temperatureC, snapshot.feelsLikeC, snapshot.humidity);
            }
            return WeatherImpact.neutral(snapshot.displayCity, "晴天但体感中性：双方能力不变", snapshot.condition,
                    snapshot.temperatureC, snapshot.feelsLikeC, snapshot.humidity);
        }

        if (containsAny(d, "cloud", "overcast", "mist", "fog", "haze")) {
            if (snapshot.feelsLikeC >= 18 && snapshot.feelsLikeC <= 26) {
                return new WeatherImpact(snapshot.displayCity, snapshot.condition, BOOST_CLOUDY_COMFY,
                        "阴天体感舒适：双方能力 +10%", snapshot.temperatureC, snapshot.feelsLikeC, snapshot.humidity);
            }
            return new WeatherImpact(snapshot.displayCity, snapshot.condition, NERF_CLOUDY_HARSH,
                    "阴天体感欠佳：双方能力 -10%", snapshot.temperatureC, snapshot.feelsLikeC, snapshot.humidity);
        }

        return WeatherImpact.neutral(snapshot.displayCity, "天气类型未命中规则：双方能力不变", snapshot.condition,
                snapshot.temperatureC, snapshot.feelsLikeC, snapshot.humidity);
    }

    private WeatherSnapshot queryWeather(String city) throws IOException {
        String encoded = URLEncoder.encode(city, "UTF-8");
        URL url = new URL("https://wttr.in/" + encoded + "?format=j1");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(3500);
        conn.setReadTimeout(3500);

        int status = conn.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IOException("Weather API status: " + status);
        }

        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        } finally {
            conn.disconnect();
        }

        JsonNode root = objectMapper.readTree(sb.toString());
        JsonNode nearestArea = root.path("nearest_area");
        String displayCity = city;
        if (nearestArea.isArray() && nearestArea.size() > 0) {
            JsonNode areaName = nearestArea.get(0).path("areaName");
            if (areaName.isArray() && areaName.size() > 0) {
                displayCity = areaName.get(0).path("value").asText(city);
            }
        }

        JsonNode weatherArr = root.path("weather");
        JsonNode today = weatherArr.isArray() && weatherArr.size() > 0 ? weatherArr.get(0) : null;
        JsonNode hourlyArr = today == null ? null : today.path("hourly");
        JsonNode sample = null;
        if (hourlyArr != null && hourlyArr.isArray() && hourlyArr.size() > 0) {
            int pick = Math.min(4, hourlyArr.size() - 1);
            sample = hourlyArr.get(pick);
        }

        int tempC = sample == null ? 25 : sample.path("tempC").asInt(25);
        int feelsLikeC = sample == null ? tempC : sample.path("FeelsLikeC").asInt(tempC);
        int humidity = sample == null ? 50 : sample.path("humidity").asInt(50);
        String condition = "Unknown";
        if (sample != null) {
            JsonNode weatherDesc = sample.path("weatherDesc");
            if (weatherDesc.isArray() && weatherDesc.size() > 0) {
                condition = weatherDesc.get(0).path("value").asText("Unknown");
            }
        }

        return new WeatherSnapshot(displayCity, condition, tempC, feelsLikeC, humidity);
    }

    private List<String> loadCityPool() {
        try {
            ClassPathResource resource = new ClassPathResource("config/weather-cities.json");
            List<String> fromFile = objectMapper.readValue(resource.getInputStream(), objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            if (fromFile == null || fromFile.isEmpty()) {
                return fallbackCities();
            }
            return fromFile;
        } catch (Exception ex) {
            return fallbackCities();
        }
    }

    private List<String> fallbackCities() {
        List<String> base = Arrays.asList(
                "Beijing", "Tokyo", "Singapore", "Sydney", "Cairo", "London", "Paris", "New York",
                "Sao Paulo", "Cape Town", "Moscow", "Dubai", "Mumbai", "Bangkok", "Berlin", "Mexico City"
        );
        return Collections.unmodifiableList(base);
    }

    private boolean containsAny(String text, String... keys) {
        for (String key : keys) {
            if (text.contains(key)) {
                return true;
            }
        }
        return false;
    }

    public static class WeatherImpact {
        private final String city;
        private final String condition;
        private final double abilityMultiplier;
        private final String effectText;
        private final int temperatureC;
        private final int feelsLikeC;
        private final int humidity;

        WeatherImpact(String city, String condition, double abilityMultiplier, String effectText,
                      int temperatureC, int feelsLikeC, int humidity) {
            this.city = city;
            this.condition = condition;
            this.abilityMultiplier = abilityMultiplier;
            this.effectText = effectText;
            this.temperatureC = temperatureC;
            this.feelsLikeC = feelsLikeC;
            this.humidity = humidity;
        }

        static WeatherImpact neutral(String city, String reason) {
            return new WeatherImpact(city, "Unknown", 1.0, reason, 25, 25, 50);
        }

        static WeatherImpact neutral(String city, String reason, String condition, int tempC, int feelsLikeC, int humidity) {
            return new WeatherImpact(city, condition, 1.0, reason, tempC, feelsLikeC, humidity);
        }

        public String getCity() {
            return city;
        }

        public String getCondition() {
            return condition;
        }

        public double getAbilityMultiplier() {
            return abilityMultiplier;
        }

        public String getEffectText() {
            return effectText;
        }

        public int getTemperatureC() {
            return temperatureC;
        }

        public int getFeelsLikeC() {
            return feelsLikeC;
        }

        public int getHumidity() {
            return humidity;
        }
    }

    private static class WeatherSnapshot {
        final String displayCity;
        final String condition;
        final int temperatureC;
        final int feelsLikeC;
        final int humidity;

        WeatherSnapshot(String displayCity, String condition, int temperatureC, int feelsLikeC, int humidity) {
            this.displayCity = displayCity;
            this.condition = condition;
            this.temperatureC = temperatureC;
            this.feelsLikeC = feelsLikeC;
            this.humidity = humidity;
        }
    }
}
