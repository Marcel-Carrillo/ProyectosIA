import axios from 'axios';
import { FulfillmentAlertQueryParams, FulfillmentAlertListResponse } from '../types/fulfillmentAlert';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/fulfillment-automation/alerts`;

export const fulfillmentAlertService = {
  list: async (params?: FulfillmentAlertQueryParams): Promise<FulfillmentAlertListResponse> => {
    const response = await axios.get<FulfillmentAlertListResponse>(ADMIN_BASE, { params });
    return response.data;
  },
};
