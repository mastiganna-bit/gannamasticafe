import React from 'react'

export const metadata = {
  title: 'Refund & Cancellation Policy - Gannamasti Cafe',
  description: 'Understand the cancellation windows and refund policies of Gannamasti Cafe.',
}

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-cream pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-serif text-3xl md:text-4xl text-cocoa font-light mb-8">
          Refund & Cancellation Policy
        </h1>
        
        <div className="font-sans text-sm text-cocoa-muted space-y-6 leading-relaxed">
          <p className="text-xs text-sage font-medium uppercase tracking-widest">
            Last Updated: June 2026
          </p>

          <p>
            At Gannamasti Cafe, we aim to provide you with delicious, fresh food and juices. Since we deal in freshly prepared food items, we have established the following guidelines regarding refunds and cancellations:
          </p>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">1. Order Cancellation</h2>
            <p>
              Once an order is paid and sent to our kitchen (`status: paid` or `preparing`), it enters preparation immediately to ensure freshness. Because of this, **orders cannot be cancelled or modified once they have started preparation.**
            </p>
            <p>
              In case of any emergencies, please contact our counter support line at **+91 77888 77818** immediately after placing the order to check if preparation has commenced.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">2. Refund Eligibility</h2>
            <p>You are eligible for a refund or food replacement under the following conditions:</p>
            <ul className="list-disc list-inside pl-4 space-y-1.5">
              <li>If the order is cancelled by the restaurant due to item unavailability or technical issues.</li>
              <li>If you receive an incorrect item that does not match your digital receipt.</li>
              <li>If there is a verified quality issue with your order (subject to outlet manager verification).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">3. Non-Refundable Scenarios</h2>
            <p>Refunds will not be issued in the following scenarios:</p>
            <ul className="list-disc list-inside pl-4 space-y-1.5">
              <li>Providing an incorrect delivery address or contact phone number, leading to failed delivery.</li>
              <li>Refusing to accept the delivery or pickup order upon arrival.</li>
              <li>Requesting cancellation after the food has already been prepared.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">4. Refund Processing Time</h2>
            <p>
              Approved refunds will be processed back to your original payment method (UPI, Debit/Credit Card, NetBanking) through our payment gateway (Razorpay). 
            </p>
            <p>
              Once initiated, refunds typically take **5 to 7 working days** to reflect in your bank account, depending on your bank's processing cycles.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
