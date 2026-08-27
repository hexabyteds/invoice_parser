const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyContext = require("../middleware/companyContext");
const requireCompanyPermission = require("../middleware/requireCompanyPermission");
const companyController = require("../controllers/companyController");

router.use(authMiddleware);

// A Freelancer's self-service "start a new workspace" — no "current
// company" to resolve yet, since this is how one gets created in the
// first place. Restricted to FREELANCER accounts inside the service layer.
router.post("/", (req, res) => companyController.create(req, res));

// The active company's own details (address/phone/email/TRN) — view for
// any member, edit restricted to the owner inside the service layer.
router.get("/current", companyContext, (req, res) => companyController.getCurrent(req, res));
router.patch("/current", companyContext, (req, res) => companyController.updateCurrent(req, res));

// Acting on the caller's OWN membership rows — no "current company" to
// resolve yet, since accepting is how a company becomes selectable at all.
router.post("/invitations/:membershipId/accept", (req, res) => companyController.acceptInvitation(req, res));
router.post("/invitations/:membershipId/decline", (req, res) => companyController.declineInvitation(req, res));

// Team & Access — scoped to whichever company the caller is currently
// acting as (defaults to their own owned company; see companyContext).
// Gated on the "team" module so a trusted freelancer/staff member could be
// granted it later without any redesign, but by default only OWNER passes
// (requireCompanyPermission's OWNER bypass).
router.post("/team/invite", companyContext, requireCompanyPermission("team", "manage"), (req, res) => companyController.invite(req, res));
router.get("/team", companyContext, requireCompanyPermission("team", "manage"), (req, res) => companyController.listTeam(req, res));
router.patch("/team/:membershipId", companyContext, requireCompanyPermission("team", "manage"), (req, res) => companyController.updateMember(req, res));
router.delete("/team/:membershipId", companyContext, requireCompanyPermission("team", "manage"), (req, res) => companyController.removeMember(req, res));

module.exports = router;
