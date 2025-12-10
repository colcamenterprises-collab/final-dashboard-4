// PATCH O14 Chunk 5 — Payment Provider Service
import { db } from "../../lib/prisma";
import type { PaymentGateway } from "@prisma/client";

export const PaymentProviderService = {
  async getProviders(tenantId: string) {
    return db().restaurant_payment_providers_v1.findMany({
      where: { restaurantId: tenantId }
    });
  },

  async saveProvider(
    tenantId: string,
    provider: PaymentGateway,
    status: boolean,
    credentials: any
  ) {
    return db().restaurant_payment_providers_v1.upsert({
      where: {
        restaurantId_provider: {
          restaurantId: tenantId,
          provider
        }
      },
      update: { status, credentials },
      create: {
        restaurantId: tenantId,
        provider,
        status,
        credentials
      }
    });
  },

  async getActiveProvider(tenantId: string, provider: PaymentGateway) {
    return db().restaurant_payment_providers_v1.findFirst({
      where: {
        restaurantId: tenantId,
        provider,
        status: true
      }
    });
  }
};
