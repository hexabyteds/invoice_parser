import api from "./api";

export const getUsage = async () => {
    const { data } = await api.get("/usage");
    return data;
};
export const getAllUsage = async () => {
    const response = await api.get("/usage/admin");
    return response.data;
};