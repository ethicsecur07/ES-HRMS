import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectApi } from '../api_service/projectApi';
import { KanbanBoard } from '../Components/project/KanbanBoard';
import { ArrowLeft, Clock } from 'lucide-react';

export const ProjectDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    if (id) {
      projectApi.getProjectDetails(id).then(data => setProject(data.project)).catch(e => console.error(e));
    }
  }, [id]);

  if (!project) return <div className="p-6 text-slate-400">Loading project details...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/projects')}
          className="mr-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
          <div className="flex items-center text-slate-400 text-sm mt-1">
            <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded mr-3 border border-indigo-500/20">
              {project.status}
            </span>
            <Clock className="w-4 h-4 mr-1" />
            Ends: {new Date(project.endDate).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Kanban Board Area */}
      <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-800 p-4 overflow-hidden">
        <KanbanBoard projectId={project._id} />
      </div>
    </div>
  );
};
