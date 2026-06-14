"use server";
import { redirect } from 'next/navigation';

export async function submitBooking(formData: FormData) {
  // 1. HoneyPot Trap: If 'website' is filled, it's a bot.
  if (formData.get("website")) return; 

  const data = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    dob: formData.get("dob"),
    tob: formData.get("tob"),
    pob: formData.get("pob"),
    country: formData.get("country"),
    service: formData.get("service"),
    problem: formData.get("problem"),
    key: process.env.SUBMISSION_SECRET // Secret is handled on server
  };

  await fetch(process.env.GOOGLE_SCRIPT_URL!, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });

  redirect("https://wa.me/919876543210?text=Hi!%20I%20have%20booked%20a%20consultation.");
}