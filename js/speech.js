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


const modulePages = {
    medicine: "medicines.html",
    medicines: "medicines.html",
    appointment: "appointments.html",
    appointments: "appointments.html",
    injection: "injections.html",
    injections: "injections.html",
    healthRecord: "health-records.html",
    healthRecords: "health-records.html"
};

function getMissingFields(analysis) {
    const info = analysis.extractedInformation || analysis.data || {};
    const intent = String(analysis.intent || "").toLowerCase();

    const requiredFields = {
        medicine: ["medicineName", "dosage", "time", "frequency"],
        medicines: ["medicineName", "dosage", "time", "frequency"],
        appointment: ["title", "date", "time"],
        appointments: ["title", "date", "time"],
        injection: ["name", "date"],
        injections: ["name", "date"],
        healthRecord: ["title", "date"],
        healthRecords: ["title", "date"]
    };

    const fields = requiredFields[intent];

    if (!fields) {
        return ["a supported record type"];
    }

    return fields
        .filter(field => {
            const value = info[field];
            return value === undefined || value === null ||
                   String(value).trim() === "";
        })
        .map(field => field);
}


async function saveConfirmedAnalysis(analysis) {
    const user = auth.currentUser;

    if (!user) {
        throw new Error("Please log in before saving your record.");
    }

    const intent = String(analysis.intent || "").toLowerCase();
    const info = analysis.extractedInformation || analysis.data || {};

    if (intent !== "medicine" && intent !== "medicines") {
        throw new Error(
            "This fix currently supports medicine records only."
        );
    }

    const medicineName = info.medicineName || info.name || "";
    const dosage = info.dosage || "";
    const time = info.time || info.time1 || "";
    const frequency = info.frequency || "Once a day";

    // Convert 10:00 AM or 10 AM into the time format used by the form.
    function to24HourTime(value) {
        if (!value) return "";

        const text = String(value).trim();
        const match = text.match(
            /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i
        );

        if (!match) return text;

        let hours = Number(match[1]);
        const minutes = match[2] || "00";
        const period = (match[3] || "").toUpperCase();

        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;

        return String(hours).padStart(2, "0") + ":" + minutes;
    }

    const medicineTime = to24HourTime(time);

    const today = new Date();
    const todayString =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    const medicineRecord = {
        name: medicineName,
        dosage: dosage,
        quantity: Number(info.quantity) || 0,
        time: medicineTime,
        time1: medicineTime,
        time2: "",
        time3: "",
        frequency: frequency,
        weeklyDay: info.weeklyDay || "",
        startDate: info.startDate || todayString,
        endDate: info.endDate || "",
        notes: info.notes || "Added using Vivora Speech-to-Text",
        image: "",
        taken: false
    };

    const docRef = await addDoc(
        collection(db, "users", user.uid, "medicines"),
        medicineRecord
    );

    return {
        collectionName: "medicines",
        page: "medicines.html",
        id: docRef.id
    };
}


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


let finalText = "";
let mediaRecorder = null;
let audioChunks = [];
let microphoneStream = null;

if (askGemini) askGemini.disabled = true;
if (stopSpeech) stopSpeech.disabled = true;

startSpeech.addEventListener("click", async function() {
    try {
        audioChunks = [];
        finalText = "";

        transcript.textContent = "Listening...";
        speechStatus.textContent = "Starting microphone...";
        speechMessage.textContent = "";

        askGemini.disabled = true;
        startSpeech.disabled = true;
        stopSpeech.disabled = false;

        microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        mediaRecorder = new MediaRecorder(microphoneStream);

        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async function() {
            speechStatus.textContent = "Transcribing...";
            speechMessage.textContent = "Converting your voice to text...";

            try {
                const audioBlob = new Blob(audioChunks, {
                    type: mediaRecorder.mimeType || "audio/webm"
                });

                const reader = new FileReader();

                const base64Audio = await new Promise((resolve, reject) => {
                    reader.onloadend = function() {
                        const result = reader.result;
                        resolve(result.split(",")[1]);
                    };

                    reader.onerror = reject;
                    reader.readAsDataURL(audioBlob);
                });

                const response = await fetch(
                    "http://localhost:3000/api/transcribe",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            audio: base64Audio,
                            mimeType: audioBlob.type || "audio/webm"
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.details || data.error || "Transcription failed."
                    );
                }

                const spokenText =
                    data.transcript ||
                    data.text ||
                    data.response?.transcript ||
                    (typeof data.response === "string" ? data.response : "");

                if (!spokenText) {
                    throw new Error(
                        "No text was returned. Please record your voice again."
                    );
                }

                finalText = spokenText.trim();
                transcript.textContent = finalText;
                speechStatus.textContent = "Completed";
                speechMessage.textContent = "Your speech has been converted to text.";
                askGemini.disabled = false;

            } catch (error) {
                console.error("Vivora transcription error:", error);
                speechStatus.textContent = "Error";
                speechMessage.textContent =
                    error.message || "Could not convert your speech to text.";
                transcript.textContent = "Your speech will appear here...";
                askGemini.disabled = true;

            } finally {
                if (microphoneStream) {
                    microphoneStream.getTracks().forEach(track => track.stop());
                    microphoneStream = null;
                }

                startSpeech.disabled = false;
                stopSpeech.disabled = true;
            }
        };

        mediaRecorder.start();
        speechStatus.textContent = "Listening...";
        speechMessage.textContent = "Speak clearly. Click Stop Speaking when finished.";

    } catch (error) {
        console.error("Vivora microphone error:", error);

        speechStatus.textContent = "Error";
        speechMessage.textContent =
            "Could not access the microphone. Allow microphone permission and try again.";

        if (microphoneStream) {
            microphoneStream.getTracks().forEach(track => track.stop());
            microphoneStream = null;
        }

        startSpeech.disabled = false;
        stopSpeech.disabled = true;
    }
});

stopSpeech.addEventListener("click", function() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        stopSpeech.disabled = true;
        speechStatus.textContent = "Processing audio...";
        mediaRecorder.stop();
    }
});

clearSpeech.addEventListener("click", function() {
    finalText = "";
    transcript.textContent = "Your speech will appear here...";
    speechMessage.textContent = "";
    speechStatus.textContent = "Ready";
    clearGeminiResult();
    askGemini.disabled = true;
});
function showAnalysis(response) {
    let analysis = response;

    if (typeof analysis === "string") {
        try {
            analysis = JSON.parse(analysis);
        } catch {
            geminiResponse.textContent = analysis;
            intentValue.textContent = "Not available";
            summaryValue.textContent = analysis;
            actionValue.textContent = "No action suggested.";
            dataValue.textContent = "No structured information available.";
            return;
        }
    }

    if (!analysis || typeof analysis !== "object") {
        throw new Error("Invalid Gemini response.");
    }

    pendingAnalysis = analysis;

    confirmationPanel.hidden = false;
confirmationMessage.textContent =
    "Please review the details and confirm to save.";
confirmAnalysis.disabled = false;
cancelAnalysis.disabled = false;

    geminiResponse.textContent =
        analysis.response || analysis.message || "Analysis completed.";

    intentValue.textContent = analysis.intent || "Not available";
    summaryValue.textContent = analysis.summary || "No summary available.";
    actionValue.textContent = analysis.suggestedAction ||
        analysis.action || "No action suggested.";

    dataValue.textContent = analysis.extractedInformation
        ? JSON.stringify(analysis.extractedInformation, null, 2)
        : analysis.data
        ? JSON.stringify(analysis.data, null, 2)
        : "No structured information available.";
     
}
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
