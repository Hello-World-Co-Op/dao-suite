/**
 * AppLayout - Wrapper layout for all authenticated pages.
 * Renders PageHeader at the top and an Outlet for child route content.
 */
import { Outlet } from 'react-router-dom';
import { PageHeader } from './PageHeader';

export function AppLayout() {
  return (
    <>
      <PageHeader />
      <Outlet />
    </>
  );
}
