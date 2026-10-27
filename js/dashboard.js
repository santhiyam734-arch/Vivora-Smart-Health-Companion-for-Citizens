
import { auth, db } from "./firebase.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const $ = (id) => document.getElementById(id);
let todayPendingNotifications = [];

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    }[char]));
}

function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value, fallback = "—") {
    if (!value) return fallback;
    const d = new Date(String(value).length === 10 ? value + "T00:00:00" : value);
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatTime(value) {
    if (!value) return "";
    const parts = String(value).split(":");
    if (parts.length < 2) return value;
    const d = new Date();
    d.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
    return d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit"
    });
}

function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning! 👋";
    if (hour < 17) return "Good Afternoon! 👋";
    return "Good Evening! 👋";
}

function daysFromToday(dateString) {
    const today = new Date(todayString() + "T00:00:00");
    const date = new Date(dateString + "T00:00:00");
    return Math.round((date - today) / 86400000);
}

function medicineIsForToday(medicine) {
    const today = todayString();

    if (medicine.startDate && today < medicine.startDate) return false;
    if (medicine.endDate && today > medicine.endDate) return false;

    const frequency = String(medicine.frequency || "").toLowerCase();

    if (frequency.includes("weekly")) {
        const weekday = new Date(today + "T00:00:00")
            .toLocaleDateString("en-US", { weekday: "long" });

        return !medicine.weeklyDay ||
            String(medicine.weeklyDay).toLowerCase() === weekday.toLowerCase();
    }

    return true;
}

function normalizeMedicineTime(value) {
    if (!value) return "";
    const text = String(value).trim().toLowerCase();
    // Keep stored dose times comparable whether they use 20:00 or 8:00 PM.
    const ampm = text.match(/^(\\d{1,2}):(\\d{2})\\s*(am|pm)$/i);
    if (ampm) {
        let hour = Number(ampm[1]) % 12;
        if (ampm[3].toLowerCase() === "pm") hour += 12;
        return `${String(hour).padStart(2, "0")}:${ampm[2]}`;
    }
    const twentyFour = text.match(/^(\\d{1,2}):(\\d{2})/);
    if (twentyFour) return `${String(Number(twentyFour[1])).padStart(2, "0")}:${twentyFour[2]}`;
    return text;
}

function medicineTimes(medicine) {
    return [
        medicine.medicineTime1,
        medicine.medicineTime2,
        medicine.medicineTime3,
        medicine.time1,
        medicine.time2,
        medicine.time3,
        medicine.time
    ]
        .filter(Boolean)
        .map(value => String(value).trim())
        .filter((value, index, values) =>
            values.findIndex(other => normalizeMedicineTime(other) === normalizeMedicineTime(value)) === index
        )
        .sort((a, b) => normalizeMedicineTime(a).localeCompare(normalizeMedicineTime(b)));
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function setHtml(id, value) {
    const element = $(id);
    if (element) element.innerHTML = value;
}

async function loadDashboard(user) {
    const jobs = [
        ["medicines", () => getDocs(collection(db, "users", user.uid, "medicines"))],
        ["injections", () => getDocs(collection(db, "users", user.uid, "injections"))],
        ["appointments", () => getDocs(collection(db, "users", user.uid, "appointments"))],
        ["healthRecords", () => getDocs(collection(db, "users", user.uid, "healthRecords"))],
        ["caregiverNotes", () => getDocs(collection(db, "users", user.uid, "caregiverNotes"))],
        ["emergencyInfo", () => getDoc(doc(db, "users", user.uid, "emergencyInfo", "info"))]
    ];

    const results = await Promise.all(jobs.map(async ([name, load]) => {
        try {
            return { name, value: await load(), error: null };
        } catch (error) {
            console.error(`Vivora dashboard: failed to load ${name}:`, error);
            return { name, value: null, error };
        }
    }));

    const byName = Object.fromEntries(results.map(result => [result.name, result]));

    const docs = name =>
        byName[name].value?.docs?.map(d => ({ id: d.id, ...d.data() })) || [];

    const medicines = docs("medicines");
    const injections = docs("injections");
    const appointments = docs("appointments");
    const records = docs("healthRecords");
    const notes = docs("caregiverNotes");

    const emergencySnap = byName.emergencyInfo.value;
    const emergency = emergencySnap?.exists() ? emergencySnap.data() : null;

    const today = todayString();
    const todayMedicines = medicines.filter(medicineIsForToday);

    // Track each scheduled medicine dose separately.
    const medicineSlots = todayMedicines.flatMap(medicine =>
        medicineTimes(medicine).map(time => ({
            medicine,
            time,
            taken: Array.isArray(medicine.takenTimes)
                ? medicine.takenTimes.includes(time)
                : medicine.taken === true
        }))
    );

    const completedMedicines = medicineSlots.filter(slot => slot.taken).length;

    const futureInjections = injections
        .filter(i =>
            i.date &&
            i.date >= today &&
            !["completed", "cancelled"].includes(String(i.status || "").toLowerCase())
        )
        .sort((a, b) =>
            String(a.date).localeCompare(String(b.date)) ||
            String(a.time || "").localeCompare(String(b.time || ""))
        );

    const nextInjection = futureInjections[0] || null;

    const futureAppointments = appointments
        .filter(a =>
            a.date &&
            a.date >= today &&
            !["completed", "cancelled"].includes(String(a.status || "").toLowerCase())
        )
        .sort((a, b) =>
            String(a.date).localeCompare(String(b.date)) ||
            String(a.time || "").localeCompare(String(b.time || ""))
        );

    const nextAppointment = futureAppointments[0] || null;

    const sortedRecords = records.sort((a, b) =>
        String(b.date || b.updatedAt || b.createdAt || "")
            .localeCompare(String(a.date || a.updatedAt || a.createdAt || ""))
    );

    const sortedNotes = notes.sort((a, b) =>
        String(b.noteDate || b.updatedAt || b.createdAt || "")
            .localeCompare(String(a.noteDate || a.updatedAt || a.createdAt || ""))
    );

    const importantNotes = sortedNotes
        .filter(n => ["important", "high"].includes(String(n.priority || "").toLowerCase()))
        .slice(0, 3);

    setText("welcomeGreeting", greeting());
    setText("dashboardDate", new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    }));

    setText(
        "profileName",
        localStorage.getItem("vivoraProfileName") ||
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "User")
    );

    setText("medicineSummary", `${todayMedicines.length} ${todayMedicines.length === 1 ? "medicine" : "medicines"}`);
    setText("medicineSubtext", `${completedMedicines} completed today`);

    setText("injectionSummary", nextInjection ? formatDate(nextInjection.date) : "None scheduled");

    setText(
        "injectionSubtext",
        nextInjection
            ? (daysFromToday(nextInjection.date) === 0
                ? "Today"
                : `${daysFromToday(nextInjection.date)} day${daysFromToday(nextInjection.date) === 1 ? "" : "s"} remaining`)
            : "No upcoming injection"
    );

    setText(
        "appointmentSummary",
        nextAppointment ? formatTime(nextAppointment.time) || formatDate(nextAppointment.date) : "None scheduled"
    );

    setText(
        "appointmentSubtext",
        nextAppointment
            ? (nextAppointment.doctor
                ? `Dr. ${nextAppointment.doctor.replace(/^Dr\.\s*/i, "")}`
                : formatDate(nextAppointment.date))
            : "No upcoming appointment"
    );

    // Build the actual unfinished reminders scheduled for today.
    todayPendingNotifications = [];

    medicineSlots.filter(slot => !slot.taken).forEach(slot => {
        todayPendingNotifications.push({
            icon: "💊",
            title: slot.medicine.medicineName || slot.medicine.name || "Medicine",
            time: slot.time,
            link: "medicines.html"
        });
    });

    futureAppointments.filter(a => a.date === today).forEach(a => {
        todayPendingNotifications.push({
            icon: "📅",
            title: "Doctor's appointment",
            time: a.time || "",
            link: "appointments.html"
        });
    });

    futureInjections.filter(i => i.date === today).forEach(i => {
        todayPendingNotifications.push({
            icon: "💉",
            title: i.name || i.injectionName || "Scheduled injection",
            time: i.time || "",
            link: "injections.html"
        });
    });

    todayPendingNotifications.sort((a, b) =>
        String(a.time || "99:99").localeCompare(String(b.time || "99:99"))
    );

    const notificationCount = todayPendingNotifications.length;
    setText("notificationBadge", String(notificationCount));

    const badge = $("notificationBadge");
    if (badge) badge.hidden = notificationCount === 0;

    renderCarePlan(
        medicineSlots.filter(slot => !slot.taken),
        futureAppointments.find(a => a.date === today) || null,
        futureInjections.filter(i => i.date === today)
    );

    renderQuickStats(medicines, injections, appointments, records, notes, emergency);
    renderImportantNotes(importantNotes);
    renderRecentRecord(sortedRecords[0]);
    renderEmergency(emergency);

    const failed = results.filter(result => result.error);

    if (failed.length) {
        console.error(
            "Vivora dashboard sections failed:",
            failed.map(result => ({
                section: result.name,
                code: result.error?.code,
                message: result.error?.message
            }))
        );

        const carePlan = $("carePlanList");

        if (carePlan) {
            carePlan.insertAdjacentHTML(
                "beforeend",
                `<p class="data-load-warning">Some data could not be loaded. Check Firebase permissions and the browser console.</p>`
            );
        }
    }
}

function renderCarePlan(medicineSlots, appointment, injections = []) {
    const items = [];

    medicineSlots.filter(slot => !slot.taken).forEach(slot => {
        items.push({
            time: slot.time,
            title: slot.medicine.medicineName || slot.medicine.name || "Medicine",
            description: `💊 ${slot.medicine.dosage ? escapeHtml(slot.medicine.dosage) + " · " : ""}Take your scheduled medicine`
        });
    });

    if (appointment) {
        items.push({
            time: appointment.time || "",
            title: "Doctor Appointment",
            description: `👨‍⚕️ ${appointment.doctor ? escapeHtml(appointment.doctor) : "Scheduled appointment"}${appointment.hospital ? " · " + escapeHtml(appointment.hospital) : ""}`
        });
    }

    injections.forEach(injection => {
        items.push({
            time: injection.time || "",
            title: injection.name || injection.injectionName || "Scheduled injection",
            description: `💉 ${injection.notes ? escapeHtml(injection.notes) : "Injection scheduled for today"}`
        });
    });

    items.sort((a, b) =>
        String(a.time || "99:99").localeCompare(String(b.time || "99:99"))
    );

    if (!items.length) {
        setHtml(
            "carePlanList",
            `<div class="empty-state"><strong>You're all caught up!</strong><span>No unfinished reminders for today.</span></div>`
        );
        return;
    }

    setHtml(
        "carePlanList",
        items.slice(0, 6).map(item => `
            <article class="timeline-item">
                <div class="timeline-time">${escapeHtml(formatTime(item.time) || "Scheduled")}</div>
                <div class="timeline-dot">●</div>
                <div class="timeline-content">
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${item.description}</p>
                    <span class="status upcoming-status">Pending</span>
                </div>
            </article>
        `).join("")
    );
}

function renderQuickStats(medicines, injections, appointments, records, notes, emergency) {
    setText("recordCount", `${records.length} ${records.length === 1 ? "record" : "records"}`);
    setText("caregiverCount", `${notes.length} ${notes.length === 1 ? "note" : "notes"}`);
    setText("emergencyStatus", emergency ? "Information saved" : "Not set yet");
    setText("totalMedicineCount", `${medicines.length} saved`);
    setText("totalInjectionCount", `${injections.length} saved`);
    setText("totalAppointmentCount", `${appointments.length} saved`);
}

function renderImportantNotes(notes) {
    if (!notes.length) {
        setHtml("importantNotesList", `
            <div class="empty-state compact">
                📝<strong>No important caregiver notes</strong>
                <span>Your important notes will appear here.</span>
            </div>
        `);
        return;
    }

    setHtml("importantNotesList", notes.map(note => `
        <article class="dashboard-note">
            <div>
                <span class="note-priority-badge ${escapeHtml(String(note.priority || "normal").toLowerCase())}">${escapeHtml(note.priority || "Normal")}</span>
                <span class="note-date">${escapeHtml(formatDate(note.noteDate))}</span>
            </div>
            <h3>${escapeHtml(note.title || "Caregiver note")}</h3>
            <p>${escapeHtml(note.text || "")}</p>
        </article>
    `).join(""));
}

function renderRecentRecord(record) {
    if (!record) {
        setHtml("recentRecord", `
            <div class="empty-state compact">
                📋<strong>No health records yet</strong>
                <span>Add a record to see it here.</span>
            </div>
        `);
        return;
    }

    setHtml("recentRecord", `
        <div class="record-preview">
            <div class="record-icon">📋</div>
            <div>
                <span>${escapeHtml(record.type || "Health Record")}</span>
                <h3>${escapeHtml(record.name || "Health Record")}</h3>
                <p>${escapeHtml(formatDate(record.date))}${record.doctor ? " · " + escapeHtml(record.doctor) : ""}</p>
            </div>
        </div>
    `);
}

function renderEmergency(data) {
    if (!data) {
        setHtml("emergencyPreview", `
            <div>
                <strong>Emergency information not set</strong>
                <span>Add an emergency contact for quick access.</span>
            </div>
            <a href="emergency.html" class="emergency-button">Set Up <span>→</span></a>
        `);
        return;
    }

    const contact = data.emergencyName || "Emergency Contact";
    const phone = data.emergencyPhone || "";
    const href = phone
        ? `tel:${String(phone).replace(/[^0-9+]/g, "")}`
        : "emergency.html";

    setHtml("emergencyPreview", `
        <div>
            <strong>${escapeHtml(contact)}</strong>
            <span>${escapeHtml(data.emergencyRelation || "Emergency Contact")}${phone ? " · " + escapeHtml(phone) : ""}</span>
        </div>
        <a href="${escapeHtml(href)}" class="emergency-button">${phone ? "Call Now" : "View"} <span>→</span></a>
    `);
}

onAuthStateChanged(auth, async user => {
    const profileNameKey = "vivoraProfileName";
    const savedName = localStorage.getItem(profileNameKey);

    if (savedName) setText("profileName", savedName);

    if (!user) {
        console.warn("Vivora dashboard: no authenticated user.");
        return;
    }

    try {
        try {
            const profileSnapshot = await getDoc(doc(db, "users", user.uid));

            if (profileSnapshot.exists()) {
                const profileData = profileSnapshot.data();
                const firestoreName = profileData.profile?.displayName || profileData.displayName || "";

                if (firestoreName) {
                    localStorage.setItem(profileNameKey, firestoreName);
                    setText("profileName", firestoreName);
                } else if (!savedName && user.displayName) {
                    setText("profileName", user.displayName);
                }
            } else if (!savedName && user.displayName) {
                setText("profileName", user.displayName);
            }
        } catch (profileError) {
            console.warn("Could not load profile name from Firestore:", profileError);
        }

        await loadDashboard(user);
    } catch (error) {
        console.error("Dashboard load error:", error);
        setHtml("carePlanList", `
            <div class="empty-state">
                <strong>Unable to load dashboard data</strong>
                <span>Please refresh the page and try again.</span>
            </div>
        `);
    }
});

function setupDashboardHeaderActions() {
    const notificationButton = document.querySelector(".notification-button");
    const profileButton = document.getElementById("profileButton");

    if (profileButton) {
        profileButton.addEventListener("click", () => {
            window.location.href = "settings.html";
        });
    }

    if (notificationButton) {
        notificationButton.setAttribute("aria-expanded", "false");

        notificationButton.addEventListener("click", () => {
            let panel = document.getElementById("notificationPanel");

            if (panel) {
                panel.remove();
                notificationButton.setAttribute("aria-expanded", "false");
                return;
            }

            panel = document.createElement("div");
            panel.id = "notificationPanel";
            panel.className = "notification-panel";

            panel.innerHTML = `
                <h3>Today's Unfinished Reminders</h3>
                ${todayPendingNotifications.length
                    ? todayPendingNotifications.map(item => `
                        <a href="${item.link}">
                            ${item.icon} ${escapeHtml(item.title)}
                            ${item.time ? `<span>${escapeHtml(formatTime(item.time))}</span>` : ""}
                        </a>
                    `).join("")
                    : "<p>You're all caught up! No unfinished reminders for today.</p>"
                }
            `;

            document.querySelector(".header-actions")?.appendChild(panel);
            notificationButton.setAttribute("aria-expanded", "true");
        });

        document.addEventListener("click", event => {
            const panel = document.getElementById("notificationPanel");

            if (panel &&
                !panel.contains(event.target) &&
                !notificationButton.contains(event.target)) {
                panel.remove();
                notificationButton.setAttribute("aria-expanded", "false");
            }
        });
    }
}

setupDashboardHeaderActions();
