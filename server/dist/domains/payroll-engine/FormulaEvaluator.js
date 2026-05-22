"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormulaEvaluator = void 0;
class FormulaEvaluator {
    /**
     * Safely evaluate a mathematical formula against a set of variables.
     * e.g., formula: "Base * 0.4 + FixedAllowance", variables: { Base: 50000, FixedAllowance: 2000 }
     */
    static evaluate(formula, variables) {
        try {
            // 1. Validate the formula contains only allowed characters (variables, numbers, math operators)
            // This is a basic safety check before using Function
            if (!/^[a-zA-Z0-9\s+\-*/().]+$/.test(formula)) {
                throw new Error("Invalid characters in formula");
            }
            // 2. Replace variables with their numeric values
            let expression = formula;
            for (const [key, value] of Object.entries(variables)) {
                // Regex to match whole words for the variable
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                expression = expression.replace(regex, value.toString());
            }
            // 3. Ensure no unreplaced alphabetic characters remain (prevent code injection)
            if (/[a-zA-Z]/.test(expression)) {
                throw new Error(`Unresolved variables in expression: ${expression}`);
            }
            // 4. Safely evaluate
            const result = new Function(`return ${expression}`)();
            return Number(result) || 0;
        }
        catch (err) {
            console.error(`Formula evaluation failed for: ${formula}`, err);
            return 0; // Fallback or throw
        }
    }
    /**
     * Evaluate a conditional expression
     * e.g., expression: "Base > 50000", variables: { Base: 60000 } -> returns true
     */
    static evaluateCondition(expression, variables) {
        try {
            if (!/^[a-zA-Z0-9\s+\-*/().><=!]+$/.test(expression)) {
                throw new Error("Invalid characters in condition expression");
            }
            let parsedExpression = expression;
            for (const [key, value] of Object.entries(variables)) {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                parsedExpression = parsedExpression.replace(regex, value.toString());
            }
            if (/[a-zA-Z]/.test(parsedExpression)) {
                throw new Error(`Unresolved variables in condition: ${parsedExpression}`);
            }
            const result = new Function(`return ${parsedExpression}`)();
            return Boolean(result);
        }
        catch (err) {
            console.error(`Condition evaluation failed for: ${expression}`, err);
            return false;
        }
    }
}
exports.FormulaEvaluator = FormulaEvaluator;
