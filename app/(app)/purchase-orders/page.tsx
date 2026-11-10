import { PurchaseOrdersClient } from './purchase-orders-client'
import { ensureAccess } from '@/lib/access-server'
export default async function PurchaseOrdersPage() { await ensureAccess('purchaseOrders'); return <PurchaseOrdersClient /> }
