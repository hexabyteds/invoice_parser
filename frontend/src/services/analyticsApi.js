import API from "./api";



API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
  
    console.log("TOKEN:", token);
  
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  
    console.log(config.headers);
  
    return config;
  });

export const getAnalytics = () =>
    API.get("/analytics");