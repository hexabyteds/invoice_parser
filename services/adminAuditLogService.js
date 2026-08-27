const auditLogRepository = require("../repositories/auditLogRepository");

function accountTypeLabel(row) {
  if (row.user_role === "admin") return "Super Admin";
  return row.account_type || "—";
}

function formatRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    module: row.module || "—",
    status: row.status || "SUCCESS",
    description: row.description,
    ipAddress: row.ip_address,
    user: row.user_id
      ? { id: row.user_id, name: row.user_name, email: row.user_email }
      : null,
    accountType: accountTypeLabel(row),
    company: row.company_id ? { id: row.company_id, name: row.company_name } : null,
  };
}

class AdminAuditLogService {
  async getLogs({ limit = 25, offset = 0, ...filters } = {}) {
    const [rows, total] = await Promise.all([
      auditLogRepository.findAll({ limit, offset, ...filters }),
      auditLogRepository.countAll(filters),
    ]);

    return {
      logs: rows.map(formatRow),
      total,
    };
  }

  async getFilterOptions() {
    const actions = await auditLogRepository.getDistinctActions();
    return { actions };
  }
}

module.exports = new AdminAuditLogService();
