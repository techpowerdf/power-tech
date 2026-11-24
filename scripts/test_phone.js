const { cleanPhoneNumber } = require('../server/whatsappDesktopService');

const testCases = [
  'undefined',
  '',
  null,
  '(61) 3226-6883 / (61) 3327-1723',
  '61 99999-8888',
  '61999998888',
  '99999-8888',
  '999998888',
  '+55 (11) 98888-7777',
  '011 98888-7777',
  '5511988887777',
  '(11) 98888-7777 / (11) 97777-6666',
  '11 9 8888 7777'
];

testCases.forEach(tc => {
  console.log(`Input: "${tc}" => Cleaned: "${cleanPhoneNumber(tc)}"`);
});
