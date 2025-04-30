import { VAFormTemplate } from '../types';

export const VA5655Template: VAFormTemplate = {
  formNumber: '5655',
  formTitle: 'Financial Status Report',
  sections: [
    {
      title: 'Personal Information',
      fields: [
        {
          id: 'fullName',
          label: 'Full Name',
          type: 'text',
          value: '',
          required: true
        },
        {
          id: 'ssn',
          label: 'Social Security Number',
          type: 'text',
          value: '',
          required: true
        },
        {
          id: 'vaFileNumber',
          label: 'VA File Number',
          type: 'text',
          value: '',
          required: true
        }
      ]
    },
    {
      title: 'Income Information',
      fields: [
        {
          id: 'grossSalary',
          label: 'Gross Monthly Salary',
          type: 'text',
          value: '',
          required: true
        },
        {
          id: 'netTakeHome',
          label: 'Net Take-Home Pay',
          type: 'text',
          value: '',
          required: true
        },
        {
          id: 'otherIncome',
          label: 'Other Income',
          type: 'text',
          value: '',
          required: false
        }
      ]
    },
    {
      title: 'Expenses',
      fields: [
        {
          id: 'rentMortgage',
          label: 'Rent/Mortgage Payment',
          type: 'text',
          value: '',
          required: true
        },
        {
          id: 'foodUtilities',
          label: 'Food and Utilities',
          type: 'text',
          value: '',
          required: true
        },
        {
          id: 'otherExpenses',
          label: 'Other Living Expenses',
          type: 'text',
          value: '',
          required: false
        }
      ]
    }
  ],
  fieldExtractors: {
    fullName: {
      patterns: [
        '1\\s*\\.\\s*NAME[:\\s]+(.*?)(?=\\s*2\\.|$)',
        'Name[:\\s]+(.*?)(?=\\s|$)'
      ],
      preprocessor: (text: string) => text.trim(),
      validator: (value: string) => value.length > 2
    },
    ssn: {
      patterns: [
        'SOCIAL\\s+SECURITY\\s+NO\\.?[:\\s]+(\\d[\\d\\s-]*\\d)',
        'SSN[:\\s]+(\\d[\\d\\s-]*\\d)'
      ],
      preprocessor: (text: string) => text.replace(/[\s-]/g, ''),
      validator: (value: string) => /^\d{9}$/.test(value)
    },
    vaFileNumber: {
      patterns: [
        'VA\\s+FILE\\s+NUMBER[:\\s]+(\\d[\\d\\s-]*\\d)',
        'File\\s+No\\.?[:\\s]+(\\d[\\d\\s-]*\\d)'
      ],
      preprocessor: (text: string) => text.replace(/[\s-]/g, ''),
      validator: (value: string) => /^\d{8,9}$/.test(value)
    },
    grossSalary: {
      patterns: [
        'GROSS\\s+MONTHLY\\s+SALARY[:\\s]+\\$?(\\d[\\d,.]*\\d)',
        'Gross\\s+Salary[:\\s]+\\$?(\\d[\\d,.]*\\d)'
      ],
      preprocessor: (text: string) => text.replace(/[,$]/g, ''),
      validator: (value: string) => !isNaN(parseFloat(value))
    },
    netTakeHome: {
      patterns: [
        'NET\\s+TAKE-HOME\\s+PAY[:\\s]+\\$?(\\d[\\d,.]*\\d)',
        'Take-Home\\s+Pay[:\\s]+\\$?(\\d[\\d,.]*\\d)'
      ],
      preprocessor: (text: string) => text.replace(/[,$]/g, ''),
      validator: (value: string) => !isNaN(parseFloat(value))
    },
    otherIncome: {
      patterns: [
        'OTHER\\s+INCOME[:\\s]+\\$?(\\d[\\d,.]*\\d)',
        'Additional\\s+Income[:\\s]+\\$?(\\d[\\d,.]*\\d)'
      ],
      preprocessor: (text: string) => text.replace(/[,$]/g, ''),
      validator: (value: string) => !isNaN(parseFloat(value))
    },
    rentMortgage: {
      patterns: [
        'RENT/MORTGAGE[:\\s]+\\$?(\\d[\\d,.]*\\d)',
        'Housing\\s+Payment[:\\s]+\\$?(\\d[\\d,.]*\\d)'
      ],
      preprocessor: (text: string) => text.replace(/[,$]/g, ''),
      validator: (value: string) => !isNaN(parseFloat(value))
    },
    foodUtilities: {
      patterns: [
        'FOOD/UTILITIES[:\\s]+\\$?(\\d[\\d,.]*\\d)',
        'Food\\s+and\\s+Utilities[:\\s]+\\$?(\\d[\\d,.]*\\d)'
      ],
      preprocessor: (text: string) => text.replace(/[,$]/g, ''),
      validator: (value: string) => !isNaN(parseFloat(value))
    },
    otherExpenses: {
      patterns: [
        'OTHER\\s+EXPENSES[:\\s]+\\$?(\\d[\\d,.]*\\d)',
        'Additional\\s+Expenses[:\\s]+\\$?(\\d[\\d,.]*\\d)'
      ],
      preprocessor: (text: string) => text.replace(/[,$]/g, ''),
      validator: (value: string) => !isNaN(parseFloat(value))
    }
  }
}; 