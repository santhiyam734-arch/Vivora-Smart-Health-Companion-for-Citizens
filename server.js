import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash"
];

app.use(cors());
app.use(express.json({ limit: "20mb" }));

if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not configured. Add it to your .env file.");
}

app.get("/api/health", function(req, res) {
    res.json({
        status: "Gemini backend is running",
        apiKeyConfigured: Boolean(GEMINI_API_KEY)
    });
});

function createPrompt(transcript) {
    const today = new Date().toISOString().slice(0, 10);
    return `You are the AI understanding assistant inside Vivora, a smart health companion for senior citizens.

Today\'s date is ${today}. Analyze the user\'s speech transcript and identify whether it contains information that could be used by a Vivora module.
Do NOT diagnose medical conditions. Do NOT invent facts. Do NOT create or claim to have completed any action.
Resolve relative dates such as today, tomorrow, Monday, next Monday, or next month using today\'s date when the meaning is clear. Return dates in YYYY-MM-DD format.
Resolve times such as 8 PM into 24-hour HH:MM format.

Choose exactly one intent from: medicine, appointment, injection, health_record, general.

Medicine fields: medicineName, dosage, quantity, time, frequency, weeklyDay, startDate, endDate, notes.
Appointment fields: doctor, hospital, appointmentDate, appointmentTime, appointmentType, location, reason, notes.
Injection fields: injectionName, injectionDose, injectionDate, injectionTime, injectionFrequency, doctor, location, notes.
Health record fields: recordType, recordTitle, recordDate, doctor, hospital, description, notes.

For recordType use exactly one of: lab, prescription, scan, notes. For appointmentType use a natural category such as General Check-up, Follow-up, Specialist Visit, Test / Scan, Vaccination, or Other. For medicine frequency use values compatible with Vivora when possible: Once a day, Twice a day, Three times a day, Weekly, As prescribed. For injection frequency use: Once, Every month, Every 2 months, Every 3 months, Every 6 months, Every year.
Use an empty string when information is not clearly stated. Never invent dosage, quantity, doctor, hospital, or other missing details.

Return ONLY valid JSON with this exact structure:
{
  "intent": "medicine | appointment | injection | health_record | general",
  "summary": "short plain-language summary",
  "suggestedAction": "short description of what Vivora could prepare after confirmation",
  "data": {
    "medicineName": "", "dosage": "", "quantity": "", "time": "", "frequency": "", "weeklyDay": "", "startDate": "", "endDate": "",
    "doctor": "", "hospital": "", "appointmentDate": "", "appointmentTime": "", "appointmentType": "", "location": "", "reason": "",
    "injectionName": "", "injectionDose": "", "injectionDate": "", "injectionTime": "", "injectionFrequency": "",
    "recordType": "", "recordTitle": "", "recordDate": "", "description": "", "notes": ""
  }
}

Speech transcript:
${transcript}`;
}
async function requestGemini(model, prompt) {
    const googleResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: "POST",
            headers: {
                "x-goog-api-key": GEMINI_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        }
    );

    const data = await googleResponse.json();

    return {
        ok: googleResponse.ok,
        status: googleResponse.status,
        data: data
    };
}

app.post("/api/transcribe", async function(req, res) {
    const audio = String(req.body?.audio || "").trim();
    const mimeType = String(req.body?.mimeType || "audio/webm");

    if (!audio) {
        return res.status(400).json({
            error: "No recorded audio was received."
        });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({
            error: "Gemini API key is not configured."
        });
    }

    if (audio.length > 16 * 1024 * 1024) {
        return res.status(413).json({
            error: "Recording too large. Please record a shorter sentence."
        });
    }

    const prompt =
        "Transcribe the spoken audio into plain text. " +
        "Return only the words spoken. Do not summarize or add commentary.";

    let lastError = "";

    for (const model of GEMINI_MODELS) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                45000
            );

            let googleResponse;

            try {
                googleResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                    {
                        method: "POST",
                        signal: controller.signal,
                        headers: {
                            "x-goog-api-key": GEMINI_API_KEY,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: prompt },
                                    {
                                        inline_data: {
                                            mime_type: mimeType,
                                            data: audio
                                        }
                                    }
                                ]
                            }]
                        })
                    }
                );
            } finally {
                clearTimeout(timeout);
            }

            const data = await googleResponse.json();

            if (!googleResponse.ok) {
                lastError =
                    data?.error?.message ||
                    `Gemini returned HTTP ${googleResponse.status}`;

                console.error(
                    `Transcription error (${model}):`,
                    lastError
                );

                if (
                    [429, 500, 502, 503, 504].includes(
                        googleResponse.status
                    )
                ) {
                    continue;
                }

                return res.status(googleResponse.status).json({
                    error: "Audio transcription failed.",
                    details: lastError
                });
            }

            const transcript = data?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

            if (transcript) {
                return res.json({ transcript, model });
            }

            lastError = "Gemini returned an empty transcript.";
        } catch (error) {
            lastError = error.name === "AbortError"
                ? "Gemini transcription timed out."
                : error.message;

            console.error("Transcription request error:", lastError);
        }
    }

    return res.status(502).json({
        error: "Could not transcribe the recording.",
        details: lastError
    });
});

app.post("/api/gemini", async function(req, res) {
    const transcript = String(req.body?.transcript || "").trim();

    if (!transcript) {
        return res.status(400).json({
            error: "Transcript is empty."
        });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({
            error: "Gemini API key is not configured on the server."
        });
    }

    const prompt = createPrompt(transcript);
    let lastError = null;

    for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const model = GEMINI_MODELS[i];

        try {
            const result = await requestGemini(model, prompt);
            const data = result.data;

            if (!result.ok) {
                console.error(`Gemini API status (${model}):`, result.status);
                console.error(`Gemini API error (${model}):`, JSON.stringify(data, null, 2));

                lastError = {
                    status: result.status,
                    message: data?.error?.message || "Unknown Gemini API error."
                };

                const temporaryError = result.status === 429 || result.status === 500 || result.status === 502 || result.status === 503 || result.status === 504;

                if (temporaryError && i < GEMINI_MODELS.length - 1) {
                    console.log(`Trying fallback Gemini model: ${GEMINI_MODELS[i + 1]}`);
                    continue;
                }

                return res.status(result.status).json({
                    error: "Gemini API request failed.",
                    details: lastError.message
                });
            }

            const responseText = data?.candidates?.[0]?.content?.parts
                ?.map(function(part) {
                    return part.text || "";
                })
                .join("")
                .trim();

            if (!responseText) {
                lastError = {
                    status: 500,
                    message: "Gemini returned an empty response."
                };

                if (i < GEMINI_MODELS.length - 1) {
                    console.log(`Empty response. Trying fallback Gemini model: ${GEMINI_MODELS[i + 1]}`);
                    continue;
                }

                return res.status(500).json({
                    error: lastError.message
                });
            }

            let analysis;

            try {
                analysis = JSON.parse(responseText);
            } catch (parseError) {
                console.error(`Gemini JSON parse error (${model}):`, parseError);
                console.error("Gemini raw response:", responseText);
                lastError = {
                    status: 500,
                    message: "Gemini returned an invalid structured response."
                };

                if (i < GEMINI_MODELS.length - 1) {
                    console.log(`Invalid JSON. Trying fallback Gemini model: ${GEMINI_MODELS[i + 1]}`);
                    continue;
                }

                return res.status(500).json({
                    error: lastError.message
                });
            }

            const allowedIntents = [
                "medicine",
                "appointment",
                "injection",
                "health_record",
                "general"
            ];

            if (!allowedIntents.includes(analysis.intent)) {
                analysis.intent = "general";
            }

            if (!analysis.data || typeof analysis.data !== "object") {
                analysis.data = {};
            }

            console.log(`Gemini response received using model: ${model}`);

            return res.json({
                response: analysis,
                transcript: transcript,
                model: model
            });
        } catch (error) {
            console.error(`Gemini request error (${model}):`, error?.message || error);
            lastError = {
                status: 500,
                message: error?.message || "Unknown server error."
            };

            if (i < GEMINI_MODELS.length - 1) {
                console.log(`Request error. Trying fallback Gemini model: ${GEMINI_MODELS[i + 1]}`);
                continue;
            }
        }
    }

    return res.status(lastError?.status || 500).json({
        error: "Could not contact Gemini.",
        details: lastError?.message || "Unknown server error."
    });
});

const server = app.listen(PORT, function() {
    console.log(`Vivora Gemini backend running at http://localhost:${PORT}`);
    console.log(`Gemini API key configured: ${Boolean(GEMINI_API_KEY)}`);
    console.log(`Gemini fallback models enabled: ${GEMINI_MODELS.join(", ")}`);
});

server.on("error", function(error) {
    console.error("Server error:", error);
});

process.on("uncaughtException", function(error) {
    console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", function(error) {
    console.error("Unhandled rejection:", error);
});

process.stdin.resume();
