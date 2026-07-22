const userRepository = require("../repositories/userRepository");

const ADMIN_ROLES = new Set(["admin", "owner"]);

module.exports = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authorization required.",
    });
  }

  try {
    let role = req.user.role;

    if (!role) {
      const user = await userRepository.findById(req.user.id);
      role = user?.role || "customer";
      req.user.role = role;
    }

    if (!ADMIN_ROLES.has(role)) {
      return res.status(403).json({
        success: false,
        error: "Admin access required.",
      });
    }

    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
