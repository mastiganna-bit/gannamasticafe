import React from 'react'

export const metadata = {
  title: 'Shipping & Delivery Policy - Gannamasti Cafe',
  description: 'View self-pickup timings and home delivery policies for Gannamasti Cafe.',
}

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-cream pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-serif text-3xl md:text-4xl text-cocoa font-light mb-8">
          Shipping & Delivery Policy
        </h1>
        
        <div className="font-sans text-sm text-cocoa-muted space-y-6 leading-relaxed">
          <p className="text-xs text-sage font-medium uppercase tracking-widest">
            Last Updated: June 2026
          </p>

          <p>
            Gannamasti Cafe provides both self-pickup and home delivery options for all our customers in Rohtak, Haryana. Please review our shipping and delivery rules below:
          </p>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">1. Self-Pickup Option</h2>
            <p>
              When choosing self-pickup, your order is prepared at our main outlet. 
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1.5">
              <li><strong>Pickup Location:</strong> Opp. Tara Hotel, Shivaji Colony Chowk, Jhajjar Rd, Kath Mandi, Rohtak, Haryana 124001.</li>
              <li><strong>Timings:</strong> Available daily from 10:00 AM to 10:00 PM.</li>
              <li><strong>Discount:</strong> Self-pickup orders qualify for an automatic 10% discount on select non-sugarcane items as a thank-you!</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">2. Home Delivery Option</h2>
            <p>
              We offer doorstep delivery within Rohtak city limits:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1.5">
              <li><strong>Delivery Boundaries:</strong> We deliver within a radius of 5-7 km from our physical outlet. If your location is outside our boundary, you will be notified at checkout.</li>
              <li><strong>Delivery Timings:</strong> Daily from 10:00 AM to 10:00 PM.</li>
              <li><strong>Timelines:</strong> Orders are typically prepared and delivered within **30 to 45 minutes** from payment confirmation. Timings may vary slightly due to peak hours, weather conditions, or traffic.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">3. Shipping Charges</h2>
            <p>
              Delivery charges are dynamically added to your order based on subtotal:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1.5">
              <li><strong>Orders under ₹299:</strong> A delivery fee of ₹50 is applied.</li>
              <li><strong>Orders of ₹300 and above:</strong> Delivery is completely FREE.</li>
              <li><strong>Sugarcane Packaging Fee:</strong> A flat packaging charge of ₹5 per sugarcane item is applied to preserve quality and freshness.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">4. Delivery Tracking</h2>
            <p>
              Once your payment is successful, you can track the status of your order in real-time on your **Account Dashboard** (`/account`). You will receive real-time notifications on the dashboard when your order status transitions from `paid` to `preparing` to `completed` (ready/out for delivery).
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
