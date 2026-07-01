let map = null;
let currentMarkers = [];
let routePolyline = null;

const MAP_MODE = { NONE: 0, SELECT_POINT: 1, SELECT_ROUTE_START: 2, SELECT_ROUTE_END: 3 };
let currentMapMode = MAP_MODE.NONE;

let selectedLocation = null;
let routeStartLocation = null;
let routeEndLocation = null;

function clearMarkers() {
    currentMarkers.forEach(marker => marker.remove());
    currentMarkers = [];
}

function clearRoute() {
    if (routePolyline) {
        if (map.getLayer('route-layer')) map.removeLayer('route-layer');
        if (map.getSource('routeSource')) map.removeSource('routeSource');
        routePolyline = null;
    }
}

function addCustomMarker(lng, lat, popupHtml = '', className = 'tt-marker-icon') {
    const markerElement = document.createElement('div');
    markerElement.className = className;
    const marker = new tt.Marker({ element: markerElement, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
    if (popupHtml) {
        const popup = new tt.Popup({ offset: 25, closeButton: false }).setHTML(popupHtml);
        marker.setPopup(popup).togglePopup();
    }
    currentMarkers.push(marker);
}

function formatDate(dateString) { return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
const getAqiInfo = (aqi) => { const levels = { 1: { text: 'Excellent', class: 'bg-success' }, 2: { text: 'Good', class: 'bg-info' }, 3: { text: 'Moderate', class: 'bg-warning' }, 4: { text: 'Poor', class: 'bg-danger' }, 5: { text: 'Hazardous', class: 'bg-dark text-white' }}; return levels[aqi] || levels[3]; };
const getSafetyInfo = (score) => { const levels = { 1: { text: 'Very Low', class: 'bg-danger' }, 2: { text: 'Low', class: 'bg-warning' }, 3: { text: 'Moderate', class: 'bg-info' }, 4: { text: 'Good', class: 'bg-success' }, 5: { text: 'Excellent', class: 'bg-success' }}; return levels[score] || levels[3]; };

document.addEventListener('DOMContentLoaded', () => {
    const setupDynamicInput = (selectId, inputId) => {
        const select = document.getElementById(selectId);
        const input = document.getElementById(inputId);
        if (select && input) {
            select.addEventListener('change', () => {
                const isOther = select.value.startsWith('other');
                input.classList.toggle('hidden', !isOther);
                input.required = isOther;
                if (!isOther) input.value = '';
            });
        }
    };
    setupDynamicInput('healthStatus', 'otherHealthStatus');
    setupDynamicInput('userActivity', 'otherUserActivity');
    setupDynamicInput('place', 'otherPlace');
    setupDynamicInput('whatToKnow', 'otherInquiry');

    if (typeof TOMTOM_API_KEY === 'undefined' || TOMTOM_API_KEY.includes('YOUR')) {
        alert("Error: TomTom API key is missing. Please check api.js.");
        if (apiService) apiService.useMockData = true; 
    }

    map = tt.map({ key: TOMTOM_API_KEY, container: 'map', center: [-98.5795, 39.8283], zoom: 4, language: 'en-US' });
    map.addControl(new tt.NavigationControl(), 'top-right');
    map.on('click', (e) => handleMapClick(e.lngLat));

    const pickOnMapBtn = document.getElementById('pickOnMapBtn');
    const selectRoutePointsBtn = document.getElementById('selectRoutePointsBtn');
    const selectedLocDisplay = document.getElementById('selectedLocationInfo');
    const latLonDisplay = document.getElementById('displayLatLon');
    const routeDisplay = document.getElementById('routePointsDisplay');
    const startDisplay = document.getElementById('startPointDisplay');
    const endDisplay = document.getElementById('endPointDisplay');

    const updateMapSelectionUI = () => {
        pickOnMapBtn.classList.remove('active');
        selectRoutePointsBtn.classList.remove('active');
        selectedLocDisplay.classList.add('hidden');
        routeDisplay.classList.add('hidden');
        if (selectedLocation) {
            latLonDisplay.textContent = `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lon.toFixed(6)}`;
            selectedLocDisplay.classList.remove('hidden');
        } 
        if (routeStartLocation || routeEndLocation) {
            startDisplay.textContent = routeStartLocation ? `${routeStartLocation.lat.toFixed(6)}, ${routeStartLocation.lon.toFixed(6)}` : '...';
            endDisplay.textContent = routeEndLocation ? `${routeEndLocation.lat.toFixed(6)}, ${routeEndLocation.lon.toFixed(6)}` : '...';
            routeDisplay.classList.remove('hidden');
        }
        if (currentMapMode === MAP_MODE.SELECT_POINT) pickOnMapBtn.classList.add('active');
        else if (currentMapMode >= MAP_MODE.SELECT_ROUTE_START) selectRoutePointsBtn.classList.add('active');
    };

    document.getElementById('getCurrentLocationBtn').addEventListener('click', async () => {
        currentMapMode = MAP_MODE.NONE;
        clearAllMapElements();
        resetMapSelections();
        try {
            const loc = await getUserGeolocation();
            if (loc) {
                selectedLocation = loc;
                addCustomMarker(loc.lon, loc.lat, `Your Location`, 'tt-marker-icon selected-location');
                map.flyTo({ center: [loc.lon, loc.lat], zoom: 14 });
            }
        } catch (error) { console.error('Geolocation failed:', error); } 
        finally { updateMapSelectionUI(); }
    });

    pickOnMapBtn.addEventListener('click', () => {
        const wasActive = currentMapMode === MAP_MODE.SELECT_POINT;
        clearAllMapElements();
        resetMapSelections();
        currentMapMode = wasActive ? MAP_MODE.NONE : MAP_MODE.SELECT_POINT;
        if (!wasActive) alert('Please click on the map to select a single point.');
        updateMapSelectionUI();
    });

    selectRoutePointsBtn.addEventListener('click', () => {
        const wasActive = currentMapMode >= MAP_MODE.SELECT_ROUTE_START;
        clearAllMapElements();
        resetMapSelections();
        currentMapMode = wasActive ? MAP_MODE.NONE : MAP_MODE.SELECT_ROUTE_START;
        if (!wasActive) alert('Please click on the map to select the route START point.');
        updateMapSelectionUI();
    });

    const handleMapClick = (lngLat) => {
        const lat = lngLat.lat;
        const lon = lngLat.lng; // CORRECTED: Use .lng instead of .lon

        if (currentMapMode === MAP_MODE.SELECT_POINT) {
            clearAllMapElements();
            selectedLocation = { lat, lon };
            addCustomMarker(lon, lat, `Selected Point`, 'tt-marker-icon selected-location');
            currentMapMode = MAP_MODE.NONE;
        } else if (currentMapMode === MAP_MODE.SELECT_ROUTE_START) {
            routeStartLocation = { lat, lon };
            addCustomMarker(lon, lat, `Start Point`, 'tt-marker-icon route-marker-start');
            currentMapMode = MAP_MODE.SELECT_ROUTE_END;
            alert('Start point selected. Now click to select the END point.');
        } else if (currentMapMode === MAP_MODE.SELECT_ROUTE_END) {
            routeEndLocation = { lat, lon };
            addCustomMarker(lon, lat, `End Point`, 'tt-marker-icon route-marker-end');
            if (routeStartLocation) map.fitBounds(new tt.LngLatBounds([routeStartLocation.lon, routeStartLocation.lat], [lon, lat]), { padding: 50 });
            currentMapMode = MAP_MODE.NONE;
        }
        updateMapSelectionUI();
    };

    function resetMapSelections() { selectedLocation = routeStartLocation = routeEndLocation = null; }
    function clearAllMapElements() { clearMarkers(); clearRoute(); }
    
    async function getUserGeolocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return null;
        }
        showLoading('resultsContent', 'Getting your current location...');
        try {
            const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
            hideLoading('resultsContent');
            return { lat: pos.coords.latitude, lon: pos.coords.longitude };
        } catch (error) {
            let msg = 'Failed to get location. Please ensure location services are enabled.';
            if (error.code === 1) msg = 'Location access denied. Please enable it in browser settings.';
            if (error.code === 3) msg = 'Location request timed out. Check your connection.';
            alert(msg);
            hideLoading('resultsContent');
            throw error;
        }
    }

    const form = document.getElementById('auraDataForm');
    const resultsSection = document.getElementById('resultsSection');
    const resultsContent = document.getElementById('resultsContent');
    const errorOutput = document.getElementById('errorOutput');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        resultsContent.innerHTML = '';
        errorOutput.style.display = 'none';

        form.classList.add('was-validated');
        if (!form.checkValidity()) return;

        const whatToKnow = document.getElementById('whatToKnow').value;
        const isRoute = whatToKnow === 'best_low_pollution_route';

        if ((isRoute && (!routeStartLocation || !routeEndLocation)) || (!isRoute && !selectedLocation)) {
            errorOutput.textContent = isRoute ? 'Please select both start and end points for the route.' : 'Please select a location on the map.';
            errorOutput.style.display = 'block';
            return;
        }

        const { lat, lon } = selectedLocation || routeStartLocation;
        resultsSection.classList.remove('hidden');
        showLoading('resultsContent', 'Analyzing data and fetching insights...');
        const userData = Object.fromEntries(new FormData(form).entries());

        try {
            let html = '';
            const [weather, air, safety] = await Promise.all([
                apiService.getWeather(lat, lon),
                apiService.getAirQuality(lat, lon),
                apiService.getSafetyScore(lat, lon)
            ]);
            html += generateLocationInfoHtml(lat, lon, weather, air, safety, isRoute ? "Route Start Point" : "Location");

            switch (whatToKnow) {
                case 'safe_forecast':
                    html += await generateFuturePredictionsHtml(lat, lon);
                    break;
                case 'best_low_pollution_route':
                    html += await generateBestRouteHtml(routeStartLocation.lat, routeStartLocation.lon, routeEndLocation.lat, routeEndLocation.lon);
                    break;
                case 'best_safe_park':
                    html += await generateNearbyPlacesHtml(lat, lon, 'park', 'Safe Parks');
                    break;
                case 'general_advice':
                case 'other_inquiry':
                    const prompt = whatToKnow === 'general_advice'
                        ? `Provide environmental and health advice for a ${userData.ageCategory} ${userData.gender} with ${userData.healthStatus}, who is currently ${userData.userActivity} in a ${userData.place} environment.`
                        : userData.other_inquiry;
                    html += await generateAIAdviceHtml(lat, lon, prompt);
                    break;
            }
            resultsContent.innerHTML = html;
        } catch (error) {
            errorOutput.textContent = `An error occurred: ${error.message || 'Please try again later.'}`;
            errorOutput.style.display = 'block';
        } finally {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    function generateLocationInfoHtml(lat, lon, weatherData, airData, safetyData, title) {
        const weather = weatherData.current || {};
        const aqiInfo = getAqiInfo(airData.aqi || 3);
        const safetyInfo = getSafetyInfo(safetyData.safety_score || 3);
        return `
            <div class="result-card mb-4">
                <h6><i class="fas fa-map-pin"></i> ${title} Information</h6>
                <p><strong>Coordinates:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
                <div class="row text-center mt-3 g-2 info-box-container">
                    <div class="col-4"><div class="info-box"><i class="fas fa-temperature-half text-warning fa-lg mb-2"></i><div class="info-label">${weather.temp_f || '--'}°F</div><div class="info-sublabel">Temperature</div></div></div>
                    <div class="col-4"><div class="info-box"><i class="fas fa-wind text-info fa-lg mb-2"></i><div class="info-label"><span class="badge ${aqiInfo.class}">${aqiInfo.text}</span></div><div class="info-sublabel">Air Quality</div></div></div>
                    <div class="col-4"><div class="info-box"><i class="fas fa-shield-alt text-success fa-lg mb-2"></i><div class="info-label"><span class="badge ${safetyInfo.class}">${safetyInfo.text}</span></div><div class="info-sublabel">Safety</div></div></div>
                </div>
                ${weather.condition ? `<div class="mt-3 p-2 bg-white rounded"><p class="mb-1"><strong>Weather:</strong> ${weather.condition.text}</p><p class="mb-1"><strong>Humidity:</strong> ${weather.humidity || '--'}%</p><p class="mb-0"><strong>Wind:</strong> ${weather.wind_mph || '--'} mph</p></div>` : ''}
            </div>`;
    }
    
    async function generateFuturePredictionsHtml(lat, lon) {
        const [futureAir, futureWeather] = await Promise.all([apiService.getFutureAirQuality(lat, lon), apiService.getFutureWeather(lat, lon)]);
        let html = `<div class="result-card mb-4"><h6><i class="fas fa-clock"></i> Future Forecast</h6>`;
        const airDays = futureAir.future_air_quality || [];
        const weatherDays = futureWeather.forecast?.forecastday || [];
        if (airDays.length > 0) {
            html += `<div class="row text-center g-2">`;
            airDays.forEach((day, index) => {
                const weather = weatherDays[index] || {};
                const aqiInfo = getAqiInfo(day.predicted_aqi);
                html += `
                    <div class="col-4"><div class="info-box">
                        <div class="info-label small fw-bold">${formatDate(day.date)}</div>
                        <div class="my-1"><span class="badge ${aqiInfo.class}">${aqiInfo.text}</span></div>
                        ${weather.day ? `<div class="info-sublabel">${weather.day.maxtemp_f || '--'}° / ${weather.day.mintemp_f || '--'}°</div>` : ''}
                    </div></div>`;
            });
            html += `</div>`;
        } else html += `<p class="text-muted">No forecast data available.</p>`;
        return html + `</div>`;
    }

    async function generateAIAdviceHtml(lat, lon, prompt) {
        const adviceData = await apiService.getAIAdvice(lat, lon, prompt);
        const formatted = marked.parse(adviceData.advice || 'No advice available.');
        return `<div class="result-card mb-4"><h6><i class="fas fa-robot"></i> AI Recommendations</h6><div class="ai-advice-content">${formatted}</div></div>`;
    }

    async function generateBestRouteHtml(startLat, startLon, endLat, endLon) {
        const routeData = await apiService.getBestRoute(startLat, startLon, endLat, endLon);
        let html = `<div class="result-card mb-4"><h6><i class="fas fa-route"></i> Best Low-Pollution Route</h6>`;
        if (routeData.error || !routeData.points) {
            html += `<p class="text-danger">Could not find a safe route.</p>`;
        } else {
            const distanceMi = (routeData.distance * 0.000621371).toFixed(1);
            const durationMin = Math.round(routeData.duration / 60);
            drawRouteOnMap(routeData.points);
            html += `<p><strong>Distance:</strong> ${distanceMi} miles</p><p><strong>Est. Time:</strong> ${durationMin} minutes</p>`;
        }
        return html + `</div>`;
    }

    async function generateNearbyPlacesHtml(lat, lon, type, title) {
        const places = await apiService.searchNearbyPlaces(lat, lon, type);
        let html = `<div class="result-card mb-4"><h6><i class="fas fa-map-marker-alt"></i> Nearby ${title}</h6>`;
        if (places.results && places.results.length > 0) {
            html += `<ul class="list-group">`;
            const coords = [[lon, lat]];
            places.results.slice(0, 5).forEach(p => {
                html += `<li class="list-group-item">${p.poi?.name || 'Unknown Place'}</li>`;
                addCustomMarker(p.position.lon, p.position.lat, p.poi?.name, 'tt-marker-icon route-marker-start');
                coords.push([p.position.lon, p.position.lat]);
            });
            html += `</ul>`;
            if (coords.length > 1) map.fitBounds(coords.reduce((b, c) => b.extend(c), new tt.LngLatBounds(coords[0], coords[0])), { padding: 70 });
        } else html += `<p class="text-muted">No nearby ${type}s found.</p>`;
        return html + `</div>`;
    }

    function drawRouteOnMap(points) {
        clearRoute();
        const coords = points.map(p => [p.longitude, p.latitude]).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
        if (coords.length < 2) {
            console.error("Not enough valid points to draw a route.");
            return;
        }
        const geoJson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
        map.addSource('routeSource', { type: 'geojson', data: geoJson });
        map.addLayer({ id: 'route-layer', type: 'line', source: 'routeSource', paint: { 'line-color': '#007bff', 'line-width': 6 } });
        routePolyline = 'route-layer';
        map.fitBounds(coords.reduce((b, c) => b.extend(c), new tt.LngLatBounds(coords[0], coords[0])), { padding: 50 });
    }
});