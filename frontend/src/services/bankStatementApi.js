// src/services/bankStatementApi.js

import api from "./api";

export const getBankStatement = (id) =>
  api.get(`/bank-statements/${id}`);

export const getBankStatementSource = (id) =>
  api.get(`/bank-statements/${id}/source`, {
    responseType: "blob",
  });

export const getBankStatementTransactions = (id, params = {}) =>
  api.get(`/bank-statements/${id}/transactions`, { params });

export const updateBankStatement = (id, data) =>
  api.put(`/bank-statements/${id}`, data);

export const deleteBankStatement = (id) =>
  api.delete(`/bank-statements/${id}`);
