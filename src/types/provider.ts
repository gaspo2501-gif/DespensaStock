export interface Provider {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateProviderInput = Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>;
