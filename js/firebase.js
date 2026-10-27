import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBnZzUCuGRbV5Ea75zsNbbH1Jt8cv9DVOc",
    authDomain: "vivora-92a25.firebaseapp.com",
    projectId: "vivora-92a25",
    storageBucket: "vivora-92a25.firebasestorage.app",
    messagingSenderId: "98107543177",
    appId: "1:98107543177:web:4a44e774a4e8917f910058"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };