// --- CONFIGURATION ---
// Ensure this is your deployed Web App URL (Permissions: "Anyone")
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyvH88HT0pC69iCIdgFzxFotDcfSUEcDMEm5i2FCe6UhRKxiiMWYdZ84_WIW_sH38M/exec";

const LOCATION = { lat: 6.5244, lng: 3.3792 }; // Lagos

// UPDATE: Container is 100cm tall
const CONTAINER_HEIGHT = 100; 

// UPDATE: Triggers based on DEPTH (Bottom up)
// Since max is 100cm:
let warningLevel = 70; // Yellow alert if water passes 70cm
let floodLevel = 90;   // Red alert if water passes 90cm

// State
let sensorData = { depth: 0, timestamp: new Date() }; // Changed 'distance' to 'depth'
let isOnline = true;
let isDarkMode = false;
let historyData = [];

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    initChart();
    fetchWeather();
    
    // Start Data Loop (Fetch every 3 seconds)
    setInterval(fetchSensorData, 3000); 
    
    // Initialize Ruler Marks (Visual Guide 100cm down to 0)
    const rulerContainer = document.getElementById('ruler-marks');
    for(let i=0; i<10; i++) {
        const mark = document.createElement('div');
        mark.className = "w-full border-b border-slate-400/50 h-[10%] flex items-end justify-end pr-1 text-[8px] text-slate-500 font-mono opacity-50";
        // Labels: 100, 90, 80...
        mark.innerText = (CONTAINER_HEIGHT - (i * (CONTAINER_HEIGHT/10))).toFixed(0);
        rulerContainer.appendChild(mark);
    }

    // Attach User's Alert Logic
    const alertButton = document.getElementById("alertbtn");
    if (alertButton) alertButton.addEventListener("click", sendAlert);

    // Simulator Logic (Testing UI manually)
    document.getElementById('sim-slider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        console.log("Simulating Water Depth:", val);
        // Make sure the slider matches 0-100 scale in HTML or just interpret it here
        updateDashboard({ depth: val, timestamp: new Date() });
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
            // --- CONSOLE LOGGING (UPDATED FOR DIRECT VALUE) ---
            console.group("🌊 Data Received (Pre-Calculated)");
            console.log("Raw JSON:", data);
            
            if (!data || data.WaterLevel === undefined) {
                console.warn("❌ Error: 'WaterLevel' key missing");
                console.groupEnd();
                return;
            }

            // UPDATE: Direct assignment. No subtraction.
            const fetchedDepth = parseInt(data.WaterLevel);
            const fetchedTime = new Date(data.Timestamp);
            
            console.log(`✅ Water Depth (from Arduino): ${fetchedDepth} cm`);
            console.log(`📏 Container Max Height: ${CONTAINER_HEIGHT} cm`);
            console.log(`🕒 Timestamp: ${fetchedTime.toLocaleTimeString()}`);
            console.groupEnd();
            // ----------------------------------------------

            // Offline Check logic (Older than 5 mins = offline)
            const now = new Date();
            const timeDiff = now - fetchedTime;
            
            if (timeDiff > 5 * 60 * 1000) {
                isOnline = false;
                console.log("⚠ Device Status: OFFLINE (Data is old)");
            } else {
                isOnline = true;
            }
            updateStatusUI();

            // Update Dashboard
            updateDashboard({
                depth: fetchedDepth,
                timestamp: fetchedTime
            });
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
    // UPDATE: We use the depth directly. Clamp it between 0 and 100 just for safe UI.
    let currentDepth = Math.max(0, sensorData.depth); 
    
    // Calculate percentage based on 100cm container
    const percentage = Math.min(100, (currentDepth / CONTAINER_HEIGHT) * 100);
    
    // 2. Determine State (Direct comparison)
    const isFlood = currentDepth >= floodLevel;      // e.g. >= 90cm
    const isWarning = currentDepth >= warningLevel;  // e.g. >= 70cm
    
    // 3. Update Visualizer UI
    const waterEl = document.getElementById('water-level');
    const badgeEl = document.getElementById('status-badge');
    const ledEl = document.getElementById('sensor-led');
    
    waterEl.style.height = `${percentage}%`;
    document.getElementById('live-depth').innerText = currentDepth.toFixed(1);

    // Dynamic Colors
    waterEl.className = `absolute bottom-0 w-full transition-all duration-1000 ease-in-out z-10 bg-gradient-to-t opacity-90 ${
        isFlood ? 'from-red-600 to-red-800' : 
        isWarning ? 'from-yellow-500 to-yellow-600' : 
        'from-blue-500 to-blue-700'
    }`;

    badgeEl.innerText = isFlood ? "CRITICAL FLOOD RISK" : isWarning ? "WARNING: HIGH LEVEL" : "NORMAL FLOW";
    badgeEl.className = `text-xs font-bold mt-1 px-2 py-1 rounded bg-slate-900/5 inline-block ${
        isFlood ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-emerald-500'
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
    
    if(isOnline) {
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
async function fetchWeather() {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lng}&current=temperature_2m,rain&hourly=precipitation_probability&forecast_days=1`);
        const data = await res.json();
        
        const temp = data.current.temperature_2m;
        const rainProb = data.hourly.precipitation_probability[0];
        const isRaining = data.current.rain > 0;

        document.getElementById('temp-val').innerText = temp;
        document.getElementById('rain-prob').innerText = rainProb;
        document.getElementById('rain-bar').style.width = `${rainProb}%`;

        const iconBg = document.getElementById('weather-icon-bg');
        if (isRaining) {
            iconBg.className = "p-3 rounded-2xl bg-blue-500 text-white";
            iconBg.innerHTML = '<i data-lucide="cloud-rain"></i>';
        } else {
            iconBg.className = "p-3 rounded-2xl bg-yellow-400 text-white";
            iconBg.innerHTML = '<i data-lucide="sun"></i>';
        }
        lucide.createIcons();

    } catch (e) { console.error("Weather Error", e); }
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
    if(email && email.includes('@')) {
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