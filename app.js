// Data Configuration - PLEASE UPDATE THESE
const LIFF_ID = '2008863808-e2MCAccQ';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyH1oMpE1tEJaFZjf1QGAurl_EkF4Nf_MZwEcayxHpcVHKrqhe2Q6dqp7zHBMkS3YrpQg/exec';

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
let bookings = [];
let currentDate = new Date();
let liffProfile = null;

// DOM Elements
const modal = document.getElementById('bookingModal');
const bookingForm = document.getElementById('bookingForm');
const timelineGrid = document.getElementById('timelineGrid');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize LIFF
    await initLiff();

    // 2. Fetch Data (will update UI when done)
    await fetchBookings();

    // 3. UI Init
    initSelectOptions();
    renderDashboard();
    updateStats();

    // Set default dates
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    if (startInput && endInput) {
        startInput.value = dateStr;
        endInput.value = dateStr;
        startInput.min = dateStr;
        endInput.min = dateStr;

        startInput.addEventListener('change', (e) => {
            endInput.min = e.target.value;
            if (endInput.value < e.target.value) {
                endInput.value = e.target.value;
            }
        });
    }

    // Initial filter
    filterAvailableCars();
});

// Logic: Filter Cars based on Date Range
window.filterAvailableCars = function () {
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    const modelSelect = document.getElementById('carModel');
    const plateSelect = document.getElementById('carPlate');

    if (!modelSelect || !plateSelect) return;

    const startVal = startInput ? startInput.value : '';
    const endVal = endInput ? endInput.value : '';

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

        // Check overlap (Inclusive)
        if (startDate <= bEnd && endDate >= bStart) {
            busyCarIds.add(b.carId);
        }
    });

    // Filter Global CARS_DATA
    const availableCars = CARS_DATA.filter(c => !busyCarIds.has(c.id));
    window.currentAvailableCars = availableCars;

    // Populate Models
    const availableModels = [...new Set(availableCars.map(c => c.model))];
    const currentModel = modelSelect.value;

    modelSelect.innerHTML = '<option value="">เลือกรุ่นรถ...</option>' +
        availableModels.map(m => `<option value="${m}">${m}</option>`).join('');

    if (availableModels.includes(currentModel)) {
        modelSelect.value = currentModel;
        filterPlates();
    } else {
        modelSelect.value = "";
        plateSelect.innerHTML = '<option value="">รอเลือกรุ่นรถ...</option>';
        plateSelect.disabled = true;
    }
}

// Logic: Filter Plates
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

// Render Timeline - DOM-Based Exact Positioning
function renderDashboard() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().getDate();
    const CELL_WIDTH = 40;
    const FIRST_COLUMN_WIDTH = 200;

    document.getElementById('currentMonthYear').textContent =
        currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    let html = `
        <table class="calendar-table">
            <thead>
                <tr>
                    <th style="min-width: ${FIRST_COLUMN_WIDTH}px; left: 0; z-index: 20;">Car / Date</th>
    `;

    // Render Headers
    for (let d = 1; d <= daysInMonth; d++) {
        const isWeekend = new Date(year, month, d).getDay() % 6 === 0;
        const bg = (d === today && new Date().getMonth() === month) ? 'rgba(59, 130, 246, 0.3)' : '';
        html += `<th class="day-header" data-day="${d}" style="min-width: ${CELL_WIDTH}px; background: ${bg}">${d}</th>`;
    }
    html += `</tr></thead><tbody>`;

    CARS_DATA.forEach(car => {
        html += `
            <tr class="car-row" data-car-id="${car.id}">
                <td class="car-cell">
                    <div class="car-model">${car.model} <span class="dot ${car.type.toLowerCase()}"></span></div>
                    <div class="car-plate">${car.plate}</div>
                </td>
        `;

        for (let d = 1; d <= daysInMonth; d++) {
            html += `<td class="day-cell" data-day="${d}"></td>`;
        }
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    timelineGrid.innerHTML = html;

    // WAIT for render, then measure
    setTimeout(() => {
        CARS_DATA.forEach((car) => {
            const row = timelineGrid.querySelector(`tr[data-car-id="${car.id}"]`);
            if (!row) return;

            const carBookings = bookings.filter(b => b.carId == car.id && b.status === 'Approved');

            carBookings.forEach((booking, index) => {
                const bStart = new Date(booking.start);
                const bEnd = new Date(booking.end);

                // Filter out bookings not in this month
                if (bStart.getMonth() !== month && bEnd.getMonth() !== month) return;

                // Clamp dates to current month view
                let startDay = bStart.getDate();
                let endDay = bEnd.getDate();

                // Handle spanning months
                if (bStart.getMonth() < month || bStart.getFullYear() < year) startDay = 1;
                if (bEnd.getMonth() > month || bEnd.getFullYear() > year) endDay = daysInMonth;

                // Find cells to measure
                const startCell = row.querySelector(`td[data-day="${startDay}"]`);
                const endCell = row.querySelector(`td[data-day="${endDay}"]`);

                if (startCell && endCell) {
                    const rowRect = row.getBoundingClientRect();
                    const startRect = startCell.getBoundingClientRect();
                    const endRect = endCell.getBoundingClientRect();

                    // Precise calculation relative to the row
                    const leftPos = startRect.left - rowRect.left;
                    const barWidth = endRect.right - startRect.left;

                    const tooltip = `${getFormattedDate(booking.start)} - ${getFormattedDate(booking.end)} (${booking.user})`;

                    const barDiv = document.createElement('div');
                    barDiv.className = 'booking-bar';
                    barDiv.style.left = `${leftPos}px`;
                    barDiv.style.width = `${barWidth}px`;

                    // Fixed centering (No cascading)
                    barDiv.style.top = `50%`;
                    barDiv.style.transform = `translateY(-50%)`;

                    if (index > 0) barDiv.style.zIndex = index + 10;

                    barDiv.title = tooltip;

                    barDiv.innerHTML = `
                        <span class="booking-label">
                            <i class="fa-solid fa-user-circle"></i> ${booking.user}
                        </span>
                    `;

                    row.appendChild(barDiv);
                }
            });
        });
    }, 100); // 100ms delay to ensure layout stability
}

// ------------------------------------------
// RENDER BOOKINGS LIST
// ------------------------------------------
function renderBookingsTable() {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    const sorted = [...bookings].sort((a, b) => new Date(b.start) - new Date(a.start));

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:2rem;">ไม่พบข้อมูลการจอง (No Bookings Found)</td></tr>';

        // Also Mobile
        const mobileContainer = document.getElementById('mobileHistoryList');
        if (mobileContainer) mobileContainer.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 1rem;">ไม่มีประวัติการจอง</div>';
        return;
    }

    tbody.innerHTML = sorted.map(b => {
        const car = CARS_DATA.find(c => c.id == b.carId);
        const displayPlate = car ? car.plate : (b.carPlate || 'Unknown');
        const displayModel = car ? car.model : (b.carModel || 'Unknown');

        const startStr = getFormattedDate(b.start);
        const endStr = getFormattedDate(b.end);

        let statusBadge = '';
        if (b.status === 'Approved') statusBadge = '<span style="color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 4px;">Approved</span>';
        else if (b.status === 'Rejected') statusBadge = '<span style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px;">Rejected</span>';
        else statusBadge = '<span style="color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 4px 8px; border-radius: 4px;">Pending</span>';

        // Action Buttons (Only for Pending)
        const actions = (b.status === 'Pending') ?
            `<button onclick="updateStatus(${b.id}, 'Approved')" style="cursor: pointer; background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 4px;">Approve</button>
             <button onclick="updateStatus(${b.id}, 'Rejected')" style="cursor: pointer; background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px;">Reject</button>`
            : '-';

        return `
            <tr>
                <td>${startStr}</td>
                <td>${endStr}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="avatar" style="font-size: 0.7rem; width:24px; height:24px;">${b.user ? b.user.charAt(0) : '?'}</div>
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

    // Update Mobile List
    const mobileContainer = document.getElementById('mobileHistoryList');
    if (mobileContainer) {
        mobileContainer.innerHTML = sorted.slice(0, 5).map(b => {
            const car = CARS_DATA.find(c => c.id == b.carId);
            const displayModel = car ? car.model : (b.carModel || 'Unknown');
            const startStr = getFormattedDate(b.start);

            let statusColor = '#f59e0b';
            if (b.status === 'Approved') statusColor = '#10b981';
            if (b.status === 'Rejected') statusColor = '#ef4444';

            return `
             <div class="history-item">
                <div>
                    <div class="h-date"><i class="fa-solid fa-calendar"></i> ${startStr}</div>
                    <div class="h-car" style="color:white; font-weight:500;">${displayModel}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${b.purpose}</div>
                </div>
                <div class="h-status" style="color: ${statusColor}; background: ${statusColor}20; border: 1px solid ${statusColor}40;">
                    ${b.status}
                </div>
            </div>`;
        }).join('');
    }
}

function initSelectOptions() {
    // Initial load
}

// API & Sync
async function fetchBookings(forceRefresh = false) {
    if (!GOOGLE_SCRIPT_URL) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        if (Array.isArray(data)) {
            bookings = processBookingsData(data);

            // Render everything to be safe
            renderDashboard();
            renderBookingsTable();
            updateStats();
        }
    } catch (e) { console.error(e); }
}

function processBookingsData(data) {
    return data.map(b => {
        const car = CARS_DATA.find(c => (b.carPlate || '').trim() === c.plate.trim());
        const fixDate = (str) => {
            if (!str) return null;
            if (str instanceof Date) return str.toISOString();
            return str.replace(/(\d{1,2})\.(\d{2})\.(\d{2})/, '$1:$2:$3'); // Standard ISO
        };
        return {
            ...b,
            carId: car ? car.id : 0,
            start: fixDate(b.start),
            end: fixDate(b.end)
        };
    });
}

function updateStats() {
    document.getElementById('statTotalCars').textContent = CARS_DATA.length;
    const now = new Date();
    const busyNow = bookings.filter(b => {
        if (b.status !== 'Approved') return false;
        const s = new Date(b.start);
        const e = new Date(b.end);
        return now >= s && now <= e; // Inclusive check
    }).length;
    document.getElementById('statInUse').textContent = busyNow;
    document.getElementById('statAvailable').textContent = CARS_DATA.length - busyNow;
}

function getFormattedDate(isoString) {
    const d = new Date(isoString);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

window.updateStatus = async function (id, status) {
    if (!confirm(`ต้องการเปลี่ยนสถานะเป็น ${status}?`)) return;
    const bk = bookings.find(b => b.id == id);
    if (bk) {
        bk.status = status;
        renderBookingsTable();
        renderDashboard();
        updateStats();
    }
    // API Sync
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'updateStatus', id, status })
        });
        console.log("Status updated to Sheet");
    } catch (e) { console.error(e); }
}

// Modal & Utils
window.openBookingModal = () => modal.classList.add('open');
window.closeBookingModal = () => modal.classList.remove('open');

// Navigation Logic with Auto-Render
window.showSection = (id) => {
    // 1. Hide all
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

    // 2. Show target
    document.getElementById(id).classList.add('active');

    // 3. Update Sidebar Highlights
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.classList.remove('active');
        // Simple check: does the onclick handler contain the ID?
        if (link.getAttribute('onclick').includes(id)) {
            link.classList.add('active');
        }
    });

    // 4. Trigger specific renders
    if (id === 'dashboard') renderDashboard();
    if (id === 'bookings') renderBookingsTable();
};

// ------------------------------------------
// BOOKING SUBMISSION LOGIC
// ------------------------------------------
if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Collect Data
        const userName = document.getElementById('userName').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const carId = document.getElementById('carPlate').value; // Value is ID here
        const jobPurpose = document.getElementById('jobPurpose').value;

        // 2. Validation
        if (!userName || !startDate || !endDate || !carId || !jobPurpose) {
            alert('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        // 3. Find Car Details
        const car = CARS_DATA.find(c => c.id == carId);

        // 4. Create Payload
        const newBooking = {
            id: Date.now(), // Mock ID
            user: userName,
            start: new Date(startDate).toISOString(),
            end: new Date(endDate).toISOString(),
            carId: parseInt(carId),
            carPlate: car.plate,
            carModel: car.model,
            purpose: jobPurpose,
            status: 'Pending' // Default status
        };

        // 5. Update Local State (Optimistic)
        bookings.push(newBooking);

        // 6. Close Modal & Reset
        closeBookingModal();
        bookingForm.reset();

        // 7. Refresh UI
        renderDashboard();
        renderBookingsTable();
        updateStats();

        // 8. Send to API (Google Sheets)
        try {
            console.log("Sending to Sheet:", newBooking);
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'createBooking', ...newBooking })
            });
            console.log("Sent to Google Sheet (no-cors mode)");
        } catch (err) {
            console.error(err);
        }

        alert('จองรถเรียบร้อยแล้ว (Booking Created)');
    });
}

async function initLiff() { /* liff init code */ }
