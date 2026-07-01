const TOMTOM_API_KEY = 'PmCePRXCMsX5PA06pReKG2TBFd3lRj5t';

class APIService {
    constructor() {
        this.baseURL = 'https://breatheapp-production.up.railway.app/api/';
        this.useMockData = true; 
    }

    async makeRequest(endpoint, params = {}, method = 'GET', body = null) {
        try {
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
            const queryString = new URLSearchParams(params).toString();
            const url = `${this.baseURL}${cleanEndpoint}${queryString ? `?${queryString}` : ''}`;
            
            const options = {
                method: method,
                headers: { 'Content-Type': 'application/json' },
            };

            if (body && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(body);
            }
            
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Request failed for ${endpoint}:`, error);
            if (this.useMockData || error.message.includes('Failed to fetch')) {
                 console.warn(`Using mock data for: ${endpoint}`);
                 return this.getMockData(endpoint, params, method, body);
            }
            throw error;
        }
    }

    getMockData(endpoint, params, method, body) {
        const mockLat = parseFloat(params.lat || (body && body.lat) || 34.0522);
        const mockLon = parseFloat(params.lon || (body && body.lon) || -118.2437);
        
        const startLat = parseFloat(params.start_lat || mockLat);
        const startLon = parseFloat(params.start_lon || mockLon);
        const endLat = parseFloat(params.end_lat || mockLat + 0.1);
        const endLon = parseFloat(params.end_lon || mockLon + 0.1);

        const mockResponses = {
            'air-quality/': { aqi: Math.floor(Math.random() * 5) + 1 },
            'safety-score/': { safety_score: Math.floor(Math.random() * 5) + 1 },
            'weather/': { 
                current: { 
                    temp_f: (Math.random() * 25 + 65).toFixed(1),
                    condition: { text: 'Partly Cloudy' },
                    humidity: Math.floor(Math.random() * 70) + 20,
                    wind_mph: (Math.random() * 12 + 3).toFixed(1),
                } 
            },
            'best-route/': { 
                distance: Math.floor(Math.random() * 15000) + 2000,
                duration: Math.floor(Math.random() * 5400) + 300,
                points: [
                    { latitude: startLat, longitude: startLon },
                    { latitude: startLat + (endLat - startLat) * 0.3, longitude: startLon + (endLon - startLon) * 0.6 },
                    { latitude: startLat + (endLat - startLat) * 0.7, longitude: startLon + (endLon - startLon) * 0.4 },
                    { latitude: endLat, longitude: endLon }
                ]
            },
            'future-weather/': {
                forecast: {
                    forecastday: Array.from({length: 3}, (_, i) => ({
                        date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        day: {
                            maxtemp_f: (Math.random() * 15 + 70).toFixed(1),
                            mintemp_f: (Math.random() * 15 + 55).toFixed(1),
                            condition: { text: ['Sunny', 'Cloudy', 'Showers'][Math.floor(Math.random() * 3)] }
                        }
                    }))
                }
            },
             'future-air-quality/': {
                future_air_quality: Array.from({length: 3}, (_, i) => ({
                    date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    predicted_aqi: Math.floor(Math.random() * 5) + 1
                }))
            },
            'ai-advice/': {
                advice: `📍 **Location:** ${mockLat.toFixed(4)}, ${mockLon.toFixed(4)}\n💡 **Recommendations:** Conditions are ideal for outdoor activities. Based on your query: *"${body.prompt.substring(0, 80)}..."*, here is some tailored advice:\n\n*   Always check the daily forecast for changes.\n*   For your specified health condition, consider wearing a mask if the AQI is moderate or higher.\n*   Stay hydrated, especially during physical activities like running.`
            }
        };
        const endpointKey = endpoint.replace(this.baseURL, '');
        return new Promise(resolve => setTimeout(() => resolve(mockResponses[endpointKey] || {}), 500));
    }
    
    async getAirQuality(lat, lon) { return await this.makeRequest('air-quality/', { lat, lon }); }
    async getSafetyScore(lat, lon) { return await this.makeRequest('safety-score/', { lat, lon }); }
    async getBestRoute(startLat, startLon, endLat, endLon) { return await this.makeRequest('best-route/', { start_lat: startLat, start_lon: startLon, end_lat: endLat, end_lon: endLon }); }
    async getWeather(lat, lon) { return await this.makeRequest('weather/', { lat, lon }); }
    async getFutureWeather(lat, lon, days = 3) { return await this.makeRequest('future-weather/', { lat, lon, days }); }
    async getFutureAirQuality(lat, lon, days = 3) { return await this.makeRequest('future-air-quality/', { lat, lon, days }); }
    async getAIAdvice(lat, lon, prompt) { return await this.makeRequest('ai-advice/', {}, 'POST', { lat, lon, prompt }); }
    
    async searchNearbyPlaces(lat, lon, category) {
        if (this.useMockData) {
            const mockResponses = {
                'park': { results: [{ position: { lat: lat + 0.002, lon: lon + 0.003 }, poi: { name: 'Central Park' } }, { position: { lat: lat - 0.001, lon: lon - 0.002 }, poi: { name: 'Riverfront Park' } }] },
                'hospital': { results: [{ position: { lat: lat + 0.001, lon: lon + 0.001 }, poi: { name: 'General Hospital' } }, { position: { lat: lat - 0.002, lon: lon + 0.001 }, poi: { name: 'City Clinic' } }] }
            };
            return new Promise(resolve => setTimeout(() => resolve(mockResponses[category] || { results: [] }), 500));
        }
        try {
            const categorySetMap = { hospital: 7315, park: 9370 };
            const url = `https://api.tomtom.com/search/2/nearbySearch/.json?key=${TOMTOM_API_KEY}&lat=${lat}&lon=${lon}&radius=10000&categorySet=${categorySetMap[category] || 9370}&language=en-US`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`TomTom API error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('TomTom search failed:', error);
            return this.getMockData('searchNearbyPlaces', { lat, lon, category });
        }
    }
}

const apiService = new APIService();

function showLoading(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="text-center my-4">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
                <p class="text-muted mt-2">${message}</p>
            </div>`;
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) { element.innerHTML = ''; }
}