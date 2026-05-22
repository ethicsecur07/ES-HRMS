"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureMiddleware = exports.hppProtection = exports.xssProtection = exports.securityHeaders = void 0;
const helmet_1 = __importDefault(require("helmet"));
// @ts-expect-error missing types
const xss_clean_1 = __importDefault(require("xss-clean"));
// @ts-expect-error missing types
const hpp_1 = __importDefault(require("hpp"));
exports.securityHeaders = (0, helmet_1.default)({
    contentSecurityPolicy: false, // We'll set CSP separately via cspHeaders
});
exports.xssProtection = (0, xss_clean_1.default)();
exports.hppProtection = (0, hpp_1.default)();
// Combined middleware for convenience
const secureMiddleware = (req, res, next) => {
    (0, exports.securityHeaders)(req, res, () => {
        (0, exports.xssProtection)(req, res, () => {
            (0, exports.hppProtection)(req, res, next);
        });
    });
};
exports.secureMiddleware = secureMiddleware;
