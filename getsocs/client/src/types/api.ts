export type UserRole = 'user' | 'escrow' | 'admin' | string;
export type ProductStatus = 'pending' | 'approved' | 'reserved' | 'sold' | 'rejected' | string;
export type TransactionStatus = 'pending' | 'escrow_active' | 'completed' | 'refunded' | 'cancelled' | string;

export interface User {
  id: string;
  username: string;
  email?: string;
  name?: string;
  lastname?: string;
  role: UserRole;
  profilePhoto?: string | null;
  backgroundPhoto?: string | null;
  profileAvatar?: string | null;
  description?: string;
  verified?: boolean;
  idVerified?: boolean;
  buyerVerified?: boolean;
  tokenVersion?: number;
  pointsBought?: number;
  pointsSold?: number;
  fullName?: string;
  hideProfile?: boolean;
  idVerificationStatus?: string | null;
  usernameChangedAt?: string | null;
  nameChangedAt?: string | null;
  lastnameChangedAt?: string | null;
}

export interface ProductComment {
  id: string;
  productId?: string;
  userId?: string;
  username?: string;
  text: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  sellerId?: string;
  sellerName?: string;
  status?: ProductStatus;
  hidden?: boolean;
  images?: string[];
  platform?: string;
  topic?: string;
  followers?: number;
  avgViews?: number;
  monetized?: boolean;
  verified?: boolean;
  income?: number;
  monthlyIncome?: number;
  reservedBy?: string;
  reservedTransactionId?: string;
  reservedAt?: string;
  soldTo?: string;
  soldTransactionId?: string;
  soldAt?: string;
  comments?: ProductComment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  productId?: string;
  listingId?: string;
  productTitle?: string;
  listingTitle?: string;
  productPrice?: number;
  listingPrice?: number;
  serviceFee?: number;
  totalPrice?: number;
  paymentMethod?: string;
  buyerId: string;
  buyerName?: string;
  sellerId: string;
  sellerName?: string;
  escrowId?: string;
  escrowName?: string | null;
  status: TransactionStatus;
  stage?: string;
  createdAt?: string;
  completedAt?: string;
  refundedAt?: string;
}

export interface Badge {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  earned?: boolean;
  earnedAt?: string;
}

export interface Membership {
  id: string;
  name: string;
  price: number;
  description?: string;
  benefits?: string[];
  platformFeeReduction?: number;
}

export interface AddOn {
  id: string;
  name: string;
  price?: number;
  description?: string;
}

export interface Escrow {
  id?: string;
  transactionId: string;
  status: string;
  startedAt?: string;
  endsAt?: string;
  timeRemaining?: number | null;
  timeFormattedDDHHMMSS?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp?: string;
  isSystemMessage?: boolean;
}

export interface Chat {
  id: string;
  txId?: string;
  participants?: string[];
  messages?: ChatMessage[];
  createdAt?: string;
}

export interface Review {
  id: string;
  targetId: string;
  authorId?: string;
  rating: number;
  text?: string;
  type?: string;
  transactionId?: string | null;
  ts?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
}

export interface PaginatedEnvelope<T> extends ApiEnvelope<T[]> {
  meta?: PaginationMeta;
}

export interface AuthResponse extends ApiEnvelope<never> {
  token?: string;
  user?: User;
  userId?: string;
  requiresTwoFactor?: boolean;
  requiresEmailVerification?: boolean;
}

export interface ProductResponse extends ApiEnvelope<Product> {
  product?: Product;
}

export interface TransactionResponse extends ApiEnvelope<Transaction> {
  tx?: Transaction;
  transaction?: Transaction;
}

export interface MembershipResponse extends ApiEnvelope<Membership> {
  membership?: Membership | null;
}

export interface MetaResponse extends ApiEnvelope<unknown> {
  platforms?: string[];
  languages?: string[];
}


export interface BadgeStats {
  [key: string]: string | number | boolean | null | undefined;
}

export interface BadgeListResponse extends ApiEnvelope<never> {
  badges: Badge[];
  count?: number;
  stats?: BadgeStats;
}

export interface UserMembershipSubscription {
  id: string;
  userId: string;
  membershipTierId: string;
  status: string;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  billingCycle?: string;
  amount?: number;
}

export interface ActiveMembership {
  subscription: UserMembershipSubscription;
  tier: Membership;
  isExpired: boolean;
  daysRemaining: number;
}

export interface MembershipSummary {
  tier: (Pick<Membership, 'id' | 'name' | 'benefits'> & { daysRemaining?: number }) | null;
  addons: Array<{ id: string; name: string; daysRemaining?: number | null }>;
  platformFee: string;
  benefits: { dailyBoost: boolean; glowBorder: boolean };
}

export interface MembershipTiersResponse extends ApiEnvelope<never> {
  tiers: Membership[];
  count: number;
}

export interface AddOnListResponse extends ApiEnvelope<never> {
  addons: AddOn[];
  count: number;
}

export interface UserMembershipResponse extends ApiEnvelope<never> {
  membership: ActiveMembership | null;
  summary: MembershipSummary | null;
}

export interface SubscriptionResponse extends ApiEnvelope<never> {
  subscription: UserMembershipSubscription;
}

export interface UserResponse extends ApiEnvelope<never> {
  user: User;
}

export interface ReviewListResponse extends ApiEnvelope<Review[]> {
  average: number;
  count: number;
}

export interface ReviewMutationResponse extends ApiEnvelope<never> {
  review: Review;
  updated?: boolean;
}

export interface ReviewBucket {
  data: Review[];
  average: number;
  count: number;
}

export interface DashboardReviewsResponse extends ApiEnvelope<never> {
  userToUser: ReviewBucket;
  userToWebsite: ReviewBucket;
  userToEscrow: ReviewBucket;
}

export interface VerificationStatus {
  verified: boolean;
  idVerified: boolean;
  idVerificationStatus?: string | null;
  buyerVerified: boolean;
  hideProfile?: boolean;
  role?: UserRole;
}
