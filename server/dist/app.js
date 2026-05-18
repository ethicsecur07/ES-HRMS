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
const analytics_routes_js_1 = __importDefault(require("./routes/analytics.routes.js"));
const permission_routes_js_1 = __importDefault(require("./routes/permission.routes.js"));
const task_routes_js_1 = __importDefault(require("./routes/task.routes.js"));
const finance_routes_js_1 = __importDefault(require("./routes/finance.routes.js"));
const rateLimiter_js_1 = require("./middlewares/rateLimiter.js");
const errorHandler_js_1 = require("./middlewares/errorHandler.js");
const createApp = () => {
    const app = (0, express_1.default)();
    // Security & Utility Middlewares
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({ origin: true, credentials: true }));
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, morgan_1.default)('dev'));
    app.use(rateLimiter_js_1.apiRateLimiter);
    // API Routes
    app.use('/api/auth', auth_routes_js_1.default);
    app.use('/api/employees', employee_routes_js_1.default);
    app.use('/api/attendance', attendance_routes_js_1.default);
    app.use('/api/leaves', leave_routes_js_1.default);
    app.use('/api/wfh', wfh_routes_js_1.default);
    app.use('/api/payrolls', payroll_routes_js_1.default);
    app.use('/api/analytics', analytics_routes_js_1.default);
    app.use('/api/permissions', permission_routes_js_1.default);
    app.use('/api/tasks', task_routes_js_1.default);
    app.use('/api/finance', finance_routes_js_1.default);
    // Healthcheck Route
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'UP', timestamp: new Date() });
    });
    // Global Error Handler
    app.use(errorHandler_js_1.errorHandler);
    return app;
};
exports.createApp = createApp;
