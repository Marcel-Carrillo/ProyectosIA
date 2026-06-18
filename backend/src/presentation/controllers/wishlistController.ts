import { Response, NextFunction } from 'express';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';
import { wishlistService } from '../../application/services/wishlistCouponService';

export async function listWishlist(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await wishlistService.list(req.customer!.accountId);
    res.json({ success: true, data: { items }, message: 'Wishlist retrieved' });
  } catch (err) {
    next(err);
  }
}

export async function addWishlistItem(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { productVariantId } = req.body as { productVariantId?: number };
    if (!productVariantId) {
      res.status(400).json({ success: false, error: { message: 'productVariantId required', code: 'VALIDATION_ERROR' } });
      return;
    }
    const existing = await wishlistService.list(req.customer!.accountId);
    const already = existing.find((i) => i.productVariantId === productVariantId);
    const item = await wishlistService.add(req.customer!.accountId, productVariantId);
    res.status(already ? 200 : 201).json({
      success: true,
      data: item,
      message: already ? 'Item already on wishlist' : 'Item added to wishlist',
    });
  } catch (err) {
    next(err);
  }
}

export async function removeWishlistItem(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const productVariantId = parseInt(req.params.productVariantId as string, 10);
    await wishlistService.remove(req.customer!.accountId, productVariantId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
