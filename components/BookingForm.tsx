"use client";

import { useFormStatus } from "react-dom";
import { submitBooking } from "@/app/actions/book";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full py-4 rounded-full font-medium text-white transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(194,110,77,0.4)] ${
        pending 
          ? "bg-orange-400 cursor-not-allowed" 
          : "bg-orange-700 hover:bg-orange-600 transform hover:-translate-y-0.5"
      }`}
    >
      {pending ? "Connecting..." : "Request Consultation & Join WhatsApp"}
    </button>
  );
}

export default function BookingForm() {
  return (
    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 w-full">
      <div className="mb-8 text-center">
        <h3 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Book Your Session</h3>
        <p className="text-gray-500 font-light text-sm">Fill out your details to begin your cosmic journey.</p>
      </div>

      <form action={submitBooking} className="space-y-6">
        <div className="space-y-5">
          {/* Name Field */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-gray-700 pl-1">Full Name</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              required
              placeholder="Arjun Sharma"
              className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-700/20 focus:border-orange-700 transition-all text-gray-900"
            />
          </div>

          {/* Phone Field */}
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-gray-700 pl-1">WhatsApp Number</label>
            <input 
              type="tel" 
              id="phone" 
              name="phone" 
              required
              placeholder="+91 98765 43210"
              className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-700/20 focus:border-orange-700 transition-all text-gray-900"
            />
          </div>

          {/* Date of Birth Field */}
          <div className="space-y-1.5">
            <label htmlFor="dob" className="text-sm font-medium text-gray-700 pl-1">Date of Birth</label>
            <input 
              type="date" 
              id="dob" 
              name="dob" 
              required
              className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-700/20 focus:border-orange-700 transition-all text-gray-900"
            />
          </div>

          {/* Service Selection - Slick Custom Dropdown */}
          <div className="space-y-1.5">
            <label htmlFor="service" className="text-sm font-medium text-gray-700 pl-1">Service Needed</label>
            <div className="relative">
              <select 
                id="service" 
                name="service" 
                required
                defaultValue=""
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-700/20 focus:border-orange-700 transition-all text-gray-900 appearance-none cursor-pointer"
              >
                <option value="" disabled>Select a service...</option>
                <option value="Birth Chart">Birth Chart Analysis</option>
                <option value="Career">Career & Finances</option>
                <option value="Matchmaking">Marriage & Matchmaking</option>
                <option value="Varshphal">Varshphal (Yearly)</option>
                <option value="Other">Other / General Consultation</option>
              </select>
              {/* Custom SVG Chevron pointing downwards */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <SubmitButton />
        </div>
        
        <p className="text-xs text-center text-gray-400 font-light mt-4">
          By submitting, you will be redirected to our exclusive WhatsApp community.
        </p>
      </form>
    </div>
  );
}