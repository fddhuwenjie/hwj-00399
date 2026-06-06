import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import AppLayout from '../components/Layout';
import Dashboard from '../pages/Dashboard';
import ParkingMap from '../pages/ParkingMap';
import VehicleManagement from '../pages/VehicleManagement';
import Reservation from '../pages/Reservation';
import MemberManagement from '../pages/MemberManagement';
import Statistics from '../pages/Statistics';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'parking-map', element: <ParkingMap /> },
      { path: 'vehicle', element: <VehicleManagement /> },
      { path: 'reservation', element: <Reservation /> },
      { path: 'members', element: <MemberManagement /> },
      { path: 'statistics', element: <Statistics /> }
    ]
  }
];

export default routes;
