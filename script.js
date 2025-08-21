// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth;
const GOAL_AMOUNT = 5000;

// Function to update the UI with current data
const updateUI = (currentAmount, totalDonations) => {
    const currentAmountEl = document.getElementById('current-amount');
    const goalAmountEl = document.getElementById('goal-amount');
    const progressBarEl = document.getElementById('progress-bar');
    const totalDonationsEl = document.getElementById('total-donations');
    
    currentAmountEl.textContent = `$${currentAmount.toLocaleString()}`;
    goalAmountEl.textContent = `goal of $${GOAL_AMOUNT.toLocaleString()}`;
    const progressPercentage = Math.min((currentAmount / GOAL_AMOUNT) * 100, 100);
    progressBarEl.style.width = `${progressPercentage}%`;
    totalDonationsEl.textContent = totalDonations;
};
    
// Wait for the window to load before starting
window.onload = async function() {
    if (!firebaseConfig) {
        console.error("Firebase config is not available.");
        document.getElementById('message-box').textContent = "Error: Firebase configuration is missing.";
        return;
    }

    // Initialize Firebase app and services
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Get references to DOM elements
    const donationAmountInput = document.getElementById('donation-amount');
    const donateButton = document.getElementById('donate-button');
    const messageBoxEl = document.getElementById('message-box');

    // Authentication state change listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userId = user.uid;
            document.getElementById('user-id').textContent = userId;

            // Now that we have a userId, we can set up the database listener and donation logic
            const userDocRef = doc(db, "artifacts", appId, "users", userId, "donation-data", "summary");

            // Set up a real-time listener for the document
            onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    updateUI(data.currentAmount || 0, data.totalDonations || 0);
                } else {
                    // Document doesn't exist, initialize with a loading state
                    updateUI(0, 0);
                    // Create the initial document if it's the first time
                    try {
                        setDoc(userDocRef, { currentAmount: 0, totalDonations: 0 });
                    } catch (e) {
                        console.error("Error creating initial document:", e);
                    }
                }
            }, (error) => {
                console.error("Error listening to document:", error);
                messageBoxEl.textContent = "Error: Could not load data.";
            });

            // Function to handle the donation
            const handleDonate = async () => {
                const donationAmount = parseFloat(donationAmountInput.value);

                if (isNaN(donationAmount) || donationAmount <= 0) {
                    messageBoxEl.textContent = 'Please enter a valid amount.';
                    return;
                }

                messageBoxEl.textContent = 'Donating...';
                
                try {
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        const currentData = docSnap.data();
                        const newAmount = (currentData.currentAmount || 0) + donationAmount;
                        const newDonations = (currentData.totalDonations || 0) + 1;
                        await setDoc(userDocRef, {
                            currentAmount: newAmount,
                            totalDonations: newDonations
                        });
                        messageBoxEl.textContent = `Thanks for your donation of $${donationAmount.toLocaleString()}!`;
                    } else {
                        await setDoc(userDocRef, {
                            currentAmount: donationAmount,
                            totalDonations: 1
                        });
                        messageBoxEl.textContent = `Thanks for your donation of $${donationAmount.toLocaleString()}!`;
                    }
                    
                    donationAmountInput.value = '';
                } catch (e) {
                    console.error("Error adding donation: ", e);
                    messageBoxEl.textContent = "Error: Donation failed. Please try again.";
                }
            };

            donateButton.addEventListener('click', handleDonate);
            donationAmountInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    handleDonate();
                }
            });
        } else {
            // Sign in with the custom token or anonymously if not available
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Firebase authentication failed:", error);
                messageBoxEl.textContent = "Error: Authentication failed. Data may not be saved.";
            }
        }
    });

    // Initial UI update for loading state
    updateUI(0, 0);
};
