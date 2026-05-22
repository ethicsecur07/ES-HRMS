"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportProjectInvoice = exports.getEmployeeProductivity = exports.getTeamVelocity = exports.getSprintBurndown = void 0;
const AgileEngine_js_1 = require("./AgileEngine.js");
const ProductivityEngine_js_1 = require("./ProductivityEngine.js");
const TimesheetService_js_1 = require("./TimesheetService.js");
const mongoose_1 = __importDefault(require("mongoose"));
const getSprintBurndown = async (req, res, next) => {
    try {
        const { sprintId } = req.params;
        const data = await AgileEngine_js_1.AgileEngine.calculateSprintBurndown(new mongoose_1.default.Types.ObjectId(sprintId));
        res.json(data);
    }
    catch (err) {
        next(err);
    }
};
exports.getSprintBurndown = getSprintBurndown;
const getTeamVelocity = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const velocity = await AgileEngine_js_1.AgileEngine.calculateTeamVelocity(new mongoose_1.default.Types.ObjectId(projectId));
        res.json({ projectId, averageVelocity: velocity });
    }
    catch (err) {
        next(err);
    }
};
exports.getTeamVelocity = getTeamVelocity;
const getEmployeeProductivity = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            res.status(400).json({ message: 'startDate and endDate are required query params' });
            return;
        }
        const objectId = new mongoose_1.default.Types.ObjectId(employeeId);
        const [utilization, score] = await Promise.all([
            ProductivityEngine_js_1.ProductivityEngine.calculateUtilization(objectId, startDate, endDate),
            ProductivityEngine_js_1.ProductivityEngine.calculateProductivityScore(objectId)
        ]);
        res.json({
            employeeId,
            utilization,
            productivityScore: score
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getEmployeeProductivity = getEmployeeProductivity;
const exportProjectInvoice = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { yearMonth } = req.body; // e.g. "2023-10"
        const data = await TimesheetService_js_1.TimesheetService.generateInvoicePayload(new mongoose_1.default.Types.ObjectId(projectId), yearMonth);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
};
exports.exportProjectInvoice = exportProjectInvoice;
