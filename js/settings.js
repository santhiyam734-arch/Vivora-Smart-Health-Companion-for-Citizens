import { auth, db } from "./firebase.js";
import { onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const preferenceKey = "vivoraSettings";
const profileNameKey = "vivoraProfileName";
const defaults = { medicineReminders: true, injectionReminders: true, appointmentReminders: true, textSize: "normal", voiceEnabled: true, speechLanguage: "en-IN" };
const byId = (id) => document.getElementById(id);
function loadPreferences() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(preferenceKey) || "{}") }; }
    catch { return { ...defaults }; }
}
let preferences = loadPreferences();
function savePreferences() { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); }
function applyTextSize(size) {
    document.body.classList.remove("text-large", "text-extra-large");
    if (size === "large") document.body.classList.add("text-large");
    if (size === "extra-large") document.body.classList.add("text-extra-large");
}
function renderPreferences() {
    ["medicineReminders", "injectionReminders", "appointmentReminders", "voiceEnabled"].forEach(id => { byId(id).checked = Boolean(preferences[id]); });
    byId("textSize").value = preferences.textSize;
    byId("speechLanguage").value = preferences.speechLanguage;
    applyTextSize(preferences.textSize);
    byId("textPreview").style.fontSize = preferences.textSize === "large" ? "19px" : preferences.textSize === "extra-large" ? "22px" : "16px";
}
["medicineReminders", "injectionReminders", "appointmentReminders", "voiceEnabled"].forEach(id => {
    byId(id).addEventListener("change", () => { preferences[id] = byId(id).checked; savePreferences(); });
});
byId("textSize").addEventListener("change", () => { preferences.textSize = byId("textSize").value; savePreferences(); applyTextSize(preferences.textSize); renderPreferences(); });
byId("speechLanguage").addEventListener("change", () => { preferences.speechLanguage = byId("speechLanguage").value; savePreferences(); });
renderPreferences();

onAuthStateChanged(auth, async user => {
    if (user) {
        let firestoreName = "";
        try {
            const profileSnapshot = await getDoc(doc(db, "users", user.uid));
            if (profileSnapshot.exists()) {
                const data = profileSnapshot.data();
                firestoreName = data.profile?.displayName || data.displayName || "";
            }
        } catch (error) {
            console.warn("Could not load profile from Firestore; using available profile data.", error);
        }
        const savedName = localStorage.getItem(profileNameKey);
        const name = firestoreName || savedName || user.displayName || (user.email ? user.email.split("@")[0] : "User");
        byId("displayName").value = name === (user.email ? user.email.split("@")[0] : "User") && !firestoreName && !savedName && !user.displayName ? "" : name;
        byId("accountEmail").value = user.email || "";
        byId("headerProfileName").textContent = name;
        byId("accountStatus").textContent = "Signed in";
        byId("accountDetails").textContent = user.email || "Your Vivora account is active.";
        if (firestoreName) localStorage.setItem(profileNameKey, firestoreName);
    } else {
        byId("displayName").value = localStorage.getItem(profileNameKey) || "";
        byId("accountEmail").value = "Not signed in";
        byId("headerProfileName").textContent = localStorage.getItem(profileNameKey) || "Guest";
        byId("accountStatus").textContent = "No active sign-in";
        byId("accountDetails").textContent = "Sign in from the welcome page to use your account.";
    }
});

byId("profileForm").addEventListener("submit", async event => {
    event.preventDefault();
    const user = auth.currentUser;
    const name = byId("displayName").value.trim();
    const message = byId("profileMessage");
    if (!user) { message.textContent = "Please sign in before saving your profile."; return; }
    if (!name) { message.textContent = "Please enter your name."; byId("displayName").focus(); return; }
    message.textContent = "Saving profile...";
    try {
        // Keep the local copy for immediate display, and persist the profile in Firestore for other devices.
        await setDoc(doc(db, "users", user.uid), {
            displayName: name,
            profile: { displayName: name, email: user.email || "" },
            email: user.email || "",
            profileUpdatedAt: serverTimestamp()
        }, { merge: true });
        try {
            await updateProfile(user, { displayName: name });
        } catch (error) {
            console.warn("Firestore profile saved, but Firebase Auth display name could not be updated.", error);
        }
        localStorage.setItem(profileNameKey, name);
        byId("headerProfileName").textContent = name;
        message.textContent = "Profile saved successfully to your account.";
    } catch (error) {
        console.error("Could not save profile to Firestore:", error);
        // Keep the previous working local save as a fallback, but clearly tell the user.
        try {
            localStorage.setItem(profileNameKey, name);
            byId("headerProfileName").textContent = name;
        } catch (_) {}
        message.textContent = "Could not save to your account. Check Firestore rules and your connection, then try again.";
    }
});

async function handleSignOut(event) {
    event.preventDefault();
    try { await signOut(auth); window.location.href = "index.html"; }
    catch (error) { console.error("Sign out failed:", error); byId("signOutMessage").textContent = "Unable to sign out right now. Please try again."; }
}
byId("signOutButton").addEventListener("click", handleSignOut);
byId("sidebarLogout").addEventListener("click", handleSignOut);

// Match the shared mobile sidebar behaviour without requiring another library.
const menuButton = document.querySelector(".mobile-menu");
if (menuButton) menuButton.addEventListener("click", () => document.querySelector(".sidebar")?.classList.toggle("settings-sidebar-open"));
