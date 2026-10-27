import { auth, db } from "./firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const startSpeech = document.getElementById("startSpeech");
const stopSpeech = document.getElementById("stopSpeech");
const clearSpeech = document.getElementById("clearSpeech");
const askGemini = document.getElementById("askGemini");
const transcript = document.getElementById("transcript");
const speechStatus = document.getElementById("speechStatus");
const speechMessage = document.getElementById("speechMessage");
const geminiStatus = document.getElementById("geminiStatus");
const geminiResponse = document.getElementById("geminiResponse");
const intentValue = document.getElementById("intentValue");
const summaryValue = document.getElementById("summaryValue");
const actionValue = document.getElementById("actionValue");
const dataValue = document.getElementById("dataValue");
const confirmationPanel = document.getElementById("confirmationPanel");
const confirmAnalysis = document.getElementById("confirmAnalysis");
const cancelAnalysis = document.getElementById("cancelAnalysis");
const confirmationMessage = document.getElementById("confirmationMessage");
const saveResult = document.getElementById("saveResult");
const openModule = document.getElementById("openModule");

let pendingAnalysis = null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let finalText = "";

if (askGemini) askGemini.disabled = true;
if (stopSpeech) stopSpeech.disabled = true;

const modulePages = {
    medicine: "medicines.html",
    appointment: "appointments.html",
    injection: "injections.html",
    health_record: "health-records.html"
};

function clearGeminiResult() {
    geminiStatus.textContent = "Waiting for transcript";
    geminiResponse.textContent = "Your Gemini analysis will appear here...";
    intentValue.textContent = "Not identified";
    summaryValue.textContent = "No analysis yet.";
    actionValue.textContent = "No action suggested yet.";
    dataValue.textContent = "No structured information yet.";
    saveResult.textContent = "";
    openModule.hidden = true;
    hideConfirmation();
}

function hideConfirmation() {
    pendingAnalysis = null;
    confirmationPanel.hidden = true;
    confirmationMessage.textContent = "";
    confirmAnalysis.disabled = false;
    cancelAnalysis.disabled = false;
}

function showConfirmation() {
    confirmationPanel.hidden = false;
    confirmationMessage.textContent = "Review the information above, then confirm or cancel.";
}

function formatIntent(intent) {
    const labels = {
        medicine: "Medicine reminder",
        appointment: "Doctor appointment",
        injection: "Injection schedule",
        health_record: "Health record",
        general: "General conversation"
    };
    return labels[intent] || "General conversation";
}

function formatData(data) {
    const labels = {
        medicineName: "Medicine",
        dosage: "Dosage",
        quantity: "Quantity",
        time: "Time",
        frequency: "Frequency",
        weeklyDay: "Weekly day",
        startDate: "Start date",
        endDate: "End date",
        doctor: "Doctor / provider",
        hospital: "Hospital / clinic",
        appointmentDate: "Appointment date",
        appointmentTime: "Appointment time",
        appointmentType: "Visit type",
        location: "Location",
        reason: "Reason",
        injectionName: "Injection",
        injectionDose: "Dose",
        injectionDate: "Injection date",
        injectionTime: "Injection time",
        injectionFrequency: "Frequency",
        recordType: "Record type",
        recordTitle: "Record title",
        recordDate: "Record date",
        description: "Description",
        notes: "Notes"
    };
    const lines = [];
    Object.keys(labels).forEach(function(key) {
        const value = data && data[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            lines.push(labels[key] + ": " + value);
        }
    });
    return lines.length ? lines.join("\n") : "No specific structured information was identified.";
}

function showAnalysis(analysis) {
    const safeAnalysis = analysis || {};
    intentValue.textContent = formatIntent(safeAnalysis.intent);
    summaryValue.textContent = safeAnalysis.summary || "No summary was returned.";
    actionValue.textContent = safeAnalysis.suggestedAction || "No action was suggested.";
    dataValue.textContent = formatData(safeAnalysis.data);
    geminiResponse.textContent = safeAnalysis.summary || "Analysis completed.";
    pendingAnalysis = safeAnalysis;

    if (["medicine", "appointment", "injection", "health_record"].includes(safeAnalysis.intent)) {
        showConfirmation();
    } else {
        confirmationPanel.hidden = true;
        confirmationMessage.textContent = "This conversation does not contain a Vivora record to save.";
    }
}

function cleanValue(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

function getMissingFields(analysis) {
    const data = analysis.data || {};
    const missing = [];

    if (analysis.intent === "medicine") {
        if (!cleanValue(data.medicineName)) missing.push("medicine name");
        if (!cleanValue(data.time)) missing.push("time");
        if (!cleanValue(data.frequency)) missing.push("frequency");
    }

    if (analysis.intent === "appointment") {
        if (!cleanValue(data.appointmentDate)) missing.push("appointment date");
        if (!cleanValue(data.appointmentTime)) missing.push("appointment time");
    }

    if (analysis.intent === "injection") {
        if (!cleanValue(data.injectionName)) missing.push("injection name");
        if (!cleanValue(data.injectionDate)) missing.push("injection date");
        if (!cleanValue(data.injectionTime)) missing.push("injection time");
        if (!cleanValue(data.injectionFrequency)) missing.push("injection frequency");
    }

    if (analysis.intent === "health_record") {
        if (!cleanValue(data.recordTitle)) missing.push("record title");
        if (!cleanValue(data.recordType)) missing.push("record type");
        if (!cleanValue(data.recordDate)) missing.push("record date");
    }

    return missing;
}

function normaliseMedicineFrequency(value) {
    const text = cleanValue(value).toLowerCase();
    if (text.includes("three") || text.includes("3 times")) return "Three times a day";
    if (text.includes("twice") || text.includes("2 times")) return "Twice a day";
    if (text.includes("weekly") || text.includes("every week")) return "Weekly";
    if (text.includes("prescribed")) return "As prescribed";
    if (text.includes("once") || text.includes("every day") || text.includes("daily") || text.includes("everyday")) return "Once a day";
    return value || "As prescribed";
}

function normaliseInjectionFrequency(value) {
    const text = cleanValue(value).toLowerCase();
    if (text.includes("2 months") || text.includes("every two months")) return "Every 2 months";
    if (text.includes("3 months") || text.includes("every three months")) return "Every 3 months";
    if (text.includes("6 months") || text.includes("every six months")) return "Every 6 months";
    if (text.includes("year")) return "Every year";
    if (text.includes("month")) return "Every month";
    return "Once";
}

function normaliseRecordType(value) {
    const text = cleanValue(value).toLowerCase();
    if (text.includes("prescription")) return "prescription";
    if (text.includes("scan")) return "scan";
    if (text.includes("lab") || text.includes("blood test") || text.includes("test report")) return "lab";
    return "notes";
}

async function saveConfirmedAnalysis(analysis) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Please login to save confirmed information to Vivora.");
    }

    const data = analysis.data || {};
    const now = new Date().toISOString();
    let collectionName = "";
    let record = {};
    let page = modulePages[analysis.intent];

    if (analysis.intent === "medicine") {
        collectionName = "medicines";
        record = {
            name: cleanValue(data.medicineName),
            dosage: cleanValue(data.dosage),
            quantity: Number(data.quantity) || 0,
            time: cleanValue(data.time),
            time1: cleanValue(data.time),
            time2: "",
            time3: "",
            frequency: normaliseMedicineFrequency(data.frequency),
            weeklyDay: cleanValue(data.weeklyDay),
            startDate: cleanValue(data.startDate),
            endDate: cleanValue(data.endDate),
            notes: cleanValue(data.notes),
            image: "",
            taken: false,
            source: "Gemini AI",
            confirmedAt: now,
            createdAt: now
        };
    } else if (analysis.intent === "appointment") {
        collectionName = "appointments";
        record = {
            doctor: cleanValue(data.doctor),
            hospital: cleanValue(data.hospital),
            date: cleanValue(data.appointmentDate),
            time: cleanValue(data.appointmentTime),
            type: cleanValue(data.appointmentType) || "Other",
            location: cleanValue(data.location),
            notes: [cleanValue(data.reason), cleanValue(data.notes)].filter(Boolean).join(" | "),
            source: "Gemini AI",
            confirmedAt: now,
            createdAt: now,
            updatedAt: now
        };
    } else if (analysis.intent === "injection") {
        collectionName = "injections";
        record = {
            name: cleanValue(data.injectionName),
            dose: cleanValue(data.injectionDose),
            date: cleanValue(data.injectionDate),
            time: cleanValue(data.injectionTime),
            frequency: normaliseInjectionFrequency(data.injectionFrequency),
            doctor: cleanValue(data.doctor),
            location: cleanValue(data.location),
            notes: cleanValue(data.notes),
            photo: "",
            status: "upcoming",
            source: "Gemini AI",
            confirmedAt: now,
            createdAt: now,
            updatedAt: now
        };
    } else if (analysis.intent === "health_record") {
        collectionName = "healthRecords";
        record = {
            name: cleanValue(data.recordTitle),
            type: normaliseRecordType(data.recordType),
            date: cleanValue(data.recordDate),
            doctor: cleanValue(data.doctor),
            hospital: cleanValue(data.hospital),
            description: cleanValue(data.description),
            fileName: "",
            fileData: "",
            source: "Gemini AI",
            confirmedAt: now,
            createdAt: now,
            updatedAt: now
        };
    } else {
        throw new Error("This conversation does not contain a saveable Vivora record.");
    }

    const saved = await addDoc(collection(db, "users", user.uid, collectionName), record);
    return { collectionName, id: saved.id, page };
}

if (!SpeechRecognition) {
    speechStatus.textContent = "Not supported";
    speechMessage.textContent = "Speech-to-Text is not supported in this browser. Please use Chrome.";
    startSpeech.disabled = true;
    stopSpeech.disabled = true;
    askGemini.disabled = true;
} else {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onstart = function() {
        speechStatus.textContent = "Listening...";
        startSpeech.disabled = true;
        stopSpeech.disabled = false;
        askGemini.disabled = true;
        speechMessage.textContent = "Speak clearly. Vivora is listening.";
    };

    recognition.onresult = function(event) {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalText += text + " ";
            else interimText += text;
        }
        const shownText = (finalText + interimText).trim();
        transcript.textContent = shownText || "Your speech will appear here...";
        askGemini.disabled = shownText.length === 0;
    };


recognition.onerror = function(event) {
    console.error("Vivora microphone error:", event.error, event);

    speechStatus.textContent = "Error";
    startSpeech.disabled = false;
    stopSpeech.disabled = true;

    const messages = {
        "not-allowed": "Microphone permission denied. Allow access in Chrome settings.",
        "service-not-allowed": "The browser has blocked speech recognition.",
        "audio-capture": "No microphone detected. Check your microphone connection.",
        "network": "Speech recognition network error. Check your internet connection.",
        "no-speech": "No speech detected. Please speak and try again.",
        "language-not-supported": "The selected speech language is unsupported.",
        "aborted": "Recognition stopped. Click Start Speaking to retry."
    };

    speechMessage.textContent =
        messages[event.error] ||
        "Speech recognition error: " + event.error;
};

    recognition.onend = function() {
        if (speechStatus.textContent !== "Error") speechStatus.textContent = "Ready";
        startSpeech.disabled = false;
        stopSpeech.disabled = true;
        askGemini.disabled = finalText.trim().length === 0;
    };

    startSpeech.addEventListener("click", function() {
        try { recognition.start(); }
        catch (error) { speechMessage.textContent = "Speech recognition is already running."; }
    });

    stopSpeech.addEventListener("click", function() {
        if (recognition) recognition.stop();
        speechStatus.textContent = "Stopped";
        startSpeech.disabled = false;
        stopSpeech.disabled = true;
        askGemini.disabled = finalText.trim().length === 0;
    });
}

clearSpeech.addEventListener("click", function() {
    finalText = "";
    transcript.textContent = "Your speech will appear here...";
    speechMessage.textContent = "";
    speechStatus.textContent = "Ready";
    clearGeminiResult();
    askGemini.disabled = true;
});

askGemini.addEventListener("click", async function() {
    const text = transcript.textContent.trim();
    if (!text || text === "Your speech will appear here...") {
        geminiStatus.textContent = "No transcript";
        geminiResponse.textContent = "Speak something first, then ask Gemini.";
        return;
    }

    askGemini.disabled = true;
    hideConfirmation();
    saveResult.textContent = "";
    openModule.hidden = true;
    geminiStatus.textContent = "Gemini is understanding...";
    geminiResponse.textContent = "Analyzing your transcript...";
    intentValue.textContent = "Analyzing...";
    summaryValue.textContent = "Analyzing...";
    actionValue.textContent = "Analyzing...";
    dataValue.textContent = "Analyzing...";

    try {
        const response = await fetch("http://localhost:3000/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: text })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.details || data.error || "Gemini request failed.");
        geminiStatus.textContent = "Analysis complete — confirmation required";
        showAnalysis(data.response);
    } catch (error) {
        geminiStatus.textContent = "Connection error";
        geminiResponse.textContent = "Gemini could not analyze the transcript. Make sure the backend server is running and try again.";
        intentValue.textContent = "Not available";
        summaryValue.textContent = error.message || "Gemini request failed.";
        actionValue.textContent = "No action suggested.";
        dataValue.textContent = "No structured information available.";
        hideConfirmation();
        console.error(error);
    } finally {
        askGemini.disabled = finalText.trim().length === 0;
    }
});

confirmAnalysis.addEventListener("click", async function() {
    if (!pendingAnalysis) {
        confirmationMessage.textContent = "There is no Gemini analysis waiting for confirmation.";
        return;
    }

    if (pendingAnalysis.intent === "general") {
        confirmationMessage.textContent = "There is no Vivora record to save for this conversation.";
        return;
    }

    const missing = getMissingFields(pendingAnalysis);
    if (missing.length) {
        confirmationMessage.textContent = "Confirmed, but not saved yet. Please provide: " + missing.join(", ") + ".";
        geminiStatus.textContent = "More information required";
        openModule.href = modulePages[pendingAnalysis.intent] || "dashboard.html";
        openModule.textContent = "Open Vivora module";
        openModule.hidden = false;
        return;
    }

    confirmAnalysis.disabled = true;
    cancelAnalysis.disabled = true;
    geminiStatus.textContent = "Saving confirmed information...";
    confirmationMessage.textContent = "Saving to the selected Vivora module...";

    try {
        const result = await saveConfirmedAnalysis(pendingAnalysis);
        const moduleNames = {
            medicines: "Medicines",
            appointments: "Appointments",
            injections: "Injections",
            healthRecords: "Health Records"
        };
        const moduleName = moduleNames[result.collectionName] || "Vivora module";
        geminiStatus.textContent = "Saved successfully";
        confirmationMessage.textContent = "Confirmed and saved to " + moduleName + ".";
        saveResult.textContent = "The confirmed information has been added to your Vivora " + moduleName + " module.";
        openModule.href = result.page;
        openModule.textContent = "Open " + moduleName;
        openModule.hidden = false;
    } catch (error) {
        confirmAnalysis.disabled = false;
        cancelAnalysis.disabled = false;
        geminiStatus.textContent = "Save failed";
        confirmationMessage.textContent = error.message || "The information could not be saved.";
        console.error("Vivora AI save error:", error);
    }
});

cancelAnalysis.addEventListener("click", function() {
    hideConfirmation();
    geminiStatus.textContent = "Analysis cancelled";
    saveResult.textContent = "";
    openModule.hidden = true;
});

clearGeminiResult();
