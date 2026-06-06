import { Router } from 'express';
import * as configController from '../controllers/configController';
import * as spaceController from '../controllers/spaceController';
import * as recordController from '../controllers/recordController';
import * as reservationController from '../controllers/reservationController';
import * as memberController from '../controllers/memberController';
import * as statsController from '../controllers/statsController';

const router = Router();

router.get('/config', configController.getConfig);
router.put('/config', configController.updateConfig);

router.get('/spaces', spaceController.getAllSpaces);
router.get('/spaces/floor/:floor', spaceController.getSpacesByFloor);
router.get('/spaces/stats', spaceController.getSpaceStats);
router.get('/spaces/available', spaceController.getAvailableSpaces);
router.put('/spaces/:id/type', spaceController.updateSpaceType);

router.post('/records/entry', recordController.entryVehicle);
router.post('/records/exit', recordController.exitVehicle);
router.post('/records/calculate-fee', recordController.calculateExitFee);
router.get('/records', recordController.getRecords);
router.get('/records/parking', recordController.getParkingCars);

router.post('/reservations', reservationController.createReservation);
router.get('/reservations', reservationController.getReservations);
router.put('/reservations/:id/cancel', reservationController.cancelReservation);
router.put('/reservations/:id/complete', reservationController.completeReservation);
router.post('/reservations/activate', reservationController.activateReservation);

router.post('/members', memberController.createMember);
router.get('/members', memberController.getMembers);
router.get('/members/prices', memberController.getMemberPriceList);
router.get('/members/expiring', memberController.getExpiringMembers);
router.get('/members/:id', memberController.getMemberById);
router.get('/members/:id/records', memberController.getMemberRecords);
router.put('/members/:id/renew', memberController.renewMember);

router.get('/stats/dashboard', statsController.getDashboard);
router.get('/stats/revenue-trend', statsController.getRevenueTrend);
router.get('/stats/payment-types', statsController.getPaymentTypeStats);
router.get('/stats/peak-hours', statsController.getPeakHours);
router.get('/stats/turnover', statsController.getSpaceTurnover);
router.get('/stats/records', statsController.getParkingRecords);

export default router;
