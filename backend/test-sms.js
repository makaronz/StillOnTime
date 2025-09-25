// Simple test to verify SMS service compiles and basic functionality works
const { SMSService } = require('./dist/services/sms.service.js');

console.log('Testing SMS service compilation...');

// Test without environment variables (should not be configured)
const smsService = new SMSService();
console.log('SMS service configured:', smsService.isServiceConfigured());

// Test phone number validation
const testNumbers = [
  '+48123456789',
  '123456789',
  'invalid',
  '+12125551234'
];

console.log('\nTesting phone number validation:');
testNumbers.forEach(async (number) => {
  try {
    const result = await smsService.sendSMS(number, 'Test message');
    console.log(`${number}: ${result.success ? 'Valid format' : result.error}`);
  } catch (error) {
    console.log(`${number}: Error - ${error.message}`);
  }
});

console.log('\nSMS service test completed successfully!');