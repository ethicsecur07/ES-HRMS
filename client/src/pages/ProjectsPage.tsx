import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Calendar, Users } from 'lucide-react';
import { projectApi } from '../api_service/projectApi';

export const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectApi.getProjects();
        setProjects(data.projects);
      } catch (error) {
        console.error('Failed to fetch projects', error);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="text-slate-400">Manage your projects and agile sprints</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project: any) => (
          <div 
            key={project._id}
            onClick={() => navigate(`/projects/${project._id}`)}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-indigo-500/50 cursor-pointer transition-all duration-200 group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                <Briefcase className="w-6 h-6" />
              </div>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                project.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                project.status === 'PLANNING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-slate-800 text-slate-400'
              }`}>
                {project.status}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold text-slate-200 mb-2 group-hover:text-indigo-300 transition-colors">{project.name}</h3>
            <p className="text-sm text-slate-400 mb-4 line-clamp-2">{project.description}</p>
            
            <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-800 pt-4 mt-auto">
              <div className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                <span>{new Date(project.startDate).toLocaleDateString()}</span>
              </div>
              {project.teamMemberIds?.length > 0 && (
                <div className="flex items-center ml-auto">
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  <span>{project.teamMemberIds.length} members</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
