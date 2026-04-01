import axios from "axios";

const instance = axios.create({
  baseURL: "/api",
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

instance.interceptors.request.use((config) => {
  const tenantId = localStorage.getItem("restaurantId") || "sbb-master-001";
  config.headers["x-restaurant"] = tenantId;

  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default instance;
