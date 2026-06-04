import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { EmployeeService } from './src/services/employee.service.js';
import { MicrosoftGraphService } from './src/services/microsoftGraph.service.js';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || '';

async function run() {
  if (!mongoURI) {
    console.error('No MONGODB_URI found in process.env');
    process.exit(1);
  }
  await mongoose.connect(mongoURI);
  console.log('Connected to DB');

  const employeeId = '6a2151b90c6c45a872c7490b';
  const orgId = '6a1ed6b76cd721e1f9d4e96c';

  try {
    // 1. Get live available licenses
    const licenseInfo = await MicrosoftGraphService.getAvailableLicenses(orgId);
    console.log('Available Licenses:', licenseInfo.licenses);

    const selectedLicenses = licenseInfo.licenses.length > 0 
      ? [licenseInfo.licenses[0].skuId] 
      : [];
    
    console.log('Selected License SKU ID:', selectedLicenses);

    // Generate unique UPN for the test
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const uniqueUPN = `susee.r_test${randomId}@ethicsecur.co.in`;
    console.log('Using unique UPN:', uniqueUPN);

    // 2. Call conversion
    const result = await EmployeeService.convertToFullTime(
      employeeId,
      {
        userPrincipalName: uniqueUPN,
        displayName: 'susee r',
        givenName: 'susee',
        surname: 'r',
        tempPassword: 'EthicSec@2026!',
        selectedLicenses: selectedLicenses,
        salary: 25000,
      },
      orgId,
      'HR-System'
    );
    console.log('Success:', result);
  } catch (error: any) {
    console.error('Error Stack:', error.stack || error.message || error);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
