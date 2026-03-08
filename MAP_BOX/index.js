// Thiết lập và khởi tạo bản đồ
mapboxgl.accessToken = 'pk.eyJ1IjoidGFudG5uaDAwIiwiYSI6ImNseG9kc3V5dDBlZWoybG9haDRtOTB6MTkifQ.1MEYSJCV61ehfRxKmJ_ztA';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [106.6539627, 10.7860439],
    zoom: 11.60,
    hash: 'map',
    attributionControl: false
});

// Đổi nhãn tên khi search thành Tiếng Việt
map.on('style.load', () => {
    map.getStyle().layers.forEach(layer => {
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
            map.setLayoutProperty(
                layer.id,
                'text-field',
                ['coalesce', ['get', 'name_vi'], ['get', 'name']]
            );
        }
    });
});

// Khai báo biến toàn cục
let geolocate;
let busCoordsGlobal = null;
let speedGlobal = null;
let userLocation = null;
let isDisplayingRouteDetails = false;
let isRouteDisplayed = false; 
let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;
let routeStationMarkers = [];

// Danh sách trạm 
const stationList = [
  { coords: [106.86876063544871, 10.984409526801667], name: "Trạm xe 01: Trường Đại Học Công Nghệ Đồng Nai - Bến xe ngã tư Vũng Tàu" },
  { coords: [106.80924766065695, 10.954310872231334], name: "Trạm xe 02: Bến Xe Biên Hoà - Trạm xe Nhơn Trạch" },
  { coords: [106.8868960139604, 10.967065122295407], name: "Trạm xe 03: Bến xe Hố Nai - Trạm xe Hoá An" },
  { coords: [106.65133430057564, 10.751169331175838], name: "Trạm xe 05 (Lượt đi): Bến xe Buýt Chợ Lớn - Bến xe Biên Hoà" },
  { coords: [106.8092259974398, 10.95428062020573], name: "Trạm xe 05 (Lượt về): Bến xe Biên Hoà - Bến xe Buýt Chợ Lớn" },
  { coords: [106.65133430057564, 10.751169331175838], name: "Trạm xe 06 (Lượt đi): Bến xe Buýt Chợ Lớn - Đại học Nông Lâm" },
  { coords: [106.78772514129247, 10.868257382093063], name: "Trạm xe 06 (Lượt về): Đại học Nông Lâm - Bến xe Buýt Chợ Lớn" },
  { coords: [106.65133430057564, 10.751169331175838], name: "Trạm xe 07 (Lượt đi): Bến xe Buýt Chợ Lớn - Gò Vấp" },
  { coords: [106.69212073037636, 10.823589026984596], name: "Trạm xe 07 (Lượt về): Gò Vấp - Bến xe Buýt Chợ Lớn" },
  { coords: [106.65655798940553, 10.733745258068025], name: "Trạm xe 08 (Lượt đi): Bến xe Buýt Quận 8 - Đại học Quốc gia" },
  { coords: [106.80769278782195, 10.874491853155533], name: "Trạm xe 08 (Lượt về): Đại học Quốc gia - Bến xe Buýt Quận 8" },
  { coords: [106.69936594057046, 10.73318582685308], name: "Trạm xe 31 (Lượt đi): Đại học Tôn Đức Thắng - Bến Thành - Đại học Văn Lang" },
  { coords: [106.69970585297881, 10.833228284059642], name: "Trạm xe 31 (Lượt về): Đại học Văn Lang - Bến Thành - Đại học Tôn Đức Thắng" },
  { coords: [106.65133430057564, 10.751169331175838], name: "Trạm xe 56 (Lượt đi): Bến xe Buýt Chợ Lớn - Bến xe Miền Đông mới" },
  { coords: [106.81573752613731, 10.88042134672586], name: "Trạm xe 56 (Lượt về): Bến xe Miền Đông mới - Bến xe Buýt Chợ Lớn" },
  { coords: [106.86012453956704, 10.789006629197738], name: "Trạm xe 76 (Lượt đi): Long Phước - Suối Tiên - Bến xe Miền Đông mới" },
  { coords: [106.81573973002193, 10.880421255222206], name: "Trạm xe 76 (Lượt về): Bến xe Miền Đông mới - Suối Tiên - Long Phước" },
  { coords: [106.77065836109871, 10.770613955193785], name: "Trạm xe 99 (Lượt đi): Chợ Thạnh Mỹ Lợi - Đại học Quốc gia" },
  { coords: [106.77768641341427, 10.885121516547821], name: "Trạm xe 99 (Lượt về): Đại học Quốc gia - Chợ Thạnh Mỹ Lợi" },
  { coords: [106.84127241157466, 10.805222103980833], name: "Trạm xe 141 (Lượt đi): Khu du lịch BCR - Long Trường - Khu chế xuất Linh Trung II" },
  { coords: [106.71767686447654, 10.891244785231718], name: "Trạm xe 141 (Lượt về): Khu chế xuất Linh Trung II - Long Trường - Khu du lịch BCR" },
];

// Dữ liệu trạm
const StationData = {
  type: "FeatureCollection",
  features: stationList.map(station => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: station.coords
    },
    properties: {
      name: station.name
    }
  }))
};

// Hàm tính khoảng cách bus đến người dùng
async function getDrivingDistance(startCoords, endCoords) {
    if (!startCoords || !endCoords) return null;

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?access_token=${mapboxgl.accessToken}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            const distanceInMeters = data.routes[0].distance;
            return (distanceInMeters / 1000).toFixed(2);
        }
        return null;
    } catch (e) {
        console.error('Lỗi khi lấy khoảng cách từ API:', e);
        return null;
    }
}

// Hàm khởi tạo Control và Search
function initControls() {
    map.addControl(new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: ['BUSTRACKERMAP', 'Designed by M.Duc']
    }), 'bottom-right');

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new mapboxgl.FullscreenControl({ container: document.querySelector('body') }), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-right');

    // Lấy vị trí người dùng
    geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true},
        trackUserLocation: true,
        showUserHeading: true
    });
    map.addControl(geolocate, 'bottom-right');

    geolocate.on('geolocate', (evt) => {
        userLocation = [evt.coords.longitude, evt.coords.latitude];
        console.log('User location:', userLocation);
    });
}

function initSearchBoxes() {
    const startBox = document.getElementById('start-box');
    const endBox = document.getElementById('end-box');
    const btn = document.getElementById('find-route-btn');
    btn.disabled = true;

    if (!startBox || !endBox) {
        console.error('Không tìm thấy thanh tìm kiếm địa điểm!');
        return;
    }

    startBox.accessToken = mapboxgl.accessToken;
    endBox.accessToken = mapboxgl.accessToken;
    startBox.options = { language: 'vi', country: 'VN', proximity: [106.65, 10.78] };
    endBox.options = { language: 'vi', country: 'VN', proximity: [106.65, 10.78] };

    function updateFindRouteButtonState() {
        btn.disabled = (!startPoint || !endPoint);
    }

    // Chọn điểm bắt đầu
    startBox.addEventListener('retrieve', (evt) => {
        const feature = evt.detail?.features?.[0];
        startPoint = feature?.geometry?.coordinates ?? null;
        console.log("Start point:", startPoint);
        updateFindRouteButtonState();
    });

    // Chọn điểm đến
    endBox.addEventListener('retrieve', (evt) => {
        const feature = evt.detail?.features?.[0];
        endPoint = feature?.geometry?.coordinates ?? null;
        console.log("End point:", endPoint);
        updateFindRouteButtonState();
    });
}

// Hàm hiển thị bản đồ và trạm xe
function addDataStation() {
    // Load icon trạm
    map.loadImage('Images/location.png', (error, image) => {
        if (error) return console.error('Không thể load ảnh icon:', error);
        if (!map.hasImage('custom-bus-icon')) {
            map.addImage('custom-bus-icon', image);
        }
        // Thêm dữ liệu tuyến xe
        if (!map.getSource('busstation-src')) {
            map.addSource('busstation-src', { type: 'geojson', data: StationData });
        }
        // Layer icon trạm
        if (!map.getLayer('busstation-location')) {
            map.addLayer({
                id: 'busstation-location',
                type: 'symbol',
                source: 'busstation-src',
                layout: { 'icon-image': 'custom-bus-icon', 'icon-size': 0.06, 'icon-allow-overlap': true }
            });
        }
        // Layer tên trạm
        if (!map.getLayer('busstation-name')) {
            map.addLayer({
                id: 'busstation-name',
                type: 'symbol',
                source: 'busstation-src',
                layout: {
                    'text-field': ['get', 'name'],
                    'text-size': 12,
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top'
                },
                paint: { 'text-color': 'red' }
            });
        }
    });
}

// Hàm tìm trạm gần tuyến đường
async function findStationsAlongRoute(routeGeometry) {
    const bufferDistance = 0.5;
    const relevantStations = [];
    const routeLine = turf.lineString(routeGeometry.coordinates);
    if (!StationData || !StationData.features) {
        console.error("Dữ liệu trạm không hợp lệ.");
        return;
    }
    for (const feature of StationData.features) {
        const stationPoint = turf.point(feature.geometry.coordinates);
        const distance = turf.pointToLineDistance(stationPoint, routeLine, { units: 'kilometers' });
        if (distance <= bufferDistance) {
            relevantStations.push(feature);
        }
    }
    displayRouteStations(relevantStations);
}

// Hàm tạo và hiển thị các marker cho các trạm đã được tìm thấy trên bản đồ
function displayRouteStations(stations) {
    // Xoá các marker cũ
    routeStationMarkers.forEach(marker => marker.remove());
    routeStationMarkers = [];

    // Câp nhật danh sách trạm gần tuyến đường
    const routeStationsList = document.getElementById('route-stations-list');
    if (routeStationsList) {
        routeStationsList.innerHTML = '';
    }

    // Ẩn marker và tên của các trạm không liên quan đến đoạn đường
    if (map.getLayer('busstation-location')) {
        map.setLayoutProperty('busstation-location', 'visibility', 'none');
    }
    if (map.getLayer('busstation-name')) {
        map.setLayoutProperty('busstation-name', 'visibility', 'none');
    }

    if (stations.length === 0) {
        if (routeStationsList) routeStationsList.innerHTML = '<p>Không tìm thấy trạm xe buýt nào gần tuyến đường này.</p>';
        return;
    }

    stations.forEach(station => {
        if (!station || !station.geometry || !station.geometry.coordinates) {
            console.error("Dữ liệu trạm không hợp lệ, bỏ qua:", station);
            return;
        }

        const markerElement = document.createElement('div');
        markerElement.className = 'route-station-marker';

        const popup = new mapboxgl.Popup().setHTML(`<h6>${station.properties.name}</h6>`);
        
        const marker = new mapboxgl.Marker(markerElement)
            .setLngLat(station.geometry.coordinates)
            .setPopup(popup)
            .addTo(map);
        routeStationMarkers.push(marker);

        if (routeStationsList) {
            const listItem = document.createElement('li');
            listItem.className = "list-group-item route-station-list-item";
            listItem.innerHTML = station.properties.name;
            listItem.onclick = () => {
                map.flyTo({ center: station.geometry.coordinates, zoom: 15 });
                popup.addTo(map);
            };
            routeStationsList.appendChild(listItem);
        }
    });

    openLeftPanel();

    // Khoanh vùng các trạm liên quan
    const bounds = new mapboxgl.LngLatBounds();
    stations.forEach(station => bounds.extend(station.geometry.coordinates));
    if (startPoint) bounds.extend(startPoint);
    if (endPoint) bounds.extend(endPoint);
    map.fitBounds(bounds, { padding: 100, maxZoom: 14 });
}

function clearRouteStations() {
    routeStationMarkers.forEach(marker => marker.remove());
    routeStationMarkers = [];
    const routeStationsList = document.getElementById('route-stations-list');
    if (routeStationsList) {
        routeStationsList.innerHTML = '<p>Tìm đường để xem các trạm liên quan.</p>';
    }

    // Hiển thị lại marker và tên của các trạm sau khi ấn xoá tuyến đường
    if (map.getLayer('busstation-location')) {
        map.setLayoutProperty('busstation-location', 'visibility', 'visible');
    }
    if (map.getLayer('busstation-name')) {
        map.setLayoutProperty('busstation-name', 'visibility', 'visible');
    }

    if (map.getLayer('route')) map.removeLayer('route');
    if (map.getSource('route')) map.removeSource('route');

    if (startMarker) startMarker.remove();
    if (endMarker) endMarker.remove();
    startMarker = null;
    endMarker = null;
    startPoint = null;
    endPoint = null;

    // Cập nhật button Xoá Tuyến Đường thành Tìm Đường
    isRouteDisplayed = false;
    document.getElementById('find-route-btn').textContent = 'Tìm Đường';
    document.getElementById('find-route-btn').style.backgroundColor = '#007bff';
}

async function findRoute() {
    console.log('Giá trị startPoint:', startPoint);
    console.log('Giá trị endPoint:', endPoint);
    if (
        !startPoint || !endPoint ||
        !Array.isArray(startPoint) || !Array.isArray(endPoint) ||
        startPoint.length < 2 || endPoint.length < 2
    ) {
        alert('Vui lòng chọn đầy đủ điểm bắt đầu và điểm đến từ gợi ý!');
        return;
    }
    const [startLng, startLat] = startPoint;
    const [endLng, endLat] = endPoint;
    clearRouteStations();

    try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            displayRoute(route);

            // Cập nhật button Tìm Đường thành Xoá Tuyến Đường
            isRouteDisplayed = true;
            document.getElementById('find-route-btn').textContent = 'Xoá Tuyến Đường';
            document.getElementById('find-route-btn').style.backgroundColor = '#dc3545';

            const distance = (route.distance / 1000).toFixed(2);
            const duration = Math.round(route.duration / 60);
            alert(`Khoảng cách: ${distance} km\n Thời gian dự kiến: ${duration} phút`);

            findStationsAlongRoute(route.geometry);
        } else {
            alert('Không tìm thấy tuyến đường phù hợp!');
        }
    } catch (e) {
        console.error('Lỗi khi tìm đường:', e);
        alert('Đã xảy ra lỗi khi tìm đường!');
    }
}

function displayRoute(route) {
    const routeGeoJSON = { type: 'Feature', properties: {}, geometry: route.geometry };

    if (map.getSource('route')) {
        map.getSource('route').setData(routeGeoJSON);
    } else {
        map.addSource('route', { type: 'geojson', data: routeGeoJSON });
        map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.85 }
        });
    }

    const bounds = new mapboxgl.LngLatBounds();
    route.geometry.coordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds, { padding: 50 });

    if (startMarker) startMarker.remove();
    if (endMarker) endMarker.remove();

    if (startPoint) startMarker = new mapboxgl.Marker({ color: 'red', scale: 2 })
        .setLngLat(startPoint)
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Điểm bắt đầu</strong>'))
        .addTo(map);

    if (endPoint) endMarker = new mapboxgl.Marker({ color: 'yellow', scale: 2 })
        .setLngLat(endPoint)
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Điểm đến</strong>'))
        .addTo(map);
}

// Hàm theo dõi xe buýt
function busTracker() {
    let busMarker = new mapboxgl.Marker({ color: 'black' })
        .setLngLat([106.6539627, 10.7860439])
        .addTo(map);

        let ZoomtoBus = true;

        const client = mqtt.connect('wss://internship2003.cloud.shiftr.io:443', {
        username: 'internship2003',
        password: 'BdLKjwoCe4FUrVKC'
    });

    client.on('connect', () => {
        console.log('Connected to shiftr.io MQTT broker');
        client.subscribe('esp32/gps');
    });

    client.on('message', async (topic, msg) => {
        try {
            const { lat, lon, speed, time } = JSON.parse(msg.toString());
            busCoordsGlobal = [lon, lat];
            speedGlobal = speed;
            busMarker.setLngLat(busCoordsGlobal);

            // Zoom vào vị trí bus ngay khi có vị trí
            if (ZoomtoBus) {
                map.flyTo({ center: busCoordsGlobal, zoom: 14, speed: 0.6 });
                ZoomtoBus = false;
            }
            
            let distanceText = 'Vui lòng bật định vị';
            let etaText = 'Không xác định';

            if (userLocation) {
                const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${busCoordsGlobal[0]},${busCoordsGlobal[1]};${userLocation[0]},${userLocation[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    distanceText = `${(route.distance / 1000).toFixed(2)} km`;
                    etaText = `${Math.round(route.duration / 60)} phút`;

                    if (map.getSource('bus-route')) {
                        map.getSource('bus-route').setData({ type: 'Feature', geometry: route.geometry });
                    } else {
                        map.addSource('bus-route', { type: 'geojson', data: { type: 'Feature', geometry: route.geometry } });
                        map.addLayer({
                            id: 'bus-route-layer',
                            type: 'line',
                            source: 'bus-route',
                            layout: { 'line-join': 'round', 'line-cap': 'round' },
                            paint: { 'line-color': '#ff5733', 'line-width': 7, 'line-opacity': 0.85 }
                        });
                    }
                }
            }

            let formattedTime = 'Không xác định';
            if (time) {
                try {
                    const [datePart, timePartWithZone] = time.split(',');
                    const timePart = timePartWithZone.split('+')[0];
                    const [yy, mm, dd] = datePart.split('/');
                    const isoString = `20${yy}-${mm}-${dd}T${timePart}`;
                    const timeObj = new Date(isoString);
                    if (!isNaN(timeObj)) {
                        formattedTime = timeObj.toLocaleTimeString('vi-VN', { hour12: false });
                    }
                } catch (err) {}
            }

            if (!isDisplayingRouteDetails) {
                document.getElementById('bus-info').innerHTML = `
                    <p>Tốc độ: <strong>${speed} km/h</strong></p>
                    <p>Thời gian: <strong>${formattedTime}</strong></p>
                    <p>Khoảng cách đến bạn: <strong>${distanceText}</strong></p>
                    <p>Thời gian dự kiến đến bạn: <strong>${etaText}</strong></p>
                `;
            }
        } catch (e) {
            console.error('Lỗi xử lý dữ liệu MQTT:', e);
        }
    });
}

// Hàm hiển thị tuyến đường từ vị trí xe bus đến trạm đã chọn
async function displayBusToStationRoute(startCoords, endCoords) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const routeGeoJSON = { type: 'Feature', properties: {}, geometry: route.geometry };
            if (map.getSource('bus-to-station-route-src')) {
                map.getSource('bus-to-station-route-src').setData(routeGeoJSON);
            } else {
                map.addSource('bus-to-station-route-src', { type: 'geojson', data: routeGeoJSON });
                map.addLayer({
                    id: 'bus-to-station-route-layer',
                    type: 'line',
                    source: 'bus-to-station-route-src',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#5B27F5', 'line-width': 7, 'line-opacity': 0.85 }
                });
            }
            return route;
        }
    } catch (e) {
        console.error('Lỗi khi lấy đường đi từ xe buýt đến trạm:', e);
    }
}

async function onSelectFeature(feature) {
    if (!feature?.geometry?.coordinates) return;
    const stationCoords = feature.geometry.coordinates;

    map.flyTo({ center: stationCoords, zoom: 14, speed: 1.2, curve: 1, essential: true });

    if (!busCoordsGlobal || !speedGlobal) {
        alert("Chưa có dữ liệu xe buýt. Vui lòng đợi...");
        return;
    }

    const routeInfo = await displayBusToStationRoute(busCoordsGlobal, stationCoords);
    if (!routeInfo) {
        alert('Không thể tìm thấy tuyến đường đến trạm đã chọn.');
        return;
    }

    isDisplayingRouteDetails = true;
    const distance = (routeInfo.distance / 1000).toFixed(2);
    const duration = Math.round(routeInfo.duration / 60);
    const speed = parseFloat(speedGlobal);

    document.getElementById('bus-info').innerHTML = `
        <h6>Thông tin đến trạm:</h6>
        <p><strong>${feature.properties.name}</strong></p>
        <p>Khoảng cách di chuyển: <strong>${distance} km</strong></p>
        <p>Thời gian dự kiến: <strong>${duration} phút</strong></p>
        <p>Vận tốc hiện tại: <strong>${speed} km/h</strong></p>
        <button class="btn btn-sm btn-danger mt-2" onclick="clearRouteView()">Xóa tuyến đường</button>
    `;
    openRightPanel();
}

function clearRouteView() {
    isDisplayingRouteDetails = false;
    if (map.getLayer('bus-to-station-route-layer')) map.removeLayer('bus-to-station-route-layer');
    if (map.getSource('bus-to-station-route-src')) map.removeSource('bus-to-station-route-src');
    document.getElementById('bus-info').innerHTML = `<p>Đang chờ dữ liệu từ xe buýt...</p>`;
}

// Hàm hiển thị giao diện panel
function toggleLeftPanel(selector, show) {
    const panel = document.querySelector(selector);
    if (panel) panel.style.left = show ? '1rem' : '-100%';
}
function toggleRightPanel(show) {
    const panel = document.querySelector('.wrapper .right-panel');
    if (panel) panel.style.top = show ? '1rem' : '-100%';
}
function closeLeftPanel() { toggleLeftPanel('.wrapper .left-panel', false); document.querySelector('.wrapper .btn-open-leftpanel').style.display = 'flex'; }
function openLeftPanel() { toggleLeftPanel('.wrapper .left-panel', true); document.querySelector('.wrapper .btn-open-leftpanel').style.display = 'none'; }
function closeRightPanel() { toggleRightPanel(false); document.querySelector('.wrapper .btn-open-rightpanel').style.display = 'flex'; }
function openRightPanel() { toggleRightPanel(true); document.querySelector('.wrapper .btn-open-rightpanel').style.display = 'none'; }

// Hàm tạo danh sách các trạm 
function getDataToHtml(StationData, elmParentId, fieldVisible) {
    const elm = document.getElementById(elmParentId);
    if (elm) {
        elm.innerHTML = '';
        for (const feature of StationData.features) {
            const content = document.createElement("li");
            content.className = "list-group-item";
            content.innerHTML = feature.properties[fieldVisible];
            content.onclick = () => onSelectFeature(feature);
            elm.appendChild(content);
        }
    }
}

// Khởi tạo toàn bộ khi load Web
map.on('load', () => {
    addDataStation();
    initControls();
    initSearchBoxes();
    busTracker();

    document.getElementById('find-route-btn').addEventListener('click', () => {
        if (isRouteDisplayed) {
            clearRouteStations();
        } else {
            findRoute();
        }
    });
    getDataToHtml(StationData, 'lstBS', 'name');

    setTimeout(() => {
        if (geolocate) geolocate.trigger();
    }, 2000);
});