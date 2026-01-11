// Data Configuration
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

    // 2. Fetch Data
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
                    // Stacking: 4px padding from top, plus offset if index > 0
                    // If multiple concurrent bookings, simplistic stacking:
                    // In reality, robust stacking needs interval analysis. 
                    // For now, simpler offset:
                    barDiv.style.top = `calc(50% + ${(index * 10)}px)`; // Slight offset if multiple
                    if (index > 0) barDiv.style.opacity = "0.9";

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

function initSelectOptions() {
    // Initial load
}

// ... (Other helper functions remain the same, just keeping them clean)

// API & Sync
async function fetchBookings(forceRefresh = false) {
    if (!GOOGLE_SCRIPT_URL) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const data = await response.json();
        if (Array.isArray(data)) {
            bookings = processBookingsData(data);
            renderDashboard();
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
            return str.replace(/(\d{1,2})\.(\d{2})\.(\d{2})/, '$1:$2:$3');
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

// Modal & Utils
window.openBookingModal = () => modal.classList.add('open');
window.closeBookingModal = () => modal.classList.remove('open');
window.showSection = (id) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'dashboard') renderDashboard();
};

async function initLiff() { /* liff init code */ }
