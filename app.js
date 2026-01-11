// Data Configuration - PLEASE UPDATE THESE
const LIFF_ID = '2008863808-e2MCAccQ';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyH1oMpE1tEJaFZjf1QGAurl_EkF4Nf_MZwEcayxHpcVHKrqhe2Q6dqp7zHBMkS3YrpQg/exec'; // Updated Link

const CARS_DATA = [
    { id: 1, plate: 'ญช 908 กท', model: 'Cap', color: 'White', type: 'Fuel' },
    { id: 2, plate: 'ฎฮ 9043 กท', model: 'Optra', color: 'Black', type: 'Fuel' },
    { id: 3, plate: '1ขท 3650 กท', model: 'Optra', color: 'Gray', type: 'Fuel' },
    { id: 4, plate: 'สท 4690 กท', model: 'Optra', color: 'White', type: 'Fuel' },
    { id: 5, plate: '3ขช 2404 กท', model: 'Optra', color: 'Silver', type: 'Fuel' },
    { id: 6, plate: '3ขช 3222 กท', model: 'Cap', color: 'Brown', type: 'Fuel' },
    { id: 7, plate: 'บ 3004 กท', model: 'MG4', color: 'White', type: 'EV' },
    { id: 8, plate: 'ฮ 2227 กท', model: 'MG4', color: 'Gray', type: 'EV' }
];

// State
let bookings = []; // Now fetching from server
let currentDate = new Date();
let liffProfile = null; // Store user profile

// DOM Elements
const modal = document.getElementById('bookingModal');
const bookingForm = document.getElementById('bookingForm');
const timelineGrid = document.getElementById('timelineGrid');
const carModelSelect = document.getElementById('carModel');
const carPlateSelect = document.getElementById('carPlate');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize LIFF
    await initLiff();

    // 2. Fetch Data from Sheet (No more localStorage)
    await fetchBookings();

    // 3. UI Init
    initSelectOptions();
    renderDashboard();
    updateStats();

    // Set default dates in form (today 9am - today 5pm)
    const now = new Date();
    // now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    // document.getElementById('startDate').value = now.toISOString().slice(0, 16);
    // document.getElementById('endDate').value = now.toISOString().slice(0, 16);
});

function generateDummyData() {
    bookings = [
        { id: 1, user: 'นัท', carId: 5, start: '2026-01-02T09:00', end: '2026-01-05T17:00', purpose: 'ส่วนตัว', status: 'Approved' },
        { id: 2, user: 'นัท', carId: 8, start: '2026-01-06T09:00', end: '2026-01-07T17:00', purpose: 'TSE', status: 'Rejected' },
        { id: 3, user: 'เบส', carId: 2, start: '2026-01-05T09:00', end: '2026-01-09T17:00', purpose: 'ITTHI', status: 'Approved' },
        { id: 4, user: 'เอิญ', carId: 7, start: '2026-01-12T09:00', end: '2026-01-15T17:00', purpose: 'MGI', status: 'Pending' }, // Pending won't show on timeline
        { id: 5, user: 'โอ๊ต', carId: 6, start: '2026-01-12T09:00', end: '2026-01-12T17:00', purpose: 'ABD', status: 'Approved' },
        { id: 6, user: 'แป้ง', carId: 7, start: '2026-01-10T09:00', end: '2026-01-11T17:00', purpose: 'ส่วนตัว', status: 'Approved' },
        { id: 7, user: 'เกมส์', carId: 3, start: '2026-01-01T09:00', end: '2026-01-03T17:00', purpose: 'ธุระ', status: 'Approved' }
    ];
    saveBookings();
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Generate Dummy Data if empty
    if (bookings.length === 0) {
        generateDummyData();
    }

    // initSelectOptions(); // Don't init all cars immediately, wait for date selection or init available
    renderDashboard();
    updateStats();

    // Set default dates (Use Local Time)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    startInput.value = dateStr;
    endInput.value = dateStr;

    // Set min date (Today) to prevent past dates
    startInput.min = dateStr;
    endInput.min = dateStr;

    // Constraint Logic: Ensure End Date >= Start Date
    startInput.addEventListener('change', (e) => {
        endInput.min = e.target.value;
        if (endInput.value < e.target.value) {
            endInput.value = e.target.value;
        }
    });

    // Initial filter with default date
    filterAvailableCars();
});

// Logic: Filter Cars based on Date Range
window.filterAvailableCars = function () {
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    const startVal = startInput.value;
    const endVal = endInput.value;

    const modelSelect = document.getElementById('carModel');
    const plateSelect = document.getElementById('carPlate');

    if (!startVal || !endVal) {
        modelSelect.innerHTML = '<option value="">กรุณาเลือกวันที่ก่อน...</option>';
        modelSelect.disabled = true;
        plateSelect.innerHTML = '<option value="">รอเลือกรุ่นรถ...</option>';
        plateSelect.disabled = true;
        return;
    }

    modelSelect.disabled = false;

    // Find busy car IDs
    const busyCarIds = new Set();
    const startDate = new Date(startVal + 'T00:00:00');
    const endDate = new Date(endVal + 'T23:59:59');

    bookings.forEach(b => {
        if (b.status !== 'Approved') return;

        const bStart = new Date(b.start);
        const bEnd = new Date(b.end);

        // Check overlap
        if (startDate <= bEnd && endDate >= bStart) {
            busyCarIds.add(b.carId);
            console.log(`🚫 รถ ID ${b.carId} ไม่ว่าง (${b.carPlate}) เพราะถูกจองวันที่ ${b.start} ถึง ${b.end}`);
        }
    });

    // Filter Global CARS_DATA
    const availableCars = CARS_DATA.filter(c => !busyCarIds.has(c.id));

    console.log(`📊 สรุป: จากรถทั้งหมด ${CARS_DATA.length} คัน มีรถว่าง ${availableCars.length} คัน`);
    console.log(`✅ รถที่ว่าง:`, availableCars.map(c => c.plate));

    // Populate Models (Only available ones)
    const availableModels = [...new Set(availableCars.map(c => c.model))];

    // Save available cars state for plate filtering
    window.currentAvailableCars = availableCars;

    // Render Models
    const currentModel = modelSelect.value;
    modelSelect.innerHTML = '<option value="">เลือกรุ่นรถ...</option>' +
        availableModels.map(m => `<option value="${m}">${m}</option>`).join('');

    // Restore selection if still available
    if (availableModels.includes(currentModel)) {
        modelSelect.value = currentModel;
        filterPlates(); // Refill plates
    } else {
        modelSelect.value = "";
        plateSelect.innerHTML = '<option value="">รอเลือกรุ่นรถ...</option>';
        plateSelect.disabled = true;
    }
}

// Logic: Filter Plates based on Model (from available subset)
window.filterPlates = function () {
    const selectedModel = document.getElementById('carModel').value;
    const plateSelect = document.getElementById('carPlate');

    plateSelect.innerHTML = '<option value="">เลือกทะเบียน...</option>';

    if (selectedModel && window.currentAvailableCars) {
        const cars = window.currentAvailableCars.filter(c => c.model === selectedModel);
        plateSelect.innerHTML += cars.map(c =>
            `<option value="${c.id}">${c.plate} (${c.color})</option>`
        ).join('');
        plateSelect.disabled = false;
    } else {
        plateSelect.disabled = true;
    }
}

// Render Timeline with Gantt-style booking bars
function renderDashboard() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().getDate();
    const CELL_WIDTH = 40; // Must match CSS min-width
    const FIRST_COLUMN_WIDTH = 200; // Car info column width

    document.getElementById('currentMonthYear').textContent =
        currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    let html = `
        <table class="calendar-table">
            <thead>
                <tr>
                    <th style="min-width: ${FIRST_COLUMN_WIDTH}px; left: 0; z-index: 20; background: #0f172a;">Car / Date</th>
    `;

    // Render Headers (Days)
    for (let d = 1; d <= daysInMonth; d++) {
        const isWeekend = new Date(year, month, d).getDay() % 6 === 0;
        const bg = (d === today && new Date().getMonth() === month) ? 'rgba(59, 130, 246, 0.3)' :
            (isWeekend ? 'rgba(255, 255, 255, 0.05)' : '');
        html += `<th style="min-width: ${CELL_WIDTH}px; background: ${bg}">${d}</th>`;
    }
    html += `</tr></thead><tbody>`;

    // Render Rows (Cars) with booking bars
    CARS_DATA.forEach(car => {
        html += `
            <tr class="car-row">
                <td class="car-cell" style="position: sticky; left: 0; background: #1e293b; z-index: 5;">
                    <div class="car-model">${car.model} <span class="dot ${car.type.toLowerCase()}" style="display:inline-block; width:6px; height:6px;"></span></div>
                    <div class="car-plate">${car.plate}</div>
                </td>
        `;

        // Render empty cells for grid structure
        for (let d = 1; d <= daysInMonth; d++) {
            html += `<td class="day-cell"></td>`;
        }

        html += `</tr>`;

        // Add booking bars for this car
        const carBookings = bookings.filter(b => b.carId == car.id && b.status === 'Approved');

        carBookings.forEach((booking, index) => {
            const bStart = new Date(booking.start);
            const bEnd = new Date(booking.end);
            const bMonth = bStart.getMonth();

            // Only render if booking is in current month
            if (bMonth !== month) return;

            const startDay = bStart.getDate();
            const endDay = bEnd.getDate();
            const duration = endDay - startDay + 1;

            // Calculate position and width
            const leftPos = FIRST_COLUMN_WIDTH + (startDay - 1) * CELL_WIDTH;
            const barWidth = duration * CELL_WIDTH;

            // Vertical offset for multiple bookings (stacking)
            const topOffset = 50 + (index * 40); // Center + stack offset

            const tooltip = `${getFormattedDate(booking.start)} - ${getFormattedDate(booking.end)}\n${booking.user}: ${booking.purpose}`;

            // Insert booking bar after the row
            const barHtml = `
                <div class="booking-bar" 
                     style="left: ${leftPos}px; width: ${barWidth}px; top: ${topOffset}%;"
                     title="${tooltip}">
                    <span class="booking-label">${booking.user}</span>
                </div>
            `;

            // We'll append bars after table is rendered
            // Store bar data for now
            if (!window.pendingBookingBars) window.pendingBookingBars = [];
            window.pendingBookingBars.push({
                carId: car.id,
                html: barHtml
            });
        });
    });

    html += `</tbody></table>`;
    timelineGrid.innerHTML = html;

    // Now append booking bars to their respective rows
    if (window.pendingBookingBars && window.pendingBookingBars.length > 0) {
        const rows = timelineGrid.querySelectorAll('.car-row');

        window.pendingBookingBars.forEach(bar => {
            const carIndex = CARS_DATA.findIndex(c => c.id === bar.carId);
            if (carIndex >= 0 && rows[carIndex]) {
                rows[carIndex].insertAdjacentHTML('beforeend', bar.html);
            }
        });

        // Clear pending bars
        window.pendingBookingBars = [];
    }
}

// Booking Logic
bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const startVal = document.getElementById('startDate').value;
    const endVal = document.getElementById('endDate').value;

    const newBooking = {
        id: Date.now(),
        user: document.getElementById('userName').value,
        carId: parseInt(document.getElementById('carPlate').value),
        // Save as full ISO for compatibility with existing data structure, but set times to start/end of day
        start: startVal + 'T09:00:00', // Default working hours for cleanliness? Or 00:00?
        end: endVal + 'T17:00:00',
        purpose: document.getElementById('jobPurpose').value,
        status: 'Pending'
    };

    if (new Date(endVal) < new Date(startVal)) {
        alert('วันที่คืนรถต้องหลังจากวันที่เริ่ม');
        return;
    }

    // Double check conflict (Server-side style)
    // If we filter available cars, this check should ideally pass.
    // However, if a user quickly submits before the filter updates or if there's a race condition,
    // this server-side style check is good.
    // For now, the client-side filterAvailableCars should prevent this.
    // If we want to be super strict, we can re-run the conflict check here.
    // For this exercise, we assume the filterAvailableCars is sufficient.

    // Submit to Google Sheet (Async)
    submitBookingToSheet(newBooking);
});

async function initLiff() {
    try {
        if (!LIFF_ID || LIFF_ID === 'YOUR_LIFF_ID_HERE') {
            console.log("LIFF ID not configured yet.");
            return;
        }
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            liffProfile = profile;

            // Auto-fill user name if Profile exists
            const nameInput = document.getElementById('userName');
            if (nameInput) {
                nameInput.value = profile.displayName;
                // nameInput.readOnly = true; // Optional: Let them edit display name if they want
            }

            // Update Sidebar Profile
            const sidebarName = document.querySelector('.user-profile .name');
            if (sidebarName) sidebarName.textContent = profile.displayName;
            const sidebarAvatar = document.querySelector('.user-profile .avatar');
            if (sidebarAvatar) sidebarAvatar.textContent = profile.displayName.charAt(0);

            // Show Mobile View optimized?
            // For now, standard view is decent.
        } else {
            // Force login to get User ID for Message API
            liff.login();
        }
    } catch (err) {
        console.error('LIFF Init Error:', err);
    }
}

async function submitBookingToSheet(bookingData) {
    // Show Loading
    document.getElementById('loadingOverlay').style.display = 'flex';

    // Ensure we have a profile if possible
    if (!liffProfile && liff.isLoggedIn()) {
        try {
            liffProfile = await liff.getProfile();
        } catch (e) { console.error(e); }
    }

    // Lookup Car Details for Sheet
    const car = CARS_DATA.find(c => c.id == bookingData.carId);
    const carModelStr = car ? `${car.model} ${car.color}` : 'Unknown';
    const carPlateStr = car ? car.plate : 'Unknown';

    // Enrich with LIFF data if available
    const payload = {
        ...bookingData,
        userId: liffProfile ? liffProfile.userId : 'guest',
        user: bookingData.user,
        // Add explicit columns for Sheet
        carId: bookingData.carId, // Add ID back
        carModel: carModelStr,
        carPlate: carPlateStr,
        // No action needed for create (default)
    };

    // 1. Save locally for immediate UI update (Optimistic UI)
    bookings.push(payload);
    // saveBookings(); // logic removed

    // Refresh UI immediately
    closeBookingModal();
    bookingForm.reset();
    renderDashboard();
    updateStats();
    showSection('bookings');

    // 2. Send to Google Sheets
    if (GOOGLE_SCRIPT_URL) {
        try {
            // Use 'no-cors' mode for GScript simple triggers, OR handle CORS properly in script (hard).
            // Usually fetch to macro returning JSON requires specific CORS headers or use text/plain.
            // Google Apps Script Post typically needs: Content-Type: text/plain to avoid preflight issues easily.

            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Important for simple GAS requests
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify(payload)
            });

            // Clear cache to force fresh data on next load
            localStorage.removeItem('carrent_bookings_cache');

            // Fetch latest to get real timestamp/ID if needed, but optimistic is fine
            await fetchBookings(true); // Force refresh
            alert(`จองสำเร็จ! (Saved to Sheet)`);
        } catch (error) {
            console.error('Sheet Error:', error);
            alert('ส่งข้อมูลไม่สำเร็จ (Network Error)');
        }
    } else {
        alert('จองสำเร็จ! (Local Only - Please config API URL)');
    }

    document.getElementById('loadingOverlay').style.display = 'none';
}

function checkConflict(newBk) {
    return bookings.some(b => {
        if (b.status !== 'Approved') return false; // Only conflict with approved
        if (b.carId != newBk.carId) return false;

        const startA = new Date(newBk.start).getTime();
        const endA = new Date(newBk.end).getTime();
        const startB = new Date(b.start).getTime();
        const endB = new Date(b.end).getTime();

        return (startA < endB && endA > startB);
    });
}

function updateStats() {
    document.getElementById('statTotalCars').textContent = CARS_DATA.length;

    const now = new Date();
    // Only count Approved for "In Use"
    const busyNow = bookings.filter(b => {
        if (b.status !== 'Approved') return false;
        const s = new Date(b.start);
        const e = new Date(b.end);
        return now >= s && now <= e;
    }).length;

    document.getElementById('statInUse').textContent = busyNow;
    document.getElementById('statAvailable').textContent = CARS_DATA.length - busyNow;
}

// Modal Controls
window.openBookingModal = () => modal.classList.add('open');
window.closeBookingModal = () => modal.classList.remove('open');

// Navigation logic
window.showSection = function (sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    // Show target section
    document.getElementById(sectionId).classList.add('active');

    // Update Sidebar
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.classList.remove('active');
        if (link.onclick.toString().includes(sectionId)) {
            link.classList.add('active');
        }
    });

    // Refresh specific views
    if (sectionId === 'bookings') {
        renderBookingsTable();
    } else if (sectionId === 'dashboard') {
        renderDashboard();
    }
}

// Helper: Strict Date Formatter (dd/mm/yyyy)
function getFormattedDate(isoString) {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// ...

function renderBookingsTable() {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    const sorted = [...bookings].sort((a, b) => new Date(b.start) - new Date(a.start));

    tbody.innerHTML = sorted.map(b => {
        // Use lookup car if found, OR fall back to the data from Sheet directly
        const car = CARS_DATA.find(c => c.id == b.carId);

        const displayPlate = car ? car.plate : (b.carPlate || 'Unknown');
        const displayModel = car ? car.model : (b.carModel || 'Unknown');

        // Use Strict Format
        const start = getFormattedDate(b.start);
        const end = getFormattedDate(b.end);

        let statusBadge = '';
        if (b.status === 'Approved') statusBadge = '<span style="color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 4px;">Approved</span>';
        else if (b.status === 'Rejected') statusBadge = '<span style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px;">Rejected</span>';
        else statusBadge = '<span style="color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 4px 8px; border-radius: 4px;">Pending</span>';

        let actions = '';
        if (b.status === 'Pending') {
            actions = `
                <button onclick="updateStatus(${b.id}, 'Approved')" style="cursor: pointer; background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 4px;">Approve</button>
                <button onclick="updateStatus(${b.id}, 'Rejected')" style="cursor: pointer; background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px;">Reject</button>
            `;
        }

        return `
            <tr>
                <td>${start}</td>
                <td>${end}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="avatar" style="width: 24px; height: 24px; font-size: 0.7rem;">${b.user.charAt(0)}</div>
                        ${b.user}
                    </div>
                </td>
                <td>${b.purpose}</td>
                <td><span style="font-family: monospace; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${displayPlate}</span></td>
                <td>${displayModel}</td>
                <td>${statusBadge}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');

    // ALSO RENDER MOBILE LIST (Responsive)
    renderMobileHistory(sorted);
}

function renderMobileHistory(bookingsData) {
    const container = document.getElementById('mobileHistoryList');
    if (!container) return;

    if (bookingsData.length === 0) {
        container.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 1rem;">ไม่มีประวัติการจอง</div>';
        return;
    }

    // Limit to 5 recent items for mobile dashboard
    const recent = bookingsData.slice(0, 5);

    container.innerHTML = recent.map(b => {
        const car = CARS_DATA.find(c => c.id == b.carId);
        const displayPlate = car ? car.plate : (b.carPlate || 'Unknown');
        const displayModel = car ? car.model : (b.carModel || 'Unknown');

        const start = getFormattedDate(b.start);

        let statusColor = '#f59e0b'; // Pending
        if (b.status === 'Approved') statusColor = '#10b981';
        if (b.status === 'Rejected') statusColor = '#ef4444';

        return `
            <div class="history-item">
                <div>
                    <div class="h-date"><i class="fa-solid fa-calendar"></i> ${start}</div>
                    <div class="h-car" style="color:white; font-weight:500;">${displayModel}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${displayPlate}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${b.purpose}</div>
                </div>
                <div class="h-status" style="color: ${statusColor}; background: ${statusColor}20; border: 1px solid ${statusColor}40;">
                    ${b.status}
                </div>
            </div>
        `;
    }).join('');
}

// --- API & DATA SYNC ---

async function fetchBookings(forceRefresh = false) {
    if (!GOOGLE_SCRIPT_URL) return;

    const CACHE_KEY = 'carrent_bookings_cache';
    const CACHE_TIME_KEY = 'carrent_bookings_cache_time';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    try {
        // 1. Load from cache first (instant!)
        if (!forceRefresh) {
            const cachedData = localStorage.getItem(CACHE_KEY);
            const cachedTime = localStorage.getItem(CACHE_TIME_KEY);

            if (cachedData && cachedTime) {
                const age = Date.now() - parseInt(cachedTime);

                // Use cache if less than 5 minutes old
                if (age < CACHE_DURATION) {
                    console.log('⚡ Loading from cache (instant!)');
                    const cached = JSON.parse(cachedData);
                    bookings = processBookingsData(cached);

                    // Render immediately
                    renderDashboard();
                    renderBookingsTable();
                    updateStats();

                    // Fetch fresh data in background (don't wait)
                    fetchFreshDataInBackground();
                    return;
                }
            }
        }

        // 2. Fetch fresh data if cache is old or forced
        console.log('🔄 Fetching fresh data from server...');
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();

        if (Array.isArray(data)) {
            // Save to cache
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());

            bookings = processBookingsData(data);
            console.log("✅ Bookings loaded:", bookings.length);

            // Re-render everything
            renderDashboard();
            renderBookingsTable();
            updateStats();
        }
    } catch (error) {
        console.error("Failed to fetch bookings:", error);

        // Fallback to cache even if expired
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
            console.log('⚠️ Using old cache as fallback');
            bookings = processBookingsData(JSON.parse(cachedData));
            renderDashboard();
            renderBookingsTable();
            updateStats();
        }
    }
}

// Helper: Process raw data from API
function processBookingsData(data) {
    return data.map(b => {
        // 1. Recover Car ID from Plate (Try to match)
        const car = CARS_DATA.find(c => (b.carPlate || '').trim() === c.plate.trim());

        // 2. Robust Date Fixer (Handles '2026-01-11 9.00.00' from Sheet)
        const fixDate = (str) => {
            if (!str || str === 'NaN') return null;
            if (str instanceof Date) return str.toISOString();

            // Replace dots in time with colons: "9.00.00" -> "9:00:00"
            let s = str.toString().replace(/(\d{1,2})\.(\d{2})\.(\d{2})/, '$1:$2:$3');
            return s;
        };

        return {
            ...b,
            carId: car ? car.id : 0, // Fallback ID
            carModel: b.carModel, // Trust Sheet data first
            carPlate: b.carPlate, // Trust Sheet data first
            start: fixDate(b.start),
            end: fixDate(b.end)
        };
    });
}

// Helper: Fetch in background without blocking UI
function fetchFreshDataInBackground() {
    setTimeout(async () => {
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL);
            const data = await response.json();

            if (Array.isArray(data)) {
                // Update cache silently
                localStorage.setItem('carrent_bookings_cache', JSON.stringify(data));
                localStorage.setItem('carrent_bookings_cache_time', Date.now().toString());

                // Update data and re-render
                bookings = processBookingsData(data);
                renderDashboard();
                renderBookingsTable();
                updateStats();
                console.log('🔄 Background sync complete');
            }
        } catch (error) {
            console.log('Background fetch failed (will retry next time)');
        }
    }, 1000); // Wait 1 second before background fetch
}

// Overwrite saveBookings to do nothing (since we rely on Cloud)
function saveBookings() {
    // No-op: Data is now in Cloud
}

// Generate Dummy Data DEPRECATED
function generateDummyData() {
    // No-op
}

// Updated Status Function -> Call API
window.updateStatus = async function (id, status) {
    if (!confirm(`ต้องการเปลี่ยนสถานะเป็น ${status}?`)) return;

    // Optimistic UI Update
    const bk = bookings.find(b => b.id == id);
    if (bk) {
        bk.status = status;
        renderBookingsTable();
        renderDashboard();
        updateStats();
    }

    // Call API
    document.getElementById('loadingOverlay').style.display = 'flex';
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'updateStatus',
                id: id,
                status: status
            })
        });

        // Clear cache and force refresh
        localStorage.removeItem('carrent_bookings_cache');
        await fetchBookings(true);
    } catch (error) {
        console.error("Update status failed:", error);
        alert("อัปเดตบน Server ไม่สำเร็จ (Check Connection)");
    }
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Date Navigation with Null Checks
const prevBtn = document.getElementById('prevMonth');
const nextBtn = document.getElementById('nextMonth');

if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderDashboard();
    });
}

if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderDashboard();
    });
}

// Global Error Handler for Mobile Debugging
window.onerror = function (msg, url, line) {
    // alert("Error: " + msg + "\nLine: " + line); // Uncomment for extreme debugging
    console.error("Global Error:", msg, line);
    document.getElementById('loadingOverlay').style.display = 'none'; // Emergency unlock
};

// Force hide overlay on load
document.getElementById('loadingOverlay').style.display = 'none';
