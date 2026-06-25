# Session Context: shipment-management (KAN-22)

## Change artifacts
- Proposal: openspec/changes/shipment-management/proposal.md
- Design: openspec/changes/shipment-management/design.md
- Specs: openspec/changes/shipment-management/specs/shipment-management/spec.md
- Tasks: openspec/changes/shipment-management/tasks.md

## Branch
feature/KAN-22-shipment-management (already created, currently on this branch)

## Pattern to mirror
The refund feature (KAN-20) is the closest pattern. Key files:
- Domain model: backend/src/domain/models/refund.ts
- Domain repo interface: backend/src/domain/repositories/refundRepository.ts
- Infra repo: backend/src/infrastructure/repositories/refundRepository.ts
- Service: backend/src/application/services/refundService.ts
- Controller: backend/src/presentation/controllers/refundController.ts
- Routes: backend/src/routes/admin/refundRoutes.ts
- Mounted in: backend/src/index.ts line 59: adminRouter.use('/refunds', refundAdminRoutes)

## Key findings from Prisma schema (backend/prisma/schema.prisma)
- Shipment model does NOT exist in schema yet — must add it
- CustomerOrder model exists (lines 122-151) — needs `shipments Shipment[]` back-relation
- SupplierOrder model exists (lines 174-197) — needs `shipments Shipment[]` back-relation
- Refund model (lines 219-236) is the pattern for Shipment model

## Backend: what to add to prisma/schema.prisma
```prisma
model Shipment {
  id              Int            @id @default(autoincrement())
  customerOrderId Int
  customerOrder   CustomerOrder  @relation(fields: [customerOrderId], references: [id])
  supplierOrderId Int?
  supplierOrder   SupplierOrder? @relation(fields: [supplierOrderId], references: [id])
  carrier         String?        @db.VarChar(100)
  trackingNumber  String?        @db.VarChar(100)
  trackingUrl     String?        @db.VarChar(500)
  status          String         @default("Pending")
  shippedAt       DateTime?
  deliveredAt     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([customerOrderId])
  @@index([supplierOrderId])
  @@index([status])
  @@index([createdAt])
}
```
Also add to CustomerOrder: `shipments Shipment[]`
Also add to SupplierOrder: `shipments Shipment[]`

## State machine
```
Pending    → Shipped | Failed | Returned
Shipped    → InTransit | Delivered | Failed | Returned
InTransit  → Delivered | Failed | Returned
Terminal: Delivered, Failed, Returned (no further transitions)
```
shippedAt auto-set on transition to Shipped
deliveredAt auto-set on transition to Delivered

## Error codes (backend)
- SHIPMENT_NOT_FOUND (404)
- CUSTOMER_ORDER_NOT_FOUND (404)
- SUPPLIER_ORDER_NOT_FOUND (404)
- SHIPMENT_STATUS_TRANSITION_INVALID (400)
- VALIDATION_ERROR (400)

## Validator fields
- validateShipmentCreateData: customerOrderId (required, positive int), supplierOrderId (optional, positive int), carrier (optional, ≤100 chars), trackingNumber (optional, ≤100 chars), trackingUrl (optional, ≤500 chars)
- validateShipmentStatusUpdate: status (required, must be valid ShipmentStatus)

## Routes to mount (backend/src/index.ts)
Add: `import shipmentAdminRoutes from './routes/admin/shipmentRoutes';`
Add: `adminRouter.use('/shipments', shipmentAdminRoutes);` (after refunds line)

## Frontend stubs to replace
- frontend/src/services/shipmentService.ts (stub with throw 'Not implemented')
- frontend/src/pages/ShipmentsPage.tsx (stub with "Coming soon")
- New file: frontend/src/pages/ShipmentDetailPage.tsx

## Frontend service base URL
`${API_BASE_URL}/api/admin/shipments`
Mirror pattern from: frontend/src/services/supplierOrderService.ts
