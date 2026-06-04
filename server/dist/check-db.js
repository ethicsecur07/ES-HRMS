"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI;
async function run() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI not found in .env');
        return;
    }
    await mongoose_1.default.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    const userId = '6a1ed7d7a03ff2c9a45f1c10'; // ABIRAMI's User ID
    // Delete all active sessions for this user
    const result = await mongoose_1.default.connection.db.collection('usersessions')
        .deleteMany({ userId: new mongoose_1.default.Types.ObjectId(userId) });
    console.log(`Deleted ${result.deletedCount} sessions for user ABIRAMI.`);
    await mongoose_1.default.disconnect();
}
run().catch(console.error);
