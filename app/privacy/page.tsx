import React from 'react'

export const metadata = {
  title: 'Privacy Policy - Gannamasti Cafe',
  description: 'Learn how Gannamasti Cafe handles and protects your personal information.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-cream pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-serif text-3xl md:text-4xl text-cocoa font-light mb-8">
          Privacy Policy
        </h1>
        
        <div className="font-sans text-sm text-cocoa-muted space-y-6 leading-relaxed">
          <p className="text-xs text-sage font-medium uppercase tracking-widest">
            Last Updated: June 2026
          </p>

          <p>
            At Gannamasti Cafe, accessible from gannamasticafe.in, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by Gannamasti Cafe and how we use it.
          </p>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">1. Information We Collect</h2>
            <p>
              When you visit or place an order at Gannamasti Cafe, we collect certain personal information to process your order and provide our services:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1.5">
              <li><strong>Personal Details:</strong> Name, phone number, and Google account email address.</li>
              <li><strong>Delivery Information:</strong> Physical delivery address and GPS coordinates (if pinned for delivery orders).</li>
              <li><strong>Order Details:</strong> Items purchased, quantity, total price, and transaction timestamps.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">2. How We Use Your Information</h2>
            <p>We use the information we collect in various ways, including to:</p>
            <ul className="list-disc list-inside pl-4 space-y-1.5">
              <li>Process, fulfill, and manage your food orders and deliveries.</li>
              <li>Verify payments securely through our payment gateway partner (Razorpay).</li>
              <li>Autofill your name, phone number, and address on checkout for a faster ordering experience.</li>
              <li>Send real-time alerts and notifications regarding your order status.</li>
              <li>Understand and analyze how you use our website to improve our menu and services.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">3. Payment & Data Security</h2>
            <p>
              All online payments are securely processed by <strong>Razorpay</strong>. We do not store your credit/debit card numbers, UPI PINs, or bank account credentials on our servers. Your connection to our site is fully encrypted with secure socket layer technology (SSL).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">4. Pricing and Catalog Disclaimer</h2>
            <p>
              Please note that all menu prices, item descriptions, and packaging fees displayed on our website are subject to change at any time without prior notice. The cafe reserves the right to modify prices and availability of items in real-time as market costs and kitchen prep availability dictate.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">5. Third-Party Sharing</h2>
            <p>
              We do not sell, trade, or transfer your personal data to outside parties. This does not include trusted third parties who assist us in operating our website, conducting our business, or delivering food to you (such as delivery staff and payment processors), as long as those parties agree to keep this information confidential.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">6. Contact Us</h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy, please reach out to us at:
            </p>
            <p className="bg-linen p-4 rounded-xl text-cocoa text-xs leading-normal">
              <strong>Gannamasti Cafe</strong><br />
              Opp. Tara Hotel, Shivaji Colony Chowk,<br />
              Jhajjar Rd, Kath Mandi, Rohtak, Haryana 124001<br />
              Phone: +91 77888 77818
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
