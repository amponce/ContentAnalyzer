import { VAFormField } from './types';

// Common personal information fields
export const PERSONAL_INFO_FIELDS: VAFormField[] = [
  {
    id: 'firstName',
    label: 'First Name',
    type: 'text',
    value: '',
    required: true
  },
  {
    id: 'middleName',
    label: 'Middle Name',
    type: 'text',
    value: '',
    required: false
  },
  {
    id: 'lastName',
    label: 'Last Name',
    type: 'text',
    value: '',
    required: true
  },
  {
    id: 'suffix',
    label: 'Suffix',
    type: 'select',
    value: '',
    required: false,
    options: ['Jr.', 'Sr.', 'II', 'III', 'IV']
  },
  {
    id: 'ssn',
    label: 'Social Security Number',
    type: 'text',
    value: '',
    required: true
  },
  {
    id: 'dateOfBirth',
    label: 'Date of Birth',
    type: 'date',
    value: '',
    required: true
  },
  {
    id: 'gender',
    label: 'Gender',
    type: 'select',
    value: '',
    required: true,
    options: ['Male', 'Female', 'Non-binary', 'Prefer not to say']
  }
];

// Service information fields
export const SERVICE_INFO_FIELDS: VAFormField[] = [
  {
    id: 'serviceNumber',
    label: 'Service Number',
    type: 'text',
    value: '',
    required: false
  },
  {
    id: 'branchOfService',
    label: 'Branch of Service',
    type: 'select',
    value: '',
    required: true,
    options: ['Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force']
  },
  {
    id: 'entryDate',
    label: 'Entry Date',
    type: 'date',
    value: '',
    required: true
  },
  {
    id: 'releaseDate',
    label: 'Release Date',
    type: 'date',
    value: '',
    required: true
  },
  {
    id: 'dischargeType',
    label: 'Type of Discharge',
    type: 'select',
    value: '',
    required: true,
    options: ['Honorable', 'General', 'Other than Honorable', 'Bad Conduct', 'Dishonorable']
  }
];

// Contact information fields
export const CONTACT_INFO_FIELDS: VAFormField[] = [
  {
    id: 'phone',
    label: 'Phone Number',
    type: 'text',
    value: '',
    required: true
  },
  {
    id: 'email',
    label: 'Email Address',
    type: 'text',
    value: '',
    required: false
  },
  {
    id: 'streetAddress',
    label: 'Street Address',
    type: 'text',
    value: '',
    required: true
  },
  {
    id: 'city',
    label: 'City',
    type: 'text',
    value: '',
    required: true
  },
  {
    id: 'state',
    label: 'State',
    type: 'select',
    value: '',
    required: true,
    options: [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    ]
  },
  {
    id: 'zipCode',
    label: 'ZIP Code',
    type: 'text',
    value: '',
    required: true
  }
];

// Medical information fields
export const MEDICAL_INFO_FIELDS: VAFormField[] = [
  {
    id: 'disability',
    label: 'Type of Disability',
    type: 'text',
    value: '',
    required: true
  },
  {
    id: 'dateOfDisability',
    label: 'Date Disability Began',
    type: 'date',
    value: '',
    required: true
  },
  {
    id: 'treatmentFacility',
    label: 'Treatment Facility',
    type: 'text',
    value: '',
    required: false
  },
  {
    id: 'currentTreatment',
    label: 'Currently Receiving Treatment',
    type: 'checkbox',
    value: '',
    required: true
  },
  {
    id: 'serviceConnected',
    label: 'Service Connected',
    type: 'checkbox',
    value: '',
    required: true
  }
];

// Dependent information fields
export const DEPENDENT_INFO_FIELDS: VAFormField[] = [
  {
    id: 'maritalStatus',
    label: 'Marital Status',
    type: 'select',
    value: '',
    required: true,
    options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated']
  },
  {
    id: 'spouseName',
    label: 'Spouse Name',
    type: 'text',
    value: '',
    required: false
  },
  {
    id: 'spouseSSN',
    label: 'Spouse SSN',
    type: 'text',
    value: '',
    required: false
  },
  {
    id: 'numberOfDependents',
    label: 'Number of Dependents',
    type: 'text',
    value: '',
    required: true
  }
];

// Employment information fields
export const EMPLOYMENT_INFO_FIELDS: VAFormField[] = [
  {
    id: 'currentlyEmployed',
    label: 'Currently Employed',
    type: 'checkbox',
    value: '',
    required: true
  },
  {
    id: 'employer',
    label: 'Current Employer',
    type: 'text',
    value: '',
    required: false
  },
  {
    id: 'monthlyIncome',
    label: 'Monthly Income',
    type: 'text',
    value: '',
    required: false
  },
  {
    id: 'lastEmploymentDate',
    label: 'Last Date of Employment',
    type: 'date',
    value: '',
    required: false
  }
];

// Declaration and signature fields
export const DECLARATION_FIELDS: VAFormField[] = [
  {
    id: 'privacyAgreement',
    label: 'Privacy Agreement Acceptance',
    type: 'checkbox',
    value: '',
    required: true
  },
  {
    id: 'signature',
    label: 'Digital Signature',
    type: 'text',
    value: '',
    required: true
  },
  {
    id: 'signatureDate',
    label: 'Signature Date',
    type: 'date',
    value: '',
    required: true
  }
]; 