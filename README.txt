VIVORA - GEMINI UNDERSTANDING STAGE

This ZIP contains complete replacement files for the next Vivora AI stage.

Files:
- server.js
- speech.html
- js/speech.js
- css/speech.css

What this stage does:
1. Speech-to-Text creates the transcript.
2. Gemini analyzes the transcript.
3. Gemini identifies one Vivora intent:
   medicine, appointment, injection, health_record, or general.
4. Gemini extracts only information clearly stated by the user.
5. Vivora displays the summary, suggested action, and structured information.
6. Nothing is automatically saved to Firestore.

Before replacing files:
- Keep the current RajaCare project as a backup.
- Keep the existing .env file unchanged. Do not put the API key into these files.
- Keep the existing package.json and node_modules unchanged.

After replacement:
- Stop any old server using port 3000 if it is still running.
- From the RajaCare folder run: node server.js
- Confirm the server shows the backend URL and apiKeyConfigured: true.
- Open speech.html and test with a simple medicine or appointment sentence.
