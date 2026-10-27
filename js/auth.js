import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginMessage = document.getElementById("loginMessage");
const signupMessage = document.getElementById("signupMessage");

if (signupForm) signupForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            createdAt: new Date().toISOString()
        });

        signupMessage.textContent = "Account created successfully!";
        signupForm.reset();

    } catch (error) {
        signupMessage.textContent = error.message;
    }
});

if (loginForm) loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        loginMessage.textContent = "Login successful!";
        window.location.href = "dashboard.html";

        console.log("Logged in user:", userCredential.user.uid);

    } catch (error) {
        loginMessage.textContent = error.message;
    }
});