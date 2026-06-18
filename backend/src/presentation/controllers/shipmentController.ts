import { Request, Response, NextFunction } from 'express';
import { ShipmentService } from '../../application/services/shipmentService';
import { ShipmentRepository } from '../../infrastructure/repositories/shipmentRepository';
import { ShipmentStatus } from '../../domain/models/shipment';
import { ValidationError } from '../../application/validator';
import { serializeShipment } from '../serializers/shipmentSerializer';
import { logger } from '../../infrastructure/logger';

function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'id' must be a valid integer");
  return id;
}

const shipmentService = new ShipmentService(new ShipmentRepository());

export async function listShipments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customerOrderId, supplierOrderId, status, page, pageSize } = req.query;
    const result = await shipmentService.listShipments({
      customerOrderId: customerOrderId ? parseInt(String(customerOrderId), 10) : undefined,
      supplierOrderId: supplierOrderId ? parseInt(String(supplierOrderId), 10) : undefined,
      status: status as ShipmentStatus | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
    });
    logger.info('Shipments listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Shipments retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getShipmentById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const shipment = await shipmentService.getShipmentById(id);
    res.json({ success: true, data: serializeShipment(shipment), message: 'Shipment retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createShipment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const shipment = await shipmentService.createShipment(req.body as Record<string, unknown>);
    logger.info('Shipment created', { shipmentId: shipment.id, customerOrderId: shipment.customerOrderId });
    res.status(201).json({ success: true, data: shipment, message: 'Shipment created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateShipmentStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const shipment = await shipmentService.updateShipmentStatus(id, req.body as Record<string, unknown>);
    logger.info('Shipment status updated', { shipmentId: shipment.id, status: shipment.status });
    res.json({ success: true, data: shipment, message: 'Shipment status updated successfully' });
  } catch (err) {
    next(err);
  }
}
