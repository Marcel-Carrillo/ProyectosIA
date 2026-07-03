import { Router } from 'express';
import {
  listReviewsAdmin,
  updateReviewStatus,
  deleteReview,
} from '../../presentation/controllers/reviewAdminController';

const reviewRouter = Router();

reviewRouter.get('/', listReviewsAdmin);
reviewRouter.patch('/:id/status', updateReviewStatus);
reviewRouter.delete('/:id', deleteReview);

export default reviewRouter;
