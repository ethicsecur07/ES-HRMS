"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = void 0;
class OcrService {
    /**
     * Mocks OCR extraction from a receipt file URL.
     * In a real implementation, this would call AWS Textract or Google Cloud Vision API.
     */
    static async extractReceiptData(fileUrl) {
        console.log(`[OCR] Processing receipt: ${fileUrl}`);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Mock extraction
        return {
            merchantName: "Sample Vendor Pvt Ltd",
            totalAmount: 1450.00,
            date: new Date().toISOString().split('T')[0],
            confidenceScore: 0.92
        };
    }
}
exports.OcrService = OcrService;
