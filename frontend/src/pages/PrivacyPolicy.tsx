import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b-3 border-blue-500 pb-4">
            Privacy Policy for StillOnTime
          </h1>
          <p className="text-sm text-gray-600 mb-8">
            <strong>Last Updated:</strong> January 2025
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                StillOnTime ("we," "our," or "us") is a film schedule automation service that helps film industry 
                professionals manage their shooting schedules, calculate optimal routes, and receive weather forecasts. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">2.1 Information You Provide Directly</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li><strong>Account Information:</strong> Your name and email address when you create an account</li>
                <li><strong>Configuration Data:</strong> Home address, Panavision address, and notification preferences</li>
                <li><strong>Communication Preferences:</strong> SMS phone numbers, push notification tokens, and email preferences</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">2.2 Information We Collect Through Google OAuth</h3>
              <p className="text-gray-700 mb-2">When you authenticate with Google, we collect:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Profile Information:</strong> Your Google ID, email address, and display name</li>
                <li><strong>Access Tokens:</strong> Temporary authentication tokens to access your Google services</li>
                <li><strong>Gmail Data:</strong> We access your Gmail to monitor for film schedule emails and download PDF attachments</li>
                <li><strong>Google Calendar:</strong> We create and manage calendar events for your shooting schedule</li>
                <li><strong>Google Drive:</strong> We access PDF files attached to schedule emails</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Process and parse PDF shooting schedules automatically</li>
                <li>Calculate optimal routes between filming locations</li>
                <li>Create calendar events with call times and locations</li>
                <li>Send weather forecasts and important schedule updates</li>
                <li>Provide SMS, email, and push notifications</li>
                <li>Monitor Gmail for new schedule emails</li>
                <li>Improve our service performance and reliability</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Data Storage and Security</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-gray-800 mb-2">4.1 Data Storage</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>Your personal data is stored in secure PostgreSQL databases</li>
                    <li>PDF files and extracted schedule data are temporarily cached</li>
                    <li>Google API tokens are encrypted and stored securely</li>
                    <li>Route calculations and weather data are cached for performance</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-xl font-medium text-gray-800 mb-2">4.2 Security Measures</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>All data transmission uses HTTPS encryption</li>
                    <li>API keys and sensitive credentials are environment-protected</li>
                    <li>Regular security updates and monitoring</li>
                    <li>Limited access to production systems</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Third-Party Services</h2>
              <p className="text-gray-700 mb-4">We integrate with the following third-party services:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Google APIs:</strong> Gmail, Calendar, Drive, and Maps for core functionality</li>
                <li><strong>OpenWeatherMap:</strong> Weather forecasts and alerts</li>
                <li><strong>Twilio:</strong> SMS notification delivery</li>
                <li><strong>Push Notification Services:</strong> Browser and mobile push notifications</li>
              </ul>
              <p className="text-gray-700 mt-4">
                Each service has its own privacy policy. We encourage you to review their policies when using our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Your Rights and Choices</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct your information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                <li><strong>Opt-out:</strong> Disable notifications or data collection</li>
                <li><strong>Data Portability:</strong> Export your data in a standard format</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Data Retention</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Account data is retained while your account is active</li>
                <li>Schedule data is retained for historical reference (configurable)</li>
                <li>PDF files are automatically deleted after processing</li>
                <li>Cached route and weather data expires after 24 hours</li>
                <li>Deleted accounts are purged within 30 days</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. International Data Transfers</h2>
              <p className="text-gray-700">
                Your data may be processed and stored in countries outside your residence. We ensure appropriate 
                safeguards are in place to protect your personal information in accordance with applicable data 
                protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Children's Privacy</h2>
              <p className="text-gray-700">
                Our service is intended for film industry professionals and is not designed for children under 16. 
                We do not knowingly collect personal information from children under 16.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Changes to This Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time. We will notify you of any material changes 
                by posting the new Privacy Policy on this page and updating the "Last Updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Email:</strong> privacy@stillontime.app<br />
                  <strong>Subject:</strong> Privacy Policy Inquiry
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Legal Compliance</h2>
              <p className="text-gray-700 mb-4">This privacy policy complies with:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>GDPR:</strong> European General Data Protection Regulation</li>
                <li><strong>CCPA:</strong> California Consumer Privacy Act</li>
                <li><strong>Google API Services:</strong> User Data Policy requirements</li>
                <li><strong>OAuth 2.0:</strong> Authentication and authorization standards</li>
              </ul>
            </section>
          </div>

          <div className="mt-12 p-6 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Google OAuth Compliance Statement
            </h3>
            <p className="text-blue-800 text-sm">
              StillOnTime's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a 
                href="https://developers.google.com/terms/api-services-user-data-policy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
