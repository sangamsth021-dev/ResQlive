/**
 * Authority Workspace - Main Entry Point
 * React application for authority staff to manage reports, incidents, assignments, and notifications
 */

import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import App from './App';
import routes from './routes';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <RouterProvider router={routes} />
);