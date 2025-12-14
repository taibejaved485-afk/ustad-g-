import React from 'react';
import { Subject } from '../types';

interface SubjectCardProps {
  subject: Subject;
  icon: string;
  color: string;
  onClick: (subject: Subject) => void;
  index: number;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({ subject, icon, color, onClick, index }) => {
  // Extract the color name (e.g., "bg-indigo-500" -> "indigo-500") for border usage
  const colorClass = color.replace('bg-', '');

  return (
    <button
      onClick={() => onClick(subject)}
      style={{ animationDelay: `${index * 100}ms` }}
      className={`
        group relative overflow-hidden animate-pop-in hover-shimmer
        bg-white hover:bg-white
        border-2 border-transparent hover:border-${colorClass}
        rounded-2xl p-6 flex flex-col items-center justify-center gap-4 
        shadow-md hover:shadow-2xl hover:shadow-${colorClass}/20
        transform transition-all duration-300 hover:-translate-y-2
      `}
    >
      {/* Decorative gradient blob background on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-br from-${colorClass} to-white`}></div>

      <div className={`
        relative z-10 text-4xl p-4 rounded-full w-20 h-20 flex items-center justify-center 
        transition-all duration-300 group-hover:scale-110 group-hover:rotate-6
        ${color} text-white shadow-lg
      `}>
        <i className={icon}></i>
      </div>
      
      <span className={`relative z-10 font-bold text-lg tracking-wide text-slate-700 group-hover:text-${colorClass} transition-colors`}>
        {subject}
      </span>
      
      {/* Little arrow indicator */}
      <div className="absolute bottom-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 text-slate-400 text-xs">
         Tap to start <i className="fas fa-arrow-right ml-1"></i>
      </div>
    </button>
  );
};