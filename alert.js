// document.addEventListener("DOMContentLoaded", () => {

//     function getEmails() {
//         const container = document.getElementById("alertemails");
//         const emailSpans = container.querySelectorAll(".email span");
//         const emails = Array.from(emailSpans).map(span => span.textContent.trim());

//         console.log("Extracted emails:", emails); // print extracted emails
//         return emails;
//     }

//     async function sendAlert() {
//         const emails = getEmails();
//         const successful = [];

//         for (const email of emails) {
//             const payload = {
//                 to_email: email,                // EmailJS template variable
//                 subject: "Emergency Alert",
//                 message: "This is an emergency alert message!"
//             };

//             try {
//                 await emailjs.send(
//                     "service_pg5zt06",
//                     "template_0hs89m6",
//                     payload
//                 );
//                 successful.push(email); // store successful sends
//             } catch (err) {
//                 console.error(`❌ Failed to send to ${email}:`, err);
//             }
//         }

//         if (successful.length > 0) {
//             console.log(`✅ Sent alert to: ${successful.join(", ")}`);
//         } else {
//             console.log("⚠️ No emails were successfully sent.");
//         }
//     }

//     // Attach to button with id "alertbtn"
//     const alertButton = document.getElementById("alertbtn");
//     if (alertButton) {
//         alertButton.addEventListener("click", sendAlert);
//     }

//     // Optional: print emails on page load
//     getEmails();

// });



document.addEventListener("DOMContentLoaded", () => {

    // REPLACE THIS WITH YOUR NEW GOOGLE APPS SCRIPT WEB APP URL
    const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzFb7kWO8IcRq2RDnq7VMNOasOREoNQXHy5dSMWGOGYyP6k0pxz0D2n22EaWPkBa-tE/exec"; 

    function getEmails() {
        const container = document.getElementById("alertemails");
        const emailSpans = container.querySelectorAll(".email span");
        const emails = Array.from(emailSpans).map(span => span.textContent.trim());

        console.log("Extracted emails:", emails);
        return emails;
    }

    function sendAlert() {
        const emails = getEmails();
        const alertButton = document.getElementById("alertbtn");
        
        if (emails.length === 0) {
            alert("No emails found to send alerts to.");
            return;
        }

        // Visual feedback
        const originalText = alertButton.innerText;
        alertButton.innerText = "Sending...";
        alertButton.disabled = true;

        // Prepare data for Google Apps Script
        const payload = {
            action: "manual_alert",
            emails: emails,
            message: "Manual Test Alert Triggered"
        };

        // Send to Google Apps Script using fetch with 'no-cors' is often problematic for reading responses
        // strictly, but standard POST works if GAS returns JSON correctly.
        fetch(APPS_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Success:", data);
            alert(`Alerts sent successfully to: ${data.sentTo.join(", ")}`);
        })
        .catch(error => {
            console.error("Error:", error);
            alert("Error sending alerts. Check console for details.");
        })
        .finally(() => {
            // Reset button
            alertButton.innerText = originalText;
            alertButton.disabled = false;
        });
    }

    // Attach to button with id "alertbtn"
    const alertButton = document.getElementById("alertbtn");
    if (alertButton) {
        alertButton.addEventListener("click", sendAlert);
    }

    // Optional: print emails on page load
    getEmails();
});