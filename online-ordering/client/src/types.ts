export type OnlineProduct = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  category: string;
};

export type OnlineCategory = {
  name: string;
  items: OnlineProduct[];
};

export type CartItem = {
  product: OnlineProduct;
  quantity: number;
};

export type OrderPayload = {
  items: Array<{
    productId: number;
    quantity: number;
    priceAtTimeOfSale: number;
  }>;
  channel: "ONLINE";
  timestamp: string;
};
