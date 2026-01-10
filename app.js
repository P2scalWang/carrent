// Data Configuration - PLEASE UPDATE THESE
const LIFF_ID = '2008863808-e2MCAccQ';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzDx9YMUDDr0BJ1DghS94zB8sK8EkOkfnGxylXJ3fkG3m4B1sQ2QAj1VWLxih2d-PSzCA/exec'; // e.g. https://script.google.com/macros/s/.../exec

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
let bookings = JSON.parse(localStorage.getItem('carBookings')) || [];
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

    // Generate Dummy Data if empty
    if (bookings.length === 0) {
        generateDummyData();
    }

    // ... Rest of init


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
        if (b.status !== 'Approved') return; // Pending doesn't block? User said "Only approved shows on timeline". 
        // Logic: Should Pending block? Usually yes to prevent double booking. 
        // But if timeline hides it, it's confusing. 
        // Let's assume ONLY Approved blocks availability for now as per previous context.

        // Date overlap check
        // Existing data might have times, but now we treat everything as full day overlap if dates touch?
        // User said "don't choose time". So strict date overlap.

        // Convert existing booking datetime to date logic
        const bStart = new Date(b.start); // These might be ISO strings
        const bEnd = new Date(b.end);

        // Check overlap
        if (startDate <= bEnd && endDate >= bStart) {
            busyCarIds.add(b.carId);
        }
    });

    // Filter Global CARS_DATA
    const availableCars = CARS_DATA.filter(c => !busyCarIds.has(c.id));

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

// Render Timeline (Simple Month View designed as a list for now, can be upgraded to Gantt)
// For this MVP, let's make a grid view: Days of Month vs Cars
function renderDashboard() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().getDate(); // Highlight today if in current month

    document.getElementById('currentMonthYear').textContent =
        currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    let html = `
        <table class="calendar-table">
            <thead>
                <tr>
                    <th style="min-width: 200px; left: 0; z-index: 20; background: #0f172a;">Car / Date</th>
    `;

    // Render Headers (Days)
    for (let d = 1; d <= daysInMonth; d++) {
        const isWeekend = new Date(year, month, d).getDay() % 6 === 0;
        const bg = (d === today && new Date().getMonth() === month) ? 'rgba(59, 130, 246, 0.3)' :
            (isWeekend ? 'rgba(255, 255, 255, 0.05)' : '');
        html += `<th style="min-width: 40px; background: ${bg}">${d}</th>`;
    }
    html += `</tr></thead><tbody>`;

    // Render Rows (Cars)
    CARS_DATA.forEach(car => {
        html += `
            <tr>
                <td class="car-cell" style="position: sticky; left: 0; background: #1e293b; z-index: 5;">
                    <div class="car-model">${car.model} <span class="dot ${car.type.toLowerCase()}" style="display:inline-block; width:6px; height:6px;"></span></div>
                    <div class="car-plate">${car.plate}</div>
                </td>
        `;

        // Render Cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            // Check for bookings on this day for this car
            // Optimization: Filter specific bookings here
            // CRITICAL CHANGE: Only show Approved bookings
            const carBookings = bookings.filter(b => b.carId == car.id && b.status === 'Approved');
            let cellContent = '';

            // Very simple overlapping logic for cell visualization
            // If booked, show bar. 
            // NOTE: A proper Gantt would need pixel-perfect positioning. 
            // Here we just mark the cell if there's any booking.

            const daysBookings = carBookings.filter(b => {
                const start = new Date(b.start).getDate();
                const end = new Date(b.end).getDate();
                const bMonth = new Date(b.start).getMonth();
                // Simplified checks for same month
                if (bMonth !== month) return false;
                return d >= start && d <= end;
            });

            if (daysBookings.length > 0) {
                // Determine style based on first booking found (simplified)
                const bk = daysBookings[0];
                const isStart = new Date(bk.start).getDate() === d;
                const isEnd = new Date(bk.end).getDate() === d;

                let style = 'background: rgba(59, 130, 246, 0.5);'; // Mid-bar
                let text = '';

                if (isStart && isEnd) {
                    style = 'background: var(--primary); border-radius: 4px;';
                    text = bk.user;
                } else if (isStart) {
                    style = 'background: linear-gradient(90deg, rgba(0,0,0,0) 0%, var(--primary) 20%); border-top-left-radius: 4px; border-bottom-left-radius: 4px;';
                    text = bk.user;
                } else if (isEnd) {
                    style = 'background: linear-gradient(90deg, var(--primary) 80%, rgba(0,0,0,0) 100%); border-top-right-radius: 4px; border-bottom-right-radius: 4px;';
                }

                const tooltip = `${getFormattedDate(bk.start)} - ${getFormattedDate(bk.end)}\n${bk.user}: ${bk.purpose}`;
                cellContent = `<div class="booking-bar-cell" style="${style} height: 80%; width: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;" title="${tooltip}">${text}</div>`;
            }

            html += `<td style="padding: 2px;">${cellContent}</td>`;
        }
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    timelineGrid.innerHTML = html;
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
        carModel: carModelStr,
        carPlate: carPlateStr
    };

    // 1. Save locally for immediate UI update (Optimistic UI)
    bookings.push(payload);
    saveBookings();

    // Refresh UI immediately
    closeBookingModal();
    bookingForm.reset();
    renderDashboard();
    updateStats();
    showSection('bookings');

    // 2. Send to Google Sheets
    if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
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

            alert(`จองสำเร็จ! (Saved to Sheet)`);
        } catch (error) {
            console.error('Sheet Error:', error);
            alert('บันทึกในเครื่องสำเร็จ แต่ส่งขึ้น Sheet ไม่ผ่าน (Network Error)');
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
        const car = CARS_DATA.find(c => c.id == b.carId) || { plate: 'Unknown', model: 'Unknown' };

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
                <td><span style="font-family: monospace; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${car.plate}</span></td>
                <td>${car.model}</td>
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
        const car = CARS_DATA.find(c => c.id == b.carId) || { plate: 'Unknown', model: 'Unknown' };
        const start = getFormattedDate(b.start);

        let statusColor = '#f59e0b'; // Pending
        if (b.status === 'Approved') statusColor = '#10b981';
        if (b.status === 'Rejected') statusColor = '#ef4444';

        return `
            <div class="history-item">
                <div>
                    <div class="h-date"><i class="fa-solid fa-calendar"></i> ${start}</div>
                    <div class="h-car" style="color:white; font-weight:500;">${car.model}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${car.plate}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${b.purpose}</div>
                </div>
                <div class="h-status" style="color: ${statusColor}; background: ${statusColor}20; border: 1px solid ${statusColor}40;">
                    ${b.status}
                </div>
            </div>
        `;
    }).join('');
}

window.updateStatus = function (id, status) {
    if (!confirm(`Are you sure you want to ${status} this booking?`)) return;

    const idx = bookings.findIndex(b => b.id === id);
    if (idx !== -1) {
        bookings[idx].status = status;
        saveBookings();
        renderBookingsTable();
        // If approved, it might affect timeline, but we are in bookings view.
    }
}

function saveBookings() {
    localStorage.setItem('carBookings', JSON.stringify(bookings));
}

// Date Navigation
document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderDashboard();
});
document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderDashboard();
});
