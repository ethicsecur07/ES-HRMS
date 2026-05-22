"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgileEngine = void 0;
const Sprint_js_1 = require("../../models/project-management/Sprint.js");
const Task_js_1 = require("../../models/Task.js");
class AgileEngine {
    /**
     * Calculates the burndown chart data for a given sprint.
     * Compares ideal burndown trend vs actual completed story points.
     */
    static async calculateSprintBurndown(sprintId) {
        const sprint = await Sprint_js_1.Sprint.findById(sprintId);
        if (!sprint)
            throw new Error("Sprint not found");
        const start = new Date(sprint.startDate);
        const end = new Date(sprint.endDate);
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
        // In a real app, we'd query historical snapshots or audit logs of task transitions
        // Here we'll generate a projected structure based on current state.
        const tasks = await Task_js_1.Task.find({ sprintName: sprint.name, projectId: sprint.projectId });
        const totalPoints = tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
        const completedPoints = tasks
            .filter(t => t.status === 'COMPLETED')
            .reduce((sum, task) => sum + (task.storyPoints || 0), 0);
        const idealVelocityPerDay = totalPoints / totalDays;
        const chartData = [];
        let currentIdeal = totalPoints;
        for (let i = 0; i <= totalDays; i++) {
            chartData.push({
                day: i,
                idealRemaining: Math.max(0, currentIdeal),
                // Simplistic actual remaining tracking for prototyping:
                // Assume linear completion for the sake of the mock if active, else just final points
                actualRemaining: i === totalDays ? (totalPoints - completedPoints) : null
            });
            currentIdeal -= idealVelocityPerDay;
        }
        return {
            sprintName: sprint.name,
            totalPoints,
            completedPoints,
            burndown: chartData
        };
    }
    /**
     * Calculates team velocity (average points completed per sprint) across the last N sprints
     */
    static async calculateTeamVelocity(projectId, limit = 3) {
        const sprints = await Sprint_js_1.Sprint.find({ projectId, status: 'COMPLETED' })
            .sort({ endDate: -1 })
            .limit(limit);
        if (sprints.length === 0)
            return 0;
        const totalCompleted = sprints.reduce((sum, s) => sum + s.completedStoryPoints, 0);
        return Math.round(totalCompleted / sprints.length);
    }
}
exports.AgileEngine = AgileEngine;
