export const PermissionsMatrix: Record<string, Record<string, boolean>> = {
  owner: {
    menu: true,
    stock: true,
    finance: true,
    pos: true,
    kds: true,
    deliveries: true,
    partners: true,
    settings: true
  },

  manager: {
    menu: true,
    stock: true,
    finance: true,
    pos: true,
    kds: true,
    deliveries: true,
    partners: false,
    settings: false
  },

  staff: {
    menu: false,
    stock: false,
    finance: false,
    pos: true,
    kds: true,
    deliveries: false,
    partners: false,
    settings: false
  },

  pos: {
    menu: false,
    stock: false,
    finance: false,
    pos: true,
    kds: true,
    deliveries: false,
    partners: false,
    settings: false
  },

  viewer: {
    menu: false,
    stock: false,
    finance: true,
    pos: false,
    kds: false,
    deliveries: false,
    partners: false,
    settings: false
  }
};
