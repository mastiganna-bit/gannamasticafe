import React from 'react'

export const metadata = {
  title: 'Terms & Conditions - Gannamasti Cafe',
  description: 'Read the terms of service and usage conditions for Gannamasti Cafe.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-serif text-3xl md:text-4xl text-cocoa font-light mb-8">
          Terms & Conditions
        </h1>
        
        <div className="font-sans text-sm text-cocoa-muted space-y-6 leading-relaxed">
          <p className="text-xs text-sage font-medium uppercase tracking-widest">
            Last Updated: June 2026
          </p>

          <p>
            Welcome to Gannamasti Cafe! These terms and conditions outline the rules and regulations for the use of Gannamasti Cafe's Website, located at gannamasticafe.in.
          </p>

          <p>
            By accessing this website, we assume you accept these terms and conditions in full. Do not continue to use Gannamasti Cafe if you do not agree to take all of the terms and conditions stated on this page.
          </p>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">1. Account Registration and Session</h2>
            <p>
              To place orders on our platform, you are required to log in securely via your Google account. You are responsible for maintaining the confidentiality of your session. Orders placed under your account will be considered initiated by you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">2. Ordering & Pricing</h2>
            <p>
              All items on our menu are subject to availability. Prices for all products are subject to change at any time without prior notice or notification. While we strive to maintain accurate pricing, we reserve the right to modify, adjust, or correct prices, and refuse or cancel orders in case of technical issues or price tampering.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">3. Payment Terms</h2>
            <p>
              Payments for orders must be made online securely via our payment gateway (Razorpay) at checkout. Once a transaction is successfully completed, the order is forwarded to our kitchen. We accept UPI, Cards, NetBanking, and Wallet payments.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">4. License & Intellect</h2>
            <p>
              Unless otherwise stated, Gannamasti Cafe owns the intellectual property rights for all material on gannamasticafe.in. All intellectual property rights are reserved. You must not republish, sell, rent, or sub-license material from our website.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg text-cocoa">5. Jurisdiction</h2>
            <p>
              Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts of Rohtak, Haryana, India.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
