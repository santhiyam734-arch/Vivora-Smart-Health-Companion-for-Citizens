import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const OLD_UID = "DHb8kDBzm3TDdSALIVMwFQvkxlj1";
const CURRENT_UID = "GUMa82irSDUB6Y0C3yx0ypqDHSg2";
const COLLECTIONS = ["medicines", "injections", "appointments", "healthRecords", "caregiverNotes"];
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const migrateButton = document.getElementById("migrateButton");
const status = document.getElementById("status");

function setStatus(message) { status.textContent = message; }
function addStatus(message) { status.textContent += "\n" + message; }

loginButton.addEventListener("click", async function() {
    loginButton.disabled = true;
    migrateButton.disabled = true;
    setStatus("Signing in...");
    try {
        await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    } catch (error) {
        setStatus("Sign-in failed: " + error.message);
        loginButton.disabled = false;
    }
});

onAuthStateChanged(auth, function(user) {
    if (!user) {
        setStatus("Please sign in with the current Vivora account.");
        loginButton.disabled = false;
        migrateButton.disabled = true;
        return;
    }
    if (user.uid !== CURRENT_UID) {
        setStatus("Wrong account is logged in.\nLogged-in UID: " + user.uid + "\nExpected UID: " + CURRENT_UID);
        migrateButton.disabled = true;
        return;
    }
    setStatus("Correct current account detected: " + user.email + "\nReady to migrate.");
    loginButton.disabled = true;
    migrateButton.disabled = false;
});

migrateButton.addEventListener("click", async function() {
    migrateButton.disabled = true;
    loginButton.disabled = true;
    setStatus("Starting migration...");
    try {
        const user = auth.currentUser;
        if (!user || user.uid !== CURRENT_UID) throw new Error("The current Firebase account does not match the expected UID.");
        for (const collectionName of COLLECTIONS) {
            const sourceRef = collection(db, "users", OLD_UID, collectionName);
            const targetRef = collection(db, "users", CURRENT_UID, collectionName);
            const sourceSnapshot = await getDocs(sourceRef);
            let copied = 0;
            let skipped = 0;
            for (const sourceDoc of sourceSnapshot.docs) {
                const targetDocRef = doc(targetRef, sourceDoc.id);
                const targetDoc = await getDoc(targetDocRef);
                if (targetDoc.exists()) { skipped++; continue; }
                await setDoc(targetDocRef, sourceDoc.data());
                copied++;
            }
            addStatus(collectionName + ": found " + sourceSnapshot.size + ", copied " + copied + ", skipped " + skipped);
        }
        addStatus("\nMigration completed successfully.");
        addStatus("Now restore your normal Firestore security rules before using Vivora normally.");
    } catch (error) {
        addStatus("\nMigration failed: " + error.message);
        console.error(error);
        migrateButton.disabled = false;
    }
});
