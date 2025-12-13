// --- CONFIGURATION ---
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw47MaQgGmPPVF0KUz_xxGzHrjuzf6a1ilU_OK1_hE59UqyFCFijAJXH8-VNKt8DegS1g/exec";

// Coordinates for Ibadan
const LOCATION = { lat: 7.3775, lng: 3.9470 }; 

const CONTAINER_HEIGHT = 16;
let warningLevel = 6; 
let floodLevel = 10;   

// State
let sensorData = { depth: 0, rate: 0, timestamp: new Date() }; // Added rate
let isOnline = true;
let isDarkMode = false;
let historyData = [];

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    initChart();
    initWeather(); // Changed name to match function below

    // Start Data Loop
    setInterval(fetchSensorData, 3000);

    // Initialize Ruler Marks
    const rulerContainer = document.getElementById('ruler-marks');
    for (let i = 0; i < 10; i++) {
        const mark = document.createElement('div');
        mark.className = "w-full border-b border-slate-400/50 h-[10%] flex items-end justify-end pr-1 text-[8px] text-slate-500 font-mono opacity-50";
        mark.innerText = (CONTAINER_HEIGHT - (i * (CONTAINER_HEIGHT / 10))).toFixed(0);
        rulerContainer.appendChild(mark);
    }

    // Attach User's Alert Logic
    const alertButton = document.getElementById("alertbtn");
    if (alertButton) alertButton.addEventListener("click", sendAlert);

    // Simulator Logic
    document.getElementById('sim-slider').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        // Simulate a fake rate for testing
        updateDashboard({ depth: val, rate: 1.5, timestamp: new Date() });
    });

    // Dark Mode Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        isDarkMode = !isDarkMode;
        updateChartTheme();
    });
});

// --- CORE DASHBOARD LOGIC ---

function fetchSensorData() {
    fetch(APPS_SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            console.group("🌊 Data Received");
            console.log("Raw JSON:", data);

            if (!data || data.WaterLevel === undefined) {
                console.warn("❌ Error: 'WaterLevel' key missing");
                console.groupEnd();
                return;
            }

            const fetchedDepth = parseFloat(data.WaterLevel);
            // Get the Rate of Rise (default to 0 if missing)
            const fetchedRate = parseFloat(data.Rate || 0);
            const fetchedTime = new Date(data.Timestamp);

            // Offline Check logic (Older than 5 mins = offline)
            const now = new Date();
            const timeDiff = now - fetchedTime;

            if (timeDiff > 5 * 60 * 1000) {
                isOnline = false;
            } else {
                isOnline = true;
            }
            updateStatusUI();

            // Update Dashboard
            updateDashboard({
                depth: fetchedDepth,
                rate: fetchedRate,
                timestamp: fetchedTime
            });
            console.groupEnd();
        })
        .catch(error => {
            console.error("❌ Error fetching sheet data:", error);
            isOnline = false;
            updateStatusUI();
        });
}

function updateDashboard(newData) {
    sensorData = newData;

    // 1. Get Values
    let currentDepth = Math.max(0, sensorData.depth);
    let currentRate = sensorData.rate;

    // Calculate percentage
    const percentage = Math.min(100, (currentDepth / CONTAINER_HEIGHT) * 100);

    // 2. Determine State
    const isFlood = currentDepth >= floodLevel;      
    const isWarning = currentDepth >= warningLevel;  

    // 3. Update Visualizer UI
    const waterEl = document.getElementById('water-level');
    const badgeEl = document.getElementById('status-badge');
    const ledEl = document.getElementById('sensor-led');
    const rorEl = document.getElementById('ror-val');

    waterEl.style.height = `${percentage}%`;
    document.getElementById('live-depth').innerText = currentDepth.toFixed(2);
    
    // Update Rate of Rise Text
    rorEl.innerText = currentRate.toFixed(2);

    // Dynamic Colors
    waterEl.className = `absolute bottom-0 w-full transition-all duration-1000 ease-in-out z-10 bg-gradient-to-t opacity-90 ${isFlood ? 'from-red-600 to-red-800' :
            isWarning ? 'from-yellow-500 to-yellow-600' :
                'from-blue-500 to-blue-700'
        }`;

    badgeEl.innerText = isFlood ? "CRITICAL FLOOD RISK" : isWarning ? "WARNING: HIGH LEVEL" : "NORMAL FLOW";
    badgeEl.className = `text-xs font-bold px-2 py-1 rounded bg-slate-900/5 inline-block ${isFlood ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-emerald-500'
        }`;

    if (isFlood) ledEl.classList.add('animate-ping', 'bg-red-500');
    else ledEl.classList.remove('animate-ping', 'bg-red-500');

    // 4. Update Alerts
    checkAlerts(currentDepth);

    // 5. Update Chart
    const timeLabel = new Date(sensorData.timestamp).toLocaleTimeString();
    const lastLabel = myChart.data.labels[myChart.data.labels.length - 1];

    if (lastLabel !== timeLabel) {
        addDataToChart(timeLabel, currentDepth);
    }
}

function updateStatusUI() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    if (isOnline) {
        dot.className = "h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse";
        text.className = "text-sm font-semibold text-emerald-600";
        text.innerText = "ONLINE";
    } else {
        dot.className = "h-2.5 w-2.5 rounded-full bg-red-500";
        text.className = "text-sm font-semibold text-red-500";
        text.innerText = "OFFLINE";
    }

    const dateObj = new Date(sensorData.timestamp);
    const formattedTime = !isNaN(dateObj) ? dateObj.toLocaleTimeString() : "--:--";
    document.getElementById('last-update').innerText = "Last Update: " + formattedTime;
}

function checkAlerts(currentDepth) {
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';

    if (currentDepth >= floodLevel) {
        createAlert('danger', 'CRITICAL WATER LEVEL', `Water is ${currentDepth.toFixed(0)}cm deep. Capacity limit reached.`);
    } else if (currentDepth >= warningLevel) {
        createAlert('warning', 'Water Rising', `Water level is ${currentDepth.toFixed(0)}cm. Approaching safe limits.`);
    }
}

function createAlert(type, title, msg) {
    const container = document.getElementById('alerts-container');
    const div = document.createElement('div');

    const colors = type === 'danger' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200' :
        'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200';
    const icon = type === 'danger' ? 'triangle-alert' : 'bell';

    div.className = `p-4 rounded-xl flex items-center gap-3 shadow-sm border animate-pulse ${colors}`;
    div.innerHTML = `
        <i data-lucide="${icon}" class="h-5 w-5"></i>
        <div>
            <h4 class="font-bold text-sm">${title}</h4>
            <p class="text-xs opacity-90">${msg}</p>
        </div>
    `;
    container.appendChild(div);
    lucide.createIcons();
}

// --- WEATHER API ---
async function initWeather() {
    try {
        // Added 'relative_humidity_2m' to the requested fields
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lng}&current=temperature_2m,relative_humidity_2m,weather_code&hourly=precipitation_probability&forecast_days=1`);
        const w = await res.json();
        
        // Temperature
        document.getElementById('weather-temp').innerText = w.current.temperature_2m.toFixed(0);
        document.getElementById('weather-desc').innerText = "Live Forecast";

        // Rain Probability
        const nowIdx = new Date().getHours();
        const rain = Math.max(w.hourly.precipitation_probability[nowIdx], w.hourly.precipitation_probability[nowIdx + 1]);
        document.getElementById('rain-prob').innerText = rain + "%";
        document.getElementById('rain-bar').style.width = rain + "%";

        // Humidity (New)
        const humidity = w.current.relative_humidity_2m;
        document.getElementById('humidity-val').innerText = humidity + "%";
        document.getElementById('humidity-bar').style.width = humidity + "%";

    } catch (e) { console.log(e); }
}

// --- CHART.JS SETUP ---
let myChart;
function initChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Water Depth (cm)',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function addDataToChart(label, data) {
    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets[0].data.shift();
    }
    myChart.data.labels.push(label);
    myChart.data.datasets[0].data.push(data);
    myChart.update();
}

function updateChartTheme() {
    const color = document.documentElement.classList.contains('dark') ? '#334155' : '#e2e8f0';
    myChart.options.scales.y.grid.color = color;
    myChart.update();
}

// --- EMAIL ALERT LOGIC ---

function getEmails() {
    const container = document.getElementById("alertemails");
    const emailSpans = container.querySelectorAll(".email span");
    const emails = Array.from(emailSpans).map(span => span.textContent.trim());
    return emails;
}

function addEmail() {
    const input = document.getElementById('new-email');
    const email = input.value;
    if (email && email.includes('@')) {
        const container = document.getElementById("alertemails");
        const div = document.createElement('div');
        div.className = "email flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300";
        div.innerHTML = `<span>${email}</span><i data-lucide="check" class="w-3 h-3 text-emerald-500"></i>`;
        container.appendChild(div);
        input.value = '';
        lucide.createIcons();
    } else {
        alert("Please enter a valid email");
    }
}

function sendAlert() {
    const emails = getEmails();
    const alertButton = document.getElementById("alertbtn");

    if (emails.length === 0) {
        alert("No emails found to send alerts to.");
        return;
    }

    const originalText = alertButton.innerHTML;
    alertButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Sending...`;
    alertButton.disabled = true;
    lucide.createIcons();

    const payload = {
        action: "manual_alert",
        emails: emails,
        message: "⚠ CRITICAL TEST ALERT: RiverGuard System Triggered!"
    };

    fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        mode: "no-cors"
    })
        .then(() => {
            alert("Alert signal sent to system!");
        })
        .catch(error => {
            console.error("Error:", error);
            alert("Error sending alerts.");
        })
        .finally(() => {
            alertButton.innerHTML = originalText;
            alertButton.disabled = false;
            lucide.createIcons();
        });
}