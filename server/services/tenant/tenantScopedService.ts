import { db } from "../../lib/prisma";

export const TenantScoped = {
  async ensureRestaurantExists() {
    const prisma = db();
    const exists = await prisma.saas_tenants.findFirst({
      where: { id: 1 }
    });

    if (!exists) {
      await prisma.saas_tenants.create({
        data: {
          id: 1,
          name: "Smash Brothers Burgers",
          domain: "smashbrothersburgers.com",
          settings: {
            create: {}
          }
        }
      });
      console.log("[SaaS] Default tenant created: Smash Brothers Burgers (ID: 1)");
    }
  }
};
