import { 
  LineChart, 
  BarChart, 
  Trophy, 
  ClipboardList,
  DollarSign 
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: 'ranking' | 'points' | 'trophy' | 'clipboard' | 'money';
  color: 'primary' | 'secondary' | 'accent' | 'green';
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => {
  // Define color classes based on the color prop
  const colorClasses = {
    primary: {
      border: 'border-primary-600',
      bg: 'bg-primary-100',
      text: 'text-primary-600',
    },
    secondary: {
      border: 'border-secondary-800',
      bg: 'bg-secondary-100',
      text: 'text-secondary-800',
    },
    accent: {
      border: 'border-accent-500',
      bg: 'bg-orange-100',
      text: 'text-accent-500',
    },
    green: {
      border: 'border-green-600',
      bg: 'bg-green-100',
      text: 'text-green-600',
    },
  }[color];
  
  // Select icon component based on the icon prop
  const IconComponent = () => {
    switch (icon) {
      case 'ranking':
        return <LineChart className={`h-6 w-6 ${colorClasses.text}`} />;
      case 'points':
        return <DollarSign className={`h-6 w-6 ${colorClasses.text}`} />;
      case 'trophy':
        return <Trophy className={`h-6 w-6 ${colorClasses.text}`} />;
      case 'clipboard':
        return <ClipboardList className={`h-6 w-6 ${colorClasses.text}`} />;
      case 'money':
        return <BarChart className={`h-6 w-6 ${colorClasses.text}`} />;
      default:
        return <LineChart className={`h-6 w-6 ${colorClasses.text}`} />;
    }
  };
  
  return (
    <div className={`bg-white rounded-lg shadow p-5 border-l-4 ${colorClasses.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        </div>
        <div className={`${colorClasses.bg} p-3 rounded-full`}>
          <IconComponent />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
