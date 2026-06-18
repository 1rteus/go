let startTime;
let timerInterval;
let totalDistance = 0;
let totalTime = 0;
let isTracking = false;
let wakeLock = null;
let watchId = null;
let lastPosition = null;

const startBtn = document.getElementById('startBtn');
const timeDisplay = document.getElementById('time');
const distanceDisplay = document.getElementById('distance');
const results = document.getElementById('results');
const resultDistance = document.getElementById('resultDistance');
const resultSpeed = document.getElementById('resultSpeed');
const resultCalories = document.getElementById('resultCalories');
const statusText = document.getElementById('statusText');
const closeBtn = document.getElementById('closeBtn');
const trophyBtn = document.getElementById('trophyBtn');
const historyPanel = document.getElementById('historyPanel');
const historyOverlay = document.getElementById('historyOverlay');
const historyClose = document.getElementById('historyClose');
const historyList = document.getElementById('historyList');

startBtn.addEventListener('click', toggleTracking);
closeBtn.addEventListener('click', () => {
    results.classList.remove('show');
    resetDisplay();
});
trophyBtn.addEventListener('click', openHistory);
historyClose.addEventListener('click', closeHistory);
historyOverlay.addEventListener('click', closeHistory);

function resetDisplay() {
    timeDisplay.textContent = '0:00';
    distanceDisplay.textContent = '0.00 км';
    totalDistance = 0;
    totalTime = 0;
}

async function toggleTracking() {
    if (!isTracking) {
        await startTracking();
    } else {
        stopTracking();
    }
}

async function startTracking() {
    if (!navigator.geolocation) {
        alert('Геолокация не поддерживается');
        return;
    }

    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        lastPosition = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (e) {
        alert('Разрешите доступ к геолокации');
        return;
    }

    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
    } catch (e) {}

    isTracking = true;
    startTime = Date.now();
    totalDistance = 0;
    totalTime = 0;

    timerInterval = setInterval(() => {
        totalTime = Math.floor((Date.now() - startTime) / 1000);
        updateTimerDisplay(totalTime);
    }, 1000);

    startBtn.textContent = 'Стоп';
    startBtn.classList.add('active');
    statusText.textContent = 'Тренировка идёт...';

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            if (!isTracking) return;
            const newPos = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            if (lastPosition) {
                const dist = calculateDistance(lastPosition, newPos);
                if (dist > 0.001) {
                    totalDistance += dist;
                    distanceDisplay.textContent = (totalDistance / 1000).toFixed(2) + ' км';
                }
            }
            lastPosition = newPos;
        },
        (error) => console.error('Ошибка геолокации:', error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

function stopTracking() {
    isTracking = false;
    clearInterval(timerInterval);

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }

    totalTime = Math.floor((Date.now() - startTime) / 1000);

    const distanceKm = totalDistance / 1000;
    const timeHours = totalTime / 3600;
    const speed = timeHours > 0 ? distanceKm / timeHours : 0;
    const coefficient = getCoefficient(speed);
    const calories = 68 * distanceKm * coefficient;

    resultDistance.textContent = distanceKm.toFixed(2);
    resultSpeed.textContent = speed.toFixed(1);
    resultCalories.textContent = Math.round(calories);

    startBtn.textContent = 'Старт';
    startBtn.classList.remove('active');
    statusText.textContent = '';

    saveTraining({
        date: new Date().toISOString(),
        time: totalTime,
        distance: distanceKm,
        speed: speed,
        calories: Math.round(calories)
    });

    setTimeout(() => results.classList.add('show'), 100);
}

function updateTimerDisplay(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timeDisplay.textContent = m + ':' + s.toString().padStart(2, '0');
}

function calculateDistance(pos1, pos2) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(pos2.latitude - pos1.latitude);
    const dLon = toRad(pos2.longitude - pos1.longitude);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(pos1.latitude)) * Math.cos(toRad(pos2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getCoefficient(speed) {
    if (speed <= 15) return 0.29;
    if (speed <= 20) return 0.385;
    if (speed <= 25) return 0.475;
    return 0.575;
}

function saveTraining(training) {
    const trainings = JSON.parse(localStorage.getItem('gps_trainings') || '[]');
    trainings.push(training);
    localStorage.setItem('gps_trainings', JSON.stringify(trainings));
}

function getTrainings() {
    return JSON.parse(localStorage.getItem('gps_trainings') || '[]');
}

function deleteTraining(index) {
    const trainings = getTrainings();
    trainings.splice(index, 1);
    localStorage.setItem('gps_trainings', JSON.stringify(trainings));
    renderHistory();
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return h + 'ч ' + m + 'м';
    return m + 'м ' + s + 'с';
}

function formatDate(iso) {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return day + '.' + month + '.' + year + '  ' + hours + ':' + mins;
}

function renderHistory() {
    const trainings = getTrainings();
    if (trainings.length === 0) {
        historyList.innerHTML = '<div class="history-empty">Нет тренировок</div>';
        return;
    }

    let html = '';
    for (let i = trainings.length - 1; i >= 0; i--) {
        const t = trainings[i];
        html += `
            <div class="history-item">
                <button class="history-delete" onclick="deleteTraining(${i})">&times;</button>
                <div class="history-date">${formatDate(t.date)}</div>
                <div class="history-stats">
                    <div class="history-stat">
                        <div class="history-stat-value">${t.distance.toFixed(2)}</div>
                        <div class="history-stat-label">км</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-value">${formatTime(t.time)}</div>
                        <div class="history-stat-label">время</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-value">${t.calories}</div>
                        <div class="history-stat-label">ккал</div>
                    </div>
                </div>
            </div>
        `;
    }
    historyList.innerHTML = html;
}

function openHistory() {
    renderHistory();
    historyPanel.classList.add('show');
    historyOverlay.classList.add('show');
}

function closeHistory() {
    historyPanel.classList.remove('show');
    historyOverlay.classList.remove('show');
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isTracking && 'wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {}
    }
});