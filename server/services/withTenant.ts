export function withTenant<T extends Record<string, any>>(model: T, tenantId: string) {
  return {
    findMany: (opts: any = {}) =>
      (model as any).findMany({
        where: { restaurantId: tenantId, ...(opts.where || {}) },
        ...opts
      }),

    findFirst: (opts: any = {}) =>
      (model as any).findFirst({
        where: { restaurantId: tenantId, ...(opts.where || {}) },
        ...opts
      }),

    create: (opts: any = {}) =>
      (model as any).create({
        data: { restaurantId: tenantId, ...(opts.data || {}) }
      }),

    update: (opts: any = {}) => (model as any).update(opts),
    delete: (opts: any = {}) => (model as any).delete(opts)
  };
}
