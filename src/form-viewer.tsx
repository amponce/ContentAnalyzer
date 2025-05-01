import React from 'react';
import ReactDOM from 'react-dom/client';
import { FormViewer } from '@/components/form-viewer';
import '@/styles/globals.css';

// Mount the component when the document is loaded
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <FormViewer />
  </React.StrictMode>
); 