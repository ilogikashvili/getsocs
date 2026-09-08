import axios from '../api/axios';
import type { ApiEnvelope, PaginatedEnvelope, Product, ProductResponse, TransactionResponse } from '../types/api';

export type ProductQuery = Record<string, string | number | boolean | undefined>;

export async function getProducts(params: ProductQuery = {}) {
  return axios.get<PaginatedEnvelope<Product>>('/products', { params });
}
export async function getMyProducts() { return axios.get<ApiEnvelope<Product[]>>('/products/mine'); }
export async function getProduct(productId: string) { return axios.get<ProductResponse>(`/products/${productId}`); }
export async function createProduct(data: FormData) { return axios.post<ProductResponse>('/products', data); }
export async function pendingProducts() { return axios.get<ApiEnvelope<Product[]>>('/products/pending'); }
export async function approveProduct(productId: string, code: string) { return axios.post<ProductResponse>(`/products/${productId}/approve`, { code }); }
export async function deleteProduct(productId: string) { return axios.delete<ApiEnvelope>(`/products/${productId}`); }
export async function commentProduct(productId: string, text: string) { return axios.post<ApiEnvelope>(`/products/${productId}/comment`, { text }); }
export async function editComment(productId: string, commentId: string, text: string) { return axios.put<ApiEnvelope>(`/products/${productId}/comment/${commentId}`, { text }); }
export async function deleteComment(productId: string, commentId: string) { return axios.delete<ApiEnvelope>(`/products/${productId}/comment/${commentId}`); }
export async function buyProduct(productId: string, paymentMethod?: string) {
  return axios.post<TransactionResponse>(
    `/transactions/products/${productId}/buy`,
    paymentMethod ? { paymentMethod } : {}
  );
}
export async function lookupYoutubeChannel(url: string, verificationCode: string) { return axios.get<ApiEnvelope>('/products/youtube-lookup', { params: { url, verificationCode } }); }
export async function lookupChannel(platform: string, url: string, verificationCode: string) { return axios.get<ApiEnvelope>('/products/channel-lookup', { params: { platform, url, verificationCode } }); }
export async function claimProduct(productId: string) { return axios.post<ApiEnvelope>(`/products/${productId}/claim`); }
export async function submitProductClaim(productId: string) { return axios.post<ApiEnvelope>(`/products/${productId}/claim/submit`); }
export async function listProductClaims() { return axios.get<ApiEnvelope<unknown[]>>('/products/claims/pending'); }
export async function resolveProductClaim(productId: string, code: string, approve: boolean) { return axios.post<ApiEnvelope>(`/products/${productId}/claim/resolve`, { code, approve }); }

export type ProductList = Product[];
