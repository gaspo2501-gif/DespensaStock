export interface Customer {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type CreateCustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
