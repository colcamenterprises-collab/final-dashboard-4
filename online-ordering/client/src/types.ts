export type OnlineProduct = {
  id: string;
  sku?: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  category: string;
};

export type OnlineCategory = {
  name: string;
  items: OnlineProduct[];
};

export type CartModifier = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

export type CartItem = {
  lineId: string;
  product: OnlineProduct;
  quantity: number;
  modifiers: CartModifier[];
};

export type OrderPayload = {
  items: Array<{
    itemId: string;
    quantity: number;
    modifiers: Array<{
      groupId: string;
      optionId: string;
    }>;
  }>;
  channel: "ONLINE";
  timestamp: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
};
