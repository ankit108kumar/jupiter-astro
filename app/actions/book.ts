"use server";

export async function submitBooking(formData: FormData) {
  // 1. HoneyPot Trap: If 'website' is filled, it's a bot.
  if (formData.get("website")) return { error: "Spam detected" }; 

  const name = formData.get("name") as string;
  const service = formData.get("service") as string;

  // 2. Build the JSON Payload for Google Apps Script
  const data = {
    name,
    phone: formData.get("phone"),
    dob: formData.get("dob"),
    tob: formData.get("tob"),
    pob: formData.get("pob"),
    country: formData.get("country"),
    service,
    problem: formData.get("problem"),
    key: process.env.SUBMISSION_SECRET // Appended securely on the server
  };

  try {
    const response = await fetch(process.env.GOOGLE_SCRIPT_URL!, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "text/plain" }, // Standard for Apps Script JSON parsing
    });

    if (!response.ok) {
      console.error("Google Script returned status:", response.status);
      return { error: "Failed to connect to the database." };
    }

    // Successfully sent to Google Sheets
    return { success: true };

  } catch (error) {
    console.error("Server Action Fetch Error:", error);
    return { error: "Network error while submitting." };
  }
}