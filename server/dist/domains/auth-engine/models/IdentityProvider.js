"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityProvider = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const identityProviderSchema = new mongoose_1.Schema({
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    providerType: {
        type: String,
        enum: ['LOCAL', 'GOOGLE', 'MICROSOFT', 'AZURE_AD', 'OKTA', 'AUTH0', 'ONELOGIN', 'SAML2'],
        required: true,
    },
    displayName: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
    isPrimary: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },
    // OAuth2
    clientId: { type: String },
    clientSecret: { type: String },
    redirectUri: { type: String },
    authorizationUrl: { type: String },
    tokenUrl: { type: String },
    userInfoUrl: { type: String },
    scopes: [{ type: String }],
    // SAML
    samlEntryPoint: { type: String },
    samlIssuer: { type: String },
    samlCert: { type: String },
    samlCallbackUrl: { type: String },
    samlSignatureAlgorithm: { type: String, default: 'sha256' },
    // Provider-specific
    tenantId: { type: String },
    domain: { type: String },
    apiKey: { type: String },
    // Attribute mapping
    attributeMapping: {
        email: { type: String, default: 'email' },
        name: { type: String, default: 'name' },
        firstName: { type: String },
        lastName: { type: String },
        groups: { type: String },
        department: { type: String },
    },
    // Auto-provisioning
    autoProvision: { type: Boolean, default: false },
    defaultRoleCode: { type: String },
}, { timestamps: true });
const crypto_js_1 = require("../../../utils/crypto.js");
identityProviderSchema.pre('save', function (next) {
    if (this.isModified('clientSecret') && this.clientSecret) {
        this.clientSecret = (0, crypto_js_1.encrypt)(this.clientSecret);
    }
    if (this.isModified('apiKey') && this.apiKey) {
        this.apiKey = (0, crypto_js_1.encrypt)(this.apiKey);
    }
    next();
});
identityProviderSchema.post('init', function (doc) {
    if (doc.clientSecret) {
        doc.clientSecret = (0, crypto_js_1.decrypt)(doc.clientSecret);
    }
    if (doc.apiKey) {
        doc.apiKey = (0, crypto_js_1.decrypt)(doc.apiKey);
    }
});
identityProviderSchema.index({ organizationId: 1, providerType: 1 }, { unique: true });
identityProviderSchema.index({ organizationId: 1, isPrimary: 1 });
exports.IdentityProvider = mongoose_1.default.model('IdentityProvider', identityProviderSchema);
