import React from 'react';
import {
  Globe,
  Code2,
  Terminal,
  Headphones,
  Network,
  Database,
  CheckSquare,
  Shield,
  Cpu
} from 'lucide-react';

export default function TechAreaIcon({ areaId, className = "w-3.5 h-3.5" }) {
  switch (areaId) {
    case 'all':
      return <Globe className={className} />;
    case 'dev':
      return <Code2 className={className} />;
    case 'devops':
      return <Terminal className={className} />;
    case 'support':
      return <Headphones className={className} />;
    case 'infra':
      return <Network className={className} />;
    case 'data':
      return <Database className={className} />;
    case 'qa':
      return <CheckSquare className={className} />;
    case 'security':
      return <Shield className={className} />;
    case 'other':
    default:
      return <Cpu className={className} />;
  }
}
