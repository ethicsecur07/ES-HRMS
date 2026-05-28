"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_routes_js_1 = __importDefault(require("./routes/auth.routes.js"));
const employee_routes_js_1 = __importDefault(require("./routes/employee.routes.js"));
const attendance_routes_js_1 = __importDefault(require("./routes/attendance.routes.js"));
const leave_routes_js_1 = __importDefault(require("./routes/leave.routes.js"));
const wfh_routes_js_1 = __importDefault(require("./routes/wfh.routes.js"));
const payroll_routes_js_1 = __importDefault(require("./routes/payroll.routes.js"));
const payroll_routes_js_2 = __importDefault(require("./domains/payroll-engine/payroll.routes.js"));
const leavev2_routes_js_1 = __importDefault(require("./domains/leave-engine/leavev2.routes.js"));
const helmetEnhancements_js_1 = require("./middlewares/helmetEnhancements.js");
const cspHeaders_js_1 = require("./middlewares/cspHeaders.js");
const sentry_js_1 = require("./utils/sentry.js");
const rateLimiter_js_1 = require("./middlewares/rateLimiter.js");
const metrics_1 = require("./middlewares/metrics");
const auth_engine_routes_js_1 = __importDefault(require("./domains/auth-engine/auth-engine.routes.js"));
const analytics_routes_js_1 = __importDefault(require("./routes/analytics.routes.js"));
const permission_routes_js_1 = __importDefault(require("./routes/permission.routes.js"));
const task_routes_js_1 = __importDefault(require("./routes/task.routes.js"));
const finance_routes_js_1 = __importDefault(require("./routes/finance.routes.js"));
const upload_routes_js_1 = __importDefault(require("./routes/upload.routes.js"));
const organization_routes_js_1 = __importDefault(require("./domains/organization/organization.routes.js"));
const module_routes_js_1 = __importDefault(require("./routes/module.routes.js"));
const attendance_routes_js_2 = __importDefault(require("./domains/attendance-engine/attendance.routes.js"));
const document_routes_js_1 = __importDefault(require("./routes/document.routes.js"));
const role_routes_js_1 = __importDefault(require("./routes/role.routes.js"));
const asset_routes_js_1 = __importDefault(require("./routes/asset.routes.js"));
const authPermission_routes_js_1 = __importDefault(require("./routes/authPermission.routes.js"));
const department_routes_js_1 = __importDefault(require("./routes/department.routes.js"));
const designation_routes_js_1 = __importDefault(require("./routes/designation.routes.js"));
const holidayCalendar_routes_js_1 = __importDefault(require("./routes/holidayCalendar.routes.js"));
const leavePolicy_routes_js_1 = __importDefault(require("./routes/leavePolicy.routes.js"));
const expense_routes_js_1 = __importDefault(require("./routes/expense.routes.js"));
const project_routes_js_1 = __importDefault(require("./domains/project-management/project.routes.js"));
const recruitment_routes_js_1 = __importDefault(require("./domains/recruitment/recruitment.routes.js"));
const chat_routes_js_1 = __importDefault(require("./domains/chat/chat.routes.js"));
const notification_routes_js_1 = __importDefault(require("./domains/notification/notification.routes.js"));
const reports_routes_js_1 = __importDefault(require("./routes/reports.routes.js"));
const errorHandler_js_1 = require("./middlewares/errorHandler.js");
const traceId_js_1 = require("./middlewares/traceId.js");
const responseFormatter_js_1 = require("./middlewares/responseFormatter.js");
const auth_controller_js_1 = require("./controllers/auth.controller.js");
const createApp = () => {
    const app = (0, express_1.default)();
    // Security & Utility Middlewares
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({ origin: true, credentials: true }));
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, morgan_1.default)('dev'));
    app.use(traceId_js_1.traceIdMiddleware);
    app.use(responseFormatter_js_1.responseFormatter);
    app.use(rateLimiter_js_1.apiRateLimiter);
    // Disable ETags and Browser Caching to ensure fresh 200 OK responses
    app.set('etag', false);
    app.use((req, res, next) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
        next();
    });
    // Initialize Sentry for error monitoring
    (0, sentry_js_1.initSentry)();
    // Security middlewares
    app.use(helmetEnhancements_js_1.securityHeaders);
    app.use(cspHeaders_js_1.cspHeaders);
    app.use(helmetEnhancements_js_1.secureMiddleware);
    // Metrics endpoint
    app.use('/metrics', metrics_1.metricsMiddleware);
    app.get('/api/public/organization-config/:slug', auth_controller_js_1.getTenantConfig);
    app.use('/api/auth', auth_routes_js_1.default);
    app.use('/api/employees', employee_routes_js_1.default);
    app.use('/api/attendance', attendance_routes_js_1.default);
    app.use('/api/attendance', attendance_routes_js_2.default);
    app.use('/api/leaves', leave_routes_js_1.default);
    app.use('/api/wfh', wfh_routes_js_1.default);
    app.use('/api/payrolls', payroll_routes_js_1.default); // Legacy
    app.use('/api/v2/payroll', payroll_routes_js_2.default); // Enterprise Engine
    app.use('/api/projects', project_routes_js_1.default);
    app.use('/api/recruitment', recruitment_routes_js_1.default);
    app.use('/api/chat', chat_routes_js_1.default);
    app.use('/api/notifications', notification_routes_js_1.default);
    app.use('/api/reports', reports_routes_js_1.default);
    app.use('/api/analytics', analytics_routes_js_1.default);
    app.use('/api/permissions', permission_routes_js_1.default);
    app.use('/api/tasks', task_routes_js_1.default);
    app.use('/api/v2/auth', auth_engine_routes_js_1.default); // Enterprise Auth & SSO Engine
    app.use('/api/v2/leave', leavev2_routes_js_1.default); // Enterprise Leave Engine V2
    app.use('/api/finance', finance_routes_js_1.default);
    app.use('/api/expenses', expense_routes_js_1.default);
    app.use('/api/upload', upload_routes_js_1.default);
    app.use('/api/organization', organization_routes_js_1.default);
    app.use('/api/modules', module_routes_js_1.default);
    app.use('/api/documents', document_routes_js_1.default);
    app.use('/api/roles', role_routes_js_1.default);
    app.use('/api/assets', asset_routes_js_1.default);
    app.use('/api/auth-permissions', authPermission_routes_js_1.default);
    app.use('/api/departments', department_routes_js_1.default);
    app.use('/api/designations', designation_routes_js_1.default);
    app.use('/api/holiday-calendar', holidayCalendar_routes_js_1.default);
    app.use('/api/leave-policies', leavePolicy_routes_js_1.default);
    // Healthcheck Route
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'UP', timestamp: new Date() });
    });
    // Global Error Handler
    app.use(errorHandler_js_1.errorHandler);
    return app;
};
exports.createApp = createApp;
