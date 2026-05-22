"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCandidate = exports.updateCandidate = exports.updateCandidateStage = exports.getCandidates = exports.createCandidate = void 0;
const Candidate_js_1 = require("../../models/Candidate.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const createCandidate = async (req, res) => {
    try {
        const candidate = new Candidate_js_1.Candidate(req.body);
        await candidate.save();
        (0, socketHandler_js_1.getIO)()?.emit('candidate_created', candidate);
        res.status(201).json({ success: true, candidate });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.createCandidate = createCandidate;
const getCandidates = async (req, res) => {
    try {
        const candidates = await Candidate_js_1.Candidate.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, candidates });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCandidates = getCandidates;
const updateCandidateStage = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage } = req.body;
        const candidate = await Candidate_js_1.Candidate.findByIdAndUpdate(id, { stage }, { new: true });
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        (0, socketHandler_js_1.getIO)()?.emit('candidate_updated', candidate);
        res.status(200).json({ success: true, candidate });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.updateCandidateStage = updateCandidateStage;
const updateCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Candidate_js_1.Candidate.findByIdAndUpdate(id, req.body, { new: true });
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        (0, socketHandler_js_1.getIO)()?.emit('candidate_updated', candidate);
        res.status(200).json({ success: true, candidate });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.updateCandidate = updateCandidate;
const deleteCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Candidate_js_1.Candidate.findByIdAndDelete(id);
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        (0, socketHandler_js_1.getIO)()?.emit('candidate_deleted', { candidateId: id });
        res.status(200).json({ success: true, message: 'Candidate deleted' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteCandidate = deleteCandidate;
