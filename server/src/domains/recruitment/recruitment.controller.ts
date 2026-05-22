import { Request, Response } from 'express';
import { Candidate } from '../../models/Candidate.js';
import { getIO } from '../../sockets/socketHandler.js';

export const createCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const candidate = new Candidate(req.body);
    await candidate.save();
    
    getIO()?.emit('candidate_created', candidate);
    
    res.status(201).json({ success: true, candidate });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getCandidates = async (req: Request, res: Response): Promise<void> => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, candidates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCandidateStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    const candidate = await Candidate.findByIdAndUpdate(
      id,
      { stage },
      { new: true }
    );

    if (!candidate) {
      res.status(404).json({ success: false, message: 'Candidate not found' });
      return;
    }

    getIO()?.emit('candidate_updated', candidate);

    res.status(200).json({ success: true, candidate });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const candidate = await Candidate.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!candidate) {
      res.status(404).json({ success: false, message: 'Candidate not found' });
      return;
    }

    getIO()?.emit('candidate_updated', candidate);

    res.status(200).json({ success: true, candidate });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const candidate = await Candidate.findByIdAndDelete(id);

    if (!candidate) {
      res.status(404).json({ success: false, message: 'Candidate not found' });
      return;
    }

    getIO()?.emit('candidate_deleted', { candidateId: id });

    res.status(200).json({ success: true, message: 'Candidate deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
