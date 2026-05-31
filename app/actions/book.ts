"use server";

import { redirect } from "next/navigation";

export async function submitBooking(formData: FormData) {
  // 1. Extract data from the native form
  const data = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    dob: formData.get("dob"),
    service: formData.get("service"),
    timestamp: new Date().toISOString(),
  };

  // 2. Push to Google Sheets
  // The easiest way to do this without complex OAuth is to use a Google Apps Script Web App webhook, 
  // or a tool like SheetDB/Stein. 
  const SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

  if (SHEET_WEBHOOK_URL) {
    try {
      await fetch(SHEET_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Failed to save to Google Sheets:", error);
      // You might want to handle this gracefully in production
    }
  }

  // 3. Redirect the user directly to your WhatsApp Group/Chat
  // The execution stops here and pushes the user to the provided URL
  redirect("https://chat.whatsapp.com/YOUR_INVITE_LINK_HERE");
}