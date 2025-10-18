export type Category = { id: string; name: string };
export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  desc: string;
  price: number;
  image?: string;
};

export type CartItem = {
  item: MenuItem;
  qty: number;
  note?: string;
};

export type OrderPayload = {
  customer?: {
    name?: string;
    phone?: string;
    notes?: string;
  };
  scheduledAt?: string | null; // ISO
  items: Array<{
    id: string;
    name: string;
    unitPrice: number;
    qty: number;
    note?: string;
    categoryId: string;
  }>;
  subtotal: number;
  serviceFee: number;
  total: number;
  currency: "THB";
};
