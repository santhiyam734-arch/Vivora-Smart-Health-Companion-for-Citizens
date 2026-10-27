import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
// ==================== GET STARTED ====================

const startButton = document.querySelector(".start-button");

if (startButton) {
    startButton.addEventListener("click", function() {
        window.location.href = "dashboard.html";
    });
}

// ==================== MEDICINE MODULE ====================
const medicineCollection = () => {
    const user = auth.currentUser;
    if (!user) return null;
    return collection(db, "users", user.uid, "medicines");
};
let medicines = [];
const medicineModal = document.getElementById("medicineModal");
const openMedicineForm = document.getElementById("openMedicineForm");
const closeMedicineForm = document.getElementById("closeMedicineForm");
const cancelMedicineForm = document.getElementById("cancelMedicineForm");
const medicineForm = document.getElementById("medicineForm");
const medicinePhoto = document.getElementById("medicinePhoto");
const photoPreview = document.getElementById("photoPreview");
const frequency = document.getElementById("frequency");
const weeklyDayGroup = document.getElementById("weeklyDayGroup");
const weeklyDay = document.getElementById("weeklyDay");
const medicineTime2Group = document.getElementById("medicineTime2Group");
const medicineTime3Group = document.getElementById("medicineTime3Group");
const medicineTime2 = document.getElementById("medicineTime2");
const medicineTime3 = document.getElementById("medicineTime3");

if (openMedicineForm && medicineModal) {
    openMedicineForm.addEventListener("click", function() {
        medicineModal.classList.add("show");
    });
}

if (closeMedicineForm) {
    closeMedicineForm.addEventListener("click", function() {
        medicineModal.classList.remove("show");
    });
}

if (cancelMedicineForm) {
    cancelMedicineForm.addEventListener("click", function() {
        medicineModal.classList.remove("show");
        medicineForm.reset();
        resetPhotoPreview();
    });
}

if (frequency) {
    frequency.addEventListener("change", function() {

        // Weekly day
        if (frequency.value === "Weekly") {
            weeklyDayGroup.style.display = "flex";
            weeklyDay.required = true;
        } else {
            weeklyDayGroup.style.display = "none";
            weeklyDay.required = false;
            weeklyDay.value = "";
        }

        // Time 2
        if (frequency.value === "Twice a day" ||
            frequency.value === "Three times a day") {

            medicineTime2Group.style.display = "block";
            medicineTime2.required = true;

        } else {

            medicineTime2Group.style.display = "none";
            medicineTime2.required = false;
            medicineTime2.value = "";

        }

        // Time 3
        if (frequency.value === "Three times a day") {

            medicineTime3Group.style.display = "block";
            medicineTime3.required = true;

        } else {

            medicineTime3Group.style.display = "none";
            medicineTime3.required = false;
            medicineTime3.value = "";

        }

    });
}


if (medicinePhoto) {
    medicinePhoto.addEventListener("change", function() {
        const file = medicinePhoto.files[0];

        if (file) {
            const reader = new FileReader();

            reader.onload = function(event) {
                photoPreview.innerHTML = `<img src="${event.target.result}" alt="Medicine photo">`;
            };

            reader.readAsDataURL(file);
        }
    });
}

if (medicineForm) {
    medicineForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const medicineName = document.getElementById("medicineName").value;
        const dosage = document.getElementById("dosage").value;
        const medicineQuantity = document.getElementById("medicineQuantity").value;
        const medicineTime1 = document.getElementById("medicineTime1").value;
        const medicineTime2 = document.getElementById("medicineTime2").value;
        const medicineTime3 = document.getElementById("medicineTime3").value;
        const frequency = document.getElementById("frequency").value;
        const weeklyDayValue = document.getElementById("weeklyDay").value;
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const notes = document.getElementById("medicineNotes").value;

        let image = "";

        if (medicinePhoto.files.length > 0) {
            if (medicinePhoto.files[0].size > 700000) {
                alert("The medicine photo is too large. Please choose an image smaller than 700 KB for now.");
                return;
            }
            const reader = new FileReader();

            reader.onload = function(event) {
                image = event.target.result;

                saveMedicine(
                    medicineName,
                    dosage,
                    medicineQuantity,
                    medicineTime1,
                    medicineTime2,
                    medicineTime3,
                    frequency,
                    weeklyDayValue,
                    startDate,
                    endDate,
                    notes,
                    image
                );
            };

            reader.readAsDataURL(medicinePhoto.files[0]);
        } else {
            saveMedicine(
                medicineName,
                dosage,
                medicineQuantity,
                medicineTime1,
                medicineTime2,
                medicineTime3,
                frequency,
                weeklyDayValue,
                startDate,
                endDate,
                notes,
                image
            );
        }
    });
}

async function saveMedicine(name, dosage, quantity, time1, time2, time3, frequency, weeklyDayValue, startDate, endDate, notes, image) {
    const user = auth.currentUser;

    if (!user) {
        alert("Please login first.");
        return;
    }

    const editingId = medicineForm.dataset.editingId;

    try {
        if (editingId) {
            await updateDoc(
                doc(db, "users", user.uid, "medicines", editingId),
                {
                    name: name,
                    dosage: dosage,
                    quantity: Number(quantity),
                    time: time1,
                    time1: time1,
                    time2: time2,
                    time3: time3,
                    frequency: frequency,
                    weeklyDay: weeklyDayValue,
                    startDate: startDate,
                    endDate: endDate,
                    notes: notes,
                    image: image || medicineForm.dataset.existingImage
                }
            );

            delete medicineForm.dataset.editingId;
            delete medicineForm.dataset.existingImage;

        } else {
            await addDoc(
                collection(db, "users", user.uid, "medicines"),
                {
                    name: name,
                    dosage: dosage,
                    quantity: Number(quantity),
                    time: time1,
                    time1: time1,
                    time2: time2,
                    time3: time3,
                    frequency: frequency,
                    weeklyDay: weeklyDayValue,
                    startDate: startDate,
                    endDate: endDate,
                    notes: notes,
                    image: image,
                    taken: false
                }
            );
        }

        medicineForm.reset();
        resetPhotoPreview();
        medicineModal.classList.remove("show");

        location.reload();

    } catch (error) {
        console.error("Error saving medicine:", error);
        alert("Unable to save medicine.");
    }
}

function vivoraDateValue(value) {
    if (!value) return "";
    if (typeof value === "string") return value.slice(0, 10);
    if (value && typeof value.toDate === "function") {
        const date = value.toDate();
        return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    }
    return "";
}
function vivoraTimeValue(value) {
    if (!value) return "";
    if (typeof value === "string") return value.slice(0, 5);
    if (value && typeof value.toDate === "function") {
        const date = value.toDate();
        return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
    }
    return "";
}
function medicineDoseTaken(medicine, time) {
    return Array.isArray(medicine.takenTimes) && medicine.takenTimes.includes(time);
}
function normalizeMedicineRecord(data, id) {
    const frequency = data.frequency || "Once a day";
    return {
        id: id,
        ...data,
        name: data.name || data.medicineName || "",
        dosage: data.dosage || "",
        quantity: Number(data.quantity) || 0,
        time: vivoraTimeValue(data.time || data.time1),
        time1: vivoraTimeValue(data.time1 || data.time),
        time2: vivoraTimeValue(data.time2),
        time3: vivoraTimeValue(data.time3),
        frequency: frequency,
        weeklyDay: data.weeklyDay || "",
        startDate: vivoraDateValue(data.startDate),
        endDate: vivoraDateValue(data.endDate),
        notes: data.notes || "",
        image: data.image || "",
        takenTimes: Array.isArray(data.takenTimes) ? data.takenTimes : []
    };
}
async function loadDefaultMedicines() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const medicineSnapshot = await getDocs(collection(db, "users", user.uid, "medicines"));
        medicines = [];
        medicineSnapshot.forEach(function(document) {
            medicines.push(normalizeMedicineRecord(document.data(), document.id));
        });
    } catch (error) {
        console.error("Error loading medicines:", error);
    }
}

function displayMedicines() {
    const medicineList = document.querySelector(".medicine-list");
    const medicineCount = document.querySelector(".medicine-count");

    if (!medicineList) {
        return;
    }

    medicineList.innerHTML = "";

    const todayMedicines = medicines.filter(function(medicine) {
        return isMedicineForToday(medicine);
    });

    todayMedicines.forEach(function(medicine) {
        createMedicineCard(medicine);
    });

    if (medicineCount) {
        medicineCount.textContent =
            todayMedicines.length + (todayMedicines.length === 1 ? " Medicine" : " Medicines");
    }
}

function displayAllMedicines() {
    const allMedicineList = document.querySelector(".all-medicine-list");

    if (!allMedicineList) {
        return;
    }

    allMedicineList.innerHTML = "";

    medicines.forEach(function(medicine) {
        createAllMedicineCard(medicine);
    });
}

function createAllMedicineCard(medicine) {
    const allMedicineList = document.querySelector(".all-medicine-list");
    const medicineCard = document.createElement("div");
    medicineCard.className = "medicine-card";
    const times = [medicine.time1 || medicine.time, medicine.time2, medicine.time3].filter(Boolean);
    const doseRows = times.map(time => `<div class="medicine-dose-row"><span>🕘 ${formatTime(time)}</span><span class="medicine-status ${medicineDoseTaken(medicine,time) ? "taken" : "pending"}">${medicineDoseTaken(medicine,time) ? "🟢 TAKEN" : "🟠 PENDING"}</span>${medicineDoseTaken(medicine,time) ? "" : `<button class="medicine-take-button" data-dose-time="${time}">✓ Mark as Taken</button>`}</div>`).join("");
    medicineCard.innerHTML = `<div class="medicine-image">${medicine.image ? `<img src="${medicine.image}" alt="${medicine.name} medicine">` : '<span>💊</span>'}</div><div class="medicine-info"><h3>${medicine.name}</h3><p class="dosage">${medicine.dosage}</p><p class="medicine-quantity">💊 Tablets: <strong>${medicine.quantity || 0}</strong></p><div class="medicine-details"><p>📅 Frequency: <strong>${medicine.frequency}</strong></p>${medicine.notes ? `<p>📝 Notes: <strong>${medicine.notes}</strong></p>` : ""}</div><div class="medicine-dose-list">${doseRows}</div><div class="medicine-actions"><button class="edit-medicine">✏️ Edit</button><button class="delete-medicine">🗑️ Delete</button></div></div>`;
    allMedicineList.appendChild(medicineCard);
    medicineCard.querySelectorAll(".medicine-take-button").forEach(button => button.addEventListener("click", async function() { await updateMedicineStatus(medicine.id, button.dataset.doseTime); }));
    medicineCard.querySelector(".edit-medicine").addEventListener("click", () => editMedicine(medicine));
    medicineCard.querySelector(".delete-medicine").addEventListener("click", () => deleteMedicine(medicine.id, medicineCard));
}

function isMedicineForToday(medicine) {
    const today = new Date();
    const todayName = today.toLocaleDateString("en-US", {
        weekday: "long"
    });

    // Check start date
    if (medicine.startDate) {
        const startDate = new Date(medicine.startDate);
        startDate.setHours(0, 0, 0, 0);

        if (today < startDate) {
            return false;
        }
    }

    // Check end date
    if (medicine.endDate) {
        const endDate = new Date(medicine.endDate);
        endDate.setHours(23, 59, 59, 999);

        if (today > endDate) {
            return false;
        }
    }

    // Weekly medicine
    if (medicine.frequency === "Weekly") {
        return medicine.weeklyDay === todayName;
    }

    // Daily and as prescribed medicines
    return true;
}

function getNextMedicineSchedule(medicine) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const times = [
        medicine.time1 || medicine.time,
        medicine.time2,
        medicine.time3
    ].filter(Boolean);

    if (times.length === 0) {
        return "Schedule not available";
    }

    // Weekly medicine
    if (medicine.frequency === "Weekly" && medicine.weeklyDay) {
        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];

        const targetDay = days.indexOf(medicine.weeklyDay);
        const currentDay = today.getDay();

        let daysUntil = targetDay - currentDay;

        if (daysUntil <= 0) {
            daysUntil += 7;
        }

        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntil);

        return formatNextSchedule(nextDate, times[0]);
    }

    // Daily medicine
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return formatNextSchedule(tomorrow, times[0]);
}

function formatNextSchedule(date, time) {
    const [hours, minutes] = time.split(":");

    date.setHours(hours);
    date.setMinutes(minutes);

    const formattedDate = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    const formattedTime = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    return formattedDate + " at " + formattedTime;
}

function createMedicineCard(medicine) {
    const medicineList = document.querySelector(".medicine-list");
    const medicineCard = document.createElement("article");
    medicineCard.className = "medicine-card";
    const times = [medicine.time1 || medicine.time, medicine.time2, medicine.time3].filter(Boolean);
    const doseRows = times.map(time => `<div class="medicine-dose-row"><span>🕘 ${formatTime(time)}</span><span class="medicine-status ${medicineDoseTaken(medicine,time) ? "taken" : "pending"}">${medicineDoseTaken(medicine,time) ? "🟢 TAKEN" : "🟠 PENDING"}</span>${medicineDoseTaken(medicine,time) ? "" : `<button class="medicine-take-button" data-dose-time="${time}">✓ Mark as Taken</button>`}</div>`).join("");
    medicineCard.innerHTML = `${isMedicineForToday(medicine) ? '<span class="today-badge">☀️ TODAY</span>' : ''}<div class="medicine-image">${medicine.image ? `<img src="${medicine.image}" alt="${medicine.name} medicine">` : '<span>💊</span>'}</div><div class="medicine-info"><h3>${medicine.name}</h3><p class="dosage">${medicine.dosage}</p><div class="medicine-details"><p class="medicine-frequency">📅 Schedule: <strong>${medicine.frequency}</strong></p></div><div class="medicine-dose-list">${doseRows}</div><div class="medicine-actions"><button class="edit-medicine">✏️ Edit</button><button class="delete-medicine">🗑️ Delete</button></div></div>`;
    medicineList.appendChild(medicineCard);
    medicineCard.querySelectorAll(".medicine-take-button").forEach(button => button.addEventListener("click", async function() { await updateMedicineStatus(medicine.id, button.dataset.doseTime); }));
    medicineCard.querySelector(".edit-medicine").addEventListener("click", () => editMedicine(medicine));
    medicineCard.querySelector(".delete-medicine").addEventListener("click", () => deleteMedicine(medicine.id, medicineCard));
}

async function deleteMedicine(id, medicineCard) {
    const confirmDelete = confirm("Are you sure you want to delete this medicine.");

    if (!confirmDelete) {
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        alert("Please login first.");
        return;
    }

    try {
        await deleteDoc(
            doc(db, "users", user.uid, "medicines", id)
        );

        medicines = medicines.filter(function(medicine) {
            return medicine.id !== id;
        });

        medicineCard.remove();

        displayMedicines();
        displayAllMedicines();

        alert("Medicine deleted successfully.");

    } catch (error) {
        console.error("Error deleting medicine:", error);
        alert("Unable to delete medicine.");
    }
}

function editMedicine(medicine) {
    document.getElementById("medicineName").value = medicine.name;
    document.getElementById("dosage").value = medicine.dosage;
    document.getElementById("medicineQuantity").value = medicine.quantity || "";
    document.getElementById("frequency").value = medicine.frequency;
    frequency.dispatchEvent(new Event("change"));
    document.getElementById("weeklyDay").value = medicine.weeklyDay || "";
    document.getElementById("medicineTime1").value = medicine.time1 || medicine.time || "";
    document.getElementById("medicineTime2").value = medicine.time2 || "";
    document.getElementById("medicineTime3").value = medicine.time3 || "";
    document.getElementById("startDate").value = medicine.startDate;
    document.getElementById("endDate").value = medicine.endDate;
    document.getElementById("medicineNotes").value = medicine.notes;

    if (medicine.image) {
        photoPreview.innerHTML = `<img src="${medicine.image}" alt="${medicine.name} medicine">`;
    }

    medicineModal.classList.add("show");
    medicineForm.dataset.editingId = medicine.id;
    medicineForm.dataset.existingImage = medicine.image || "";
}

async function updateMedicineStatus(id, time) {
    const user = auth.currentUser;
    if (!user) { alert("Please login first."); return; }
    try {
        const medicine = medicines.find(item => item.id === id);
        if (!medicine || !time) return;
        const takenTimes = Array.isArray(medicine.takenTimes) ? [...medicine.takenTimes] : [];
        if (!takenTimes.includes(time)) takenTimes.push(time);
        await updateDoc(doc(db, "users", user.uid, "medicines", id), { takenTimes, taken: false });
        medicines = medicines.map(item => item.id === id ? { ...item, takenTimes, taken: false } : item);
        displayMedicines();
        displayAllMedicines();
    } catch (error) {
        console.error("Error updating medicine dose status:", error);
        alert("Unable to update this medicine dose. Please check your connection and try again.");
    }
}

function displayMedicinesAfterUpdate() {
    const medicineList = document.querySelector(".medicine-list");
    if (medicineList) {
        medicineList.innerHTML = "";
        displayMedicines();
    }
}

function formatTime(time) {
    const [hours, minutes] = time.split(":");
    const date = new Date();

    date.setHours(hours);
    date.setMinutes(minutes);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function addTakenButtonFunctionality(card) {
    const button = card.querySelector(".medicine-status");

    button.addEventListener("click", function() {
        button.textContent = "✓ Taken";
        button.classList.remove("pending");
        button.classList.add("taken");
    });
}

function resetPhotoPreview() {
    if (photoPreview) {
        photoPreview.innerHTML = `
            <span>📷</span>
            <p>Medicine Photo</p>
        `;
    }
}

/* ==================== INJECTIONS MODULE ==================== */
const injectionModal = document.getElementById("injectionModal");
const openInjectionForm = document.getElementById("openInjectionForm");
const closeInjectionForm = document.getElementById("closeInjectionForm");
const cancelInjectionForm = document.getElementById("cancelInjectionForm");
const injectionForm = document.getElementById("injectionForm");
const injectionList = document.getElementById("injectionList");
const allInjectionList = document.getElementById("allInjectionList");
const injectionCount = document.getElementById("injectionCount");
const injectionPhoto = document.getElementById("injectionPhoto");
const injectionPhotoPreview = document.getElementById("injectionPhotoPreview");
let injections = [];
let editingInjectionId = null;
let selectedInjectionPhoto = "";
function injectionCollection() {
    const user = auth.currentUser;
    if (!user) return null;
    return collection(db, "users", user.uid, "injections");
}
function normalizeInjectionRecord(data, id) {
    return {
        id: id,
        ...data,
        name: data.name || data.injectionName || "",
        dose: data.dose || data.injectionDose || "",
        date: vivoraDateValue(data.date || data.injectionDate),
        time: vivoraTimeValue(data.time || data.injectionTime),
        frequency: data.frequency || "Once",
        doctor: data.doctor || "",
        location: data.location || "",
        notes: data.notes || "",
        photo: data.photo || "",
        status: data.status || "upcoming"
    };
}
async function loadInjections() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const snapshot = await getDocs(collection(db, "users", user.uid, "injections"));
        injections = [];
        snapshot.forEach(function(document) {
            injections.push(normalizeInjectionRecord(document.data(), document.id));
        });
    } catch (error) {
        console.error("Error loading injections:", error);
        alert("Unable to load injections.");
    }
}
if (openInjectionForm) {
    openInjectionForm.addEventListener("click", function() {
        editingInjectionId = null;
        selectedInjectionPhoto = "";
        if (injectionForm) injectionForm.reset();
        if (injectionPhotoPreview) {
            injectionPhotoPreview.innerHTML = `<span>💉</span><p>Injection Photo</p>`;
        }
        const title = document.getElementById("injectionModalTitle");
        if (title) title.textContent = "Add New Injection";
        if (injectionModal) injectionModal.classList.add("show");
    });
}
function closeInjectionModal() {
    if (!injectionModal || !injectionForm) return;
    injectionModal.classList.remove("show");
    injectionForm.reset();
    editingInjectionId = null;
    selectedInjectionPhoto = "";
}
if (closeInjectionForm) closeInjectionForm.addEventListener("click", closeInjectionModal);
if (cancelInjectionForm) cancelInjectionForm.addEventListener("click", closeInjectionModal);
if (injectionModal) {
    injectionModal.addEventListener("click", function(event) {
        if (event.target === injectionModal) closeInjectionModal();
    });
}
if (injectionPhoto) {
    injectionPhoto.addEventListener("change", function() {
        const file = this.files[0];
        if (!file) return;
        if (file.size > 700000) {
            alert("The injection photo is too large. Please choose an image smaller than 700 KB for now.");
            this.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            selectedInjectionPhoto = event.target.result;
            if (injectionPhotoPreview) injectionPhotoPreview.innerHTML = `<img src="${selectedInjectionPhoto}" alt="Injection Photo">`;
        };
        reader.readAsDataURL(file);
    });
}
if (injectionForm) {
    injectionForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            alert("Please login first.");
            return;
        }
        const name = document.getElementById("injectionName").value;
        const dose = document.getElementById("injectionDose").value;
        const date = document.getElementById("injectionDate").value;
        const time = document.getElementById("injectionTime").value;
        const frequency = document.getElementById("injectionFrequency").value;
        const doctor = document.getElementById("injectionDoctor").value;
        const location = document.getElementById("injectionLocation").value;
        const notes = document.getElementById("injectionNotes").value;
        try {
            const data = {
                name: name,
                dose: dose,
                date: date,
                time: time,
                frequency: frequency,
                doctor: doctor,
                location: location,
                notes: notes,
                photo: selectedInjectionPhoto || "",
                status: "upcoming",
                updatedAt: new Date().toISOString()
            };
            if (editingInjectionId) {
                await updateDoc(doc(db, "users", user.uid, "injections", editingInjectionId), data);
            } else {
                data.createdAt = new Date().toISOString();
                await addDoc(collection(db, "users", user.uid, "injections"), data);
            }
            await loadInjections();
            displayInjections();
            closeInjectionModal();
        } catch (error) {
            console.error("Error saving injection:", error);
            alert("Unable to save injection.");
        }
    });
}
function isUpcomingInjection(date) {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const injectionDate = new Date(date + "T00:00:00");
    injectionDate.setHours(0, 0, 0, 0);
    const days = (injectionDate - today) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
}
function getNextInjectionDate(injection) {
    if (!injection.date || injection.frequency === "Once") return injection.date;
    let injectionDate = new Date(injection.date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    injectionDate.setHours(0, 0, 0, 0);
    while (injectionDate < today) {
        let monthsToAdd = 0;
        if (injection.frequency === "Every month") monthsToAdd = 1;
        else if (injection.frequency === "Every 2 months") monthsToAdd = 2;
        else if (injection.frequency === "Every 3 months") monthsToAdd = 3;
        else if (injection.frequency === "Every 6 months") monthsToAdd = 6;
        else if (injection.frequency === "Every year") {
            injectionDate.setFullYear(injectionDate.getFullYear() + 1);
            continue;
        } else break;
        const originalDay = injectionDate.getDate();
        injectionDate.setDate(1);
        injectionDate.setMonth(injectionDate.getMonth() + monthsToAdd);
        const lastDay = new Date(injectionDate.getFullYear(), injectionDate.getMonth() + 1, 0).getDate();
        injectionDate.setDate(Math.min(originalDay, lastDay));
    }
    return `${injectionDate.getFullYear()}-${String(injectionDate.getMonth() + 1).padStart(2, "0")}-${String(injectionDate.getDate()).padStart(2, "0")}`;
}
async function updateRecurringInjectionDates() {
    const user = auth.currentUser;
    if (!user) return;
    let changed = false;
    for (const injection of injections) {
        const nextDate = getNextInjectionDate(injection);
        if (nextDate && nextDate !== injection.date && injection.frequency !== "Once") {
            try {
                await updateDoc(doc(db, "users", user.uid, "injections", injection.id), { date: nextDate, status: "upcoming" });
                injection.date = nextDate;
                injection.status = "upcoming";
                changed = true;
            } catch (error) {
                console.error("Error updating recurring injection:", error);
            }
        }
    }
    return changed;
}
async function displayInjections() {
    if (!injectionList || !allInjectionList) return;
    const upcomingInjections = injections.filter(function(injection) {
        return isUpcomingInjection(injection.date);
    }).sort(function(a, b) {
        return new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00"));
    });
    if (injectionCount) {
        const count = upcomingInjections.length;
        injectionCount.textContent = count + (count === 1 ? " Injection" : " Injections");
    }
    injectionList.innerHTML = upcomingInjections.length ? "" : `<div class="empty-injection"><div>💉</div><h3>No injections in the next 7 days</h3><p>Your upcoming injection schedule will appear here.</p></div>`;
    upcomingInjections.forEach(function(injection) { injectionList.appendChild(createInjectionCard(injection)); });
    allInjectionList.innerHTML = injections.length ? "" : `<div class="empty-injection"><div>💉</div><h3>No injections added yet</h3><p>Click "Add Injection" to create your first injection schedule.</p></div>`;
    injections.slice().sort(function(a, b) { return new Date(a.date) - new Date(b.date); }).forEach(function(injection) { allInjectionList.appendChild(createInjectionCard(injection)); });
}
function getInjectionStatus(injection) {
    if (isUpcomingInjection(injection.date)) return { text: "UPCOMING", className: "upcoming" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(injection.date + "T00:00:00");
    if (injection.frequency === "Once" && date < today) return { text: "COMPLETED", className: "completed" };
    return { text: "SCHEDULED", className: "scheduled" };
}
function getInjectionDaysText(date) {
    if (!date) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const injectionDate = new Date(date + "T00:00:00");
    injectionDate.setHours(0, 0, 0, 0);
    const days = Math.round((injectionDate - today) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Due Today";
    if (days === 1) return "Due Tomorrow";
    if (days > 1) return "Due in " + days + " days";
    return "Past Due";
}
function createInjectionCard(injection) {
    const card = document.createElement("div");
    card.className = "injection-card";
    const status = getInjectionStatus(injection);
    const image = injection.photo ? `<img src="${injection.photo}" alt="Injection Photo">` : `<div style="font-size:65px;">💉</div>`;
    const id = String(injection.id).replace(/'/g, "\\'");
    card.innerHTML = `<div class="injection-image-container">${image}</div><div class="injection-info"><h3>${injection.name}</h3><div class="injection-dose">${injection.dose}</div>${isUpcomingInjection(injection.date) ? `<div class="injection-due">${getInjectionDaysText(injection.date)}</div>` : ""}<div class="injection-detail">📅 <span>Next dose: <strong>${formatInjectionDate(injection.date)}</strong></span></div><div class="injection-detail">⏰ <span>Time: <strong>${formatInjectionTime(injection.time)}</strong></span></div><div class="injection-detail">🔄 <span>Schedule: <strong>${injection.frequency}</strong></span></div>${injection.doctor ? `<div class="injection-detail">👨‍⚕️ <span>Doctor: <strong>${injection.doctor}</strong></span></div>` : ""}${injection.location ? `<div class="injection-detail">📍 <span>Location: <strong>${injection.location}</strong></span></div>` : ""}<div class="injection-status ${status.className}"><span class="status-dot"></span>${status.text}</div><div class="injection-actions"><button class="injection-edit-btn" onclick="editInjection('${id}')">✏️ Edit</button><button class="injection-delete-btn" onclick="deleteInjection('${id}')">🗑️ Delete</button></div></div>`;
    return card;
}
function formatInjectionDate(date) {
    if (!date) return "";
    return new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatInjectionTime(time) {
    if (!time) return "";
    const parts = time.split(":");
    let hour = parseInt(parts[0]);
    const minute = parts[1];
    const period = hour >= 12 ? "pm" : "am";
    hour = hour % 12 || 12;
    return hour + ":" + minute + " " + period;
}
function editInjection(id) {
    const injection = injections.find(function(item) { return String(item.id) === String(id); });
    if (!injection) return;
    editingInjectionId = String(id);
    selectedInjectionPhoto = injection.photo || "";
    document.getElementById("injectionName").value = injection.name || "";
    document.getElementById("injectionDose").value = injection.dose || "";
    document.getElementById("injectionDate").value = injection.date || "";
    document.getElementById("injectionTime").value = injection.time || "";
    document.getElementById("injectionFrequency").value = injection.frequency || "Once";
    document.getElementById("injectionDoctor").value = injection.doctor || "";
    document.getElementById("injectionLocation").value = injection.location || "";
    document.getElementById("injectionNotes").value = injection.notes || "";
    if (injectionPhotoPreview) injectionPhotoPreview.innerHTML = injection.photo ? `<img src="${injection.photo}" alt="Injection Photo">` : `<span>💉</span><p>Injection Photo</p>`;
    document.getElementById("injectionModalTitle").textContent = "Edit Injection";
    if (injectionModal) injectionModal.classList.add("show");
}
async function deleteInjection(id) {
    if (!confirm("Are you sure you want to delete this injection?")) return;
    const user = auth.currentUser;
    if (!user) { alert("Please login first."); return; }
    try {
        await deleteDoc(doc(db, "users", user.uid, "injections", id));
        injections = injections.filter(function(item) { return String(item.id) !== String(id); });
        displayInjections();
    } catch (error) {
        console.error("Error deleting injection:", error);
        alert("Unable to delete injection.");
    }
}

/* ==================== APPOINTMENTS MODULE ==================== */
const appointmentModal = document.getElementById("appointmentModal");
const openAppointmentForm = document.getElementById("openAppointmentForm");
const closeAppointmentForm = document.getElementById("closeAppointmentForm");
const cancelAppointmentForm = document.getElementById("cancelAppointmentForm");
const appointmentForm = document.getElementById("appointmentForm");
const nextVisit = document.getElementById("nextVisit");
const appointmentTimeline = document.getElementById("appointmentTimeline");
let appointments = [];
let editingAppointmentId = null;
function normalizeAppointmentRecord(data, id) {
    return {
        id: id,
        ...data,
        doctor: data.doctor || "",
        hospital: data.hospital || "",
        date: vivoraDateValue(data.date || data.appointmentDate),
        time: vivoraTimeValue(data.time || data.appointmentTime),
        type: data.type || data.appointmentType || "Other",
        location: data.location || "",
        notes: data.notes || ""
    };
}
async function loadAppointments() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const snapshot = await getDocs(collection(db, "users", user.uid, "appointments"));
        appointments = [];
        snapshot.forEach(function(document) { appointments.push(normalizeAppointmentRecord(document.data(), document.id)); });
    } catch (error) {
        console.error("Error loading appointments:", error);
        alert("Unable to load appointments.");
    }
}
if (openAppointmentForm) {
    openAppointmentForm.addEventListener("click", function() {
        editingAppointmentId = null;
        if (appointmentForm) appointmentForm.reset();
        document.getElementById("appointmentModalTitle").textContent = "Add New Appointment";
        if (appointmentModal) appointmentModal.classList.add("show");
    });
}
function closeAppointmentModal() {
    if (!appointmentModal || !appointmentForm) return;
    appointmentModal.classList.remove("show");
    appointmentForm.reset();
    editingAppointmentId = null;
}
if (closeAppointmentForm) closeAppointmentForm.addEventListener("click", closeAppointmentModal);
if (cancelAppointmentForm) cancelAppointmentForm.addEventListener("click", closeAppointmentModal);
if (appointmentModal) appointmentModal.addEventListener("click", function(event) { if (event.target === appointmentModal) closeAppointmentModal(); });
if (appointmentForm) {
    appointmentForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) { alert("Please login first."); return; }
        const data = {
            doctor: document.getElementById("appointmentDoctor").value,
            hospital: document.getElementById("appointmentHospital").value,
            date: document.getElementById("appointmentDate").value,
            time: document.getElementById("appointmentTime").value,
            type: document.getElementById("appointmentType").value,
            location: document.getElementById("appointmentLocation").value,
            notes: document.getElementById("appointmentNotes").value,
            updatedAt: new Date().toISOString()
        };
        try {
            if (editingAppointmentId) {
                await updateDoc(doc(db, "users", user.uid, "appointments", editingAppointmentId), data);
            } else {
                data.createdAt = new Date().toISOString();
                await addDoc(collection(db, "users", user.uid, "appointments"), data);
            }
            await loadAppointments();
            displayAppointments();
            closeAppointmentModal();
        } catch (error) {
            console.error("Error saving appointment:", error);
            alert("Unable to save appointment.");
        }
    });
}
function formatAppointmentDate(date) {
    if (!date) return "";
    return new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
function formatAppointmentTime(time) {
    if (!time) return "";
    const parts = time.split(":");
    let hour = parseInt(parts[0]);
    const minute = parts[1];
    const period = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return hour + ":" + minute + " " + period;
}
function getAppointmentDays(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(date + "T00:00:00");
    appointmentDate.setHours(0, 0, 0, 0);
    return Math.ceil((appointmentDate - today) / (1000 * 60 * 60 * 24));
}
function getAppointmentCountdown(date) {
    const days = getAppointmentDays(date);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days > 1) return "In " + days + " days";
    return "Past appointment";
}
function displayNextVisit() {
    if (!nextVisit) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = appointments.filter(function(a) { return new Date(a.date + "T00:00:00") >= today; }).sort(function(a, b) { return new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00")); });
    if (!upcoming.length) {
        nextVisit.innerHTML = `<div class="empty-appointment"><div class="empty-icon">📅</div><h3>No upcoming appointments</h3><p>Your next doctor visit will appear here.</p></div>`;
        return;
    }
    const appointment = upcoming[0];
    const date = new Date(appointment.date + "T00:00:00");
    const id = String(appointment.id).replace(/'/g, "\\'");
    nextVisit.innerHTML = `<div class="next-visit-card"><div class="next-visit-info"><h3>Dr. ${appointment.doctor}</h3><p>🏥 ${appointment.hospital}</p><p>🕐 ${formatAppointmentTime(appointment.time)}</p><p>🩺 ${appointment.type}</p>${appointment.location ? `<p>📍 ${appointment.location}</p>` : ""}<div class="visit-countdown">⏳ ${getAppointmentCountdown(appointment.date)}</div><div class="visit-actions"><button class="edit-appointment-btn" onclick="editAppointment('${id}')">✏️ Edit</button><button class="delete-appointment-btn" onclick="deleteAppointment('${id}')">🗑️ Delete</button></div></div><div class="visit-date-box"><div class="day">${date.getDate()}</div><div class="month">${date.toLocaleDateString("en-IN", { month: "short" })}</div></div></div>`;
}
function displayAppointmentTimeline() {
    if (!appointmentTimeline) return;
    const sorted = appointments.slice().sort(function(a, b) { return new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00")); });
    if (!sorted.length) {
        appointmentTimeline.innerHTML = `<div class="empty-appointment"><div class="empty-icon">🗓️</div><h3>No appointments yet</h3><p>Add your first doctor appointment.</p></div>`;
        return;
    }
    appointmentTimeline.innerHTML = sorted.map(function(appointment) {
        const completed = getAppointmentDays(appointment.date) < 0;
        const id = String(appointment.id).replace(/'/g, "\\'");
        return `<div class="timeline-item ${completed ? "completed" : ""}"><div class="appointment-status ${completed ? "completed" : "upcoming"}">${completed ? "✓ Completed" : "📅 Upcoming"}</div><div class="timeline-date">📅 ${formatAppointmentDate(appointment.date)} · ${formatAppointmentTime(appointment.time)}</div><h3>Dr. ${appointment.doctor}</h3><p>🏥 ${appointment.hospital}</p><p>🩺 ${appointment.type}</p>${appointment.location ? `<p>📍 ${appointment.location}</p>` : ""}${appointment.notes ? `<p>📝 ${appointment.notes}</p>` : ""}<div class="timeline-actions"><button class="edit-appointment-btn" onclick="editAppointment('${id}')">✏️ Edit</button><button class="delete-appointment-btn" onclick="deleteAppointment('${id}')">🗑️ Delete</button></div></div>`;
    }).join("");
}
function editAppointment(id) {
    const appointment = appointments.find(function(item) { return String(item.id) === String(id); });
    if (!appointment) return;
    editingAppointmentId = String(id);
    document.getElementById("appointmentDoctor").value = appointment.doctor || "";
    document.getElementById("appointmentHospital").value = appointment.hospital || "";
    document.getElementById("appointmentDate").value = appointment.date || "";
    document.getElementById("appointmentTime").value = appointment.time || "";
    document.getElementById("appointmentType").value = appointment.type || "";
    document.getElementById("appointmentLocation").value = appointment.location || "";
    document.getElementById("appointmentNotes").value = appointment.notes || "";
    document.getElementById("appointmentModalTitle").textContent = "Edit Appointment";
    if (appointmentModal) appointmentModal.classList.add("show");
}
async function deleteAppointment(id) {
    if (!confirm("Delete this appointment?")) return;
    const user = auth.currentUser;
    if (!user) { alert("Please login first."); return; }
    try {
        await deleteDoc(doc(db, "users", user.uid, "appointments", id));
        appointments = appointments.filter(function(item) { return String(item.id) !== String(id); });
        displayAppointments();
    } catch (error) {
        console.error("Error deleting appointment:", error);
        alert("Unable to delete appointment.");
    }
}
function displayAppointments() {
    displayNextVisit();
    displayAppointmentTimeline();
}

// ==================== HEALTH RECORDS MODULE ====================
const recordModal = document.getElementById("recordModal");
const openRecordForm = document.getElementById("openRecordForm");
const closeRecordForm = document.getElementById("closeRecordForm");
const cancelRecordForm = document.getElementById("cancelRecordForm");
const emptyAddRecord = document.getElementById("emptyAddRecord");
const recordForm = document.getElementById("recordForm");
const recordsContainer = document.getElementById("recordsContainer");
const recordModalTitle = document.getElementById("recordModalTitle");
const recordsSectionTitle = document.getElementById("recordsSectionTitle");
const categoryButtons = document.querySelectorAll(".category-btn");
let healthRecords = [];
let editingRecordId = null;
let selectedCategory = "all";
function normalizeHealthRecord(data, id) {
    let type = data.type || data.recordType || "notes";
    if (type === "lab report") type = "lab";
    else if (type === "prescription") type = "prescription";
    else if (type === "scan report" || type === "scan") type = "scan";
    else if (type !== "lab" && type !== "prescription" && type !== "scan" && type !== "notes") type = "notes";
    return {
        id: id,
        ...data,
        name: data.name || data.recordTitle || "",
        type: type,
        date: vivoraDateValue(data.date || data.recordDate),
        doctor: data.doctor || "",
        hospital: data.hospital || "",
        description: data.description || "",
        fileName: data.fileName || "",
        fileData: data.fileData || ""
    };
}
async function loadHealthRecords() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const snapshot = await getDocs(collection(db, "users", user.uid, "healthRecords"));
        healthRecords = [];
        snapshot.forEach(function(document) { healthRecords.push(normalizeHealthRecord(document.data(), document.id)); });
    } catch (error) {
        console.error("Error loading health records:", error);
        alert("Unable to load health records.");
    }
}
function openRecordModal(record = null) {
    if (!recordModal || !recordForm) return;
    recordForm.reset();
    editingRecordId = null;
    recordModalTitle.textContent = "Add New Record";
    if (record) {
        editingRecordId = String(record.id);
        recordModalTitle.textContent = "Edit Record";
        document.getElementById("recordName").value = record.name || "";
        document.getElementById("recordType").value = record.type || "";
        document.getElementById("recordDate").value = record.date || "";
        document.getElementById("recordDoctor").value = record.doctor || "";
        document.getElementById("recordHospital").value = record.hospital || "";
        document.getElementById("recordDescription").value = record.description || "";
    }
    recordModal.classList.add("show");
}
function closeRecordModal() {
    if (!recordModal || !recordForm) return;
    recordModal.classList.remove("show");
    recordForm.reset();
    editingRecordId = null;
}
if (openRecordForm) openRecordForm.addEventListener("click", function() { openRecordModal(); });
if (emptyAddRecord) emptyAddRecord.addEventListener("click", function() { openRecordModal(); });
if (closeRecordForm) closeRecordForm.addEventListener("click", closeRecordModal);
if (cancelRecordForm) cancelRecordForm.addEventListener("click", closeRecordModal);
if (recordModal) recordModal.addEventListener("click", function(event) { if (event.target === recordModal) closeRecordModal(); });
if (recordForm) {
    recordForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) { alert("Please login first."); return; }
        const name = document.getElementById("recordName").value.trim();
        const type = document.getElementById("recordType").value;
        const date = document.getElementById("recordDate").value;
        const doctor = document.getElementById("recordDoctor").value.trim();
        const hospital = document.getElementById("recordHospital").value.trim();
        const description = document.getElementById("recordDescription").value.trim();
        const fileInput = document.getElementById("recordFile");
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        try {
            const data = { name, type, date, doctor, hospital, description, updatedAt: new Date().toISOString() };
            if (file) {
                data.fileName = file.name;
                if (file.size <= 700000) {
                    data.fileData = await readFileAsDataURL(file);
                } else {
                    alert("The file is too large to store in Firestore. Please use a file smaller than 700 KB for now.");
                    return;
                }
            } else if (editingRecordId) {
                const oldRecord = healthRecords.find(function(record) { return String(record.id) === String(editingRecordId); });
                if (oldRecord) {
                    data.fileName = oldRecord.fileName || "";
                    data.fileData = oldRecord.fileData || "";
                }
            } else {
                data.fileName = "";
                data.fileData = "";
            }
            if (editingRecordId) {
                await updateDoc(doc(db, "users", user.uid, "healthRecords", editingRecordId), data);
            } else {
                data.createdAt = new Date().toISOString();
                await addDoc(collection(db, "users", user.uid, "healthRecords"), data);
            }
            await loadHealthRecords();
            closeRecordModal();
            displayHealthRecords();
            updateRecordCounts();
        } catch (error) {
            console.error("Error saving health record:", error);
            alert("Unable to save health record.");
        }
    });
}
function readFileAsDataURL(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function(event) { resolve(event.target.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
function getRecordTypeName(type) {
    if (type === "lab") return "🧪 Lab Report";
    if (type === "prescription") return "💊 Prescription";
    if (type === "scan") return "🩻 Scan Report";
    if (type === "notes") return "📝 Medical Note";
    return "Health Record";
}
function getRecordIcon(type) {
    if (type === "lab") return "🧪";
    if (type === "prescription") return "💊";
    if (type === "scan") return "🩻";
    return "📝";
}
function formatRecordDate(date) {
    if (!date) return "";
    const parts = date.split("-");
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date;
}
function displayHealthRecords() {
    if (!recordsContainer || !recordsSectionTitle) return;
    const filtered = selectedCategory === "all" ? healthRecords : healthRecords.filter(function(record) { return record.type === selectedCategory; });
    recordsSectionTitle.textContent = selectedCategory === "all" ? "All Records" : getRecordTypeName(selectedCategory);
    if (!filtered.length) {
        recordsContainer.innerHTML = `<div class="empty-records"><div class="empty-records-icon">📋</div><h3>No health records yet</h3><p>Add a health record to keep it safely in Vivora.</p><button class="empty-add-btn" id="emptyRecordButton">➕ Add Record</button></div>`;
        const button = document.getElementById("emptyRecordButton");
        if (button) button.addEventListener("click", function() { openRecordModal(); });
        return;
    }
    filtered.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    recordsContainer.innerHTML = filtered.map(function(record) {
        const id = String(record.id).replace(/'/g, "\\'");
        const fileSection = record.fileData ? `<div class="record-file"><span>📎 ${record.fileName || "Attached file"}</span><button type="button" class="view-file-btn" onclick="viewHealthRecordFile('${id}')">👁️ View File</button></div>` : `<div class="record-file no-file"><span>📎 No file attached</span></div>`;
        return `<div class="health-record-card"><div class="record-card-icon">${getRecordIcon(record.type)}</div><div class="record-card-content"><div class="record-card-top"><div><h3>${record.name}</h3><span class="record-type">${getRecordTypeName(record.type)}</span></div><span class="record-date">📅 ${formatRecordDate(record.date)}</span></div>${record.doctor ? `<p><strong>Doctor:</strong> ${record.doctor}</p>` : ""}${record.hospital ? `<p><strong>Hospital:</strong> ${record.hospital}</p>` : ""}${record.description ? `<p>${record.description}</p>` : ""}${fileSection}<div class="record-card-actions"><button type="button" class="edit-record-btn" onclick="editHealthRecord('${id}')">✏️ Edit</button><button type="button" class="delete-record-btn" onclick="deleteHealthRecord('${id}')">🗑️ Delete</button></div></div></div>`;
    }).join("");
}
function viewHealthRecordFile(id) {
    const record = healthRecords.find(function(r) { return String(r.id) === String(id); });
    if (!record || !record.fileData) { alert("No file is attached to this record."); return; }
    const fileWindow = window.open("", "_blank");
    if (!fileWindow) { alert("Please allow pop-ups in your browser to view the file."); return; }
    const isImage = record.fileData.startsWith("data:image");
    fileWindow.document.write(`<!DOCTYPE html><html><head><title>${record.name}</title><style>body{margin:0;padding:20px;background:#f5f2fa;display:flex;justify-content:center;align-items:center;min-height:100vh;box-sizing:border-box}img{max-width:95%;max-height:95vh;object-fit:contain;border-radius:12px}iframe{width:95%;height:95vh;border:none;background:white;border-radius:12px}</style></head><body>${isImage ? `<img src="${record.fileData}" alt="${record.name}">` : `<iframe src="${record.fileData}"></iframe>`}</body></html>`);
    fileWindow.document.close();
}
function editHealthRecord(id) {
    const record = healthRecords.find(function(r) { return String(r.id) === String(id); });
    if (record) openRecordModal(record);
}
async function deleteHealthRecord(id) {
    const record = healthRecords.find(function(r) { return String(r.id) === String(id); });
    if (!record || !confirm(`Delete "${record.name}"?`)) return;
    const user = auth.currentUser;
    if (!user) { alert("Please login first."); return; }
    try {
        await deleteDoc(doc(db, "users", user.uid, "healthRecords", id));
        healthRecords = healthRecords.filter(function(r) { return String(r.id) !== String(id); });
        displayHealthRecords();
        updateRecordCounts();
    } catch (error) {
        console.error("Error deleting health record:", error);
        alert("Unable to delete health record.");
    }
}
function updateRecordCounts() {
    const labCount = document.getElementById("labCount");
    const prescriptionCount = document.getElementById("prescriptionCount");
    const scanCount = document.getElementById("scanCount");
    const notesCount = document.getElementById("notesCount");
    if (labCount) labCount.textContent = healthRecords.filter(r => r.type === "lab").length;
    if (prescriptionCount) prescriptionCount.textContent = healthRecords.filter(r => r.type === "prescription").length;
    if (scanCount) scanCount.textContent = healthRecords.filter(r => r.type === "scan").length;
    if (notesCount) notesCount.textContent = healthRecords.filter(r => r.type === "notes").length;
}
categoryButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        categoryButtons.forEach(function(btn) { btn.classList.remove("active"); });
        this.classList.add("active");
        selectedCategory = this.dataset.category;
        displayHealthRecords();
    });
});

/* ==================== ONE-TIME LOCAL DATA MIGRATION ==================== */
async function migrateLocalData() {
    const user = auth.currentUser;
    if (!user) return;
    const migrations = [
        { key: "vivoraMedicines", collectionName: "medicines" },
        { key: "injections", collectionName: "injections" },
        { key: "appointments", collectionName: "appointments" },
        { key: "vivoraHealthRecords", collectionName: "healthRecords" }
    ];
    for (const migration of migrations) {
        const raw = localStorage.getItem(migration.key);
        if (!raw) continue;
        try {
            const oldData = JSON.parse(raw);
            if (!Array.isArray(oldData) || oldData.length === 0) {
                localStorage.removeItem(migration.key);
                continue;
            }
            const collectionRef = collection(db, "users", user.uid, migration.collectionName);
            const existing = await getDocs(collectionRef);
            if (existing.empty) {
                for (const item of oldData) {
                    const data = { ...item };
                    delete data.id;
                    if (migration.collectionName === "healthRecords" && data.fileData && data.fileData.length > 700000) {
                        delete data.fileData;
                        data.fileName = "";
                    }
                    data.migratedAt = new Date().toISOString();
                    await addDoc(collectionRef, data);
                }
            }
            localStorage.removeItem(migration.key);
        } catch (error) {
            console.error("Error migrating " + migration.collectionName + ":", error);
        }
    }
}


/* ==================== EMERGENCY INFORMATION ==================== */
const emergencyForm = document.getElementById("emergencyForm");
const emergencyMessage = document.getElementById("emergencyMessage");
const emergencySummary = document.getElementById("emergencySummary");
const emergencyQuickActions = document.getElementById("emergencyQuickActions");
const emergencyUpdated = document.getElementById("emergencyUpdated");
const emergencyFields = ["bloodGroup", "emergencyName", "emergencyPhone", "emergencyRelation", "emergencyDoctor", "emergencyDoctorPhone", "allergies", "emergencyNotes"];
let emergencyInfo = null;

function getEmergencyDocument() {
    const user = auth.currentUser;
    if (!user) return null;
    return doc(db, "users", user.uid, "emergencyInfo", "info");
}

function normalizePhone(value) {
    return String(value || "").replace(/[^0-9+]/g, "");
}

function createSummaryRow(label, value) {
    if (!value) return "";
    return `<div class="summary-row"><span class="summary-label">${escapeHtml(label)}</span><span class="summary-value">${escapeHtml(value)}</span></div>`;
}

function displayEmergencyInfo(data) {
    if (!emergencySummary) return;
    if (!data) {
        emergencySummary.innerHTML = '<p class="empty-summary">No emergency information saved yet.</p>';
        if (emergencyQuickActions) emergencyQuickActions.innerHTML = "";
        if (emergencyUpdated) emergencyUpdated.textContent = "";
        return;
    }
    let html = "";
    html += createSummaryRow("Blood Group", data.bloodGroup);
    html += createSummaryRow("Emergency Contact", data.emergencyName);
    html += createSummaryRow("Relationship", data.emergencyRelation);
    html += createSummaryRow("Contact Phone", data.emergencyPhone);
    html += createSummaryRow("Doctor", data.emergencyDoctor);
    html += createSummaryRow("Doctor Phone", data.emergencyDoctorPhone);
    if (data.allergies) {
        html += `<div class="summary-notes"><span class="summary-label">Allergies</span><div class="summary-value">${escapeHtml(data.allergies)}</div></div>`;
    }
    if (data.emergencyNotes) {
        html += `<div class="summary-notes"><span class="summary-label">Medical Notes</span><div class="summary-value">${escapeHtml(data.emergencyNotes)}</div></div>`;
    }
    if (!html) html = '<p class="empty-summary">No emergency information has been entered yet.</p>';
    emergencySummary.innerHTML = html;
    if (emergencyQuickActions) {
        let actions = "";
        const contactPhone = normalizePhone(data.emergencyPhone);
        const doctorPhone = normalizePhone(data.emergencyDoctorPhone);
        if (contactPhone) actions += `<a class="quick-action quick-call" href="tel:${escapeHtml(contactPhone)}">📞 Call Emergency Contact</a>`;
        if (doctorPhone) actions += `<a class="quick-action quick-doctor" href="tel:${escapeHtml(doctorPhone)}">👨‍⚕️ Call Doctor</a>`;
        emergencyQuickActions.innerHTML = actions;
    }
    if (emergencyUpdated && data.updatedAt) {
        const date = new Date(data.updatedAt);
        emergencyUpdated.textContent = Number.isNaN(date.getTime()) ? "" : "Last updated: " + date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
}

async function loadEmergencyInfo() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const snapshot = await getDoc(getEmergencyDocument());
        if (!snapshot.exists()) {
            emergencyInfo = null;
            displayEmergencyInfo(null);
            return;
        }
        emergencyInfo = snapshot.data();
        emergencyFields.forEach(function(id) {
            const element = document.getElementById(id);
            if (element) element.value = emergencyInfo[id] || "";
        });
        displayEmergencyInfo(emergencyInfo);
    } catch (error) {
        console.error("Error loading emergency information:", error);
        if (emergencyMessage) emergencyMessage.textContent = "Unable to load emergency information.";
    }
}

if (emergencyForm) {
    emergencyForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            if (emergencyMessage) emergencyMessage.textContent = "Please login first.";
            return;
        }
        const data = {};
        emergencyFields.forEach(function(id) {
            const element = document.getElementById(id);
            data[id] = element ? element.value.trim() : "";
        });
        if (!data.emergencyName && !data.emergencyPhone && !data.emergencyDoctor && !data.emergencyDoctorPhone) {
            if (emergencyMessage) emergencyMessage.textContent = "Please enter at least one emergency contact or doctor detail.";
            return;
        }
        data.updatedAt = new Date().toISOString();
        try {
            await setDoc(getEmergencyDocument(), data, { merge: true });
            emergencyInfo = data;
            displayEmergencyInfo(emergencyInfo);
            if (emergencyMessage) {
                emergencyMessage.textContent = "Emergency information saved successfully.";
                setTimeout(function() { if (emergencyMessage) emergencyMessage.textContent = ""; }, 3000);
            }
        } catch (error) {
            console.error("Error saving emergency information:", error);
            if (emergencyMessage) emergencyMessage.textContent = "Unable to save emergency information.";
        }
    });
}

/* ==================== AUTHENTICATED DATA LOAD ==================== */
window.editInjection = editInjection;
window.deleteInjection = deleteInjection;
window.editAppointment = editAppointment;
window.deleteAppointment = deleteAppointment;
window.openRecordModal = openRecordModal;
window.viewHealthRecordFile = viewHealthRecordFile;
window.editHealthRecord = editHealthRecord;
window.deleteHealthRecord = deleteHealthRecord;
onAuthStateChanged(auth, async function(user) {
    const page = window.location.pathname.split("/").pop();
    const protectedPages = ["dashboard.html", "medicines.html", "injections.html", "appointments.html", "health-records.html", "emergency.html", "caregiver.html"];
    if (!user) {
        if (protectedPages.includes(page)) window.location.href = "login.html";
        return;
    }
    await migrateLocalData();
    await loadDefaultMedicines();
    await loadInjections();
    await updateRecurringInjectionDates();
    await loadAppointments();
    await loadHealthRecords();
    await loadEmergencyInfo();
    displayMedicines();
    displayAllMedicines();
    displayInjections();
    displayAppointments();
    displayHealthRecords();
    updateRecordCounts();
    if (page === "caregiver.html") await loadNotes();
});


/* ==================== CAREGIVER NOTES ==================== */
const form = document.getElementById("caregiverForm");
const formCard = document.getElementById("noteFormCard");
const addButton = document.getElementById("addNoteButton");
const cancelButton = document.getElementById("cancelNoteButton");
const notesList = document.getElementById("notesList");
const emptyNotes = document.getElementById("emptyNotes");
const noteCount = document.getElementById("noteCount");
const message = document.getElementById("caregiverMessage");
const formTitle = document.getElementById("formTitle");
const titleInput = document.getElementById("noteTitle");
const textInput = document.getElementById("noteText");
const categoryInput = document.getElementById("noteCategory");
const priorityInput = document.getElementById("notePriority");
const dateInput = document.getElementById("noteDate");
let notes = [];

function notesCollection() {
    const user = auth.currentUser;
    if (!user) return null;
    return collection(db, "users", user.uid, "caregiverNotes");
}

function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

if (addButton && form && formCard) {
    addButton.addEventListener("click", function() {
        form.reset();
        delete form.dataset.editingId;
        if (formTitle) formTitle.textContent = "Add Caregiver Note";
        if (dateInput) dateInput.value = getTodayDate();
        if (priorityInput) priorityInput.value = "Normal";
        if (message) message.textContent = "";
        formCard.hidden = false;
        if (titleInput) titleInput.focus();
    });
}

if (cancelButton) {
    cancelButton.addEventListener("click", function() {
        closeForm();
    });
}

if (form) {
    form.addEventListener("submit", async function(event) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            if (message) message.textContent = "Please login first.";
            return;
        }
        const title = titleInput ? titleInput.value.trim() : "";
        const textValue = textInput ? textInput.value.trim() : "";
        const category = categoryInput ? categoryInput.value : "General";
        const priority = priorityInput ? priorityInput.value : "Normal";
        const noteDate = dateInput ? dateInput.value : getTodayDate();
        if (!title || !textValue || !noteDate) {
            if (message) message.textContent = "Please fill all required fields.";
            return;
        }
        const editingId = form.dataset.editingId;
        try {
            if (editingId) {
                await updateDoc(doc(db, "users", user.uid, "caregiverNotes", editingId), {
                    title: title,
                    text: textValue,
                    category: category,
                    priority: priority,
                    noteDate: noteDate,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await addDoc(notesCollection(), {
                    title: title,
                    text: textValue,
                    category: category,
                    priority: priority,
                    noteDate: noteDate,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            closeForm();
            await loadNotes();
        } catch (error) {
            console.error("Error saving caregiver note:", error);
            if (message) message.textContent = "Unable to save note.";
        }
    });
}

async function loadNotes() {
    const user = auth.currentUser;
    if (!user || !notesList) return;
    try {
        const snapshot = await getDocs(notesCollection());
        notes = [];
        snapshot.forEach(function(item) {
            notes.push({ id: item.id, ...item.data() });
        });
        notes.sort(function(a, b) {
            const dateA = new Date((a.noteDate || "") + "T00:00:00").getTime() || new Date(a.updatedAt || a.createdAt || 0).getTime();
            const dateB = new Date((b.noteDate || "") + "T00:00:00").getTime() || new Date(b.updatedAt || b.createdAt || 0).getTime();
            return dateB - dateA;
        });
        displayNotes();
    } catch (error) {
        console.error("Error loading caregiver notes:", error);
        notesList.innerHTML = "<p>Unable to load caregiver notes.</p>";
    }
}

function displayNotes() {
    if (!notesList) return;
    notesList.innerHTML = "";
    if (noteCount) noteCount.textContent = notes.length + (notes.length === 1 ? " note" : " notes");
    if (emptyNotes) emptyNotes.hidden = notes.length !== 0;
    notes.forEach(function(note) {
        const card = document.createElement("article");
        card.className = "note-card";
        const priorityClass = (note.priority || "Normal").toLowerCase();
        const displayDate = note.noteDate ? new Date(note.noteDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : formatDate(note.updatedAt || note.createdAt);
        card.innerHTML = `<div class="note-card-top"><div><span class="note-card-icon">📝</span><h3>${escapeHtml(note.title || "Untitled note")}</h3></div><span class="note-date">${escapeHtml(displayDate)}</span></div><div class="note-meta"><span class="note-category">${escapeHtml(note.category || "General")}</span><span class="note-priority ${escapeHtml(priorityClass)}">${escapeHtml(note.priority || "Normal")} Priority</span></div><p>${escapeHtml(note.text || "").replace(/\n/g, "<br>")}</p><div class="note-actions"><button class="edit-note" data-id="${note.id}">✏️ Edit</button><button class="delete-note" data-id="${note.id}">🗑️ Delete</button></div>`;
        notesList.appendChild(card);
    });
    document.querySelectorAll(".edit-note").forEach(function(button) {
        button.addEventListener("click", function() { editNote(button.dataset.id); });
    });
    document.querySelectorAll(".delete-note").forEach(function(button) {
        button.addEventListener("click", function() { deleteNote(button.dataset.id); });
    });
}

function editNote(id) {
    const note = notes.find(function(item) { return item.id === id; });
    if (!note || !form) return;
    if (titleInput) titleInput.value = note.title || "";
    if (textInput) textInput.value = note.text || "";
    if (categoryInput) categoryInput.value = note.category || "General";
    if (priorityInput) priorityInput.value = note.priority || "Normal";
    if (dateInput) dateInput.value = note.noteDate || getTodayDate();
    form.dataset.editingId = id;
    if (formTitle) formTitle.textContent = "Edit Caregiver Note";
    if (message) message.textContent = "";
    if (formCard) formCard.hidden = false;
    if (titleInput) titleInput.focus();
}

async function deleteNote(id) {
    if (!confirm("Are you sure you want to delete this caregiver note?")) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
        await deleteDoc(doc(db, "users", user.uid, "caregiverNotes", id));
        await loadNotes();
    } catch (error) {
        console.error("Error deleting caregiver note:", error);
        alert("Unable to delete note.");
    }
}

function closeForm() {
    if (!form) return;
    form.reset();
    delete form.dataset.editingId;
    if (formTitle) formTitle.textContent = "Add Caregiver Note";
    if (message) message.textContent = "";
    if (formCard) formCard.hidden = true;
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
