import { Router } from 'express';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../presentation/controllers/productController';
import {
  listVariants,
  getVariantById,
  createVariant,
  updateVariant,
  deleteVariant,
} from '../../presentation/controllers/productVariantController';
import {
  listImages,
  addImage,
  updateImage,
  deleteImage,
} from '../../presentation/controllers/productImageController';

const variantRouter = Router({ mergeParams: true });
variantRouter.get('/', listVariants);
variantRouter.get('/:variantId', getVariantById);
variantRouter.post('/', createVariant);
variantRouter.patch('/:variantId', updateVariant);
variantRouter.delete('/:variantId', deleteVariant);

const imageRouter = Router({ mergeParams: true });
imageRouter.get('/', listImages);
imageRouter.post('/', addImage);
imageRouter.patch('/:imageId', updateImage);
imageRouter.delete('/:imageId', deleteImage);

const productRouter = Router();
productRouter.get('/', listProducts);
productRouter.post('/', createProduct);
productRouter.get('/:id', getProductById);
productRouter.patch('/:id', updateProduct);
productRouter.delete('/:id', deleteProduct);

productRouter.use('/:id/variants', variantRouter);
productRouter.use('/:id/images', imageRouter);

export default productRouter;
